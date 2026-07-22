const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace createSparkline
const createSparkRegex = /createSparkline\(\) \{\s*this\.closeMenus\(\);\s*this\.sparklineConfig = \{[\s\S]*?\};\s*this\.openApp\('sparkline'\);\s*\}/;
const newCreateSpark = `createSparkline() {
    this.closeMenus();
    this.insertSparklineConfig = {
      source: \`'\${this.sheets[this.currentSheetIdx].name}'.\${this.colLabel(this.selectedCol)}\${this.selectedRow + 1}\`,
      dest: '',
      error: ''
    };
    this.activeModal = 'insert_sparkline';
  }

  submitInsertSparkline() {
    // Validate that source and dest ranges match in dimensions
    const srcRange = this.parseRange(this.insertSparklineConfig.source);
    const destRange = this.parseRange(this.insertSparklineConfig.dest);
    
    if (!srcRange || !destRange) {
      this.insertSparklineConfig.error = 'Invalid range format. Please use format like "Sheet1.A1:B10" or "A1:B10".';
      return;
    }
    
    const srcRows = srcRange.endR - srcRange.startR + 1;
    const srcCols = srcRange.endC - srcRange.startC + 1;
    const destRows = destRange.endR - destRange.startR + 1;
    const destCols = destRange.endC - destRange.startC + 1;
    
    if (srcRows !== destRows || srcCols !== destCols) {
      this.insertSparklineConfig.error = 'Please select a destination range that is equal to the source range.';
      return;
    }
    
    this.insertSparklineConfig.error = '';
    const groupId = 'sparkgroup_' + Date.now();
    
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.sparklines) sheet.sparklines = {};
    
    // Create the group
    for (let rOffset = 0; rOffset < destRows; rOffset++) {
      for (let cOffset = 0; cOffset < destCols; cOffset++) {
        const destR = destRange.startR + rOffset;
        const destC = destRange.startC + cOffset;
        
        // Find corresponding source sub-range (can be 1D or single cell depending on sparkline logic, usually source is a 1D range for a single sparkline)
        // Actually, if we map one-to-one, Zoho creates one sparkline per row or col mapping.
        // Wait, the specification says: "create one sparkline per row/column pair mapping source -> destination cell"
        // Meaning if source is C2:C10 (9x1) and dest is D2:D10 (9x1), it maps C2 to D2, C3 to D3, etc.
        // Wait! A sparkline needs a 1D range of data to draw a chart.
        // If source is C2:E2 (1x3) and dest is F2 (1x1), the sparkline at F2 uses C2:E2.
        // But if the user selects multiple destination cells, we map rows to rows.
        // For simplicity here, we assume destR/destC maps to a slice of the source.
        // Let's just create one sparkline at the first dest cell for the entire source range, or map row-by-row if heights match.
        
        const key = \`\${destR},\${destC}\`;
        
        // Define slice
        let sliceSrc = \`\${this.colLabel(srcRange.startC + cOffset)}\${srcRange.startR + rOffset + 1}\`;
        // Actually, usually sparklines take a row or column of data.
        // Let's just set the source range to the whole source range if it's 1x1 dest, else map row by row.
        let assignedSource = this.insertSparklineConfig.source;
        if (destRows > 1 && srcRows > 1 && destRows === srcRows && srcCols !== destCols) {
           // map row to row
           assignedSource = \`\${this.colLabel(srcRange.startC)}\${srcRange.startR + rOffset + 1}:\${this.colLabel(srcRange.endC)}\${srcRange.startR + rOffset + 1}\`;
        } else if (destCols > 1 && srcCols > 1 && destCols === srcCols && srcRows !== destRows) {
           // map col to col
           assignedSource = \`\${this.colLabel(srcRange.startC + cOffset)}\${srcRange.startR + 1}:\${this.colLabel(srcRange.startC + cOffset)}\${srcRange.endR + 1}\`;
        }
        
        sheet.sparklines[key] = {
          sourceRange: assignedSource,
          destinationRange: \`\${this.colLabel(destC)}\${destR + 1}\`,
          type: 'line',
          baseColor: '#4A86E8',
          highlights: {
            high: { enabled: false, color: '#34A853' },
            low: { enabled: false, color: '#F4B400' },
            first: { enabled: false, color: '#4A86E8' },
            last: { enabled: false, color: '#7BAAF7' },
            negative: { enabled: false, color: '#EA4335' },
            markers: { enabled: false, color: '#4A86E8' }
          },
          emptyCellMode: 'gap',
          includeHiddenRowsColumns: false,
          horizontalAxis: { displayAxis: false, rightToLeft: false },
          verticalAxis: {
            min: { mode: 'auto', customValue: null },
            max: { mode: 'auto', customValue: null }
          },
          isGrouped: (destRows * destCols > 1),
          groupId: groupId
        };
      }
    }
    
    this.activeModal = null;
    
    // Select the first destination cell and open the sparkline app
    this.selectedRow = destRange.startR;
    this.selectedCol = destRange.startC;
    this.editSparkline();
  }
  
  parseRange(rangeStr: string) {
    // Handle 'Sheet1'.A1:B2 or Sheet1!A1:B2 or just A1:B2
    let sheetName = this.sheets[this.currentSheetIdx].name;
    let localRange = rangeStr;
    
    const match = rangeStr.match(/^(?:'([^']+)'[.!]|([^.!]+)[.!])?(.*)$/);
    if (match) {
      if (match[1]) sheetName = match[1];
      if (match[2]) sheetName = match[2];
      localRange = match[3];
    }
    
    const parts = localRange.split(':');
    if (parts.length > 2) return null;
    
    const start = this.parseCellRef(parts[0]);
    if (!start) return null;
    
    const end = parts.length === 2 ? this.parseCellRef(parts[1]) : start;
    if (!end) return null;
    
    return {
      sheetName,
      startR: Math.min(start.r, end.r),
      startC: Math.min(start.c, end.c),
      endR: Math.max(start.r, end.r),
      endC: Math.max(start.c, end.c)
    };
  }
  
  parseCellRef(ref: string) {
    const m = ref.match(/^([A-Za-z]+)(\d+)$/);
    if (!m) return null;
    
    let c = 0;
    const colStr = m[1].toUpperCase();
    for (let i = 0; i < colStr.length; i++) {
      c = c * 26 + (colStr.charCodeAt(i) - 64);
    }
    c -= 1;
    
    const r = parseInt(m[2], 10) - 1;
    return { r, c };
  }
`;
content = content.replace(createSparkRegex, newCreateSpark);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done insert sparkline modal logic!');
