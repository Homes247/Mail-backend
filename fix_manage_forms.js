const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the generic "View Form Responses" menu item with "Manage Forms"
const tMenu = `<div class="mdi" (click)="viewForm(); closeMenus()">View Form Responses</div>`;
const rMenu = `<div class="mdi" (click)="manageForms(); closeMenus()">Manage Forms</div>`;
content = content.replace(tMenu, rMenu);

// Replace the activeModal view_form with manage_form
const tModal = `<div *ngIf="activeModal === 'view_form'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#8b5cf6;font-size:24px;">forum</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Form Responses Dashboard</h3>
              </div>
              <div style="text-align:center;padding:20px;color:#5f6368;">
                <span class="material-symbols-outlined" style="font-size:48px;color:#10b981;margin-bottom:12px;">check_circle</span>
                <p style="font-size:14px;margin-bottom:8px;">Your spreadsheet is actively collecting form responses.</p>
                <p style="font-size:12px;color:#9aa0a6;">All submitted data is directly appended to the active sheet.</p>
              </div>
              <div style="display:flex;justify-content:flex-end;">
                <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
              </div>
            </div>`;

const rModal = `<div *ngIf="activeModal === 'manage_forms'" style="width: 700px; max-width: 90vw;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;font-size:18px;font-weight:600;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#202124'">Manage Form</h3>
                <span class="material-symbols-outlined" style="cursor:pointer;color:#5f6368;" (click)="activeModal=null">close</span>
              </div>
              
              <div style="margin-bottom: 20px; border-radius: 4px; border: 1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }}; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'">
                  <thead>
                    <tr style="background-color: {{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }}; border-bottom: 1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};">
                      <th style="padding: 12px 16px; font-weight: 600;">Form Name</th>
                      <th style="padding: 12px 16px; font-weight: 600;">Sheet</th>
                      <th style="padding: 12px 16px; font-weight: 600;">Link</th>
                      <th style="padding: 12px 16px; font-weight: 600;">Status</th>
                      <th style="padding: 12px 16px; font-weight: 600; text-align: center;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};">
                      <td style="padding: 12px 16px;">Homes247.in Bug Tracker</td>
                      <td style="padding: 12px 16px;">
                        <span style="background: #e8f0fe; color: #1967d2; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">Form Response1</span>
                      </td>
                      <td style="padding: 12px 16px;">
                        <span class="material-symbols-outlined" style="font-size: 18px; color: #5f6368; cursor: pointer;">link</span>
                      </td>
                      <td style="padding: 12px 16px; color: #12b3a8; font-weight: 500;">Unpublished</td>
                      <td style="padding: 12px 16px; text-align: center; position: relative;">
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #5f6368; cursor: pointer;" (click)="showFormActionMenu = !showFormActionMenu">more_vert</span>
                        
                        <div *ngIf="showFormActionMenu" style="position: absolute; right: 20px; top: 30px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.2); border-radius: 4px; z-index: 100; min-width: 120px; text-align: left;">
                          <div class="ctx-item" (click)="showFormActionMenu=false" style="padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;"><span class="material-symbols-outlined" style="font-size:16px;">edit</span> Edit</div>
                          <div class="ctx-item" (click)="showFormActionMenu=false" style="padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;"><span class="material-symbols-outlined" style="font-size:16px;">visibility</span> Preview</div>
                          <div class="ctx-item" (click)="showFormActionMenu=false" style="padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #ea4335;"><span class="material-symbols-outlined" style="font-size:16px;">delete</span> Delete</div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div style="display:flex;justify-content:space-between;">
                <button (click)="createForm()" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Create Form</button>
                <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
              </div>
            </div>`;

content = content.replace(tModal, rModal);

const tMethod = `  viewForm() {
    this.activeModal = 'view_form';
  }`;

const rMethod = `  showFormActionMenu = false;
  manageForms() {
    this.activeModal = 'manage_forms';
    this.showFormActionMenu = false;
  }`;

content = content.replace(tMethod, rMethod);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Manage Form modal added!');
