const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /  shiftCellsRight\(\) \{ this\.showToast\('Shift Cells Right not implemented'\); \}\r?\n  shiftCellsDown\(\) \{ this\.showToast\('Shift Cells Down not implemented'\); \}\r?\n  shiftCellsLeft\(\) \{ this\.showToast\('Shift Cells Left not implemented'\); \}\r?\n  shiftCellsUp\(\) \{ this\.showToast\('Shift Cells Up not implemented'\); \}\r?\n  customInsertRow\(\) \{ this\.showToast\('Custom Insert Row not implemented'\); \}\r?\n  customInsertCol\(\) \{ this\.showToast\('Custom Insert Column not implemented'\); \}\r?\n/s;

const replacement = `  shiftCellsLeft() { this.showToast('Shift Cells Left not implemented'); }
  shiftCellsUp() { this.showToast('Shift Cells Up not implemented'); }
  customInsertRow() { this.showToast('Custom Insert Row not implemented'); }
`;

content = content.replace(regex, replacement);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Removed duplicate stubs!');
