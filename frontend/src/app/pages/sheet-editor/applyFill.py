import re

content = open('c:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts', encoding='utf-8').read()

# Chunk 1: HTML
chunk1_target = '''                <!-- Fill handle: only show on the bottom-right cell of the selection -->
                <div *ngIf="isFillHandleCell(r, c)"
                  class="fill-handle"
                  (mousedown)="onFillHandleMouseDown($event, r, c)"
                  title="Drag to fill"></div>
                </td>'''

chunk1_replacement = '''                <!-- Fill handle: only show on the bottom-right cell of the selection -->
                <div *ngIf="isFillHandleCell(r, c)"
                  class="fill-handle"
                  (mousedown)="onFillHandleMouseDown($event, r, c)"
                  title="Drag to fill">
                  
                  <div *ngIf="fillPopupState?.showIcon && !isDraggingRange && !isFilling" 
                       class="fill-options-icon"
                       (click)="fillPopupState!.showMenu = !fillPopupState!.showMenu; $event.stopPropagation()">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                       <rect x="3" y="3" width="18" height="18" rx="2"/>
                       <path d="M9 3v18 M3 9h18" />
                       <path d="M14 14h4 M16 12v4" stroke="#000" />
                     </svg>
                     <span class="material-symbols-outlined" style="font-size:14px; margin-left: 2px;">expand_more</span>
                     
                     <div class="fill-options-menu" *ngIf="fillPopupState?.showMenu">
                        <div class="fom-item" (click)="executeFillMode('Fill Series'); $event.stopPropagation()">
                          <span class="material-symbols-outlined fom-chk" [style.visibility]="fillPopupState!.mode === 'Fill Series' ? 'visible' : 'hidden'">check</span> Fill Series
                        </div>
                        <div class="fom-item" (click)="executeFillMode('Copy Cells'); $event.stopPropagation()">
                          <span class="material-symbols-outlined fom-chk" [style.visibility]="fillPopupState!.mode === 'Copy Cells' ? 'visible' : 'hidden'">check</span> Copy Cells
                        </div>
                        <div class="fom-item" (click)="executeFillMode('Fill Formatting'); $event.stopPropagation()">
                          <span class="material-symbols-outlined fom-chk" [style.visibility]="fillPopupState!.mode === 'Fill Formatting' ? 'visible' : 'hidden'">check</span> Fill Formatting
                        </div>
                        <div class="fom-item" (click)="executeFillMode('Fill Without Formatting'); $event.stopPropagation()">
                          <span class="material-symbols-outlined fom-chk" [style.visibility]="fillPopupState!.mode === 'Fill Without Formatting' ? 'visible' : 'hidden'">check</span> Fill Without Formatting
                        </div>
                     </div>
                  </div>
                </div>
                </td>'''

# Chunk 2: CSS
chunk2_target = '''    .fill-handle { background:#34a853; border:2px solid #fff; border-radius:50%; bottom:-5px; right:-5px; cursor:crosshair; height:8px; position:absolute; width:8px; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,.4); }'''
chunk2_replacement = '''    .fill-handle { background:#107c41; border:1px solid #fff; border-radius:0; bottom:-4px; right:-4px; cursor:crosshair; height:7px; width:7px; position:absolute; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,.4); }
    .fill-options-icon { position: absolute; top: 10px; left: 10px; background: #333; color: #fff; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 50; padding: 2px 4px; }
    .fill-options-menu { position: absolute; top: 100%; left: 0; margin-top: 4px; background: #2a2a2a; color: #fff; border-radius: 6px; padding: 8px 0; width: 200px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 51; font-family: inherit; font-size: 13px; line-height: 1.2; text-align: left; }
    .fom-item { padding: 8px 16px; display: flex; align-items: center; cursor: pointer; white-space: nowrap; }
    .fom-item:hover { background: #3a3a3a; }
    .fom-chk { font-size: 16px; margin-right: 8px; }'''

# Chunk 3: variables
chunk3_target = '''  fillEnd: { r: number, c: number } | null = null;
  private fillStart: { r: number, c: number } | null = null;'''
chunk3_replacement = '''  fillEnd: { r: number, c: number } | null = null;
  private fillStart: { r: number, c: number } | null = null;
  fillPopupState: {
    srcMinR: number; srcMaxR: number;
    srcMinC: number; srcMaxC: number;
    dstMinR: number; dstMaxR: number;
    dstMinC: number; dstMaxC: number;
    goDown: boolean; goUp: boolean; goRight: boolean; goLeft: boolean;
    sourceData: {r: number, c: number, val: string, format: any}[];
    targetBackup: {r: number, c: number, val: string, format: any}[];
    mode: 'Fill Series' | 'Copy Cells' | 'Fill Formatting' | 'Fill Without Formatting';
    showIcon: boolean;
    showMenu: boolean;
    ctrlKey: boolean;
  } | null = null;'''

