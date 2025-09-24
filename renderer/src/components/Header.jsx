// src/components/Header.jsx
import React from 'react';
import { CloudUpload } from 'lucide-react';

export default function Header({ onApiClick }) {
  return (
    <div className="flex justify-between items-center bg-white p-4 shadow-md border-b border-slate-200">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Excel JSON Manager</h1>
      <button
        onClick={onApiClick}
        className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors duration-200"
      >
        <CloudUpload className="w-4 h-4" /> Import JSON
      </button>
    </div>
  );
}