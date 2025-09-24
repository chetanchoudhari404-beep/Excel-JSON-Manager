// src/components/RowModal.jsx
import React, { useState } from "react";
import { Plus, Trash2, Save, X, Edit } from 'lucide-react';

/** --- Preview Helper --- */
function previewValue(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val !== "object") return String(val);
  if (Array.isArray(val))
    return (
      val
        .slice(0, 3)
        .map((v) => (typeof v === "object" ? "{…}" : v))
        .join(", ") + (val.length > 3 ? ", …" : "")
    );
  return (
    Object.entries(val)
      .slice(0, 3)
      .map(([k, v]) => `${k}:${previewValue(v)}`)
      .join(", ") + (Object.keys(val).length > 3 ? ", …" : "")
  );
}

/** --- Nested Editor Modal (Recursive) --- */
function NestedEditorModal({ value, label, onSave, onCancel }) {
  const [localValue, setLocalValue] = useState(() =>
    JSON.parse(JSON.stringify(value))
  );
  const [childModal, setChildModal] = useState(null);

  const handleSave = () => onSave(localValue);

  const renderArrayPrimitives = (arr) => (
    <div className="space-y-2">
      {arr.map((item, idx) => (
        <div key={idx} className="flex items-center space-x-2">
          <input
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            value={item ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setLocalValue((prev) => {
                const copy = [...prev];
                copy[idx] = val;
                return copy;
              });
            }}
          />
          <button
            onClick={() =>
              setLocalValue((prev) => prev.filter((_, i) => i !== idx))
            }
            className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      ))}
      <button
        onClick={() => setLocalValue((prev) => [...prev, ""])}
        className="px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-2 text-sm font-medium"
      >
        <Plus className="w-4 h-4" /> Add Item
      </button>
    </div>
  );

  const renderArrayObjects = (arr) => (
    <table className="w-full border border-slate-200 text-sm mb-4 rounded-lg overflow-hidden shadow-sm">
      <thead className="bg-slate-50">
        <tr>
          {arr.length > 0 &&
            Object.keys(arr[0]).map((col) => (
              <th key={col} className="border-r border-slate-200 px-4 py-2 text-left text-slate-600 font-semibold">
                {col}
              </th>
            ))}
          <th className="px-4 py-2 text-left text-slate-600 font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {arr.map((row, idx) => (
          <tr key={idx} className="bg-white border-t border-slate-200">
            {Object.keys(row).map((col) => (
              <td key={col} className="border-r border-slate-200 px-4 py-3 align-top">
                {row[col] !== null && typeof row[col] === "object" ? (
                  <button
                    onClick={() =>
                      setChildModal({
                        label: `${col}[${idx}]`,
                        value: row[col],
                        onSave: (newVal) => {
                          setLocalValue((prev) => {
                            const copy = [...prev];
                            copy[idx][col] = newVal;
                            return copy;
                          });
                          setChildModal(null);
                        },
                      })
                    }
                    className="w-full text-left px-3 py-2 bg-slate-50 text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors text-xs font-medium truncate flex items-center gap-1"
                    title="[Object]"
                  >
                    <Edit className="w-3 h-3" />
                    <span>{previewValue(row[col])}</span>
                  </button>
                ) : (
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    value={row[col] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalValue((prev) => {
                        const copy = [...prev];
                        copy[idx][col] = val;
                        return copy;
                      });
                    }}
                  />
                )}
              </td>
            ))}
            <td className="px-4 py-3">
              <button
                onClick={() =>
                  setLocalValue((prev) => prev.filter((_, i) => i !== idx))
                }
                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </td>
          </tr>
        ))}
        <tr className="bg-slate-50">
          <td colSpan={arr.length > 0 ? Object.keys(arr[0]).length + 1 : 1} className="p-4">
            <button
              onClick={() => {
                const newRow =
                  arr.length > 0
                    ? Object.fromEntries(Object.keys(arr[0]).map((k) => [k, null]))
                    : { newKey: "" }; // Default for first row
                setLocalValue((prev) => [...prev, newRow]);
              }}
              className="px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Row
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderObject = (obj) => (
    <div className="space-y-4">
      {Object.keys(obj).map((k) => (
        <div key={k} className="flex items-center space-x-2">
          <label className="block text-sm font-semibold text-slate-700 w-24 flex-shrink-0">
            {k}
          </label>
          {obj[k] !== null && typeof obj[k] === "object" ? (
            <button
              onClick={() =>
                setChildModal({
                  label: k,
                  value: obj[k],
                  onSave: (newVal) => {
                    setLocalValue((prev) => ({ ...prev, [k]: newVal }));
                    setChildModal(null);
                  },
                })
              }
              className="px-4 py-2 flex-1 text-left bg-slate-50 text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium truncate flex items-center gap-1"
              title="[Object]"
            >
              <Edit className="w-4 h-4" />
              <span>{previewValue(obj[k])}</span>
            </button>
          ) : (
            <input
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm"
              value={obj[k] ?? ""}
              onChange={(e) =>
                setLocalValue((prev) => ({ ...prev, [k]: e.target.value }))
              }
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    if (Array.isArray(localValue)) {
      if (localValue.length === 0 || typeof localValue[0] !== "object")
        return renderArrayPrimitives(localValue);
      return renderArrayObjects(localValue);
    }
    if (typeof localValue === "object" && localValue !== null)
      return renderObject(localValue);
    return (
      <textarea
        className="w-full h-48 p-4 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        value={JSON.stringify(localValue, null, 2)}
        onChange={(e) => {
          try {
            setLocalValue(JSON.parse(e.target.value));
          } catch {}
        }}
      />
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <h3 className="text-xl font-semibold text-slate-800">Edit {label}</h3>
            <button onClick={onCancel} className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {renderContent()}
          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-slate-200">
            <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" /> Save
            </button>
            <button onClick={onCancel} className="px-5 py-2 bg-slate-200 text-slate-800 font-medium rounded-lg shadow-sm hover:bg-slate-300 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>

      {childModal && (
        <NestedEditorModal
          value={childModal.value}
          label={childModal.label}
          onSave={childModal.onSave}
          onCancel={() => setChildModal(null)}
        />
      )}
    </>
  );
}

/** --- Row Modal --- */
export default function RowModal({
  headers,
  initial = {},
  onClose,
  onSubmit,
  pkName,
}) {
  const [form, setForm] = useState(() => ({ ...initial }));
  const [nestedModal, setNestedModal] = useState(null);

  const handle = (e, key) =>
    setForm((s) => ({ ...s, [key]: e.target.value }));

  const submit = () => {
    const out = { ...form };
    for (let k in out) {
      if (out[k] === "") {
        out[k] = null;
      } else if (typeof out[k] === "string") {
        const trimmed = out[k].trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            out[k] = JSON.parse(trimmed);
          } catch {
            // keep as string if invalid JSON
          }
        }
      }
    }
    onSubmit(out);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
          <h3 className="text-2xl font-bold text-slate-800">
            {initial && initial[pkName] ? "Edit Row" : "Add New Row"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2">
          {headers.map((h) => (
            <div key={h} className="mb-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {h}
              </label>

              {h === pkName && initial && initial[pkName] ? (
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed text-sm"
                  value={form[h] ?? ""}
                  disabled
                />
              ) : typeof form[h] === "object" && form[h] !== null ? (
                <button
                  onClick={() =>
                    setNestedModal({
                      key: h,
                      value: form[h],
                      onSave: (newVal) => {
                        setForm((prev) => ({ ...prev, [h]: newVal }));
                        setNestedModal(null);
                      },
                    })
                  }
                  className="w-full text-left px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 text-indigo-600 font-medium truncate transition-colors flex items-center gap-2"
                  title="[Object]"
                >
                  <Edit className="w-4 h-4" />
                  <span>{previewValue(form[h])}</span>
                </button>
              ) : (
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
                  value={form[h] ?? ""}
                  onChange={(e) => handle(e, h)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={submit}
            className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 text-slate-800 font-medium rounded-lg shadow-sm hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {nestedModal && (
        <NestedEditorModal
          value={nestedModal.value}
          label={nestedModal.key}
          onSave={nestedModal.onSave}
          onCancel={() => setNestedModal(null)}
        />
      )}
    </div>
  );
}