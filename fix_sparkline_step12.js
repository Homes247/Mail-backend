const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const replacement = `      <!-- Edit Sparkline Modal -->
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
               <input type="text" [(ngModel)]="editSparklineConfig.source" style="flex: 1; border: none; padding: 10px 0; outline: none; font-size: 14px;">
               <span class="material-symbols-outlined" style="color: #1a73e8; font-size: 18px; cursor: pointer;">grid_on</span>
            </div>
            <div *ngIf="editSparklineConfig.error" style="color: #ea4335; font-size: 11px; margin-top: 4px;">{{ editSparklineConfig.error }}</div>
          </div>
          
          <div style="margin-bottom: 24px;">
            <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Location:</div>
            <div style="display:flex; align-items:center; border: 1px solid #dadce0; border-radius: 4px; padding: 0 8px;">
               <input type="text" [(ngModel)]="editSparklineConfig.dest" style="flex: 1; border: none; padding: 10px 0; outline: none; font-size: 14px;" [disabled]="true" [style.background]="'#f8f9fa'">
               <span class="material-symbols-outlined" style="color: #5f6368; font-size: 18px; cursor: not-allowed;">grid_on</span>
            </div>
            <div style="font-size: 11px; color: #5f6368; margin-top: 4px;">Location cannot be changed.</div>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button (click)="activeModal = null" style="background: none; border: 1px solid #dadce0; border-radius: 4px; padding: 8px 24px; font-weight: 500; cursor: pointer; color: #202124;">Cancel</button>
            <button (click)="submitEditSparkline()" style="background: #0f9d58; border: none; border-radius: 4px; padding: 8px 24px; font-weight: 500; cursor: pointer; color: #fff;">OK</button>
          </div>
        </div>
      </div>
`;

content = content.replace(/<!-- Edit Sparkline Modal -->[\s\S]*?`,\n  styles: \[/, replacement + '\n  `,\n  styles: [');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed Edit Sparkline Modal structural errors!');
