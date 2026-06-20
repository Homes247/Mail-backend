import sys

file_path = 'frontend/src/app/pages/doc-editor/doc-editor.component.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add chartSeriesNames to state
state_old = "chartYLabels = '0, 50, 100';"
state_new = "chartYLabels = '0, 50, 100';\n  chartSeriesNames = 'Series 1';"
content = content.replace(state_old, state_new)

# 2. Add chartSeriesNames to UI
ui_old = """<div style="margin-top: 12px; text-align: left;">
            <label style="display:block; margin-bottom: 4px; font-weight: 500;">Data Values (comma separated, or X,Y pairs separated by semicolons):</label>
            <input type="text" [(ngModel)]="chartValues" class="form-control" placeholder="e.g. 10, 20, 30 OR 1,10; 2,20">
          </div>"""
ui_new = """<div style="margin-top: 12px; text-align: left;">
            <label style="display:block; margin-bottom: 4px; font-weight: 500;">Series Names (comma separated):</label>
            <input type="text" [(ngModel)]="chartSeriesNames" class="form-control" placeholder="e.g. Series 1, Series 2">
          </div>
          <div style="margin-top: 12px; text-align: left;">
            <label style="display:block; margin-bottom: 4px; font-weight: 500;">Data Values (use | to separate series):</label>
            <input type="text" [(ngModel)]="chartValues" class="form-control" placeholder="e.g. 10, 20 | 30, 40">
          </div>"""
content = content.replace(ui_old, ui_new)

# 3. Replace insertChart
insert_chart_old = """  insertChart(type?: string) {
    this.closeMenus();
    this.chartType = type || 'column';
    
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer as HTMLElement;
      if (node.nodeType === Node.TEXT_NODE && node.parentElement) node = node.parentElement as HTMLElement;
      const table = node.closest('table');
      if (table) {
        const labels: string[] = [];
        const values: number[] = [];
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const col1 = cells[0].textContent?.trim() || '';
            const col2 = cells[1].textContent?.trim() || '';
            const val = parseFloat(col2);
            if (!isNaN(val)) {
              labels.push(col1);
              values.push(val);
            }
          }
        });
        if (values.length > 0) {
          this.chartXLabels = labels.join(', ');
          this.chartValues = values.join(', ');
          const maxVal = Math.max(...values, 1);
          this.chartYLabels = `0, ${Math.round(maxVal/2)}, ${maxVal}`;
        }
      }
    }
    
    this.chartModalVisible = true;
  }"""

insert_chart_new = """  insertChart(type?: string) {
    this.closeMenus();
    this.chartType = type || 'column';
    
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer as HTMLElement;
      if (node.nodeType === Node.TEXT_NODE && node.parentElement) node = node.parentElement as HTMLElement;
      const table = node.closest('table');
      if (table) {
        const labels: string[] = [];
        const seriesData: number[][] = [];
        const seriesNames: string[] = [];
        
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach((row, rIdx) => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          if (cells.length >= 2) {
            if (rIdx === 0 && isNaN(parseFloat(cells[1].textContent||''))) {
               for (let i = 1; i < cells.length; i++) {
                 seriesNames.push(cells[i].textContent?.trim() || `Series ${i}`);
               }
               return;
            }
            
            const rowLabel = cells[0].textContent?.trim() || '';
            labels.push(rowLabel);
            for (let i = 1; i < cells.length; i++) {
               const val = parseFloat(cells[i].textContent || '');
               if (!seriesData[i-1]) seriesData[i-1] = [];
               seriesData[i-1].push(isNaN(val) ? 0 : val);
            }
          }
        });
        
        if (seriesData.length > 0 && seriesData[0].length > 0) {
          this.chartXLabels = labels.join(', ');
          this.chartValues = seriesData.map(s => s.join(', ')).join(' | ');
          if (seriesNames.length > 0) {
             this.chartSeriesNames = seriesNames.join(', ');
          } else {
             this.chartSeriesNames = seriesData.map((_, i) => `Series ${i+1}`).join(', ');
          }
          const maxVal = Math.max(...seriesData.flat(), 1);
          this.chartYLabels = `0, ${Math.round(maxVal/2)}, ${maxVal}`;
        }
      }
    }
    
    this.chartModalVisible = true;
  }"""

content = content.replace(insert_chart_old, insert_chart_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS_SCRIPT_1")
