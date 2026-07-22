const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add class variables
const classVars = `
  shortcutCategoryFilter: string = 'all';
  shortcutSearchQuery: string = '';

  shortcutCategories = [
    {
      name: 'File operations',
      id: 'file',
      shortcuts: [
        { desc: 'Save file', keys: ['Ctrl', 'S'] },
        { desc: 'Print file', keys: ['Ctrl', 'P'] }
      ]
    },
    {
      name: 'Edit actions',
      id: 'edit',
      shortcuts: [
        { desc: 'Undo last action', keys: ['Ctrl', 'Z'] },
        { desc: 'Redo last action', keys: ['Ctrl', 'Y'] },
        { desc: 'Cut', keys: ['Ctrl', 'X'] },
        { desc: 'Copy', keys: ['Ctrl', 'C'] },
        { desc: 'Paste', keys: ['Ctrl', 'V'] },
        { desc: 'Cancel cell entry', keys: ['Esc'] },
        { desc: 'Delete content of selected cell', keys: ['Backspace'] }
      ]
    },
    {
      name: 'Formatting',
      id: 'format',
      shortcuts: [
        { desc: 'Bold toggle for selection', keys: ['Ctrl', 'B'] },
        { desc: 'Italic toggle for selection', keys: ['Ctrl', 'I'] },
        { desc: 'Underline toggle for selection', keys: ['Ctrl', 'U'] },
        { desc: 'Strikethrough toggle for selection', keys: ['Ctrl', 'Shift', 'X'] },
        { desc: 'Add / Edit Hyperlink', keys: ['Ctrl', 'K'] },
        { desc: 'Insert the current date in cell', keys: ['Ctrl', ';'] },
        { desc: 'Insert the current time in cell', keys: ['Ctrl', 'Shift', ';'] },
        { desc: 'Increase Indentation', keys: ['Ctrl', 'M'] },
        { desc: 'Decrease Indentation', keys: ['Ctrl', 'Shift', 'M'] }
      ]
    },
    {
      name: 'Navigation & Data',
      id: 'nav',
      shortcuts: [
        { desc: 'Fill down', keys: ['Ctrl', 'D'] },
        { desc: 'Fill to the right', keys: ['Ctrl', 'R'] },
        { desc: 'Find within spreadsheet', keys: ['Ctrl', 'F'] },
        { desc: 'Move to next cell in row', keys: ['Tab'] },
        { desc: 'Move to previous cell in row', keys: ['Shift', 'Tab'] }
      ]
    },
    {
      name: 'Selection',
      id: 'sel',
      shortcuts: [
        { desc: 'Select whole spreadsheet', keys: ['Ctrl', 'A'] }
      ]
    }
  ];

  get filteredShortcutCategories() {
    return this.shortcutCategories.map(cat => {
      if (this.shortcutCategoryFilter !== 'all' && this.shortcutCategoryFilter !== cat.id) {
        return { ...cat, shortcuts: [] };
      }
      const q = this.shortcutSearchQuery.toLowerCase();
      const filtered = cat.shortcuts.filter(s => s.desc.toLowerCase().includes(q));
      return { ...cat, shortcuts: filtered };
    }).filter(cat => cat.shortcuts.length > 0);
  }
`;

content = content.replace('export class SheetEditorComponent implements OnInit, OnDestroy {', 'export class SheetEditorComponent implements OnInit, OnDestroy {' + classVars);


// 2. Replace the old static HTML with dynamic angular bindings
const oldHtmlStart = `<select style="flex:1;padding:8px 12px;border-radius:4px;border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};background:transparent;outline:none;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'">`;
const newHtmlStart = `<select [(ngModel)]="shortcutCategoryFilter" style="flex:1;padding:8px 12px;border-radius:4px;border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};background:transparent;outline:none;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'">`;
content = content.replace(oldHtmlStart, newHtmlStart);

const oldSearchInput = `<input type="text" placeholder="Search" style="width:100%;box-sizing:border-box;padding:8px 12px 8px 32px;border-radius:4px;border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};background:transparent;outline:none;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'" />`;
const newSearchInput = `<input type="text" [(ngModel)]="shortcutSearchQuery" placeholder="Search" style="width:100%;box-sizing:border-box;padding:8px 12px 8px 32px;border-radius:4px;border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#e0e0e0' }};background:transparent;outline:none;" [style.color]="currentTheme === 'dark' ? '#e8eaed' : '#333'" />`;
content = content.replace(oldSearchInput, newSearchInput);

// Update dropdown options
const oldDropdownOpts = `<option value="all" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">All Shortcuts</option>
                  <option value="file" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">File operations</option>
                  <option value="edit" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">Edit actions</option>`;
const newDropdownOpts = `<option value="all" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">All Shortcuts</option>
                  <option *ngFor="let cat of shortcutCategories" [value]="cat.id" [style.background]="currentTheme === 'dark' ? '#202124' : '#fff'">{{cat.name}}</option>`;
content = content.replace(oldDropdownOpts, newDropdownOpts);

// Replace static list with *ngFor
const listRegex = /<div style="flex:1;overflow-y:auto;padding-top:12px;font-size:13px;color:\{\{ currentTheme === 'dark' \? '#bdc1c6' : '#5f6368' \}\};">.*?<\/div>\s*<div style="padding-top:16px;border-top:1px solid/s;

const newListHtml = `<div style="flex:1;overflow-y:auto;padding-top:12px;font-size:13px;color:{{ currentTheme === 'dark' ? '#bdc1c6' : '#5f6368' }};">
                <ng-container *ngFor="let cat of filteredShortcutCategories">
                  <div style="font-weight:600;color:{{ currentTheme === 'dark' ? '#e8eaed' : '#202124' }};margin:16px 0 8px;">{{cat.name}}</div>
                  <div *ngFor="let s of cat.shortcuts" style="display:flex;align-items:center;margin-bottom:12px;">
                    <div style="flex:2;">{{s.desc}}</div>
                    <div style="flex:1;display:flex;gap:4px;">
                      <span *ngFor="let k of s.keys" style="background:{{ currentTheme === 'dark' ? '#3c4043' : '#f8f9fa' }};border:1px solid {{ currentTheme === 'dark' ? '#5f6368' : '#dadce0' }};border-radius:4px;padding:2px 6px;">{{k}}</span>
                    </div>
                  </div>
                </ng-container>
                <div *ngIf="filteredShortcutCategories.length === 0" style="padding: 24px 0; text-align: center; color: #888; font-style: italic;">
                  No shortcuts found matching your search.
                </div>
              </div>
              <div style="padding-top:16px;border-top:1px solid`;

content = content.replace(listRegex, newListHtml);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done!');
