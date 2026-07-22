const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /<!-- ── SPARKLINE ────────────────────────────────────────────── -->[\s\S]*?<\/ng-container>/;

const newHTML = `<!-- 🟢 SPARKLINE SETTINGS PANEL 🟢 -->
          <ng-container *ngIf="sidePanelApp === 'sparkline' && sparklineConfig">
            <div style="display:flex; flex-direction:column; gap:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                 <div style="font-size:16px; font-weight:600; color:#202124;">Sparkline</div>
                 <button (click)="sidePanelApp = null" style="background:none; border:none; cursor:pointer;"><span class="material-symbols-outlined" style="font-size:18px; color:#5f6368;">close</span></button>
              </div>
              <div style="font-size:13px; color:#202124;">Source: <strong>{{sparklineConfig.sourceRange}}</strong> <a style="color:#0f9d58; text-decoration:none; margin-left:8px; cursor:pointer; font-weight:500;" (click)="editSparklineConfig = { source: sparklineConfig.sourceRange, dest: sparklineConfig.destinationRange, error: '', tab: 'selected' }; activeModal = 'edit_sparkline'">Edit</a></div>
              
              <hr style="border:0; border-top:1px solid #e2e8f0; margin:0;">
              
              <div class="sp-card-label">Sparkline Type</div>
              <div style="display:flex; gap:8px; align-items:center;">
                <button (click)="setSparklineType('line')" [style.background]="sparklineConfig.type === 'line' ? '#e8f0fe' : '#fff'" [style.color]="sparklineConfig.type === 'line' ? '#1a73e8' : '#5f6368'" style="flex:1; padding:6px; border:1px solid #dadce0; border-radius:4px; cursor:pointer; display:flex; justify-content:center;" title="Line"><span class="material-symbols-outlined">show_chart</span></button>
                <button (click)="setSparklineType('column')" [style.background]="sparklineConfig.type === 'column' ? '#e8f0fe' : '#fff'" [style.color]="sparklineConfig.type === 'column' ? '#1a73e8' : '#5f6368'" style="flex:1; padding:6px; border:1px solid #dadce0; border-radius:4px; cursor:pointer; display:flex; justify-content:center;" title="Bar/Column"><span class="material-symbols-outlined">bar_chart</span></button>
                <button (click)="setSparklineType('winloss')" [style.background]="sparklineConfig.type === 'winloss' ? '#e8f0fe' : '#fff'" [style.color]="sparklineConfig.type === 'winloss' ? '#1a73e8' : '#5f6368'" style="flex:1; padding:6px; border:1px solid #dadce0; border-radius:4px; cursor:pointer; display:flex; justify-content:center;" title="Win/Loss"><span class="material-symbols-outlined">waterfall_chart</span></button>
                <div style="width:24px;"></div>
                <div style="position:relative;">
                   <div (click)="openColorPicker($event, 'base')" style="width:28px; height:20px; border-radius:2px; border:1px solid #dadce0; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px;" [style.background]="sparklineConfig.baseColor"><span class="material-symbols-outlined" style="font-size:14px; color:rgba(255,255,255,0.8); mix-blend-mode: difference;">expand_more</span></div>
                </div>
              </div>

              <div class="sp-card-label" style="margin-top:8px;">Highlight Points</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                 <!-- High -->
                 <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.highlights.high.enabled" (change)="saveSparkline()"> High</label>
                    <div (click)="openColorPicker($event, 'high')" style="width:28px; height:20px; border-radius:2px; border:1px solid #dadce0; cursor:pointer; display:flex; align-items:center; justify-content:center;" [style.background]="sparklineConfig.highlights.high.color"><span class="material-symbols-outlined" style="font-size:14px; color:rgba(255,255,255,0.8); mix-blend-mode: difference;">expand_more</span></div>
                 </div>
                 <!-- Low -->
                 <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.highlights.low.enabled" (change)="saveSparkline()"> Low</label>
                    <div (click)="openColorPicker($event, 'low')" style="width:28px; height:20px; border-radius:2px; border:1px solid #dadce0; cursor:pointer; display:flex; align-items:center; justify-content:center;" [style.background]="sparklineConfig.highlights.low.color"><span class="material-symbols-outlined" style="font-size:14px; color:rgba(255,255,255,0.8); mix-blend-mode: difference;">expand_more</span></div>
                 </div>
                 <!-- First -->
                 <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.highlights.first.enabled" (change)="saveSparkline()"> First</label>
                    <div (click)="openColorPicker($event, 'first')" style="width:28px; height:20px; border-radius:2px; border:1px solid #dadce0; cursor:pointer; display:flex; align-items:center; justify-content:center;" [style.background]="sparklineConfig.highlights.first.color"><span class="material-symbols-outlined" style="font-size:14px; color:rgba(255,255,255,0.8); mix-blend-mode: difference;">expand_more</span></div>
                 </div>
                 <!-- Last -->
                 <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.highlights.last.enabled" (change)="saveSparkline()"> Last</label>
                    <div (click)="openColorPicker($event, 'last')" style="width:28px; height:20px; border-radius:2px; border:1px solid #dadce0; cursor:pointer; display:flex; align-items:center; justify-content:center;" [style.background]="sparklineConfig.highlights.last.color"><span class="material-symbols-outlined" style="font-size:14px; color:rgba(255,255,255,0.8); mix-blend-mode: difference;">expand_more</span></div>
                 </div>
                 <!-- Negative -->
                 <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.highlights.negative.enabled" (change)="saveSparkline()"> Negative</label>
                    <div (click)="openColorPicker($event, 'negative')" style="width:28px; height:20px; border-radius:2px; border:1px solid #dadce0; cursor:pointer; display:flex; align-items:center; justify-content:center;" [style.background]="sparklineConfig.highlights.negative.color"><span class="material-symbols-outlined" style="font-size:14px; color:rgba(255,255,255,0.8); mix-blend-mode: difference;">expand_more</span></div>
                 </div>
                 <!-- Markers -->
                 <div style="display:flex; justify-content:space-between; align-items:center;" [style.opacity]="sparklineConfig.type !== 'line' ? 0.4 : 1" [style.pointer-events]="sparklineConfig.type !== 'line' ? 'none' : 'auto'">
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.highlights.markers.enabled" (change)="saveSparkline()"> Markers</label>
                    <div (click)="openColorPicker($event, 'markers')" style="width:28px; height:20px; border-radius:2px; border:1px solid #dadce0; cursor:pointer; display:flex; align-items:center; justify-content:center;" [style.background]="sparklineConfig.highlights.markers.color"><span class="material-symbols-outlined" style="font-size:14px; color:rgba(255,255,255,0.8); mix-blend-mode: difference;">expand_more</span></div>
                 </div>
              </div>

              <div class="sp-card-label" style="margin-top:8px;">Show Empty Cells</div>
              <div style="display:flex; font-size:12px; border:1px solid #dadce0; border-radius:4px; overflow:hidden;">
                <button style="flex:1; padding:6px 0; border:none; cursor:pointer; background:transparent;" [style.background]="sparklineConfig.emptyCellMode === 'gap' ? '#424242' : '#f1f3f4'" [style.color]="sparklineConfig.emptyCellMode === 'gap' ? '#fff' : '#202124'" (click)="setEmptyCellMode('gap')">Gap</button>
                <div style="width:1px; background:#dadce0;"></div>
                <button style="flex:1; padding:6px 0; border:none; cursor:pointer; background:transparent;" [style.background]="sparklineConfig.emptyCellMode === 'zero' ? '#424242' : '#f1f3f4'" [style.color]="sparklineConfig.emptyCellMode === 'zero' ? '#fff' : '#202124'" (click)="setEmptyCellMode('zero')">Zero</button>
                <div style="width:1px; background:#dadce0;"></div>
                <button style="flex:1; padding:6px 0; border:none; cursor:pointer; background:transparent;" [style.background]="sparklineConfig.emptyCellMode === 'connect' ? '#424242' : '#f1f3f4'" [style.color]="sparklineConfig.emptyCellMode === 'connect' ? '#fff' : '#202124'" (click)="setEmptyCellMode('connect')" [disabled]="sparklineConfig.type !== 'line'" [style.opacity]="sparklineConfig.type !== 'line' ? 0.4 : 1">Connect</button>
                <div style="width:1px; background:#dadce0;"></div>
                <button style="flex:1; padding:6px 0; border:none; cursor:pointer; background:transparent;" [style.background]="sparklineConfig.emptyCellMode === 'skip' ? '#424242' : '#f1f3f4'" [style.color]="sparklineConfig.emptyCellMode === 'skip' ? '#fff' : '#202124'" (click)="setEmptyCellMode('skip')">Skip</button>
              </div>

              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.includeHiddenRowsColumns" (change)="saveSparkline()"> Include hidden rows and columns</label>

              <hr style="border:0; border-top:1px solid #e2e8f0; margin:0;">

              <div class="sp-card-label">Manage Settings</div>
              <div style="display:flex; gap:8px;">
                 <button (click)="toggleGroup()" style="flex:1; padding:6px; display:flex; align-items:center; justify-content:center; gap:4px; border:1px solid #dadce0; border-radius:4px; background:#fff; cursor:pointer; font-size:13px;"><span class="material-symbols-outlined" style="font-size:16px;">library_add</span> {{sparklineConfig.isGrouped ? 'Ungroup' : 'Group'}}</button>
                 <button (click)="deleteSparklineConfig()" style="flex:1; padding:6px; display:flex; align-items:center; justify-content:center; gap:4px; border:1px solid #dadce0; border-radius:4px; background:#fff; cursor:pointer; font-size:13px;"><span class="material-symbols-outlined" style="font-size:16px;">delete</span> Delete</button>
              </div>
              <button (click)="switchRowsColumns()" style="width:100%; padding:8px; border:1px solid #dadce0; border-radius:4px; background:#fff; cursor:pointer; font-size:13px; font-weight:500;">Switch rows / columns</button>

              <div style="border-top:1px solid #e2e8f0; margin:0 -16px; padding:12px 16px;">
                 <div (click)="horizontalAxisExpanded = !horizontalAxisExpanded" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; font-size:13px; color:#202124;">
                   Horizontal Axis
                   <span class="material-symbols-outlined" style="font-size:18px;">{{horizontalAxisExpanded ? 'expand_less' : 'expand_more'}}</span>
                 </div>
                 <div *ngIf="horizontalAxisExpanded" style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
                   <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.horizontalAxis.displayAxis" (change)="saveSparkline()"> Display Axis</label>
                   <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;"><input type="checkbox" [(ngModel)]="sparklineConfig.horizontalAxis.rightToLeft" (change)="saveSparkline()"> Plot sparkline from right to left</label>
                 </div>
              </div>

              <div style="border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; margin:0 -16px; margin-top:-16px; padding:12px 16px;">
                 <div (click)="verticalAxisExpanded = !verticalAxisExpanded" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; font-size:13px; color:#202124;">
                   Vertical Axis
                   <span class="material-symbols-outlined" style="font-size:18px;">{{verticalAxisExpanded ? 'expand_less' : 'expand_more'}}</span>
                 </div>
                 <div *ngIf="verticalAxisExpanded" style="margin-top:12px; display:flex; flex-direction:column; gap:16px;">
                   <div>
                     <div style="font-size:12px; font-weight:500; margin-bottom:6px;">Minimum Value:</div>
                     <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;"><input type="radio" name="vMinMode" value="auto" [(ngModel)]="sparklineConfig.verticalAxis.min.mode" (change)="saveSparkline()"> Automatic for each sparkline</label>
                     <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; margin-top:4px;"><input type="radio" name="vMinMode" value="same" [(ngModel)]="sparklineConfig.verticalAxis.min.mode" (change)="saveSparkline()"> Same for all sparklines</label>
                     <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                       <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;"><input type="radio" name="vMinMode" value="custom" [(ngModel)]="sparklineConfig.verticalAxis.min.mode" (change)="saveSparkline()"> Custom value:</label>
                       <input type="number" [(ngModel)]="sparklineConfig.verticalAxis.min.customValue" (change)="saveSparkline()" [disabled]="sparklineConfig.verticalAxis.min.mode !== 'custom'" style="width:60px; padding:2px 4px; border:1px solid #dadce0; border-radius:2px; font-size:12px;">
                     </div>
                   </div>
                   <div>
                     <div style="font-size:12px; font-weight:500; margin-bottom:6px;">Maximum Value:</div>
                     <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;"><input type="radio" name="vMaxMode" value="auto" [(ngModel)]="sparklineConfig.verticalAxis.max.mode" (change)="saveSparkline()"> Automatic for each sparkline</label>
                     <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; margin-top:4px;"><input type="radio" name="vMaxMode" value="same" [(ngModel)]="sparklineConfig.verticalAxis.max.mode" (change)="saveSparkline()"> Same for all sparklines</label>
                     <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                       <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;"><input type="radio" name="vMaxMode" value="custom" [(ngModel)]="sparklineConfig.verticalAxis.max.mode" (change)="saveSparkline()"> Custom value:</label>
                       <input type="number" [(ngModel)]="sparklineConfig.verticalAxis.max.customValue" (change)="saveSparkline()" [disabled]="sparklineConfig.verticalAxis.max.mode !== 'custom'" style="width:60px; padding:2px 4px; border:1px solid #dadce0; border-radius:2px; font-size:12px;">
                     </div>
                   </div>
                 </div>
              </div>

            </div>
          </ng-container>`;

