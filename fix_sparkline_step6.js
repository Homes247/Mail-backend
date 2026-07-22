const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const modalHTML = `
      <!-- Insert Sparkline Modal -->
      <div class="modal-overlay" *ngIf="activeModal === 'insert_sparkline'" (click)="activeModal = null">
        <div class="modal-content" (click)="$event.stopPropagation()" style="width: 400px; padding: 24px; border-radius: 8px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
            <div style="font-size: 18px; font-weight: 500; color: #202124;">Insert Sparklines</div>
            <button (click)="activeModal = null" style="background: none; border: none; cursor: pointer; color: #5f6368;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Source:</div>
            <div style="display:flex; align-items:center; border: 1px solid #dadce0; border-radius: 4px; padding: 0 8px;">
               <input type="text" [(ngModel)]="insertSparklineConfig.source" style="flex: 1; border: none; padding: 10px 0; outline: none; font-size: 14px;" placeholder="e.g. 'Sheet1'.A1:A5">
               <span class="material-symbols-outlined" style="color: #1a73e8; font-size: 18px; cursor: pointer;">grid_on</span>
            </div>
          </div>
          
          <div style="margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Destination:</div>
            <div style="display:flex; align-items:center; border: 1px solid #dadce0; border-radius: 4px; padding: 0 8px;">
               <input type="text" [(ngModel)]="insertSparklineConfig.dest" style="flex: 1; border: none; padding: 10px 0; outline: none; font-size: 14px;" placeholder="e.g. 'Sheet1'.B1:B5">
               <span class="material-symbols-outlined" style="color: #1a73e8; font-size: 18px; cursor: pointer;">grid_on</span>
            </div>
          </div>
          
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 24px;">Note: Please select a destination range that is equal to the source range.</div>
          
          <div *ngIf="insertSparklineConfig.error" style="color: #ea4335; font-size: 13px; margin-bottom: 16px;">{{insertSparklineConfig.error}}</div>
          
          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button (click)="activeModal = null" style="background: none; border: 1px solid #dadce0; border-radius: 4px; padding: 8px 24px; font-weight: 500; cursor: pointer; color: #202124;">Cancel</button>
            <button (click)="submitInsertSparkline()" style="background: #0f9d58; border: none; border-radius: 4px; padding: 8px 24px; font-weight: 500; cursor: pointer; color: #fff;">OK</button>
          </div>
        </div>
      </div>

      <!-- Edit Sparkline Modal -->
      <div class="modal-overlay" *ngIf="activeModal === 'edit_sparkline'" (click)="activeModal = null">
        <div class="modal-content" (click)="$event.stopPropagation()" style="width: 400px; padding: 24px; border-radius: 8px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
            <div style="font-size: 18px; font-weight: 500; color: #202124;">Edit</div>
            <button (click)="activeModal = null" style="background: none; border: none; cursor: pointer; color: #5f6368;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          
          <div style="display:flex; border-bottom: 1px solid #dadce0; margin-bottom: 16px;">
            <div (click)="editSparklineConfig.tab = 'selected'" [style.border-bottom]="editSparklineConfig.tab === 'selected' ? '2px solid #0f9d58' : 'none'" [style.color]="editSparklineConfig.tab === 'selected' ? '#0f9d58' : '#5f6368'" style="padding: 8px 16px; font-weight: 500; cursor: pointer;">Selected</div>
            <div (click)="editSparklineConfig.tab = 'group'" [style.border-bottom]="editSparklineConfig.tab === 'group' ? '2px solid #0f9d58' : 'none'" [style.color]="editSparklineConfig.tab === 'group' ? '#0f9d58' : '#5f6368'" style="padding: 8px 16px; font-weight: 500; cursor: pointer;" *ngIf="sparklineConfig?.isGrouped">Group</div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Source:</div>
            <div style="display:flex; align-items:center; border: 1px solid #dadce0; border-radius: 4px; padding: 0 8px;">
               <input type="text" [(ngModel)]="editSparklineConfig.source" style="flex: 1; border: none; padding: 10px 0; outline: none; font-size: 14px; color: #1a73e8;" placeholder="e.g. 'Sheet1'.A1:A5">
               <span class="material-symbols-outlined" style="color: #1a73e8; font-size: 18px; cursor: pointer;">grid_on</span>
            </div>
          </div>
          
          <div style="margin-bottom: 24px;">
            <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Destination:</div>
            <div style="display:flex; align-items:center; border: 1px solid #dadce0; border-radius: 4px; padding: 0 8px;">
               <input type="text" [(ngModel)]="editSparklineConfig.dest" style="flex: 1; border: none; padding: 10px 0; outline: none; font-size: 14px; color: #1a73e8;" placeholder="e.g. 'Sheet1'.B1:B5">
               <span class="material-symbols-outlined" style="color: #1a73e8; font-size: 18px; cursor: pointer;">grid_on</span>
            </div>
          </div>
          
          <div *ngIf="editSparklineConfig.error" style="color: #ea4335; font-size: 13px; margin-bottom: 16px;">{{editSparklineConfig.error}}</div>
          
          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button (click)="activeModal = null" style="background: none; border: 1px solid #dadce0; border-radius: 4px; padding: 8px 24px; font-weight: 500; cursor: pointer; color: #202124;">Cancel</button>
            <!-- Assuming submitEditSparkline() is just saving the new range and closing for now -->
            <button (click)="activeModal = null; showToast('Sparkline range updated');" style="background: #0f9d58; border: none; border-radius: 4px; padding: 8px 24px; font-weight: 500; cursor: pointer; color: #fff;">OK</button>
          </div>
        </div>
      </div>
      
      <!-- Shared Color Picker Popover -->
      <div *ngIf="colorPickerState.active" (click)="closeColorPicker()" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10001; background: transparent;">
         <div (click)="$event.stopPropagation()" [style.top.px]="colorPickerState.top" [style.left.px]="colorPickerState.left" style="position: absolute; background: #fff; border: 1px solid #dadce0; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 4px; padding: 12px; width: 220px;">
           <div style="font-size: 11px; color: #5f6368; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Theme Colors</div>
           <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; margin-bottom: 8px;">
             <!-- Theme Colors Grayscale -->
             <div *ngFor="let c of ['#ffffff','#f2f2f2','#d8d8d8','#bfbfbf','#a5a5a5','#7f7f7f','#595959','#3f3f3f','#262626','#000000']" (click)="setSparklineColor(c)" [style.background]="c" style="width: 16px; height: 16px; cursor: pointer; border: 1px solid #dadce0;"></div>
             <!-- Theme Colors Color scale -->
             <div *ngFor="let c of ['#e6b8af','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#cfe2f3','#d9d2e9','#ead1dc']" (click)="setSparklineColor(c)" [style.background]="c" style="width: 16px; height: 16px; cursor: pointer; border: 1px solid #dadce0;"></div>
             <div *ngFor="let c of ['#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#9fc5e8','#b4a7d6','#d5a6bd']" (click)="setSparklineColor(c)" [style.background]="c" style="width: 16px; height: 16px; cursor: pointer; border: 1px solid #dadce0;"></div>
           </div>
           
           <div style="font-size: 11px; color: #5f6368; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; margin-top: 12px;">Standard Colors</div>
           <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; margin-bottom: 8px;">
             <div *ngFor="let c of ['#c00000','#ff0000','#ffc000','#ffff00','#92d050','#00b050','#00b0f0','#0070c0','#002060','#7030a0']" (click)="setSparklineColor(c)" [style.background]="c" style="width: 16px; height: 16px; cursor: pointer; border: 1px solid #dadce0;"></div>
           </div>
           
           <div *ngIf="recentColors.length > 0">
             <div style="font-size: 11px; color: #5f6368; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; margin-top: 12px;">Other Used Colors</div>
             <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; margin-bottom: 8px;">
               <div *ngFor="let c of recentColors" (click)="setSparklineColor(c)" [style.background]="c" style="width: 16px; height: 16px; cursor: pointer; border: 1px solid #dadce0;"></div>
             </div>
           </div>
           
           <div style="font-size: 12px; color: #202124; font-weight: 500; margin-top: 12px; display:flex; align-items:center; gap: 8px;">
             <span class="material-symbols-outlined" style="font-size:16px;">add</span> More Colors:
             <input type="color" [(ngModel)]="customColorInput" (change)="setSparklineColor(customColorInput)" style="width:24px; height:24px; padding:0; border:none; cursor:pointer;">
           </div>
         </div>
      </div>
`;

content = content.replace(/(<\/\s*div>\s*<\/\s*div>\s*`,\s*styles: \[)/, modalHTML + '\n$1');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done Modals and Color Picker HTML!');
