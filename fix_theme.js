const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const t = `      <!-- Manage Lock Settings Modal -->
      <div class="modal-overlay" *ngIf="manageLockSettingsModalOpen" (click)="manageLockSettingsModalOpen=false" style="z-index:10000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5);">
        <div class="modal" (click)="$event.stopPropagation()" style="width:480px; background:#242424; color:#fff; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.5); display:flex; flex-direction:column; font-family:'Roboto',sans-serif; min-height: 300px;">
          
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px;">
            <div style="font-size:18px; font-weight:500;">Manage Lock Settings</div>
            <button (click)="manageLockSettingsModalOpen=false" style="background:none; border:none; cursor:pointer; color:#9aa0a6; display:flex; align-items:center;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          
          <!-- Tabs -->
          <div style="display:flex; padding:0 20px; border-bottom:1px solid #3c4043; gap: 24px;">
            <div (click)="lockSettingsTab = 'ranges'" [style.color]="lockSettingsTab === 'ranges' ? '#1da954' : '#e8eaed'" [style.border-bottom]="lockSettingsTab === 'ranges' ? '2px solid #1da954' : '2px solid transparent'" style="padding:10px 4px; cursor:pointer; font-weight:500; font-size:14px; transition: 0.2s;">Ranges</div>
            <div (click)="lockSettingsTab = 'sheets'" [style.color]="lockSettingsTab === 'sheets' ? '#1da954' : '#e8eaed'" [style.border-bottom]="lockSettingsTab === 'sheets' ? '2px solid #1da954' : '2px solid transparent'" style="padding:10px 4px; cursor:pointer; font-weight:500; font-size:14px; transition: 0.2s;">Sheets</div>
          </div>
          
          <!-- Body -->
          <div style="padding:20px; flex:1; display:flex; flex-direction:column;">
            <div *ngIf="lockSettingsTab === 'ranges'">
              <div style="display:flex; align-items:center; margin-bottom: 24px;">
                <span style="font-weight:600; font-size:14px; margin-right:16px;">View Locked Cells in:</span>
                <select [(ngModel)]="lockSettingsSelectedSheet" style="flex:1; background:#303134; color:#e8eaed; border:1px solid #5f6368; border-radius:4px; padding:8px 12px; font-size:14px; outline:none;">
                  <option value="all">Whole Spreadsheet</option>
                  <option *ngFor="let s of sheets; let i = index" [value]="i">{{ s.name }}</option>
                </select>
              </div>
              <div style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; color:#9aa0a6; font-size:14px;">
                No Locked Cells
              </div>
            </div>

            <div *ngIf="lockSettingsTab === 'sheets'">
              <div style="font-weight:600; font-size:14px; margin-bottom: 24px;">View Locked Sheet(s)</div>
              <div style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; color:#9aa0a6; font-size:14px;">
                No Locked Cells
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="padding:16px 20px; display:flex; justify-content:flex-end;">
            <button (click)="manageLockSettingsModalOpen=false" style="background:#3c4043; color:#e8eaed; border:none; padding:8px 16px; border-radius:4px; font-size:14px; font-weight:500; cursor:pointer;">Close</button>
          </div>
        </div>
      </div>`;

const r = `      <!-- Manage Lock Settings Modal -->
      <div class="modal-overlay" *ngIf="manageLockSettingsModalOpen" (click)="manageLockSettingsModalOpen=false" style="z-index:10000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5);">
        <div class="modal" (click)="$event.stopPropagation()" [style.background]="currentTheme === 'dark' ? '#242424' : '#fff'" [style.color]="currentTheme === 'dark' ? '#fff' : '#333'" style="width:480px; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.5); display:flex; flex-direction:column; font-family:'Roboto',sans-serif; min-height: 300px;">
          
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px;">
            <div style="font-size:18px; font-weight:500;">Manage Lock Settings</div>
            <button (click)="manageLockSettingsModalOpen=false" style="background:none; border:none; cursor:pointer; display:flex; align-items:center;" [style.color]="currentTheme === 'dark' ? '#9aa0a6' : '#5f6368'"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          
          <!-- Tabs -->
          <div style="display:flex; padding:0 20px; gap: 24px;" [style.border-bottom]="currentTheme === 'dark' ? '1px solid #3c4043' : '1px solid #e0e0e0'">
            <div (click)="lockSettingsTab = 'ranges'" [style.color]="lockSettingsTab === 'ranges' ? '#1da954' : (currentTheme === 'dark' ? '#e8eaed' : '#5f6368')" [style.border-bottom]="lockSettingsTab === 'ranges' ? '2px solid #1da954' : '2px solid transparent'" style="padding:10px 4px; cursor:pointer; font-weight:500; font-size:14px; transition: 0.2s;">Ranges</div>
            <div (click)="lockSettingsTab = 'sheets'" [style.color]="lockSettingsTab === 'sheets' ? '#1da954' : (currentTheme === 'dark' ? '#e8eaed' : '#5f6368')" [style.border-bottom]="lockSettingsTab === 'sheets' ? '2px solid #1da954' : '2px solid transparent'" style="padding:10px 4px; cursor:pointer; font-weight:500; font-size:14px; transition: 0.2s;">Sheets</div>
          </div>
          
          <!-- Body -->
          <div style="padding:20px; flex:1; display:flex; flex-direction:column;">
            <div *ngIf="lockSettingsTab === 'ranges'">
              <div style="display:flex; align-items:center; margin-bottom: 24px;">
                <span style="font-weight:600; font-size:14px; margin-right:16px;">View Locked Cells in:</span>
                <select [(ngModel)]="lockSettingsSelectedSheet" [style.background]="currentTheme === 'dark' ? '#303134' : '#fff'" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'" [style.border]="currentTheme === 'dark' ? '1px solid #5f6368' : '1px solid #ccc'" style="flex:1; border-radius:4px; padding:8px 12px; font-size:14px; outline:none;">
                  <option value="all">Whole Spreadsheet</option>
                  <option *ngFor="let s of sheets; let i = index" [value]="i">{{ s.name }}</option>
                </select>
              </div>
              <div style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; font-size:14px;" [style.color]="currentTheme === 'dark' ? '#9aa0a6' : '#5f6368'">
                No Locked Cells
              </div>
            </div>

            <div *ngIf="lockSettingsTab === 'sheets'">
              <div style="font-weight:600; font-size:14px; margin-bottom: 24px;">View Locked Sheet(s)</div>
              <div style="display:flex; justify-content:center; align-items:center; flex:1; min-height:120px; font-size:14px;" [style.color]="currentTheme === 'dark' ? '#9aa0a6' : '#5f6368'">
                No Locked Cells
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="padding:16px 20px; display:flex; justify-content:flex-end;">
            <button (click)="manageLockSettingsModalOpen=false" [style.background]="currentTheme === 'dark' ? '#3c4043' : '#f8f9fa'" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'" [style.border]="currentTheme === 'dark' ? 'none' : '1px solid #ccc'" style="padding:8px 16px; border-radius:4px; font-size:14px; font-weight:500; cursor:pointer;">Close</button>
          </div>
        </div>
      </div>`;
content = content.replace(t, r);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Theme bindings applied to modal!');
