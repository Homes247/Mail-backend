const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const editSaveRegex = /editSparkline\(\) \{[\s\S]*?deleteSparklineConfig\(\) \{[\s\S]*?\n  \}/;

const newEditSave = `editSparkline() {
    this.closeMenus();
    const sheet = this.sheets[this.currentSheetIdx];
    const key = \`\${this.selectedRow},\${this.selectedCol}\`;
    if (sheet.sparklines && sheet.sparklines[key]) {
      this.sparklineConfig = JSON.parse(JSON.stringify(sheet.sparklines[key]));
      this.openApp('sparkline');
    } else {
      this.showToast('Selected cell does not contain a sparkline.');
    }
  }

  saveSparkline() {
    if (!this.sparklineConfig) return;
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.sparklines) sheet.sparklines = {};
    
    // Save live changes to the sparkline or group
    const isGrouped = this.sparklineConfig.isGrouped;
    const groupId = this.sparklineConfig.groupId;
    
    if (isGrouped && groupId) {
       for (const key of Object.keys(sheet.sparklines)) {
         if (sheet.sparklines[key].groupId === groupId) {
            const dest = sheet.sparklines[key].destinationRange;
            const src = sheet.sparklines[key].sourceRange;
            sheet.sparklines[key] = JSON.parse(JSON.stringify(this.sparklineConfig));
            // Restore unique source/dest for each in group
            sheet.sparklines[key].destinationRange = dest;
            sheet.sparklines[key].sourceRange = src;
         }
       }
    } else {
       // Single
       const key = \`\${this.selectedRow},\${this.selectedCol}\`;
       const dest = sheet.sparklines[key]?.destinationRange || \`\${this.colLabel(this.selectedCol)}\${this.selectedRow + 1}\`;
       const src = sheet.sparklines[key]?.sourceRange || this.sparklineConfig.sourceRange;
       sheet.sparklines[key] = JSON.parse(JSON.stringify(this.sparklineConfig));
       sheet.sparklines[key].destinationRange = dest;
       sheet.sparklines[key].sourceRange = src;
    }
    
    this.save();
  }
  
  deleteSparklineConfig() {
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.sparklines || !this.sparklineConfig) return;
    
    if (this.sparklineConfig.isGrouped && this.sparklineConfig.groupId) {
       for (const key of Object.keys(sheet.sparklines)) {
         if (sheet.sparklines[key].groupId === this.sparklineConfig.groupId) {
            delete sheet.sparklines[key];
         }
       }
    } else {
       const key = \`\${this.selectedRow},\${this.selectedCol}\`;
       delete sheet.sparklines[key];
    }
    
    this.sparklineConfig = null as any;
    this.closeApp();
    this.save();
  }`;

content = content.replace(editSaveRegex, newEditSave);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done edit/save sparkline logic!');
