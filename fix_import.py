import ast

# Start from the known-good live version
with open('C:/Users/Homes247/Desktop/office-suite_live/backend/app/api/documents.py', 'r', encoding='utf-8') as f:
    src = f.read()

changes = []

# 1. Add CSV/TSV/XLS to doc_type detection
old = '    if filename_lower.endswith(".xlsx") or filename_lower.endswith(".csv"):\n        doc_type = "sheet"'
new = '    if filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls") or filename_lower.endswith(".csv") or filename_lower.endswith(".tsv"):\n        doc_type = "sheet"'
if old in src:
    src = src.replace(old, new)
    changes.append('1. CSV/TSV/XLS detection added')

# 2. Add XLS to the xlsx parsing condition
old4 = '    if doc_type == "sheet" and filename_lower.endswith(".xlsx"):'
new4 = '    if doc_type == "sheet" and (filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls")):'
if old4 in src:
    src = src.replace(old4, new4)
    changes.append('2. XLS added to xlsx parser condition')

# 3. Remove the debug file save that might fail and skip the real parsing
old5 = (
    '        try:\n'
    '            with open("backend/debug_uploaded_sheet.xlsx", "wb") as f_debug:\n'
    '                f_debug.write(content_bytes)\n'
    '        except Exception as save_err:\n'
    '            pass\n'
    '            \n'
    '        try:\n'
)
new5 = '        try:\n'
if old5 in src:
    src = src.replace(old5, new5)
    changes.append('3. Removed debug file save block')

# 4. Fix bad error log path — replace try/except around traceback write with a print
old3 = (
    '        except Exception as e:\n'
    '            try:\n'
    '                import traceback\n'
    '                with open("c:/Users/Homes247/Desktop/office-suite/backend/import_error.log", "w") as f_log:\n'
    '                    f_log.write(f"Global import error: {e}\\n{traceback.format_exc()}\\n")\n'
    '            except:\n'
    '                pass\n'
    '            content_json = _default_content(doc_type, title)\n'
)
new3 = (
    '        except Exception as e:\n'
    '            import traceback\n'
    '            print(f"[IMPORT XLSX ERROR] {e}")\n'
    '            print(traceback.format_exc())\n'
    '            content_json = _default_content(doc_type, title)\n'
)
if old3 in src:
    src = src.replace(old3, new3)
    changes.append('4. Fixed bad error log path')

# 5. Insert CSV/TSV parser block before the elif doc_type == "doc": line
csv_block = (
    '    elif doc_type == "sheet" and (filename_lower.endswith(".csv") or filename_lower.endswith(".tsv")):\n'
    '        try:\n'
    '            import csv as _csv\n'
    '            delimiter = "\\t" if filename_lower.endswith(".tsv") else ","\n'
    '            text = content_bytes.decode("utf-8-sig", errors="replace")\n'
    '            reader = _csv.reader(text.splitlines(), delimiter=delimiter)\n'
    '            rows_data = list(reader)\n'
    '            sparse_cells = {}\n'
    '            for ri, row in enumerate(rows_data):\n'
    '                for ci, val in enumerate(row):\n'
    '                    if val.strip():\n'
    '                        if ri not in sparse_cells:\n'
    '                            sparse_cells[ri] = {}\n'
    '                        sparse_cells[ri][ci] = val\n'
    '            content_json = json.dumps({\n'
    '                "_importedSheets": [{\n'
    '                    "name": title,\n'
    '                    "cells": sparse_cells,\n'
    '                    "formats": {},\n'
    '                    "validations": {},\n'
    '                    "colWidths": {},\n'
    '                    "rowHeights": {}\n'
    '                }]\n'
    '            })\n'
    '        except Exception as e:\n'
    '            import traceback\n'
    '            print(f"[IMPORT CSV ERROR] {e}")\n'
    '            print(traceback.format_exc())\n'
    '            content_json = _default_content(doc_type, title)\n'
    '    elif doc_type == "doc":\n'
)
old6 = '    elif doc_type == "doc":\n'
if old6 in src and csv_block not in src:
    src = src.replace(old6, csv_block, 1)
    changes.append('5. CSV/TSV parser block inserted')

# Verify
try:
    ast.parse(src)
    print('Syntax: OK')
    with open('C:/Users/Homes247/Desktop/office-suite_Test/backend/app/api/documents.py', 'w', encoding='utf-8') as f:
        f.write(src)
    print(f'Written: {len(src)} bytes, {src.count(chr(10))} lines')
    print('Changes applied:')
    for c in changes:
        print(' ', c)
except SyntaxError as e:
    print(f'SYNTAX ERROR at line {e.lineno}: {e.msg}')
    print(f'Context: {e.text}')
