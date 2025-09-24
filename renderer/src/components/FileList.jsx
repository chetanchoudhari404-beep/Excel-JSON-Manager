// src/components/FileList.jsx
import React from 'react';
import { FileText, FolderOpenDot } from 'lucide-react';

export default function FileList({ files, activePath, onOpen }) {
  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <div className="text-slate-500 text-sm p-4 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
          <FolderOpenDot className="w-10 h-10 mb-2 text-slate-400" />
          <p>No files found in the selected folder.</p>
          <p>Choose a folder to get started.</p>
        </div>
      ) : (
        files.map(f => (
          <div
            key={f.path}
            onClick={() => onOpen(f)}
            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 ease-in-out ${
              activePath === f.path ? 'bg-indigo-100 text-indigo-800 shadow-sm border border-indigo-200' : 'bg-white hover:bg-slate-100 text-slate-800 border border-white hover:border-slate-200'
            }`}
          >
            <div className="flex-shrink-0">
              <FileText className={`w-6 h-6 ${activePath === f.path ? 'text-indigo-600' : 'text-slate-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-base truncate">{f.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {(f.size / 1024).toFixed(1)} KB • {new Date(f.mtimeMs).toLocaleString()}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}