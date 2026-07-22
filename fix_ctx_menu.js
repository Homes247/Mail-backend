const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/app/pages/sheet-editor/sheet-editor.component.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const oldInsert = /<ng-container \*ngIf="activeCtxSubmenu === 'insert'">.*?<\/ng-container>/s;
const newInsert = `<ng-container *ngIf="activeCtxSubmenu === 'insert'">
            <div class="ctx-item" (click)="shiftCellsRight(); hideCtx()">Shift Cells Right</div>
            <div class="ctx-item" (click)="shiftCellsDown(); hideCtx()">Shift Cells Down</div>
            <div class="ctx-sep"></div>
            <div class="ctx-item" (click)="insertRowAbove(); hideCtx()">{{ selectedRowCount }} Row{{ selectedRowCount > 1 ? 's' : '' }} Above</div>
            <div class="ctx-item" (click)="insertRowBelow(); hideCtx()">{{ selectedRowCount }} Row{{ selectedRowCount > 1 ? 's' : '' }} Below</div>
            <div class="ctx-item" (click)="customInsertRow(); hideCtx()">Custom...</div>
            <div class="ctx-sep"></div>
            <div class="ctx-item" (click)="insertColLeft(); hideCtx()">Column Before</div>
            <div class="ctx-item" (click)="insertColRight(); hideCtx()">Column After</div>
            <div class="ctx-item" (click)="customInsertCol(); hideCtx()">Custom...</div>
        </ng-container>`;

const oldDelete = /<ng-container \*ngIf="activeCtxSubmenu === 'delete'">.*?<\/ng-container>/s;
const newDelete = `<ng-container *ngIf="activeCtxSubmenu === 'delete'">
            <div class="ctx-item danger" (click)="shiftCellsLeft(); hideCtx()">Shift Cells Left</div>
            <div class="ctx-item danger" (click)="shiftCellsUp(); hideCtx()">Shift Cells Up</div>
            <div class="ctx-sep"></div>
            <div class="ctx-item danger" (click)="deleteRow(); hideCtx()">Delete {{ selectedRowCount }} Row{{ selectedRowCount > 1 ? 's' : '' }}</div>
            <div class="ctx-item danger" (click)="deleteCol(); hideCtx()">Delete {{ selectedColCount }} Column{{ selectedColCount > 1 ? 's' : '' }}</div>
        </ng-container>`;

content = content.replace(oldInsert, newInsert);
content = content.replace(oldDelete, newDelete);

// Also need to add the dummy functions
const dummyFns = `
  shiftCellsRight() { this.showToast('Shift Cells Right not implemented'); }
  shiftCellsDown() { this.showToast('Shift Cells Down not implemented'); }
  shiftCellsLeft() { this.showToast('Shift Cells Left not implemented'); }
  shiftCellsUp() { this.showToast('Shift Cells Up not implemented'); }
  customInsertRow() { this.showToast('Custom Insert Row not implemented'); }
  customInsertCol() { this.showToast('Custom Insert Column not implemented'); }

  insertRowAbove() {`;

content = content.replace('insertRowAbove() {', dummyFns);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replaced context menus and added stub functions!');
