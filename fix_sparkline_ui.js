const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regexSparklineHtml = /<ng-container \*ngIf="sparklineConfig">[\s\S]*?<\/ng-container>/;

const newSparklineHtml = `<ng-container *ngIf="sparklineConfig">
            <div class="sp-card" style="padding: 0; border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-family: 'Inter', sans-serif; background: #fff; width: 340px;">
              <!-- Header -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e0e0e0; position: relative;">
                <div style="font-size: 16px; font-weight: 500; color: #333;">Sparkline</div>
                <div style="position: absolute; bottom: -1px; left: 16px; width: 80px; height: 2px; background: #e23b2c;"></div>
                <button (click)="closeSidePanel()" style="background: none; border: none; cursor: pointer; color: #777; display: flex; align-items: center; justify-content: center;"><span class="material-symbols-outlined" style="font-size: 18px;">cancel</span></button>
              </div>
              
              <div style="padding: 16px;">
                <!-- Source -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 20px;">
                  <div style="color: #444;">Source: <span style="font-family: monospace;">{{ sparklineConfig.source }}</span></div>
                  <div style="color: #0b8043; cursor: pointer; font-weight: 500;" (click)="showToast('Edit source manually below.')">Edit</div>
                </div>

                <!-- Sparkline Type -->
                <div style="font-size: 12px; color: #555; margin-bottom: 8px;">Sparkline Type</div>
                <div style="display: flex; gap: 8px; margin-bottom: 20px; align-items: center;">
                  <div style="display: flex; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
                    <button (click)="sparklineConfig.type = 'line'; saveSparkline()" [style.background]="sparklineConfig.type === 'line' ? '#f1f3f4' : 'transparent'" style="padding: 6px 12px; border: none; border-right: 1px solid #ddd; cursor: pointer; display: flex; justify-content: center;"><span class="material-symbols-outlined" style="font-size: 20px; color: #1a73e8;">show_chart</span></button>
                    <button (click)="sparklineConfig.type = 'column'; saveSparkline()" [style.background]="sparklineConfig.type === 'column' ? '#f1f3f4' : 'transparent'" style="padding: 6px 12px; border: none; border-right: 1px solid #ddd; cursor: pointer; display: flex; justify-content: center;"><span class="material-symbols-outlined" style="font-size: 20px; color: #1a73e8;">bar_chart</span></button>
                    <button (click)="sparklineConfig.type = 'winloss'; saveSparkline()" [style.background]="sparklineConfig.type === 'winloss' ? '#f1f3f4' : 'transparent'" style="padding: 6px 12px; border: none; cursor: pointer; display: flex; justify-content: center;"><span class="material-symbols-outlined" style="font-size: 20px; color: #1a73e8;">waterfall_chart</span></button>
                  </div>
                  
                  <!-- Color Picker -->
                  <div style="position: relative; margin-left: 16px; display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; cursor: pointer;">
                    <input type="color" [(ngModel)]="sparklineConfig.color" (change)="saveSparkline()" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                    <div [style.background]="sparklineConfig.color || '#4285f4'" style="width: 14px; height: 14px; border-radius: 2px; margin-right: 4px;"></div>
                    <span class="material-symbols-outlined" style="font-size: 16px; color: #777;">expand_more</span>
                  </div>
                </div>

                <!-- Highlight Points -->
                <div style="font-size: 12px; color: #555; margin-bottom: 8px;">Highlight Points</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                  
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; font-size: 12px; cursor: pointer; gap: 8px; color: #333;">
                      <input type="checkbox" [checked]="!!sparklineConfig.highColor" (change)="sparklineConfig.highColor = $any($event.target).checked ? '#34a853' : ''; saveSparkline()" style="margin:0;"> High
                    </label>
                    <div style="position: relative; display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; cursor: pointer;" [style.opacity]="sparklineConfig.highColor ? '1' : '0.5'">
                      <input type="color" [disabled]="!sparklineConfig.highColor" [(ngModel)]="sparklineConfig.highColor" (change)="saveSparkline()" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                      <div [style.background]="sparklineConfig.highColor || '#34a853'" style="width: 12px; height: 12px; border-radius: 2px; margin-right: 2px;"></div>
                      <span class="material-symbols-outlined" style="font-size: 14px; color: #777;">expand_more</span>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; font-size: 12px; cursor: pointer; gap: 8px; color: #333;">
                      <input type="checkbox" [checked]="!!sparklineConfig.lowColor" (change)="sparklineConfig.lowColor = $any($event.target).checked ? '#ea4335' : ''; saveSparkline()" style="margin:0;"> Low
                    </label>
                    <div style="position: relative; display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; cursor: pointer;" [style.opacity]="sparklineConfig.lowColor ? '1' : '0.5'">
                      <input type="color" [disabled]="!sparklineConfig.lowColor" [(ngModel)]="sparklineConfig.lowColor" (change)="saveSparkline()" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                      <div [style.background]="sparklineConfig.lowColor || '#ea4335'" style="width: 12px; height: 12px; border-radius: 2px; margin-right: 2px;"></div>
                      <span class="material-symbols-outlined" style="font-size: 14px; color: #777;">expand_more</span>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; font-size: 12px; cursor: pointer; gap: 8px; color: #333;">
                      <input type="checkbox" [checked]="!!sparklineConfig.firstColor" (change)="sparklineConfig.firstColor = $any($event.target).checked ? '#4285f4' : ''; saveSparkline()" style="margin:0;"> First
                    </label>
                    <div style="position: relative; display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; cursor: pointer;" [style.opacity]="sparklineConfig.firstColor ? '1' : '0.5'">
                      <input type="color" [disabled]="!sparklineConfig.firstColor" [(ngModel)]="sparklineConfig.firstColor" (change)="saveSparkline()" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                      <div [style.background]="sparklineConfig.firstColor || '#4285f4'" style="width: 12px; height: 12px; border-radius: 2px; margin-right: 2px;"></div>
                      <span class="material-symbols-outlined" style="font-size: 14px; color: #777;">expand_more</span>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; font-size: 12px; cursor: pointer; gap: 8px; color: #333;">
                      <input type="checkbox" [checked]="!!sparklineConfig.lastColor" (change)="sparklineConfig.lastColor = $any($event.target).checked ? '#4285f4' : ''; saveSparkline()" style="margin:0;"> Last
                    </label>
                    <div style="position: relative; display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; cursor: pointer;" [style.opacity]="sparklineConfig.lastColor ? '1' : '0.5'">
                      <input type="color" [disabled]="!sparklineConfig.lastColor" [(ngModel)]="sparklineConfig.lastColor" (change)="saveSparkline()" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                      <div [style.background]="sparklineConfig.lastColor || '#4285f4'" style="width: 12px; height: 12px; border-radius: 2px; margin-right: 2px;"></div>
                      <span class="material-symbols-outlined" style="font-size: 14px; color: #777;">expand_more</span>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; font-size: 12px; cursor: pointer; gap: 8px; color: #333;">
                      <input type="checkbox" [checked]="!!sparklineConfig.negativeColor" (change)="sparklineConfig.negativeColor = $any($event.target).checked ? '#ea4335' : ''; saveSparkline()" style="margin:0;"> Negative
                    </label>
                    <div style="position: relative; display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; cursor: pointer;" [style.opacity]="sparklineConfig.negativeColor ? '1' : '0.5'">
                      <input type="color" [disabled]="!sparklineConfig.negativeColor" [(ngModel)]="sparklineConfig.negativeColor" (change)="saveSparkline()" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                      <div [style.background]="sparklineConfig.negativeColor || '#ea4335'" style="width: 12px; height: 12px; border-radius: 2px; margin-right: 2px;"></div>
                      <span class="material-symbols-outlined" style="font-size: 14px; color: #777;">expand_more</span>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between;" [style.opacity]="sparklineConfig.type === 'line' ? '1' : '0.4'">
                    <label style="display: flex; align-items: center; font-size: 12px; cursor: pointer; gap: 8px; color: #333;">
                      <input type="checkbox" [disabled]="sparklineConfig.type !== 'line'" [checked]="!!sparklineConfig.markerColor" (change)="sparklineConfig.markerColor = $any($event.target).checked ? '#4285f4' : ''; saveSparkline()" style="margin:0;"> Markers
                    </label>
                    <div style="position: relative; display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; cursor: pointer;" [style.opacity]="sparklineConfig.markerColor ? '1' : '0.5'">
                      <input type="color" [disabled]="sparklineConfig.type !== 'line' || !sparklineConfig.markerColor" [(ngModel)]="sparklineConfig.markerColor" (change)="saveSparkline()" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                      <div [style.background]="sparklineConfig.markerColor || '#4285f4'" style="width: 12px; height: 12px; border-radius: 2px; margin-right: 2px;"></div>
                      <span class="material-symbols-outlined" style="font-size: 14px; color: #777;">expand_more</span>
                    </div>
                  </div>
                </div>

                <!-- Show Empty Cells -->
                <div style="font-size: 12px; color: #555; margin-bottom: 8px;">Show Empty Cells</div>
                <div style="display: flex; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
                  <button (click)="sparklineConfig.emptyCells = 'gap'; saveSparkline()" [style.background]="sparklineConfig.emptyCells === 'gap' ? '#f1f3f4' : 'transparent'" style="flex:1; padding:6px 0; border:none; border-right:1px solid #ddd; cursor:pointer; color:#333;">Gap</button>
                  <button (click)="sparklineConfig.emptyCells = 'zero'; saveSparkline()" [style.background]="sparklineConfig.emptyCells === 'zero' ? '#f1f3f4' : 'transparent'" style="flex:1; padding:6px 0; border:none; border-right:1px solid #ddd; cursor:pointer; color:#333;">Zero</button>
                  <button (click)="sparklineConfig.emptyCells = 'connect'; saveSparkline()" [style.background]="sparklineConfig.emptyCells === 'connect' ? '#f1f3f4' : 'transparent'" style="flex:1; padding:6px 0; border:none; border-right:1px solid #ddd; cursor:pointer; color:#333;">Connect</button>
                  <button (click)="sparklineConfig.emptyCells = 'skip'; saveSparkline()" [style.background]="sparklineConfig.emptyCells === 'skip' ? '#f1f3f4' : 'transparent'" style="flex:1; padding:6px 0; border:none; cursor:pointer; color:#333;">Skip</button>
                </div>

                <!-- Include Hidden Rows -->
                <label style="display: flex; align-items: center; font-size: 12px; color: #333; gap: 8px; margin-bottom: 24px; cursor: pointer;">
                  <input type="checkbox" [(ngModel)]="sparklineConfig.includeHidden" (change)="saveSparkline()" style="margin:0;"> Include hidden rows and columns
                </label>

                <!-- Footer Links -->
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 12px; color: #1a73e8; cursor: pointer; font-weight: 500;">Manage Settings</div>
                  <div style="font-size: 12px; color: #ea4335; cursor: pointer;" (click)="deleteSparklineConfig()">Delete</div>
                </div>

              </div>
            </div>
          </ng-container>`;

