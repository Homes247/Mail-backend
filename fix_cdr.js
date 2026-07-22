const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace('if (this.cd) this.cd.detectChanges();', 'if (this.cdr) this.cdr.detectChanges();');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed cdr!');