# Chunk 4: event handlers
chunk4_target = '''  @HostListener('document:mouseup')
  onDocMouseUp() {
    if (this.isFilling && this.fillEnd) {
      this.applyFill();
    }
    this.isDraggingRange = false;
    this.isFilling = false;
    this.fillStart = null;
  }

  // -- Range selection helpers ----------------------------------------------
  onCellMouseDown(e: MouseEvent, r: number, c: number) {
    if ((e.target as HTMLElement).classList.contains('fill-handle')) return;'''
chunk4_replacement = '''  @HostListener('document:mouseup', ['$event'])
  onDocMouseUp(e: MouseEvent) {
    if (this.isFilling && this.fillEnd) {
      this.applyFill(e.ctrlKey || e.metaKey);
    }
    this.isDraggingRange = false;
    this.isFilling = false;
    this.fillStart = null;
    if (this.fillPopupState?.showMenu) {
       const target = e.target as HTMLElement;
       if (!target.closest('.fill-options-icon')) {
          this.fillPopupState.showMenu = false;
       }
    }
  }

  // -- Range selection helpers ----------------------------------------------
  onCellMouseDown(e: MouseEvent, r: number, c: number) {
    if (this.fillPopupState) this.fillPopupState = null;
    if ((e.target as HTMLElement).classList.contains('fill-handle')) return;'''

# Chunk 5: replace logic
chunk5_start = content.find('  private applyFill() {')
chunk5_end = content.find('  // -- Column / Row header selection ----------------------------------------', chunk5_start)
chunk5_target = content[chunk5_start:chunk5_end]

