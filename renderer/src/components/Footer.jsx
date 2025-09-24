// src/components/Footer.jsx
import React from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';

const Footer = ({ onToggleClick, showLeftPanel }) => {
  return (
    <div className="flex justify-between items-center bg-white p-4 shadow-inner border-t border-slate-200 text-slate-600 text-sm">
      <button 
        onClick={onToggleClick} 
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors duration-200 ease-in-out text-slate-700 font-medium"
      >
        {showLeftPanel ? (
          <>
            <PanelLeftClose className="w-5 h-5" /> Hide Panel
          </>
        ) : (
          <>
            <PanelLeft className="w-5 h-5" /> Show Panel
          </>
        )}
      </button>
      <span className="text-slate-500">
        © 2025 AwesomeApp. All rights reserved.
      </span>
    </div>
  );
};

export default Footer;