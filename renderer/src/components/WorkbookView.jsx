// src/components/WorkbookView.jsx
import React, { useEffect, useState, useMemo } from 'react';
import SheetGrid from './SheetGrid';
import { FileSpreadsheet, Hourglass } from 'lucide-react'; // Added icons

export default function WorkbookView({ file, config }) {
  const [meta, setMeta] = useState(null);
  const [activeSheet, setActiveSheet] = useState(null);

  useEffect(() => {
    setMeta(null);
    (async () => {
      if (window.electron) {
        const m = await window.electron.loadWorkbookMeta({ filePath: file.path });
        setMeta(m);
        if (m.sheetNames && m.sheetNames.length) setActiveSheet(m.sheetNames[0]);
      } else {
        console.error("Electron API not available to load workbook meta.");
      }
    })();
  }, [file]);

  const sheetDisplayNames = useMemo(() => {
    if (!meta?.sheetNames) return {};

    const baseNames = meta.sheetNames.map(s => {
      const parts = s.split('.');
      return {
        fullName: s,
        baseName: parts[parts.length - 1],
        prefix: parts.length > 1 ? parts[parts.length - 2] : null
      };
    });

    const nameCounts = baseNames.reduce((acc, { baseName }) => {
      acc[baseName] = (acc[baseName] || 0) + 1;
      return acc;
    }, {});

    const displayNames = {};
    baseNames.forEach(({ fullName, baseName, prefix }) => {
      const capitalizedBase = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      
      if (nameCounts[baseName] > 1 && prefix) {
        const capitalizedPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        displayNames[fullName] = `${capitalizedPrefix} / ${capitalizedBase}`;
      } else {
        displayNames[fullName] = capitalizedBase;
      }
    });

    return displayNames;
  }, [meta]);

  if (!meta) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-lg">
        <div className="flex flex-col items-center gap-2">
          <Hourglass className="animate-spin text-4xl text-slate-400" />
          <span>Loading workbook metadata...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg h-full flex flex-col border border-slate-200">
      <h2 className="text-2xl font-bold mb-4 text-slate-900 tracking-tight truncate flex items-center gap-2">
        <FileSpreadsheet className="w-6 h-6 text-indigo-500" /> {file.name}
      </h2>
      
      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-2">
        {meta.sheetNames.map(s => (
          <button
            key={s}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors duration-200 ease-in-out focus:outline-none ${
              s === activeSheet
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setActiveSheet(s)}
          >
            {sheetDisplayNames[s]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <SheetGrid file={file} sheetName={activeSheet} config={config} />
      </div>
    </div>
  );
}