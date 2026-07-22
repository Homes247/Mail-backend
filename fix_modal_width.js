const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const oldParentStyle = `[style.width]="activeModal === 'version' ? '1200px' : (activeModal === 'audit' ? '620px' : '460px')"`;
const newParentStyle = `[style.width]="activeModal === 'version' ? '1200px' : (activeModal === 'audit' ? '620px' : (activeModal === 'manage_forms' ? '748px' : (activeModal === 'shortcuts' ? '548px' : '460px')))"`;

content = content.replace(oldParentStyle, newParentStyle);

// Let's also fix the inner div of shortcuts to be width 100% so it fits properly
const oldShortcutsDiv = `<div *ngIf="activeModal === 'shortcuts'" style="width: 500px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column;">`;
const newShortcutsDiv = `<div *ngIf="activeModal === 'shortcuts'" style="width: 100%; max-height: 80vh; display: flex; flex-direction: column;">`;

content = content.replace(oldShortcutsDiv, newShortcutsDiv);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed modal widths!');
