const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

function isArray(x) { return Array.isArray(x); }
function isObject(x) { return x && typeof x === 'object' && !Array.isArray(x); }

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw || 'null');
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Normalize a row: assign id and _version if missing
function normalizeRow(row, pkName) {
  const out = { ...row };
  if (!out[pkName] || String(out[pkName]).trim() === '') out[pkName] = uuidv4();
  if (out._version == null || String(out._version).trim() === '') out._version = 1;
  return out;
}

// Compute headers for a sheet
function computeHeaders(rows, pkName) {
  const set = new Set();
  for (const r of rows) {
    for (const k of Object.keys(r || {})) set.add(k);
  }
  set.add(pkName);
  set.add('_version');
  return Array.from(set);
}

// --- Recursive sheet detection ---
function inferSheets(data, pathPrefix = '') {
  const sheets = [];
  if (isArray(data)) {
    sheets.push(pathPrefix || 'data');
  } else if (isObject(data)) {
    for (const key of Object.keys(data)) {
      const val = data[key];
      const newPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (isArray(val)) sheets.push(newPath);
      else if (isObject(val)) sheets.push(...inferSheets(val, newPath));
    }
  }
  return sheets;
}

// --- Get nested array by path ---
function getNestedArray(data, path) {
  if (!path) return null;
  const parts = path.split('.').map(p => p.replace(/\[(\d+)\]/, '$1'));
  let curr = data;
  for (const part of parts) {
    if (curr == null) return null;
    if (/^\d+$/.test(part)) curr = curr[parseInt(part)];
    else curr = curr[part];
  }
  return isArray(curr) ? curr : null;
}

// --- Set nested array by path ---
function setNestedArray(data, path, newArray) {
  if (!path) return newArray;
  const parts = path.split('.').map(p => p.replace(/\[(\d+)\]/, '$1'));
  const newData = Array.isArray(data) ? [...data] : { ...data };
  let curr = newData;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (/^\d+$/.test(part)) {
      const idx = parseInt(part);
      curr[idx] = Array.isArray(curr[idx]) ? [...curr[idx]] : { ...curr[idx] };
      curr = curr[idx];
    } else {
      curr[part] = Array.isArray(curr[part]) ? [...curr[part]] : { ...curr[part] };
      curr = curr[part];
    }
  }
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) curr[parseInt(last)] = newArray;
  else curr[last] = newArray;
  return newData;
}

// Read sheet page
async function readSheetPage({ filePath, sheetName, page = 0, pageSize = 25, filter = '', sort = null, pkName = 'id' }) {
  const data = await readJson(filePath);
  const arr = getNestedArray(data, sheetName) || [];
  const normalized = arr.map(r => normalizeRow(r, pkName));
  const headers = computeHeaders(normalized, pkName);

  let filtered = normalized;
  if (filter && filter.trim()) {
    const f = filter.toLowerCase();
    filtered = normalized.filter(r => headers.some(h => String(r[h] ?? '').toLowerCase().includes(f)));
  }
  if (sort && sort.column) {
    filtered = [...filtered].sort((a, b) => {
      const x = a[sort.column], y = b[sort.column];
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

// Add row
async function addRow({ filePath, sheetName, row, pkName = 'id' }) {
  const data = await readJson(filePath);
  const arr = getNestedArray(data, sheetName);
  if (!arr) throw new Error(`Sheet "${sheetName}" not found in JSON.`);

  const toInsert = normalizeRow(row || {}, pkName);
  const newArray = [...arr, toInsert];
  const newData = setNestedArray(data, sheetName, newArray);
  await writeJson(filePath, newData);

  return { status: 'ok', row: toInsert, message: 'Row added successfully.' };
}

// Update row
async function updateRow({ filePath, sheetName, pkName = 'id', id, incomingRow }) {
  const data = await readJson(filePath);
  let arr = getNestedArray(data, sheetName);
  if (!arr) throw new Error(`Sheet "${sheetName}" not found in JSON.`);

  arr = arr.map(r => normalizeRow(r, pkName));
  const idx = arr.findIndex(r => String(r[pkName]) === String(id));
  if (idx === -1) return { status: 'not_found', message: `Row with ID '${id}' not found.` };

  const existing = arr[idx];
  const merged = { ...existing, ...incomingRow };
  merged._version = (existing._version || 0) + 1;

  arr[idx] = merged;
  const newData = setNestedArray(data, sheetName, arr);
  await writeJson(filePath, newData);

  return { status: 'ok', message: `Row with ID '${id}' updated successfully.` };
}

// Delete row
async function deleteRow({ filePath, sheetName, pkName = 'id', id }) {
  const data = await readJson(filePath);
  let arr = getNestedArray(data, sheetName);
  if (!arr) throw new Error(`Sheet "${sheetName}" not found in JSON.`);

  arr = arr.map(r => normalizeRow(r, pkName));
  const idx = arr.findIndex(r => String(r[pkName]) === String(id));
  if (idx === -1) return { status: 'not_found', message: `Row with ID '${id}' not found.` };

  const newArray = arr.slice(0, idx).concat(arr.slice(idx + 1));
  const newData = setNestedArray(data, sheetName, newArray);
  await writeJson(filePath, newData);

  return { status: 'ok', message: `Row with ID '${id}' deleted successfully.` };
}

// New getRow function
async function getRow({ filePath, sheetName, pkName = 'id', id }) {
  const data = await readJson(filePath);
  const arr = getNestedArray(data, sheetName);
  if (!arr) throw new Error(`Sheet "${sheetName}" not found in JSON.`);

  // Normalize all rows in the array to ensure they have an ID and a _version.
  const normalized = arr.map(r => normalizeRow(r, pkName));
  const foundRow = normalized.find(r => String(r[pkName]) === String(id));

  if (!foundRow) {
    return { status: 'not_found', message: `Row with ID '${id}' not found.` };
  }
  return { status: 'ok', row: foundRow };
}

// Meta
async function meta(filePath, pkName = 'id') {
  const data = await readJson(filePath);
  const sheetNames = inferSheets(data);
  return { sheetNames, hasVBA: false };
}

module.exports = {
  meta,
  readSheetPage,
  addRow,
  updateRow,
  deleteRow,
  normalizeRow,
  getNestedArray,
  setNestedArray,
  getRow
};
