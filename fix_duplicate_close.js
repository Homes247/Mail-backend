const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const closeBtnStr = `<span class="material-symbols-outlined" style="cursor:pointer;color:#5f6368;" (click)="activeModal=null">close</span>`;
content = content.replace(closeBtnStr, '');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Removed duplicate close button!');
