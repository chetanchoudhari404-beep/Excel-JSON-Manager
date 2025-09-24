// main/services/fileManager.js
const fs = require('fs').promises;
const path = require('path');

async function listExcelFiles(folderPath) {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (e.name.startsWith('.')) continue;
      const ext = path.extname(e.name).toLowerCase();
      // Now include JSON alongside Excel
      if (!['.xlsx', '.xlsm', '.json'].includes(ext)) continue;

      const fp = path.join(folderPath, e.name);
      const stat = await fs.stat(fp);
      files.push({
        name: e.name,
        path: fp,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      });
    }
    files.sort((a,b) => a.name.localeCompare(b.name));
    return files;
  } catch (e) {
    return [];
  }
}

module.exports = { listExcelFiles };
