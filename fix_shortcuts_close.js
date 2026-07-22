const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /<h3 style="margin:0;font-size:18px;font-weight:600;" \[style\.color\]="currentTheme === 'dark' \? '#e8eaed' : '#202124'">Keyboard Shortcuts<\/h3>\s*<span class="material-symbols-outlined" style="cursor:pointer;color:#5f6368;" \(click\)="activeModal=null">close<\/span>/s;

content = content.replace(regex, `<h3 style="margin:0;font-size:18px;font-weight:600;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#202124'">Keyboard Shortcuts</h3>`);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Removed duplicate close button in shortcuts modal!');
