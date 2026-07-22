const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const oldLine = "style['background-image'] = 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05), rgba(0,0,0,0.05) 10px, transparent 10px, transparent 20px)';";
const newLine = "style['background-image'] = 'repeating-linear-gradient(45deg, rgba(255, 165, 0, 0.2), rgba(255, 165, 0, 0.2) 10px, transparent 10px, transparent 20px)';";

content = content.replace(oldLine, newLine);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed lock color!');
