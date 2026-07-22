const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /<tr style="border-bottom: 1px solid \{\{ currentTheme === 'dark' \? '#5f6368' : '#e0e0e0' \}\};">\s*<td style="padding: 12px 16px;">Homes247\.in Bug Tracker<\/td>.*?<\/tr>/s;

content = content.replace(regex, `<tr><td colspan="5" style="padding: 24px; text-align: center; color: #888; font-style: italic;">No forms created yet.</td></tr>`);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Removed dummy form row and added empty state message!');
