import xlwings as xw
import json
import sys
import os
import re
from xlwings import constants as xlconstants
from uuid import uuid4

def find_header_row(sheet, pk_name='id'):
    """
    Finds the header row, prioritizing a row that contains the pk_name.
    If not found, it returns the first row with visible data.
    Returns a tuple of (header_row_num, pk_col_idx).
    """
    try:
        max_row_search = min(sheet.api.UsedRange.Rows.Count, 20)
        first_data_row = -1
        for row_num in range(1, max_row_search + 1):
            header_values = []
            visible_cols = []
            
            # Iterate through columns to find visible headers
            for col_idx in range(1, sheet.api.UsedRange.Columns.Count + 1):
                cell = sheet.cells(row_num, col_idx)
                if not cell.api.EntireColumn.Hidden:
                    header_value = cell.value
                    if header_value is not None and str(header_value).strip() != '':
                        header_values.append(str(header_value).strip())
                        visible_cols.append(col_idx)
            
            if header_values and first_data_row == -1:
                first_data_row = row_num

            # Found a row with the primary key, return it
            if pk_name in header_values:
                pk_index = header_values.index(pk_name)
                pk_col_idx = visible_cols[pk_index]
                return row_num, pk_col_idx
        
        # If no pk_name found, assume the first row with data is the header row.
        if first_data_row != -1:
            return first_data_row, -1 # -1 indicates pk_name was not found

        raise ValueError("Could not find any data in the first 20 rows.")
    except Exception as e:
        raise ValueError(f"Failed to find header row: {e}")

def ensure_headers_and_ids(sheet, header_row_num, pk_name='id', is_xlsm=False):
    """
    Ensures a sheet has 'id' and '_version' headers and populates them for existing rows.
    Dynamically adds columns for .xlsx and validates existence for .xlsm.
    """
    headers = []
    header_col_map = {}
    
    # Get all existing headers and their column indices
    for col_idx in range(1, sheet.api.UsedRange.Columns.Count + 1):
        cell = sheet.cells(header_row_num, col_idx)
        if not cell.api.EntireColumn.Hidden and cell.value is not None and str(cell.value).strip() != '':
            header_name = str(cell.value).strip()
            headers.append(header_name)
            header_col_map[header_name] = col_idx
    
    pk_col_idx = header_col_map.get(pk_name, -1)
    version_col_idx = header_col_map.get('_version', -1)
    
    # **KEY CHANGE:** Conditionally add columns based on file type
    if not is_xlsm:
        # For .xlsx, add columns if they don't exist
        last_col = sheet.api.UsedRange.Columns.Count
        if pk_col_idx == -1:
            last_col += 1
            pk_col_idx = last_col
            sheet.cells(header_row_num, pk_col_idx).value = pk_name
        
        if version_col_idx == -1:
            if pk_col_idx == last_col:
                last_col += 1
            version_col_idx = last_col
            sheet.cells(header_row_num, version_col_idx).value = '_version'
    else:
        # For .xlsm, raise an error if columns are not found
        if pk_col_idx == -1 or version_col_idx == -1:
            raise ValueError(f"Required '{pk_name}' and '_version' columns not found in .xlsm file. "
                             "Please add them manually to the workbook.")

    # Populate the columns for existing rows
    start_row = header_row_num + 1
    last_row_with_data = sheet.range(start_row, 1).end('down').row if sheet.range(start_row, 1).value else start_row
    
    if last_row_with_data >= start_row:
        for row_num in range(start_row, last_row_with_data + 1):
            cell_pk = sheet.cells(row_num, pk_col_idx)
            if cell_pk.value is None or str(cell_pk.value).strip() == "":
                cell_pk.value = str(uuid4())

            cell_version = sheet.cells(row_num, version_col_idx)
            if cell_version.value is None or str(cell_version.value).strip() == "":
                cell_version.value = 1
    
    return pk_col_idx, version_col_idx

