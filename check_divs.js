const fs = require('fs');
const filePath = 'C:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts';
const content = fs.readFileSync(filePath, 'utf-8');
const match = content.match(/template: `([\s\S]*?)`,\n  styles: \[/);
if (match) {
  const tmpl = match[1];
  let depth = 0;
  const lines = tmpl.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Very naive, doesn't account for HTML comments or attributes containing <div
    let cleaned = line.replace(/<!--.*?-->/g, '');
    const opens = (cleaned.match(/<div\b[^>]*>/g) || []).length;
    const closes = (cleaned.match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (depth < 0) {
      console.log('Negative depth at line', i + 1, 'Content:', line.trim());
      depth = 0; // reset to keep finding
    }
  }
  console.log('Final depth:', depth);
} else {
  console.log('Template not found');
}
