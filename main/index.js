// main/index.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const lockfile = require('proper-lockfile');

const fileManager = require('./services/fileManager');
const workbookService = require('./services/workbookService');
const writeHelpers = require('./services/writeHelpers');
const cacheService = require('./services/cacheService');
const jsonService = require('./services/jsonService');

const APP_CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfigFallback() {
  try {
    return require(path.join(__dirname, '..', 'config.example.json'));
  } catch (e) {
    return {};
  }
}
async function loadConfig() {
  try {
    const raw = await fs.readFile(APP_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return loadConfigFallback();
  }
}

let mainWindow;
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Helpers
function isJsonFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.json';
}

// IPC handlers -----------------------------------------------------

// New IPC handler for get-row
ipcMain.handle('get-row', async (_, params) => {
  try {
    if (isJsonFile(params.filePath)) {
      const release = await lockfile.lock(params.filePath, { retries: 10, stale: 15000 });
      try {
        const config = await loadConfig();
        const pkName = config.pkName || 'id';
        const result = await jsonService.getRow({ ...params, pkName });
        return { status: 'ok', row: result.row, message: 'Row fetched successfully.' };
      } finally {
        await release();
      }
    } else {
      // Excel files are not designed for single-row fetching like this.
      // Returning an error or specific message is best practice.
      return { status: 'error', message: 'Row-by-ID fetching is only supported for JSON files.' };
    }
  } catch (err) {
    console.error("Error in get-row IPC handler:", err);
    if (err && err.code === 'LOCK_ERROR') return { status: 'locked', message: 'File is currently locked.' };
    return { status: 'error', message: err.message || 'An unknown error occurred while fetching.' };
  }
});

