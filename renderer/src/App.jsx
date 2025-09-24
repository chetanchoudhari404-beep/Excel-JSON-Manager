// src/App.jsx
import React, { useEffect, useState } from 'react';
import FileList from './components/FileList';
import WorkbookView from './components/WorkbookView';
import Header from './components/Header';
import ApiTester from './components/ApiTester';
import Footer from './components/Footer';
import { FolderOpen, RefreshCw } from 'lucide-react'; // Updated import

export default function App() {
  const [config, setConfig] = useState(null);
  const [folder, setFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [showApiTester, setShowApiTester] = useState(false);
  const [fileTypes, setFileTypes] = useState([]);
  const [showLeftPanel, setShowLeftPanel] = useState(true);

  useEffect(() => {
    (async () => {
      if (window.electron) {
        const cfg = await window.electron.getConfig();
        setConfig(cfg);
        if (cfg.folderPath) {
          setFolder(cfg.folderPath);
          const f = await window.electron.listFiles(cfg.folderPath);
          setFiles(f);
          updateFileTypes(f);
        }
      } else {
        console.error("Electron API not available on window.electron.");
      }
    })();
  }, []);

  const chooseFolder = async () => {
    if (window.electron) {
      const p = await window.electron.chooseFolder();
      if (p) {
        setFolder(p);
        const f = await window.electron.listFiles(p);
        setFiles(f);
        updateFileTypes(f);
      }
    } else {
      console.error("Electron API not available to choose folder.");
    }
  };

  const refreshFiles = async () => {
    if (folder && window.electron) {
      const f = await window.electron.listFiles(folder);
      setFiles(f);
      updateFileTypes(f);
    } else {
      console.error("Electron API or folder not available to refresh files.");
    }
  };

  const updateFileTypes = (files) => {
    const typesSet = new Set();
    files.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['xls', 'xlsx', 'xlsm'].includes(ext)) typesSet.add('Excel');
      if (ext === 'json') typesSet.add('JSON');
    });
    setFileTypes(Array.from(typesSet));
  };

  const headingText = fileTypes.length === 0
    ? 'Files'
    : fileTypes.join(' & ');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      <Header onApiClick={() => setShowApiTester(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - conditionally rendered with better styling */}
        {showLeftPanel && (
          <div className="w-80 border-r border-slate-200 bg-white p-4 flex flex-col shadow-lg overflow-y-auto transition-all duration-300 ease-in-out">
            <h3 className="text-xl font-bold mb-4 text-slate-800 tracking-tight">{headingText} Files</h3>
            <div className="mb-4 flex space-x-2">
              <button
                onClick={chooseFolder}
                className="flex-1 inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors duration-200"
              >
                <FolderOpen className="h-4 w-4 mr-2" /> Choose Folder
              </button>
              <button
                onClick={refreshFiles}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-4 focus:ring-slate-400 focus:ring-opacity-50 transition-colors duration-200"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FileList files={files} activePath={activeFile?.path} onOpen={(f) => setActiveFile(f)} />
            </div>
          </div>
        )}

        {/* Right Panel */}
        <div className="flex-1 p-4 bg-slate-100 overflow-y-auto transition-all duration-300 ease-in-out">
          {showApiTester ? (
            <ApiTester onBack={() => setShowApiTester(false)} />
          ) : (
            !activeFile ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-lg font-medium">
                <p>📂 Select a file from the left panel to begin.</p>
              </div>
            ) : (
              <WorkbookView file={activeFile} config={config} />
            )
          )}
        </div>
      </div>

      <Footer onToggleClick={() => setShowLeftPanel(!showLeftPanel)} showLeftPanel={showLeftPanel} />
    </div>
  );
}