def add_row(wb, sheet_name, row, pk_name='id'):
    try:
        app = wb.app
        app.api.EnableEvents = False # Disable events
        sheet = wb.sheets[sheet_name]
        is_xlsm = wb.fullname.lower().endswith('.xlsm')

        try:
            header_row_num, _ = find_header_row(sheet, pk_name)
        except ValueError:
            header_row_num = 1
        
        pk_col_idx, version_col_idx = ensure_headers_and_ids(sheet, header_row_num, pk_name, is_xlsm)

        next_row_num = sheet.range(header_row_num, 1).end('down').row + 1
        
        headers_range = sheet.range(header_row_num, 1).expand('right')
        headers = [c.value for c in headers_range]
        
        row_to_copy_from = next_row_num - 1
        last_col = headers_range.end('right').column
        
        for col_idx in range(1, last_col + 1):
            source_cell = sheet.cells(row_to_copy_from, col_idx)
            target_cell = sheet.cells(next_row_num, col_idx)
            
            source_cell.copy()
            target_cell.paste(paste='formats')
            
            if source_cell.formula is not None and '=' in source_cell.formula:
                updated_formula = re.sub(r'([A-Za-z]+)(\d+)', 
                                         lambda m: m.group(1) + str(int(m.group(2)) + 1), 
                                         source_cell.formula)
                target_cell.formula = updated_formula
            else:
                header = headers[col_idx - 1]
                if header in row:
                    target_cell.value = row[header]
        
        if pk_name in headers:
            pk_col_idx_local = headers.index(pk_name) + 1
            sheet.cells(next_row_num, pk_col_idx_local).value = str(uuid4())
        
        if '_version' in headers:
            version_col_idx_local = headers.index('_version') + 1
            sheet.cells(next_row_num, version_col_idx_local).value = 1
            
        wb.save()
        return {"status": "ok", "message": f"Row added successfully."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if 'app' in locals() and app:
            app.api.EnableEvents = True

def update_row(wb, sheet_name, pk_name, id, incoming_row):
    try:
        app = wb.app
        app.api.EnableEvents = False
        sheet = wb.sheets[sheet_name]
        is_xlsm = wb.fullname.lower().endswith('.xlsm')

        header_row_num, pk_col_idx = find_header_row(sheet, pk_name)
        pk_col_idx, version_col_idx = ensure_headers_and_ids(sheet, header_row_num, pk_name, is_xlsm)
        
        pk_col_values = sheet.range(header_row_num + 1, pk_col_idx).expand('down').value
        if pk_col_values and not isinstance(pk_col_values, list):
            pk_col_values = [pk_col_values]
            
        row_num = None
        if pk_col_values:
            for i, val in enumerate(pk_col_values):
                if str(val) == str(id):
                    row_num = header_row_num + 1 + i
                    break
        
        if row_num is None:
            raise ValueError(f"Row with ID '{id}' not found.")
            
        headers = [c.value for c in sheet.range(header_row_num, 1).expand('right')]
        
        for header, value in incoming_row.items():
            if header in headers:
                col_idx = headers.index(header) + 1
                cell_to_update = sheet.cells(row_num, col_idx)
                if cell_to_update.formula is None or not cell_to_update.formula.startswith('='):
                    cell_to_update.value = value
        
        if version_col_idx != -1:
            current_version = sheet.cells(row_num, version_col_idx).value or 0
            sheet.cells(row_num, version_col_idx).value = int(current_version) + 1
            
        wb.save()
        return {"status": "ok", "message": f"Row with ID '{id}' updated successfully."}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if 'app' in locals() and app:
            app.api.EnableEvents = True

def delete_row(wb, sheet_name, pk_name, id):
    try:
        app = wb.app
        app.api.EnableEvents = False
        sheet = wb.sheets[sheet_name]
        is_xlsm = wb.fullname.lower().endswith('.xlsm')

        header_row_num, pk_col_idx = find_header_row(sheet, pk_name)
        pk_col_idx, _ = ensure_headers_and_ids(sheet, header_row_num, pk_name, is_xlsm)
        pk_col_values = sheet.range(header_row_num + 1, pk_col_idx).expand('down').value
        if pk_col_values and not isinstance(pk_col_values, list):
            pk_col_values = [pk_col_values]
        row_num = None
        if pk_col_values:
            for i, val in enumerate(pk_col_values):
                if str(val) == str(id):
                    row_num = header_row_num + 1 + i
                    break
        if row_num is None:
            raise ValueError(f"Row with ID '{id}' not found for deletion.")
        sheet.api.Rows(row_num).Delete()
        wb.save()
        return {"status": "ok", "message": f"Row with ID '{id}' deleted successfully."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if 'app' in locals() and app:
            app.api.EnableEvents = True

if __name__ == "__main__":
    app = None
    wb = None
    try:
        command = sys.argv[1]
        params = json.loads(sys.argv[2])
        
        app = xw.App(visible=False)
        app.display_alerts = False
        app.api.EnableEvents = False
        
        wb = app.books.open(params['filePath'])
        result = {}
        if command == 'add-row':
            result = add_row(wb, params['sheetName'], params['row'], params.get('pkName', 'id'))
        elif command == 'update-row':
            result = update_row(wb, params['sheetName'], params.get('pkName', 'id'), params['id'], params['incomingRow'])
        elif command == 'delete-row':
            result = delete_row(wb, params['sheetName'], params.get('pkName', 'id'), params['id'])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Script execution error: {str(e)}"}))
    finally:
        if wb:
            try:
                wb.close()
            except Exception as e:
                sys.stderr.write(f"Error closing workbook: {e}\n")
        if app:
            try:
                app.api.EnableEvents = True
                app.quit()
            except Exception as e:
                sys.stderr.write(f"Error quitting Excel app: {e}\n")