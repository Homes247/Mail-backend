const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regexStubs = /  shiftCellsLeft\(\) \{ this\.showToast\('Shift Cells Left not implemented'\); \}\r?\n  shiftCellsUp\(\) \{ this\.showToast\('Shift Cells Up not implemented'\); \}\r?\n  customInsertRow\(\) \{ this\.showToast\('Custom Insert Row not implemented'\); \}\r?\n/s;

const newMethods = `  shiftCellsLeft() {
    this.pushHistory();
    const r = this.selectedRow;
    const c = this.selectedCol;
    for (let i = c; i < this.COLS - 1; i++) {
      this.cells[r][i] = this.cells[r][i + 1];
      const nextFmt = this.formats[\`\${r},\${i + 1}\`];
      if (nextFmt) {
        this.formats[\`\${r},\${i}\`] = { ...nextFmt };
      } else {
        delete this.formats[\`\${r},\${i}\`];
      }
    }
    this.cells[r][this.COLS - 1] = '';
    delete this.formats[\`\${r},\${this.COLS - 1}\`];
    this.onCellChange();
    this.closeMenus();
    this.showToast('Shifted cells left.');
  }

  shiftCellsUp() {
    this.pushHistory();
    const r = this.selectedRow;
    const c = this.selectedCol;
    for (let i = r; i < this.ROWS - 1; i++) {
      this.cells[i][c] = this.cells[i + 1][c];
      const nextFmt = this.formats[\`\${i + 1},\${c}\`];
      if (nextFmt) {
        this.formats[\`\${i},\${c}\`] = { ...nextFmt };
      } else {
        delete this.formats[\`\${i},\${c}\`];
      }
    }
    this.cells[this.ROWS - 1][c] = '';
    delete this.formats[\`\${this.ROWS - 1},\${c}\`];
    this.onCellChange();
    this.closeMenus();
    this.showToast('Shifted cells up.');
  }

  async customInsertRow() {
    this.closeMenus();
    const numStr = await this.openPrompt('How many rows to insert?', '1');
    if (!numStr) return;
    const count = parseInt(numStr, 10);
    if (isNaN(count) || count <= 0) return;
    this.pushHistory();
    const r = this.selectedRow;
    for (let i = 0; i < count; i++) {
      this.cells.splice(r, 0, Array(this.COLS).fill(''));
    }
    this.ROWS += count;
    this.rowRange = Array.from({ length: this.ROWS }, (_, i) => i);
    this.onCellChange();
    this.showToast(\`Inserted \${count} rows\`);
  }
`;

content = content.replace(regexStubs, newMethods);

const regexCustomCol = /async customInsertCol\(\) \{[\s\S]*?row\.pop\(\); \/\/ Maintain column count\s+\}\s+\}\s+this\.onCellChange\(\);\s+this\.showToast\(`Inserted \$\{count\} columns`\);\s+\}/;

const newCustomCol = `async customInsertCol() {
    this.closeMenus();
    const numStr = await this.openPrompt('How many columns to insert?', '1');
    if (!numStr) return;
    const count = parseInt(numStr, 10);
    if (isNaN(count) || count <= 0) return;
    this.pushHistory();
    const c = this.selectedCol;
    this.COLS += count;
    for (const row of this.cells) {
      for (let i = 0; i < count; i++) {
        row.splice(c, 0, '');
      }
    }
    this.colRange = Array.from({ length: this.COLS }, (_, i) => i);
    this.onCellChange();
    this.showToast(\`Inserted \${count} columns\`);
  }`;

content = content.replace(regexCustomCol, newCustomCol);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Implemented missing actions!');
