// src/components/NestedTable.jsx
import React, { useState } from "react";
import { ChevronRight, ChevronDown, Edit, Trash2, Plus } from 'lucide-react';

/* ---------- Recursive Nested Table with CRUD Buttons (Updated) ---------- */
function NestedTable({ value, depth = 0, onEdit, onDelete, onAdd, path = [] }) {
  const [expandedKeys, setExpandedKeys] = useState({});
  const toggleExpand = (key) =>
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  if (value == null || (Array.isArray(value) && value.length === 0)) {
    const isArray = Array.isArray(value);
    return (
      <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
        <span className="text-slate-500 text-sm">
          {isArray ? "Empty array." : "No value."}
        </span>
        {isArray && (
          <button
            onClick={() => onAdd(path)}
            className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-xs font-medium"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (typeof value[0] === "object" && value[0] !== null) {
      const allHeaders = Array.from(
        value.reduce((set, obj) => {
          Object.keys(obj || {}).forEach((k) => set.add(k));
          return set;
        }, new Set())
      );
      const simpleHeaders = allHeaders.filter(
        (header) => !value.some((row) => row[header] && typeof row[header] === "object")
      );
      const complexHeaders = allHeaders.filter(
        (header) => value.some((row) => row[header] && typeof row[header] === "object")
      );

      return (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {complexHeaders.length > 0 && <th className="px-3 py-2 w-8" />}
                  {simpleHeaders.map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-r border-slate-200">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {value.map((row, i) => {
                  const rowId = `${depth}-${i}`;
                  const rowComplexCols = complexHeaders.filter(
                    (h) => row[h] !== null && typeof row[h] === "object"
                  );

                  return (
                    <React.Fragment key={rowId}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        {rowComplexCols.length > 0 && (
                          <td className="px-3 py-3 align-top">
                            <button
                              onClick={() => toggleExpand(rowId)}
                              className="text-indigo-600 hover:text-indigo-800 transition-colors"
                              title={expandedKeys[rowId] ? "Collapse" : "Expand"}
                            >
                              {expandedKeys[rowId] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                        )}
                        {simpleHeaders.map((h) => {
                          const cellValue = row?.[h];
                          return (
                            <td key={h} className="px-4 py-3 text-sm text-slate-900 max-w-[160px] truncate border-r border-slate-100" title={String(cellValue)}>
                              {String(cellValue ?? "")}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => onEdit(row, [...path, i])}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(i, path)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedKeys[rowId] && rowComplexCols.length > 0 && (
                        <tr className="bg-slate-50">
                          <td colSpan={1 + simpleHeaders.length + 1} className="p-0">
                            <div className="p-4 bg-slate-50 border-t border-slate-200">
                              {rowComplexCols.map((col) => (
                                <div key={col} className="my-2">
                                  <div className="text-sm font-semibold text-slate-600 mb-1">{col}</div>
                                  <NestedTable
                                    value={row[col]}
                                    depth={depth + 1}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onAdd={onAdd}
                                    path={[...path, i, col]}
                                  />
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => onAdd(path)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add New Row
          </button>
        </div>
      );
    }

    // Array of primitives
    return (
      <div className="p-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          {value.map((v, i) => (
            <div
              key={i}
              className="flex items-center bg-slate-100 rounded-lg text-slate-700 max-w-[150px] overflow-hidden border border-slate-200 shadow-sm"
            >
              <span
                className="px-3 py-1.5 truncate flex-1 text-sm"
                title={String(v)}
              >
                {String(v)}
              </span>
              <button
                onClick={() => onDelete(i, path)}
                className="px-2 py-1.5 text-red-600 hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => onAdd(path)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>
    );
  }

  // Object
  if (typeof value === "object") {
    const headers = Object.keys(value);
    const simpleHeaders = headers.filter(
      (header) => !(value[header] && typeof value[header] === "object")
    );
    const complexHeaders = headers.filter(
      (header) => value[header] && typeof value[header] === "object"
    );

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <tbody className="bg-white divide-y divide-slate-200">
              {simpleHeaders.map((k) => {
                const v = value[k];
                return (
                  <tr key={k} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-600 align-top w-1/3 border-r border-slate-200">
                      {k}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 align-top max-w-[220px] truncate" title={String(v)}>
                      {String(v ?? "")}
                    </td>
                  </tr>
                );
              })}
              {complexHeaders.map((k) => {
                const v = value[k];
                const key = `${k}-${depth}`;
                return (
                  <tr key={k} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-600 align-top border-r border-slate-200">
                      {k}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 align-top max-w-[220px]">
                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => toggleExpand(key)}>
                        <button
                          className="text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          {expandedKeys[key] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <span className="text-slate-500 text-xs">Click to expand</span>
                      </div>
                      {expandedKeys[key] && (
                        <div className="mt-2">
                          <NestedTable
                            value={v}
                            depth={depth + 1}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onAdd={onAdd}
                            path={[...path, k]}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => onEdit(value, path)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Edit className="w-4 h-4" /> Edit
        </button>
      </div>
    );
  }

  // Primitive value
  return (
    <div className="p-3 text-sm rounded-lg bg-slate-100 text-slate-800 max-w-[220px] truncate border border-slate-200" title={String(value)}>
      {String(value)}
    </div>
  );
}

export default NestedTable;