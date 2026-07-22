const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const tHtml = `              <div style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; font-size:14px;" [style.color]="currentTheme === 'dark' ? '#9aa0a6' : '#5f6368'">
                No Locked Cells
              </div>
            </div>`;
const rHtml = `              <div *ngIf="getLockedCellsForCurrentSettings().length === 0" style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; font-size:14px;" [style.color]="currentTheme === 'dark' ? '#9aa0a6' : '#5f6368'">
                No Locked Cells
              </div>
              <div *ngIf="getLockedCellsForCurrentSettings().length > 0" style="flex: 1; overflow-y: auto; max-height: 200px; border: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }}; border-radius: 4px; padding: 4px 0;">
                <div *ngFor="let item of getLockedCellsForCurrentSettings()" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid {{ currentTheme === 'dark' ? '#3c4043' : '#e0e0e0' }};" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'">
                  <div style="font-size: 13px;">
                    <span *ngIf="lockSettingsSelectedSheet === 'all'" style="opacity: 0.7; margin-right: 8px;">{{ item.sheetName }}</span>
                    <span style="font-weight: 500;">Cell {{ item.ref }}</span>
                  </div>
                  <button (click)="unlockCellFromSettings(item)" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #ea4335;" title="Unlock Cell">
                    <span class="material-symbols-outlined" style="font-size: 16px;">lock_open</span>
                  </button>
                </div>
              </div>
            </div>`;
content = content.replace(tHtml, rHtml);


const tMethod = `  manageLockSettings() {
    this.manageLockSettingsModalOpen = true;
    this.lockSettingsTab = 'ranges';
    this.lockSettingsSelectedSheet = 'all';
  }`;

const rMethod = `  manageLockSettings() {
    this.manageLockSettingsModalOpen = true;
    this.lockSettingsTab = 'ranges';
    this.lockSettingsSelectedSheet = 'all';
  }

  getLockedCellsForCurrentSettings(): Array<{ sheetIndex: number, sheetName: string, ref: string, r: number, c: number }> {
    const results: Array<{ sheetIndex: number, sheetName: string, ref: string, r: number, c: number }> = [];
    const checkAll = this.lockSettingsSelectedSheet === 'all';
    
    for (let i = 0; i < this.sheets.length; i++) {
      if (!checkAll && parseInt(this.lockSettingsSelectedSheet as string, 10) !== i) continue;
      
      const sheet = this.sheets[i];
      const formats = (i === this.currentSheetIdx) ? this.formats : (sheet.formats || {});
      for (const key of Object.keys(formats)) {
        if ((formats[key] as any)?.locked) {
          const [rStr, cStr] = key.split(',');
          const r = parseInt(rStr, 10);
          const c = parseInt(cStr, 10);
          
          let colStr = '';
          let temp = c;
          while (temp >= 0) {
            colStr = String.fromCharCode(65 + (temp % 26)) + colStr;
            temp = Math.floor(temp / 26) - 1;
          }
          const ref = colStr + (r + 1);
          
          results.push({ sheetIndex: i, sheetName: sheet.name, ref, r, c });
        }
      }
    }
    return results;
  }

  unlockCellFromSettings(item: { sheetIndex: number, sheetName: string, ref: string, r: number, c: number }) {
    const key = \`\${item.r},\${item.c}\`;
    if (item.sheetIndex === this.currentSheetIdx) {
      if (this.formats[key]) {
        delete (this.formats[key] as any).locked;
        this.formats = { ...this.formats };
      }
    } else {
      const sheet = this.sheets[item.sheetIndex];
      if (sheet.formats && sheet.formats[key]) {
        delete (sheet.formats[key] as any).locked;
      }
    }
    this.save();
    this.showToast(\`Unlocked Cell \${item.ref} on \${item.sheetName}\`);
    if (this.cd) this.cd.detectChanges();
  }`;

content = content.replace(tMethod, rMethod);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed locked cells display!');