content = content.replace(regexSparklineHtml, newSparklineHtml);

// Add includeHidden to sparklineConfig default structure
const regexConfigInit = /this\.sparklineConfig = \{\s*source:\s*'',\s*type:\s*'line',\s*color:\s*'#4285f4',\s*emptyCells:\s*'gap',\s*highColor:\s*'#34a853',\s*lowColor:\s*'#ea4335',\s*firstColor:\s*'#4285f4',\s*lastColor:\s*'#4285f4',\s*negativeColor:\s*'#ea4335',\s*markerColor:\s*'#4285f4',\s*error:\s*''\s*\};/;
const newConfigInit = `this.sparklineConfig = {
      source: '',
      type: 'line',
      color: '#4285f4',
      emptyCells: 'gap',
      highColor: '#34a853',
      lowColor: '#ea4335',
      firstColor: '#4285f4',
      lastColor: '#4285f4',
      negativeColor: '#ea4335',
      markerColor: '#4285f4',
      includeHidden: false,
      error: ''
    };`;
content = content.replace(regexConfigInit, newConfigInit);

// Add includeHidden to sparkline saving and restoring
const regexSave = /emptyCells: this\.sparklineConfig\.emptyCells,/;
const newSave = `emptyCells: this.sparklineConfig.emptyCells,\n      includeHidden: this.sparklineConfig.includeHidden,`;
content = content.replace(regexSave, newSave);

// And we need to use includeHidden in getSparklineData
const getSparklineDataRegex = /let hasNumbers = false;\s*for \(let r = minR; r <= maxR; r\+\+\) \{\s*for \(let c = minC; c <= maxC; c\+\+\) \{\s*const val = sheet\.cells\[r\]\[c\];/;
const newGetSparklineData = `let hasNumbers = false;
    for (let r = minR; r <= maxR; r++) {
      // Check hidden row
      if (!this.sparklineConfig?.includeHidden && this.hiddenRows?.has(r)) continue;
      for (let c = minC; c <= maxC; c++) {
        // Check hidden col
        if (!this.sparklineConfig?.includeHidden && this.hiddenCols?.has(c)) continue;
        const val = sheet.cells[r][c];`;
content = content.replace(getSparklineDataRegex, newGetSparklineData);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done redesigning sparkline!');
