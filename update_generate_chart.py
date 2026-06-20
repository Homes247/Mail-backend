import sys

file_path = 'frontend/src/app/pages/doc-editor/doc-editor.component.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find generateAndInsertChart
start_idx = -1
for i, l in enumerate(lines):
    if 'generateAndInsertChart()' in l:
        start_idx = i
        break

end_idx = -1
for i in range(start_idx, len(lines)):
    if 'svg += `</svg>`;' in lines[i]:
        end_idx = i + 1
        break

replacement = """  generateAndInsertChart() {
    let parsedSeries: {x: number, y: number}[][] = [];
    if (this.chartValues.includes('|')) {
       parsedSeries = this.chartValues.split('|').map(seriesStr => {
           const vals = seriesStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
           return vals.map((v, i) => ({x: i, y: v}));
       });
    } else if (this.chartValues.includes(';')) {
      const parsedVals = this.chartValues.split(';').map(p => {
        const parts = p.split(',').map(n => parseFloat(n.trim()));
        return {x: parts[0] || 0, y: parts[1] || 0};
      });
      parsedSeries = [parsedVals];
    } else {
      const vals = this.chartValues.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      parsedSeries = [vals.map((v, i) => ({x: i, y: v}))];
    }
    
    if (parsedSeries.length === 0 || parsedSeries[0].length === 0) {
      alert('Please enter valid data values.');
      return;
    }

    const yVals = parsedSeries.flat().map(p => p.y);
    const xVals = parsedSeries.flat().map(p => p.x);
    
    const xLabelsStr = this.chartXLabels.split(',').map(l => l.trim());
    const yLabelsStr = this.chartYLabels.split(',').map(l => l.trim());
    const seriesNames = this.chartSeriesNames ? this.chartSeriesNames.split(',').map(s => s.trim()) : [];
    
    const yLabelNums = yLabelsStr.map(l => parseFloat(l)).filter(n => !isNaN(n));
    const xLabelNums = xLabelsStr.map(l => parseFloat(l)).filter(n => !isNaN(n));
    
    const maxY = yLabelNums.length > 0 ? Math.max(...yLabelNums, Math.max(...yVals, 1)) : Math.max(...yVals, 1);
    const maxX = xLabelNums.length > 0 ? Math.max(...xLabelNums, Math.max(...xVals, 1)) : (this.chartValues.includes(';') ? Math.max(...xVals, 1) : Math.max(parsedSeries[0].length - 1, 1));

    const width = 500;
    const height = 300;
    const colors = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#673ab7', '#ff9800'];

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border:1px solid #ccc; border-radius: 4px;">`;
    svg += `<text x="${width / 2}" y="30" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle" fill="#202124">${this.chartTitle}</text>`;

    const axisX = 60; 
    const axisY = height - 50; 
    const graphW = width - axisX - 20; 
    const graphH = axisY - 50; 

    if (this.chartType !== 'pie') {
      if (this.chartType === 'bar') {
        const bHeight = graphH / parsedSeries[0].length;
        yLabelsStr.forEach((lbl, i) => {
          if (i >= parsedSeries[0].length) return;
          const y = 50 + i * bHeight + bHeight/2;
          svg += `<text x="${axisX - 5}" y="${y + 3}" font-family="Arial" font-size="10" text-anchor="end" fill="#5f6368">${lbl}</text>`;
        });
      } else {
        const stepsY = Math.max(yLabelsStr.length - 1, 1);
        yLabelsStr.forEach((lbl, i) => {
          const y = axisY - (i / stepsY) * graphH;
          svg += `<text x="${axisX - 5}" y="${y + 4}" font-family="Arial" font-size="10" text-anchor="end" fill="#5f6368">${lbl}</text>`;
          svg += `<line x1="${axisX}" y1="${y}" x2="${width - 20}" y2="${y}" stroke="#f1f3f4" stroke-width="1" />`;
        });
      }

      if (this.chartType === 'column') {
        const barWidth = graphW / parsedSeries[0].length;
        xLabelsStr.forEach((lbl, i) => {
          if (i >= parsedSeries[0].length) return;
          const x = axisX + i * barWidth + barWidth/2;
          svg += `<text x="${x}" y="${axisY + 15}" font-family="Arial" font-size="10" text-anchor="middle" fill="#5f6368">${lbl}</text>`;
        });
      } else {
        const stepsX = Math.max(xLabelsStr.length - 1, 1);
        xLabelsStr.forEach((lbl, i) => {
          const x = axisX + (i / stepsX) * graphW;
          svg += `<text x="${x}" y="${axisY + 15}" font-family="Arial" font-size="10" text-anchor="middle" fill="#5f6368">${lbl}</text>`;
          if (this.chartType === 'bar') {
            svg += `<line x1="${x}" y1="50" x2="${x}" y2="${axisY}" stroke="#f1f3f4" stroke-width="1" />`;
          } else {
            svg += `<line x1="${x}" y1="50" x2="${x}" y2="${axisY}" stroke="#f1f3f4" stroke-width="1" />`;
          }
        });
      }

      svg += `<line x1="${axisX}" y1="50" x2="${axisX}" y2="${axisY}" stroke="#dadce0" stroke-width="2" />`;
      svg += `<line x1="${axisX}" y1="${axisY}" x2="${width - 20}" y2="${axisY}" stroke="#dadce0" stroke-width="2" />`;
    }

    if (this.chartType === 'line' || this.chartType === 'scatter') {
      parsedSeries.forEach((series, sIdx) => {
        const color = colors[sIdx % colors.length];
        const seriesName = seriesNames[sIdx] || `Series ${sIdx+1}`;
        let points = '';
        series.forEach((p, i) => {
          const h = (p.y / maxY) * graphH;
          const x = axisX + (p.x / maxX) * graphW;
          const y = axisY - h;
          points += `${x},${y} `;
        });
        if (this.chartType === 'line') {
          svg += `<polyline fill="none" stroke="${color}" stroke-width="3" points="${points.trim()}" />`;
        }
        series.forEach((p, i) => {
          const h = (p.y / maxY) * graphH;
          const x = axisX + (p.x / maxX) * graphW;
          const y = axisY - h;
          const cat = this.chartValues.includes(';') ? `(${p.x},${p.y})` : (xLabelsStr[i] || '');
          svg += `<circle cx="${x}" cy="${y}" r="6" fill="${color}">`;
          svg += `<title>${cat} / ${seriesName}: ${p.y}</title>`;
          svg += `</circle>`;
        });
      });
    } else if (this.chartType === 'pie') {
      const series = parsedSeries[0];
      svg += `<circle cx="${width/2}" cy="${height/2 + 10}" r="80" fill="#4285f4" stroke="white" stroke-width="2" />`;
      svg += `<path d="M${width/2},${height/2 + 10} L${width/2},${height/2 + 10 - 80} A80,80 0 0,1 ${width/2 + 80},${height/2 + 10} Z" fill="#ea4335" />`;
      svg += `<path d="M${width/2},${height/2 + 10} L${width/2 + 80},${height/2 + 10} A80,80 0 0,1 ${width/2},${height/2 + 10 + 80} Z" fill="#fbbc04" />`;
      svg += `<path d="M${width/2},${height/2 + 10} L${width/2},${height/2 + 10 + 80} A80,80 0 0,1 ${width/2 - 50},${height/2 + 10 + 60} Z" fill="#34a853" />`;
    } else if (this.chartType === 'bar') {
      const groupHeight = graphH / parsedSeries[0].length;
      const numSeries = parsedSeries.length;
      const barHeight = (groupHeight - 10) / numSeries;
      
      parsedSeries.forEach((series, sIdx) => {
        const color = colors[sIdx % colors.length];
        const seriesName = seriesNames[sIdx] || `Series ${sIdx+1}`;
        series.forEach((p, i) => {
          const w = (p.y / maxY) * graphW;
          const y = 50 + i * groupHeight + 5 + sIdx * barHeight;
          const x = axisX;
          const cat = yLabelsStr[i] || `Cat ${i+1}`;
          svg += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight - 2}" fill="${color}" rx="2">`;
          svg += `<title>${cat} / ${seriesName}: ${p.y}</title>`;
          svg += `</rect>`;
          // svg += `<text x="${x + w + 15}" y="${y + barHeight/2 + 4}" font-family="Arial" font-size="10" font-weight="bold" text-anchor="middle" fill="#5f6368">${p.y}</text>`;
        });
      });
    } else {
      // Column chart
      const groupWidth = graphW / parsedSeries[0].length;
      const numSeries = parsedSeries.length;
      const barWidth = (groupWidth - 10) / numSeries;
      
      parsedSeries.forEach((series, sIdx) => {
        const color = colors[sIdx % colors.length];
        const seriesName = seriesNames[sIdx] || `Series ${sIdx+1}`;
        series.forEach((p, i) => {
          const h = (p.y / maxY) * graphH;
          const x = axisX + i * groupWidth + 5 + sIdx * barWidth;
          const y = axisY - h;
          const cat = xLabelsStr[i] || `Cat ${i+1}`;
          svg += `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${h}" fill="${color}" rx="2">`;
          svg += `<title>${cat} / ${seriesName}: ${p.y}</title>`;
          svg += `</rect>`;
          // svg += `<text x="${x + barWidth / 2}" y="${y - 8}" font-family="Arial" font-size="10" font-weight="bold" text-anchor="middle" fill="#5f6368">${p.y}</text>`;
        });
      });
    }

    // Legend
    if (parsedSeries.length > 1 || seriesNames.length > 0) {
      let legendX = width / 2 - (parsedSeries.length * 40);
      parsedSeries.forEach((_, sIdx) => {
        const color = colors[sIdx % colors.length];
        const name = seriesNames[sIdx] || `Series ${sIdx+1}`;
        svg += `<circle cx="${legendX}" cy="${height - 15}" r="4" fill="${color}" />`;
        svg += `<text x="${legendX + 10}" y="${height - 11}" font-family="Arial" font-size="10" fill="#5f6368">${name}</text>`;
        legendX += 80;
      });
    }

    svg += `</svg>`;
"""

new_lines = lines[:start_idx] + [replacement + "\\n"] + lines[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("SUCCESS_SCRIPT_2")
