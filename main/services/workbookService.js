// main/services/workbookService.js
const XLSX = require('xlsx');

function readWorkbook(filepath) {
  const wb = XLSX.readFile(filepath, { cellDates: true, cellNF: true, bookVBA: true });
  return wb;
}

function workbookMeta(wb, ignoreSheets = []) {
  const hiddenSheets = new Set();
  if (wb.Workbook && wb.Workbook.Sheets) {
    wb.Workbook.Sheets.forEach((sheet, index) => {
      if (sheet.Hidden === 1) {
        hiddenSheets.add(wb.SheetNames[index]);
      }
    });
  }
  const visibleSheetNames = wb.SheetNames.filter(sheetName =>
    !hiddenSheets.has(sheetName) && !ignoreSheets.includes(sheetName)
  );
  return {
    sheetNames: visibleSheetNames,
    hasVBA: Boolean(wb.vbaraw || wb.Workbook && wb.Workbook.VBA)
  };
}

function sheetToRows(wb, sheetName, pkName = 'id') {
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    return { headers: [], rows: [] };
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  const rows = [];
  let bestHeaderRowIdx = -1;
  let maxHeaderScore = -1;
  let finalDetectedHeaders = [];
  let finalDetectedHeaderColMap = {};
  let dataStartRowIndex = -1;
  const maxHeaderSearchRows = Math.min(range.e.r + 1, range.s.r + 10);
  for (let R = range.s.r; R < maxHeaderSearchRows; ++R) {
    let rowValues = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddress];
      rowValues.push(cell ? XLSX.utils.format_cell(cell) : null);
    }
    const firstNonEmptyColInRow = rowValues.findIndex(val => val != null && String(val).trim() !== '');
    if (firstNonEmptyColInRow === -1) continue;
    const potentialHeadersClean = Array.from(new Set(rowValues.slice(firstNonEmptyColInRow)
      .filter(h => h != null && String(h).trim() !== '')
      .map(h => String(h).trim())));
    
    // **CRITICAL FIX**: Use the pkName passed in from the main process for header detection
    const hasPkName = potentialHeadersClean.includes(pkName);
    const hasVersion = potentialHeadersClean.includes('_version');

    if (potentialHeadersClean.every(h => !isNaN(Number(h))) || 
        (potentialHeadersClean.length < 2 && !hasPkName && !hasVersion)) {
        continue; 
    }
    let currentScore = potentialHeadersClean.length;
    if (hasPkName) {
        currentScore += 1000; 
    }
    if (hasVersion) {
        currentScore += 500;
    }
    if (currentScore > maxHeaderScore) {
      maxHeaderScore = currentScore;
      bestHeaderRowIdx = R;
      finalDetectedHeaders = potentialHeadersClean;
      finalDetectedHeaderColMap = {};
      rowValues.slice(firstNonEmptyColInRow).forEach((h, idx) => {
        const headerName = (h == null ? '' : String(h).trim());
        if (headerName !== '' && finalDetectedHeaders.includes(headerName)) {
            finalDetectedHeaderColMap[headerName] = firstNonEmptyColInRow + idx;
        }
      });
    }
  }
  if (bestHeaderRowIdx === -1) {
    dataStartRowIndex = range.s.r;
    finalDetectedHeaders = [];
    finalDetectedHeaderColMap = {};
  } else {
    dataStartRowIndex = bestHeaderRowIdx + 1;
  }
  let canonicalHeaders = [...finalDetectedHeaders];
  if (!canonicalHeaders.includes(pkName)) {
    canonicalHeaders.unshift(pkName); 
  }
  if (!canonicalHeaders.includes('_version')) {
    canonicalHeaders.push('_version'); 
  }
  for (let R = dataStartRowIndex; R <= range.e.r; ++R) {
    const obj = {};
    let isRowEmpty = true;
    let rawRowValues = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellAddress];
        rawRowValues.push(cell ? XLSX.utils.format_cell(cell) : null);
    }
    for (const header of canonicalHeaders) {
      if (finalDetectedHeaderColMap.hasOwnProperty(header)) {
        const originalExcelColIndex = finalDetectedHeaderColMap[header];
        const rawRowValueIndex = originalExcelColIndex - range.s.c; 
        if (rawRowValueIndex >= 0 && rawRowValueIndex < rawRowValues.length) {
          obj[header] = rawRowValues[rawRowValueIndex] ?? null; 
        } else {
          obj[header] = null;
        }
      } else {
        obj[header] = null;
      }
      if (obj[header] != null && String(obj[header]).trim() !== '') {
        isRowEmpty = false;
      }
    }
    obj.__rowIndex = R + 1;
    if (!isRowEmpty) {
      if (!obj.hasOwnProperty(pkName) || obj[pkName] === undefined || obj[pkName] === null || String(obj[pkName]).trim() === '') {
        obj[pkName] = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }
      if (typeof obj._version === 'undefined' || obj._version === null || String(obj._version).trim() === '') {
        obj._version = 1;
      }
      rows.push(obj);
    }
  }
  return { headers: canonicalHeaders, rows };
}

function ensureHeaders(wb, sheetName, pkName = 'id') {
  let ws = wb.Sheets[sheetName];
  const { headers: processedHeaders, rows: processedRows } = sheetToRows(wb, sheetName, pkName);
  let newAoA = [];
  newAoA.push(processedHeaders);
  processedRows.forEach(rowObj => {
    const aoaRow = processedHeaders.map(header => rowObj[header] ?? null);
    newAoA.push(aoaRow);
  });
  if (!ws) {
    wb.SheetNames.push(sheetName);
  }
  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(newAoA);
}

function getSheetAoA(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const headers = (aoa && aoa[0]) ? aoa[0].map(h => (h == null ? '' : String(h).trim())) : [];
  return { headers, aoa };
}

function aoaToRows(aoa, headers) {
  const rows = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (r && r[j] !== undefined) ? r[j] : null;
    }
    rows.push(obj);
  }
  return rows;
}
module.exports = { readWorkbook, workbookMeta, sheetToRows, ensureHeaders, getSheetAoA, aoaToRows };