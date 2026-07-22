const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /<!-- Negative -->[\s\S]*?<\/ng-container>/;
content = content.replace(regex, '');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done part 2!');
