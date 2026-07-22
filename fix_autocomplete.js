const fs = require('fs');
const filePath = 'C:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts';
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(/<input type="text" \[\(ngModel\)\]="insertSparklineConfig\.source"/g, '<input type="text" autocomplete="off" spellcheck="false" [(ngModel)]="insertSparklineConfig.source"');
content = content.replace(/<input type="text" \[\(ngModel\)\]="insertSparklineConfig\.dest"/g, '<input type="text" autocomplete="off" spellcheck="false" [(ngModel)]="insertSparklineConfig.dest"');
content = content.replace(/<input type="text" \[\(ngModel\)\]="editSparklineConfig\.dest"/g, '<input type="text" autocomplete="off" spellcheck="false" [(ngModel)]="editSparklineConfig.dest"');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed autocomplete');
