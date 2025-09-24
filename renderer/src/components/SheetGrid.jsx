// src/components/SheetGrid.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import RowModal from "./RowModal";
import RowExpansion from "./RowExpansion";
import { Plus, Search, ChevronDown, ChevronRight, ArrowLeft, ArrowRight, Edit, Trash2 } from 'lucide-react';
import { Loader2 } from 'lucide-react';

/* ---------- Custom Alert/Confirm Component ---------- */
function CustomMessageBox({ message, type, onConfirm, onCancel }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full text-center border border-slate-200">
        <p className="mb-6 text-slate-700">{message}</p>
        <div className="flex justify-center space-x-4">
          {type === "confirm" && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {type === "confirm" ? "OK" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Global Loader Component (UPDATED) ---------- */
function GlobalLoader({ loadingState }) {
  if (!loadingState) return null;

  const text = {
    'adding': 'Adding data...',
    'editing': 'Updating data...',
    'deleting': 'Deleting data...',
  }[loadingState];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-[100]"> {/* UPDATED CLASSES */}
      <div className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-xl animate-fade-in"> {/* UPDATED CLASSES */}
        <Loader2 className="h-5 w-5 animate-spin" /> {/* Slightly larger icon */}
        <span className="text-base font-semibold">{text}</span> {/* Slightly larger text */}
      </div>
    </div>
  );
}

/* ---------- Main SheetGrid Component ---------- */
export default function SheetGrid({ file, sheetName, config }) {
  const pkName = config?.pkName || "id";
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(config?.pageSizeDefault || 25);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [loadingState, setLoadingState] = useState(null);
  const [messageBox, setMessageBox] = useState({
    message: null,
    type: "alert",
    onConfirm: null,
    onCancel: null,
  });

  const closeMessageBox = useCallback(
    () =>
      setMessageBox({
        message: null,
        type: "alert",
        onConfirm: null,
        onCancel: null,
      }),
    []
  );

  const showMessage = useCallback(
    (message, type = "alert", onConfirmCallback, onCancelCallback) => {
      const actualOnConfirm = type === "alert" ? closeMessageBox : onConfirmCallback;
      const actualOnCancel = onCancelCallback || closeMessageBox;
      setMessageBox({
        message,
        type,
        onConfirm: actualOnConfirm,
        onCancel: actualOnCancel,
      });
    },
    [closeMessageBox]
  );

  const loadPage = useCallback(async () => {
    if (window.electron && file && sheetName) {
      const res = await window.electron.readSheetPage({
        filePath: file.path,
        sheetName,
        page,
        pageSize,
        filter,
        sort,
      });
      setHeaders(res.headers || []);
      setRows(res.rows || []);
      setTotal(res.total || 0);
    }
  }, [file, sheetName, page, pageSize, filter, sort]);

  useEffect(() => {
    if (!sheetName) return;
    loadPage();
  }, [file, sheetName, page, filter, sort, loadPage]);

  const isReadOnly = config?.readOnlySheets?.includes(sheetName);

  const { simpleHeaders, complexHeaders } = useMemo(() => {
    const allComplexHeaders = new Set();
    const allHeaders = headers;

    rows.forEach((row) => {
      allHeaders.forEach((h) => {
        const value = row?.[h];
        if (value && typeof value === "object") {
          allComplexHeaders.add(h);
        }
      });
    });

    const simple = allHeaders.filter((h) => !allComplexHeaders.has(h));
    const complex = allHeaders.filter((h) => allComplexHeaders.has(h));

    return { simpleHeaders: simple, complexHeaders: complex };
  }, [headers, rows]);

  const onAdd = () => setAdding(true);
  const onEdit = (r) => setEditing(r);

  const onDelete = (r) => {
    showMessage(
      "Are you sure you want to delete this row?",
      "confirm",
      async () => {
        closeMessageBox();
        setLoadingState('deleting');
        try {
          const res = await window.electron.deleteRow({
            filePath: file.path,
            sheetName,
            pkName,
            id: r[pkName],
            expectedVersion: r._version,
          });
          if (res.status === "ok") {
            await loadPage();
            showMessage("Row deleted successfully.", "alert");
          } else {
            showMessage(res.message || "Delete failed.", "alert");
          }
        } catch (e) {
          showMessage(e?.message || "Unexpected error while deleting.", "alert");
        } finally {
          setLoadingState(null);
        }
      },
      closeMessageBox
    );
  };

  const handleAddSubmit = async (data) => {
    setLoadingState('adding');
    try {
      const res = await window.electron.addRow({
        filePath: file.path,
        sheetName,
        row: data,
        pkName,
      });
      if (res.status === "ok") {
        setAdding(false);
        await loadPage();
        showMessage("Row added successfully.", "alert");
      } else {
        showMessage(res.message || "Add failed.", "alert");
      }
    } catch (e) {
      showMessage(e?.message || "Unexpected error while adding.", "alert");
    } finally {
      setLoadingState(null);
    }
  };

  const handleEditSubmit = async (data) => {
    setLoadingState('editing');
    try {
      const res = await window.electron.updateRow({
        filePath: file.path,
        sheetName,
        pkName,
        id: data[pkName],
        incomingRow: data,
      });
      if (res.status === "ok") {
        setEditing(null);
        await loadPage();
        showMessage("Row updated successfully.", "alert");
      } else if (res.status === "conflict") {
        showMessage(res.message || "Conflict detected.", "alert");
      } else {
        showMessage(res.message || "Update failed.", "alert");
      }
    } catch (e) {
      showMessage(e?.message || "Unexpected error while updating.", "alert");
    } finally {
      setLoadingState(null);
    }
  };

  const computedColspan =
    1 /* dropdown */ + simpleHeaders.length + (isReadOnly ? 0 : 1);

  return (
    <div className="flex flex-col h-full relative">
      <GlobalLoader loadingState={loadingState} />
      
      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {!isReadOnly && (
          <button
            onClick={onAdd}
            disabled={!!loadingState}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg transition-colors ${!!loadingState ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
          >
            <Plus className="w-4 h-4" /> Add New Row
          </button>
        )}
        <div className="relative flex-1 min-w-[150px]">
          <input
            type="text"
            placeholder="Search..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            disabled={!!loadingState}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
        <div className="text-sm text-slate-600 font-medium">
          Total Rows: <span className="font-bold text-slate-800">{total}</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl shadow-md">
        <table className="min-w-full divide-y divide-slate-200 border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-2 w-8" />
              {simpleHeaders.map((h) => (
                <th
                  key={h}
                  onClick={() =>
                    setSort({
                      column: h,
                      dir: sort && sort.column === h && sort.dir === "asc" ? "desc" : "asc",
                    })
                  }
                  className={`px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer border-r border-slate-200 ${!!loadingState ? 'pointer-events-none opacity-50' : ''}`}
                >
                  {h}
                  {sort && sort.column === h ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              {!isReadOnly && (
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={computedColspan}
                  className="px-4 py-8 text-center text-slate-500 text-sm"
                >
                  {filter ? "No matching rows found." : "No data in this sheet."}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const rowId = r[pkName] ?? idx;
                const rowComplexCols = complexHeaders.filter(
                  (h) => r[h] !== null && typeof r[h] === "object"
                );

                return (
                  <React.Fragment key={rowId}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 align-top w-12">
                        {rowComplexCols.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedRow((prev) => (prev === rowId ? null : rowId))
                            }
                            disabled={!!loadingState}
                            className="text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={expandedRow === rowId ? "Collapse" : "Expand"}
                          >
                            {expandedRow === rowId ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        )}
                      </td>

                      {simpleHeaders.map((h) => (
                        <td
                          key={h}
                          className="px-4 py-3 text-sm text-slate-900 max-w-[200px] overflow-hidden truncate border-r border-slate-100"
                          title={String(r[h] ?? "")}
                        >
                          {String(r[h] ?? "")}
                        </td>
                      ))}

                      {!isReadOnly && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => onEdit(r)}
                            disabled={!!loadingState}
                            className={`text-indigo-600 transition-colors ${!!loadingState ? 'opacity-50 cursor-not-allowed' : 'hover:text-indigo-800'}`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(r)}
                            disabled={!!loadingState}
                            className={`text-red-600 transition-colors ${!!loadingState ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-800'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>

                    {expandedRow === rowId && rowComplexCols.length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={computedColspan} className="p-0">
                          <RowExpansion
                            row={r}
                            complexCols={rowComplexCols}
                            file={file}
                            sheetName={sheetName}
                            pkName={pkName}
                            onNestedUpdate={loadPage}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 px-3 py-2 bg-white rounded-lg shadow-sm border border-slate-200">
        <button
          onClick={() => page > 0 && setPage((p) => p - 1)}
          disabled={page === 0 || !!loadingState}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-200 text-slate-700 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Previous
        </button>
        <span className="text-xs text-slate-700">
          Page <span className="font-bold">{page + 1}</span> of <span className="font-bold">{Math.ceil(total / pageSize) || 1}</span>
        </span>
        <button
          onClick={() => (page + 1) * pageSize < total && setPage((p) => p + 1)}
          disabled={(page + 1) * pageSize >= total || !!loadingState}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-200 text-slate-700 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Modals */}
      {adding && (
        <RowModal
          headers={headers}
          onClose={() => setAdding(false)}
          onSubmit={handleAddSubmit}
          pkName={pkName}
        />
      )}
      {editing && (
        <RowModal
          headers={headers}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={handleEditSubmit}
          pkName={pkName}
        />
      )}

      <CustomMessageBox
        message={messageBox.message}
        type={messageBox.type}
        onConfirm={messageBox.onConfirm}
        onCancel={messageBox.onCancel}
      />
    </div>
  );
}