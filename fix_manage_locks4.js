const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the button HTML
const tHtml = `<button (click)="toggleLockSheet(item.sheetIndex)" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #ea4335;" title="Unlock Sheet">
                    <span class="material-symbols-outlined" style="font-size: 18px;">lock_open</span>
                  </button>`;

const rHtml = `<button (click)="toggleLockSheet(item.sheetIndex); $event.stopPropagation()" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; color: #ea4335;" title="Unlock Sheet">
                    <span class="material-symbols-outlined" style="font-size: 18px; pointer-events: none;">lock_open</span>
                  </button>`;

content = content.replace(tHtml, rHtml);

const tMethod = `  toggleLockSheet(idx: number) {
    this.sheets[idx].locked = !this.sheets[idx].locked;
    this.save();
    this.showToast(this.sheets[idx].locked ? 'Sheet locked.' : 'Sheet unlocked.');
    if (this.cdr) this.cdr.detectChanges();
  }`;

const rMethod = `  toggleLockSheet(idx: number) {
    console.log('[SheetEditor] toggleLockSheet called with idx:', idx);
    this.sheets[idx].locked = !this.sheets[idx].locked;
    this.save();
    this.showToast(this.sheets[idx].locked ? 'Sheet locked.' : 'Sheet unlocked.');
    if (this.cdr) this.cdr.detectChanges();
  }`;

content = content.replace(tMethod, rMethod);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed toggleLockSheet again!');
