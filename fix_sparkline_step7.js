const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /getSparklineData\([\s\S]*?return this\.sanitizer\.bypassSecurityTrustHtml\(svg\);\n  \}/;

const newSvgLogic = `getSparklineData(rangeStr: string, includeHidden = false) {
    const range = this.parseRange(rangeStr);
    if (!range) return { values: [], hasNumbers: false };
    
    // Support parsing across sheets if specified, currently default to current sheet
    const targetSheetIdx = this.sheets.findIndex(s => s.name === range.sheetName) !== -1 ? this.sheets.findIndex(s => s.name === range.sheetName) : this.currentSheetIdx;
    const targetSheet = this.sheets[targetSheetIdx];
    
    let values = [];
    let hasNumbers = false;
    
    for (let r = range.startR; r <= range.endR; r++) {
       if (!includeHidden && targetSheet.hiddenRows && targetSheet.hiddenRows.includes(r)) continue;
       for (let c = range.startC; c <= range.endC; c++) {
          // Assume columns are not hidden for now since col hidden is not implemented fully in Sheet model yet
          const cellStr = targetSheet.cells[r]?.[c] || '';
          const cleanStr = cellStr.toString().trim();
          if (cleanStr === '') {
             values.push(null);
          } else {
             const num = Number(cleanStr);
             if (!isNaN(num)) {
                values.push(num);
                hasNumbers = true;
             } else {
                values.push(null);
             }
          }
       }
    }
    
    return { values, hasNumbers };
  }

  getSparklineSvgSafe(r: number, c: number): any {
    const sheet = this.sheets[this.currentSheetIdx];
    const config = sheet.sparklines![key = \`\${r},\${c}\`];
    if (!config) return '';

    const data = this.getSparklineData(config.sourceRange || '', config.includeHiddenRowsColumns);

    if (!data.hasNumbers) {
      return this.sanitizer.bypassSecurityTrustHtml(\`<span style="color:#ef4444;font-size:10px;font-weight:bold;">#ERROR!</span>\`);
    }

    let rawValues = data.values;
    if (config.emptyCellMode === 'skip') {
      rawValues = rawValues.filter(v => v !== null);
    } else if (config.emptyCellMode === 'zero') {
      rawValues = rawValues.map(v => v === null ? 0 : v);
    }

    if (rawValues.filter(v => v !== null).length < 2 && config.type === 'line') {
       // Single points can be drawn as bar/winloss but not line
      return this.sanitizer.bypassSecurityTrustHtml(\`<span style="color:#ef4444;font-size:10px;font-weight:bold;">#ERROR!</span>\`);
    }

    const w = this.getColWidth(c);
    const h = this.getRowHeight(r);
    const padX = 2;
    const padY = 4;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;

    let svg = \`<svg width="\${w}" height="\${h}" viewBox="0 0 \${w} \${h}" preserveAspectRatio="none" style="display:block;">\`;

    // Calculate Y domain
    let globalMin = Infinity, globalMax = -Infinity;
    
    // Group logic for min/max
    if (config.isGrouped && config.groupId) {
       for (const k of Object.keys(sheet.sparklines)) {
         if (sheet.sparklines[k].groupId === config.groupId) {
            const grpData = this.getSparklineData(sheet.sparklines[k].sourceRange || '', config.includeHiddenRowsColumns);
            const grpNums = grpData.values.filter(v => v !== null) as number[];
            if (grpNums.length > 0) {
               globalMin = Math.min(globalMin, ...grpNums);
               globalMax = Math.max(globalMax, ...grpNums);
            }
         }
       }
    }
    
    const localNums = rawValues.filter(v => v !== null) as number[];
    let min = Math.min(...localNums);
    let max = Math.max(...localNums);
    
    if (config.verticalAxis.min.mode === 'same' && globalMin !== Infinity) min = globalMin;
    if (config.verticalAxis.max.mode === 'same' && globalMax !== -Infinity) max = globalMax;
    
    if (config.verticalAxis.min.mode === 'custom' && config.verticalAxis.min.customValue !== null) min = config.verticalAxis.min.customValue;
    if (config.verticalAxis.max.mode === 'custom' && config.verticalAxis.max.customValue !== null) max = config.verticalAxis.max.customValue;
    
    const rangeVal = max - min || 1;

    // Highlights detection
    let firstIdx = -1, lastIdx = -1, highIdx = -1, lowIdx = -1;
    let currentHigh = -Infinity, currentLow = Infinity;

    for (let i = 0; i < rawValues.length; i++) {
      const v = rawValues[i];
      if (v !== null) {
        if (firstIdx === -1) firstIdx = i;
        lastIdx = i;
        if (v > currentHigh) { currentHigh = v; highIdx = i; }
        if (v < currentLow) { currentLow = v; lowIdx = i; }
      }
    }

    const hl = config.highlights;
    const getColor = (i: number, val: number) => {
      // Precedence: Negative > High/Low > First/Last > Base
      if (val < 0 && hl.negative.enabled) return hl.negative.color;
      if (i === highIdx && hl.high.enabled) return hl.high.color;
      if (i === lowIdx && hl.low.enabled) return hl.low.color;
      if (i === firstIdx && hl.first.enabled) return hl.first.color;
      if (i === lastIdx && hl.last.enabled) return hl.last.color;
      return config.baseColor;
    };

    let ptsX = (i: number) => padX + (i / (rawValues.length - 1)) * innerW;
    if (config.horizontalAxis.rightToLeft) {
       ptsX = (i: number) => padX + innerW - (i / (rawValues.length - 1)) * innerW;
    }
    const ptsY = (val: number) => padY + innerH - ((val - min) / rangeVal) * innerH;

    // Display Axis
    if (config.horizontalAxis.displayAxis && min < 0 && max > 0) {
       const zeroY = ptsY(0);
       svg += \`<line x1="\${padX}" y1="\${zeroY}" x2="\${padX + innerW}" y2="\${zeroY}" stroke="#000" stroke-width="1" opacity="0.5"/>\`;
    }

    if (config.type === 'line') {
      let pathD = '';
      let isFirstInSegment = true;
      for (let i = 0; i < rawValues.length; i++) {
         if (rawValues[i] === null) {
            if (config.emptyCellMode === 'gap') {
               isFirstInSegment = true;
            }
            // If 'connect', do nothing, next valid point will just line-to
            continue;
         }
         
         const x = ptsX(i);
         const y = ptsY(rawValues[i] as number);
         
         if (isFirstInSegment) {
            pathD += \`M \${x} \${y} \`;
            isFirstInSegment = false;
         } else {
            pathD += \`L \${x} \${y} \`;
         }
      }
      if (pathD) {
         svg += \`<path d="\${pathD}" fill="none" stroke="\${config.baseColor}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>\`;
      }
      
      // Markers
      for (let i = 0; i < rawValues.length; i++) {
         const val = rawValues[i];
         if (val === null) continue;
         const x = ptsX(i);
         const y = ptsY(val);
         
         const isHighlighted = (hl.negative.enabled && val < 0) || (hl.high.enabled && i === highIdx) || (hl.low.enabled && i === lowIdx) || (hl.first.enabled && i === firstIdx) || (hl.last.enabled && i === lastIdx);
         
         if (isHighlighted || hl.markers.enabled) {
            const color = getColor(i, val);
            svg += \`<circle cx="\${x}" cy="\${y}" r="2" fill="\${color}"/>\`;
         }
      }
    } else if (config.type === 'column') {
      const barW = Math.max(1, (innerW / rawValues.length) - 1);
      const zeroY = ptsY(Math.max(Math.min(0, max), min));
      
      for (let i = 0; i < rawValues.length; i++) {
         const val = rawValues[i];
         if (val === null) continue;
         const x = ptsX(i) - (config.horizontalAxis.rightToLeft ? 0 : barW/2);
         const y = ptsY(val);
         
         const barY = Math.min(y, zeroY);
         const barH = Math.abs(y - zeroY);
         const color = getColor(i, val);
         
         svg += \`<rect x="\${x}" y="\${barY}" width="\${barW}" height="\${Math.max(1, barH)}" fill="\${color}"/>\`;
      }
    } else if (config.type === 'winloss') {
      const barW = Math.max(1, (innerW / rawValues.length) - 1);
      const midY = padY + innerH / 2;
      const fixH = (innerH / 2) * 0.8; 
      
      for (let i = 0; i < rawValues.length; i++) {
         const val = rawValues[i];
         if (val === null) continue;
         const x = ptsX(i) - (config.horizontalAxis.rightToLeft ? 0 : barW/2);
         const isWin = val > 0;
         
         const barY = isWin ? midY - fixH : midY;
         // Precedence for winloss: Negative highlight vs High highlight
         let color = config.baseColor;
         if (!isWin && hl.negative.enabled) color = hl.negative.color;
         else if (isWin && hl.high.enabled) color = hl.high.color;
         
         svg += \`<rect x="\${x}" y="\${barY}" width="\${barW}" height="\${fixH}" fill="\${color}"/>\`;
      }
      
      // Zero axis line for winloss
      svg += \`<line x1="\${padX}" y1="\${midY}" x2="\${padX + innerW}" y2="\${midY}" stroke="#000" stroke-width="0.5" opacity="0.3"/>\`;
    }

    svg += '</svg>';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }`;

content = content.replace(regex, newSvgLogic);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done SVG logic!');
