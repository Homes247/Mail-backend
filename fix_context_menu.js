const fs = require('fs');
const filePath = 'C:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const search = '<div class="ctx-item" (click)="sortColZA(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">sort</span> Sort Z to A</div>\n        <div class="ctx-sep"></div>';
const replace = '<div class="ctx-item" (click)="sortColZA(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">sort</span> Sort Z to A</div>\n        <div class="ctx-sep"></div>\n        <div class="ctx-item" (click)="openSparklineFormat(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">stacked_line_chart</span> Sparkline Format</div>';

content = content.replace(search, replace);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed context menu');
