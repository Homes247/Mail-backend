const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const tHtml = `            <div *ngIf="lockSettingsTab === 'sheets'">
              <div style="font-weight:600; font-size:14px; margin-bottom: 24px;">View Locked Sheet(s)</div>
              <div style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; font-size:14px;" [style.color]="currentTheme === 'dark' ? '#9aa0a6' : '#5f6368'">
                No Locked Cells
              </div>
            </div>`;

const rHtml = `            <div *ngIf="lockSettingsTab === 'sheets'">
              <div style="font-weight:600; font-size:14px; margin-bottom: 24px;">View Locked Sheet(s)</div>
              
              <div *ngIf="getLockedSheets().length === 0" style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; font-size:14px;" [style.color]="currentTheme === 'dark' ? '#9aa0a6' : '#5f6368'">
                No Locked Sheets
              </div>
              <div *ngIf="getLockedSheets().length > 0" style="flex: 1; overflow-y: auto; max-height: 200px; border: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }}; border-radius: 4px; padding: 4px 0;">
                <div *ngFor="let item of getLockedSheets()" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }};" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'">
                  <div style="font-size: 13px;">
                    <span style="font-weight: 500;">{{ item.sheetName }}</span>
                  </div>
                  <button (click)="toggleLockSheet(item.sheetIndex)" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #ea4335;" title="Unlock Sheet">
                    <span class="material-symbols-outlined" style="font-size: 16px;">lock_open</span>
                  </button>
                </div>
              </div>
            </div>`;

content = content.replace(tHtml, rHtml);

const tMethod = `  getLockedCellsForCurrentSettings(): Array<{ sheetIndex: number, sheetName: string, ref: string, r: number, c: number }> {`;

const rMethod = `  getLockedSheets(): Array<{ sheetIndex: number, sheetName: string }> {
    const results: Array<{ sheetIndex: number, sheetName: string }> = [];
    for (let i = 0; i < this.sheets.length; i++) {
      if (this.sheets[i].locked) {
        results.push({ sheetIndex: i, sheetName: this.sheets[i].name });
      }
    }
    return results;
  }

  getLockedCellsForCurrentSettings(): Array<{ sheetIndex: number, sheetName: string, ref: string, r: number, c: number }> {`;

content = content.replace(tMethod, rMethod);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed locked sheets display!');
