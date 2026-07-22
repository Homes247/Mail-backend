const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. activeModal type
content = content.replace(/activeModal: 'form' \| 'template'[\s\S]*?\| null = null;/, `activeModal: 'form' | 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | 'view_form' | 'manage_forms' | 'macro' | 'edit_macro' | 'functions' | 'merge' | 'goto' | 'shortcuts' | 'insert_sparkline' | 'edit_sparkline' | null = null;`);

// 2. closeApp -> sidePanelApp = null
content = content.replace(/\(click\)="closeApp\(\)"/g, '(click)="sidePanelApp = null"');

// 3. getSparklineSvgSafe syntax errors
content = content.replace(/const config = sheet\.sparklines!\[key = `\$\{r\},\$\{c\}`\];/, 'const config = sheet.sparklines![`${r},${c}`];');
content = content.replace(/for \(const k of Object\.keys\(sheet\.sparklines\)\) \{/g, 'for (const k of Object.keys(sheet.sparklines || {})) {');

// 4. Duplicate parseCellRef
// Let's remove the second parseCellRef.
// The second one was added around line 13344 maybe?
content = content.replace(/  parseCellRef\(ref: string\): \{ r: number, c: number \} \| null \{\n    const match = ref\.match\(\/([A-Z]+)(\d+)\/\);\n    if \(!match\) return null;\n    const cStr = match\[1\];\n    const rStr = match\[2\];\n    let c = 0;\n    for \(let i = 0; i < cStr\.length; i\+\+\) \{\n      c = c \* 26 \+ \(cStr\.charCodeAt\(i\) - 64\);\n    \}\n    return \{ r: parseInt\(rStr\) - 1, c: c - 1 \};\n  \}\n\n/, '');

// 5. Old Sparkline HTML that might have been left over
// Let's find if there is any 'negativeColor' left in the template
const oldSparklineSettingsRegex = /<!--\s*Markers\s*\(Line\s*only\)\s*-->[\s\S]*?<\/ng-container>/g;
// Wait, my previous regex was /<\!--  SPARKLINE  -->[\s\S]*?<\/ng-container>/
// Maybe it only replaced the first occurrence or didn't replace the whole thing if there were multiple ng-containers.
// Let's check what's in the file around line 2324.
