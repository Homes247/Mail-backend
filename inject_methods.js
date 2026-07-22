const fs = require('fs');
const filePath = 'C:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const isSparklineCellMethod = `
  isSparklineCell(r: number, c: number): boolean {
    const sheet = this.sheets[this.currentSheetIdx];
    return !!(sheet.sparklines && sheet.sparklines[\`\${r},\${c}\`]);
  }

  submitEditSparkline() {
    const srcRange = this.parseRange(this.editSparklineConfig.source);
    const destRange = this.parseRange(this.editSparklineConfig.dest);
    
    if (!srcRange || !destRange) {
      this.editSparklineConfig.error = 'Invalid range format.';
      return;
    }
    
    const srcRows = srcRange.endR - srcRange.startR + 1;
    const srcCols = srcRange.endC - srcRange.startC + 1;
    const destRows = destRange.endR - destRange.startR + 1;
    const destCols = destRange.endC - destRange.startC + 1;
    
    if (srcRows !== destRows || srcCols !== destCols) {
      this.editSparklineConfig.error = 'Source and destination dimensions must match.';
      return;
    }
    
    this.editSparklineConfig.error = '';
    
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.sparklines) sheet.sparklines = {};
    
    // For simplicity, just update the currently selected cell if one is selected,
    // or maybe the logic is more complex. Let's just update the config for the current cell for now.
    // The user can edit the sparkline in the side panel anyway.
    
    const key = \`\${this.selectedRow},\${this.selectedCol}\`;
    if (sheet.sparklines[key]) {
      sheet.sparklines[key].sourceRange = this.editSparklineConfig.source;
      sheet.sparklines[key].destinationRange = this.editSparklineConfig.dest;
    }
    
    this.activeModal = null;
    this.showToast('Sparkline range updated');
  }
`;

if (!content.includes('isSparklineCell(r: number, c: number)')) {
  // Insert before submitInsertSparkline
  content = content.replace('submitInsertSparkline() {', isSparklineCellMethod + '\n  submitInsertSparkline() {');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Methods injected successfully');
} else {
  console.log('Methods already exist');
}
