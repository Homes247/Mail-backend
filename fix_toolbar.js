const fs = require('fs');
const filePath = 'C:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// HTML Toolbar
const searchHtml = '<button class="tb" (click)="insertComment()" title="Insert Comment"><span class="material-symbols-outlined">comment</span></button>';
const replaceHtml = '<button class="tb" (click)="insertComment()" title="Insert Comment"><span class="material-symbols-outlined">comment</span></button>\n        <button class="tb" (click)="openSparklineFormat()" title="Sparkline Format"><span class="material-symbols-outlined">stacked_line_chart</span></button>';
content = content.replace(searchHtml, replaceHtml);

// TS Method
const searchTs = '  submitInsertSparkline() {';
const replaceTs = '  openSparklineFormat() {\n    const config = this.sheets[this.currentSheetIdx].sparklines![${this.selectedRow},];\n    if (config) {\n      this.sparklineConfig = JSON.parse(JSON.stringify(config));\n      this.sidePanelApp = \'sparkline\';\n    } else {\n      this.showToast(\'Select a cell containing a sparkline first.\');\n    }\n  }\n\n  submitInsertSparkline() {';
content = content.replace(searchTs, replaceTs);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed toolbar');
