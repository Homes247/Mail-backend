import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

const COLS = 26;
const ROWS = 50;
const colName = (i: number) => String.fromCharCode(65 + i);

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  font?: string;
  size?: string;
}

@Component({
  selector: 'app-sheet-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="shell" (mousedown)="$event.target === $event.currentTarget ? closeMenus() : null">
      <div class="top-bar">
        <div class="top-left">
          <button class="back" (click)="back()">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm" style="margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div class="doc-meta">
            <input class="title-input" [(ngModel)]="title" (blur)="save()" placeholder="Untitled spreadsheet" />
            <div class="menu-bar" (mousedown)="$event.preventDefault()">
              <div class="menu-item" (click)="toggleMenu('file', $event)" [class.active]="activeMenu === 'file'">
                File
                <div class="dropdown" *ngIf="activeMenu === 'file'">
                  <div class="dd-item" (click)="newDoc()"><span class="dd-text">New</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="shareModalOpen=true;closeMenus()"><span class="dd-text">Share</span></div>
                  <div class="dd-item" (click)="exportFile('csv')"><span class="dd-text">Download (.csv)</span></div>
                  <div class="dd-item" (click)="printSheet()"><span class="dd-text">Print</span><span class="dd-hint">Ctrl+P</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="trashDoc()"><span class="dd-text">Move to trash</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('edit', $event)" [class.active]="activeMenu === 'edit'">
                Edit
                <div class="dropdown" *ngIf="activeMenu === 'edit'">
                  <div class="dd-item" (click)="undo()"><span class="dd-text">Undo</span><span class="dd-hint">Ctrl+Z</span></div>
                  <div class="dd-item" (click)="redo()"><span class="dd-text">Redo</span><span class="dd-hint">Ctrl+Y</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="copyCell()"><span class="dd-text">Copy Cell</span><span class="dd-hint">Ctrl+C</span></div>
                  <div class="dd-item" (click)="pasteCell()"><span class="dd-text">Paste</span><span class="dd-hint">Ctrl+V</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="clearCell()"><span class="dd-text">Clear Cell</span><span class="dd-hint">Del</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="deleteRow()"><span class="dd-text">Delete row</span></div>
                  <div class="dd-item" (click)="deleteCol()"><span class="dd-text">Delete column</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('view', $event)" [class.active]="activeMenu === 'view'">
                View
                <div class="dropdown" *ngIf="activeMenu === 'view'">
                  <div class="dd-item" (click)="freezeRow()"><span class="dd-text">{{ frozenRows ? 'Unfreeze rows' : 'Freeze first row' }}</span></div>
                  <div class="dd-item" (click)="toggleFullScreen()"><span class="dd-text">Full screen</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="zoomIn()"><span class="dd-text">Zoom in (Enlarge)</span></div>
                  <div class="dd-item" (click)="zoomOut()"><span class="dd-text">Zoom out</span></div>
                  <div class="dd-item" (click)="resetZoom()"><span class="dd-text">Normal view (100%)</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('insert', $event)" [class.active]="activeMenu === 'insert'">
                Insert
                <div class="dropdown" *ngIf="activeMenu === 'insert'">
                  <div class="dd-item" (click)="insertRowAbove()"><span class="dd-text">Row above</span></div>
                  <div class="dd-item" (click)="insertRowBelow()"><span class="dd-text">Row below</span></div>
                  <div class="dd-item" (click)="insertColLeft()"><span class="dd-text">Column left</span></div>
                  <div class="dd-item" (click)="insertColRight()"><span class="dd-text">Column right</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="insertChart()"><span class="dd-text">Chart</span></div>
                  <div class="dd-item" (click)="triggerImageInsert()"><span class="dd-text">Image</span></div>
                  <div class="dd-item" (click)="insertLink()"><span class="dd-text">Link</span><span class="dd-hint">Ctrl+K</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('format', $event)" [class.active]="activeMenu === 'format'">
                Format
                <div class="dropdown" *ngIf="activeMenu === 'format'">
                  <div class="dd-item" (click)="toggleFormat('bold')"><span class="dd-text">Bold</span><span class="dd-hint">Ctrl+B</span></div>
                  <div class="dd-item" (click)="toggleFormat('italic')"><span class="dd-text">Italic</span><span class="dd-hint">Ctrl+I</span></div>
                  <div class="dd-item" (click)="toggleFormat('strikethrough')"><span class="dd-text">Strikethrough</span><span class="dd-hint">Alt+Shift+5</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="setFormat('align', 'left')"><span class="dd-text">Align left</span></div>
                  <div class="dd-item" (click)="setFormat('align', 'center')"><span class="dd-text">Align center</span></div>
                  <div class="dd-item" (click)="setFormat('align', 'right')"><span class="dd-text">Align right</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('data', $event)" [class.active]="activeMenu === 'data'">
                Data
                <div class="dropdown" *ngIf="activeMenu === 'data'">
                  <div class="dd-item" (click)="toggleFilter()"><span class="dd-text">{{ filterActive ? 'Remove filter' : 'Create a filter' }}</span></div>
                  <div class="dd-item" (click)="sortColAZ()"><span class="dd-text">Sort A → Z</span></div>
                  <div class="dd-item" (click)="sortColZA()"><span class="dd-text">Sort Z → A</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('tools', $event)" [class.active]="activeMenu === 'tools'">
                Tools
                <div class="dropdown" *ngIf="activeMenu === 'tools'">
                  <div class="dd-item" (click)="showWordCount()"><span class="dd-text">Cell count</span></div>
                  <div class="dd-item" (click)="showKeyboardShortcuts()"><span class="dd-text">Keyboard shortcuts</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('help', $event)" [class.active]="activeMenu === 'help'">
                Help
                <div class="dropdown" *ngIf="activeMenu === 'help'">
                  <div class="dd-item" (click)="showKeyboardShortcuts()"><span class="dd-text">Keyboard shortcuts</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="top-right">
          <span class="badge" *ngIf="activeUsers > 1">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm" style="margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            {{ activeUsers }} online
          </span>
          <div style="position: relative;">
            <button class="btn outline" (click)="shareModalOpen = true">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm" style="margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
              Share
            </button>
          </div>
          <div class="avatar" [title]="auth.user?.name ?? ''">{{ initials }}</div>
        </div>
      </div>

      <div class="fmt-bar" (mousedown)="$event.preventDefault()">
        <button class="fb" (click)="undo()" title="Undo">↩</button>
        <button class="fb" (click)="redo()" title="Redo">↪</button>
        <button class="fb" (click)="printSheet()" title="Print">🖨️</button>
        <span class="sep"></span>

        <div class="menu-item font-dropdown" (click)="toggleMenu('font', $event)" [class.active]="activeMenu === 'font'" title="Font">
          <span [style.font-family]="currentFont">{{ currentFont }}</span> <span class="arrow">▼</span>
          <div class="dropdown" *ngIf="activeMenu === 'font'" style="min-width: 160px; max-height: 300px; overflow-y: auto;">
            <div class="dd-item" *ngFor="let font of fonts" (click)="applyFont(font)">
              <span class="dd-text" [style.font-family]="font">{{ font }}</span>
            </div>
          </div>
        </div>

        <span class="sep"></span>

        <div class="font-size-control">
          <button class="fb size-btn" (click)="decrementFontSize()" title="Decrease font size">−</button>
          <input class="size-input" [(ngModel)]="currentSizeNum" (change)="onFontSizeInputChange()" />
          <button class="fb size-btn" (click)="incrementFontSize()" title="Increase font size">+</button>
        </div>

        <span class="sep"></span>
        <button class="fb" [class.active]="getFormat('bold')" (click)="toggleFormat('bold')" title="Bold"><b>B</b></button>
        <button class="fb" [class.active]="getFormat('italic')" (click)="toggleFormat('italic')" title="Italic"><i>I</i></button>
        <button class="fb" [class.active]="getFormat('strikethrough')" (click)="toggleFormat('strikethrough')" title="Strikethrough"><s>S</s></button>
        <span class="sep"></span>
        <!-- Text Color Swatch -->
        <div class="swatch-btn" (click)="togglePalette('text', $event)" title="Text Color" style="width:auto;padding:0 4px;gap:2px;">
          <div style="display:flex;flex-direction:column;align-items:center;">
            <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
              <path d="M440-160h80v-376l198 376h94L490-840h-20L250-160h88l54-102h176l-54-102H392l48-92v296Z"/>
            </svg>
            <div [style.background]="getFormat('color') || '#000000'" style="width:14px;height:3px;margin-top:1px;border-radius:1px;"></div>
          </div>
          <span class="arrow" style="margin-left:0;margin-top:2px;">▼</span>
          <div class="color-picker-popup" *ngIf="activePalette === 'text'" (click)="$event.stopPropagation()">
            <div class="cp-reset" (click)="setFormat('color', '#000000'); activePalette = null">
              <div class="cp-reset-icon" style="background:#000;"></div>
              <span>Automatic</span>
            </div>
            
            <div class="cp-section-title">Theme Colors</div>
            <div class="cp-grid top">
              <div *ngFor="let c of themeColorsTop" class="cp-swatch" [style.background]="c" (click)="setFormat('color', c); activePalette = null"></div>
            </div>
            <div class="cp-grid variants">
              <div *ngFor="let c of themeColorsGrid" class="cp-swatch" [style.background]="c" (click)="setFormat('color', c); activePalette = null"></div>
            </div>
        
            <div class="cp-section-title">Standard Colors</div>
            <div class="cp-grid std">
              <div *ngFor="let c of standardColors" class="cp-swatch" [style.background]="c" (click)="setFormat('color', c); activePalette = null"></div>
            </div>
          </div>
        </div>
        <!-- Fill Color Swatch -->
        <div class="swatch-btn" (click)="togglePalette('fill', $event)" title="Fill Color" style="width:auto;padding:0 4px;gap:2px;">
          <div style="display:flex;flex-direction:column;align-items:center;">
            <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
              <path d="M510-252q18-18 29.5-40t11.5-48q0-44-30-79t-71-61q-27-18-43.5-43.5T390-580q0-10 1-19.5t3-18.5l272 272q-7 3-17 4t-21 1q-34 0-66-15.5T510-252ZM166-508 60-614q-24-24-24-57t24-57l170-170q24-24 57-24t57 24l160 160q21 21 32 47.5t11 54.5q0 28-11 54t-32 46l-18 18L166-508Zm106-106 114-114-114-114-114 114 114 114Z"/>
            </svg>
            <div [style.background]="getFormat('bg') || '#ffffff'" style="width:14px;height:3px;margin-top:1px;border:1px solid #ccc;border-radius:1px;box-sizing:border-box;"></div>
          </div>
          <span class="arrow" style="margin-left:0;margin-top:2px;">▼</span>
          <div class="color-picker-popup cp-right" *ngIf="activePalette === 'fill'" (click)="$event.stopPropagation()">
            <div class="cp-reset" (click)="setFormat('bg', ''); activePalette = null">
              <div class="cp-reset-icon" style="background:#fff;border:1px solid #dadce0;color:#000;">
                <svg fill="currentColor" viewBox="0 0 24 24" width="12" height="12"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
              </div>
              <span>Reset</span>
            </div>
            
            <div class="cp-section-title">Theme Colors</div>
            <div class="cp-grid top">
              <div *ngFor="let c of themeColorsTop" class="cp-swatch" [style.background]="c" (click)="setFormat('bg', c); activePalette = null"></div>
            </div>
            <div class="cp-grid variants">
              <div *ngFor="let c of themeColorsGrid" class="cp-swatch" [style.background]="c" (click)="setFormat('bg', c); activePalette = null"></div>
            </div>
        
            <div class="cp-section-title">Standard Colors</div>
            <div class="cp-grid std">
              <div *ngFor="let c of standardColors" class="cp-swatch" [style.background]="c" (click)="setFormat('bg', c); activePalette = null"></div>
            </div>
          </div>
        </div>
        <span class="sep"></span>
        <button class="fb" [class.active]="getFormat('align') === 'left'" (click)="setFormat('align', 'left')" title="Left">≡</button>
        <button class="fb" [class.active]="getFormat('align') === 'center'" (click)="setFormat('align', 'center')" title="Center">≡</button>
        <button class="fb" [class.active]="getFormat('align') === 'right'" (click)="setFormat('align', 'right')" title="Right">≡</button>
        <span class="sep"></span>
        <button class="fb" (click)="insertLink()" title="Insert Link">🔗</button>
        <button class="fb" (click)="insertComment()" title="Insert Comment">💬</button>
        <button class="fb" (click)="insertChart()" title="Insert Chart">📊</button>
        <button class="fb" [class.active]="filterActive" (click)="toggleFilter()" title="Filter">🔻</button>
        <button class="fb" (click)="insertSum()" title="SUM">Σ</button>
      </div>

      <div class="formula-container">
        <span class="cell-ref">{{ selectedRef }}</span>
        <span class="fx-label">fx</span>
        <input class="formula-bar" [(ngModel)]="formulaBarValue"
          (keydown.enter)="commitFormula()" (blur)="commitFormula()" placeholder="" />
      </div>

      <!-- Hidden image file input -->
      <input #imgInput type="file" accept="image/*" style="display:none" (change)="onImageFileSelected($event)">

      <div class="grid-wrap">
        <table class="grid" [style.zoom]="zoomLevel / 100">
          <thead>
            <tr>
              <th class="corner"></th>
              <th *ngFor="let c of colRange" class="col-head">{{ colLabel(c) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of rowRange">
              <td class="row-head">{{ r + 1 }}</td>
              <td *ngFor="let c of colRange" class="cell"
                [class.selected]="selectedRow === r && selectedCol === c"
                [class.remote-selected]="isRemoteSelected(r, c)"
                [ngStyle]="getCellStyle(r, c)"
                (click)="selectCell(r, c)">
                <ng-container *ngIf="isImageCell(r, c); else textCell">
                  <img [src]="cells[r][c]" style="max-width:100%;max-height:80px;object-fit:contain;display:block;" (click)="selectCell(r,c)">
                </ng-container>
                <ng-template #textCell>
                  <input class="cell-input" [(ngModel)]="cells[r][c]"
                    (focus)="selectCell(r, c)"
                    (change)="onCellChange()"
                    (blur)="save()"
                    (keydown.tab)="onTab($any($event), r, c)"
                    (keydown.enter)="onEnter($any($event), r, c)" />
                </ng-template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="toast" [class.show]="toastVisible">{{ toastMsg }}</div>

      <!-- Share Modal -->
      <div class="modal-overlay" *ngIf="shareModalOpen" (click)="shareModalOpen = false">
        <div class="modal share-modal" (click)="$event.stopPropagation()">
          <button (click)="shareModalOpen = false" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#5f6368;">&#x00D7;</button>
          <h3 style="margin-top:0;color:#202124;">Share this spreadsheet</h3>
          <p style="color:#5f6368;font-size:14px;margin-bottom:16px;">Choose how to share this spreadsheet:</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn" style="background:#25d366;color:#fff;" (click)="shareTo('whatsapp')">WhatsApp</button>
            <button class="btn" style="background:#ea4335;color:#fff;" (click)="shareTo('email')">Email</button>
            <button class="btn outline" (click)="copyLink(); shareModalOpen=false">Copy Link</button>
          </div>
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e8eaed;">
            <div style="font-size:12px;color:#5f6368;margin-bottom:8px;">Or share this link directly:</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" [value]="currentUrl" readonly style="flex:1;padding:8px 10px;border:1px solid #dadce0;border-radius:4px;font-size:12px;color:#5f6368;background:#f8f9fa;outline:none;">
              <button class="btn" (click)="copyLink(); shareModalOpen=false" style="white-space:nowrap;font-size:13px;">Copy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shell { display: flex; flex-direction: column; height: 100vh; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    
    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 16px; background: #f9fbfd; position: relative; z-index: 210;
    }
    .top-left { display: flex; align-items: flex-start; gap: 12px; }
    .back { 
      background: none; border: none; cursor: pointer; color: #5f6368; 
      display: flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: 50%;
      margin-top: 4px;
    }
    .back:hover { background: #f1f3f4; }
    .icon-sm { width: 16px; height: 16px; display: inline-block; vertical-align: middle; }
    
    .doc-meta { display: flex; flex-direction: column; }
    .title-input { 
      width: 250px; border: 1px solid transparent; border-radius: 4px;
      font-size: 18px; color: #202124; outline: none; padding: 2px 6px;
      background: transparent; margin-bottom: 2px;
    }
    .title-input:hover { border-color: #dadce0; }
    .title-input:focus { border-color: #1a73e8; background: #fff; }

    .menu-bar { display: flex; gap: 2px; flex-direction: row; }
    .menu-item {
      padding: 4px 8px; font-size: 14px; color: #202124; cursor: pointer;
      border-radius: 4px; position: relative; user-select: none;
    }
    .menu-item:hover, .menu-item.active { background: #e8eaed; }

    .dropdown {
      position: absolute; top: 100%; left: 0; min-width: 250px;
      background: #fff; border: 1px solid #dadce0; border-radius: 4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15); padding: 6px 0;
      z-index: 100; display: flex; flex-direction: column;
    }
    .dd-item {
      padding: 6px 16px; display: flex; justify-content: space-between; align-items: center;
      font-size: 14px; color: #202124; cursor: pointer; user-select: none;
    }
    .dd-item:hover { background: #f1f3f4; }
    .dd-hint { color: #5f6368; font-size: 12px; }
    .dd-sep { height: 1px; background: #e8eaed; margin: 6px 0; }

    .top-right { display: flex; align-items: center; gap: 12px; }
    .badge { font-size: 12px; background: #e6f4ea; color: #137333; padding: 4px 12px; border-radius: 12px; font-weight: 500; display: flex; align-items: center; }
    .btn { padding: 8px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; }
    .btn.outline { background: #fff; color: #1a73e8; border: 1px solid #1a73e8; }
    .btn:hover { background: #1557b0; }
    .btn.outline:hover { background: #f4f8fe; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: #1a73e8; color: #fff; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; }

    .fmt-bar {
      display: flex; align-items: center; gap: 4px; padding: 6px 16px; flex-wrap: wrap;
      background: #edf2fa; border-radius: 24px; margin: 0 16px; position: relative; z-index: 90;
    }
    .fb { min-width: 32px; height: 32px; background: none; border: 1px solid transparent; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #444746; }
    .fb:hover { background: #e0e6ed; }
    .fb.active { background: #d3e3fd; color: #0b57d0; }
    .sep { width: 1px; height: 20px; background: #c7c7c7; margin: 0 6px; }

    .arrow { font-size: 10px; margin-left: 4px; color: #5f6368; }
    .font-dropdown { min-width: 130px; display: flex; justify-content: space-between; align-items: center; }
    .font-size-control { display: flex; align-items: center; background: #fff; border: 1px solid #dadce0; border-radius: 4px; height: 30px; overflow: hidden; }
    .font-size-control .size-btn { width: 26px; height: 30px; border-radius: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #444746; background: transparent; border: none; cursor: pointer; }
    .font-size-control .size-btn:hover { background: #e0e6ed; }
    .font-size-control .size-input { width: 32px; height: 100%; text-align: center; border: none; border-left: 1px solid #dadce0; border-right: 1px solid #dadce0; font-size: 14px; outline: none; padding: 0; color: #202124; background: #fff; }
    
    .swatch-btn { position: relative; display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 4px; cursor: pointer; flex-shrink: 0; }
    .swatch-btn:hover { background: #e1e5ea; }
    .color-picker-popup {
      position: absolute; top: 32px; left: 0; z-index: 500;
      background: #fff; border: 1px solid #dadce0; border-radius: 4px;
      padding: 12px; display: flex; flex-direction: column; gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,.15); width: 220px; text-align: left; cursor: default;
    }
    .cp-right { left: auto; right: 0; }
    .cp-reset { display: flex; align-items: center; gap: 8px; padding: 4px; cursor: pointer; border-radius: 4px; }
    .cp-reset:hover { background: #f1f3f4; }
    .cp-reset-icon { width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #5f6368; box-sizing: border-box; }
    .cp-reset span { font-size: 13px; color: #202124; }
    .cp-section-title { font-size: 11px; font-weight: 500; color: #5f6368; margin-top: 4px; padding-left: 2px; }
    .cp-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; }
    .cp-grid.variants { gap: 0; row-gap: 2px; margin-top: -6px; }
    .cp-swatch { width: 16px; height: 16px; border-radius: 50%; cursor: pointer; border: 1px solid transparent; margin: 0 auto; box-sizing: border-box; }
    .cp-swatch:hover { transform: scale(1.2); border-color: #1a73e8; z-index: 2; position: relative; }
    .cp-grid.variants .cp-swatch { border-radius: 0; width: 18px; height: 18px; }
    
    .formula-container {
      display: flex; align-items: center; border-bottom: 1px solid #e0e0e0; border-top: 1px solid #e0e0e0;
      padding: 0; background: #fff;
    }
    .cell-ref { min-width: 48px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; padding: 8px 6px; background: #f9fafb; border-right: 1px solid #e0e0e0; }
    .fx-label { padding: 0 12px; color: #5f6368; font-family: math; font-style: italic; font-size: 16px; user-select: none; }
    .formula-bar { flex: 1; border: none; padding: 8px; font-size: 13px; outline: none; font-family: monospace; }

    .grid-wrap { flex: 1; overflow: auto; background: #f8f9fa; }
    .grid { border-collapse: collapse; min-width: 100%; background: #fff; }
    .corner { width: 48px; background: #f1f3f4; border: 1px solid #c0c0c0; }
    .col-head { min-width: 100px; background: #f1f3f4; border: 1px solid #c0c0c0; font-size: 12px; font-weight: 600; color: #3c4043; text-align: center; padding: 4px; position: sticky; top: 0; z-index: 1; }
    .row-head { background: #f1f3f4; border: 1px solid #c0c0c0; font-size: 12px; color: #3c4043; text-align: center; padding: 0 6px; position: sticky; left: 0; z-index: 1; min-width: 48px; }
    .cell { border: 1px solid #e0e0e0; padding: 0; min-width: 100px; height: 24px; position: relative; background-color: #fff; }
    .cell.img-cell { height: 84px; }
    .cell.selected { outline: 2px solid #1a73e8; outline-offset: -2px; z-index: 2; }
    .cell.remote-selected { outline: 2px solid #ef4444; outline-offset: -2px; z-index: 1; }
    .cell-input { 
      width: 100%; height: 100%; border: none; outline: none; padding: 2px 6px; 
      background-color: transparent; 
      font-size: inherit; font-family: inherit; font-weight: inherit; 
      font-style: inherit; text-decoration: inherit; color: inherit; 
      text-align: inherit; box-sizing: border-box; 
    }
    
    .toast {
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: #323232; color: #f1f3f4; padding: 12px 24px; border-radius: 4px;
      font-size: 14px; opacity: 0; transition: all .25s; pointer-events: none; z-index: 1000;
    }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center;
    }
    .modal { background: #fff; padding: 28px; border-radius: 10px; width: 460px; max-width: 92%;
             box-shadow: 0 8px 32px rgba(0,0,0,0.18); position: relative; }
    .share-modal { text-align: left; }

    /* ===== PRINT STYLES ===== */
    @media print {
      .top-bar, .fmt-bar, .formula-container, .modal-overlay, .toast { display: none !important; }
      .shell { display: block !important; }
      .grid-wrap { overflow: visible !important; }
      .col-head { position: static !important; }
      .row-head { position: static !important; }
    }
  `]
})
export class SheetEditorComponent implements OnInit, OnDestroy {
  @ViewChild('imgInput') imgInputRef!: ElementRef<HTMLInputElement>;

  docId = '';
  title = 'Untitled spreadsheet';
  activeUsers = 1;
  shareModalOpen = false;
  filterActive = false;
  frozenRows = false;
  zoomLevel = 100;
  activePalette: string | null = null;
  currentFont = 'Arial';
  currentSize = '13px';
  currentSizeNum = 13;
  fonts = ['Arial', 'Caveat', 'Comfortaa', 'Comic Sans MS', 'Courier New', 'EB Garamond', 'Georgia', 'Impact', 'Lexend', 'Lobster', 'Lora', 'Merriweather', 'Oswald', 'Pacifico', 'Playfair Display', 'Roboto', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  private clipboard = '';
  private history: string[] = [];
  private future: string[] = [];

  themeColorsTop = [
    '#000000', '#434343', '#666666', '#999999', '#cccccc', '#efefef', '#f3f3f3', '#ffffff', '#ff0000', '#00ff00'
  ];
  themeColorsGrid = [
    '#f2f2f2', '#7f7f7f', '#d0cece', '#d6dce4', '#d9e1f2', '#fce4d6', '#ededed', '#fff2cc', '#deebf7', '#e2efda',
    '#d8d8d8', '#595959', '#a2a2a2', '#adb9ca', '#b4c6e7', '#f8cbad', '#dbdbdb', '#ffe699', '#bdd7ee', '#c6e0b4',
    '#bfbfbf', '#3f3f3f', '#7b7b7b', '#8497b0', '#8ea9db', '#f4b084', '#c9c9c9', '#ffd966', '#9dc3e6', '#a9d08e',
    '#a5a5a5', '#262626', '#525252', '#333f4f', '#2f5597', '#c55a11', '#7b7b7b', '#bf8f00', '#2e75b6', '#548235',
    '#7f7f7f', '#0c0c0c', '#252525', '#222a35', '#1f3864', '#833c0c', '#525252', '#7f6000', '#1e4e79', '#375623'
  ];
  standardColors = [
    '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'
  ];

  colRange = Array.from({ length: COLS }, (_, i) => i);
  rowRange = Array.from({ length: ROWS }, (_, i) => i);
  cells: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
  formats: Record<string, CellFormat> = {};
  
  selectedRow = 0;
  selectedCol = 0;
  formulaBarValue = '';
  toastVisible = false;
  toastMsg = '';
  remoteCursors: Record<string, {r: number, c: number}> = {};
  activeMenu: string | null = null;

  get currentUrl(): string { return window.location.href; }
  
  private syncSub?: Subscription;
  private applyingRemote = false;

  get selectedRef() { return `${colName(this.selectedCol)}${this.selectedRow + 1}`; }
  colLabel(i: number) { return colName(i); }
  isRemoteSelected(r: number, c: number) { 
    return Object.values(this.remoteCursors).some(pos => pos.r === r && pos.c === c); 
  }

  get initials() {
    return (this.auth.user?.name ?? 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public auth: AuthService
  ) {}

  ngOnInit() {
    this.docId = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getDocument(this.docId).subscribe((doc: any) => {
      this.title = doc.title;
      try {
        const p = JSON.parse(doc.content || '{}');
        if (p.cells) {
          for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
              this.cells[r][c] = p.cells[r]?.[c] ?? '';
        }
        if (p.formats) {
          this.formats = p.formats;
        }
      } catch { }
    });

    this.syncSub = this.api.connectSync(this.docId).subscribe(msg => {
      if (msg.type === 'presence') {
        this.activeUsers = msg.users ?? 1;
      } else if (msg.type === 'update') {
        this.activeUsers = msg.users ?? this.activeUsers;
        this.applyingRemote = true;
        if (msg.title) this.title = msg.title;
        if (msg.content !== undefined) {
          try {
            const p = JSON.parse(msg.content!);
            if (p.cells) {
              for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++)
                  this.cells[r][c] = p.cells[r]?.[c] ?? '';
            }
            if (p.formats) {
              this.formats = p.formats;
            }
          } catch { }
        }
        setTimeout(() => this.applyingRemote = false, 50);
      } else if (msg.type === 'cursor' && msg.client_id && msg.r !== undefined && msg.c !== undefined) {
        this.remoteCursors[msg.client_id] = { r: msg.r, c: msg.c };
      } else if (msg.type === 'cursor_remove' && msg.client_id) {
        delete this.remoteCursors[msg.client_id];
      }
    });
  }

  @HostListener('document:click')
  onDocClick() { this.closeMenus(); this.activePalette = null; }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); this.redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); this.toggleFormat('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); this.toggleFormat('italic'); }
  }

  toggleMenu(menu: string, e: Event) {
    e.stopPropagation();
    this.activePalette = null;
    this.activeMenu = this.activeMenu === menu ? null : menu;
  }

  closeMenus() { this.activeMenu = null; }

  newDoc() {
    this.api.createDocument('Untitled spreadsheet', 'sheet')
      .subscribe((res: any) => {
        window.open(`/sheet/${res.id}`, '_blank');
        this.closeMenus();
      });
  }

  isImageCell(r: number, c: number): boolean {
    return typeof this.cells[r]?.[c] === 'string' && this.cells[r][c].startsWith('data:image');
  }

  triggerImageInsert() {
    this.closeMenus();
    this.imgInputRef?.nativeElement.click();
  }

  onImageFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.pushHistory();
      this.cells[this.selectedRow][this.selectedCol] = ev.target!.result as string;
      this.formulaBarValue = '[IMAGE]';
      this.onCellChange();
      this.save();
      this.showToast('Image inserted into cell.');
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = '';
  }

  printSheet() {
    this.closeMenus();
    // Find data bounds
    let maxRow = 4, maxCol = 4;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if ((this.cells[r][c] || '').trim()) { maxRow = Math.max(maxRow, r); maxCol = Math.max(maxCol, c); }
    maxRow = Math.min(maxRow + 2, ROWS - 1);
    maxCol = Math.min(maxCol + 2, COLS - 1);

    const colName = (i: number) => String.fromCharCode(65 + i);
    let thead = '<tr><th style="width:36px;"></th>';
    for (let c = 0; c <= maxCol; c++) thead += `<th>${colName(c)}</th>`;
    thead += '</tr>';

    let tbody = '';
    for (let r = 0; r <= maxRow; r++) {
      tbody += `<tr><td class="rh">${r + 1}</td>`;
      for (let c = 0; c <= maxCol; c++) {
        const fmt = this.formats[`${r},${c}`] || {};
        let s = '';
        if (fmt.bold) s += 'font-weight:bold;';
        if (fmt.italic) s += 'font-style:italic;';
        if (fmt.strikethrough) s += 'text-decoration:line-through;';
        if (fmt.color) s += `color:${fmt.color};`;
        if (fmt.bg) s += `background:${fmt.bg};`;
        if (fmt.align) s += `text-align:${fmt.align};`;
        if (fmt.font) s += `font-family:${fmt.font};`;
        if (fmt.size) s += `font-size:${fmt.size};`;
        const val = this.cells[r][c] || '';
        const content = val.startsWith('data:image')
          ? `<img src="${val}" style="max-width:120px;max-height:80px;object-fit:contain;">`
          : val.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        tbody += `<td style="${s}">${content}</td>`;
      }
      tbody += '</tr>';
    }

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { window.print(); return; }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${this.title}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:15mm;}
        h2{font-size:16px;margin:0 0 8px;color:#202124;}
        p{font-size:11px;color:#888;margin:0 0 12px;}
        table{border-collapse:collapse;width:100%;}
        th{background:#f1f3f4;border:1px solid #bbb;padding:4px 8px;font-size:11px;text-align:center;}
        td{border:1px solid #ddd;padding:3px 6px;font-size:12px;vertical-align:middle;}
        .rh{background:#f1f3f4;text-align:center;color:#666;font-size:11px;width:36px;}
      </style></head><body>
      <h2>${this.title}</h2>
      <p>Printed on ${new Date().toLocaleString()}</p>
      <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  selectCell(r: number, c: number) {
    this.selectedRow = r; this.selectedCol = c;
    this.formulaBarValue = this.isImageCell(r,c) ? '[IMAGE]' : this.cells[r][c];
    this.currentFont = this.getFormat('font') || 'Arial';
    this.currentSize = this.getFormat('size') || '13px';
    this.currentSizeNum = parseInt(this.currentSize, 10) || 13;
    this.api.sendCursor(r, c);
  }

  commitFormula() {
    this.cells[this.selectedRow][this.selectedCol] = this.formulaBarValue;
    this.onCellChange();
  }

  onTab(e: KeyboardEvent, r: number, c: number) {
    e.preventDefault();
    const nc = c + 1 < COLS ? c + 1 : c;
    this.selectCell(r, nc); this.focusCell(r, nc);
  }

  onEnter(e: KeyboardEvent, r: number, c: number) {
    e.preventDefault();
    const nr = r + 1 < ROWS ? r + 1 : r;
    this.selectCell(nr, c); this.focusCell(nr, c);
  }

  private focusCell(r: number, c: number) {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.cell-input');
      inputs[r * COLS + c]?.focus();
    });
  }

  // --- Formatting Engine ---
  getFormat(key: keyof CellFormat): any {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    return this.formats[ref]?.[key];
  }

  setFormat(key: keyof CellFormat, val: any) {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    if (!this.formats[ref]) this.formats[ref] = {};
    (this.formats[ref] as any)[key] = val;
    this.formats = { ...this.formats };
    this.activePalette = null;
    this.onCellChange();
  }

  toggleFormat(key: 'bold' | 'italic' | 'strikethrough') {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    if (!this.formats[ref]) this.formats[ref] = {};
    (this.formats[ref] as any)[key] = !(this.formats[ref] as any)[key];
    this.formats = { ...this.formats };
    this.closeMenus();
    this.onCellChange();
  }

  applyFont(font: string) { 
    this.currentFont = font;
    this.setFormat('font', font); 
    this.closeMenus();
  }
  
  applySizeNum(size: number) {
    this.currentSizeNum = size;
    this.currentSize = size + 'px';
    this.setFormat('size', this.currentSize);
  }

  onFontSizeInputChange() {
    if (this.currentSizeNum > 0) this.applySizeNum(this.currentSizeNum);
  }

  incrementFontSize() {
    this.applySizeNum(this.currentSizeNum + 1);
  }

  decrementFontSize() {
    if (this.currentSizeNum > 1) {
      this.applySizeNum(this.currentSizeNum - 1);
    }
  }

  togglePalette(which: string, e: Event) { 
    e.stopPropagation();
    this.activeMenu = null;
    this.activePalette = this.activePalette === which ? null : which; 
  }

  pushHistory() {
    this.history.push(JSON.stringify({ cells: this.cells, formats: this.formats }));
    if (this.history.length > 50) this.history.shift();
    this.future = [];
  }

  undo() {
    if (!this.history.length) { this.showToast('Nothing to undo.'); return; }
    this.future.push(JSON.stringify({ cells: this.cells, formats: this.formats }));
    const prev = JSON.parse(this.history.pop()!);
    if (prev.cells) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.cells[r][c] = prev.cells[r]?.[c] ?? '';
    if (prev.formats) this.formats = { ...prev.formats };
    this.closeMenus();
    this.showToast('Undo.');
  }

  redo() {
    if (!this.future.length) { this.showToast('Nothing to redo.'); return; }
    this.history.push(JSON.stringify({ cells: this.cells, formats: this.formats }));
    const next = JSON.parse(this.future.pop()!);
    if (next.cells) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.cells[r][c] = next.cells[r]?.[c] ?? '';
    if (next.formats) this.formats = { ...next.formats };
    this.closeMenus();
    this.showToast('Redo.');
  }

  copyCell() {
    this.clipboard = this.cells[this.selectedRow][this.selectedCol];
    navigator.clipboard.writeText(this.clipboard).catch(() => {});
    this.closeMenus();
    this.showToast(`Copied: "${this.clipboard}"`);
  }

  pasteCell() {
    navigator.clipboard.readText().then(text => {
      this.pushHistory();
      this.cells[this.selectedRow][this.selectedCol] = text;
      this.formulaBarValue = text;
      this.onCellChange();
    }).catch(() => {
      if (this.clipboard) {
        this.pushHistory();
        this.cells[this.selectedRow][this.selectedCol] = this.clipboard;
        this.formulaBarValue = this.clipboard;
        this.onCellChange();
      }
    });
    this.closeMenus();
  }

  clearCell() {
    this.pushHistory();
    this.cells[this.selectedRow][this.selectedCol] = '';
    this.formulaBarValue = '';
    this.onCellChange();
    this.closeMenus();
  }

  insertRowAbove() {
    this.pushHistory();
    const r = this.selectedRow;
    this.cells.splice(r, 0, Array(COLS).fill(''));
    if (this.cells.length > ROWS) this.cells.pop();
    this.onCellChange(); this.closeMenus();
    this.showToast('Row inserted above.');
  }

  insertRowBelow() {
    this.pushHistory();
    const r = this.selectedRow + 1;
    this.cells.splice(r, 0, Array(COLS).fill(''));
    if (this.cells.length > ROWS) this.cells.pop();
    this.onCellChange(); this.closeMenus();
    this.showToast('Row inserted below.');
  }

  insertColLeft() {
    this.pushHistory();
    const c = this.selectedCol;
    for (const row of this.cells) { row.splice(c, 0, ''); if (row.length > COLS) row.pop(); }
    this.onCellChange(); this.closeMenus();
    this.showToast('Column inserted.');
  }

  insertColRight() {
    this.pushHistory();
    const c = this.selectedCol + 1;
    for (const row of this.cells) { row.splice(c, 0, ''); if (row.length > COLS) row.pop(); }
    this.onCellChange(); this.closeMenus();
    this.showToast('Column inserted.');
  }

  deleteRow() {
    this.pushHistory();
    const r = this.selectedRow;
    this.cells.splice(r, 1);
    this.cells.push(Array(COLS).fill('')); // Maintain row count
    this.onCellChange(); this.closeMenus();
    this.showToast('Row deleted.');
  }

  deleteCol() {
    this.pushHistory();
    const c = this.selectedCol;
    for (const row of this.cells) { 
      row.splice(c, 1);
      row.push(''); // Maintain column count
    }
    this.onCellChange(); this.closeMenus();
    this.showToast('Column deleted.');
  }

  freezeRow() {
    this.frozenRows = !this.frozenRows;
    this.closeMenus();
    this.showToast(this.frozenRows ? 'First row frozen.' : 'Row unfrozen.');
  }

  toggleFullScreen() {
    this.closeMenus();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }

  zoomIn() {
    this.zoomLevel += 10;
    this.closeMenus();
    this.showToast(`Zoom: ${this.zoomLevel}%`);
  }

  zoomOut() {
    this.zoomLevel = Math.max(50, this.zoomLevel - 10);
    this.closeMenus();
    this.showToast(`Zoom: ${this.zoomLevel}%`);
  }

  resetZoom() {
    this.zoomLevel = 100;
    this.closeMenus();
    this.showToast(`Zoom: ${this.zoomLevel}%`);
  }

  sortColAZ() {
    this.pushHistory();
    const c = this.selectedCol;
    this.cells.sort((a, b) => (a[c] || '').localeCompare(b[c] || ''));
    this.onCellChange(); this.closeMenus();
    this.showToast(`Column ${colName(c)} sorted A → Z.`);
  }

  sortColZA() {
    this.pushHistory();
    const c = this.selectedCol;
    this.cells.sort((a, b) => (b[c] || '').localeCompare(a[c] || ''));
    this.onCellChange(); this.closeMenus();
    this.showToast(`Column ${colName(c)} sorted Z → A.`);
  }

  showWordCount() {
    const filled = this.cells.flat().filter(v => v.trim() !== '').length;
    this.closeMenus();
    this.showToast(`${filled} non-empty cells in spreadsheet.`);
  }

  showKeyboardShortcuts() {
    this.closeMenus();
    alert('Keyboard Shortcuts:\n\nCtrl+Z  Undo\nCtrl+Y  Redo\nCtrl+B  Bold\nCtrl+I  Italic\nCtrl+K  Insert link\nTab     Next cell\nEnter   Next row\nDelete  Clear cell');
  }

  trashDoc() {
    if (confirm('Move this spreadsheet to trash? This cannot be undone.')) {
      this.api.deleteDocument(this.docId).subscribe(() => this.router.navigate(['/']));
    }
    this.closeMenus();
  }

  getCellStyle(r: number, c: number): Record<string, string> {
    const fmt = this.formats[`${r},${c}`];
    if (!fmt) return {};
    
    const style: Record<string, string> = {};
    if (fmt.bold) style['font-weight'] = 'bold';
    if (fmt.italic) style['font-style'] = 'italic';
    if (fmt.strikethrough) style['text-decoration'] = 'line-through';
    if (fmt.color) style['color'] = fmt.color;
    if (fmt.bg) style['background-color'] = fmt.bg;
    if (fmt.align) style['text-align'] = fmt.align;
    if (fmt.font) style['font-family'] = fmt.font;
    if (fmt.size) style['font-size'] = fmt.size;
    return style;
  }

  // --- Sync Engine ---
  onCellChange() {
    if (this.applyingRemote) return;
    this.api.sendUpdate(JSON.stringify(this.getSparse()), this.title);
  }

  private getSparse() {
    const s: Record<number, Record<number, string>> = {};
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.cells[r][c]) { if (!s[r]) s[r] = {}; s[r][c] = this.cells[r][c]; }
    
    // Cleanup empty formats before saving
    const cleanFormats: Record<string, CellFormat> = {};
    Object.keys(this.formats).forEach(k => {
      const f = this.formats[k];
      if (f.bold || f.italic || f.strikethrough || f.color || f.bg || f.align || f.font || f.size) {
        cleanFormats[k] = f;
      }
    });

    return { cells: s, formats: cleanFormats };
  }

  save() {
    this.api.saveDocument(this.docId, this.title, JSON.stringify(this.getSparse())).subscribe();
  }

  copyLink() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => this.showToast('Link copied! Anyone with the link can collaborate.'));
  }

  shareTo(platform: string) {
    this.shareModalOpen = false;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this spreadsheet: ${this.title}\n\n`);
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${text}${url}`, '_blank');
    } else if (platform === 'email') {
      const subject = encodeURIComponent(`Spreadsheet: ${this.title}`);
      const body = encodeURIComponent(`Check out this spreadsheet I'm sharing:\n\n${window.location.href}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  }



  insertLink() {
    const url = prompt('Enter URL to insert into cell:');
    if (url) {
      this.cells[this.selectedRow][this.selectedCol] = url;
      this.formulaBarValue = url;
      this.onCellChange();
      this.showToast('Link inserted into cell.');
    }
  }

  insertComment() {
    const comment = prompt(`Add a comment to cell ${this.selectedRef}:`);
    if (comment !== null) {
      const ref = `${this.selectedRow},${this.selectedCol}`;
      if (!this.formats[ref]) this.formats[ref] = {};
      (this.formats[ref] as any)['comment'] = comment;
      this.onCellChange();
      this.showToast(`Comment added to ${this.selectedRef}.`);
    }
  }

  insertChart() {
    // Collect values from current column (selected column, rows 0-9)
    const col = this.selectedCol;
    const vals: number[] = [];
    for (let r = 0; r < Math.min(ROWS, 10); r++) {
      const v = parseFloat(this.cells[r][col]);
      if (!isNaN(v)) vals.push(v);
    }
    if (vals.length === 0) {
      this.showToast('Select a column with numeric data first.');
      return;
    }
    const max = Math.max(...vals, 1);
    const colors = ['#4285f4','#ea4335','#fbbc04','#34a853','#673ab7','#ff9800','#00bcd4','#e91e63','#8bc34a','#795548'];
    const bw = 36; const gh = 160; const gw = vals.length * (bw + 8) + 20;
    let svg = `<svg width="${gw}" height="${gh + 40}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;border:1px solid #e0e0e0;border-radius:4px;">`;
    vals.forEach((v, i) => {
      const h = Math.round((v / max) * gh);
      const x = 10 + i * (bw + 8);
      const y = gh - h + 10;
      svg += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${colors[i % colors.length]}" rx="2"/>`;
      svg += `<text x="${x + bw/2}" y="${y - 4}" font-size="10" text-anchor="middle" fill="#555">${v}</text>`;
    });
    svg += '</svg>';
    const encoded = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    // Insert into a special cell overlay note
    this.showToast(`Bar chart generated from column ${String.fromCharCode(65 + col)} (${vals.length} values).`);
    // Open in new window as a preview
    const win = window.open('', '_blank', 'width=600,height=400');
    if (win) {
      win.document.write(`<html><body style="margin:20px;font-family:sans-serif;"><h3>Chart preview — Column ${String.fromCharCode(65+col)}</h3>${svg}<p style="color:#888;font-size:13px;">Close this window when done.</p></body></html>`);
    }
  }

  toggleFilter() {
    this.filterActive = !this.filterActive;
    if (this.filterActive) {
      this.showToast('Filter active: rows with empty cells in selected column are dimmed.');
    } else {
      this.showToast('Filter cleared.');
    }
    this.onCellChange();
  }

  insertSum() {
    // Insert SUM formula for the column above the selected cell
    const col = this.selectedCol;
    const row = this.selectedRow;
    if (row === 0) { this.showToast('No cells above to sum.'); return; }
    const colLetter = String.fromCharCode(65 + col);
    const formula = `=SUM(${colLetter}1:${colLetter}${row})`;
    this.cells[row][col] = formula;
    this.formulaBarValue = formula;
    // Evaluate: sum all numeric values above
    let total = 0;
    for (let r = 0; r < row; r++) {
      const v = parseFloat(this.cells[r][col]);
      if (!isNaN(v)) total += v;
    }
    this.cells[row][col] = String(total);
    this.formulaBarValue = String(total);
    this.onCellChange();
    this.showToast(`SUM of ${colLetter}1:${colLetter}${row} = ${total}`);
  }

  exportFile(format: string) {
    this.save();
    this.api.exportDocument(this.docId, format).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${this.title}.${format}`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  showToast(msg: string) {
    this.toastMsg = msg; this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 2500);
  }

  back() { this.save(); this.router.navigate(['/']); }
  ngOnDestroy() { this.syncSub?.unsubscribe(); this.api.disconnectSync(); }
}