// Because part 2 of step 8 removed down to </ng-container> from <!-- Negative -->, 
// the old file structure is now mangled. It looks like:
// <!-- ── SPARKLINE ────────────────────────────────────────────── -->
// <ng-container *ngIf="sidePanelApp === 'sparkline'">
// ...
//                 </div>
//                 
// 
//         </div>
//       </div>
//     </div>

// So we should replace from <!-- ── SPARKLINE ────────────────────────────────────────────── --> 
// down to the extra </div> closing tags that were left over.
// Wait, the extra closing tags were `        </div>\n      </div>\n    </div>`.
// Let's just find `<!-- ── SPARKLINE` up to the first `<div class="toast"` and replace that whole block.
// Because the toast is right after the panel shell ends.
// Wait, the panel shell ends with `        </div>\n      </div>\n    </div>`.
// If I replace `<!-- ── SPARKLINE ────────────────────────────────────────────── -->[\s\S]*?(?=\s*<div class="toast")`, 
// I will also be deleting `        </div>\n      </div>\n    </div>` which belongs to the widget panel shell!
// Let me just replace the `<!-- ── SPARKLINE` block.
// Wait, since I deleted `</ng-container>`, let's match `<!-- ── SPARKLINE ────────────────────────────────────────────── -->` up to the first `</div>\n                \n\n        </div>` or something.
// Actually, it's safer to just read the file, find the index of `<!-- ── SPARKLINE`, find the index of `<!-- Image Preview Modal -->`, and parse backwards to keep the `</div>`s.

let startIndex = content.indexOf('<!-- ── SPARKLINE ────────────────────────────────────────────── -->');
if (startIndex !== -1) {
    let endIndex = content.indexOf('<div class="toast"', startIndex);
    
    // We want to keep the closing divs of the widget panel.
    // The widget panel closing divs are:
    //         </div>
    //       </div>
    //     </div>
    // So we find the last 3 closing divs before the toast.
    let beforeToast = content.substring(startIndex, endIndex);
    let closingDivsMatch = beforeToast.match(/(\s*<\/div>\s*<\/div>\s*<\/div>\s*)$/);
    if (closingDivsMatch) {
       let realEndIndex = endIndex - closingDivsMatch[1].length;
       
       let newContent = content.substring(0, startIndex) + newHTML + content.substring(realEndIndex);
       fs.writeFileSync(filePath, newContent, 'utf-8');
       console.log('Successfully replaced old HTML with new HTML!');
    } else {
       console.log('Could not find closing divs match before toast.');
    }
} else {
    console.log('Could not find SPARKLINE marker.');
}

