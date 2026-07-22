const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add 'shortcuts' to activeModal union type
const oldType = `activeModal: 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | 'form' | 'view_form' | 'manage_forms' | 'macro' | 'edit_macro' | 'functions' | 'merge' | 'goto' | null = null;`;
const newType = `activeModal: 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | 'form' | 'view_form' | 'manage_forms' | 'macro' | 'edit_macro' | 'functions' | 'merge' | 'goto' | 'shortcuts' | null = null;`;
content = content.replace(oldType, newType);

// 2. Add shortcuts modal HTML right after manage_forms modal
const manageFormsHtml = `<button (click)="createForm()" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Create Form</button>
                <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
              </div>
            </div>`;

const shortcutsHtml = `${manageFormsHtml}
            
            <!-- Shortcuts Modal -->
            <div *ngIf="activeModal === 'shortcuts'" style="width: 500px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:18px;font-weight:600;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#202124'">Keyboard Shortcuts</h3>
                <span class="material-symbols-outlined" style="cursor:pointer;color:#5f6368;" (click)="activeModal=null">close</span>
              </div>
              
              <div style="display:flex;gap:12px;margin-bottom:16px;">
                <select style="flex:1;padding:8px 12px;border-radius:4px;border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};background:transparent;outline:none;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'">
                  <option value="all" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">All Shortcuts</option>
                  <option value="file" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">File operations</option>
                  <option value="edit" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">Edit actions</option>
                </select>
                <div style="flex:1;position:relative;">
                  <span class="material-symbols-outlined" style="position:absolute;left:8px;top:8px;font-size:18px;color:#9aa0a6;">search</span>
                  <input type="text" placeholder="Search" style="width:100%;box-sizing:border-box;padding:8px 12px 8px 32px;border-radius:4px;border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};background:transparent;outline:none;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'" />
                </div>
              </div>
              
              <div style="display:flex;font-weight:600;font-size:14px;padding-bottom:8px;border-bottom:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};color:{{ currentTheme === 'dark' ? '#e8eaed' : '#333' }};">
                <div style="flex:2;">Description</div>
                <div style="flex:1;">Shortcut</div>
              </div>
              
              <div style="flex:1;overflow-y:auto;padding-top:12px;font-size:13px;color:{{ currentTheme === 'dark' ? '#bdc1c6' : '#5f6368' }};">
                <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:16px 0 8px;">File operations</div>
                <div style="display:flex;align-items:center;margin-bottom:12px;">
                  <div style="flex:2;">Open file</div>
                  <div style="flex:1;display:flex;gap:4px;">
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Ctrl</span>
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">O</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;margin-bottom:12px;">
                  <div style="flex:2;">Save as file</div>
                  <div style="flex:1;display:flex;gap:4px;">
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Ctrl</span>
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Shift</span>
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">S</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;margin-bottom:12px;">
                  <div style="flex:2;">Print file</div>
                  <div style="flex:1;display:flex;gap:4px;">
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Ctrl</span>
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">P</span>
                  </div>
                </div>
                
                <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:24px 0 8px;">Edit actions</div>
                <div style="display:flex;align-items:center;margin-bottom:12px;">
                  <div style="flex:2;">Undo</div>
                  <div style="flex:1;display:flex;gap:4px;">
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Ctrl</span>
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Z</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;margin-bottom:12px;">
                  <div style="flex:2;">Redo</div>
                  <div style="flex:1;display:flex;gap:4px;">
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Ctrl</span>
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Y</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;margin-bottom:12px;">
                  <div style="flex:2;">Bold</div>
                  <div style="flex:1;display:flex;gap:4px;">
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">Ctrl</span>
                    <span style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">B</span>
                  </div>
                </div>
              </div>
              
              <div style="padding-top:16px;border-top:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="overrideShortcuts" checked style="accent-color:#10b981;" />
                <label for="overrideShortcuts" style="font-size:13px;color:{{ currentTheme === 'dark' ? '#bdc1c6' : '#5f6368' }};">Override browser shortcuts</label>
                <span class="material-symbols-outlined" style="font-size:14px;color:#9aa0a6;">info</span>
              </div>
            </div>`;

content = content.replace(manageFormsHtml, shortcutsHtml);

// 3. Update showKeyboardShortcuts method
const oldMethod = `  showKeyboardShortcuts() {
    this.closeMenus();
    alert('Keyboard Shortcuts:\\n\\nCtrl+Z  Undo\\nCtrl+Y  Redo\\nCtrl+B  Bold\\nCtrl+I  Italic\\nCtrl+K  Insert link\\nTab     Next cell\\nEnter   Next row\\nDelete  Clear cell');
  }`;

const newMethod = `  showKeyboardShortcuts() {
    this.closeMenus();
    this.activeModal = 'shortcuts';
  }`;

content = content.replace(oldMethod, newMethod);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Shortcuts modal added!');
