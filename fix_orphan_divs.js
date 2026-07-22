const fs = require('fs');
const filePath = 'C:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts';
let content = fs.readFileSync(filePath, 'utf-8');
const regex = /<\/div>\s*<div style="margin-bottom: 16px;">[\s\S]*?<\/div>\s*<\/div>\s*<!-- Shared Color Picker Popover -->/;
if (regex.test(content)) {
  content = content.replace(regex, '</div>\n\n      <!-- Shared Color Picker Popover -->');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Fixed orphan div block');
} else {
  console.log('Regex did not match');
}
