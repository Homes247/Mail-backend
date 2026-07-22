const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const t = `    if (this.showLockPattern && fmt.locked) {
      style['background-image'] = 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 10px, transparent 10px, transparent 20px)';
    }`;
const r = `    if (this.showLockPattern && (fmt as any).locked) {
      style['background-image'] = 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 10px, transparent 10px, transparent 20px)';
    }`;
content = content.replace(t, r);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed TS compilation error!');
