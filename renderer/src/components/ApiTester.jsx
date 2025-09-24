// src/components/ApiTester.jsx
import React, { useState } from 'react';
import { Play, Save, ArrowLeft } from 'lucide-react';

export default function ApiTester({ onBack }) {
  const [apiUrl, setApiUrl] = useState('');
  const [payload, setPayload] = useState('');
  const [response, setResponse] = useState('');
  const [method, setMethod] = useState('GET');

  const sendApiRequest = async () => {
    try {
      const options = { method };
      if (method !== 'GET' && payload) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(JSON.parse(payload));
      }
      const res = await fetch(apiUrl, options);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(`Error: ${err.message}`);
    }
  };

  const saveResponse = async () => {
    if (!response) return alert("No response to save!");
    if (window.electron) {
      try {
        const filePath = await window.electron.saveFile({
          defaultPath: 'response.json',
          filters: [{ name: 'JSON Files', extensions: ['json'] }],
        });
        if (filePath) {
          await window.electron.writeFile(filePath, response);
          alert("Response saved successfully!");
        }
      } catch (err) {
        alert(`Error saving file: ${err.message}`);
      }
    } else {
      alert("Electron API not available to save file.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 space-y-4">
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">API Tester 🧪</h2>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">HTTP Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
          <option>PATCH</option>
        </select>
      </div>

      <input
        type="text"
        placeholder="Enter API URL"
        value={apiUrl}
        onChange={(e) => setApiUrl(e.target.value)}
        className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {(method !== 'GET') && (
        <textarea
          placeholder='Enter JSON payload (optional)'
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg h-32 bg-slate-50 text-slate-800 placeholder-slate-400 font-mono transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={sendApiRequest}
          className="flex inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50"
        >
          <Play className="w-4 h-4" /> Send
        </button>
        <button
          onClick={saveResponse}
          className="flex inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-slate-400 focus:ring-opacity-50"
        >
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-2">Response</label>
        <textarea
          placeholder="Response will appear here"
          value={response}
          readOnly
          className="w-full p-2 border border-slate-300 rounded-lg h-64 bg-slate-100 font-mono text-slate-800 resize-none"
        />
      </div>

      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 bg-slate-300 hover:bg-slate-400 text-slate-800 font-medium py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-slate-400 focus:ring-opacity-50"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
    </div>
  );
}