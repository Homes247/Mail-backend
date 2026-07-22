const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');
content = content.replace(/\r\n/g, '\n');

const t1 = `                  <div class="mdi" (click)="lockSelectedRange(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">lock_open</span> Lock Cells...
                  </div>`;
const r1 = `                  <div class="mdi" (click)="lockSelectedRange(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">{{ isSelectionLocked() ? 'lock_open' : 'lock' }}</span>
                    {{ isSelectionLocked() ? 'Unlock Cells...' : 'Lock Cells...' }}
                  </div>`;
content = content.replace(t1, r1);

const t2 = `                <div class="mdi" (click)="lockSelectedRange(); closeMenus()">Lock Cells...</div>`;
const r2 = `                <div class="mdi" (click)="lockSelectedRange(); closeMenus()">{{ isSelectionLocked() ? 'Unlock Cells...' : 'Lock Cells...' }}</div>`;
content = content.replace(t2, r2);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('UI Changes applied!');
