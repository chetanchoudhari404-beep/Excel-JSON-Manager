// main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  listFiles: (folderPath) => ipcRenderer.invoke('list-files', folderPath),
  loadWorkbookMeta: (params) => ipcRenderer.invoke('load-workbook-meta', params),
  readSheetPage: (params) => ipcRenderer.invoke('read-sheet-page', params),
  addRow: (params) => ipcRenderer.invoke('add-row', params),
  updateRow: (params) => ipcRenderer.invoke('update-row', params),
  deleteRow: (params) => ipcRenderer.invoke('delete-row', params),
  exportCopy: (params) => ipcRenderer.invoke('export-copy', params),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  getRow: (params) => ipcRenderer.invoke('get-row', params),
});
