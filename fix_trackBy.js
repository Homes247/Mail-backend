const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Add trackBy to the locked cells *ngFor
const tCells = `<div *ngFor="let item of getLockedCellsForCurrentSettings()" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }};"`;
const rCells = `<div *ngFor="let item of getLockedCellsForCurrentSettings(); trackBy: trackByCellRef" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }};"`;
content = content.replace(tCells, rCells);

// Fix 2: Add trackBy to the locked sheets *ngFor
const tSheets = `<div *ngFor="let item of getLockedSheets()" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }};"`;
const rSheets = `<div *ngFor="let item of getLockedSheets(); trackBy: trackBySheetIndex" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }};"`;
content = content.replace(tSheets, rSheets);

// Fix 3: Add trackBy methods to the component class
const tMethods = `  getLockedSheets(): Array<{ sheetIndex: number, sheetName: string }> {`;
const rMethods = `  trackBySheetIndex(index: number, item: any) { return item.sheetIndex; }
  trackByCellRef(index: number, item: any) { return item.sheetIndex + '-' + item.ref; }

  getLockedSheets(): Array<{ sheetIndex: number, sheetName: string }> {`;
content = content.replace(tMethods, rMethods);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed trackBy!');