ipcMain.handle('save-file', async (event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog(options);
  return canceled ? null : filePath;
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('get-initial-data', async () => {
  try {
    const config = await loadConfig();
    const folderPath = config.folderPath;

    if (folderPath && fsSync.existsSync(folderPath)) {
      const files = await fileManager.listExcelFiles(folderPath);
      return { folderPath, files };
    }
    return { folderPath: null, files: [] };
  } catch (error) {
    console.error("Error loading initial data:", error);
    return { folderPath: null, files: [] };
  }
});

ipcMain.handle('get-config', async () => {
  return await loadConfig();
});

ipcMain.handle('choose-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (res.canceled) return null;
  return res.filePaths[0];
});

ipcMain.handle('list-files', async (_, folderPath) => {
  if (!folderPath) return [];
  return await fileManager.listExcelFiles(folderPath);
});

ipcMain.handle('load-workbook-meta', async (_, { filePath }) => {
  let cached = cacheService.get(filePath);
  if (cached && cached.meta) return cached.meta;

  const config = await loadConfig();

  if (isJsonFile(filePath)) {
    const meta = await jsonService.meta(filePath, config.pkName || 'id');
    cacheService.set(filePath, { wb: null, meta }); // we don't cache JSON data here
    return meta;
  } else {
    const wb = workbookService.readWorkbook(filePath);
    const meta = workbookService.workbookMeta(wb, config.ignoreSheets);
    cacheService.set(filePath, { wb, meta });
    return meta;
  }
});

ipcMain.handle('read-sheet-page', async (_, { filePath, sheetName, page = 0, pageSize = 25, filter = '', sort = null }) => {
  const config = await loadConfig();
  const pkName = config.pkName || 'id';

  if (isJsonFile(filePath)) {
    // JSON path
    let result = await jsonService.readSheetPage({ filePath, sheetName, page, pageSize, filter, sort, pkName });

    // Auto-normalize nested rows to ensure id/_version exist
    const dataRaw = await fs.readFile(filePath, 'utf8');
    let jsonData = JSON.parse(dataRaw || '{}');
    const sheetArray = jsonService.getNestedArray(jsonData, sheetName);

    if (sheetArray) {
      let normalized = sheetArray.map(r => jsonService.normalizeRow(r, pkName));

      // Only save if changes occurred
      if (JSON.stringify(sheetArray) !== JSON.stringify(normalized)) {
        const newData = jsonService.setNestedArray(jsonData, sheetName, normalized);
        await fs.writeFile(filePath, JSON.stringify(newData, null, 2), 'utf8');
      }
    }

    return result;

  } else {
    // Excel path (existing)
    let cached = cacheService.get(filePath);
    let wb;
    if (cached && cached.wb) wb = cached.wb;
    else {
      wb = workbookService.readWorkbook(filePath);
      const meta = workbookService.workbookMeta(wb, config.ignoreSheets);
      cacheService.set(filePath, { wb, meta });
    }

    const { headers, rows } = workbookService.sheetToRows(wb, sheetName, pkName);
    let filtered = rows;

    if (filter && filter.trim()) {
      const f = filter.toLowerCase();
      filtered = filtered.filter(r => headers.some(h => String(r[h] ?? '').toLowerCase().includes(f)));
    }

    if (sort && sort.column) {
      filtered.sort((a, b) => {
        const x = a[sort.column]; const y = b[sort.column];
        if (x == null) return -1;
        if (y == null) return 1;
        if (x < y) return sort.dir === 'asc' ? -1 : 1;
        if (x > y) return sort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const total = filtered.length;
    const start = page * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);
    return { headers, total, rows: pageRows };
  }
});



// --- Writes need locking in both paths ---

// Add row
ipcMain.handle('add-row', async (_, params) => {
  try {
    if (isJsonFile(params.filePath)) {
      const release = await lockfile.lock(params.filePath, { retries: 10, stale: 15000 });
      try {
        const config = await loadConfig();
        const pkName = config.pkName || 'id';
        const result = await jsonService.addRow({ ...params, pkName });
        cacheService.invalidate(params.filePath);
        return { status: 'ok', row: result.row, message: result.message };
      } finally {
        await release();
      }
    } else {
      const result = await writeHelpers.performExcelOperationWithLock(params.filePath, 'add-row', params);
      cacheService.invalidate(params.filePath);
      return { status: 'ok', row: params.row, message: result.message };
    }
  } catch (err) {
    console.error("Error in add-row IPC handler:", err);
    if (err && err.code === 'LOCK_ERROR') return { status: 'locked', message: 'File is currently locked.' };
    return { status: 'error', message: err.message || 'An unknown error occurred during add.' };
  }
});

// Update row
ipcMain.handle('update-row', async (_, params) => {
  try {
    if (isJsonFile(params.filePath)) {
      const release = await lockfile.lock(params.filePath, { retries: 10, stale: 15000 });
      try {
        const config = await loadConfig();
        const pkName = config.pkName || 'id';
        const result = await jsonService.updateRow({ ...params, pkName });
        cacheService.invalidate(params.filePath);
        return result; // already {status, message}
      } finally {
        await release();
      }
    } else {
      const result = await writeHelpers.performExcelOperationWithLock(params.filePath, 'update-row', params);
      cacheService.invalidate(params.filePath);
      return { status: 'ok', message: result.message };
    }
  } catch (err) {
    console.error("Error in update-row IPC handler:", err);
    if (err && err.code === 'LOCK_ERROR') return { status: 'locked', message: 'File is currently locked.' };
    if (err.message && err.message.includes("not found")) {
      return { status: 'not_found', message: err.message };
    }
    return { status: 'error', message: err.message || 'An unknown error occurred during update.' };
  }
});

// Delete row
ipcMain.handle('delete-row', async (_, params) => {
  try {
    if (isJsonFile(params.filePath)) {
      const release = await lockfile.lock(params.filePath, { retries: 10, stale: 15000 });
      try {
        const config = await loadConfig();
        const pkName = config.pkName || 'id';
        const result = await jsonService.deleteRow({ ...params, pkName });
        cacheService.invalidate(params.filePath);
        return result; // {status, message}
      } finally {
        await release();
      }
    } else {
      const result = await writeHelpers.performExcelOperationWithLock(params.filePath, 'delete-row', params);
      cacheService.invalidate(params.filePath);
      return { status: 'ok', message: result.message };
    }
  } catch (err) {
    console.error("Error in delete-row IPC handler:", err);
    if (err && err.code === 'LOCK_ERROR') return { status: 'locked', message: 'File is currently locked.' };
    if (err.message && err.message.includes("not found")) {
      return { status: 'not_found', message: err.message };
    }
    return { status: 'error', message: err.message || 'An unknown error occurred during delete.' };
  }
});

// Export copy (unchanged)
ipcMain.handle('export-copy', async (_, { filePath, destPath }) => {
  try {
    await fs.copyFile(filePath, destPath);
    return { status: 'ok' };
  } catch (err) {
    console.error("Error in export-copy IPC handler:", err);
    return { status: 'error', message: err.message || 'Failed to export copy.' };
  }
});
