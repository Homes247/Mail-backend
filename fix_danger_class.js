const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /<div class="ctx-item danger" \(click\)="shiftCellsLeft\(\); hideCtx\(\)">Shift Cells Left<\/div>\s*<div class="ctx-item danger" \(click\)="shiftCellsUp\(\); hideCtx\(\)">Shift Cells Up<\/div>/s;
content = content.replace(regex, `<div class="ctx-item" (click)="shiftCellsLeft(); hideCtx()">Shift Cells Left</div>
            <div class="ctx-item" (click)="shiftCellsUp(); hideCtx()">Shift Cells Up</div>`);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed danger class!');
