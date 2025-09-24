// src/components/RowExpansion.jsx
import React, { useState } from "react";
import RowModal from "./RowModal";
import NestedTable from "./NestedTable";
import { FolderKanban, Plus } from 'lucide-react';

// Helper function to get a nested value using a path array
const getNestedValue = (obj, path) => {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : null, obj);
};

// Helper function to set a nested value using a path array
const setNestedValue = (obj, path, value) => {
  if (path.length === 0) return value;
  const newObj = JSON.parse(JSON.stringify(obj));
  let current = newObj;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }
  current[path[path.length - 1]] = value;
  return newObj;
};

export default function RowExpansion({ row, complexCols, onNestedUpdate, file, sheetName, pkName }) {
  const [activeTab, setActiveTab] = useState(complexCols[0]);
  const [nestedModal, setNestedModal] = useState(null);

  const handleNestedEdit = (item, path) => {
    setNestedModal({
      isEditing: true,
      initialData: item,
      nestedPath: path,
      isObject: !Array.isArray(getNestedValue(row, path)),
    });
  };

  const handleNestedAdd = async (path) => {
    const nestedData = getNestedValue(row, path);
    
    let newItem = {};
    if (Array.isArray(nestedData) && nestedData.length > 0 && typeof nestedData[0] === 'object') {
      newItem = Object.fromEntries(Object.keys(nestedData[0]).map(k => [k, '']));
    } else {
      newItem = null;
    }

    setNestedModal({
      isEditing: false,
      initialData: newItem,
      nestedPath: path,
      isObject: false,
    });
  };

  const handleNestedDelete = async (index, path) => {
    try {
      const freshRowRes = await window.electron.getRow({
        filePath: file.path,
        sheetName: sheetName,
        id: row[pkName],
      });

      if (!freshRowRes || freshRowRes.status !== 'ok') {
        console.error("Failed to fetch fresh row data for deletion:", freshRowRes?.message);
        return;
      }

      const freshRow = freshRowRes.row;
      const nestedArray = getNestedValue(freshRow, path);

      if (!Array.isArray(nestedArray)) {
        console.error("Nested data is not an array. Cannot delete.");
        return;
      }

      const updatedNestedArray = [...nestedArray];
      updatedNestedArray.splice(index, 1);

      const updatedRow = setNestedValue(freshRow, path, updatedNestedArray);
      
      const res = await window.electron.updateRow({
        filePath: file.path,
        sheetName: sheetName,
        pkName: pkName,
        id: freshRow[pkName],
        incomingRow: updatedRow,
      });

      if (res.status === 'ok') {
        onNestedUpdate();
      } else {
        console.error("Failed to delete nested item:", res.message);
      }
    } catch (e) {
      console.error("Error updating row:", e);
    }
  };

  const handleNestedSave = async (data) => {
    const { nestedPath, isEditing } = nestedModal;
    try {
      const freshRowRes = await window.electron.getRow({
        filePath: file.path,
        sheetName: sheetName,
        id: row[pkName],
      });
      
      if (!freshRowRes || freshRowRes.status !== 'ok') {
        console.error("Failed to fetch fresh row data for save:", freshRowRes?.message);
        setNestedModal(null);
        return;
      }
      
      const freshRow = freshRowRes.row;
      const nestedData = getNestedValue(freshRow, nestedPath);
      let updatedRow;

      if (isEditing) {
        if (nestedData === null || typeof nestedData !== 'object' || Array.isArray(nestedData)) {
          console.error("Invalid nested data type for editing. Expected object.");
          setNestedModal(null);
          return;
        }
        updatedRow = setNestedValue(freshRow, nestedPath, data);
      } else {
        if (!Array.isArray(nestedData)) {
          console.error("Cannot add a new row, nested data is not an array.");
          setNestedModal(null);
          return;
        }
        const updatedNestedArray = [...nestedData, data];
        updatedRow = setNestedValue(freshRow, nestedPath, updatedNestedArray);
      }
      
      const res = await window.electron.updateRow({
        filePath: file.path,
        sheetName: sheetName,
        pkName: pkName,
        id: freshRow[pkName],
        incomingRow: updatedRow,
      });
      
      if (res.status === 'ok') {
        setNestedModal(null);
        onNestedUpdate();
      } else {
        console.error("Failed to update nested item:", res.message);
      }
    } catch (e) {
      console.error("Error updating nested item:", e);
    }
  };

  return (
    <>
      <div className="p-4 bg-slate-50 border border-t-0 border-slate-200 rounded-b-xl">
        <div className="flex space-x-2 mb-3 border-b border-slate-200 pb-1">
          {complexCols.map((col) => (
            <button
              key={col}
              onClick={() => setActiveTab(col)}
              className={`px-3 py-1 rounded-t-lg text-sm font-semibold transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 ${
                activeTab === col
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                <span>{col}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-200">
          <NestedTable
            value={row[activeTab]}
            onEdit={handleNestedEdit}
            onDelete={handleNestedDelete}
            onAdd={handleNestedAdd}
            path={[activeTab]}
          />
        </div>
      </div>
      {nestedModal && (
        <RowModal
          headers={nestedModal.initialData ? Object.keys(nestedModal.initialData) : []}
          initial={nestedModal.initialData}
          onClose={() => setNestedModal(null)}
          onSubmit={handleNestedSave}
          pkName={"id"}
        />
      )}
    </>
  );
}