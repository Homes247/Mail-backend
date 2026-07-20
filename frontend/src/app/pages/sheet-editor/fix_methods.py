import re

filepath = 'src/app/pages/sheet-editor/sheet-editor.component.ts'
content = open(filepath, encoding='utf-8').read()

# Strip trailing whitespace / empty lines at end
content = content.rstrip()

# The methods to append (everything that's missing from the class)
methods_to_append = r"""

  // ---- Computed row heights from active sheet ----
  get rowHeights(): Record<number, number> {
    return this.sheets[this.currentSheetIdx]?.rowHeights || {};
  }

  getRowHeight(r: number): number {
    return this.rowHeights[r] || 24;
  }

  // ---- Formula evaluator (basic passthrough; real eval lives in display cache) ----
  evalCell(r: number, c: number): any {
    const raw = this.cells[r]?.[c];
    if (!raw || !raw.startsWith('=')) return raw;
    // Simple arithmetic evaluation
    try {
      const expr = raw.substring(1).replace(/[A-Z]+\d+/g, (ref) => {
        const colMatch = ref.match(/^[A-Z]+/);
        const rowMatch = ref.match(/\d+$/);
        if (!colMatch || !rowMatch) return '0';
        let col = 0;
        for (let i = 0; i < colMatch[0].length; i++) col = col * 26 + (colMatch[0].charCodeAt(i) - 64);
        col -= 1;
        const row = parseInt(rowMatch[0], 10) - 1;
        return this.cells[row]?.[col] || '0';
      });
      return Function('"use strict"; return (' + expr + ')')();
    } catch { return raw; }
  }

  // ---- Custom number format string ----
  applyCustomFormatString(val: any, num: number, isNum: boolean, fmtStr: string): string {
    if (!isNum) return String(val ?? '');
    if (fmtStr.includes('0.00')) return num.toFixed(2);
    if (fmtStr.includes('0.0')) return num.toFixed(1);
    if (fmtStr.includes('0%')) return (num * 100).toFixed(0) + '%';
    return String(num);
  }

  // ---- Save / debounce ----
  saveSubscription: any;
  saveSubject = new (require ? (require as any)('rxjs').Subject : class { next() {} pipe() { return { subscribe: (fn: any) => { this._fn = fn; return { unsubscribe: () => {} }; } }; } _fn?: any })();

  executeSave() {
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet) return;
    const payload = {
      cells: sheet.cells,
      formats: sheet.formats,
      validations: sheet.validations,
      colWidths: sheet.colWidths,
      rowHeights: sheet.rowHeights,
      sparklines: sheet.sparklines,
      shapes: sheet.shapes,
      hideGridlines: sheet.hideGridlines,
      gridlineColor: sheet.gridlineColor,
      frozenRowsCount: sheet.frozenRowsCount,
      frozenColsCount: sheet.frozenColsCount,
      filterActive: this.filterActive,
      advFilterSavedState: this.serializeAdvFilterState(),
      hiddenRows: Array.from(this.hiddenRows),
      activeFilterCols: Array.from(this.activeFilterCols),
    };
    const allSheets = this.sheets.map((s: any, i: number) =>
      i === this.currentSheetIdx ? { ...s, ...payload } : s
    );
    this.api.updateDocument(this.docId, { content: JSON.stringify(allSheets) }).subscribe({
      next: () => {
        this.toastVisible = true;
        this.toastMsg = 'Saved';
        setTimeout(() => (this.toastVisible = false), 1500);
      },
      error: () => {}
    });
  }

  // ---- Cell edit history for collaboration ----
  cellEditHistory: Record<string, any[]> = {};

  // ---- Recalculate all filters ----
  recalculateAllFilters() {
    if (!this.filterActive) return;
    for (let r = 1; r < this.ROWS; r++) {
      if (this.hiddenRows.has(r)) continue;
    }
    if (this.cdr) this.cdr.markForCheck();
  }

  // ---- Menu helpers ----
  closeMenus() {
    this.activePalette = null;
    this.activeCtxSubmenu = null;
    this.activeSheetMenuIdx = null;
    this.activeSheetSubmenu = null;
  }

  hideCtx() {
    this.ctxVisible = false;
  }

  showToast(msg: string) {
    this.toastMsg = msg;
    this.toastVisible = true;
    setTimeout(() => (this.toastVisible = false), 2500);
  }

  // ---- Range reference helper ----
  getRangeRef(): string {
    const c1 = this.colLabel(this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol);
    const r1 = (this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow) + 1;
    if (!this.rangeStart || (this.rangeStart.r === this.rangeEnd!.r && this.rangeStart.c === this.rangeEnd!.c)) {
      return `${c1}${r1}`;
    }
    const c2 = this.colLabel(Math.max(this.rangeStart.c, this.rangeEnd!.c));
    const r2 = Math.max(this.rangeStart.r, this.rangeEnd!.r) + 1;
    return `${c1}${r1}:${c2}${r2}`;
  }

  // ---- Save ----
  save() {
    this.saveSubject.next(null);
    this.executeSave();
  }

  // ---- onCellChange: refresh display cache and trigger debounced save ----
  onCellChange() {
    this.updateDisplayCache();
    if (this.cdr) this.cdr.markForCheck();
    this.saveSubject.next(null);
  }

  // ---- Undo / Redo ----
  private history: Array<{ cells: string[][], formats: Record<string, any> }> = [];
  private historyIdx = -1;

  pushHistory() {
    const snap = {
      cells: this.cells.map(row => [...row]),
      formats: { ...this.formats }
    };
    this.history = this.history.slice(0, this.historyIdx + 1);
    this.history.push(snap);
    this.historyIdx = this.history.length - 1;
    if (this.history.length > 100) {
      this.history.shift();
      this.historyIdx--;
    }
  }

  undo() {
    if (this.historyIdx <= 0) return;
    this.historyIdx--;
    const snap = this.history[this.historyIdx];
    this.cells = snap.cells.map(row => [...row]);
    this.formats = { ...snap.formats };
    this.onCellChange();
  }

  redo() {
    if (this.historyIdx >= this.history.length - 1) return;
    this.historyIdx++;
    const snap = this.history[this.historyIdx];
    this.cells = snap.cells.map(row => [...row]);
    this.formats = { ...snap.formats };
    this.onCellChange();
  }

  // ---- Select helpers ----
  selectAll() {
    this.rangeStart = { r: 0, c: 0 };
    this.rangeEnd = { r: this.ROWS - 1, c: this.COLS - 1 };
    if (this.cdr) this.cdr.markForCheck();
  }

  selectCell(r: number, c: number) {
    this.selectedRow = r;
    this.selectedCol = c;
    this.rangeStart = null;
    this.rangeEnd = null;
    this.formulaBarValue = this.cells[r][c] || '';
    if (this.cdr) this.cdr.markForCheck();
  }

  forEachSelectedCell(cb: (r: number, c: number) => void) {
    if (!this.rangeStart || !this.rangeEnd) {
      cb(this.selectedRow, this.selectedCol);
      return;
    }
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        cb(r, c);
      }
    }
  }

  // ---- Format toggle ----
  toggleFormat(prop: string) {
    this.pushHistory();
    this.forEachSelectedCell((r, c) => {
      const key = `${r},${c}`;
      if (!this.formats[key]) this.formats[key] = {} as any;
      const fmt = this.formats[key] as any;
      fmt[prop] = !fmt[prop];
    });
    this.onCellChange();
  }

  setFormat(prop: string, val?: any) {
    this.pushHistory();
    this.forEachSelectedCell((r, c) => {
      const key = `${r},${c}`;
      if (!this.formats[key]) this.formats[key] = {} as any;
      (this.formats[key] as any)[prop] = val !== undefined ? val : true;
    });
    this.onCellChange();
  }

  // ---- Clear helpers ----
  clearCell(r?: number, c?: number) {
    const tr = r ?? this.selectedRow;
    const tc = c ?? this.selectedCol;
    this.pushHistory();
    this.cells[tr][tc] = '';
    this.onCellChange();
    this.save();
  }

  clearRangeData() {
    this.pushHistory();
    this.forEachSelectedCell((r, c) => {
      this.cells[r][c] = '';
    });
    this.onCellChange();
    this.save();
  }

  // ---- Edit cell ----
  startEditing(initialKey?: string) {
    this.isEditingCell = true;
    this.editValue = initialKey !== undefined ? initialKey : (this.cells[this.selectedRow][this.selectedCol] || '');
    this.formulaBarValue = this.editValue;
    if (this.cdr) this.cdr.markForCheck();
  }

  // ---- Cut / Copy ----
  cutCell() {
    this.clipboard = this.cells[this.selectedRow][this.selectedCol];
    this.cells[this.selectedRow][this.selectedCol] = '';
    this.onCellChange();
    this.save();
  }

  copyCell() {
    this.clipboard = this.cells[this.selectedRow][this.selectedCol];
  }

  // ---- Fill Down / Right ----
  fillDown() {
    if (!this.rangeStart || !this.rangeEnd) return;
    this.pushHistory();
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    for (let c = minC; c <= maxC; c++) {
      const srcVal = this.cells[minR][c];
      for (let r = minR + 1; r <= maxR; r++) {
        this.cells[r][c] = this.shiftFormula(srcVal, r - minR, 0);
      }
    }
    this.onCellChange();
    this.save();
  }

  fillRight() {
    if (!this.rangeStart || !this.rangeEnd) return;
    this.pushHistory();
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    for (let r = minR; r <= maxR; r++) {
      const srcVal = this.cells[r][minC];
      for (let c = minC + 1; c <= maxC; c++) {
        this.cells[r][c] = this.shiftFormula(srcVal, 0, c - minC);
      }
    }
    this.onCellChange();
    this.save();
  }

  // ---- Find & Replace ----
  openFind() {
    this.findModalOpen = true;
  }

  // ---- Dropdown options ----
  getCellDropdownOptions(r: number, c: number): string[] {
    const key = `${r},${c}`;
    const v = this.validations[key];
    if (!v || v.type !== 'list') return [];
    return (v.value || '').split(',').map((s: string) => s.trim()).filter((s: string) => s);
  }

  // ---- ngOnDestroy ----
  ngOnDestroy() {
    if (this.saveSubscription && this.saveSubscription.unsubscribe) {
      this.saveSubscription.unsubscribe();
    }
  }

}
"""

# Remove any stray dangling close brace at the very end if already there
content_stripped = content.rstrip()
if content_stripped.endswith('}'):
    # Check if there's already a closing brace for the class
    # Count braces from the class declaration at line 4420
    class_start = content.find('export class SheetEditorComponent')
    after_class = content[class_start:]
    depth = 0
    closed = False
    for i, ch in enumerate(after_class):
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                closed = True
                break
    if closed:
        print("Class already properly closed, just appending stubs before closing brace")
        # Insert stubs before the last }
        last_close = content.rfind('}')
        content = content[:last_close] + methods_to_append
    else:
        content = content_stripped + '\n' + methods_to_append
else:
    content = content_stripped + '\n' + methods_to_append

open(filepath, 'w', encoding='utf-8').write(content)
print("Done. File written.")
print(f"Total lines: {len(content.splitlines())}")