chunk5_replacement = '''  private applyFill(ctrlKey: boolean = false) {
    if (!this.fillStart || !this.fillEnd) return;
    
    const srcMinR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.fillStart.r;
    const srcMaxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.fillStart.r;
    const srcMinC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.fillStart.c;
    const srcMaxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.fillStart.c;

    const dstR = this.fillEnd.r;
    const dstC = this.fillEnd.c;

    const goDown = dstR > srcMaxR;
    const goUp = dstR < srcMinR;
    const goRight = dstC > srcMaxC;
    const goLeft = dstC < srcMinC;

    if (!goDown && !goUp && !goRight && !goLeft) {
      this.fillEnd = null;
      this.onCellChange();
      return;
    }

    this.pushHistory();

    const newMinR = Math.min(srcMinR, dstR);
    const newMaxR = Math.max(srcMaxR, dstR);
    const newMinC = Math.min(srcMinC, dstC);
    const newMaxC = Math.max(srcMaxC, dstC);

    const sourceData: any[] = [];
    for (let r = srcMinR; r <= srcMaxR; r++) {
      for (let c = srcMinC; c <= srcMaxC; c++) {
        sourceData.push({ r, c, val: this.cells[r][c], format: JSON.parse(JSON.stringify(this.formats[${r},] || {})) });
      }
    }

    const targetBackup: any[] = [];
    for (let r = newMinR; r <= newMaxR; r++) {
      for (let c = newMinC; c <= newMaxC; c++) {
        if (r >= srcMinR && r <= srcMaxR && c >= srcMinC && c <= srcMaxC) continue;
        targetBackup.push({ r, c, val: this.cells[r][c], format: JSON.parse(JSON.stringify(this.formats[${r},] || {})) });
      }
    }

    this.fillPopupState = {
      srcMinR, srcMaxR, srcMinC, srcMaxC,
      dstMinR: newMinR, dstMaxR: newMaxR, dstMinC: newMinC, dstMaxC: newMaxC,
      goDown, goUp, goRight, goLeft,
      sourceData, targetBackup,
      mode: 'Fill Series',
      showIcon: true,
      showMenu: false,
      ctrlKey
    };

    this.executeFillMode('Fill Series');

    this.rangeStart = { r: newMinR, c: newMinC };
    this.rangeEnd = { r: newMaxR, c: newMaxC };
    this.selectedRow = newMinR;
    this.selectedCol = newMinC;
    this.fillEnd = null;
    this.onCellChange();
    this.save();
  }

  executeFillMode(mode: 'Fill Series' | 'Copy Cells' | 'Fill Formatting' | 'Fill Without Formatting') {
    if (!this.fillPopupState) return;
    this.fillPopupState.mode = mode;
    const { srcMinR, srcMaxR, srcMinC, srcMaxC, dstMinR, dstMaxR, dstMinC, dstMaxC, goDown, goUp, goRight, goLeft, sourceData, targetBackup, ctrlKey } = this.fillPopupState;

    for (const b of targetBackup) {
      this.cells[b.r][b.c] = b.val;
      this.formats[${b.r},] = JSON.parse(JSON.stringify(b.format));
    }

    const srcRows = srcMaxR - srcMinR + 1;
    const srcCols = srcMaxC - srcMinC + 1;
    const getSrc = (r: number, c: number) => sourceData.find(s => s.r === r && s.c === c);

    if (goDown || goUp) {
      for (let c = srcMinC; c <= srcMaxC; c++) {
        const srcVals: string[] = [];
        for (let r = srcMinR; r <= srcMaxR; r++) srcVals.push(getSrc(r, c)!.val);
        
        const fillTargetCells = (startR: number, endR: number, step: number, isReversed: boolean) => {
          let offset = 1;
          for (let r = startR; r !== endR + step; r += step) {
            const srcR = isReversed ? (srcMaxR - ((offset - 1) % srcRows)) : (srcMinR + ((offset - 1) % srcRows));
            const srcItem = getSrc(srcR, c)!;

            if (mode === 'Fill Formatting') {
              this.formats[${r},] = JSON.parse(JSON.stringify(srcItem.format));
            } else if (mode === 'Copy Cells' || mode === 'Fill Without Formatting') {
              this.cells[r][c] = this.shiftFormula(srcItem.val, r - srcR, 0); 
              if (mode === 'Copy Cells') {
                this.formats[${r},] = JSON.parse(JSON.stringify(srcItem.format));
              }
            } else if (mode === 'Fill Series') {
              this.cells[r][c] = this.getNextSeriesValueEx(srcVals, offset, true, ctrlKey, isReversed);
              this.formats[${r},] = JSON.parse(JSON.stringify(srcItem.format));
            }
            offset++;
          }
        };

        if (goDown) fillTargetCells(srcMaxR + 1, dstMaxR, 1, false);
        else fillTargetCells(srcMinR - 1, dstMinR, -1, true);
      }
    } else if (goRight || goLeft) {
      for (let r = srcMinR; r <= srcMaxR; r++) {
        const srcVals: string[] = [];
        for (let c = srcMinC; c <= srcMaxC; c++) srcVals.push(getSrc(r, c)!.val);

        const fillTargetCells = (startC: number, endC: number, step: number, isReversed: boolean) => {
          let offset = 1;
          for (let c = startC; c !== endC + step; c += step) {
            const srcC = isReversed ? (srcMaxC - ((offset - 1) % srcCols)) : (srcMinC + ((offset - 1) % srcCols));
            const srcItem = getSrc(r, srcC)!;

            if (mode === 'Fill Formatting') {
              this.formats[${r},] = JSON.parse(JSON.stringify(srcItem.format));
            } else if (mode === 'Copy Cells' || mode === 'Fill Without Formatting') {
              this.cells[r][c] = this.shiftFormula(srcItem.val, 0, c - srcC);
              if (mode === 'Copy Cells') {
                this.formats[${r},] = JSON.parse(JSON.stringify(srcItem.format));
              }
            } else if (mode === 'Fill Series') {
              this.cells[r][c] = this.getNextSeriesValueEx(srcVals, offset, false, ctrlKey, isReversed);
              this.formats[${r},] = JSON.parse(JSON.stringify(srcItem.format));
            }
            offset++;
          }
        };

        if (goRight) fillTargetCells(srcMaxC + 1, dstMaxC, 1, false);
        else fillTargetCells(srcMinC - 1, dstMinC, -1, true);
      }
    }
    this.onCellChange();
  }

  private shiftFormula(val: string, rowDelta: number, colDelta: number): string {
    if (!val.startsWith('=')) return val;
    return val.replace(/\True[A-Z]+\True\d+/g, (match) => {
      if (match.includes('$')) return match; 
      const colStr = match.match(/^[A-Z]+/)[0];
      const rowStr = match.match(/\d+$/)[0];
      let colIdx = 0;
      for (let i = 0; i < colStr.length; i++) {
        colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
      }
      colIdx -= 1;
      let rowIdx = parseInt(rowStr, 10) - 1;

      colIdx += colDelta;
      rowIdx += rowDelta;

      if (colIdx < 0) colIdx = 0;
      if (rowIdx < 0) rowIdx = 0;

      let newColStr = '';
      let temp = colIdx;
      while (temp >= 0) {
        newColStr = String.fromCharCode((temp % 26) + 65) + newColStr;
        temp = Math.floor(temp / 26) - 1;
      }
      return ${newColStr};
    });
  }

  private getNextSeriesValueEx(srcVals: string[], offsetSteps: number, isVertical: boolean, ctrlKey: boolean, isReversed: boolean): string {
    if (srcVals.length === 0) return '';
    const srcLen = srcVals.length;

    let cycleIdx = 0;
    if (!isReversed) {
      cycleIdx = (srcLen - 1 + offsetSteps) % srcLen;
    } else {
      cycleIdx = (srcLen - (offsetSteps % srcLen)) % srcLen;
      if (cycleIdx < 0) cycleIdx += srcLen;
    }
    
    let v = srcVals[cycleIdx];

    if (v.startsWith('=')) {
      let dist = 0;
      if (!isReversed) dist = (srcLen - 1 + offsetSteps) - cycleIdx;
      else dist = -offsetSteps - cycleIdx;
      return this.shiftFormula(v, isVertical ? dist : 0, isVertical ? 0 : dist);
    }

    const isSingle = srcLen === 1;
    let trySequence = false;
    let isCopy = false;
    
    if (isSingle) {
      if (ctrlKey) trySequence = true;
      else isCopy = true; 
    } else {
      if (ctrlKey) isCopy = true;
      else trySequence = true;
    }

    const isNum = (str: string) => !isNaN(Number(str)) && str.trim() !== '';

    if (trySequence) {
       let targetIndex = !isReversed ? (srcLen - 1 + offsetSteps) : (-offsetSteps);
       
       if (isSingle) {
          if (isNum(srcVals[0])) return String(Number(srcVals[0]) + targetIndex);
       } else {
          const nums = srcVals.map(s => Number(s));
          if (nums.every(n => !isNaN(n) && srcVals[nums.indexOf(n)].trim() !== '')) {
             const step = nums[1] - nums[0];
             return String(nums[0] + targetIndex * step);
          }
       }

       const matchTrailing = (s: string) => {
         const m = s.match(/^(.*?)(\d+)$/);
         return m ? { prefix: m[1], num: parseInt(m[2], 10) } : null;
       };
       
       if (isSingle) {
         const m = matchTrailing(srcVals[0]);
         if (m) {
            return ${m.prefix};
         }
       } else {
         const m0 = matchTrailing(srcVals[0]);
         const m1 = matchTrailing(srcVals[1]);
         if (m0 && m1 && m0.prefix === m1.prefix) {
            const step = m1.num - m0.num;
            return ${m0.prefix};
         }
       }
       
       const parseDate = (s: string) => {
         const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
         if (m) {
           const mon = parseInt(m[1], 10);
           const d = parseInt(m[2], 10);
           let y = parseInt(m[3], 10);
           if (y < 100) y += 2000;
           return { y, m: mon, d, origString: s, isTwoDigitY: m[3].length === 2 };
         }
         return null;
       };
       
       if (isSingle) {
          const d = parseDate(srcVals[0]);
          if (d) {
             const dt = new Date(d.y, d.m - 1, d.d);
             dt.setDate(dt.getDate() + targetIndex);
             const nm = String(dt.getMonth() + 1).padStart(2, '0');
             const nd = String(dt.getDate()).padStart(2, '0');
             const ny = d.isTwoDigitY ? String(dt.getFullYear()).slice(2) : String(dt.getFullYear());
             return ${nm}--;
          }
       } else {
          const d0 = parseDate(srcVals[0]);
          const d1 = parseDate(srcVals[1]);
          if (d0 && d1) {
             const dt0 = new Date(d0.y, d0.m - 1, d0.d);
             const dt1 = new Date(d1.y, d1.m - 1, d1.d);
             const diffTime = Math.abs(dt1.getTime() - dt0.getTime());
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) * (dt1 > dt0 ? 1 : -1);
             
             const dt = new Date(d0.y, d0.m - 1, d0.d);
             dt.setDate(dt.getDate() + targetIndex * diffDays);
             const nm = String(dt.getMonth() + 1).padStart(2, '0');
             const nd = String(dt.getDate()).padStart(2, '0');
             const ny = d0.isTwoDigitY ? String(dt.getFullYear()).slice(2) : String(dt.getFullYear());
             return ${nm}--;
          }
       }
    }

    return v;
  }
'''

content = content.replace(chunk1_target, chunk1_replacement)
content = content.replace(chunk2_target, chunk2_replacement)
content = content.replace(chunk3_target, chunk3_replacement)
content = content.replace(chunk4_target, chunk4_replacement)
content = content.replace(chunk5_target, chunk5_replacement)

open('c:/Users/Homes247/Desktop/office-suite_Test/frontend/src/app/pages/sheet-editor/sheet-editor.component.ts', 'w', encoding='utf-8').write(content)
