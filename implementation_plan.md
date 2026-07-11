# Implementation Plan

This document tracks the current implementation plan, including tasks, progress, and file changes. It will be updated every time a new change is requested or completed.

## Current Objective
Restore data fidelity, formatting, and feature integrity during XLSX file imports and ensure correct spreadsheet saving/loading in the editor.

## Tasks
- [x] **Task 7:** Change default `ROWS` to 1000 in `sheet-editor.component.ts`.
- [x] **Task 1:** Update `getSparse()` in `sheet-editor.component.ts` to preserve `wrap` in `cleanFormats`.
- [x] **Task 2:** Update `getSparse()` in `sheet-editor.component.ts` to save `colWidths` and `rowHeights` in the document content.
- [x] **Task 3:** Implement/verify `import_xlsx_endpoint` in backend (`export.py` or `documents.py`) to properly parse XLSX including validations and cell dimensions.
- [x] **Task 4:** Add `importFile()` to frontend `api.service.ts` to hit the import endpoint.
- [x] **Task 5:** Update upload logic (e.g., in `dashboard.component.ts`) to call `importFile()` instead of `createDocument()` with an empty document.
- [x] **Task 6:** Update `ngOnInit` and document loading logic in `sheet-editor.component.ts` to load `colWidths`, `rowHeights`, and parse validations properly.

## Progress Updates
- **[2026-06-25]**: Initialized the implementation plan with the import parity fix tasks.
- **[2026-06-25]**: Completed implementation. Modified backend `documents.py` to handle importing files using `openpyxl`. Frontend updated to send file imports properly, and the `sheet-editor.component.ts` was updated to save and parse dimensions and formats correctly.
- **[2026-06-25]**: Added support for parsing cell background colors (`cell.fill.fgColor`), font colors (`cell.font.color`), merged cells (`ws.merged_cells`), inline or range-referenced validation lists (`resolve_validation_options`), and cell screenshots/images (`ws._images`). Also fixed frontend format serialization (`cleanFormats` inside `getSparse()`) to prevent stripping out merge configurations (`_mergeSpan` and `_mergedInto`).
- **[2026-06-25]**: Fixed bug in image extraction by accessing the raw image bytes via `img._data()` instead of the non-existent `img.image` attribute. Made data validation range handling (`sqref`) robust against variations in openpyxl string/object representations. Added file capture and self-logging hooks in `documents.py` to save `debug_uploaded_sheet.xlsx` and `debug_validation.log`.

## Files to Modify
- `frontend/src/app/pages/sheet-editor/sheet-editor.component.ts`
- `frontend/src/app/services/api.service.ts`
- `frontend/src/app/pages/dashboard/dashboard.component.ts` (or equivalent upload component)
- `backend/app/api/export.py` (or `documents.py`)

## Notes
- *Any specific requirements or technical details will be logged here.*
