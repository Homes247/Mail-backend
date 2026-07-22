const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Update toggleLockSheet to have detectChanges
const t1 = `  toggleLockSheet(idx: number) {
    this.sheets[idx].locked = !this.sheets[idx].locked;
    this.save();
    this.showToast(this.sheets[idx].locked ? 'Sheet locked.' : 'Sheet unlocked.');
  }`;

const r1 = `  toggleLockSheet(idx: number) {
    this.sheets[idx].locked = !this.sheets[idx].locked;
    this.save();
    this.showToast(this.sheets[idx].locked ? 'Sheet locked.' : 'Sheet unlocked.');
    if (this.cdr) this.cdr.detectChanges();
  }`;

content = content.replace(t1, r1);

// Ensure the icon is clearly an unlock icon (open lock) and looks correct
const t2 = `                  <button (click)="toggleLockSheet(item.sheetIndex)" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #ea4335;" title="Unlock Sheet">
                    <span class="material-symbols-outlined" style="font-size: 16px;">lock_open</span>
                  </button>`;

const r2 = `                  <button (click)="toggleLockSheet(item.sheetIndex)" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #ea4335;" title="Unlock Sheet">
                    <span class="material-symbols-outlined" style="font-size: 18px;">lock_open</span>
                  </button>`;

content = content.replace(t2, r2);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed toggleLockSheet and UI!');
