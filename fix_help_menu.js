const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Fix activeModal type
const oldType = `activeModal: 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | 'form' | 'view_form' | 'macro' | 'edit_macro' | 'functions' | 'merge' | 'goto' | null = null;`;
const newType = `activeModal: 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | 'form' | 'view_form' | 'manage_forms' | 'macro' | 'edit_macro' | 'functions' | 'merge' | 'goto' | null = null;`;
content = content.replace(oldType, newType);

// 2. Remove items from Help menu
const oldHelpMenu = `<div style="padding: 6px 12px 8px;">
              <div style="display:flex; align-items:center; gap:6px; background:#f8f9fa; border:1px solid #e2e8f0; border-radius:4px; padding:6px 10px;">
                <span class="material-symbols-outlined" style="font-size:16px; color:#9aa0a6;">search</span>
                <input placeholder="Search in menus" [(ngModel)]="menuSearch" (click)="$event.stopPropagation()" style="border:none; background:transparent; outline:none; font-size:13px; width:100%;" />
                <span style="font-size:11px; color:#9aa0a6;">Ctrl+Shift+Space</span>
              </div>
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="openWhatsNew(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">card_giftcard</span> What's New
            </div>
            <div class="mdi" (click)="openUserGuide(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">menu_book</span> User Guide
            </div>
            <div class="mdi" (click)="openDeveloperApi(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">api</span> Developer API
            </div>
            <div class="mds"></div>`;

content = content.replace(oldHelpMenu, ``);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed TS error and removed help menu items!');
