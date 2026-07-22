const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');
content = content.replace(/\r\n/g, '\n');

const t1 = `                  <div class="mdi" (click)="lockCurrentSheet(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">lock</span>
                    {{ sheets[currentSheetIdx].locked ? 'Unlock Sheet' : 'Lock Sheet' }}
                  </div>
                  <div class="mds"></div>
                  <div class="mdi" (click)="lockSelectedRange(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">lock_open</span> Lock Selected Range
                  </div>`;
const r1 = `                  <div class="mdi" (click)="lockSelectedRange(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">lock_open</span> Lock Cells...
                  </div>
                  <div class="mdi" (click)="lockCurrentSheet(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">lock</span>
                    {{ sheets[currentSheetIdx].locked ? 'Unlock Sheet...' : 'Lock Sheet...' }}
                  </div>
                  <div class="mdi" (click)="manageLockSettings(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">settings</span> Manage Lock Settings...
                  </div>
                  <div class="mdi" (click)="highlightLocks(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">highlight</span> Highlight Locks
                  </div>`;
content = content.replace(t1, r1);

const t2 = `                <div class="mdi" (click)="lockCurrentSheet(); closeMenus()">
                  {{ sheets[currentSheetIdx].locked ? 'Unlock Sheet' : 'Lock Sheet' }}
                </div>
                <div class="mdi" (click)="lockSelectedRange(); closeMenus()">Lock Selected Range</div>`;
const r2 = `                <div class="mdi" (click)="lockSelectedRange(); closeMenus()">Lock Cells...</div>
                <div class="mdi" (click)="lockCurrentSheet(); closeMenus()">
                  {{ sheets[currentSheetIdx].locked ? 'Unlock Sheet...' : 'Lock Sheet...' }}
                </div>
                <div class="mdi" (click)="manageLockSettings(); closeMenus()">Manage Lock Settings...</div>
                <div class="mdi" (click)="highlightLocks(); closeMenus()">Highlight Locks</div>`;
content = content.replace(t2, r2);

const t3 = `  lockSelectedRange() {
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        this.formats[\`\${r},\${c}\`] = { ...(this.formats[\`\${r},\${c}\`] || {}), locked: true } as any;
    this.onCellChange(); this.save();
    this.showToast(\`Range locked: \${this.colLabel(minC)}\${minR + 1}:\${this.colLabel(maxC)}\${maxR + 1}\`);
  }`;
const r3 = `  lockSelectedRange() {
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        this.formats[\`\${r},\${c}\`] = { ...(this.formats[\`\${r},\${c}\`] || {}), locked: true } as any;
    this.onCellChange(); this.save();
    this.showToast(\`Range locked: \${this.colLabel(minC)}\${minR + 1}:\${this.colLabel(maxC)}\${maxR + 1}\`);
  }

  isSelectionLocked(): boolean {
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if ((this.formats[\`\${r},\${c}\`] as any)?.locked) return true;
      }
    }
    return false;
  }

  manageLockSettings() {
    this.showToast('Manage Lock Settings is not implemented yet.');
  }

  highlightLocks() {
    this.showToast('Highlight Locks is not implemented yet.');
  }`;
content = content.replace(t3, r3);

const t4 = `  startEditing(initialValue?: string) {
    if (this.sheets[this.currentSheetIdx]?.locked) {
      this.showToast('This sheet is locked.');
      return;
    }
    this.isEditingCell = true;`;
const r4 = `  startEditing(initialValue?: string) {
    if (this.sheets[this.currentSheetIdx]?.locked) {
      this.showToast('This sheet is locked.');
      return;
    }
    if ((this.formats[\`\${this.selectedRow},\${this.selectedCol}\`] as any)?.locked) {
      this.showToast('This cell is locked.');
      return;
    }
    this.isEditingCell = true;`;
content = content.replace(t4, r4);

const t5 = `  clearRangeData() {
    this.pushHistory();
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;`;
const r5 = `  clearRangeData() {
    if (this.sheets[this.currentSheetIdx]?.locked) { this.showToast('This sheet is locked.'); return; }
    if (this.isSelectionLocked()) { this.showToast('Some cells in the selected range are locked.'); return; }
    this.pushHistory();
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;`;
content = content.replace(t5, r5);

const t6 = `  pasteCell() {
    if (this.richClipboard) {`;
const r6 = `  pasteCell() {
    if (this.sheets[this.currentSheetIdx]?.locked) { this.showToast('This sheet is locked.'); return; }
    if (this.isSelectionLocked()) { this.showToast('Some cells in the selected range are locked.'); return; }
    if (this.richClipboard) {`;
content = content.replace(t6, r6);

const t7 = `  clearCell() {
    this.pushHistory();`;
const r7 = `  clearCell() {
    if (this.sheets[this.currentSheetIdx]?.locked) { this.showToast('This sheet is locked.'); return; }
    if ((this.formats[\`\${this.selectedRow},\${this.selectedCol}\`] as any)?.locked) { this.showToast('This cell is locked.'); return; }
    this.pushHistory();`;
content = content.replace(t7, r7);

// Convert back to CRLF if needed (though LF is fine for TypeScript files generally)
// Let's just keep LF.
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Changes applied!');
