const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. activeModal type
content = content.replace(/activeModal: 'template'[\s\S]*?\| null = null;/, `activeModal: 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | 'form' | 'view_form' | 'manage_forms' | 'macro' | 'edit_macro' | 'functions' | 'merge' | 'goto' | 'shortcuts' | 'insert_sparkline' | 'edit_sparkline' | null = null;`);

// 2. closeApp() call in sheet-editor.component.ts
content = content.replace(/this\.closeApp\(\);/g, 'this.sidePanelApp = null;');

// 3. key = syntax error
content = content.replace(/const config = sheet\.sparklines!\[key = `\$\{r\},\$\{c\}`\];/g, 'const config = sheet.sparklines![`${r},${c}`];');

// 4. Object.keys
content = content.replace(/for \(const k of Object\.keys\(sheet\.sparklines\)\) \{/g, 'for (const k of Object.keys(sheet.sparklines || {})) {');

// 5. possibly undefined sheet.sparklines[k]
content = content.replace(/sheet\.sparklines\[k\]/g, 'sheet.sparklines![k]');

// 6. Duplicate parseCellRef
// We'll replace the bad parseCellRef block with nothing
const badParseCellRefRegex = /  parseCellRef\(ref: string\) \{\n    const m = ref\.match\(\/\^\(\[A-Za-z\]\+\)\(d\+\)\$\/\);\n    if \(!m\) return null;\n    \n    let c = 0;\n    const colStr = m\[1\]\.toUpperCase\(\);\n    for \(let i = 0; i < colStr\.length; i\+\+\) \{\n      c = c \* 26 \+ \(colStr\.charCodeAt\(i\) - 64\);\n    \}\n    c -= 1;\n    \n    return \{ r: parseInt\(m\[2\], 10\) - 1, c \};\n  \}\n/g;

content = content.replace(badParseCellRefRegex, '');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed typescript errors!');
