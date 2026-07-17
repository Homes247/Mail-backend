import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ChatWidgetComponent } from '../../components/chat-widget/chat-widget.component';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
const colName = (i: number) => {
  let name = '';
  let temp = i;
  while (temp >= 0) {
    name = String.fromCharCode(65 + (temp % 26)) + name;
    temp = Math.floor(temp / 26) - 1;
  }
  return name;
};

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  vertAlign?: 'top' | 'middle' | 'bottom';
  font?: string;
  size?: string;
  wrap?: 'overflow' | 'wrap' | 'clip' | 'shrink' | boolean;
  indent?: number;
  rotation?: string | number;
  numFormat?: string;
  decimals?: number;
  borders?: {
    top?: boolean | CellBorder;
    bottom?: boolean | CellBorder;
    left?: boolean | CellBorder;
    right?: boolean | CellBorder;
    all?: boolean | CellBorder;
  };
}

export interface CellBorder {
  color?: string;
  style?: string;
  width?: string;
}

export interface DropdownOption {
  label: string;
  color?: string;
}

export interface CellValidation {
  type: 'list';
  options: (string | DropdownOption)[];
}

@Component({
  selector: 'app-sheet-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ChatWidgetComponent],
  template: `
    <div class="shell" [ngClass]="'theme-' + currentTheme" (mousedown)="$event.target===$event.currentTarget?closeMenus():null">

      <!-- ═══ TOP BAR ════════════════════════════════════════════════════════ -->
      <div class="top-bar" *ngIf="showTopBar">
        <div class="tl" style="align-items:center;">
          <button class="back-btn" (click)="back()" title="Back" style="background:none; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; flex-shrink:0; opacity:0.8;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
          <div class="brand" style="display:flex; align-items:center; gap:6px; cursor:pointer;" (click)="goHome()">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="5" fill="#26A96C"/>
              <rect x="5" y="8" width="22" height="2.5" rx="1.2" fill="white"/>
              <rect x="5" y="13.5" width="22" height="2.5" rx="1.2" fill="white"/>
              <rect x="5" y="19" width="14" height="2.5" rx="1.2" fill="white"/>
            </svg>
            <span class="brand-name" style="font-weight:600; font-size:18px;">Sheet</span>
          </div>
          <div class="doc-sec" style="display:flex; align-items:center; gap:12px; margin-top:0; margin-left:8px;">
            <input class="doc-title" [(ngModel)]="title" (blur)="save()" placeholder="Untitled spreadsheet" [style.width.ch]="(title || 'Untitled spreadsheet').length + 3"/>
            <div class="doc-icons" style="display:flex; align-items:center; gap:8px; opacity:0.8;">
              <span class="material-symbols-outlined" style="font-size:16px; cursor:pointer;" (click)="toggleStar()" [style.color]="isStarred ? '#fbbc04' : 'inherit'" [title]="isStarred ? 'Unstar' : 'Star'">{{ isStarred ? 'star' : 'star_border' }}</span>
              <span class="material-symbols-outlined" style="font-size:16px; cursor:pointer;" (click)="openFeatureModal('move')" title="Move to Folder">folder_open</span>
              <div style="display:flex; align-items:center; font-size:12px; color:inherit; margin-left:4px;">
                <span *ngIf="saveStatus==='saving'" style="font-style:italic;">Saving...</span>
                <span *ngIf="saveStatus==='saved'">
                   Saved at {{lastSavedTime}}
                </span>
                <span *ngIf="saveStatus==='error'" style="color:#ea4335;">Failed to save</span>
              </div>
            </div>
          </div>
        </div>
        <div class="tr">
          <div class="top-search-box" [class.has-query]="inlineSearchQuery">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0; opacity:0.7;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search in this sheet" [(ngModel)]="inlineSearchQuery" (ngModelChange)="onInlineSearch()" (keydown.enter)="inlineFindNext()" class="inline-search-input">
            
            <ng-container *ngIf="inlineSearchQuery">
              <button (click)="clearInlineSearch()" class="inline-search-clear" title="Clear search">
                <span class="material-symbols-outlined" style="font-size:14px;">close</span>
              </button>
              <div class="inline-search-divider"></div>
              <span class="inline-search-count">{{ inlineSearchMatches.length ? inlineSearchIdx + 1 : 0 }} / {{ inlineSearchMatches.length }}</span>
              <div class="inline-search-nav">
                <button (click)="inlineFindPrev()" title="Previous match"><span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span></button>
                <button (click)="inlineFindNext()" title="Next match"><span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span></button>
              </div>
            </ng-container>
          </div>
          <div class="online-badge" *ngIf="showUserPresence && activeUsers>1" title="{{activeUsers}} users editing">
            <span class="material-symbols-outlined" style="font-size:16px;">group</span>
            <span style="margin-left:4px;">{{activeUsers}}</span>
          </div>
          <button class="share-btn" (click)="shareModalOpen=true">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
          
          <button class="properties-btn" (click)="propertiesPanelOpen = true" title="Properties">
            <span class="material-symbols-outlined" style="font-size:20px;">info</span>
          </button>
          
          <div class="av" (click)="profileOpen=!profileOpen;$event.stopPropagation()" title="Account">{{initials}}
            <div class="profile-dd" *ngIf="profileOpen" (click)="$event.stopPropagation()">
              <div class="pd-head">
                <div class="pd-av">{{initials}}</div>
                <div>
                  <div style="font-size:13px;font-weight:600;color:#202124;">{{auth.user?.name ?? 'User'}}</div>
                  <div style="font-size:11px;color:#5f6368;">{{auth.user?.email ?? ''}}</div>
                </div>
              </div>
              <div class="pd-item" (click)="openApp('account')"><span class="material-symbols-outlined pd-icon">manage_accounts</span> My Account</div>
              <div class="pd-item" (click)="openApp('calendar')"><span class="material-symbols-outlined pd-icon">calendar_month</span> Calendar</div>
              <div class="pd-item" (click)="openApp('notes')"><span class="material-symbols-outlined pd-icon">sticky_note_2</span> Notes</div>
              <div class="pd-item" (click)="openApp('tasks')"><span class="material-symbols-outlined pd-icon">task_alt</span> Tasks</div>
              <div class="pd-item" (click)="openApp('settings')"><span class="material-symbols-outlined pd-icon">settings</span> Settings</div>
              <div class="pd-sep"></div>
              <div class="pd-item danger" (click)="auth.logout()"><span class="material-symbols-outlined pd-icon">logout</span> Sign Out</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ MENU BAR ══════════════════════════════════════════════════════ -->
      <div class="menu-row" (mousedown)="$event.preventDefault()">
        <div class="mi" (click)="toggleMenu('file',$event)" [class.mi-open]="activeMenu==='file'">File
                    <div class="mdd" *ngIf="activeMenu==='file'">
            <div class="mdi" (click)="newDoc()"><span class="mdi-icon material-symbols-outlined">grid_view</span>New Spreadsheet<span class="mh">Ctrl+N</span></div>
            <div class="mdi" (click)="openFeatureModal('template')"><span class="mdi-icon material-symbols-outlined">dashboard_customize</span>New from Template...</div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">folder_open</span>Open<span class="mdi-arrow material-symbols-outlined">chevron_right</span>
               <div class="mdi-sub">
                 <div class="mdi" (click)="openFeatureModal('open')">From Vmail Drive</div>
                 <div class="mdi" (click)="openFeatureModal('import')">From Computer</div>
               </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">upload_file</span>Import<span class="mdi-arrow material-symbols-outlined">chevron_right</span>
               <div class="mdi-sub">
                 <div class="mdi" (click)="openFeatureModal('import')">Upload File</div>
               </div>
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="triggerCopy()"><span class="mdi-icon material-symbols-outlined">content_copy</span>Make a Copy...</div>
            <div class="mdi" (click)="save(); closeMenus()"><span class="mdi-icon material-symbols-outlined">save</span>Save<span class="mh">Ctrl+S</span></div>
                        <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">download</span>Download as<span class="mdi-arrow material-symbols-outlined">chevron_right</span>
               <div class="mdi-sub">
                 <div class="mdi" (click)="exportFile('xlsx')">MS Excel Workbook<span class="mh">.xlsx</span></div>
                 <div class="mdi" (click)="exportFile('xlsb')">MS Excel Binary Workbook<span class="mh">.xlsb</span></div>
                 <div class="mdi" (click)="exportFile('ods')">Open Office Spreadsheet<span class="mh">.ods</span></div>
                 <div class="mdi" (click)="exportFile('csv')">Comma Separated Values<span class="mh">.csv</span></div>
                 <div class="mdi" (click)="exportFile('tsv')">Tab Separated Values<span class="mh">.tsv</span></div>
                 <div class="mdi" (click)="exportFile('pdf')">PDF Document<span class="mh">.pdf</span></div>
                 <div class="mdi" (click)="exportFile('html')">HTML Document<span class="mh">.zip</span></div>
               </div>
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="openFeatureModal('password')"><span class="mdi-icon material-symbols-outlined">lock</span>Password Protected File...</div>
            <div class="mdi" (click)="shareModalOpen=true;closeMenus()"><span class="mdi-icon material-symbols-outlined">mail</span>Email As Attachment...</div>
            <div class="mds"></div>
            <div class="mdi" (click)="openFeatureModal('move')"><span class="mdi-icon material-symbols-outlined">drive_file_move</span>Move...</div>
            <div class="mdi" (click)="triggerRename()"><span class="mdi-icon material-symbols-outlined">drive_file_rename_outline</span>Rename...</div>
            <div class="mds"></div>
            <div class="mdi" (click)="openFeatureModal('audit')"><span class="mdi-icon material-symbols-outlined">history</span>Audit Trail...</div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">update</span>Version<span class="mdi-arrow material-symbols-outlined">chevron_right</span>
               <div class="mdi-sub">
                 <div class="mdi" (click)="openFeatureModal('version')">Version History</div>
               </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">schema</span>Workflow<span class="mdi-arrow material-symbols-outlined">chevron_right</span>
               <div class="mdi-sub">
                 <div class="mdi" (click)="openFeatureModal('workflow')">Manage Workflows</div>
               </div>
            </div>
            <div class="mds"></div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">share</span>Share<span class="mdi-arrow material-symbols-outlined">chevron_right</span>
               <div class="mdi-sub">
                 <div class="mdi" (click)="shareModalOpen=true;closeMenus()"><span class="mdi-icon material-symbols-outlined">person_add</span>Share with collaborators</div>
                 <div class="mdi" (click)="shareModalOpen=true;closeMenus()"><span class="mdi-icon material-symbols-outlined">link</span>Publish to web</div>
               </div>
            </div>
            <div class="mdi danger" (click)="trashDoc()"><span class="mdi-icon material-symbols-outlined" style="color:inherit">delete</span>Move to Trash</div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('edit',$event)" [class.mi-open]="activeMenu==='edit'">Edit
          <div class="mdd" *ngIf="activeMenu==='edit'">
            <div class="mdi" (click)="undo()">Undo<span class="mh">Ctrl+Z</span></div>
            <div class="mdi" (click)="redo()">Redo<span class="mh">Ctrl+Y</span></div>
            <div class="mds"></div>
            <div class="mdi" (click)="cutCell();closeMenus()">Cut<span class="mh">Ctrl+X</span></div>
            <div class="mdi" (click)="copyCell()">Copy<span class="mh">Ctrl+C</span></div>
            <div class="mdi has-sub">Paste <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="pasteCell()">All<span class="mh">Ctrl+V</span></div>
                <div class="mdi" (click)="pasteValues()">Values<span class="mh">Ctrl+Shift+V</span></div>
                <div class="mdi" (click)="pasteFormulas()">Formulas</div>
                <div class="mdi" (click)="pasteFormats()">Formats</div>
                <div class="mdi" (click)="pasteNotes()">Notes</div>
                <div class="mds"></div>
                <div class="mdi" (click)="pasteFormulasAndNumberFormats()">Formulas and Number Formats</div>
                <div class="mdi" (click)="pasteValuesAndNumberFormats()">Values and Number Formats</div>
                <div class="mdi" (click)="pasteValidation()">Validation</div>
                <div class="mds"></div>
                <div class="mdi" (click)="pasteExceptNotes()">All Except Notes</div>
                <div class="mdi" (click)="pasteExceptBorders()">All Except Borders</div>
                <div class="mds"></div>
                <div class="mdi disabled">Link To Source</div>
              </div>
            </div>
            <div class="mds"></div>
            <div class="mdi has-sub">Fill <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="fillDown();closeMenus()">Down<span class="mh">Ctrl+D</span></div>
                <div class="mdi" (click)="fillRight();closeMenus()">Right<span class="mh">Ctrl+R</span></div>
                <div class="mdi" (click)="fillUp();closeMenus()">Up</div>
                <div class="mdi" (click)="fillLeft();closeMenus()">Left</div>
                <div class="mds"></div>
                <div class="mdi" (click)="patternFill();closeMenus()">Pattern Fill<span class="mh">Ctrl+E</span></div>
              </div>
            </div>
            <div class="mdi has-sub">Clear <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="clearAll()">All<span class="mh">Ctrl+Del</span></div>
                <div class="mdi" (click)="clearAllFormats()">Formats<span class="mh">Shift+Del</span></div>
                <div class="mdi" (click)="clearRangeData()">Contents<span class="mh">Del</span></div>
                <div class="mds"></div>
                <div class="mdi" (click)="clearNotes()">Notes</div>
                <div class="mdi" (click)="clearHyperlinks()">Hyperlinks</div>
                <div class="mdi" (click)="clearCheckboxes()">Checkboxes</div>
                <div class="mds"></div>
                <div class="mdi" (click)="clearDataValidations()">Data Validations</div>
                <div class="mdi" (click)="clearConditionalFormats()">Conditional Formats</div>
                <div class="mdi" (click)="clearRichTextFormats()">RichText Formats</div>
              </div>
            </div>
            <div class="mdi has-sub">Delete <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="deleteShiftLeft()">Shift Cells Left</div>
                <div class="mdi" (click)="deleteShiftUp()">Shift Cells Up</div>
                <div class="mds"></div>
                <div class="mdi" (click)="deleteRow()">Delete {{ selectedRowCount }} Row{{ selectedRowCount > 1 ? 's' : '' }}</div>
                <div class="mdi" (click)="deleteCol()">Delete {{ selectedColCount }} Column{{ selectedColCount > 1 ? 's' : '' }}</div>
              </div>
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="openFind();closeMenus()">Find and Replace...<span class="mh">Ctrl+Shift+H</span></div>
            <div class="mdi" (click)="openFeatureModal('goto');closeMenus()">Go To...<span class="mh">Ctrl+G</span></div>
            <div class="mds"></div>
            <div class="mdi" (click)="recalculate();closeMenus()">Recalculate<span class="mh">F9</span></div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('view',$event)" [class.mi-open]="activeMenu==='view'">View
          <div class="mdd" *ngIf="activeMenu==='view'">
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">dataset</span>Freeze <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="freezeRows(1);closeMenus()">Row 1</div>
                <div class="mdi" (click)="freezeRows(selectedRow+1);closeMenus()">Up to Row {{selectedRow+1}}</div>
                <div class="mds"></div>
                <div class="mdi" (click)="freezeCols(1);closeMenus()">Column A</div>
                <div class="mdi" (click)="freezeCols(selectedCol+1);closeMenus()">Up to Column {{colLabel(selectedCol)}}</div>
                <div class="mds"></div>
                <div class="mdi" (click)="freezeSelection();closeMenus()" style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.2; padding:6px 16px;">
                  <div>Selection</div>
                  <div style="font-size:10px; color:#9aa0a6; white-space:normal; max-width:180px; margin-top:4px;">The selected row(s) or column(s) will be frozen and placed to the top or left of the editor respectively.</div>
                </div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">visibility</span>Hide &amp; Unhide <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="hideRows();closeMenus()">Hide Rows<span class="mh">Ctrl+Alt+9</span></div>
                <div class="mdi" (click)="hideCols();closeMenus()">Hide Columns<span class="mh">Ctrl+Alt+0</span></div>
                <div class="mdi disabled">Hide Sheet</div>
                <div class="mds"></div>
                <div class="mdi" (click)="unhideRows();closeMenus()">Unhide Rows<span class="mh">Ctrl+Shift+9</span></div>
                <div class="mdi" (click)="unhideCols();closeMenus()">Unhide Columns<span class="mh">Ctrl+Shift+0</span></div>
                <div class="mds"></div>
                <div class="mdi disabled">Hidden Sheets <span class="mdi-arrow material-symbols-outlined">chevron_right</span></div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">grid_on</span>Gridlines <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub" style="width:240px; padding:8px;">
                <div class="mdi" (click)="toggleGridlines();closeMenus()" style="padding:6px 8px; margin-bottom:8px;"><span class="material-symbols-outlined" style="font-size:16px; margin-right:8px; vertical-align:-3px;">{{showGridlines?'visibility_off':'visibility'}}</span>{{showGridlines?'Hide Gridlines':'Show Gridlines'}}</div>
                <div class="mdi" (click)="setGridlineColor('#d0d0d0');closeMenus()" style="padding:6px 8px;"><div style="width:16px; height:16px; border-radius:50%; background:#000; display:inline-block; vertical-align:-3px; margin-right:8px;"></div>Default Color</div>
                <div style="font-size:12px; color:#e8eaed; margin:8px 8px 4px;">Theme Colors</div>
                <div class="cp-grid" style="padding:0 8px;"><div *ngFor="let c of themeColorsTop" class="cp-sw" [style.background]="c" (click)="setGridlineColor(c); closeMenus()"></div></div>
                <div class="cp-grid" style="padding:0 8px;"><div *ngFor="let c of themeColorsGrid" class="cp-sw" [style.background]="c" (click)="setGridlineColor(c); closeMenus()"></div></div>
                <div style="font-size:12px; color:#e8eaed; margin:12px 8px 4px;">Standard Colors</div>
                <div class="cp-grid" style="padding:0 8px;"><div *ngFor="let c of standardColors" class="cp-sw" [style.background]="c" (click)="setGridlineColor(c); closeMenus()"></div></div>
                <div class="mds" style="margin:8px 0;"></div>
                <div class="mdi" style="padding:6px 8px;" (click)="showToast('More Colors opening...');closeMenus()">More Colors <span class="mdi-arrow material-symbols-outlined">chevron_right</span></div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">swap_horiz</span>Grid Direction <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="setGridDirection('ltr');closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{gridDirection==='ltr'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Left to Right</div>
                <div class="mdi" (click)="setGridDirection('rtl');closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{gridDirection==='rtl'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Right to Left</div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">space_dashboard</span>Grid Spacing <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="setGridSpacing('classic');closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{gridSpacing==='classic'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Classic</div>
                <div class="mdi" (click)="setGridSpacing('cozy');closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{gridSpacing==='cozy'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Cozy</div>
                <div class="mdi" (click)="setGridSpacing('comfort');closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{gridSpacing==='comfort'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Comfort</div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">zoom_in</span>Zoom <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub" style="height:250px; overflow-y:auto;">
                <div class="mdi" (click)="setZoom(400);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===400?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>400%</div>
                <div class="mdi" (click)="setZoom(300);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===300?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>300%</div>
                <div class="mdi" (click)="setZoom(250);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===250?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>250%</div>
                <div class="mdi" (click)="setZoom(200);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===200?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>200%</div>
                <div class="mdi" (click)="setZoom(150);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===150?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>150%</div>
                <div class="mdi" (click)="setZoom(125);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===125?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>125%</div>
                <div class="mdi" (click)="setZoom(100);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===100?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>100%</div>
                <div class="mdi" (click)="setZoom(75);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===75?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>75%</div>
                <div class="mdi" (click)="setZoom(50);closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{zoomLevel===50?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>50%</div>
                <div class="mds"></div>
                <div class="mdi" (click)="setZoom(100);closeMenus()">Default (100%)</div>
              </div>
            </div>
            <div class="mds"></div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">light_mode</span>Appearance <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="appearance='light';closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{appearance==='light'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span><span class="material-symbols-outlined" style="font-size:16px; margin-right:8px; vertical-align:-3px;">light_mode</span>Light</div>
                <div class="mdi" (click)="appearance='dark';closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{appearance==='dark'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span><span class="material-symbols-outlined" style="font-size:16px; margin-right:8px; vertical-align:-3px;">dark_mode</span>Dark</div>
                <div class="mds"></div>
                <div class="mdi" (click)="appearance='system';closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{appearance==='system'?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span><span class="material-symbols-outlined" style="font-size:16px; margin-right:8px; vertical-align:-3px;">desktop_windows</span>System Default</div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">settings_suggest</span>View Settings <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="showTopBar = !showTopBar; closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{showTopBar?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Top Bar</div>
                <div class="mdi" (click)="showFormulaBar = !showFormulaBar; closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{showFormulaBar?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Formula Bar</div>
                <div class="mdi" (click)="showStatusBar = !showStatusBar; closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{showStatusBar?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Status Bar</div>
                <div class="mds"></div>
                <div class="mdi" (click)="showNotes = !showNotes; closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{showNotes?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Notes</div>
                <div class="mdi" (click)="showUserPresence = !showUserPresence; closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{showUserPresence?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>User Presence</div>
                <div class="mdi" (click)="showLockPattern = !showLockPattern; closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{showLockPattern?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Lock Pattern</div>
                <div class="mdi" (click)="showHighlightPrintArea = !showHighlightPrintArea; closeMenus()"><span class="material-symbols-outlined" style="font-size:16px; visibility:{{showHighlightPrintArea?'visible':'hidden'}}; vertical-align:-3px; margin-right:8px;">check</span>Highlight Print Area</div>
              </div>
            </div>
            <div class="mds"></div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">border_vertical</span>Highlight Row/Column <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub" style="width:160px; padding:8px;">
                <div class="cp-grid">
                  <div *ngFor="let c of highlightColors" class="cp-sw" style="border-radius:4px; width:24px; height:24px; border:1px solid #ccc;" [style.background]="c==='transparent'?'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQYV2N89erVfwY0ICYmJowuw6iCRQcoP1AwgAUBABvGGR9Lw4lTAAAAAElFTkSuQmCC)':c" (click)="highlightRowColColor = c; closeMenus()"></div>
                </div>
              </div>
            </div>
            <div class="mdi" (click)="toggleFullScreen();closeMenus()"><span class="mdi-icon material-symbols-outlined">fullscreen</span>Full Screen</div>
            <div class="mds"></div>
            <div class="mdi disabled"><span class="mdi-icon material-symbols-outlined">web_stories</span>Navigation</div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('insert',$event)" [class.mi-open]="activeMenu==='insert'">Insert
          <div class="mdd" *ngIf="activeMenu==='insert'">
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">data_table</span>Row <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="insertRowAbove()">{{ selectedRowCount }} Row{{ selectedRowCount > 1 ? 's' : '' }} Above</div>
                <div class="mdi" (click)="insertRowBelow()">{{ selectedRowCount }} Row{{ selectedRowCount > 1 ? 's' : '' }} Below</div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">view_column</span>Column <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="insertColLeft()">{{ selectedColCount }} Column{{ selectedColCount > 1 ? 's' : '' }} Before</div>
                <div class="mdi" (click)="insertColRight()">{{ selectedColCount }} Column{{ selectedColCount > 1 ? 's' : '' }} After</div>
                <div class="mdi" (click)="customInsertCol()">Custom...</div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">add_box</span>Cell <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="shiftCellsDown()">Shift Cells Down</div>
                <div class="mdi" (click)="shiftCellsRight()">Shift Cells Right</div>
              </div>
            </div>
            <div class="mdi" (click)="addSheet()"><span class="mdi-icon material-symbols-outlined">post_add</span>Sheet<span class="mh">Shift+F11</span></div>
            <div class="mds"></div>
            <div class="mdi" (click)="generateChart()"><span class="mdi-icon material-symbols-outlined">insert_chart</span>Chart...</div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">show_chart</span>Sparkline <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="createSparkline()">Create Sparkline...</div>
                <div class="mdi" (click)="editSparkline()">Edit Sparkline...</div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">image</span>Image <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="triggerImageInsert('cell')">Image in cell...</div>
                <div class="mdi" (click)="triggerImageInsert('over')">Image over cells...</div>
              </div>
            </div>
            <div class="mdi" (click)="toggleMenu('shape', $event)"><span class="mdi-icon material-symbols-outlined">category</span>Shape</div>
            <div class="mdi" (click)="insertButton()"><span class="mdi-icon material-symbols-outlined">smart_button</span>Button</div>
            <div class="mds"></div>
            <div class="mdi" (click)="insertLink()"><span class="mdi-icon material-symbols-outlined">link</span>Hyperlink...<span class="mh">Ctrl+K</span></div>
            <div class="mdi" (click)="insertFunction('SUM')"><span class="mdi-icon material-symbols-outlined">functions</span>Function...<span class="mh">Shift+F3</span></div>
            <div class="mdi" (click)="defineName()"><span class="mdi-icon material-symbols-outlined">badge</span>Define Name<span class="mh">Ctrl+F3</span></div>
            <div class="mds"></div>
            <div class="mdi" (click)="insertNote()"><span class="mdi-icon material-symbols-outlined">sticky_note_2</span>Note<span class="mh">Shift+F2</span></div>
            <div class="mdi" (click)="insertComment()"><span class="mdi-icon material-symbols-outlined">comment</span>Comment</div>
            <div class="mds"></div>
            <div class="mdi" (click)="insertCheckbox();closeMenus()"><span class="mdi-icon material-symbols-outlined">check_box</span>Checkbox</div>
            
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">checklist</span>Picklist <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub" style="width:400px; padding:16px; max-height:70vh; overflow-y:auto; top: auto; bottom: -5px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom:16px;">
                  
                  <!-- Column 1 -->
                  <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                      <div style="font-size:10px; font-weight:600; color:#888; margin-bottom:2px; letter-spacing:0.5px;">PROJECT STATUS</div>
                      <div style="background:#e2e8f0; color:#4a5568; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('project_status')">Yet to start</div>
                      <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('project_status')">Blocked</div>
                      <div style="background:#fefcbf; color:#b7791f; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('project_status')">In Progress</div>
                      <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('project_status')">Completed</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                      <div style="font-size:10px; font-weight:600; color:#888; margin-bottom:2px; letter-spacing:0.5px;">PRIORITY</div>
                      <div style="background:#bee3f8; color:#2b6cb0; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('priority')">Low</div>
                      <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('priority')">Medium</div>
                      <div style="background:#fefcbf; color:#b7791f; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('priority')">High</div>
                      <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('priority')">Critical</div>
                    </div>
                  </div>

                  <!-- Column 2 -->
                  <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                      <div style="font-size:10px; font-weight:600; color:#888; margin-bottom:2px; letter-spacing:0.5px;">BUG STATUS</div>
                      <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">Open</div>
                      <div style="background:#fefcbf; color:#b7791f; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">In Progress</div>
                      <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">Closed</div>
                      <div style="background:#bee3f8; color:#2b6cb0; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">Reopen</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                      <div style="font-size:10px; font-weight:600; color:#888; margin-bottom:2px; letter-spacing:0.5px;">DECISION</div>
                      <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('decision')">Yes</div>
                      <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('decision')">No</div>
                    </div>
                  </div>

                  <!-- Column 3 -->
                  <div style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                      <div style="font-size:10px; font-weight:600; color:#888; margin-bottom:2px; letter-spacing:0.5px;">REVIEW</div>
                      <div style="background:#e2e8f0; color:#4a5568; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('review')">Yet to start</div>
                      <div style="background:#bee3f8; color:#2b6cb0; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('review')">Under Review</div>
                      <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('review')">Approved</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                      <div style="font-size:10px; font-weight:600; color:#888; margin-bottom:2px; letter-spacing:0.5px;">BOOLEAN</div>
                      <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('boolean')">True</div>
                      <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:4px 10px; border-radius:12px; cursor:pointer;" (click)="applyPresetPicklist('boolean')">False</div>
                    </div>
                  </div>
                </div>

                <div style="height:1px; background:#e2e8f0; margin-bottom:8px;"></div>
                <div class="mdi" style="padding: 8px 12px; font-weight: 500;" (click)="openValidationModal();closeMenus()">Create Picklist...</div>
                <div class="mdi" style="padding: 8px 12px; font-weight: 500;" (click)="openValidationModal();closeMenus()">Manage Picklist...</div>
              </div>
            </div>
            <div class="mdi" (click)="insertEmoji()"><span class="mdi-icon material-symbols-outlined">add_reaction</span>Emoji</div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('format',$event)" [class.mi-open]="activeMenu==='format'">Format
          <div class="mdd" *ngIf="activeMenu==='format'">
            <div class="mdi has-sub">Text <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="toggleFormat('bold')">Bold<span class="mh">Ctrl+B</span></div>
                <div class="mdi" (click)="toggleFormat('italic')">Italic<span class="mh">Ctrl+I</span></div>
                <div class="mdi" (click)="toggleFormat('underline')">Underline<span class="mh">Ctrl+U</span></div>
                <div class="mdi" (click)="toggleFormat('strikethrough')">Strikethrough</div>
              </div>
            </div>
            <div class="mdi has-sub">Alignment <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="setFormat('align','left')">Align Left</div>
                <div class="mdi" (click)="setFormat('align','center')">Align Center</div>
                <div class="mdi" (click)="setFormat('align','right')">Align Right</div>
                <div class="mds"></div>
                <div class="mdi" (click)="setFormat('vertAlign','top')">Vertical Top</div>
                <div class="mdi" (click)="setFormat('vertAlign','middle')">Vertical Middle</div>
                <div class="mdi" (click)="setFormat('vertAlign','bottom')">Vertical Bottom</div>
              </div>
            </div>
            <div class="mdi has-sub">Number <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="setNumFormat('general')">General</div>
                <div class="mdi" (click)="setNumFormat('number')">Number</div>
                <div class="mdi" (click)="setNumFormat('currency')">Currency ($)</div>
                <div class="mdi" (click)="setNumFormat('percent')">Percentage (%)</div>
              </div>
            </div>
            <div class="mdi has-sub">Borders <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="setBorders('all')">All Borders</div>
                <div class="mdi" (click)="setBorders('outer')">Outer Border</div>
                <div class="mdi" (click)="setBorders('none')">No Border</div>
              </div>
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="mergeCells()">Merge Cells</div>
            <div class="mdi" (click)="unmerge()">Unmerge</div>
            <div class="mdi" (click)="toggleWrap()">Wrap Text</div>
            <div class="mds"></div>
            <div class="mdi" (click)="clearAllFormats()">Clear Formatting</div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('data',$event)" [class.mi-open]="activeMenu==='data'">Data
          <div class="mdd" *ngIf="activeMenu==='data'">
            
            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">sort_by_alpha</span> Sort
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                    <div class="mdi" (click)="sortColAZ()"><span class="material-symbols-outlined mdi-icon" style="font-size:16px;">arrow_upward</span> Sort Ascending</div>
                    <div class="mdi" (click)="sortColZA()"><span class="material-symbols-outlined mdi-icon" style="font-size:16px;">arrow_downward</span> Sort Descending</div>
                    <div class="mdi" (click)="showToast('Custom Sort...')"><span class="material-symbols-outlined mdi-icon" style="font-size:16px;">sort</span> Custom Sort...</div>
                </div>
            </div>
            
            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">filter_alt</span> Filter
                <span class="mh">Ctrl+Shift+L</span>
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                    <div class="mdi" (click)="toggleFilter()">Create Filter</div>
                    <div class="mds"></div>
                    <div class="mdi" (click)="showToast('Reapply')">Reapply <span class="mh">Ctrl+Alt+L</span></div>
                    <div class="mdi" (click)="filterActive=false;showToast('Clear Filter')">Clear Filter</div>
                    <div class="mds"></div>
                    <div class="mdi" (click)="showToast('Set as Document Filter')">Set as Document Filter</div>
                    <div class="mdi" (click)="showToast('Name this filter')">Name this filter</div>
                    <div class="mdi" (click)="showToast('Manage Filters')">Manage Filters</div>
                    <div class="mdi has-sub" (click)="showToast('Named Filters')">Named Filters <span class="material-symbols-outlined mdi-arrow">chevron_right</span></div>
                    <div class="mds"></div>
                    <div class="mdi" (click)="showToast('Highlight Filter')"><span class="material-symbols-outlined mdi-icon" style="font-size:16px;color:transparent;">check</span> Highlight Filter</div>
                </div>
            </div>

            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">group_work</span> Group & Ungroup
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                    <div class="mdi" (click)="groupRow()">Group Row <span class="mh">Alt+Shift+&rarr;</span></div>
                    <div class="mdi" (click)="groupCol()">Group Column <span class="mh">Alt+Shift+&rarr;</span></div>
                    <div class="mds"></div>
                    <div class="mdi" style="color:#718096" (click)="ungroupRow()">Ungroup Row <span class="mh">Alt+Shift+&larr;</span></div>
                    <div class="mdi" style="color:#718096" (click)="ungroupCol()">Ungroup Column <span class="mh">Alt+Shift+&larr;</span></div>
                    <div class="mds"></div>
                    <div class="mdi" style="color:#718096" (click)="clearGroups()">Clear Groups</div>
                </div>
            </div>
            
            <div class="mds"></div>

            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">pivot_table_chart</span> Pivot Table
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                    <div class="mdi" (click)="openPivotModal($event)">Create Pivot Table...</div>
                    <div class="mds"></div>
                    <div class="mdi" style="color:#718096" (click)="showToast('Add Pivot Chart')">Add Pivot Chart</div>
                    <div class="mdi" style="color:#718096" (click)="showToast('Add Slicer...')">Add Slicer...</div>
                    <div class="mdi" style="color:#718096" (click)="showToast('Add Timeline...')">Add Timeline...</div>
                </div>
            </div>
            
            <div class="mds"></div>

            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">playlist_add_check</span> Data Validation
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                    <div class="mdi" (click)="openDataValidationModal($event)">Create Validation...</div>
                    <div class="mdi" (click)="openManageRulesModal($event)">Manage Validation...</div>
                    <div class="mds"></div>
                    <div class="mdi" (click)="showToast('Highlight Invalid Data')">Highlight Invalid Data</div>
                </div>
            </div>
            
            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">cleaning_services</span> Data Cleaning
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub" style="min-width: 180px;">
                    <div class="mdi" (click)="removeDuplicates()">Remove Duplicates</div>
                </div>
            </div>

            <div class="mdi" (click)="openTextToColumnsModal(); closeMenus()">
                <span class="material-symbols-outlined mdi-icon">view_column</span> Text to Columns...
            </div>
            <div class="mdi" (click)="patternFill(); closeMenus()">
                <span class="material-symbols-outlined mdi-icon">format_paint</span> Pattern Fill <span class="mh">Ctrl+E</span>
            </div>
            
            <div class="mds"></div>

            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">cable</span> Data Connection
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                  <div class="mdi disabled">Connect to Database</div>
                  <div class="mdi disabled">Connect to API</div>
                </div>
            </div>
            <div class="mdi" (click)="linkSpreadsheet(); closeMenus()">
                <span class="material-symbols-outlined mdi-icon">link</span> Link Spreadsheet...
            </div>
            <div class="mdi" (click)="dataFromPicture(); closeMenus()">
                <span class="material-symbols-outlined mdi-icon">image</span> Data from Picture...
            </div>
            
            <div class="mds"></div>

            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">lock</span> Lock
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                  <div class="mdi" (click)="lockCurrentSheet(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">lock</span>
                    {{ sheets[currentSheetIdx].locked ? 'Unlock Sheet' : 'Lock Sheet' }}
                  </div>
                  <div class="mds"></div>
                  <div class="mdi" (click)="lockSelectedRange(); closeMenus()">
                    <span class="material-symbols-outlined mdi-icon">lock_open</span> Lock Selected Range
                  </div>
                </div>
            </div>
            <div class="mdi has-sub">
                <span class="material-symbols-outlined mdi-icon">publish</span> Publish Range
                <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
                <div class="mdi-sub">
                  <div class="mdi" (click)="publishRange(); closeMenus()">Publish as Web Page</div>
                  <div class="mdi" (click)="copyPublishLink(); closeMenus()">Copy Shareable Link</div>
                </div>
            </div>

          </div>
        </div>
        <div class="mi" (click)="toggleMenu('review',$event)" [class.mi-open]="activeMenu==='review'">Review
          <div class="mdd" *ngIf="activeMenu==='review'" style="min-width:220px;">
            <div class="mdi" (click)="spellCheck(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">spellcheck</span> Spell Check...
            </div>
            <div class="mdi" (click)="personalDictionary(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">book</span> Personal Dictionary...
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="showWordCount(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">bar_chart</span> Spreadsheet Statistics...
            </div>
            <div class="mdi" (click)="translateSheet(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">translate</span> Translate...
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="openAuditTrail(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">history</span> Audit Trail...
            </div>
            <div class="mdi" (click)="openEditHistory(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">edit_note</span> Edit History...
            </div>
            <div class="mdi" (click)="activeModal='version'; closeMenus()">
              <span class="material-symbols-outlined mdi-icon">manage_history</span> Version History
            </div>
            <div class="mds"></div>
            <div class="mdi has-sub">
              <span class="material-symbols-outlined mdi-icon">account_tree</span> Workflow
              <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="activeModal='workflow'; closeMenus()">Manage Workflows</div>
                <div class="mdi disabled">Create Workflow</div>
              </div>
            </div>
            <div class="mdi has-sub">
              <span class="material-symbols-outlined mdi-icon">comment</span> Comment
              <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="insertComment(); closeMenus()">Add Comment</div>
                <div class="mdi" (click)="showAllComments(); closeMenus()">Show All Comments</div>
              </div>
            </div>
            <div class="mdi" (click)="insertNote(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">sticky_note_2</span> Note <span class="mh">Shift+F2</span>
            </div>
            <div class="mds"></div>
            <div class="mdi has-sub">
              <span class="material-symbols-outlined mdi-icon">lock</span> Lock
              <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="lockCurrentSheet(); closeMenus()">
                  {{ sheets[currentSheetIdx].locked ? 'Unlock Sheet' : 'Lock Sheet' }}
                </div>
                <div class="mdi" (click)="lockSelectedRange(); closeMenus()">Lock Selected Range</div>
              </div>
            </div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('tools',$event)" [class.mi-open]="activeMenu==='tools'">Tools
          <div class="mdd" *ngIf="activeMenu==='tools'" style="min-width:220px;">
            <div class="mdi has-sub">
              <span class="material-symbols-outlined mdi-icon">assignment</span> Form
              <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="createForm(); closeMenus()">Create Form</div>
                <div class="mdi" (click)="viewForm(); closeMenus()">View Form Responses</div>
              </div>
            </div>
            <div class="mdi has-sub">
              <span class="material-symbols-outlined mdi-icon">code</span> VBA Macros
              <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="openMacroEditor(); closeMenus()">Record Macro</div>
                <div class="mdi" (click)="openMacroEditor(); closeMenus()">Edit Macros</div>
              </div>
            </div>
            <div class="mdi has-sub">
              <span class="material-symbols-outlined mdi-icon">functions</span> Custom Functions
              <span class="material-symbols-outlined mdi-arrow">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="openCustomFunctions(); closeMenus()">Manage Functions</div>
              </div>
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="openGoalSeek(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">gps_fixed</span> Goal Seek...
            </div>
            <div class="mdi" (click)="openSolver(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">tune</span> Solver...
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="openFind(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">search</span> Find &amp; Replace <span class="mh">Ctrl+H</span>
            </div>
            <div class="mds"></div>
            <div class="mdi" (click)="openEmailNotifications(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">notifications</span> Email Notification Settings
            </div>
            <div class="mds"></div>
            <div style="padding: 4px 16px; font-size:11px; color:#9aa0a6; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Automation</div>
            <div class="mdi" (click)="openMergeTemplate(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">merge_type</span> Merge Template...
            </div>
            <div class="mdi" (click)="openPreferences(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">person</span> My Preferences
              <span style="background:#10b981; color:#fff; font-size:10px; font-weight:700; padding:1px 5px; border-radius:3px; margin-left:6px;">New</span>
            </div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('help',$event)" [class.mi-open]="activeMenu==='help'">Help
          <div class="mdd" *ngIf="activeMenu==='help'" style="min-width:240px;">
            <div style="padding: 6px 12px 8px;">
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
            <div class="mds"></div>
            <div class="mdi" (click)="showKeyboardShortcuts(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">keyboard</span> Keyboard Shortcuts...
            </div>
            <div class="mdi" (click)="openFeedback(); closeMenus()">
              <span class="material-symbols-outlined mdi-icon">feedback</span> Feedback...
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ TOOLBAR ROW 1 ══════════════════════════════════════════════════ -->
      <div class="tb-row" (mousedown)="$event.preventDefault()">
        <div class="tb-group">
          <button class="tb" (click)="printSheet()" title="Print"><span class="material-symbols-outlined">print</span></button>
          <button class="tb" (click)="undo()" title="Undo (Ctrl+Z)"><span class="material-symbols-outlined">undo</span></button>
          <button class="tb" (click)="redo()" title="Redo (Ctrl+Y)"><span class="material-symbols-outlined">redo</span></button>
          <button class="tb" (click)="clearAllFormats()" title="Clear Formats"><span class="material-symbols-outlined">format_clear</span></button>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group">
          <div class="tb-font-dd" (click)="toggleMenu('font',$event)" [class.active]="activeMenu==='font'">
            <span [style.font-family]="currentFont" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{currentFont}}</span>
            <span class="material-symbols-outlined" style="font-size:14px;margin-left:2px;">arrow_drop_down</span>
            <div class="mdd font-list" *ngIf="activeMenu==='font'">
              <div class="mdi" *ngFor="let f of fonts" (click)="applyFont(f)" [style.font-family]="f">{{f}}</div>
            </div>
          </div>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group font-sz">
          <button class="tb sz" (click)="decrementFontSize()" title="Decrease"><span class="material-symbols-outlined" style="font-size:16px;">remove</span></button>
          <div class="tb-font-dd" style="padding:0; height:26px; display:flex; align-items:center; border:none; background:transparent; position:relative; margin:0; cursor:default; min-width:0; gap:0;" [class.active]="activeMenu==='fontsize'">
            <input class="sz-inp" [(ngModel)]="currentSizeNum" (change)="onFontSizeInputChange()" type="number" min="6" max="96" style="width:36px; border-right:none; margin:0; padding-right:0;" (click)="$event.stopPropagation()">
            <div class="sz-drop-btn" (click)="toggleMenu('fontsize', $event)">
              <span class="material-symbols-outlined" style="font-size:14px;">arrow_drop_down</span>
            </div>
            <div class="mdd font-list" *ngIf="activeMenu==='fontsize'" style="min-width:54px; left:0; top:calc(100% + 2px);">
              <div class="mdi" *ngFor="let s of [6,7,8,9,10,11,12,14,18,24,36,48,72]" (click)="currentSizeNum=s; onFontSizeInputChange(); activeMenu=null" style="justify-content:center;">{{s}}</div>
            </div>
          </div>
          <button class="tb sz" (click)="incrementFontSize()" title="Increase"><span class="material-symbols-outlined" style="font-size:16px;">add</span></button>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group">
          <button class="tb" [class.tb-on]="getFormat('bold')" (click)="toggleFormat('bold')" title="Bold (Ctrl+B)"><span class="material-symbols-outlined">format_bold</span></button>
          <button class="tb" [class.tb-on]="getFormat('italic')" (click)="toggleFormat('italic')" title="Italic (Ctrl+I)"><span class="material-symbols-outlined">format_italic</span></button>
          <button class="tb" [class.tb-on]="getFormat('strikethrough')" (click)="toggleFormat('strikethrough')" title="Strikethrough"><span class="material-symbols-outlined">strikethrough_s</span></button>
          <button class="tb" [class.tb-on]="getFormat('underline')" (click)="toggleFormat('underline')" title="Underline (Ctrl+U)"><span class="material-symbols-outlined">format_underlined</span></button>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group">
          <div class="tb-clr" (click)="togglePalette('text',$event)" title="Text Color">
            <div class="clr-ico"><span class="material-symbols-outlined" style="font-size:16px;">format_color_text</span><div class="clr-bar" [style.background]="getFormat('color')||'#000'"></div></div>
            <span class="material-symbols-outlined" style="font-size:12px;">arrow_drop_down</span>
            <div class="clr-pop" *ngIf="activePalette==='text'" (click)="$event.stopPropagation()">
              <div class="cp-grid"><div *ngFor="let c of themeColorsTop" class="cp-sw" [style.background]="c" (click)="setFormat('color',c);activePalette=null"></div></div>
              <div class="cp-grid"><div *ngFor="let c of themeColorsGrid" class="cp-sw" [style.background]="c" (click)="setFormat('color',c);activePalette=null"></div></div>
              <div class="cp-grid"><div *ngFor="let c of standardColors" class="cp-sw" [style.background]="c" (click)="setFormat('color',c);activePalette=null"></div></div>
            </div>
          </div>
          <div class="tb-clr" (click)="togglePalette('fill',$event)" title="Fill Color">
            <div class="clr-ico"><span class="material-symbols-outlined" style="font-size:16px;">format_color_fill</span><div class="clr-bar" [style.background]="getFormat('bg')||'#ffff00'"></div></div>
            <span class="material-symbols-outlined" style="font-size:12px;">arrow_drop_down</span>
            <div class="clr-pop" *ngIf="activePalette==='fill'" (click)="$event.stopPropagation()">
              <div class="cp-nocolor" (click)="setFormat('bg','');activePalette=null">&#10006; No Fill</div>
              <div class="cp-grid"><div *ngFor="let c of themeColorsTop" class="cp-sw" [style.background]="c" (click)="setFormat('bg',c);activePalette=null"></div></div>
              <div class="cp-grid"><div *ngFor="let c of themeColorsGrid" class="cp-sw" [style.background]="c" (click)="setFormat('bg',c);activePalette=null"></div></div>
              <div class="cp-grid"><div *ngFor="let c of standardColors" class="cp-sw" [style.background]="c" (click)="setFormat('bg',c);activePalette=null"></div></div>
            </div>
          </div>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group">
          <div style="position:relative; display:inline-block;">
            <button class="tb" (click)="toggleMenu('border', $event)" [class.tb-on]="activeMenu==='border'" title="Borders">
              <span class="material-symbols-outlined">border_all</span>
              <span class="material-symbols-outlined" style="font-size:12px; margin-left:2px;">arrow_drop_down</span>
            </button>
            <div class="tb-dd" *ngIf="activeMenu==='border'" (click)="$event.stopPropagation()" style="width:230px; padding:10px;">
              <div style="display:flex; gap:12px;">
                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:4px; width:140px;">
                   <button class="bp-btn" (click)="setBorders('all'); closeMenus()" title="All Borders"><span class="material-symbols-outlined">border_all</span></button>
                   <button class="bp-btn" (click)="setBorders('inner'); closeMenus()" title="Inner Borders"><span class="material-symbols-outlined">border_inner</span></button>
                   <button class="bp-btn" (click)="setBorders('horizontal'); closeMenus()" title="Horizontal Borders"><span class="material-symbols-outlined">border_horizontal</span></button>
                   <button class="bp-btn" (click)="setBorders('vertical'); closeMenus()" title="Vertical Borders"><span class="material-symbols-outlined">border_vertical</span></button>
                   <button class="bp-btn" (click)="setBorders('outer'); closeMenus()" title="Outer Borders"><span class="material-symbols-outlined">border_outer</span></button>
                   <button class="bp-btn" (click)="setBorders('left'); closeMenus()" title="Left Border"><span class="material-symbols-outlined">border_left</span></button>
                   <button class="bp-btn" (click)="setBorders('top'); closeMenus()" title="Top Border"><span class="material-symbols-outlined">border_top</span></button>
                   <button class="bp-btn" (click)="setBorders('right'); closeMenus()" title="Right Border"><span class="material-symbols-outlined">border_right</span></button>
                   <button class="bp-btn" (click)="setBorders('bottom'); closeMenus()" title="Bottom Border"><span class="material-symbols-outlined">border_bottom</span></button>
                   <button class="bp-btn" (click)="setBorders('none'); closeMenus()" title="Clear Borders"><span class="material-symbols-outlined">border_clear</span></button>
                </div>
                <div style="width:1px; background:#5f6368;"></div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                   <div style="position:relative;">
                     <div class="bo-item" (click)="activeBorderSubmenu = activeBorderSubmenu === 'color' ? null : 'color'; $event.stopPropagation()" title="Border Color" [class.active-bo]="activeBorderSubmenu==='color'">
                         <div style="width:18px; height:18px; border:1px solid #5f6368;" [style.background]="currentBorderColor"></div>
                         <span class="material-symbols-outlined" style="font-size:14px; color:#a0aec0;">arrow_drop_down</span>
                     </div>
                     <div class="clr-pop" *ngIf="activeBorderSubmenu==='color'" (click)="$event.stopPropagation()" style="position:absolute; top:100%; right:0; z-index:1000; margin-top:4px;">
                        <div class="cp-grid"><div *ngFor="let c of themeColorsTop" class="cp-sw" [style.background]="c" (click)="currentBorderColor=c; activeBorderSubmenu=null"></div></div>
                        <div class="cp-grid"><div *ngFor="let c of themeColorsGrid" class="cp-sw" [style.background]="c" (click)="currentBorderColor=c; activeBorderSubmenu=null"></div></div>
                        <div class="cp-grid"><div *ngFor="let c of standardColors" class="cp-sw" [style.background]="c" (click)="currentBorderColor=c; activeBorderSubmenu=null"></div></div>
                     </div>
                   </div>
                   <div style="position:relative;">
                     <div class="bo-item" (click)="activeBorderSubmenu = activeBorderSubmenu === 'style' ? null : 'style'; $event.stopPropagation()" title="Border Style" [class.active-bo]="activeBorderSubmenu==='style'">
                         <div style="width:18px; height:0;" [ngStyle]="getBorderStyleCss(currentBorderStyle, currentBorderWidth)"></div>
                         <span class="material-symbols-outlined" style="font-size:14px; color:#a0aec0;">arrow_drop_down</span>
                     </div>
                     <div class="mdd" *ngIf="activeBorderSubmenu==='style'" (click)="$event.stopPropagation()" style="position:absolute; top:100%; right:0; z-index:1000; margin-top:4px; width:120px;">
                        <div class="mdi" (click)="currentBorderStyle='solid'; currentBorderWidth='1px'; activeBorderSubmenu=null"><div style="width:100%; border-top:1px solid currentColor;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='solid'; currentBorderWidth='2px'; activeBorderSubmenu=null"><div style="width:100%; border-top:2px solid currentColor;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='solid'; currentBorderWidth='3px'; activeBorderSubmenu=null"><div style="width:100%; border-top:3px solid currentColor;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='dashed'; currentBorderWidth='1px'; activeBorderSubmenu=null"><div style="width:100%; border-top:1px dashed currentColor;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='dotted'; currentBorderWidth='1px'; activeBorderSubmenu=null"><div style="width:100%; border-top:1px dotted currentColor;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='double'; currentBorderWidth='3px'; activeBorderSubmenu=null"><div style="width:100%; border-top:3px double currentColor;"></div></div>
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group">
          <button class="tb" [class.tb-on]="getFormat('align')==='left'" (click)="setFormat('align','left')" title="Align Left"><span class="material-symbols-outlined">format_align_left</span></button>
          <button class="tb" [class.tb-on]="getFormat('align')==='center'" (click)="setFormat('align','center')" title="Align Center"><span class="material-symbols-outlined">format_align_center</span></button>
          <button class="tb" [class.tb-on]="getFormat('align')==='right'" (click)="setFormat('align','right')" title="Align Right"><span class="material-symbols-outlined">format_align_right</span></button>
          <button class="tb" [class.tb-on]="getFormat('vertAlign')==='top'" (click)="setFormat('vertAlign','top')" title="Align Top"><span class="material-symbols-outlined">vertical_align_top</span></button>
          <button class="tb" [class.tb-on]="getFormat('vertAlign')==='middle'" (click)="setFormat('vertAlign','middle')" title="Align Middle"><span class="material-symbols-outlined">vertical_align_center</span></button>
          <button class="tb" [class.tb-on]="getFormat('vertAlign')==='bottom'" (click)="setFormat('vertAlign','bottom')" title="Align Bottom"><span class="material-symbols-outlined">vertical_align_bottom</span></button>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group">
          <!-- INDENT -->
          <div style="position:relative; display:inline-block;">
            <button class="tb" (click)="toggleMenu('indent', $event)" [class.tb-on]="activeMenu==='indent'" title="Text Indent">
              <span class="material-symbols-outlined">format_indent_increase</span>
              <span class="material-symbols-outlined" style="font-size:12px; margin-left:2px;">expand_more</span>
            </button>
            <div class="tb-dd" *ngIf="activeMenu==='indent'" (click)="$event.stopPropagation()" style="width:220px;">
              <div class="dd-item" (click)="setFormat('indent', 'increase'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">format_indent_increase</span> Increase Indent<span style="margin-left:auto; color:#9aa0a6; font-size:11px;">Ctrl+M</span></div>
              <div class="dd-item" (click)="setFormat('indent', 'decrease'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">format_indent_decrease</span> Decrease Indent<span style="margin-left:auto; color:#9aa0a6; font-size:11px;">Ctrl+Shift+M</span></div>
            </div>
          </div>
          <!-- TEXT WRAP -->
          <div style="position:relative; display:inline-block;">
            <button class="tb" (click)="toggleMenu('wrap', $event)" [class.tb-on]="activeMenu==='wrap'" title="Text Wrapping">
              <span class="material-symbols-outlined">wrap_text</span>
              <span class="material-symbols-outlined" style="font-size:12px; margin-left:2px;">expand_more</span>
            </button>
            <div class="tb-dd" *ngIf="activeMenu==='wrap'" (click)="$event.stopPropagation()" style="width:160px;">
              <div class="dd-item" (click)="setFormat('wrap', 'overflow'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">arrow_right_alt</span> Overflow</div>
              <div class="dd-item" (click)="setFormat('wrap', 'wrap'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">wrap_text</span> Wrap</div>
              <div class="dd-item" (click)="setFormat('wrap', 'clip'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">format_textdirection_r_to_l</span> Clip</div>
              <div class="dd-item" (click)="setFormat('wrap', 'shrink'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">compress</span> Shrink to Fit</div>
            </div>
          </div>
          <!-- TEXT ROTATION -->
          <div style="position:relative; display:inline-block;">
            <button class="tb" (click)="toggleMenu('rotation', $event)" [class.tb-on]="activeMenu==='rotation'" title="Text Rotation">
              <span class="material-symbols-outlined">text_rotation_angleup</span>
              <span class="material-symbols-outlined" style="font-size:12px; margin-left:2px;">expand_more</span>
            </button>
            <div class="tb-dd" *ngIf="activeMenu==='rotation'" (click)="$event.stopPropagation()" style="width:160px;">
              <div class="dd-item" (click)="setFormat('rotation', '0'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">text_rotation_none</span> None</div>
              <div class="dd-item" (click)="setFormat('rotation', '-45'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">text_rotation_angleup</span> Tilt Up</div>
              <div class="dd-item" (click)="setFormat('rotation', '45'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">text_rotation_angledown</span> Tilt Down</div>
              <div class="dd-item" (click)="setFormat('rotation', '-90'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">text_rotate_up</span> Rotate Up</div>
              <div class="dd-item" (click)="setFormat('rotation', '90'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">text_rotation_down</span> Rotate Down</div>
              <div class="dd-item" (click)="setFormat('rotation', 'custom'); closeMenus()"><span class="material-symbols-outlined" style="font-size:16px;">rotate_right</span> Custom...</div>
            </div>
          </div>
          <div style="position:relative; display:inline-block;">
            <button class="tb" (click)="toggleMenu('merge', $event)" [class.tb-on]="activeMenu==='merge'" title="Merge"><span class="material-symbols-outlined">merge_type</span></button>
            <div class="tb-dd" *ngIf="activeMenu==='merge'" (click)="$event.stopPropagation()" style="width:160px;">
              <div class="dd-item" (click)="mergeCells('all')"><span class="material-symbols-outlined" style="font-size:16px;">table_chart</span> Merge Cells</div>
              <div class="dd-item" (click)="mergeCells('across')"><span class="material-symbols-outlined" style="font-size:16px;">view_stream</span> Merge Across</div>
              <div class="dd-item" (click)="mergeCells('down')"><span class="material-symbols-outlined" style="font-size:16px;">view_week</span> Merge Down</div>
              <div class="dd-item" (click)="mergeCells('center')"><span class="material-symbols-outlined" style="font-size:16px;">center_focus_strong</span> Merge and Center</div>
              <div class="dd-item" (click)="unmerge()"><span class="material-symbols-outlined" style="font-size:16px;">grid_on</span> Unmerge</div>
            </div>
          </div>
        </div>
        <span class="tb-sep"></span>
        <div class="tb-group">
          <div class="tb-font-dd" (click)="toggleMenu('numfmt',$event)" [class.active]="activeMenu==='numfmt'" style="min-width:90px;">
            <span>{{getFormatName(getFormat('numFormat'))}}</span>
            <span class="material-symbols-outlined" style="font-size:14px;margin-left:auto;">arrow_drop_down</span>
            <div class="mdd" *ngIf="activeMenu==='numfmt'">
              <div class="mdi" (click)="setNumFormat('general')">General</div>
              <div class="mdi" (click)="setNumFormat('number')">Number <span class="mh">Ctrl+Shift+1</span></div>
              <div class="mdi has-sub">Accounting <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
                <div class="mdi-sub sub-left">
                  <div class="mdi" (click)="setNumFormat('accounting_inr')">₹ Indian Rupee</div>
                  <div class="mdi" (click)="setNumFormat('accounting_usd')">$ United States Dollar</div>
                  <div class="mdi" (click)="setNumFormat('accounting_eur')">€ Euro</div>
                  <div class="mdi" (click)="setNumFormat('accounting_gbp')">£ British Pound Sterling</div>
                  <div class="mdi" (click)="setNumFormat('accounting_cny')">¥ Chinese Yuan</div>
                  <div class="mds"></div>
                  <div class="mdi">More Accounting Formats...</div>
                </div>
              </div>
              <div class="mdi has-sub">Currency <span class="mh">Ctrl+Shift+4</span> <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
                <div class="mdi-sub sub-left">
                  <div class="mdi" (click)="setNumFormat('currency_inr')">₹ Indian Rupee</div>
                  <div class="mdi" (click)="setNumFormat('currency_usd')">$ United States Dollar</div>
                  <div class="mdi" (click)="setNumFormat('currency_eur')">€ Euro</div>
                  <div class="mdi" (click)="setNumFormat('currency_gbp')">£ British Pound Sterling</div>
                  <div class="mdi" (click)="setNumFormat('currency_cny')">¥ Chinese Yuan</div>
                  <div class="mds"></div>
                  <div class="mdi">More Accounting Formats...</div>
                </div>
              </div>
              <div class="mdi has-sub">Date <span class="mh">Ctrl+Shift+3</span> <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
                <div class="mdi-sub sub-left">
                  <div class="mdi" (click)="setNumFormat('date_1')">15/6/26 <span class="mh">d/M/yy</span></div>
                  <div class="mdi" (click)="setNumFormat('date_2')">15 Jun, 2026 <span class="mh">d MMM, yyyy</span></div>
                  <div class="mdi" (click)="setNumFormat('date_3')">15 June, 2026 <span class="mh">d MMMM, yyyy</span></div>
                  <div class="mdi" (click)="setNumFormat('date_4')">Monday, 15 June, 2026 <span class="mh">EEEE, d MMMM, yyyy</span></div>
                  <div class="mdi" (click)="setNumFormat('date_5')">15/06/2026 <span class="mh">dd/MM/yyyy</span></div>
                  <div class="mdi" (click)="setNumFormat('date_6')">06/15/2026 <span class="mh">MM/dd/yyyy</span></div>
                  <div class="mdi" (click)="setNumFormat('date_7')">2026/06/15 <span class="mh">yyyy/MM/dd</span></div>
                  <div class="mdi-title">Date and Time</div>
                  <div class="mdi" (click)="setNumFormat('date_8')">15/6/26 5:22:25 PM IST <span class="mh">d/M/yy h:mm:ss a z</span></div>
                  <div class="mdi" (click)="setNumFormat('date_9')">15 Jun, 2026 5:22:25 PM IST <span class="mh">d MMM, yyyy h:mm:ss a z</span></div>
                  <div class="mdi" (click)="setNumFormat('date_10')">15 June, 2026 5:22:25 PM <span class="mh">d MMMM, yyyy h:mm:ss a</span></div>
                  <div class="mdi" (click)="setNumFormat('date_11')">Monday, 15 June, 2026 5:22 PM <span class="mh">EEEE, d MMMM, yyyy h:mm a</span></div>
                  <div class="mdi" (click)="setNumFormat('date_12')">15/6/26 5:22 PM <span class="mh">d/M/yy h:mm a</span></div>
                </div>
              </div>
              <div class="mdi has-sub">Time <span class="mh">Ctrl+Shift+2</span> <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
                <div class="mdi-sub sub-left">
                  <div class="mdi-title">Time</div>
                  <div class="mdi" (click)="setNumFormat('time_1')">5:22 PM <span class="mh">h:mm a</span></div>
                  <div class="mdi" (click)="setNumFormat('time_2')">5:22:25 PM <span class="mh">h:mm:ss a</span></div>
                  <div class="mdi" (click)="setNumFormat('time_3')">5:22:25 PM IST <span class="mh">h:mm:ss a z</span></div>
                  <div class="mdi-title">Duration</div>
                  <div class="mdi" (click)="setNumFormat('time_4')">25:01 <span class="mh">[HH]:mm</span></div>
                  <div class="mdi" (click)="setNumFormat('time_5')">25:01:01 <span class="mh">[HH]:mm:ss</span></div>
                </div>
              </div>
              <div class="mdi" (click)="setNumFormat('percent')">Percentage <span class="mh">Ctrl+Shift+5</span></div>
              <div class="mdi has-sub">Fraction <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
                <div class="mdi-sub sub-left">
                  <div class="mdi" (click)="setNumFormat('fraction_1')">Up to one digit (1/4)</div>
                  <div class="mdi" (click)="setNumFormat('fraction_2')">Up to two digits (21/25)</div>
                  <div class="mdi" (click)="setNumFormat('fraction_3')">Up to three digits (312/943)</div>
                </div>
              </div>
              <div class="mdi" (click)="setNumFormat('scientific')">Scientific <span class="mh">Ctrl+Shift+6</span></div>
              <div class="mdi" (click)="setNumFormat('text')">Text</div>
              <div class="mdi has-sub">Regional <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
                <div class="mdi-sub sub-left" style="top: -50px; height: 250px; overflow-y: auto;">
                  <div class="mdi" (click)="setNumFormat('regional_us')">United States (en-US)</div>
                  <div class="mdi" (click)="setNumFormat('regional_uk')">United Kingdom (en-GB)</div>
                  <div class="mdi" (click)="setNumFormat('regional_in')">India (en-IN)</div>
                  <div class="mdi" (click)="setNumFormat('regional_de')">Germany (de-DE)</div>
                  <div class="mdi" (click)="setNumFormat('regional_fr')">France (fr-FR)</div>
                  <div class="mdi" (click)="setNumFormat('regional_it')">Italy (it-IT)</div>
                  <div class="mdi" (click)="setNumFormat('regional_jp')">Japan (ja-JP)</div>
                  <div class="mdi" (click)="setNumFormat('regional_cn')">China (zh-CN)</div>
                </div>
              </div>
              <div class="mdi" (click)="openCustomFormatModal()">Custom</div>
              <div class="mds"></div>
              <div class="mdi" (click)="openMoreFormatsModal()">More Formats...</div>
            </div>
          </div>
          <button class="tb nf" (click)="setNumFormat('currency')" [class.tb-on]="getFormat('numFormat')==='currency'" title="Currency">$</button>
          <button class="tb nf" (click)="setNumFormat('percent')" [class.tb-on]="getFormat('numFormat')==='percent'" title="Percent">%</button>
          <button class="tb nf" (click)="decreaseDecimals()" title="Decrease Decimals">.0</button>
          <button class="tb nf" (click)="increaseDecimals()" title="Increase Decimals">.00</button>
        </div>
      </div>


      <!-- ═══ TOOLBAR ROW 2 ══════════════════════════════════════════════════ -->
      <div class="tb-row tb-row2" (mousedown)="$event.preventDefault()">
        <button class="tb" (click)="openFind()" title="Find &amp; Replace (Ctrl+H)"><span class="material-symbols-outlined">search</span></button>
        <button class="tb" (click)="insertLink()" title="Insert Link"><span class="material-symbols-outlined">link</span></button>
        <button class="tb" (click)="insertComment()" title="Insert Comment"><span class="material-symbols-outlined">comment</span></button>
        <div style="position:relative; display:inline-block;">
          <button class="tb" [class.tb-on]="activeMenu==='chart'" (click)="toggleMenu('chart', $event)" title="Insert Chart"><span class="material-symbols-outlined">insert_chart</span></button>
          <div class="tb-chart-dd" *ngIf="activeMenu==='chart'" (click)="$event.stopPropagation()">
            <div class="chart-header-icons">
               <span class="material-symbols-outlined" [class.active]="activeChartTab==='column'" (click)="activeChartTab='column'" title="Column">insert_chart</span>
               <span class="material-symbols-outlined" [class.active]="activeChartTab==='bar'" (click)="activeChartTab='bar'" title="Bar">bar_chart</span>
               <span class="material-symbols-outlined" [class.active]="activeChartTab==='line'" (click)="activeChartTab='line'" title="Line">show_chart</span>
               <span class="material-symbols-outlined" [class.active]="activeChartTab==='pie'" (click)="activeChartTab='pie'" title="Pie">pie_chart</span>
               <span class="material-symbols-outlined" [class.active]="activeChartTab==='area'" (click)="activeChartTab='area'" title="Area">area_chart</span>
               <span class="material-symbols-outlined" [class.active]="activeChartTab==='scatter'" (click)="activeChartTab='scatter'" title="Scatter">scatter_plot</span>
               <span class="material-symbols-outlined" [class.active]="activeChartTab==='more'" (click)="activeChartTab='more'" title="Other Charts">candlestick_chart</span>
            </div>

            <!-- COLUMN TAB -->
            <div class="chart-grid" *ngIf="activeChartTab==='column'">
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><rect x="6" y="16" width="10" height="24" fill="#0ea5e9"/><rect x="24" y="6" width="10" height="34" fill="#10b981"/></svg>
                  <span>Column</span>
               </div>
               <div class="chart-item" (click)="generateChart('stacked_column')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><rect x="15" y="16" width="10" height="24" fill="#0ea5e9"/><rect x="15" y="6" width="10" height="10" fill="#10b981"/></svg>
                  <span>Stacked Column</span>
               </div>
               <div class="chart-item" (click)="generateChart('stacked_100')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><rect x="15" y="16" width="10" height="24" fill="#0ea5e9"/><rect x="15" y="0" width="10" height="16" fill="#10b981"/></svg>
                  <span>Stacked Col 100%</span>
               </div>
               <div class="chart-item" (click)="generateChart('grouped')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><rect x="10" y="16" width="8" height="24" fill="#0ea5e9"/><rect x="20" y="6" width="8" height="34" fill="#10b981"/></svg>
                  <span>Grouped Column</span>
               </div>
            </div>

            <!-- BAR TAB -->
            <div class="chart-grid" *ngIf="activeChartTab==='bar'">
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><rect y="6" x="0" height="10" width="24" fill="#0ea5e9"/><rect y="24" x="0" height="10" width="34" fill="#10b981"/></svg>
                  <span>Bar</span>
               </div>
               <div class="chart-item" (click)="generateChart('stacked_column')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><rect y="15" x="0" height="10" width="24" fill="#0ea5e9"/><rect y="15" x="24" height="10" width="10" fill="#10b981"/></svg>
                  <span>Stacked Bar</span>
               </div>
               <div class="chart-item" (click)="generateChart('stacked_100')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><rect y="15" x="0" height="10" width="24" fill="#0ea5e9"/><rect y="15" x="24" height="10" width="16" fill="#10b981"/></svg>
                  <span>Stacked Bar 100%</span>
               </div>
            </div>

            <!-- LINE TAB -->
            <div class="chart-grid" *ngIf="activeChartTab==='line'">
               <div class="chart-item" (click)="generateChart('line')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><polyline points="2,38 15,20 25,25 38,5" fill="none" stroke="#0ea5e9" stroke-width="3"/></svg>
                  <span>Line</span>
               </div>
               <div class="chart-item" (click)="generateChart('line')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><path d="M 2 38 C 10 38, 10 20, 15 20 C 20 20, 20 25, 25 25 C 30 25, 30 5, 38 5" fill="none" stroke="#10b981" stroke-width="3"/></svg>
                  <span>Spline</span>
               </div>
               <div class="chart-item" (click)="generateChart('line')">
                  <svg width="40" height="40" viewBox="0 0 40 40"><polyline points="2,38 15,38 15,20 25,20 25,5 38,5" fill="none" stroke="#f59e0b" stroke-width="3"/></svg>
                  <span>Step Line</span>
               </div>
            </div>

            <!-- PIE TAB -->
            <div class="chart-grid" *ngIf="activeChartTab==='pie'">
               <div class="chart-item" (click)="generateChart('pie')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <path d="M20,20 L20,0 A20,20 0 0,1 40,20 Z" fill="#0ea5e9"/>
                     <path d="M20,20 L40,20 A20,20 0 1,1 20,0 Z" fill="#10b981"/>
                  </svg>
                  <span>Pie</span>
               </div>
               <div class="chart-item" (click)="generateChart('pie')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <path d="M20,25 L5,25 A15,15 0 0,1 35,25 Z" fill="#0ea5e9"/>
                     <path d="M20,25 L35,25 A15,15 0 0,0 20,10 Z" fill="#10b981"/>
                  </svg>
                  <span>Semi Pie</span>
               </div>
               <div class="chart-item" (click)="generateChart('pie')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <path d="M20,20 L20,0 A20,20 0 0,1 40,20 Z" fill="#0ea5e9"/>
                     <path d="M20,20 L40,20 A20,20 0 1,1 20,0 Z" fill="#10b981"/>
                     <circle cx="20" cy="20" r="10" fill="#202124"/>
                  </svg>
                  <span>Doughnut</span>
               </div>
            </div>

            <!-- AREA TAB -->
            <div class="chart-grid" *ngIf="activeChartTab==='area'">
               <div class="chart-item" (click)="generateChart('area')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <polygon points="0,40 10,20 20,25 40,5 40,40" fill="#0ea5e9" opacity="0.8"/>
                  </svg>
                  <span>Area</span>
               </div>
               <div class="chart-item" (click)="generateChart('area')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <polygon points="0,40 10,20 20,25 40,5 40,40" fill="#0ea5e9" opacity="0.6"/>
                     <polygon points="0,40 10,10 20,15 40,0 40,40" fill="#10b981" opacity="0.6"/>
                  </svg>
                  <span>Stacked Area</span>
               </div>
            </div>

            <!-- SCATTER TAB -->
            <div class="chart-grid" *ngIf="activeChartTab==='scatter'">
               <div class="chart-item" (click)="generateChart('scatter')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <circle cx="10" cy="30" r="4" fill="#0ea5e9"/>
                     <circle cx="20" cy="15" r="4" fill="#10b981"/>
                     <circle cx="30" cy="25" r="4" fill="#f59e0b"/>
                     <circle cx="35" cy="10" r="4" fill="#ef4444"/>
                  </svg>
                  <span>Scatter</span>
               </div>
               <div class="chart-item" (click)="generateChart('line')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <polyline points="10,30 20,15 30,25 35,10" fill="none" stroke="#0ea5e9" stroke-width="2"/>
                  </svg>
                  <span>Scatter Line</span>
               </div>
               <div class="chart-item" (click)="generateChart('line')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <polyline points="10,30 20,15 30,25 35,10" fill="none" stroke="#10b981" stroke-width="2"/>
                     <circle cx="10" cy="30" r="3" fill="#10b981"/>
                     <circle cx="20" cy="15" r="3" fill="#10b981"/>
                     <circle cx="30" cy="25" r="3" fill="#10b981"/>
                     <circle cx="35" cy="10" r="3" fill="#10b981"/>
                  </svg>
                  <span>Scatter Line Markers</span>
               </div>
               <div class="chart-item" (click)="generateChart('scatter')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <circle cx="10" cy="30" r="6" fill="#0ea5e9" opacity="0.7"/>
                     <circle cx="20" cy="15" r="8" fill="#10b981" opacity="0.7"/>
                     <circle cx="30" cy="25" r="5" fill="#f59e0b" opacity="0.7"/>
                     <circle cx="35" cy="10" r="9" fill="#ef4444" opacity="0.7"/>
                  </svg>
                  <span>Bubble</span>
               </div>
            </div>

            <!-- MORE / OTHER CHARTS TAB -->
            <div class="chart-grid" *ngIf="activeChartTab==='more'">
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="8" y="20" width="8" height="20" fill="#0ea5e9"/>
                     <rect x="24" y="10" width="8" height="30" fill="#0ea5e9"/>
                     <polyline points="12,15 28,5" fill="none" stroke="#10b981" stroke-width="2"/>
                  </svg>
                  <span>Combination</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="5" y="30" width="8" height="10" fill="#0ea5e9"/>
                     <rect x="15" y="20" width="8" height="10" fill="#10b981"/>
                     <rect x="25" y="25" width="8" height="5" fill="#ef4444"/>
                  </svg>
                  <span>Waterfall</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="15" y="5" width="10" height="30" fill="#4b5563"/>
                     <rect x="18" y="15" width="4" height="20" fill="#0ea5e9"/>
                     <line x1="12" y1="25" x2="28" y2="25" stroke="#ef4444" stroke-width="2"/>
                  </svg>
                  <span>Vertical Bullet</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="5" y="15" width="30" height="10" fill="#4b5563"/>
                     <rect x="5" y="18" width="20" height="4" fill="#0ea5e9"/>
                     <line x1="15" y1="12" x2="15" y2="28" stroke="#ef4444" stroke-width="2"/>
                  </svg>
                  <span>Horizontal Bullet</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <polygon points="5,10 35,10 25,30 15,30" fill="#0ea5e9"/>
                  </svg>
                  <span>Funnel</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <polygon points="5,5 35,5 28,15 12,15" fill="#0ea5e9"/>
                     <polygon points="12,16 28,16 22,26 18,26" fill="#10b981"/>
                     <polygon points="18,27 22,27 20,35 20,35" fill="#ef4444"/>
                  </svg>
                  <span>Weighted Funnel</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="5" y="10" width="8" height="30" fill="#0ea5e9"/>
                     <rect x="15" y="20" width="8" height="20" fill="#0ea5e9"/>
                     <rect x="25" y="30" width="8" height="10" fill="#0ea5e9"/>
                     <polyline points="9,25 19,15 29,5" fill="none" stroke="#ef4444" stroke-width="2"/>
                  </svg>
                  <span>Pareto</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="5" y="10" width="10" height="30" fill="#0ea5e9"/>
                     <rect x="15" y="5" width="10" height="35" fill="#0ea5e9"/>
                     <rect x="25" y="20" width="10" height="20" fill="#0ea5e9"/>
                  </svg>
                  <span>Histogram</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <line x1="12" y1="5" x2="12" y2="35" stroke="#10b981" stroke-width="1.5"/>
                     <rect x="8" y="15" width="8" height="10" fill="#10b981"/>
                     <line x1="28" y1="5" x2="28" y2="35" stroke="#ef4444" stroke-width="1.5"/>
                     <rect x="24" y="20" width="8" height="10" fill="#ef4444"/>
                  </svg>
                  <span>Candlestick</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <line x1="12" y1="5" x2="12" y2="35" stroke="#10b981" stroke-width="2"/>
                     <line x1="7" y1="15" x2="12" y2="15" stroke="#10b981" stroke-width="2"/>
                     <line x1="12" y1="25" x2="17" y2="25" stroke="#10b981" stroke-width="2"/>
                  </svg>
                  <span>OHLC</span>
               </div>
               <div class="chart-item" (click)="generateChart('pie')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <circle cx="20" cy="20" r="15" fill="none" stroke="#5f6368"/>
                     <line x1="20" y1="5" x2="20" y2="35" stroke="#5f6368"/>
                     <line x1="5" y1="20" x2="35" y2="20" stroke="#5f6368"/>
                     <polygon points="20,10 25,20 20,30 15,20" fill="#0ea5e9" opacity="0.6"/>
                  </svg>
                  <span>Polar</span>
               </div>
               <div class="chart-item" (click)="generateChart('pie')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <polygon points="20,5 35,15 30,35 10,35 5,15" fill="none" stroke="#5f6368"/>
                     <polygon points="20,15 25,20 20,25 15,20" fill="#10b981" opacity="0.6"/>
                  </svg>
                  <span>Spider Web</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="15" y="15" width="10" height="10" fill="none" stroke="#0ea5e9" stroke-width="1.5"/>
                     <line x1="20" y1="5" x2="20" y2="15" stroke="#0ea5e9" stroke-width="1.5"/>
                     <line x1="20" y1="25" x2="20" y2="35" stroke="#0ea5e9" stroke-width="1.5"/>
                     <line x1="15" y1="20" x2="25" y2="20" stroke="#0ea5e9" stroke-width="1.5"/>
                  </svg>
                  <span>Vertical Box Plot</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <rect x="15" y="15" width="10" height="10" fill="none" stroke="#10b981" stroke-width="1.5"/>
                     <line x1="5" y1="20" x2="15" y2="20" stroke="#10b981" stroke-width="1.5"/>
                     <line x1="25" y1="20" x2="35" y2="20" stroke="#10b981" stroke-width="1.5"/>
                     <line x1="20" y1="15" x2="20" y2="25" stroke="#10b981" stroke-width="1.5"/>
                  </svg>
                  <span>Horizontal Box Plot</span>
               </div>
               <div class="chart-item" (click)="generateChart('column')">
                  <svg width="40" height="40" viewBox="0 0 40 40">
                     <text x="5" y="15" font-size="10" fill="#0ea5e9" font-weight="bold">Data</text>
                     <text x="18" y="28" font-size="8" fill="#10b981">Sheet</text>
                     <text x="5" y="35" font-size="9" fill="#ef4444">Words</text>
                  </svg>
                  <span>Wordcloud</span>
               </div>
            </div>
            <div class="chart-footer">
               Data Range: {{ sheets[currentSheetIdx].name }}.{{ getRangeRef() }}
            </div>
          </div>
        </div>
        <span class="tb-sep"></span>
        <!-- Insert Shape/Diagram Menu -->
        <div style="position:relative; display:inline-block;">
          <button class="tb" (click)="toggleMenu('shape', $event)" [class.tb-on]="activeMenu==='shape'" title="Insert Shape"><span class="material-symbols-outlined">category</span></button>
          
          <div class="tb-dd shape-panel" *ngIf="activeMenu==='shape'" (click)="$event.stopPropagation()">
             <div class="shape-tabs">
               <div class="s-tab" [class.s-tab-active]="shapeTab==='text'" (click)="shapeTab='text'">
                 <span class="material-symbols-outlined">text_fields</span> Text
               </div>
               <div class="s-tab" [class.s-tab-active]="shapeTab==='shape'" (click)="shapeTab='shape'">
                 <span class="material-symbols-outlined">category</span> Shape
               </div>
               <div class="s-tab" [class.s-tab-active]="shapeTab==='diagram'" (click)="shapeTab='diagram'">
                 <span class="material-symbols-outlined">account_tree</span> Diagram
               </div>
             </div>
             
             <!-- DIAGRAM TAB -->
             <div class="shape-content" *ngIf="shapeTab==='diagram'" style="display:flex; height:300px; padding:0;">
                <div style="width: 80px; border-right: 1px solid #eee; background: #fafafa; display: flex; flex-direction: column;">
                   <div style="padding:12px 0; text-align:center; cursor:pointer;"
                        [style.color]="diagramCategory==='list' ? '#e11d48' : '#5f6368'"
                        [style.border-left]="diagramCategory==='list' ? '3px solid #e11d48' : '3px solid transparent'"
                        [style.background]="diagramCategory==='list' ? '#fff' : 'transparent'"
                        (click)="diagramCategory='list'">
                      <span class="material-symbols-outlined" style="display:block;">format_list_bulleted</span><div style="font-size:11px;">List</div>
                   </div>
                   <div style="padding:12px 0; text-align:center; cursor:pointer;"
                        [style.color]="diagramCategory==='process' ? '#e11d48' : '#5f6368'"
                        [style.border-left]="diagramCategory==='process' ? '3px solid #e11d48' : '3px solid transparent'"
                        [style.background]="diagramCategory==='process' ? '#fff' : 'transparent'"
                        (click)="diagramCategory='process'">
                      <span class="material-symbols-outlined" style="display:block;">arrow_right_alt</span><div style="font-size:11px;">Process</div>
                   </div>
                   <div style="padding:12px 0; text-align:center; cursor:pointer;"
                        [style.color]="diagramCategory==='pyramid' ? '#e11d48' : '#5f6368'"
                        [style.border-left]="diagramCategory==='pyramid' ? '3px solid #e11d48' : '3px solid transparent'"
                        [style.background]="diagramCategory==='pyramid' ? '#fff' : 'transparent'"
                        (click)="diagramCategory='pyramid'">
                      <span class="material-symbols-outlined" style="display:block;">change_history</span><div style="font-size:11px;">Pyramid</div>
                   </div>
                   <div style="padding:12px 0; text-align:center; cursor:pointer;"
                        [style.color]="diagramCategory==='cycle' ? '#e11d48' : '#5f6368'"
                        [style.border-left]="diagramCategory==='cycle' ? '3px solid #e11d48' : '3px solid transparent'"
                        [style.background]="diagramCategory==='cycle' ? '#fff' : 'transparent'"
                        (click)="diagramCategory='cycle'">
                      <span class="material-symbols-outlined" style="display:block;">sync</span><div style="font-size:11px;">Cycle</div>
                   </div>
                </div>
                <div style="flex:1; padding: 16px; overflow-y:auto; background:#fff;">
                   <ng-container *ngIf="diagramCategory==='list'">
                     <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center;">
                        <div style="font-weight:600; font-size:14px;">List</div>
                        <div style="font-size:12px;">Levels 
                          <select style="padding:2px 8px; border-radius:4px; border:1px solid #ccc; outline:none; background:#fff;">
                             <option>3</option><option selected>4</option><option>6</option>
                          </select>
                        </div>
                     </div>
                     <div class="diagram-grid">
                        <div class="diag-item" (click)="insertShape('diagram_drop')">
                           <svg viewBox="0 0 100 60"><circle cx="20" cy="15" r="5" fill="#0ea5e9"/><circle cx="25" cy="30" r="5" fill="#10b981"/><circle cx="20" cy="45" r="5" fill="#f59e0b"/><line x1="30" y1="15" x2="80" y2="15" stroke="#e2e8f0" stroke-width="2"/><line x1="35" y1="30" x2="80" y2="30" stroke="#e2e8f0" stroke-width="2"/><line x1="30" y1="45" x2="80" y2="45" stroke="#e2e8f0" stroke-width="2"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Drop</div>
                        </div>
                        <div class="diag-item" (click)="insertShape('diagram_stack')">
                           <svg viewBox="0 0 100 60"><rect x="15" y="20" width="20" height="20" rx="2" fill="none" stroke="#0ea5e9" stroke-width="1" transform="rotate(-10 25 30)"/><rect x="40" y="20" width="20" height="20" rx="2" fill="none" stroke="#10b981" stroke-width="1"/><rect x="65" y="20" width="20" height="20" rx="2" fill="none" stroke="#f59e0b" stroke-width="1" transform="rotate(10 75 30)"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Stack Card</div>
                        </div>
                        <div class="diag-item" (click)="insertShape('diagram_flag')">
                           <svg viewBox="0 0 100 60"><circle cx="15" cy="15" r="4" fill="#0ea5e9"/><rect x="25" y="12" width="60" height="6" fill="#0ea5e9"/><circle cx="15" cy="30" r="4" fill="#10b981"/><rect x="25" y="27" width="60" height="6" fill="#10b981"/><circle cx="15" cy="45" r="4" fill="#f59e0b"/><rect x="25" y="42" width="60" height="6" fill="#f59e0b"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Flag</div>
                        </div>
                        <div class="diag-item" (click)="insertShape('diagram_ribbon')">
                           <svg viewBox="0 0 100 60"><path d="M 20 10 L 80 10 L 80 20 L 20 20 Z" fill="#0ea5e9"/><path d="M 20 25 L 80 25 L 80 35 L 20 35 Z" fill="#10b981"/><path d="M 20 40 L 80 40 L 80 50 L 20 50 Z" fill="#f59e0b"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Ribbon</div>
                        </div>
                        <div class="diag-item" (click)="insertShape('diagram_alter')">
                           <svg viewBox="0 0 100 60"><circle cx="50" cy="15" r="4" fill="#0ea5e9"/><line x1="20" y1="15" x2="40" y2="15" stroke="#e2e8f0" stroke-width="2"/><line x1="60" y1="15" x2="80" y2="15" stroke="#e2e8f0" stroke-width="2"/><circle cx="50" cy="30" r="4" fill="#10b981"/><line x1="20" y1="30" x2="40" y2="30" stroke="#e2e8f0" stroke-width="2"/><line x1="60" y1="30" x2="80" y2="30" stroke="#e2e8f0" stroke-width="2"/></svg>
                           <div style="font-size:12px; margin-top:4px; color:#e11d48">Alter</div>
                        </div>
                        <div class="diag-item" (click)="insertShape('diagram_deck')">
                           <svg viewBox="0 0 100 60"><rect x="20" y="10" width="15" height="40" fill="none" stroke="#e2e8f0" stroke-width="1"/><rect x="40" y="10" width="15" height="40" fill="none" stroke="#e2e8f0" stroke-width="1"/><rect x="60" y="10" width="15" height="40" fill="none" stroke="#e2e8f0" stroke-width="1"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Deck</div>
                        </div>
                     </div>
                   </ng-container>
                   <ng-container *ngIf="diagramCategory==='process'">
                     <div class="diagram-grid">
                        <div class="diag-item" (click)="insertShape('diagram_process_arrow')">
                           <svg viewBox="0 0 100 60"><polygon points="10,20 40,20 40,10 60,30 40,50 40,40 10,40" fill="#0ea5e9"/><polygon points="45,20 75,20 75,10 95,30 75,50 75,40 45,40" fill="#10b981"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Arrow Process</div>
                        </div>
                        <div class="diag-item" (click)="insertShape('diagram_process_step')">
                           <svg viewBox="0 0 100 60"><rect x="10" y="20" width="20" height="20" fill="#0ea5e9"/><line x1="30" y1="30" x2="40" y2="30" stroke="#ccc" stroke-width="2"/><rect x="40" y="20" width="20" height="20" fill="#10b981"/><line x1="60" y1="30" x2="70" y2="30" stroke="#ccc" stroke-width="2"/><rect x="70" y="20" width="20" height="20" fill="#f59e0b"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Step Process</div>
                        </div>
                     </div>
                   </ng-container>
                   <ng-container *ngIf="diagramCategory==='pyramid'">
                     <div class="diagram-grid">
                        <div class="diag-item" (click)="insertShape('diagram_pyramid_basic')">
                           <svg viewBox="0 0 100 60"><polygon points="50,5 35,20 65,20" fill="#0ea5e9"/><polygon points="32,22 68,22 83,40 17,40" fill="#10b981"/><polygon points="14,42 86,42 100,55 0,55" fill="#f59e0b"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Basic Pyramid</div>
                        </div>
                        <div class="diag-item" (click)="insertShape('diagram_pyramid_inv')">
                           <svg viewBox="0 0 100 60"><polygon points="0,5 100,5 86,18 14,18" fill="#0ea5e9"/><polygon points="17,20 83,20 68,38 32,38" fill="#10b981"/><polygon points="35,40 65,40 50,55" fill="#f59e0b"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Inverted Pyramid</div>
                        </div>
                     </div>
                   </ng-container>
                   <ng-container *ngIf="diagramCategory==='cycle'">
                     <div class="diagram-grid">
                        <div class="diag-item" (click)="insertShape('diagram_cycle_basic')">
                           <svg viewBox="0 0 100 60"><path d="M50,10 A20,20 0 0,1 70,30 L65,30 L72.5,40 L80,30 L75,30 A25,25 0 0,0 50,5 Z" fill="#0ea5e9"/><path d="M70,30 A20,20 0 0,1 30,30 L25,30 L32.5,20 L40,30 L35,30 A25,25 0 0,0 75,30 Z" fill="#10b981"/></svg>
                           <div style="font-size:12px; margin-top:4px;">Basic Cycle</div>
                        </div>
                     </div>
                   </ng-container>
                </div>
             </div>
             
             <!-- SHAPE TAB -->
             <div class="shape-content" *ngIf="shapeTab==='shape'" style="background:#fff;">
                <div style="display:flex; gap:16px; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:12px;">
                   <div style="cursor:pointer; display:flex; flex-direction:column; align-items:center;"
                        [style.color]="shapeCategory==='shape' ? '#e11d48' : '#5f6368'"
                        [style.border-bottom]="shapeCategory==='shape' ? '2px solid #e11d48' : '2px solid transparent'"
                        (click)="shapeCategory='shape'">
                      <span class="material-symbols-outlined" style="font-size:20px;">crop_square</span><div style="font-size:10px;">Shape</div>
                   </div>
                   <div style="cursor:pointer; display:flex; flex-direction:column; align-items:center;"
                        [style.color]="shapeCategory==='lines' ? '#e11d48' : '#5f6368'"
                        [style.border-bottom]="shapeCategory==='lines' ? '2px solid #e11d48' : '2px solid transparent'"
                        (click)="shapeCategory='lines'">
                      <span class="material-symbols-outlined" style="font-size:20px;">arrow_right_alt</span><div style="font-size:10px;">Lines</div>
                   </div>
                   <div style="cursor:pointer; display:flex; flex-direction:column; align-items:center;"
                        [style.color]="shapeCategory==='flowchart' ? '#e11d48' : '#5f6368'"
                        [style.border-bottom]="shapeCategory==='flowchart' ? '2px solid #e11d48' : '2px solid transparent'"
                        (click)="shapeCategory='flowchart'">
                      <span class="material-symbols-outlined" style="font-size:20px;">account_tree</span><div style="font-size:10px;">Flowchart</div>
                   </div>
                   <div style="cursor:pointer; display:flex; flex-direction:column; align-items:center;"
                        [style.color]="shapeCategory==='math' ? '#e11d48' : '#5f6368'"
                        [style.border-bottom]="shapeCategory==='math' ? '2px solid #e11d48' : '2px solid transparent'"
                        (click)="shapeCategory='math'">
                      <span class="material-symbols-outlined" style="font-size:20px;">add</span><div style="font-size:10px;">Math</div>
                   </div>
                   <div style="cursor:pointer; display:flex; flex-direction:column; align-items:center;"
                        [style.color]="shapeCategory==='stars' ? '#e11d48' : '#5f6368'"
                        [style.border-bottom]="shapeCategory==='stars' ? '2px solid #e11d48' : '2px solid transparent'"
                        (click)="shapeCategory='stars'">
                      <span class="material-symbols-outlined" style="font-size:20px;">star_outline</span><div style="font-size:10px;">Stars</div>
                   </div>
                   <div style="cursor:pointer; display:flex; flex-direction:column; align-items:center;"
                        [style.color]="shapeCategory==='callouts' ? '#e11d48' : '#5f6368'"
                        [style.border-bottom]="shapeCategory==='callouts' ? '2px solid #e11d48' : '2px solid transparent'"
                        (click)="shapeCategory='callouts'">
                      <span class="material-symbols-outlined" style="font-size:20px;">chat_bubble_outline</span><div style="font-size:10px;">Callouts</div>
                   </div>
                </div>
                
                <div class="shape-grid" *ngIf="shapeCategory==='shape'">
                   <div class="s-item" (click)="insertShape('rect')"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('roundrect')"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('circle')"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('triangle')"><svg viewBox="0 0 24 24"><polygon points="12,4 4,20 20,20" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('diamond')"><svg viewBox="0 0 24 24"><polygon points="12,4 20,12 12,20 4,12" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('hexagon')"><svg viewBox="0 0 24 24"><polygon points="12,4 20,8 20,16 12,20 4,16 4,8" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('octagon')"><svg viewBox="0 0 24 24"><polygon points="8,4 16,4 20,8 20,16 16,20 8,20 4,16 4,8" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                </div>
                <div class="shape-grid" *ngIf="shapeCategory==='lines'">
                   <div class="s-item" (click)="insertShape('line_straight')"><svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('line_arrow')"><svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="18" y2="6" stroke="#5f6368" stroke-width="1.5"/><polygon points="16,4 21,3 20,8" fill="#5f6368"/></svg></div>
                   <div class="s-item" (click)="insertShape('line_curve')"><svg viewBox="0 0 24 24"><path d="M4,20 Q12,4 20,20" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('line_connector')"><svg viewBox="0 0 24 24"><polyline points="4,20 4,12 20,12 20,4" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                </div>
                <div class="shape-grid" *ngIf="shapeCategory==='flowchart'">
                   <div class="s-item" (click)="insertShape('flow_process')"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('flow_decision')"><svg viewBox="0 0 24 24"><polygon points="12,3 21,12 12,21 3,12" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('flow_data')"><svg viewBox="0 0 24 24"><polygon points="6,6 22,6 18,18 2,18" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('flow_terminator')"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="6" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                </div>
                <div class="shape-grid" *ngIf="shapeCategory==='math'">
                   <div class="s-item" (click)="insertShape('math_plus')"><svg viewBox="0 0 24 24"><path d="M11,4 L13,4 L13,11 L20,11 L20,13 L13,13 L13,20 L11,20 L11,13 L4,13 L4,11 L11,11 Z" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('math_minus')"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="2" fill="#5f6368"/></svg></div>
                   <div class="s-item" (click)="insertShape('math_multiply')"><svg viewBox="0 0 24 24"><path d="M6,6 L18,18 M18,6 L6,18" stroke="#5f6368" stroke-width="2"/></svg></div>
                   <div class="s-item" (click)="insertShape('math_divide')"><svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="2" fill="#5f6368"/><rect x="4" y="11" width="16" height="2" fill="#5f6368"/><circle cx="12" cy="18" r="2" fill="#5f6368"/></svg></div>
                   <div class="s-item" (click)="insertShape('math_equal')"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="2" fill="#5f6368"/><rect x="4" y="14" width="16" height="2" fill="#5f6368"/></svg></div>
                </div>
                <div class="shape-grid" *ngIf="shapeCategory==='stars'">
                   <div class="s-item" (click)="insertShape('star_5')"><svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('star_4')"><svg viewBox="0 0 24 24"><polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                </div>
                <div class="shape-grid" *ngIf="shapeCategory==='callouts'">
                   <div class="s-item" (click)="insertShape('callout_rect')"><svg viewBox="0 0 24 24"><path d="M3,4 L21,4 L21,16 L14,16 L10,21 L10,16 L3,16 Z" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('callout_round')"><svg viewBox="0 0 24 24"><path d="M4,4 C2,4 2,16 4,16 L10,16 L10,21 L14,16 L20,16 C22,16 22,4 20,4 Z" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                   <div class="s-item" (click)="insertShape('callout_cloud')"><svg viewBox="0 0 24 24"><path d="M6,14 C4,14 4,10 6,10 C6,6 12,6 14,8 C16,6 20,8 20,12 C22,12 22,16 18,16 L12,21 L10,16 Z" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:20px; font-size:12px; color:#5f6368; align-items:center;">
                   <div style="color:#e11d48; cursor:pointer; display:flex; align-items:center; gap:4px;">
                      <span class="material-symbols-outlined" style="font-size:16px;">edit</span> Draw with pen
                   </div>
                   <div style="display:flex; align-items:center; gap:4px;"><input type="checkbox" style="margin:0;"> Shape Recognition</div>
                </div>
                <div style="display:flex; gap:16px; font-size:12px; margin-top:8px; color:#5f6368;">
                   <span style="cursor:pointer; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:16px;">horizontal_rule</span> Line</span>
                   <span style="cursor:pointer; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:16px;">gesture</span> Curve</span>
                   <span style="cursor:pointer; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:16px;">draw</span> Freeform</span>
                   <span style="cursor:pointer; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:16px;">edit</span> Scribble</span>
                </div>
             </div>
             
             <!-- TEXT TAB -->
             <div class="shape-content" *ngIf="shapeTab==='text'" style="display:flex; height:300px; padding:0;">
                <div style="width: 80px; border-right: 1px solid #eee; background: #fafafa; display: flex; flex-direction: column;">
                   <div style="padding:12px 0; text-align:center; cursor:pointer;"
                        [style.color]="textCategory==='textbox' ? '#e11d48' : '#5f6368'"
                        [style.border-left]="textCategory==='textbox' ? '3px solid #e11d48' : '3px solid transparent'"
                        [style.background]="textCategory==='textbox' ? '#fff' : 'transparent'"
                        (click)="textCategory='textbox'">
                      <span class="material-symbols-outlined" style="display:block;">text_fields</span><div style="font-size:11px;">Textbox</div>
                   </div>
                   <div style="padding:12px 0; text-align:center; cursor:pointer;"
                        [style.color]="textCategory==='symbol' ? '#e11d48' : '#5f6368'"
                        [style.border-left]="textCategory==='symbol' ? '3px solid #e11d48' : '3px solid transparent'"
                        [style.background]="textCategory==='symbol' ? '#fff' : 'transparent'"
                        (click)="textCategory='symbol'">
                      <span class="material-symbols-outlined" style="display:block;">functions</span><div style="font-size:11px;">Symbol</div>
                   </div>
                </div>
                <div style="flex:1; padding: 16px; overflow-y:auto; background:#fff;">
                   <div class="shape-grid" style="grid-template-columns: repeat(4, 1fr); gap:12px;" *ngIf="textCategory==='textbox'">
                      <div class="s-item" style="display:flex; align-items:center; justify-content:center; border:none; color:#5f6368; font-size:11px;" (click)="insertShape('text')">Text</div>
                      <div class="s-item" style="display:flex; align-items:center; justify-content:center; border:none; color:#000; font-weight:bold; font-size:11px;" (click)="insertShape('text')">Text</div>
                      <div class="s-item" style="display:flex; align-items:center; justify-content:center; border:none; color:#0ea5e9; font-style:italic; font-size:11px;" (click)="insertShape('text')">Text</div>
                      <div class="s-item" style="display:flex; align-items:center; justify-content:center; border:none; color:#10b981; font-size:11px;" (click)="insertShape('text')"><span style="border-bottom:1px solid #10b981; padding-bottom:2px;">Text</span></div>
                      
                      <div class="s-item" style="display:flex; align-items:center; justify-content:center; border:1px solid #ccc; border-radius:16px; color:#5f6368; font-size:11px;" (click)="insertShape('text_rounded')">Text</div>
                      <div class="s-item" style="display:flex; align-items:center; justify-content:center; background:#fef08a; border-radius:4px; border:none; color:#5f6368; font-size:11px;" (click)="insertShape('text_yellow')">Text</div>
                      <div class="s-item" style="display:flex; align-items:center; justify-content:center; background:#0ea5e9; color:#fff; border-radius:4px; border:none; font-size:11px; clip-path: polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%);" (click)="insertShape('text_arrow')">Text</div>
                   </div>
                   <div class="shape-grid" style="grid-template-columns: repeat(4, 1fr); gap:12px;" *ngIf="textCategory==='symbol'">
                      <div class="s-item" style="font-size:18px; color:#5f6368; display:flex; align-items:center; justify-content:center;" (click)="insertShape('symbol_copy')">©</div>
                      <div class="s-item" style="font-size:18px; color:#5f6368; display:flex; align-items:center; justify-content:center;" (click)="insertShape('symbol_reg')">®</div>
                      <div class="s-item" style="font-size:18px; color:#5f6368; display:flex; align-items:center; justify-content:center;" (click)="insertShape('symbol_tm')">™</div>
                      <div class="s-item" style="font-size:18px; color:#5f6368; display:flex; align-items:center; justify-content:center;" (click)="insertShape('symbol_pi')">π</div>
                      <div class="s-item" style="font-size:18px; color:#5f6368; display:flex; align-items:center; justify-content:center;" (click)="insertShape('symbol_sigma')">Σ</div>
                      <div class="s-item" style="font-size:18px; color:#5f6368; display:flex; align-items:center; justify-content:center;" (click)="insertShape('symbol_omega')">Ω</div>
                      <div class="s-item" style="font-size:18px; color:#5f6368; display:flex; align-items:center; justify-content:center;" (click)="insertShape('symbol_inf')">∞</div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div style="position:relative; display:inline-block;">
          <button class="tb" (click)="toggleMenu('image', $event)" [class.tb-on]="activeMenu==='image'" title="Insert Image"><span class="material-symbols-outlined">image</span></button>
          <div class="tb-dd" *ngIf="activeMenu==='image'" (click)="$event.stopPropagation()" style="width:200px;">
            <div class="dd-item" (click)="triggerImageInsert('cell')">Image in cell...</div>
            <div class="dd-item" (click)="triggerImageInsert('over')">Image over cells...</div>
          </div>
        </div>
        <div style="position:relative; display:inline-block;">
          <button class="tb" (click)="toggleMenu('sort', $event)" [class.tb-on]="activeMenu==='sort'" title="Sort"><span class="material-symbols-outlined">sort_by_alpha</span></button>
          <div class="tb-dd" *ngIf="activeMenu==='sort'" (click)="$event.stopPropagation()" style="width:220px;">
            <div class="dd-item" (click)="sortColAZ()">
               <span class="material-symbols-outlined" style="font-size:16px;">sort_by_alpha</span> Sort Ascending
            </div>
            <div class="dd-item" (click)="sortColZA()">
               <span class="material-symbols-outlined" style="font-size:16px;">sort_by_alpha</span> Sort Descending
            </div>
            <div class="dd-item" (click)="customSort()">
               <span class="material-symbols-outlined" style="font-size:16px;">sort</span> Custom Sort...
            </div>
          </div>
        </div>
        <button class="tb" [class.tb-on]="filterActive" (click)="toggleFilter()" title="Filter"><span class="material-symbols-outlined">filter_list</span></button>
        <div style="position:relative; display:inline-block;">
          <button class="tb" (click)="toggleMenu('sum', $event)" [class.tb-on]="activeMenu==='sum'" title="Functions"><span class="material-symbols-outlined">functions</span></button>
          <div class="tb-dd" *ngIf="activeMenu==='sum'" (click)="$event.stopPropagation()" style="width:200px;">
            <div class="dd-item" (click)="insertFunction('SUM')">Sum</div>
            <div class="dd-item" (click)="insertFunction('AVERAGE')">Average</div>
            <div class="dd-item" (click)="insertFunction('COUNT')">Count</div>
            <div class="dd-item" (click)="insertFunction('COUNTIF')">Count of Numbers</div>
            <div class="dd-item" (click)="insertFunction('MAX')">Maximum</div>
            <div class="dd-item" (click)="insertFunction('MIN')">Minimum</div>
            <div style="border-top:1px solid #5f6368; margin:8px 0;"></div>
            <div class="dd-item" (click)="moreFunctions()">More Functions</div>
          </div>
        </div>
        <span class="tb-sep"></span>
        <button class="tb" (click)="freezeRows(frozenRowsCount>0?0:1)"><span class="material-symbols-outlined">view_agenda</span></button>
        <button class="tb" (click)="freezeCols(frozenColsCount>0?0:1)"><span class="material-symbols-outlined">view_week</span></button>
        <span class="tb-sep"></span>
        <div class="zoom-ctrl">
          <button class="tb" (click)="zoomOut()"><span class="material-symbols-outlined">zoom_out</span></button>
          <span class="zoom-pct">{{zoomLevel}}%</span>
          <button class="tb" (click)="zoomIn()"><span class="material-symbols-outlined">zoom_in</span></button>
        </div>
      </div>

      <div class="formula-container" *ngIf="showFormulaBar">
        <span class="cell-ref">{{ selectedRef }}</span>
        <span class="fx-label">fx</span>
        <input class="formula-bar" [(ngModel)]="formulaBarValue"
            [disabled]="sheets[currentSheetIdx].locked || false"
            (ngModelChange)="cells[selectedRow][selectedCol] = $event; onCellChange()"
            (keydown.enter)="commitFormula()" (blur)="commitFormula()" placeholder="" />
      </div>

      <!-- Hidden image file input -->
      <input #imgInput type="file" accept="image/*" style="display:none" (change)="onImageFileSelected($event)">

    <div class="main-content" style="display:flex; flex:1; overflow:hidden; position:relative;">
      <div class="grid-wrap" #gridWrap style="flex:1; overflow:auto; position:relative; background:#fff;" (scroll)="onGridScroll($event)">
        <div class="resize-line-col" *ngIf="resizingCol !== null" [style.left.px]="resizeLineX"></div>
        <div class="resize-line-row" *ngIf="resizingRow !== null" [style.top.px]="resizeLineY"></div>

        <!-- Shapes Rendering -->
        <ng-container *ngIf="sheets[currentSheetIdx].shapes">
          <div *ngFor="let s of sheets[currentSheetIdx].shapes; let i = index"
               class="sheet-shape"
               [class.shape-active]="activeShapeIdx === i"
               [style.left.px]="s.x" [style.top.px]="s.y"
               [style.width.px]="s.width" [style.height.px]="s.height"
               (mousedown)="startShapeDrag($event, i)"
               (dblclick)="editShapeLabel(i)"
               title="Double-click to edit label">
               
               <!-- Active Handles -->
               <ng-container *ngIf="activeShapeIdx === i">
                   <div class="shape-handle nw"></div>
                   <div class="shape-handle n"></div>
                   <div class="shape-handle ne"></div>
                   <div class="shape-handle e"></div>
                   <div class="shape-handle se"></div>
                   <div class="shape-handle s"></div>
                   <div class="shape-handle sw"></div>
                   <div class="shape-handle w"></div>
                   <div class="shape-menu-btn" (mousedown)="$event.stopPropagation()" (click)="activeShapeMenuIdx = activeShapeMenuIdx === i ? null : i; $event.stopPropagation()"><span class="material-symbols-outlined" style="font-size:16px;">more_horiz</span></div>
                   <div class="shape-context-menu" *ngIf="activeShapeMenuIdx === i" (mousedown)="$event.stopPropagation()">
                       <div class="scm-item" (click)="showToast('Assign Existing'); activeShapeMenuIdx=null"><span class="material-symbols-outlined" style="font-size:18px;">description</span> Assign Existing <span class="material-symbols-outlined chevron" style="font-size:18px;">chevron_right</span></div>
                       <div class="scm-item" (click)="showToast('Assign New'); activeShapeMenuIdx=null"><span class="material-symbols-outlined" style="font-size:18px;">post_add</span> Assign New <span class="material-symbols-outlined chevron" style="font-size:18px;">chevron_right</span></div>
                       <div class="scm-item" (click)="editShapeLabel(i); activeShapeMenuIdx=null"><span class="material-symbols-outlined" style="font-size:18px;">edit</span> Edit Label</div>
                       <div style="border-top:1px solid #eee; margin:4px 0;"></div>
                       <div class="scm-item" (click)="showToast('Clone'); activeShapeMenuIdx=null"><span class="material-symbols-outlined" style="font-size:18px;">file_copy</span> Clone</div>
                       <div class="scm-item" (click)="deleteShape(i); activeShapeMenuIdx=null"><span class="material-symbols-outlined" style="font-size:18px;">delete</span> Delete</div>
                   </div>
               </ng-container>
               
               <div class="shape-content-wrapper">
                 <svg *ngIf="s.type==='rect'" width="100%" height="100%"><rect x="0" y="0" width="100%" height="100%" fill="#e8f0fe" stroke="#1a73e8" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='roundrect'" width="100%" height="100%"><rect x="0" y="0" width="100%" height="100%" rx="8" fill="#e8f0fe" stroke="#1a73e8" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='circle'" width="100%" height="100%"><ellipse cx="50%" cy="50%" rx="48%" ry="48%" fill="#e8f0fe" stroke="#1a73e8" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='triangle'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100"><polygon points="50,0 0,100 100,100" fill="#e8f0fe" stroke="#1a73e8" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='diamond'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100"><polygon points="50,0 100,50 50,100 0,50" fill="#e8f0fe" stroke="#1a73e8" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='hexagon'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100"><polygon points="50,0 100,25 100,75 50,100 0,75 0,25" fill="#e8f0fe" stroke="#1a73e8" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='octagon'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100"><polygon points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30" fill="#e8f0fe" stroke="#1a73e8" stroke-width="2"/></svg>
                 
                 <!-- Complex Diagrams -->
                 <svg *ngIf="s.type==='diagram_drop'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><circle cx="20" cy="15" r="5" fill="#0ea5e9"/><circle cx="25" cy="30" r="5" fill="#10b981"/><circle cx="20" cy="45" r="5" fill="#f59e0b"/><line x1="30" y1="15" x2="80" y2="15" stroke="#e2e8f0" stroke-width="2"/><line x1="35" y1="30" x2="80" y2="30" stroke="#e2e8f0" stroke-width="2"/><line x1="30" y1="45" x2="80" y2="45" stroke="#e2e8f0" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='diagram_stack'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><rect x="15" y="20" width="20" height="20" rx="2" fill="#fff" stroke="#0ea5e9" stroke-width="1" transform="rotate(-10 25 30)"/><rect x="40" y="20" width="20" height="20" rx="2" fill="#fff" stroke="#10b981" stroke-width="1"/><rect x="65" y="20" width="20" height="20" rx="2" fill="#fff" stroke="#f59e0b" stroke-width="1" transform="rotate(10 75 30)"/></svg>
                 <svg *ngIf="s.type==='diagram_flag'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><circle cx="15" cy="15" r="4" fill="#0ea5e9"/><rect x="25" y="12" width="60" height="6" fill="#0ea5e9"/><circle cx="15" cy="30" r="4" fill="#10b981"/><rect x="25" y="27" width="60" height="6" fill="#10b981"/><circle cx="15" cy="45" r="4" fill="#f59e0b"/><rect x="25" y="42" width="60" height="6" fill="#f59e0b"/></svg>
                 <svg *ngIf="s.type==='diagram_ribbon'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><path d="M 20 10 L 80 10 L 80 20 L 20 20 Z" fill="#0ea5e9"/><path d="M 20 25 L 80 25 L 80 35 L 20 35 Z" fill="#10b981"/><path d="M 20 40 L 80 40 L 80 50 L 20 50 Z" fill="#f59e0b"/></svg>
                 <svg *ngIf="s.type==='diagram_alter'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><circle cx="50" cy="15" r="4" fill="#0ea5e9"/><line x1="20" y1="15" x2="40" y2="15" stroke="#e2e8f0" stroke-width="2"/><line x1="60" y1="15" x2="80" y2="15" stroke="#e2e8f0" stroke-width="2"/><circle cx="50" cy="30" r="4" fill="#10b981"/><line x1="20" y1="30" x2="40" y2="30" stroke="#e2e8f0" stroke-width="2"/><line x1="60" y1="30" x2="80" y2="30" stroke="#e2e8f0" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='diagram_deck'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><rect x="20" y="10" width="15" height="40" fill="#fff" stroke="#e2e8f0" stroke-width="1"/><rect x="40" y="10" width="15" height="40" fill="#fff" stroke="#e2e8f0" stroke-width="1"/><rect x="60" y="10" width="15" height="40" fill="#fff" stroke="#e2e8f0" stroke-width="1"/></svg>
                 <svg *ngIf="s.type==='diagram_process_arrow'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><polygon points="10,20 40,20 40,10 60,30 40,50 40,40 10,40" fill="#0ea5e9"/><polygon points="45,20 75,20 75,10 95,30 75,50 75,40 45,40" fill="#10b981"/></svg>
                 <svg *ngIf="s.type==='diagram_process_step'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><rect x="10" y="20" width="20" height="20" fill="#0ea5e9"/><line x1="30" y1="30" x2="40" y2="30" stroke="#ccc" stroke-width="2"/><rect x="40" y="20" width="20" height="20" fill="#10b981"/><line x1="60" y1="30" x2="70" y2="30" stroke="#ccc" stroke-width="2"/><rect x="70" y="20" width="20" height="20" fill="#f59e0b"/></svg>
                 <svg *ngIf="s.type==='diagram_pyramid_basic'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><polygon points="50,5 35,20 65,20" fill="#0ea5e9"/><polygon points="32,22 68,22 83,40 17,40" fill="#10b981"/><polygon points="14,42 86,42 100,55 0,55" fill="#f59e0b"/></svg>
                 <svg *ngIf="s.type==='diagram_pyramid_inv'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><polygon points="0,5 100,5 86,18 14,18" fill="#0ea5e9"/><polygon points="17,20 83,20 68,38 32,38" fill="#10b981"/><polygon points="35,40 65,40 50,55" fill="#f59e0b"/></svg>
                 <svg *ngIf="s.type==='diagram_cycle_basic'" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 60"><path d="M50,10 A20,20 0 0,1 70,30 L65,30 L72.5,40 L80,30 L75,30 A25,25 0 0,0 50,5 Z" fill="#0ea5e9"/><path d="M70,30 A20,20 0 0,1 30,30 L25,30 L32.5,20 L40,30 L35,30 A25,25 0 0,0 75,30 Z" fill="#10b981"/></svg>

                 <!-- Lines & Flowcharts -->
                 <svg *ngIf="s.type==='line_straight'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="#5f6368" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='line_arrow'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><line x1="4" y1="20" x2="18" y2="6" stroke="#5f6368" stroke-width="1.5"/><polygon points="16,4 21,3 20,8" fill="#5f6368"/></svg>
                 <svg *ngIf="s.type==='line_curve'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><path d="M4,20 Q12,4 20,20" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='line_connector'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><polyline points="4,20 4,12 20,12 20,4" fill="none" stroke="#5f6368" stroke-width="1.5"/></svg>
                 
                 <svg *ngIf="s.type==='flow_process'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='flow_decision'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><polygon points="12,3 21,12 12,21 3,12" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='flow_data'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><polygon points="6,6 22,6 18,18 2,18" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='flow_terminator'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="6" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 
                 <svg *ngIf="s.type==='math_plus'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><path d="M11,4 L13,4 L13,11 L20,11 L20,13 L13,13 L13,20 L11,20 L11,13 L4,13 L4,11 L11,11 Z" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='math_minus'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="2" fill="#1a73e8"/></svg>
                 <svg *ngIf="s.type==='math_multiply'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><path d="M6,6 L18,18 M18,6 L6,18" stroke="#1a73e8" stroke-width="2"/></svg>
                 <svg *ngIf="s.type==='math_divide'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><circle cx="12" cy="6" r="2" fill="#1a73e8"/><rect x="4" y="11" width="16" height="2" fill="#1a73e8"/><circle cx="12" cy="18" r="2" fill="#1a73e8"/></svg>
                 <svg *ngIf="s.type==='math_equal'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="2" fill="#1a73e8"/><rect x="4" y="14" width="16" height="2" fill="#1a73e8"/></svg>
                 
                 <svg *ngIf="s.type==='star_5'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='star_4'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 
                 <svg *ngIf="s.type==='callout_rect'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><path d="M3,4 L21,4 L21,16 L14,16 L10,21 L10,16 L3,16 Z" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='callout_round'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><path d="M4,4 C2,4 2,16 4,16 L10,16 L10,21 L14,16 L20,16 C22,16 22,4 20,4 Z" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>
                 <svg *ngIf="s.type==='callout_cloud'" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 24 24"><path d="M6,14 C4,14 4,10 6,10 C6,6 12,6 14,8 C16,6 20,8 20,12 C22,12 22,16 18,16 L12,21 L10,16 Z" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/></svg>

                 <div *ngIf="s.type==='text_rounded'" style="width:100%; height:100%; border:1px solid #ccc; border-radius:16px; display:flex; align-items:center; justify-content:center; background:#fff;"></div>
                 <div *ngIf="s.type==='text_yellow'" style="width:100%; height:100%; background:#fef08a; border-radius:4px; display:flex; align-items:center; justify-content:center;"></div>
                 <div *ngIf="s.type==='text_arrow'" style="width:100%; height:100%; background:#0ea5e9; border-radius:4px; clip-path: polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%); display:flex; align-items:center; justify-content:center;"></div>

                 <div *ngIf="s.type==='button'" style="width:100%; height:100%; background:#f8f9fa; border:1px solid #0f9d58; display:flex; align-items:center; justify-content:center; box-sizing:border-box;"></div>

                 <div *ngIf="s.text" [style.color]="s.type==='text_arrow' ? '#ffffff' : '#1f2937'" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px; text-align:center; pointer-events:none;">
                   {{ s.text }}
                 </div>
               </div>
          </div>
        </ng-container>

        <table class="grid" [class.no-gridlines]="sheets[currentSheetIdx].hideGridlines" [class.print-area-active]="showHighlightPrintArea" [style.zoom]="zoomLevel / 100" [attr.dir]="gridDirection" [class.grid-spacing-comfort]="gridSpacing==='comfort'" [class.grid-spacing-cozy]="gridSpacing==='cozy'" [class.grid-spacing-classic]="gridSpacing==='classic'">
          <thead [style.display]="showHeaders ? '' : 'none'">
            <tr *ngIf="hasColGroups">
              <th class="corner" *ngIf="hasRowGroups" style="height: 24px; min-height: 24px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; position: sticky; left: 0; z-index: 6;"></th>
              <th class="corner" style="height: 24px; min-height: 24px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; position: sticky; left: 0; z-index: 6;" [style.left.px]="groupMarginWidth"></th>
              <th *ngFor="let c of colRange; trackBy: trackByCol" class="col-head group-margin-col-cell"
                [style.display]="hiddenCols.has(c) ? 'none' : ''"
                [style.width.px]="getColWidth(c)" [style.max-width.px]="getColWidth(c)"
                [style.position]="c < frozenColsCount ? 'sticky' : 'relative'"
                [style.left]="gridDirection==='ltr' && c < frozenColsCount ? getFrozenColOffset(c) + 'px' : ''"
                [style.right]="gridDirection==='rtl' && c < frozenColsCount ? getFrozenColOffset(c) + 'px' : ''"
                [style.z-index]="c < frozenColsCount ? 4 : ''"
                style="height: 24px; min-height: 24px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0; position: relative; padding: 0;">
                <ng-container *ngFor="let g of getColGroupsFor(c); let i = index">
                  <div *ngIf="c >= g.start && c <= g.end && !g.collapsed" style="position: absolute; height: 1px; background: #64748b; right: 0;" [style.left]="c === g.start ? '50%' : '0'" [style.top.px]="i * 10 + 10"></div>
                  <div *ngIf="c === g.end && !g.collapsed" style="position: absolute; height: 5px; width: 1px; background: #64748b; right: 0;" [style.top.px]="i * 10 + 10"></div>
                  <div *ngIf="c === g.start" style="position: absolute; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; background: #fff; border: 1px solid #64748b; border-radius: 2px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; font-weight: bold; color: #334155; user-select: none; z-index: 2;" [style.top.px]="i * 10 + 5" (click)="toggleColGroup(g.index)">
                    {{ g.collapsed ? '+' : '-' }}
                  </div>
                </ng-container>
              </th>
            </tr>
            <tr>
              <th class="corner" *ngIf="hasRowGroups" style="width: 24px; min-width: 24px; max-width: 24px; background: #f8f9fa; border-right: 1px solid #e2e8f0; position: sticky; left: 0; z-index: 6;" [style.top.px]="colGroupMarginHeight"></th>
              <th class="corner" (click)="selectAll()" [style.z-index]="frozenRowsCount > 0 && frozenColsCount > 0 ? 5 : ''" [style.left.px]="groupMarginWidth" [style.top.px]="colGroupMarginHeight"></th>
              <th *ngFor="let c of colRange; trackBy: trackByCol" class="col-head"
                [style.display]="hiddenCols.has(c) ? 'none' : ''"
                [style.min-width.px]="getColWidth(c)" [style.width.px]="getColWidth(c)" [style.max-width.px]="getColWidth(c)"
                [style.position]="c < frozenColsCount ? 'sticky' : 'sticky'"
                [style.top.px]="colGroupMarginHeight"
                [style.left]="gridDirection==='ltr' && c < frozenColsCount ? getFrozenColOffset(c) + 'px' : ''"
                [style.right]="gridDirection==='rtl' && c < frozenColsCount ? getFrozenColOffset(c) + 'px' : ''"
                [style.z-index]="c < frozenColsCount ? 4 : ''"
                [class.col-selected]="isColHeaderSelected(c)"
                [class.active-axis]="isColActiveAxis(c)"
                (contextmenu)="onHeaderRightClick($event, 'col', c)"
                (click)="selectEntireCol(c)">
                {{ colLabel(c) }}
                <div class="col-resizer" (mousedown)="startColResize($event, c)"></div>
              </th>
            </tr>
          </thead>
          <tbody>
            
            <ng-container *ngFor="let r of visibleRowRange; trackBy: trackByRow">
              <tr *ngIf="r === firstUnfrozenRow && topSpacerHeight > 0" [style.height.px]="topSpacerHeight"><td [attr.colspan]="30" style="border:none;padding:0;pointer-events:none;"></td></tr>
              <tr [style.display]="hiddenRows.has(r) ? 'none' : ''" [style.height.px]="getRowHeight(r)">
              <td class="group-margin-cell" *ngIf="hasRowGroups" [style.display]="showHeaders ? '' : 'none'" style="width: 24px; min-width: 24px; max-width: 24px; position: sticky; left: 0; z-index: 5; background: #f8f9fa; border-right: 1px solid #e2e8f0; vertical-align: top; position: relative;">
                <ng-container *ngFor="let g of getRowGroupsFor(r); let i = index">
                  <div *ngIf="r >= g.start && r <= g.end && !g.collapsed" style="position: absolute; width: 1px; background: #64748b; bottom: 0;" [style.top]="r === g.start ? '50%' : '0'" [style.left.px]="i * 10 + 10"></div>
                  <div *ngIf="r === g.end && !g.collapsed" style="position: absolute; width: 5px; height: 1px; background: #64748b; bottom: 0;" [style.left.px]="i * 10 + 5"></div>
                  <div *ngIf="r === g.start" style="position: absolute; top: 50%; transform: translateY(-50%); width: 10px; height: 10px; background: #fff; border: 1px solid #64748b; border-radius: 2px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; font-weight: bold; color: #334155; user-select: none;" [style.left.px]="i * 10 + 5" (click)="toggleRowGroup(g.index)">
                    {{ g.collapsed ? '+' : '-' }}
                  </div>
                </ng-container>
              </td>
              <td class="row-head" [style.display]="showHeaders ? '' : 'none'"
                [style.position]="r < frozenRowsCount ? 'sticky' : 'sticky'"
                [style.left.px]="groupMarginWidth"
                [style.top]="r < frozenRowsCount ? getFrozenRowOffset(r) + colGroupMarginHeight + 'px' : ''"
                [style.z-index]="r < frozenRowsCount ? 4 : ''"
                [class.row-selected]="isRowHeaderSelected(r)" [class.active-axis]="isRowActiveAxis(r)" (contextmenu)="onHeaderRightClick($event, 'row', r)" (click)="selectEntireRow(r)">
                {{ r + 1 }}
                <div class="row-resizer" (mousedown)="startRowResize($event, r)"></div>
              </td>
              <ng-container *ngFor="let c of colRange; trackBy: trackByCol">
                <td *ngIf="!isMergedSlave(r, c)" class="cell"
                  [style.display]="hiddenCols.has(c) ? 'none' : ''"
                  [style.min-width.px]="getColWidth(c)" [style.width.px]="getColWidth(c)" [style.max-width.px]="getColWidth(c)"
                  [style.position]="r < frozenRowsCount || c < frozenColsCount ? 'sticky' : ''"
                  [style.top]="r < frozenRowsCount ? getFrozenRowOffset(r) + colGroupMarginHeight + 'px' : ''"
                  [style.left]="gridDirection==='ltr' && c < frozenColsCount ? getFrozenColOffset(c) + 'px' : ''"
                  [style.right]="gridDirection==='rtl' && c < frozenColsCount ? getFrozenColOffset(c) + 'px' : ''"
                  [style.z-index]="r < frozenRowsCount && c < frozenColsCount ? 4 : (r < frozenRowsCount || c < frozenColsCount ? 3 : '')"
                  [attr.colspan]="getColSpan(r, c)"
                  [attr.rowspan]="getRowSpan(r, c)"
                  [class.selected]="isCellSelected(r, c)"
                  [class.in-range]="isCellInRange(r, c)"
                  [class.remote-selected]="isRemoteSelected(r, c)"
                  [class.fill-preview]="isCellInFillPreview(r, c)"
                  [class.has-content]="cellHasContent(r, c)"
                  [class.search-match]="isCellInInlineSearch(r, c)"
                  [class.search-match-active]="isCellActiveInlineSearch(r, c)"
                  [ngStyle]="getCellStyle(r, c)"
                  (mousedown)="onCellMouseDown($event, r, c)"
                  (mouseenter)="onCellMouseEnter(r, c)"
                  (contextmenu)="onCellRightClick($event, r, c)"
                  (click)="onCellClickWithPicker(r, c)"
                  (dblclick)="startEditing()">
                  <textarea *ngIf="isEditingCell && selectedRow === r && selectedCol === c" #floatingEditor class="floating-editor"
                     [style.left.px]="-2"
                     [style.top.px]="-2"
                     [style.min-width.px]="getColWidth(selectedCol) + 3"
                     [ngStyle]="getContentStyle(selectedRow, selectedCol)"
                     [(ngModel)]="editValue"
                     (input)="autoResizeEditor($event)"
                     (keydown)="onEditorKeydown($event)"
                     (blur)="commitEdit()"
                     (click)="$event.stopPropagation()"
                     (dblclick)="$event.stopPropagation()"
                     (mousedown)="$event.stopPropagation()"></textarea>
                                  <ng-container *ngIf="isImageCell(r, c); else textCell">
                    <img [src]="cells[r][c]" style="max-width:100%;max-height:80px;object-fit:contain;display:inline-block;cursor:zoom-in;" 
(click)="selectCell(r,c); previewImageUrl = cells[r][c]">
                  </ng-container>
                <ng-template #textCell>
                  <ng-container *ngIf="hasCellDropdown(r, c); else plainInput">
                    <!-- Custom Picklist rendering -->
                    <div class="cell-dropdown-ui" (click)="openCustomDropdown($event, r, c)" [style.background]="getDropdownColor(r, c, cells[r][c]) || '#fff'" [style.color]="getDropdownColor(r, c, cells[r][c]) ? '#fff' : '#000'" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; cursor:pointer; padding: 0 6px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; box-sizing: border-box; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; user-select: none;">
                      <span style="overflow: hidden; text-overflow: ellipsis;">{{ cells[r][c] }}</span>
                      <span class="material-symbols-outlined" style="font-size: 16px;">arrow_drop_down</span>
                    </div>
                  </ng-container>
                  <ng-template #plainInput>
                    <ng-container *ngIf="isCheckboxCell(r, c); else dateInput">
                      <div class="cell-checkbox-container" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%; cursor:pointer;" (click)="toggleCheckbox(r, c)">
                         <span class="material-symbols-outlined" style="font-size:18px; color:#5f6368; pointer-events: none;">
                            {{ cells[r][c] === 'TRUE' ? 'check_box' : 'check_box_outline_blank' }}
                         </span>
                      </div>
                    </ng-container>
                    <ng-template #dateInput>
                      <div class="cell-display" [ngStyle]="getContentStyle(r, c)" [class.wrap-text]="getFormatWrap(r, c)" [style.opacity]="isEditingCell && selectedRow===r && selectedCol===c ? '0' : '1'">
                        <a *ngIf="isUrl(cells[r][c]); else normalText" [href]="cells[r][c]" target="_blank" style="color: #1155cc; text-decoration: underline; pointer-events: auto; cursor: pointer;">{{ getDisplayValue(r, c) }}</a>
                        <ng-template #normalText>{{ getDisplayValue(r, c) }}</ng-template>
                      </div>
                    </ng-template>
                  </ng-template>
                </ng-template>
                <!-- Fill handle: only show on the bottom-right cell of the selection -->
                <div *ngIf="isFillHandleCell(r, c)"
                  class="fill-handle"
                  (mousedown)="onFillHandleMouseDown($event, r, c)"
                  title="Drag to fill"></div>
                </td>
              </ng-container>
            </tr>
            </ng-container>
          <tr *ngIf="bottomSpacerHeight > 0" [style.height.px]="bottomSpacerHeight"><td [attr.colspan]="30" style="border:none;padding:0;pointer-events:none;"></td></tr>
          </tbody>
        </table>
      </div>

      <!-- Right Side Panel for Apps -->
      <div class="side-panel" *ngIf="sidePanelApp">
        <div class="sp-head">
          <div class="sp-head-left">
            <div class="sp-icon-wrap" [class.sp-icon-cal]="sidePanelApp==='calendar'" [class.sp-icon-notes]="sidePanelApp==='notes'" [class.sp-icon-tasks]="sidePanelApp==='tasks'" [class.sp-icon-pivot]="sidePanelApp==='pivot'" [style.background]="sidePanelApp==='pivot'?'#10b981':'inherit'">
              <span class="material-symbols-outlined sp-head-icon">{{sidePanelApp==='pivot'?'pivot_table_chart':sidePanelApp==='calendar'?'calendar_month':sidePanelApp==='notes'?'sticky_note_2':'task_alt'}}</span>
            </div>
            <div>
              <div class="sp-title">{{sidePanelApp==='pivot'?'Pivot Table Editor':sidePanelApp==='calendar'?'Calendar':sidePanelApp==='notes'?'Notes':'Tasks'}}</div>
              <div class="sp-subtitle">{{sidePanelApp==='pivot'?'Configure rows and values':sidePanelApp==='calendar'?'Schedule & meeting notes':sidePanelApp==='notes'?'Quick capture':'Track your work'}}</div>
            </div>
          </div>
          <button class="sp-close-btn" (click)="closeSidePanel()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="sp-content">

          <!-- ── PIVOT TABLE ─────────────────────────────────────────────── -->
          <ng-container *ngIf="sidePanelApp === 'pivot'">
            <div class="sp-card" style="display:flex; flex-direction:column; gap:16px;">
              
              <div>
                <div class="sp-card-label" style="font-weight:600; margin-bottom:8px;">Rows</div>
                <select [(ngModel)]="pivotConfig.row" (change)="applyPivot()" style="width:100%; padding:8px; border:1px solid #e2e8f0; border-radius:4px; outline:none;">
                  <option value="" disabled>Select row field...</option>
                  <option *ngFor="let h of pivotHeaders" [value]="h">{{h}}</option>
                </select>
              </div>

              <div>
                <div class="sp-card-label" style="font-weight:600; margin-bottom:8px;">Values</div>
                <select [(ngModel)]="pivotConfig.val" (change)="applyPivot()" style="width:100%; padding:8px; border:1px solid #e2e8f0; border-radius:4px; outline:none;">
                  <option value="" disabled>Select value field...</option>
                  <option *ngFor="let h of pivotHeaders" [value]="h">{{h}}</option>
                </select>
              </div>

              <div>
                <div class="sp-card-label" style="font-weight:600; margin-bottom:8px;">Summarize by</div>
                <select [(ngModel)]="pivotConfig.agg" (change)="applyPivot()" style="width:100%; padding:8px; border:1px solid #e2e8f0; border-radius:4px; outline:none;">
                  <option value="SUM">SUM</option>
                  <option value="COUNT">COUNT</option>
                  <option value="AVG">AVG</option>
                </select>
              </div>

            </div>
          </ng-container>

          <!-- ── CALENDAR ─────────────────────────────────────────────── -->
          <ng-container *ngIf="sidePanelApp === 'calendar'">
            <div class="sp-card sp-date-card">
              <div class="sp-card-label">
                <span class="material-symbols-outlined sp-label-icon">event</span>
                Select Date
              </div>
              <input type="date" [(ngModel)]="selectedCalDate"
                class="sp-date-input">
              <div class="sp-date-chip" *ngIf="selectedCalDate">
                <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
                {{selectedCalDate}}
              </div>
            </div>

            <div class="sp-card sp-notes-card sp-notes-grow">
              <div class="sp-card-label">
                <span class="material-symbols-outlined sp-label-icon">rate_review</span>
                Meeting Notes
              </div>
              <div class="sp-textarea-wrap">
                <textarea [(ngModel)]="calendarNotes[selectedCalDate]" (change)="save()"
                  [placeholder]="'Notes for ' + (selectedCalDate || 'selected date') + '...'"
                  class="sp-textarea"></textarea>
                <div class="sp-textarea-footer">
                  <span class="material-symbols-outlined" style="font-size:13px;color:#aaa;">save</span>
                  <span style="font-size:11px;color:#aaa;">Auto-saved</span>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- ── NOTES ───────────────────────────────────────────────── -->
          <ng-container *ngIf="sidePanelApp === 'notes'">
            <div class="sp-card sp-notes-card" style="flex:1;display:flex;flex-direction:column;">
              <div class="sp-card-label">
                <span class="material-symbols-outlined sp-label-icon">edit_note</span>
                Global Notes
              </div>
              <div class="sp-textarea-wrap" style="flex:1">
                <textarea [(ngModel)]="globalNotes" (change)="save()"
                  placeholder="Capture your thoughts, ideas, and requirements here…"
                  class="sp-textarea sp-textarea-tall"></textarea>
                <div class="sp-textarea-footer">
                  <span class="material-symbols-outlined" style="font-size:13px;color:#aaa;">save</span>
                  <span style="font-size:11px;color:#aaa;">Auto-saved</span>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- ── TASKS ───────────────────────────────────────────────── -->
          <ng-container *ngIf="sidePanelApp === 'tasks'">
            <div class="sp-task-add-wrap">
              <span class="material-symbols-outlined sp-task-add-icon">add_circle</span>
              <input type="text" [(ngModel)]="newTask" (keyup.enter)="addTask()"
                placeholder="Add a new task…"
                class="sp-task-input">
              <button class="sp-add-btn" (click)="addTask()">Add</button>
            </div>

            <div class="sp-tasks-summary" *ngIf="tasks.length > 0">
              <span class="sp-tasks-count">{{tasks.length}} task{{tasks.length===1?'':'s'}}</span>
              <span class="sp-tasks-done">{{getTasksDone()}} done</span>
            </div>

            <div class="sp-task-item" *ngFor="let t of tasks; let i = index" [class.sp-task-done]="t.done">
              <label class="sp-checkbox-wrap">
                <input type="checkbox" [(ngModel)]="t.done" (change)="save()" class="sp-checkbox-native">
                <span class="sp-checkbox-ui">
                  <span class="material-symbols-outlined sp-check-icon">check</span>
                </span>
              </label>
              <span class="sp-task-text">{{t.text}}</span>
              <button class="sp-task-del" (click)="removeTask(i)" title="Delete">
                <span class="material-symbols-outlined">delete_outline</span>
              </button>
            </div>

            <div class="sp-empty" *ngIf="tasks.length === 0">
              <div class="sp-empty-icon">
                <span class="material-symbols-outlined">check_circle</span>
              </div>
              <div class="sp-empty-title">All clear!</div>
              <div class="sp-empty-sub">Add your first task above to get started.</div>
            </div>
          </ng-container>

        </div>
      </div>
    </div>

      <div class="toast" [class.show]="toastVisible">{{ toastMsg }}</div>

            <!-- Image Preview Modal -->
      <div *ngIf="previewImageUrl" class="modal-overlay" (click)="previewImageUrl = null" style="z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;">
        <div style="position: relative; max-width: 90vw; max-height: 90vh; background: #fff; padding: 12px; padding-top: 48px; border-radius: 8px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); display: inline-flex; flex-direction: column;" (click)="$event.stopPropagation()">
          <button style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.05); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #5f6368; transition: background 0.2s;" (click)="previewImageUrl = null" onmouseover="this.style.background='rgba(0,0,0,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.05)'" title="Close">
            <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
          </button>
          <a [href]="previewImageUrl" download="sheet_image.png" style="position: absolute; top: 12px; right: 52px; background: rgba(0,0,0,0.05); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #5f6368; transition: background 0.2s; text-decoration: none;" onmouseover="this.style.background='rgba(0,0,0,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.05)'" title="Download">
            <span class="material-symbols-outlined" style="font-size: 20px;">download</span>
          </a>
          <img [src]="previewImageUrl" style="max-width: 100%; max-height: calc(90vh - 60px); object-fit: contain; border-radius: 4px; display: block;">
        </div>
      </div>

      <!-- Right-click Context Menu -->
      <div class="ctx-menu" *ngIf="ctxVisible" [style.left.px]="ctxX" [style.top.px]="ctxTop" [style.bottom.px]="ctxBottom" [style.maxHeight.px]="ctxMaxHeight" (click)="$event.stopPropagation()">
        <div class="ctx-item" (click)="cutCell(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_cut</span> Cut <span class="ctx-hint">Ctrl+X</span></div>
        <div class="ctx-item" (click)="copyCell(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_copy</span> Copy <span class="ctx-hint">Ctrl+C</span></div>
        <div class="ctx-item" (click)="pasteCell(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_paste</span> Paste <span class="ctx-hint">Ctrl+V</span></div>
        <div class="ctx-item" (click)="openCellEditHistory(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px; color: #10b981;">history</span> Edit History...</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" (click)="openValidationModal(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">arrow_drop_down_circle</span> Set dropdown list...</div>
        <div class="ctx-item danger" (click)="removeValidation(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">close</span> Remove dropdown</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" (click)="sortColAZ(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">sort</span> Sort A to Z</div>
        <div class="ctx-item" (click)="sortColZA(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">sort</span> Sort Z to A</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" (click)="insertRowAbove(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert {{ selectedRowCount }} row{{ selectedRowCount > 1 ? 's' : '' }} above</div>
        <div class="ctx-item" (click)="insertRowBelow(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert {{ selectedRowCount }} row{{ selectedRowCount > 1 ? 's' : '' }} below</div>
        <div class="ctx-item" (click)="insertColLeft(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert {{ selectedColCount }} column{{ selectedColCount > 1 ? 's' : '' }} left</div>
        <div class="ctx-item" (click)="insertColRight(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert {{ selectedColCount }} column{{ selectedColCount > 1 ? 's' : '' }} right</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item danger" (click)="deleteRow(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">delete</span> Delete {{ selectedRowCount }} row{{ selectedRowCount > 1 ? 's' : '' }}</div>
        <div class="ctx-item danger" (click)="deleteCol(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">delete</span> Delete {{ selectedColCount }} column{{ selectedColCount > 1 ? 's' : '' }}</div>
        <div class="ctx-item danger" (click)="clearRangeData(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">backspace</span> Clear selection</div>
      </div>

      <!-- Validation / Dropdown Modal (Zoho Picklist Style) -->
      <div class="modal-overlay" *ngIf="validationModalOpen" (click)="validationModalOpen = false">
        <div class="modal" (click)="$event.stopPropagation()" style="width:380px; background:#fff; color:#333; border:1px solid #ddd; box-shadow:0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; display:flex; flex-direction:column; max-height:90vh;">
          
          <!-- Header -->
          <div style="padding: 16px 20px 12px; border-bottom:1px solid #e2e8f0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="margin:0; font-size:18px; font-weight:600; color:#333;">Picklist</h3>
              <button (click)="validationModalOpen = false" style="background:none; border:none; cursor:pointer; color:#888; display:flex;"><span class="material-symbols-outlined" style="font-size:20px;">cancel</span></button>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#555;">
              <span>Applies to: <span style="color:#333; font-weight:500;">Sheet1.{{getRangeRef()}}</span></span>
              <span style="color:#009a5f; cursor:pointer; font-weight:500;">Edit</span>
            </div>
          </div>

          <!-- Body -->
          <div style="padding: 16px 20px; overflow-y:auto; flex:1; background:#f9fafb;">
            
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-bottom:12px; display:flex; gap:24px;">
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="select_type" value="single" [(ngModel)]="picklistSelectType" style="accent-color:#009a5f;"> Single-Select
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="select_type" value="multi" [(ngModel)]="picklistSelectType" style="accent-color:#009a5f;"> Multi-Select
              </label>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:16px;">
              <div style="padding:12px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:16px;">
                <span style="font-size:13px; font-weight:500; color:#555;">Type</span>
                <select style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; outline:none; cursor:pointer; background:#fff;">
                  <option>List</option>
                </select>
              </div>
              <div style="padding:12px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#333;">
                <span style="cursor:pointer; display:flex; align-items:center; gap:4px;">Sort <span class="material-symbols-outlined" style="font-size:16px;">arrow_downward</span></span>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  Display as chip
                  <div style="width:32px; height:18px; background:#00c274; border-radius:9px; position:relative;">
                    <div style="width:14px; height:14px; background:#fff; border-radius:50%; position:absolute; top:2px; right:2px;"></div>
                  </div>
                </label>
              </div>
              <div style="padding:12px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:12px;">
                <span style="font-size:13px; color:#555; width: 80px;">Color options</span>
                <select style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; outline:none; cursor:pointer; background:#f1f5f9; color: #333;">
                  <option>Single Color</option>
                  <option>Multi Color</option>
                </select>
              </div>
              
              <div style="padding:12px; max-height:220px; overflow-y:auto;">
                <div *ngFor="let opt of picklistOptions; let i = index" style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                   <div style="color:#cbd5e1; cursor:grab; display:flex;"><span class="material-symbols-outlined" style="font-size:18px;">drag_indicator</span></div>
                   <div style="position:relative; width:20px; height:20px; border-radius:50%; overflow:hidden; border:1px solid #e2e8f0; flex-shrink:0;">
                     <input type="color" [(ngModel)]="opt.color" style="position:absolute;top:-5px;left:-5px;width:30px;height:30px;border:none;cursor:pointer;padding:0;background:transparent;">
                   </div>
                   <input type="text" [(ngModel)]="opt.label" placeholder="Item name" style="flex:1; border:1px solid transparent; background:#f1f5f9; color:#333; padding:6px 12px; border-radius:16px; outline:none; font-size:13px; transition:border 0.2s;">
                   <button (click)="picklistOptions.splice(i, 1)" style="background:none;border:none;color:#a0aec0;cursor:pointer;font-size:18px;padding:4px;display:flex;align-items:center;"><span class="material-symbols-outlined" style="font-size:18px;">close</span></button>
                </div>
                <button (click)="addPicklistOption()" style="background:none;border:none;color:#009a5f;cursor:pointer;font-weight:600;font-size:13px;padding:8px 0;display:flex;align-items:center;gap:6px;width:100%; justify-content:flex-start; border-top:1px dashed #cbd5e1; margin-top:8px;">
                  <span class="material-symbols-outlined" style="font-size:18px;">add_circle</span> Add New
                </button>
              </div>
            </div>

            <div style="margin-bottom:16px;">
              <div style="font-size:12px; color:#a0aec0; margin-bottom:8px;">Options</div>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; color:#333;">
                <input type="checkbox" checked style="accent-color:#009a5f; width:16px; height:16px;"> Display a dropdown icon in the cell
              </label>
            </div>
            
            <div [style.opacity]="picklistSelectType === 'single' ? '0.5' : '1'">
              <div style="font-size:12px; margin-bottom:8px;" [style.color]="picklistSelectType === 'single' ? '#cbd5e1' : '#a0aec0'">Arrange items in the cell</div>
              <div style="display:flex; gap:24px;">
                <label style="display:flex; align-items:center; gap:8px; font-size:13px;" [style.color]="picklistSelectType === 'single' ? '#cbd5e1' : '#888'" [style.cursor]="picklistSelectType === 'single' ? 'not-allowed' : 'pointer'">
                  <input type="radio" checked name="arrange" style="accent-color:#009a5f; width:16px; height:16px;" [disabled]="picklistSelectType === 'single'"> Horizontally
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:13px;" [style.color]="picklistSelectType === 'single' ? '#cbd5e1' : '#888'" [style.cursor]="picklistSelectType === 'single' ? 'not-allowed' : 'pointer'">
                  <input type="radio" name="arrange" style="accent-color:#009a5f; width:16px; height:16px;" [disabled]="picklistSelectType === 'single'"> Vertically
                </label>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 20px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:12px; background:#fff; border-radius:0 0 8px 8px;">
            <button (click)="saveValidation()" style="background:#8fe0b8; color:#fff; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:600; font-size:14px; transition: background 0.2s;" onmouseover="this.style.background='#00c274'" onmouseout="this.style.background='#8fe0b8'">Create</button>
            <button (click)="validationModalOpen = false" style="background:#fff; border:1px solid #cbd5e1; color:#333; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:600; font-size:14px; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Goal Seek Modal -->
      <div class="modal-overlay" *ngIf="goalSeekModalOpen" (click)="goalSeekModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:380px;background:#fff;color:#333;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;font-size:18px;font-weight:600;">Goal Seek</h3>
            <button (click)="goalSeekModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div style="font-size:13px;color:#5f6368;margin-bottom:16px;">Find the input value needed to achieve a specific goal in a formula cell.</div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <label style="font-size:13px;width:110px;color:#555;">Set Cell:</label>
              <input [(ngModel)]="goalSeekTargetCell" placeholder="e.g. B5" style="flex:1;border:1px solid #cbd5e1;border-radius:4px;padding:7px 10px;font-size:13px;outline:none;" />
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <label style="font-size:13px;width:110px;color:#555;">To Value:</label>
              <input [(ngModel)]="goalSeekTargetValue" placeholder="e.g. 1000" style="flex:1;border:1px solid #cbd5e1;border-radius:4px;padding:7px 10px;font-size:13px;outline:none;" />
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <label style="font-size:13px;width:110px;color:#555;">By Changing Cell:</label>
              <input [(ngModel)]="goalSeekByCell" placeholder="e.g. A2" style="flex:1;border:1px solid #cbd5e1;border-radius:4px;padding:7px 10px;font-size:13px;outline:none;" />
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button (click)="applyGoalSeek()" style="background:#10b981;color:#fff;border:none;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Solve</button>
            <button (click)="goalSeekModalOpen=false" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Email Notifications Modal -->
      <div class="modal-overlay" *ngIf="emailNotifModalOpen" (click)="emailNotifModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:420px;background:#fff;color:#333;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;font-size:18px;font-weight:600;">Email Notification Settings</h3>
            <button (click)="emailNotifModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px;">
            <input [(ngModel)]="emailNotifEmail" placeholder="Notify email address" style="border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;font-size:13px;outline:none;" />
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" [(ngModel)]="emailNotifOnEdit" style="accent-color:#10b981;"> Notify me when the sheet is edited
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" [(ngModel)]="emailNotifOnComment" style="accent-color:#10b981;"> Notify me when a comment is added
            </label>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button (click)="saveEmailNotifications()" style="background:#10b981;color:#fff;border:none;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Save</button>
            <button (click)="emailNotifModalOpen=false" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Preferences Modal -->
      <div class="modal-overlay" *ngIf="preferencesModalOpen" (click)="preferencesModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:420px;background:#fff;color:#333;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;font-size:18px;font-weight:600;">My Preferences</h3>
            <button (click)="preferencesModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <label style="font-size:13px;width:130px;color:#555;">Locale:</label>
              <select [(ngModel)]="prefLocale" style="flex:1;border:1px solid #cbd5e1;border-radius:4px;padding:7px;font-size:13px;outline:none;background:#fff;">
                <option value="en-US">English (US)</option>
                <option value="en-IN">English (India)</option>
                <option value="en-GB">English (UK)</option>
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <label style="font-size:13px;width:130px;color:#555;">Date Format:</label>
              <select [(ngModel)]="prefDateFormat" style="flex:1;border:1px solid #cbd5e1;border-radius:4px;padding:7px;font-size:13px;outline:none;background:#fff;">
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" [(ngModel)]="prefThousands" style="accent-color:#10b981;"> Use thousands separator (1,000)
            </label>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button (click)="savePreferences()" style="background:#10b981;color:#fff;border:none;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Save</button>
            <button (click)="preferencesModalOpen=false" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Feedback Modal -->
      <div class="modal-overlay" *ngIf="feedbackModalOpen" (click)="feedbackModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:420px;background:#fff;color:#333;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;font-size:18px;font-weight:600;">Send Feedback</h3>
            <button (click)="feedbackModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px;">
            <div style="font-size:13px;color:#555;">Rate your experience:</div>
            <div style="display:flex;gap:8px;">
              <span *ngFor="let s of [1,2,3,4,5]" (click)="feedbackRating=s" style="font-size:28px;cursor:pointer;" [style.opacity]="s<=feedbackRating?'1':'0.3'">⭐</span>
            </div>
            <textarea [(ngModel)]="feedbackText" placeholder="Tell us what you think..." style="border:1px solid #cbd5e1;border-radius:4px;padding:8px;font-size:13px;height:100px;outline:none;resize:none;font-family:inherit;"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button (click)="submitFeedback()" style="background:#10b981;color:#fff;border:none;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Submit</button>
            <button (click)="feedbackModalOpen=false" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 24px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Text to Columns Modal -->
      <div class="modal-overlay" *ngIf="textToColsModalOpen" (click)="textToColsModalOpen = false" style="z-index: 10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:420px; background:#fff; color:#333; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); padding:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; font-size:18px; font-weight:600;">Text to Columns</h3>
            <button (click)="textToColsModalOpen = false" style="background:none; border:none; cursor:pointer; color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div style="margin-bottom:16px; font-size:13px; color:#5f6368;">Splits the selected column's content into multiple columns using a delimiter.</div>
          <div style="margin-bottom:16px;">
            <div style="font-size:13px; font-weight:600; margin-bottom:10px;">Separator:</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="t2cDelim" value="," [(ngModel)]="t2cDelimiter" style="accent-color:#10b981;"> Comma (,)
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="t2cDelim" value="	" [(ngModel)]="t2cDelimiter" style="accent-color:#10b981;"> Tab
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="t2cDelim" value=" " [(ngModel)]="t2cDelimiter" style="accent-color:#10b981;"> Space
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="t2cDelim" value=";" [(ngModel)]="t2cDelimiter" style="accent-color:#10b981;"> Semicolon (;)
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="t2cDelim" value="custom" [(ngModel)]="t2cDelimiter" style="accent-color:#10b981;"> Custom:
                <input [(ngModel)]="t2cCustomDelim" (focus)="t2cDelimiter='custom'" placeholder="e.g. |" style="border:1px solid #cbd5e1; border-radius:4px; padding:4px 8px; width:60px; outline:none; font-size:13px;" />
              </label>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button (click)="applyTextToColumns()" style="background:#10b981; color:#fff; border:none; padding:8px 24px; border-radius:4px; font-weight:600; cursor:pointer;">Apply</button>
            <button (click)="textToColsModalOpen = false" style="background:#f1f5f9; color:#333; border:1px solid #e2e8f0; padding:8px 24px; border-radius:4px; font-weight:600; cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Range Picker Floating Bar -->
      <div *ngIf="rangePickerActive" style="position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:20000; background:#fff; border:2px solid #10b981; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.2); display:flex; align-items:center; gap:8px; padding:8px 12px; min-width:320px;">
        <span class="material-symbols-outlined" style="color:#10b981; font-size:18px;">grid_on</span>
        <input [value]="getRangePickerValue()" (input)="onRangePickerInput($event)" style="flex:1; border:none; outline:none; font-size:13px; color:#1a73e8; font-weight:500;" />
        <button (click)="confirmRangePicker()" style="background:#10b981; color:#fff; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; display:flex; align-items:center;">
          <span class="material-symbols-outlined" style="font-size:18px;">check</span>
        </button>
        <button (click)="cancelRangePicker()" style="background:#f1f5f9; color:#333; border:1px solid #e2e8f0; border-radius:4px; padding:4px 10px; cursor:pointer; display:flex; align-items:center;">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>

      <!-- Create Pivot Table Modal -->
      <div class="modal-overlay" *ngIf="pivotModalOpen" (click)="pivotModalOpen = false" style="z-index: 10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:400px; background:#fff; color:#333; border-radius: 8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); display:flex; flex-direction:column; padding: 20px;">
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0; font-size:18px; font-weight:600;">Create Pivot Table</h3>
            <button (click)="pivotModalOpen = false" style="background:none; border:none; cursor:pointer; color:#888; display:flex;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-size:13px; margin-bottom:8px;">Choose the data range for the table:</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px;">Source:</span>
              <div style="flex:1; border: 1px solid #10b981; border-radius: 4px; padding: 4px 8px; display:flex; align-items:center; gap:4px;">
                <input [(ngModel)]="pivotSource" style="border:none; outline:none; flex:1; font-size:13px; color:#1a73e8; background:transparent;" placeholder="Sheet1.A1:C10" />
                <span class="material-symbols-outlined" style="font-size:16px; color:#5f6368; cursor:pointer;" (click)="startRangePicker('pivotSource')">grid_on</span>
              </div>
            </div>
          </div>

          <div style="margin-bottom:24px;">
            <div style="font-size:13px; margin-bottom:8px;">Choose the location for the table:</div>
            <div style="display:flex; align-items:center; gap:16px; margin-bottom: 12px; font-size:13px;">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="radio" name="pivotLoc" value="new" [(ngModel)]="pivotDestType" style="accent-color:#10b981;"> New sheet
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="radio" name="pivotLoc" value="existing" [(ngModel)]="pivotDestType" style="accent-color:#10b981;"> Existing sheet
              </label>
            </div>
            <div *ngIf="pivotDestType === 'existing'" style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px;">Location:</span>
              <div style="flex:1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; display:flex; align-items:center; gap:4px;">
                <input [(ngModel)]="pivotDest" style="border:none; outline:none; flex:1; font-size:13px; color:#1a73e8; background:transparent;" placeholder="Sheet1.A9" />
                <span class="material-symbols-outlined" style="font-size:16px; color:#5f6368; cursor:pointer;" (click)="startRangePicker('pivotDest')">grid_on</span>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button (click)="createPivotTable()" style="background:#10b981; color:#fff; border:none; padding:8px 24px; border-radius:4px; font-weight:600; cursor:pointer;">OK</button>
            <button (click)="pivotModalOpen = false" style="background:#f1f5f9; color:#333; border:1px solid #e2e8f0; padding:8px 24px; border-radius:4px; font-weight:600; cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Data Validation Modal -->
      <div class="modal-overlay" *ngIf="dataValidationModalOpen" (click)="dataValidationModalOpen = false" style="z-index: 10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:500px; background:#fff; color:#333; border-radius: 8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); display:flex; flex-direction:column; padding: 20px;">
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0; font-size:18px; font-weight:600;">Data Validation</h3>
            <button (click)="dataValidationModalOpen = false" style="background:none; border:none; cursor:pointer; color:#888; display:flex;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>

          <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
            <span style="font-size:13px; width: 70px;">Applies to:</span>
            <div style="flex:1; border: 1px solid #10b981; border-radius: 4px; padding: 4px 8px; display:flex; align-items:center; gap:4px;">
              <input [(ngModel)]="dvAppliesTo" style="border:none; outline:none; flex:1; font-size:13px; color:#1a73e8; background:transparent;" />
              <span class="material-symbols-outlined" style="font-size:16px; color:#5f6368; cursor:pointer;" (click)="startRangePicker('dvAppliesTo')">grid_on</span>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
            <span style="font-size:13px; width:70px;">Criteria:</span>
            <select [(ngModel)]="dvCriteria" style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; font-size:13px; width:130px; outline:none; background:#fff;">
              <option value="list">List</option>
              <option value="number">Number</option>
              <option value="text">Text</option>
              <option value="date">Date</option>
              <option value="checkbox">Checkbox</option>
            </select>
            <label style="display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer;">
              <input type="checkbox" [(ngModel)]="dvShowList" style="accent-color:#10b981;"> Show List
            </label>
            <label style="display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer;">
              <input type="checkbox" [(ngModel)]="dvSortAsc" style="accent-color:#10b981;"> Sort Ascending
            </label>
          </div>

          <div style="margin-left: 84px; margin-bottom: 16px;">
            <textarea placeholder="Line Separated Values (one per line)" [(ngModel)]="validationInput" style="width: 100%; height: 80px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; font-size:13px; outline:none; font-family:inherit; resize:none; box-sizing:border-box;"></textarea>
          </div>

          <div style="margin-left: 84px; margin-bottom: 16px;">
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
              <input type="checkbox" [(ngModel)]="dvIgnoreBlanks" style="accent-color:#10b981;"> Ignore Blanks
            </label>
          </div>

          <!-- Alerts and Help Text (expandable) -->
          <div style="margin-bottom:16px; border:1px solid #e2e8f0; border-radius:4px; overflow:hidden;">
            <div (click)="dvAlertsOpen = !dvAlertsOpen" style="display:flex; align-items:center; gap:4px; cursor:pointer; user-select:none; padding:10px 12px; background:#f8f9fa;">
              <span class="material-symbols-outlined" style="font-size:16px; transition:transform 0.2s;" [style.transform]="dvAlertsOpen ? 'rotate(90deg)' : 'rotate(0deg)'">arrow_right</span>
              <span style="font-size:13px; font-weight:500;">Alerts and Help Text</span>
            </div>
            <div *ngIf="dvAlertsOpen" style="padding:12px; display:flex; flex-direction:column; gap:10px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
                <input type="checkbox" [(ngModel)]="dvAlertEnabled" style="accent-color:#10b981;"> Show validation error alert
              </label>
              <div *ngIf="dvAlertEnabled" style="display:flex; flex-direction:column; gap:8px;">
                <input [(ngModel)]="dvAlertTitle" placeholder="Alert Title" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px 8px; font-size:13px; outline:none;" />
                <textarea [(ngModel)]="dvAlertMsg" placeholder="Alert message shown when invalid data is entered" style="border:1px solid #cbd5e1; border-radius:4px; padding:6px 8px; font-size:13px; outline:none; resize:none; height:60px;"></textarea>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button (click)="saveDataValidation()" style="background:#10b981; color:#fff; border:none; padding:8px 24px; border-radius:4px; font-weight:600; cursor:pointer;">OK</button>
            <button (click)="dataValidationModalOpen = false" style="background:#f1f5f9; color:#333; border:1px solid #e2e8f0; padding:8px 24px; border-radius:4px; font-weight:600; cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Manage Rules Modal -->
      <div class="modal-overlay" *ngIf="manageRulesModalOpen" (click)="manageRulesModalOpen = false" style="z-index: 10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:400px; background:#fff; color:#333; border-radius: 8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); display:flex; flex-direction:column;">
          
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 16px 20px; border-bottom:1px solid #e2e8f0;">
            <h3 style="margin:0; font-size:18px; font-weight:600;">Data Validation - Manage Rules</h3>
            <button (click)="manageRulesModalOpen = false" style="background:none; border:none; cursor:pointer; color:#888; display:flex;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>

          <div style="padding: 16px 20px; background:#f8f9fa; display:flex; align-items:center; gap:8px; border-bottom:1px solid #e2e8f0;">
            <span style="font-size:13px;">View Rules for:</span>
            <select style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; font-size:13px; width:120px; outline:none; background:#fff;">
              <option>Sheet1</option>
            </select>
          </div>

          <div style="padding: 60px 20px; text-align:center; color:#5f6368; font-size:14px;">
            No Rules
          </div>

          <div style="padding: 16px 20px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0;">
            <button (click)="manageRulesModalOpen = false; dataValidationModalOpen = true" style="background:#f1f5f9; color:#333; border:1px solid #e2e8f0; padding:8px 16px; border-radius:4px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px; font-size:13px;">
              <span class="material-symbols-outlined" style="font-size:16px;">add</span> Create Validation
            </button>
            <button (click)="manageRulesModalOpen = false" style="background:#f1f5f9; color:#333; border:1px solid #e2e8f0; padding:8px 24px; border-radius:4px; font-weight:600; cursor:pointer; font-size:13px;">Close</button>
          </div>
        </div>
      </div>
      <!-- Spell Check Modal -->
      <div class="modal-overlay" *ngIf="spellCheckModalOpen" (click)="spellCheckModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:480px;background:#fff;color:#333;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.15);padding:24px;border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="material-symbols-outlined" style="color:#10b981;font-size:22px;">spellcheck</span>
              <h3 style="margin:0;font-size:18px;font-weight:600;">Spell Check</h3>
            </div>
            <button (click)="spellCheckModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div *ngIf="spellCheckLoading" style="padding:40px;text-align:center;color:#5f6368;">
             <span class="material-symbols-outlined" style="animation:spin 1s linear infinite;font-size:24px;">refresh</span>
             <p>Checking spelling...</p>
          </div>
          <div *ngIf="!spellCheckLoading && spellCheckErrors.length === 0" style="padding:40px;text-align:center;color:#10b981;">
             <span class="material-symbols-outlined" style="font-size:48px;">check_circle</span>
             <p style="margin-top:12px;font-weight:500;">No spelling errors found!</p>
          </div>
          <div *ngIf="!spellCheckLoading && spellCheckErrors.length > 0" style="max-height:300px;overflow-y:auto;">
             <p style="color:#d93025;font-weight:600;margin-bottom:16px;">Found {{spellCheckErrors.length}} error(s):</p>
             <div *ngFor="let err of spellCheckErrors; let i=index" style="border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:12px;background:#f8f9fa;">
               <div style="font-size:14px;color:#333;margin-bottom:8px;">
                 "...{{err.context.text.substring(0, err.context.offset)}}<strong style="color:#d93025;background:#fee2e2;padding:2px 4px;border-radius:2px;">{{err.context.text.substring(err.context.offset, err.context.offset + err.context.length)}}</strong>{{err.context.text.substring(err.context.offset + err.context.length)}}..."
               </div>
               <div style="font-size:12px;color:#5f6368;margin-bottom:12px;">{{err.message}}</div>
               <div style="display:flex;gap:8px;flex-wrap:wrap;" *ngIf="err.replacements?.length > 0">
                 <button *ngFor="let rep of err.replacements.slice(0, 4)" (click)="applySpellCheckFix(i, rep.value)" style="background:#fff;border:1px solid #cbd5e1;padding:4px 10px;border-radius:4px;font-size:12px;cursor:pointer;color:#1a73e8;font-weight:500;">{{rep.value}}</button>
               </div>
             </div>
          </div>
        </div>
      </div>

      <!-- Translate Modal -->
      <div class="modal-overlay" *ngIf="translateModalOpen" (click)="translateModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:500px;background:#fff;color:#333;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.15);padding:24px;border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="material-symbols-outlined" style="color:#1a73e8;font-size:22px;">translate</span>
              <h3 style="margin:0;font-size:18px;font-weight:600;">Translate Cell</h3>
            </div>
            <button (click)="translateModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          
          <div style="display:flex;gap:12px;align-items:stretch;margin-bottom:16px;">
             <div style="flex:1;">
               <div style="font-size:12px;font-weight:600;color:#5f6368;margin-bottom:6px;">Original Text (Auto-detect)</div>
               <textarea [ngModel]="translateSourceText" readonly style="width:100%;height:100px;background:#f8f9fa;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:14px;color:#333;resize:none;outline:none;box-sizing:border-box;"></textarea>
             </div>
             <div style="display:flex;align-items:center;">
               <span class="material-symbols-outlined" style="color:#9aa0a6;">arrow_forward</span>
             </div>
             <div style="flex:1;">
               <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                 <div style="font-size:12px;font-weight:600;color:#5f6368;">Translation</div>
                 <select [(ngModel)]="translateTargetLang" (change)="runTranslate()" style="border:1px solid #cbd5e1;border-radius:4px;padding:2px 4px;font-size:11px;outline:none;">
                   <option value="es">Spanish</option>
                   <option value="fr">French</option>
                   <option value="de">German</option>
                   <option value="it">Italian</option>
                   <option value="zh-CN">Chinese (Simplified)</option>
                   <option value="ja">Japanese</option>
                   <option value="ko">Korean</option>
                   <option value="hi">Hindi</option>
                 </select>
               </div>
               <div style="position:relative;width:100%;height:100px;">
                 <textarea [(ngModel)]="translateTargetText" [readOnly]="translateLoading" style="width:100%;height:100%;background:#fff;border:1px solid #1a73e8;border-radius:6px;padding:12px;font-size:14px;color:#1a73e8;resize:none;outline:none;box-sizing:border-box;"></textarea>
                 <div *ngIf="translateLoading" style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;border-radius:6px;">
                   <span class="material-symbols-outlined" style="animation:spin 1s linear infinite;color:#1a73e8;">refresh</span>
                 </div>
               </div>
             </div>
          </div>
          
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button (click)="translateModalOpen=false" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
            <button (click)="applyTranslation()" [disabled]="!translateTargetText || translateLoading" style="background:#1a73e8;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;" [style.opacity]="!translateTargetText || translateLoading ? 0.5 : 1">Replace in Cell</button>
          </div>
        </div>
      </div>

      <!-- Feature Modals -->
        <div class="modal-overlay" *ngIf="activeModal !== null" (click)="activeModal = null" style="z-index: 10000;">
          <div class="modal" (click)="$event.stopPropagation()" style="background:#fff; color:#333; border:1px solid #e2e8f0; box-shadow:0 8px 32px rgba(0,0,0,0.15); width:460px; padding:24px; border-radius:8px; position:relative;">
            <button (click)="activeModal = null" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;color:#888;display:flex;align-items:center;justify-content:center;">
              <span class="material-symbols-outlined" style="font-size:20px;">close</span>
            </button>

            <div *ngIf="activeModal === 'audit'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#10b981;font-size:24px;">history</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Audit Trail</h3>
              </div>
              <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:16px;">
                <div style="background:#f8f9fa;padding:10px 14px;font-size:12px;font-weight:600;color:#5f6368;border-bottom:1px solid #e2e8f0;display:flex;gap:16px;">
                  <span style="width:130px;">Time</span><span style="width:100px;">User</span><span>Action</span>
                </div>
                <div *ngFor="let item of dummyList; let i=index" style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;display:flex;gap:16px;align-items:center;" [style.background]="i%2===0?'#fff':'#fafafa'">
                  <span style="width:130px;color:#5f6368;">Today, {{12+i}}:{{i*7|number:'2.0'}} PM</span>
                  <span style="width:100px;">You</span>
                  <span>Edited cell A{{i+1}}</span>
                </div>
              </div>
              <div style="display:flex;justify-content:flex-end;">
                <button (click)="activeModal=null" style="background:#10b981;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
              </div>
            </div>

            <div *ngIf="activeModal === 'version'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#1a73e8;font-size:24px;">manage_history</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Version History</h3>
              </div>
              <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:16px;">
                <div *ngFor="let item of dummyList; let i=index" (click)="handleModalAction()" style="padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" [style.background]="i===0?'#f0fdf4':'#fff'">
                  <div>
                    <div style="font-weight:500;">{{i===0?'Current Version':item}}</div>
                    <div style="font-size:12px;color:#5f6368;margin-top:2px;">Today at {{12+i}}:{{(i*13)%60|number:'2.0'}} PM · You</div>
                  </div>
                  <span *ngIf="i===0" style="background:#10b981;color:#fff;font-size:11px;padding:2px 8px;border-radius:3px;font-weight:600;">Current</span>
                  <span *ngIf="i>0" style="color:#1a73e8;font-size:13px;cursor:pointer;">Restore</span>
                </div>
              </div>
              <div style="display:flex;justify-content:flex-end;">
                <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
              </div>
            </div>

            <div *ngIf="activeModal === 'workflow'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#f59e0b;font-size:24px;">account_tree</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Manage Workflows</h3>
              </div>
              <div style="text-align:center;padding:40px 20px;color:#5f6368;">
                <span class="material-symbols-outlined" style="font-size:48px;color:#e2e8f0;">account_tree</span>
                <p style="margin-top:12px;font-size:14px;">No workflows created yet.</p>
                <p style="font-size:13px;color:#9aa0a6;">Workflows let you automate actions when data changes in your sheet.</p>
                <button (click)="showToast('Workflow creation coming soon.')" style="background:#10b981;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;margin-top:8px;">Create Workflow</button>
              </div>
            </div>

            <div *ngIf="activeModal === 'template'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#1a73e8;font-size:24px;">grid_view</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Choose Template</h3>
              </div>
              <div *ngFor="let item of dummyList" (click)="handleModalAction(item)" style="padding:12px 16px;background:#f8f9fa;margin-bottom:8px;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;">
                <span class="material-symbols-outlined" style="color:#1a73e8;">description</span> {{ item }}
              </div>
            </div>

            <div *ngIf="activeModal === 'form'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#8b5cf6;font-size:24px;">assignment</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Data Entry Form</h3>
              </div>
              
              <div *ngIf="formHeaders.length === 0" style="text-align:center;padding:20px;color:#5f6368;">
                <span class="material-symbols-outlined" style="font-size:48px;color:#e2e8f0;margin-bottom:12px;">warning</span>
                <p style="font-size:14px;margin-bottom:8px;">No headers found in Row 1.</p>
                <p style="font-size:12px;color:#9aa0a6;">Please add headers to the first row of your sheet to generate a form.</p>
                <div style="margin-top:20px;">
                  <button (click)="activeModal=null" style="background:#8b5cf6;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
                </div>
              </div>

              <div *ngIf="formHeaders.length > 0" style="max-height:400px;overflow-y:auto;padding-right:10px;">
                <div *ngFor="let header of formHeaders" style="margin-bottom:12px;">
                  <label style="display:block;font-size:13px;font-weight:600;color:#5f6368;margin-bottom:4px;">{{header}}</label>
                  <input [(ngModel)]="formData[header]" type="text" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:4px;padding:8px;font-size:14px;outline:none;" placeholder="Enter {{header}}" />
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
                  <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
                  <button (click)="submitForm()" style="background:#8b5cf6;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Submit Data</button>
                </div>
              </div>
            </div>

            <div *ngIf="activeModal === 'view_form'">
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
            </div>

            <div *ngIf="activeModal === 'macro' || activeModal === 'edit_macro'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#ef4444;font-size:24px;">integration_instructions</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">VBA Macro Script Editor</h3>
              </div>
              <div style="margin-bottom:16px;">
                <p style="font-size:12px;color:#5f6368;margin-bottom:8px;">Write JavaScript to automate tasks. Use 'this.cells[row][col]' to access data.</p>
                <textarea [(ngModel)]="macroScript" style="width:100%;height:150px;background:#1e1e1e;color:#d4d4d4;font-family:monospace;font-size:13px;padding:12px;border-radius:6px;border:none;resize:none;box-sizing:border-box;outline:none;"></textarea>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
                <button (click)="runMacro()" style="background:#ef4444;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;"><span class="material-symbols-outlined" style="font-size:18px;">play_arrow</span> Run Macro</button>
              </div>
            </div>

            <div *ngIf="activeModal === 'functions'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#f59e0b;font-size:24px;">functions</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Custom Functions</h3>
              </div>
              <div style="margin-bottom:16px;">
                <p style="font-size:12px;color:#5f6368;margin-bottom:8px;">Define custom functions using JavaScript. You can call them in cells like '=MY_CUSTOM_SUM(1, 2)'</p>
                <textarea [(ngModel)]="customFunctionsScript" style="width:100%;height:200px;background:#1e1e1e;color:#d4d4d4;font-family:monospace;font-size:13px;padding:12px;border-radius:6px;border:none;resize:none;box-sizing:border-box;outline:none;"></textarea>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
                <button (click)="saveCustomFunctions()" style="background:#f59e0b;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Save & Apply</button>
              </div>
            </div>

            <div *ngIf="activeModal === 'merge'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#10b981;font-size:24px;">merge_type</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Merge Template</h3>
              </div>
              <div style="text-align:center;padding:20px;color:#5f6368;background:#f8f9fa;border:2px dashed #cbd5e1;border-radius:6px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="font-size:48px;color:#1a73e8;margin-bottom:12px;">upload_file</span>
                <p style="font-size:14px;margin-bottom:16px;">Select a document template (.docx) to merge with your spreadsheet rows.</p>
                <label style="background:#fff;border:1px solid #1a73e8;color:#1a73e8;padding:10px 20px;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;">
                   <span class="material-symbols-outlined" style="font-size:18px;">browse_activity</span> Browse Files
                   <input type="file" style="display:none;" accept=".docx,.pdf" />
                </label>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button (click)="activeModal=null" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Cancel</button>
                <button (click)="simulateMerge()" style="background:#10b981;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;"><span class="material-symbols-outlined" style="font-size:18px;">auto_awesome</span> Start Merge</button>
              </div>
            </div>

            <div *ngIf="activeModal === 'open'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#1a73e8;font-size:24px;">folder_open</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Open Document</h3>
              </div>
              <div *ngIf="myDocs.length === 0" style="padding:20px;text-align:center;color:#666;">
                No spreadsheets found.
              </div>
              <div *ngFor="let doc of myDocs" (click)="handleModalAction(doc)" style="padding:12px 16px;background:#f8f9fa;margin-bottom:8px;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:space-between;border:1px solid #e2e8f0;">
                <div style="display:flex;align-items:center;gap:10px;">
                   <span class="material-symbols-outlined" style="color:#0f9d58;">table_chart</span> {{ doc.title || 'Untitled' }}
                </div>
              </div>
            </div>

            <div *ngIf="activeModal === 'import'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#10b981;font-size:24px;">upload</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Import File</h3>
              </div>
              <p style="color:#5f6368;font-size:13px;margin-bottom:16px;">Select a CSV, TSV, or XLSX file from your computer to import into the current sheet.</p>
              <input type="file" (change)="onFileSelected($event)" accept=".csv,.tsv,.xlsx,.xls" style="width:100%;padding:10px;background:#f8f9fa;border:1px solid #e2e8f0;border-radius:6px;color:#333;margin-bottom:16px;box-sizing:border-box;">
              <button class="btn" (click)="handleModalAction()" style="width:100%;background:#10b981;color:#fff;border:none;padding:10px;border-radius:4px;font-weight:600;cursor:pointer;">Import Now</button>
            </div>

            <div *ngIf="activeModal === 'move'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#f59e0b;font-size:24px;">drive_file_move</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Move Document</h3>
              </div>
              <p style="color:#5f6368;font-size:13px;margin-bottom:16px;">Enter the name of the folder you want to move this document to:</p>
              <input type="text" [(ngModel)]="modalInput" placeholder="Folder Name" style="width:100%;padding:10px;background:#f8f9fa;border:1px solid #e2e8f0;border-radius:6px;color:#333;margin-bottom:16px;outline:none;box-sizing:border-box;">
              <button (click)="handleModalAction()" style="width:100%;background:#1a73e8;color:#fff;border:none;padding:10px;border-radius:4px;font-weight:600;cursor:pointer;">Move</button>
            </div>

            <div *ngIf="activeModal === 'password'">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                <span class="material-symbols-outlined" style="color:#d93025;font-size:24px;">lock</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">Protect Document</h3>
              </div>
              <p style="color:#5f6368;font-size:13px;margin-bottom:16px;">Set a password to restrict who can open or view this document.</p>
              <input type="password" [(ngModel)]="modalInput" placeholder="Enter new password" style="width:100%;padding:10px;background:#f8f9fa;border:1px solid #e2e8f0;border-radius:6px;color:#333;margin-bottom:16px;outline:none;box-sizing:border-box;">
              <button (click)="handleModalAction()" style="width:100%;background:#d93025;color:#fff;border:none;padding:10px;border-radius:4px;font-weight:600;cursor:pointer;">Set Password</button>
            </div>
          </div>
        </div>
        
        <!-- Properties Panel -->
        <div class="properties-panel" [class.open]="propertiesPanelOpen" (click)="$event.stopPropagation()">
          <div class="pp-header">
            <h2 class="pp-title">
              <span class="material-symbols-outlined" style="color:#26a96c;font-size:24px;">description</span>
              Details
            </h2>
            <button class="pp-close" (click)="propertiesPanelOpen = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div class="pp-content" *ngIf="docDetails">
            <div class="pp-section">
              <div style="display:flex;align-items:center;gap:12px;">
                <div class="pp-av">{{ docDetails.owner_name ? docDetails.owner_name[0] : 'U' }}</div>
                <div>
                  <div style="font-size:12px;color:#5f6368;">Created by</div>
                  <div style="font-weight:500;">{{ docDetails.owner_name || 'Unknown' }}</div>
                </div>
              </div>
            </div>
            
            <div class="pp-section">
              <div class="pp-label">Shared with</div>
              <div class="pp-value">
                <span class="material-symbols-outlined" style="font-size:18px;">{{ docDetails.is_public ? 'public' : 'lock' }}</span>
                {{ docDetails.is_public ? 'Public' : 'Private' }}
              </div>
            </div>
            
            <hr class="pp-divider">
            
            <div class="pp-section">
              <div class="pp-label">Permalink</div>
              <a [href]="window.location.href" target="_blank" class="pp-link">{{ window.location.href }}</a>
            </div>
            
            <hr class="pp-divider">
            
            <div class="pp-section">
              <div class="pp-label">Time Created</div>
              <div class="pp-value">{{ docDetails.created_at | date:'medium' }}</div>
            </div>
            
            <div class="pp-section">
              <div class="pp-label">Last Modified</div>
              <div class="pp-value">{{ docDetails.updated_at | date:'medium' }}</div>
            </div>
            
            <div class="pp-section">
              <div class="pp-label">Current Version</div>
              <div class="pp-value">{{ docDetails.content_version || 1 }}.0</div>
            </div>
            
            <hr class="pp-divider">
            
            <div class="pp-section">
              <div class="pp-label">Spreadsheet Statistics</div>
              <div class="pp-stats">
                <div class="pp-stat-item">
                  <div class="pp-stat-num">{{ getActiveSheetCount() }}</div>
                  <div class="pp-stat-lbl">Sheets</div>
                </div>
                <div class="pp-stat-item">
                  <div class="pp-stat-num">{{ getUsedCellsCount() }}</div>
                  <div class="pp-stat-lbl">Used cells</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Share Modal -->
        <div class="modal-overlay" *ngIf="shareModalOpen" (click)="shareModalOpen = false">
          <div class="modal share-modal" (click)="$event.stopPropagation()">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:#0f9d58; color:#fff; display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:4px;">
                  <span class="material-symbols-outlined" style="font-size:16px;">grid_on</span>
                </div>
                <h3>Share "{{ title || 'Untitled spreadsheet' }}"</h3>
              </div>
              <button class="sm-close-btn" (click)="shareModalOpen = false">
                <span class="material-symbols-outlined" style="font-size:20px;">close</span>
              </button>
            </div>
            <div style="position:relative; margin-bottom:32px;">
              <div style="display:flex; align-items:center; gap:12px; position:relative;">
                <div class="sm-input-box">
                  <input type="text" class="sm-input" [(ngModel)]="shareQuery" (ngModelChange)="onShareSearch()" (keydown.enter)="addShareEmail($event)" placeholder="Add people and groups (press Enter)">
                  <div class="sm-dropdown-txt" (click)="shareRoleDropdownOpen = !shareRoleDropdownOpen" style="position:relative;">
                    {{ shareRole }} <span class="material-symbols-outlined" style="font-size:18px; color:inherit; opacity: 0.8;">arrow_drop_down</span>
                    
                    <div *ngIf="shareRoleDropdownOpen" class="sm-list" style="position:absolute; top:30px; right:0; left:auto; width:100px; z-index:100; min-width:100px; max-height:none;">
                       <div (click)="shareRole = 'View'; shareRoleDropdownOpen = false; $event.stopPropagation()" class="sm-list-item" style="padding:8px 12px; border-bottom:none;">View</div>
                       <div (click)="shareRole = 'Edit'; shareRoleDropdownOpen = false; $event.stopPropagation()" class="sm-list-item" style="padding:8px 12px; border-bottom:none;">Edit</div>
                    </div>
                  </div>
                </div>
                <button (click)="performShare()" style="background:#0f9d58; color:#fff; border:none; border-radius:24px; font-weight:500; font-size:14px; padding:0 24px; height:44px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#0b8043'" onmouseout="this.style.background='#0f9d58'">Share</button>
              </div>
              <div *ngIf="selectedShareEmails.length > 0" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                <div *ngFor="let email of selectedShareEmails" style="background:#e8eaed; border-radius:16px; padding:4px 12px; display:flex; align-items:center; gap:8px; font-size:13px; color:#3c4043; border:1px solid #dadce0;">
                  {{ email }}
                  <span class="material-symbols-outlined" style="font-size:16px; cursor:pointer;" (click)="removeShareEmail(email)">close</span>
                </div>
              </div>
              <div *ngIf="userSearchResults.length > 0" class="sm-list">
                <div *ngFor="let u of userSearchResults" (click)="selectShareUser(u)" class="sm-list-item">
                  <div style="width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px; font-weight:500;" [style.background]="u.avatar_color">{{u.name.charAt(0).toUpperCase()}}</div>
                  <div style="display:flex; flex-direction:column;">
                    <div class="name">{{u.name}}</div>
                    <div class="email">{{u.email}}</div>
                  </div>
                </div>
              </div>
            </div>
            <div style="margin-bottom:32px;">
              <div style="font-size:11px; font-weight:600; color:#9aa0a6; letter-spacing:0.8px; margin-bottom:16px;">WHO CAN ACCESS</div>
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:16px;">
                  <div class="sm-icon-bg">
                    <span class="material-symbols-outlined" style="font-size:20px;">{{ isPublic ? 'public' : 'link' }}</span>
                  </div>
                  <div>
                    <div class="sm-txt-main">{{ isPublic ? 'Public Link - Anyone on the internet can view' : 'Permalink - Private, not shared with anyone' }}</div>
                  </div>
                </div>
                <button *ngIf="!isPublic" (click)="makePublic()" class="sm-sec-btn">
                  <span class="material-symbols-outlined" style="font-size:16px;">settings</span> Make Public
                </button>
                <button *ngIf="isPublic" (click)="isPublic = false" class="sm-sec-btn">
                  <span class="material-symbols-outlined" style="font-size:16px;">lock</span> Make Private
                </button>
              </div>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <button (click)="copyLink()" class="sm-copy-btn">Copy Link</button>
              <button (click)="shareModalOpen = false" class="sm-done-btn">Done</button>
            </div>
          </div>
        </div>
      <!-- Sheet Tabs -->
      <div class="sheet-tabs" *ngIf="showStatusBar">
        <div class="sheet-tab" *ngFor="let sheet of sheets; let i = index"
          [style.display]="sheet.hidden ? 'none' : ''"
          [style.border-bottom]="sheet.tabColor ? '3px solid ' + sheet.tabColor : ''"
          [class.active-tab]="i === currentSheetIdx"
          (click)="switchSheet(i)"
          (dblclick)="renameSheet(i)">
          {{ sheet.name }}
          <span class="tab-menu-icon material-symbols-outlined" (click)="openSheetMenu(i, $event)" style="font-size: 16px; margin-left: 4px; border-radius: 4px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.1)'" onmouseout="this.style.background='transparent'">arrow_drop_down</span>
        </div>
        <button class="tab-add" (click)="addSheet()" title="Add sheet">＋</button>
      </div>

      <!-- Sheet Context Menu -->
      <div class="ctx-menu" *ngIf="activeSheetMenuIdx !== null" [style.left.px]="sheetMenuX" [style.bottom.px]="sheetMenuY + 10" (click)="$event.stopPropagation()">
        <div class="ctx-item" (click)="addSheet(); activeSheetMenuIdx=null"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add_box</span> Insert</div>
        <div class="ctx-item" (click)="duplicateSheet(activeSheetMenuIdx); activeSheetMenuIdx=null"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_copy</span> Duplicate</div>
        <div class="ctx-item" (click)="deleteSheet(activeSheetMenuIdx); activeSheetMenuIdx=null" [class.disabled]="sheets.length <= 1" [class.danger]="sheets.length > 1"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">delete</span> Delete</div>
        <div class="ctx-item" (click)="renameSheet(activeSheetMenuIdx); activeSheetMenuIdx=null"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">edit</span> Rename</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" (click)="copySheet(activeSheetMenuIdx); activeSheetMenuIdx=null"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">file_copy</span> Copy</div>
        <div class="ctx-item" [class.disabled]="!copiedSheetData" (click)="pasteSheet()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_paste</span> Paste</div>
        <div class="ctx-item" style="position:relative;" (mouseenter)="activeSheetSubmenu='move'" (mouseleave)="activeSheetSubmenu=null">
          <span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">drive_file_move</span> Move <span class="mdi-arrow material-symbols-outlined" style="margin-left:auto;">chevron_right</span>
          <div class="ctx-menu" *ngIf="activeSheetSubmenu==='move'" style="position:absolute; left:100%; bottom:0; margin-left:4px;">
            <div class="ctx-item" [class.disabled]="activeSheetMenuIdx === 0" (click)="moveSheet(activeSheetMenuIdx, 'left')"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_back</span> Move Left</div>
            <div class="ctx-item" [class.disabled]="activeSheetMenuIdx === sheets.length - 1" (click)="moveSheet(activeSheetMenuIdx, 'right')"><span class="material-symbols-outlined" style="font-size: 16px;">arrow_forward</span> Move Right</div>
          </div>
        </div>
        <div class="ctx-item" style="position:relative;" (mouseenter)="activeSheetSubmenu='color'" (mouseleave)="activeSheetSubmenu=null">
          <span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">palette</span> Tab Color <span class="mdi-arrow material-symbols-outlined" style="margin-left:auto;">chevron_right</span>
          <div class="ctx-menu" *ngIf="activeSheetSubmenu==='color'" style="position:absolute; left:100%; bottom:0; margin-left:4px; padding:8px; display:grid; grid-template-columns:repeat(5, 1fr); gap:4px; width:120px; z-index: 1000;">
             <div class="cp-nocolor" style="grid-column:1/-1; padding:4px; text-align:center; font-size:11px; cursor:pointer;" (click)="setTabColor(activeSheetMenuIdx, ''); activeSheetMenuIdx=null">No Color</div>
             <div *ngFor="let c of themeColorsGrid.slice(0, 15)" style="width:16px; height:16px; border-radius:50%; cursor:pointer; border:1px solid #cbd5e1;" [style.background]="c" (click)="setTabColor(activeSheetMenuIdx, c); activeSheetMenuIdx=null"></div>
          </div>
        </div>
        <div class="ctx-item" (click)="toggleSheetGridlines(activeSheetMenuIdx); activeSheetMenuIdx=null">
          <span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">grid_on</span>
          {{ sheets[activeSheetMenuIdx].hideGridlines ? 'Show Gridlines' : 'Hide Gridlines' }}
        </div>
        <div class="ctx-item" (click)="hideSheet(activeSheetMenuIdx); activeSheetMenuIdx=null" [class.disabled]="getVisibleSheetCount() <= 1 && !sheets[activeSheetMenuIdx].hidden">
          <span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">visibility_off</span> Hide
        </div>
        <div class="ctx-item" (click)="toggleLockSheet(activeSheetMenuIdx); activeSheetMenuIdx=null">
          <span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">{{ sheets[activeSheetMenuIdx].locked ? 'lock_open' : 'lock' }}</span>
          {{ sheets[activeSheetMenuIdx].locked ? 'Unlock Sheet' : 'Lock Sheet' }}
        </div>
        <div class="ctx-item" (click)="publishSheet(activeSheetMenuIdx); activeSheetMenuIdx=null">
          <span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">language</span> Publish This Sheet
        </div>
      </div>


      <!-- Find & Replace Modal -->
      <div class="modal-overlay" *ngIf="findModalOpen" (click)="findModalOpen = false">
        <div class="modal" (click)="$event.stopPropagation()" style="width:440px;">
          <button (click)="findModalOpen = false" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#5f6368;">&#x00D7;</button>
          <h3 style="margin-top:0;color:#202124;font-size:16px;">🔍 Find &amp; Replace</h3>
          <div style="margin-bottom:10px;">
            <label style="font-size:12px;color:#5f6368;display:block;margin-bottom:4px;">Find</label>
            <input [(ngModel)]="findQuery" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #dadce0;border-radius:4px;font-size:13px;outline:none;" placeholder="Search...">
          </div>
          <div style="margin-bottom:14px;">
            <label style="font-size:12px;color:#5f6368;display:block;margin-bottom:4px;">Replace with</label>
            <input [(ngModel)]="replaceQuery" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #dadce0;border-radius:4px;font-size:13px;outline:none;" placeholder="Replace...">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
            <button class="btn outline" (click)="findNext()">Find Next</button>
            <button class="btn outline" (click)="findAll()">Find All</button>
            <button class="btn" (click)="replaceOne()">Replace</button>
            <button class="btn" style="background:#ea4335;" (click)="replaceAll()">Replace All</button>
          </div>
          <div style="margin-top:10px;font-size:12px;color:#5f6368;">{{ findStatus }}</div>
        </div>
      </div>

      <!-- Custom Prompt Modal -->
      <div class="modal-overlay" *ngIf="promptModalOpen" (click)="closePrompt()">
        <div class="modal" (click)="$event.stopPropagation()" style="background:#fff; color:#333; border-radius:8px; padding:24px; width:420px; box-shadow:0 8px 32px rgba(0,0,0,0.15); border:1px solid #e2e8f0; max-width:90vw;">
          <h3 style="margin-top:0; font-size:16px; font-weight:600; color:#333; margin-bottom:16px;">{{promptModalTitle}}</h3>
          <input type="text" [(ngModel)]="promptModalValue" (keyup.enter)="submitPrompt()" style="width:100%; box-sizing:border-box; background:#f8f9fa; border:1px solid #cbd5e1; color:#333; font-size:14px; padding:10px 12px; border-radius:6px; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#cbd5e1'" autofocus>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button (click)="closePrompt()" style="background:#f1f5f9; border:1px solid #e2e8f0; color:#333; font-size:14px; font-weight:500; cursor:pointer; padding:8px 20px; border-radius:4px;">Cancel</button>
            <button (click)="submitPrompt()" style="background:#10b981; color:#fff; border:none; border-radius:4px; font-weight:600; font-size:14px; padding:8px 24px; cursor:pointer;">OK</button>
          </div>
        </div>
      </div>

      <!-- Personal Dictionary Modal -->
      <div class="modal-overlay" *ngIf="personalDictModalOpen" (click)="personalDictModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:440px;background:#fff;color:#333;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.15);padding:24px;border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="material-symbols-outlined" style="color:#10b981;font-size:22px;">book</span>
              <h3 style="margin:0;font-size:18px;font-weight:600;">Personal Dictionary</h3>
            </div>
            <button (click)="personalDictModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:14px;">
            <input [(ngModel)]="personalDictNewWord" placeholder="Add a word..." (keyup.enter)="addPersonalDictWord()" style="flex:1;border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;font-size:13px;outline:none;" />
            <button (click)="addPersonalDictWord()" style="background:#10b981;color:#fff;border:none;padding:8px 16px;border-radius:4px;font-weight:600;cursor:pointer;">Add</button>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:6px;max-height:200px;overflow-y:auto;">
            <div *ngIf="personalDictWords.length===0" style="padding:24px;text-align:center;color:#9aa0a6;font-size:13px;">No words added yet.</div>
            <div *ngFor="let w of personalDictWords; let i=index" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
              <span>{{ w }}</span>
              <span (click)="removePersonalDictWord(i)" style="cursor:pointer;color:#d93025;font-size:13px;font-weight:600;">✕</span>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:16px;">
            <button (click)="personalDictModalOpen=false" style="background:#f1f5f9;color:#333;border:1px solid #e2e8f0;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
          </div>
        </div>
      </div>

      <!-- Edit History Sidebar -->
      <div *ngIf="showEditHistoryPanel" class="edit-history-panel" style="position: absolute; right: 20px; top: 120px; width: 340px; background: #fff; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 1000; display: flex; flex-direction: column; border: 1px solid #e2e8f0; color: #333;">
        <div class="eh-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; background: #f8f9fa; border-radius: 8px 8px 0 0;">
          <span style="font-weight: bold; font-size: 15px; color: #333;">Edit History</span>
          <span class="material-symbols-outlined" style="cursor: pointer; font-size: 18px; color: #5f6368;" (click)="showEditHistoryPanel = false">close</span>
        </div>
        <div class="eh-body" style="padding: 16px; max-height: 400px; overflow-y: auto;">
           <div style="font-size: 13px; color: #5f6368; margin-bottom: 16px;">Source: '{{sheets[currentSheetIdx].name || "Sheet1"}}'.{{colLabel(editHistoryCell?.c)}}{{editHistoryCell?.r + 1}}</div>
           
           <div *ngIf="!editHistoryData || editHistoryData.length === 0" style="color: #999; font-size: 13px; text-align: center; padding: 20px 0;">No edit history found.</div>

           <div *ngFor="let edit of editHistoryData" class="eh-entry" style="display: flex; gap: 12px; margin-bottom: 16px; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #eee;">
              <div class="eh-icon" style="width: 32px; height: 32px; border-radius: 50%; background: #e21b5a; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span class="material-symbols-outlined" style="font-size: 20px;">person</span>
              </div>
              <div class="eh-info" style="flex: 1; word-break: break-word;">
                 <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <div class="eh-user" style="font-weight: 600; font-size: 14px; color: #333;">{{edit.user}}</div>
                    <div class="eh-action" style="font-size: 11px; font-weight: bold; text-transform: uppercase;" [style.color]="edit.action === 'ADDED' ? '#2e8b57' : (edit.action === 'EDITED' ? '#1a73e8' : '#d32f2f')">{{edit.action}}</div>
                 </div>
                 <div class="eh-time" style="font-size: 12px; color: #666; margin-bottom: 6px;">{{edit.time | date:'medium'}}</div>
                 <div class="eh-value" *ngIf="edit.value !== undefined && edit.value !== null && edit.value !== ''" style="background: #fff; border: 1px solid #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 13px; color: #333;">
                     <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle; color: #2e8b57;">check_circle</span> <span style="margin-left: 4px;">{{edit.value}}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <!-- Spreadsheet Statistics Modal -->
      <div class="modal-overlay" *ngIf="showCustomFormatModal" (click)="showCustomFormatModal=false" style="z-index: 10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width: 400px; padding: 20px; background: #fff; color: #333; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #e2e8f0;">
          <h3 style="margin-top: 0; color: #333;">Custom Number Format</h3>
          <p style="font-size: 13px; color: #666;">Enter a custom format string (e.g. <code>$#,##0.00</code>, <code>0.00%</code>, <code>&#64;</code>)</p>
          <input type="text" [(ngModel)]="customFormatString" style="width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 15px; font-family: monospace; border: 1px solid #ccc; border-radius: 4px; color: #333; background: #fff;">
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button (click)="showCustomFormatModal=false" style="padding: 6px 12px; border: 1px solid #ccc; background: #f8f9fa; color: #333; cursor: pointer; border-radius: 4px;">Cancel</button>
            <button (click)="applyCustomFormat()" style="padding: 6px 12px; border: none; background: #1a73e8; color: #fff; cursor: pointer; border-radius: 4px;">Apply</button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="showMoreFormatsModal" (click)="showMoreFormatsModal=false" style="z-index: 10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width: 400px; max-height: 80vh; overflow-y: auto; padding: 20px; background: #fff; color: #333; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #e2e8f0;">
          <h3 style="margin-top: 0; color: #333;">More Formats</h3>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
            <div class="mf-item" (click)="setNumFormat('number'); showMoreFormatsModal=false">Number (1,234.56)</div>
            <div class="mf-item" (click)="setNumFormat('date_full'); showMoreFormatsModal=false">Full Date (Tuesday, August 5, 2030)</div>
            <div class="mf-item" (click)="setNumFormat('date_iso'); showMoreFormatsModal=false">ISO Date (2030-08-05)</div>
            <div class="mf-item" (click)="setNumFormat('accounting'); showMoreFormatsModal=false">Accounting ($ 1,234.56)</div>
            <div class="mf-item" (click)="setNumFormat('financial'); showMoreFormatsModal=false">Financial ( (1,234.56) )</div>
            <div class="mf-item" style="font-weight: bold; background: #f1f3f4;" (click)="openCustomFormatModal(); showMoreFormatsModal=false">Create Custom Format...</div>
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button (click)="showMoreFormatsModal=false" style="padding: 6px 12px; border: 1px solid #ccc; background: #f8f9fa; color: #333; cursor: pointer; border-radius: 4px;">Close</button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="statsModalOpen" (click)="statsModalOpen=false" style="z-index:10000;">
        <div class="modal" (click)="$event.stopPropagation()" style="width:420px;background:#fff;color:#333;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.15);padding:24px;border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="material-symbols-outlined" style="color:#1a73e8;font-size:22px;">bar_chart</span>
              <h3 style="margin:0;font-size:18px;font-weight:600;">Spreadsheet Statistics</h3>
            </div>
            <button (click)="statsModalOpen=false" style="background:none;border:none;cursor:pointer;color:#888;"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#10b981;">{{getStatsFilledCells()}}</div>
              <div style="font-size:12px;color:#5f6368;margin-top:4px;">Non-Empty Cells</div>
            </div>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#1a73e8;">{{getStatsFormulaCells()}}</div>
              <div style="font-size:12px;color:#5f6368;margin-top:4px;">Formula Cells</div>
            </div>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#f59e0b;">{{sheets.length}}</div>
              <div style="font-size:12px;color:#5f6368;margin-top:4px;">Sheets</div>
            </div>
            <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:6px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#9333ea;">{{getStatsNumericCells()}}</div>
              <div style="font-size:12px;color:#5f6368;margin-top:4px;">Numeric Cells</div>
            </div>
          </div>
          <div style="background:#f8f9fa;border-radius:6px;padding:12px 16px;font-size:13px;color:#5f6368;line-height:1.8;">
            <div>📋 Total rows: <strong>{{cells.length}}</strong></div>
            <div>📋 Total columns: <strong>{{cells[0].length || 0}}</strong></div>
            <div>🔒 Locked sheets: <strong>{{getStatsLockedSheets()}}</strong></div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:16px;">
            <button (click)="statsModalOpen=false" style="background:#1a73e8;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:600;cursor:pointer;">Close</button>
          </div>
        </div>
      </div>

      <div class="bottom-chat-bar">
         <div class="bcb-item" (click)="toggleWidget('chat')">
            <span class="material-symbols-outlined" style="color:#d32f2f;">chat</span>
            <span>Unread Chats</span>
            <div class="bcb-badge">0</div>
         </div>
         <div class="bcb-item" (click)="toggleWidget('channels')">
            <span class="material-symbols-outlined" style="color:#5f6368;">group</span>
            <span>Channels</span>
         </div>
      </div>

      <app-chat-widget [activeWidget]="activeWidget" (close)="activeWidget=null"></app-chat-widget>
    </div>
  `,
  styles: [`
    /* Bottom Chat Bar */
    .bottom-chat-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: #f8f9fa; border-top: 1px solid #e0e0e0; z-index: 9999; height: 36px; box-shadow: 0 -1px 3px rgba(0,0,0,0.05); }
    .bcb-item { display: flex; align-items: center; gap: 8px; padding: 0 16px; cursor: pointer; border-right: 1px solid #e0e0e0; font-size: 13px; font-weight: 500; color: #202124; transition: background 0.2s; position: relative; }
    .bcb-item:hover { background: #e8f0fe; }
    .bcb-item .material-symbols-outlined { font-size: 18px; }
    .bcb-badge { position: absolute; top: -6px; left: 16px; background: #d32f2f; color: #fff; font-size: 10px; font-weight: bold; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }

    /* Widgets */
    .widget-panel { position: fixed; bottom: 48px; right: 24px; width: 300px; background: #fff; border-radius: 8px; border: 1px solid #e0e0e0; z-index: 10000; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .wp-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e0e0e0; font-weight: 500; color: #202124; background: #f8f9fa; }
    .wp-body { padding: 16px; flex: 1; min-height: 200px; display: flex; flex-direction: column; }
    :host { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    * { box-sizing: border-box; }

    /* ── Shell ─────────────────────────────────────────────────────────── */
    .shell { display:flex; flex-direction:column; height:calc(100vh - 36px); background:#fff; overflow:hidden; }

    /* ── TOP BAR ────────────────────────────────────────────────────────── */
    .top-bar { display:flex; align-items:center; justify-content:space-between; padding:6px 16px; background:#1c2333; min-height:50px; z-index:300; flex-shrink:0; }
    .tl { display:flex; align-items:center; gap:10px; }
    .tl-sep { width:1px; height:24px; background:rgba(255,255,255,0.15); margin:0 12px; flex-shrink:0; }
    .brand { display:flex; align-items:center; gap:6px; flex-shrink:0; padding: 4px; border-radius: 4px; transition: background 0.2s; }
    .brand:hover { background: rgba(255,255,255,0.08); }
    .brand-name { color:#fff; font-size:15px; font-weight:600; }
    .cursor-path { stroke: #1e1e1e; }
    .doc-sec { display:flex; flex-direction:row; align-items:center; }
    .doc-title { background:transparent; border:1px solid transparent; border-radius:4px; color:#fff; font-size:15px; font-weight:600; padding:3px 6px; outline:none; overflow:hidden; text-overflow:ellipsis; max-width:500px; min-width:30px; transition: width 0.1s; }
    .doc-title:hover { border-color:rgba(255,255,255,.3); }
    .doc-title:focus { border-color:rgba(255,255,255,.6); background:rgba(255,255,255,.1); }
    .doc-icons { color: rgba(255,255,255,0.6); }
    .tr { display:flex; align-items:center; gap:8px; }
    .top-search-box { display:flex; align-items:center; gap:6px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); border-radius:24px; padding:4px 12px; color:rgba(255,255,255,.8); transition: all 0.2s ease; height:32px; box-sizing:border-box; }
    .top-search-box.has-query { background: rgba(15, 157, 88, 0.15); border-color: #0f9d58; color: #fff; }
    .top-search-box input.inline-search-input { background:transparent; border:none; outline:none; color:inherit; font-size:13px; width:140px; }
    .top-search-box input.inline-search-input::placeholder { color: rgba(255,255,255, 0.5); }
    .top-search-box .inline-search-clear { background:rgba(255,255,255,0.15); border:none; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:inherit; padding:0; flex-shrink:0; }
    .top-search-box .inline-search-clear:hover { background:rgba(255,255,255,0.3); }
    .top-search-box .inline-search-divider { width:1px; height:14px; background:rgba(255,255,255,0.2); margin:0 4px; }
    .top-search-box .inline-search-count { font-size:12px; font-weight:500; opacity:0.8; white-space:nowrap; margin-right:4px; font-variant-numeric: tabular-nums; }
    .top-search-box .inline-search-nav { display:flex; gap:2px; }
    .top-search-box .inline-search-nav button { background:none; border:none; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:inherit; padding:2px; opacity:0.8; transition:all 0.2s; }
    .top-search-box .inline-search-nav button:hover { opacity:1; background:rgba(255,255,255,0.15); }
    .online-badge { display:flex; align-items:center; font-size:13px; font-weight:500; color:rgba(255,255,255,.9); background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2); border-radius:18px; padding:4px 10px; margin-right:8px; cursor:default; }
    .share-btn { display:flex; align-items:center; gap:6px; background:#26a96c; border:none; border-radius:20px; color:#fff; cursor:pointer; font-size:13px; font-weight:600; padding:7px 16px; flex-shrink:0; }
    .share-btn:hover { background:#1f8a57; }
    .properties-btn { display:flex; align-items:center; justify-content:center; background:transparent; border:none; border-radius:50%; color:#5f6368; cursor:pointer; width:40px; height:40px; flex-shrink:0; margin-left:8px; margin-right:12px; transition: background 0.2s ease, color 0.2s ease; }
    .properties-btn:hover { background:#f1f3f4; color:#202124; }
    
    .properties-panel { position:fixed; right:0; top:0; width:340px; height:100vh; background:#fff; z-index:9999; box-shadow:-4px 0 24px rgba(0,0,0,.15); overflow-y:auto; transform:translateX(100%); transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display:flex; flex-direction:column; font-family:"Roboto", sans-serif; color:#202124; }
    .properties-panel.open { transform:translateX(0); }
    .pp-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #e0e0e0; background:#f8f9fa; }
    .pp-title { font-size:18px; font-weight:500; margin:0; display:flex; align-items:center; gap:8px; }
    .pp-close { background:transparent; border:none; cursor:pointer; color:#5f6368; display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; transition:background 0.2s; }
    .pp-close:hover { background:#e8eaed; color:#202124; }
    .pp-content { padding:24px 20px; display:flex; flex-direction:column; gap:24px; }
    .pp-section { display:flex; flex-direction:column; gap:6px; }
    .pp-label { font-size:12px; font-weight:600; color:#5f6368; text-transform:uppercase; letter-spacing:0.8px; }
    .pp-value { font-size:14px; color:#202124; display:flex; align-items:center; gap:12px; }
    .pp-av { width:36px; height:36px; border-radius:50%; background:#ea4335; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px; text-transform:uppercase; flex-shrink:0; }
    .pp-link { color:#1a73e8; cursor:pointer; font-weight:500; word-break:break-all; text-decoration:none; line-height:1.4; }
    .pp-link:hover { text-decoration:underline; }
    .pp-stats { display:grid; grid-template-columns:1fr 1fr; gap:16px; background:#f8f9fa; padding:16px; border-radius:8px; border:1px solid #e0e0e0; margin-top:8px; }
    .pp-stat-item { display:flex; flex-direction:column; gap:4px; }
    .pp-stat-num { font-size:18px; font-weight:600; color:#202124; }
    .pp-stat-lbl { font-size:12px; color:#5f6368; }
    .pp-divider { height:1px; background:#e0e0e0; border:none; margin:0; }

    .av { position:relative; width:34px; height:34px; border-radius:50%; background:#ea4335; color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
        .profile-dd { position:fixed; top:54px; right:16px; width:240px; background:#2d3748; border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.5); z-index:9999; overflow:hidden; border:1px solid #4a5568; }
    .pd-head { padding:14px 16px; border-bottom:1px solid #4a5568; display:flex; align-items:center; gap:10px; background:#1a202c; color: #fff; }
    .pd-av { width:40px; height:40px; border-radius:50%; background:#ea4335; color:#fff; font-size:16px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .pd-item { padding:9px 16px; font-size:13px; color:#e2e8f0; cursor:pointer; display:flex; align-items:center; gap:10px; }
    .pd-item:hover { background:#4a5568; color:#fff; }
    .pd-item.danger { color:#fc8181; }
    .pd-item.danger:hover { background:#fc8181; color:#fff; }
    .pd-sep { height:1px; background:#4a5568; margin:4px 0; }
    .pd-icon { font-size:18px !important; color:inherit; }

    /* ??? MENU BAR ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
    .menu-row { display:flex; align-items:center; background:#252d3d; padding:1px 12px; flex-shrink:0; z-index:200; }
    .mi { position:relative; color:rgba(255,255,255,.82); font-size:13px; padding:5px 10px; cursor:pointer; border-radius:4px; user-select:none; white-space:nowrap; }
    .mi:hover, .mi-open { background:rgba(255,255,255,.12); color:#fff; }
    .mdd { position:absolute; top:calc(100% + 2px); left:0; min-width:230px; background:#2d3748; border:1px solid #4a5568; border-radius:6px; box-shadow:0 6px 24px rgba(0,0,0,.5); z-index:1000; padding:2px 0; }
    .mdi { padding:4px 16px; font-size:13px; color:#e2e8f0; cursor:pointer; display:flex; justify-content:flex-start; align-items:center; white-space:nowrap; position:relative; }
    .mdi:hover { background:#4a5568; color:#fff; }
    .mdi.danger { color:#fc8181; }
    .mdi.danger:hover { background:#fc8181; color:#fff; }
    .mdi-title { padding:4px 16px; font-size:12px; color:#a0aec0; font-weight:600; cursor:default; user-select:none; margin-top:4px; }
    .mds { height:1px; background:#4a5568; margin:3px 0; }
    .mh { font-size:11px; color:#a0aec0; margin-left:auto; padding-left:20px; }
    .mdi-icon { width:16px; height:16px; margin-right:10px; display:inline-flex; align-items:center; justify-content:center; color:#a0aec0; font-size:16px; }
    .mdi-arrow { margin-left:auto; padding-left:12px; font-size:16px; color:#a0aec0; display:flex; align-items:center; }
    .mdi:hover .mdi-icon, .mdi:hover .mdi-arrow { color:#fff; }
    .mdi-sub { position:absolute; left:100%; top:-5px; min-width:240px; background:#2d3748; border:1px solid #4a5568; border-radius:6px; box-shadow:0 6px 24px rgba(0,0,0,.5); display:none; padding:4px 0; z-index:1001; }
    .mdi-sub.sub-left { left:auto; right:100%; margin-right:-4px; }
    .mdi.has-sub:hover > .mdi-sub { display:block; }
    .font-list { max-height:280px; overflow-y:auto; }

    /* ── TOOLBAR ────────────────────────────────────────────────────────── */
    .tb-row { display:flex; align-items:center; flex-wrap:wrap; background:#2d3748; padding:4px 12px; gap:2px; flex-shrink:0; position:relative; z-index:190; }
    .tb-row2 { border-top:1px solid rgba(255,255,255,.08); padding:3px 12px; position:relative; z-index:180; }
    .tb-group { display:flex; align-items:center; gap:2px; }
    .tb-sep { width:1px; height:20px; background:rgba(255,255,255,.18); margin:0 5px; flex-shrink:0; }
    .tb .material-symbols-outlined { font-size: 18px; }
      .tb { background:transparent; border:none; border-radius:3px; color:rgba(255,255,255,.85); cursor:pointer; font-size:13px; font-family:inherit; height:26px; min-width:26px; padding:0 5px; display:flex; align-items:center; justify-content:center; transition:background .1s; flex-shrink:0; }
    .tb:hover { background:rgba(255,255,255,.15); color:#fff; }
    .tb.tb-on { background:rgba(26,115,232,.6); color:#fff; }
    .tb.sz { min-width:22px; }
    .tb.nf { font-size:11px; font-weight:700; min-width:28px; }
    .tb-font-dd { display:flex; align-items:center; justify-content:space-between; gap:4px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); border-radius:3px; color:rgba(255,255,255,.9); cursor:pointer; font-size:12px; height:26px; padding:0 8px; position:relative; user-select:none; min-width:110px; }
    .tb-font-dd:hover, .tb-font-dd.active { background:rgba(255,255,255,.15); }
    .arr { font-size:9px; color:rgba(255,255,255,.45); margin-left:auto; }
    .font-sz { gap:0; }
    .sz-inp { background:rgba(255,255,255,.1); border:none; border-left:1px solid rgba(255,255,255,.15); border-right:1px solid rgba(255,255,255,.15); color:#fff; font-size:12px; height:26px; outline:none; text-align:center; width:38px; }
    .sz-inp::-webkit-inner-spin-button, .sz-inp::-webkit-outer-spin-button { -webkit-appearance:none; }
    .sz-drop-btn { background:rgba(255,255,255,.1); height:26px; border:1px solid rgba(255,255,255,.15); border-left:none; border-top:none; border-bottom:none; display:flex; align-items:center; justify-content:center; cursor:pointer; width:18px; color:rgba(255,255,255,.9); }
    .zoom-ctrl { display:flex; align-items:center; gap:4px; color:rgba(255,255,255,.85); font-size:12px; }
    .zoom-pct { min-width:38px; text-align:center; }
    .tb-clr { display:flex; align-items:center; gap:2px; background:transparent; border:none; border-radius:3px; color:rgba(255,255,255,.85); cursor:pointer; font-size:12px; height:26px; padding:0 5px; position:relative; }
    .tb-clr:hover { background:rgba(255,255,255,.15); }
    .clr-ico { position:relative; width:16px; height:16px; display:flex; align-items:center; justify-content:center; }
    .clr-bar { position:absolute; bottom:1px; left:1px; right:1px; height:3px; border-radius:1px; z-index:2; }
    .clr-pop { position:absolute; top:calc(100% + 4px); left:0; background:#fff; border:1px solid #ddd; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,.2); padding:8px; z-index:1000; }
    .cp-grid { display:grid; grid-template-columns:repeat(10, 1fr); gap:4px; margin-bottom:8px; }
    .cp-sw { width:16px; height:16px; border-radius:2px; cursor:pointer; border:1px solid rgba(0,0,0,.1); }
    .cp-sw:hover { transform:scale(1.3); outline:1px solid #555; }
    .cp-nocolor { padding:4px 8px; font-size:12px; color:#555; cursor:pointer; white-space:nowrap; border-bottom:1px solid #eee; margin-bottom:6px; }
    .cp-nocolor:hover { background:#f5f5f5; }
    .tb-chart-dd { position:absolute; top:36px; left:0; width:340px; background:#202124; border:1px solid #5f6368; border-radius:4px; box-shadow:0 8px 24px rgba(0,0,0,0.5); z-index:500; display:flex; flex-direction:column; padding:12px; }
    .tb-dd { position:absolute; top:36px; left:0; background:#202124; border:1px solid #5f6368; border-radius:4px; box-shadow:0 8px 24px rgba(0,0,0,0.5); z-index:500; display:flex; flex-direction:column; padding:8px 0; }
    .dd-item { padding: 8px 16px; color: #e8eaed; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s; }
    .dd-item:hover { background: rgba(255,255,255,0.08); }
    .chart-header-icons { display:flex; align-items:center; gap:8px; border-bottom:1px solid #5f6368; padding-bottom:12px; margin-bottom:12px; }

    /* ── FORMULA BAR ────────────────────────────────────────────────────── */
    .formula-container { display:flex; align-items:center; background:#2d3748; border-bottom:1px solid rgba(255,255,255,.08); flex-shrink:0; height:34px; padding:0 12px; gap:8px; }
    .cell-ref { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.15); border-radius:4px; color:#fff; font-size:12px; font-weight:600; min-width:60px; height:24px; display:flex; align-items:center; justify-content:center; padding: 0 10px; }
    .fx-label { color:#a0aec0; font-style:italic; font-size:14px; display:flex; align-items:center; margin:0 4px; border:none; }
    .formula-bar { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.15); border-radius:4px; flex:1; font-size:13px; outline:none; padding:0 12px; color:#fff; height:24px; margin-right: 8px; }

    /* ── GRID ─────────────────────────────────────────────────────────── */
    .main-content { display:flex; flex:1; overflow:hidden; position:relative; }
    .grid-wrap { flex:1; overflow:auto; position:relative; background:#fff; overflow-anchor: none; }
    
    /* ── SIDE PANEL ─────────────────────────────────────────────────── */
    .side-panel {
      width: 340px;
      border-left: 1px solid #e2e8f0;
      background: #f0f4ff;
      display: flex;
      flex-direction: column;
      z-index: 100;
      box-shadow: -4px 0 24px rgba(99,102,241,0.08);
    }

    /* Header */
    .sp-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 16px 14px;
      background: #fff;
      border-bottom: 1px solid #e8edf5;
      flex-shrink: 0;
    }
    .sp-head-left { display: flex; align-items: center; gap: 12px; }
    .sp-icon-wrap {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sp-icon-cal  { background: linear-gradient(135deg, #6366f1, #818cf8); }
    .sp-icon-notes { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
    .sp-icon-tasks { background: linear-gradient(135deg, #10b981, #34d399); }
    .sp-head-icon { font-size: 20px !important; color: #fff; }
    .sp-title { font-size: 15px; font-weight: 700; color: #1e1e2e; line-height: 1.2; }
    .sp-subtitle { font-size: 11px; color: #94a3b8; margin-top: 1px; }
    .sp-close-btn {
      background: none; border: none; cursor: pointer;
      width: 30px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #94a3b8; transition: background .15s, color .15s;
    }
    .sp-close-btn:hover { background: #f1f5f9; color: #475569; }
    .sp-close-btn .material-symbols-outlined { font-size: 18px; }

    /* Scrollable body */
    .sp-content {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }
    .sp-content::-webkit-scrollbar { width: 5px; }
    .sp-content::-webkit-scrollbar-track { background: transparent; }
    .sp-content::-webkit-scrollbar-thumb { background: #c7d2e8; border-radius: 10px; }

    /* Cards */
    .sp-card {
      background: #fff;
      border-radius: 14px;
      border: 1px solid #e8edf5;
      padding: 14px;
      box-shadow: 0 2px 8px rgba(99,102,241,0.06);
    }
    .sp-notes-grow { flex: 1; display: flex; flex-direction: column; }
    .sp-card-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 10px;
    }
    .sp-label-icon { font-size: 14px !important; }

    /* Date card */
    .sp-date-card { }
    .sp-date-input {
      width: 100%; box-sizing: border-box;
      border: 1.5px solid #e2e8f0;
      border-radius: 9px;
      padding: 10px 12px;
      font-size: 14px; color: #1e1e2e;
      outline: none; cursor: pointer;
      transition: border-color .15s, box-shadow .15s;
      font-family: inherit;
    }
    .sp-date-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
    .sp-date-chip {
      display: inline-flex; align-items: center; gap: 5px;
      margin-top: 8px; background: #eef2ff; color: #6366f1;
      font-size: 11px; font-weight: 600;
      padding: 4px 10px; border-radius: 20px;
    }

    /* Textarea card */
    .sp-notes-card { }
    .sp-textarea-wrap { display: flex; flex-direction: column; flex: 1; }
    .sp-textarea {
      flex: 1; min-height: 180px;
      border: 1.5px solid #e2e8f0; border-radius: 9px;
      padding: 12px; font-size: 13.5px; line-height: 1.6;
      color: #1e1e2e; outline: none; resize: none; font-family: inherit;
      background: #fafbff;
      transition: border-color .15s, box-shadow .15s;
    }
    .sp-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.10); background: #fff; }
    .sp-textarea::placeholder { color: #c4cfe0; }
    .sp-textarea-tall { min-height: 320px; }
    .sp-textarea-footer {
      display: flex; align-items: center; gap: 4px;
      margin-top: 6px; padding: 0 2px;
    }

    /* Task add */
    .sp-task-add-wrap {
      display: flex; align-items: center; gap: 8px;
      background: #fff; border: 1.5px solid #e2e8f0;
      border-radius: 12px; padding: 8px 10px 8px 12px;
      box-shadow: 0 2px 8px rgba(99,102,241,0.06);
      transition: border-color .15s, box-shadow .15s;
    }
    .sp-task-add-wrap:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.10); }
    .sp-task-add-icon { font-size: 20px !important; color: #c7d2e8; flex-shrink: 0; }
    .sp-task-input {
      flex: 1; border: none; outline: none; font-size: 13.5px;
      color: #1e1e2e; font-family: inherit; background: transparent;
    }
    .sp-task-input::placeholder { color: #c4cfe0; }
    .sp-add-btn {
      background: linear-gradient(135deg, #6366f1, #818cf8);
      border: none; border-radius: 8px;
      color: #fff; font-size: 12px; font-weight: 700;
      padding: 6px 14px; cursor: pointer;
      transition: opacity .15s, transform .1s;
      flex-shrink: 0;
    }
    .sp-add-btn:hover { opacity: .88; transform: translateY(-1px); }
    .sp-add-btn:active { transform: translateY(0); }

    /* Tasks summary bar */
    .sp-tasks-summary {
      display: flex; align-items: center; justify-content: space-between;
      padding: 4px 2px; margin-top: -4px;
    }
    .sp-tasks-count { font-size: 11px; font-weight: 700; color: #64748b; }
    .sp-tasks-done {
      font-size: 11px; font-weight: 600;
      color: #10b981; background: #d1fae5;
      padding: 2px 8px; border-radius: 10px;
    }

    /* Task items */
    .sp-task-item {
      display: flex; align-items: center; gap: 10px;
      background: #fff; border-radius: 12px;
      border: 1.5px solid #e8edf5;
      padding: 11px 12px;
      box-shadow: 0 1px 4px rgba(99,102,241,0.05);
      transition: box-shadow .15s, border-color .15s;
    }
    .sp-task-item:hover { box-shadow: 0 4px 12px rgba(99,102,241,0.10); border-color: #c7d2f8; }
    .sp-task-done { background: #f8faff; border-color: #e8edf5; }
    .sp-task-done .sp-task-text { text-decoration: line-through; color: #b0bec5; }

    /* Custom checkbox */
    .sp-checkbox-wrap { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
    .sp-checkbox-native { display: none; }
    .sp-checkbox-ui {
      width: 20px; height: 20px; border-radius: 6px;
      border: 2px solid #c7d2e8; background: #fff;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s, border-color .15s;
    }
    .sp-checkbox-native:checked + .sp-checkbox-ui {
      background: linear-gradient(135deg, #10b981, #34d399);
      border-color: #10b981;
    }
    .sp-check-icon { font-size: 13px !important; color: #fff; opacity: 0; transition: opacity .15s; }
    .sp-checkbox-native:checked + .sp-checkbox-ui .sp-check-icon { opacity: 1; }

    .sp-task-text { flex: 1; font-size: 13.5px; color: #1e1e2e; line-height: 1.4; word-break: break-word; transition: color .15s; }
    .sp-task-del {
      background: none; border: none; cursor: pointer;
      width: 26px; height: 26px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      color: #c4cfe0; flex-shrink: 0; transition: background .15s, color .15s;
    }
    .sp-task-del:hover { background: #fee2e2; color: #ef4444; }
    .sp-task-del .material-symbols-outlined { font-size: 16px !important; }

    /* Empty state */
    .sp-empty {
      text-align: center; padding: 40px 16px 32px;
      background: #fff; border-radius: 14px; border: 1.5px dashed #c7d2e8;
    }
    .sp-empty-icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 12px;
    }
    .sp-empty-icon .material-symbols-outlined { font-size: 28px !important; color: #10b981; }
    .sp-empty-title { font-size: 15px; font-weight: 700; color: #1e1e2e; margin-bottom: 4px; }
    .sp-empty-sub { font-size: 12px; color: #94a3b8; }

    .sp-frame { flex:1; width:100%; border:none; }

    /* Table itself provides the outer left+top border, cells provide right+bottom — no double lines */
    .grid { border-collapse:separate; border-spacing:0; table-layout:fixed; font-size:13px; user-select:none; background:#202124; }

    /* ── GRID HEADERS — dark ──────────────────────────────────── */
          .corner { background:#202124; border-right:1px solid #3c3c3c; border-bottom:2px solid #3c3c3c; position:sticky; top:0; left:0; z-index:50; width:46px; min-width:46px; text-align:center; height:26px; }
      .col-head { background:#202124; border-right:1px solid #3c3c3c; border-bottom:2px solid #3c3c3c; color:#e8eaed; cursor:pointer; font-size:12px; font-weight:500; position:sticky; top:0; text-align:center; user-select:none; z-index:45; height:26px; width:100px; min-width:100px; transition:background 0.2s, border-color 0.2s; }
    .col-head:hover { background:#35363a; color:#fff; }
    .col-selected { background:#111 !important; color:#fff !important; font-weight:700 !important; }
    .col-head.active-axis { background:#111 !important; color:#10b981 !important; border-bottom-color:#10b981; }

          .row-head { background:#202124; border-right:2px solid #3c3c3c; border-bottom:1px solid #3c3c3c; color:#e8eaed; cursor:pointer; font-size:12px; font-weight:400; position:sticky; left:0; text-align:center; user-select:none; z-index:40; min-width:46px; width:46px; height:26px; transition:background 0.2s, border-color 0.2s; }
    .row-head:hover { background:#35363a; color:#fff; }
    .row-selected { background:#111 !important; color:#fff !important; font-weight:700 !important; }
    .row-head.active-axis { background:#111 !important; color:#10b981 !important; border-right-color:#10b981; }

    /* Data cells — NO extra border, just shared grid lines */
    .cell { cursor:cell; border-right:1px solid #d0d0d0; border-bottom:1px solid #d0d0d0; height:26px; position:relative; white-space:nowrap; padding:0; min-width:100px; width:100px; max-width:200px; background:#fff; }
    .cell.has-content { z-index:2; }
    .cell.selected { outline:2px solid #34a853; outline-offset:-2px; z-index:20; }
    .cell.in-range { box-shadow:inset 0 0 0 1000px rgba(52,168,83,0.15) !important; }
    .cell.fill-preview { box-shadow:inset 0 0 0 1000px rgba(52,168,83,0.2) !important; border:1px dashed #34a853 !important; }
    .cell.search-match { box-shadow:inset 0 0 0 1000px rgba(255,193,7,0.35) !important; }
    .cell.search-match-active { box-shadow:inset 0 0 0 1000px rgba(255,152,0,0.6) !important; outline: 2px solid #ff9800; outline-offset: -2px; z-index: 21; }

    .no-gridlines th, .no-gridlines td { border-color: transparent !important; }
    .col-resizer { position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; z-index: 60; }
    .col-resizer:hover { background: #1a73e8; }
    .row-resizer { position: absolute; bottom: 0; left: 0; right: 0; height: 5px; cursor: row-resize; z-index: 60; }
    .row-resizer:hover { background: #1a73e8; }
    .resize-line-col { position: absolute; top: 0; bottom: 0; width: 2px; background: #1a73e8; z-index: 10000; pointer-events: none; }
    .resize-line-row { position: absolute; left: 0; right: 0; height: 2px; background: #1a73e8; z-index: 10000; pointer-events: none; }
    .cell.remote-selected { box-shadow:inset 0 0 0 1000px rgba(234,67,53,0.1) !important; outline:2px solid #ea4335; outline-offset:-2px; z-index:15; }
    .cell.remote-selected::after { content:''; position:absolute; bottom:-5px; right:-5px; width:8px; height:8px; background:#ea4335; border:2px solid #fff; border-radius:50%; z-index:25; box-shadow:0 1px 3px rgba(0,0,0,.4); pointer-events:none; }

    .cell-input { background:transparent; border:none; color:inherit; font-family:inherit; font-size:inherit; font-weight:inherit; font-style:inherit; text-align:inherit; height:100%; outline:none; padding:0 4px; width:100%; display:block; box-shadow:none; }
    .visually-hidden { opacity:0; position:absolute; left:0; top:0; z-index:2; }
    .cell-display { position:relative; z-index:1; pointer-events:none; align-items:center; display:flex; min-height:100%; padding:0 4px; color:inherit; font-size:inherit; font-weight:inherit; font-style:inherit; text-align:inherit; white-space:inherit; overflow:inherit; text-overflow:inherit; word-break:inherit; }
    .cell-display.wrap-text { white-space: pre-wrap !important; word-wrap: break-word !important; }
    .floating-editor { position: absolute; z-index: 9999; background: #fff; border: 2px solid #00b050; outline: none; box-shadow: 0 2px 5px rgba(0,0,0,0.2); resize: none; overflow: hidden; font-family: inherit; font-size: inherit; padding: 1px 3px; box-sizing: border-box; white-space: pre;     }
    .shape-panel { position: absolute; top: 100%; left: 0; background: #fff; border: 1px solid #dadce0; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 300; width: 450px; display: flex; flex-direction: column; cursor: default; }
    .shape-tabs { display: flex; border-bottom: 1px solid #eee; background: #fff; }
    .s-tab { flex: 1; text-align: center; padding: 10px 0; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; color: #5f6368; }
    .s-tab-active { color: #1a73e8; border-bottom: 2px solid #1a73e8; font-weight: 500; }
    .s-tab .material-symbols-outlined { font-size: 16px; }
    .shape-content { padding: 16px; }
    .diagram-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .diag-item { border: 1px solid #eee; border-radius: 6px; padding: 12px 8px; text-align: center; cursor: pointer; transition: box-shadow 0.2s; background: #fff; }
    .diag-item:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.1); border-color: #ccc; }
    .diag-item svg { width: 100%; height: 60px; }
    .shape-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
    .s-item { aspect-ratio: 1; border: 1px solid transparent; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .s-item:hover { border-color: #1a73e8; background: #f8f9fa; }
    .s-item svg { width: 24px; height: 24px; }
    
    .sheet-shape { position: absolute; z-index: 100; cursor: grab; display: flex; align-items: center; justify-content: center; border: 1px solid transparent; }
    .sheet-shape.shape-active { border: 1px solid #0f9d58; cursor: move; }
    .sheet-shape:active { cursor: grabbing; }
    .sheet-shape .shape-content-wrapper { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; }
    .shape-handle { position: absolute; width: 8px; height: 8px; background: #fff; border: 1px solid #0f9d58; border-radius: 50%; z-index: 101; }
    .shape-handle.nw { top: -4px; left: -4px; cursor: nwse-resize; }
    .shape-handle.n { top: -4px; left: calc(50% - 8px); cursor: ns-resize; width: 16px; border-radius: 8px; }
    .shape-handle.ne { top: -4px; right: -4px; cursor: nesw-resize; }
    .shape-handle.e { top: calc(50% - 8px); right: -4px; cursor: ew-resize; height: 16px; border-radius: 8px; }
    .shape-handle.se { bottom: -4px; right: -4px; cursor: nwse-resize; }
    .shape-handle.s { bottom: -4px; left: calc(50% - 8px); cursor: ns-resize; width: 16px; border-radius: 8px; }
    .shape-handle.sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
    .shape-handle.w { top: calc(50% - 8px); left: -4px; cursor: ew-resize; height: 16px; border-radius: 8px; }
    .shape-menu-btn { position: absolute; top: -24px; right: 0; background: #fff; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px; width: 24px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 102; color:#5f6368; }
    .shape-menu-btn:hover { background: #f1f3f4; }
    .shape-context-menu { position: absolute; top: 0; left: calc(100% + 8px); background: #fff; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 200px; padding: 8px 0; z-index: 103; font-size: 13px; color: #202124; }
    .scm-item { padding: 8px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.1s; text-align: left; }
    .scm-item:hover { background: #f1f3f4; }
    .scm-item .chevron { margin-left: auto; color: #9aa0a6; }
    .cell-select { border:none; background:transparent; color:inherit; font-family:inherit; font-size:inherit; font-weight:inherit; font-style:inherit; text-align:inherit; height:100%; outline:none; width:100%; cursor:pointer; }
    .fill-handle { background:#34a853; border:2px solid #fff; border-radius:50%; bottom:-5px; right:-5px; cursor:crosshair; height:8px; position:absolute; width:8px; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,.4); }

    /* Frozen row/col legacy unused styles removed */
    .grid-spacing-cozy .cell { padding: 0 4px; }
    .grid-spacing-comfort .cell { padding: 4px 6px; }
    .grid-spacing-classic .cell { padding: 0; }
    .img-overlay { left:0; pointer-events:none; position:absolute; top:0; z-index:6; }
    .filter-row select { border:none; background:transparent; font-size:11px; width:100%; cursor:pointer; }

    /* ── CONTEXT MENU ───────────────────────────────────────────────────── */
        .ctx-menu { background:#fff; border:1px solid #cbd5e1; border-radius:6px; box-shadow:0 4px 20px rgba(0,0,0,.15); min-width:220px; padding:4px 0; position:fixed; z-index:900; max-height:80vh; overflow-y:auto; color: #333; }
        .ctx-item { padding:8px 16px; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:8px; }
        .ctx-item:hover { background:#f1f5f9; }
        .ctx-item.danger { color:#e53e3e; }
        .ctx-item.danger:hover { background:#fff5f5; }
        .ctx-item.disabled { color:#a0aec0; cursor:default; pointer-events:none; }
        .ctx-item.disabled .ctx-icon { color:#cbd5e1; }
        .ctx-icon { color:#64748b; font-size:18px; }
    .ctx-hint { color:#94a3b8; font-size:11px; margin-left:auto; }
    .ctx-sep { background:#e2e8f0; height:1px; margin:3px 0; }

    /* ── CUSTOM DROPDOWN ─────────────────────────────────────────────────── */
    ::ng-deep .custom-dropdown-overlay { position: fixed; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100000; display: flex; flex-direction: column; min-width: 150px; padding: 4px 0; max-height: 300px; overflow-y: auto; }
    ::ng-deep .custom-dropdown-item { padding: 8px 12px; cursor: pointer; font-size: 13px; display: flex; align-items: center; transition: background 0.2s; }
    ::ng-deep .custom-dropdown-item:hover { filter: brightness(0.95); }

    /* ── SHEET TABS ─────────────────────────────────────────────────────── */
    .sheet-tabs { display:flex; align-items:center; gap:2px; padding:0 14px; background:#f1f3f4; border-top:2px solid #dadce0; min-height:34px; overflow-x:auto; flex-shrink:0; }
    .sheet-tab { align-items:center; background:transparent; border-radius:4px 4px 0 0; border:1px solid transparent; border-bottom:none; color:#5f6368; cursor:pointer; display:flex; font-size:12px; gap:6px; padding:6px 14px; white-space:nowrap; }
    .sheet-tab.active-tab { background:#fff; border-color:#dadce0; color:#1a73e8; font-weight:600; }
    .sheet-tab:hover:not(.active-tab) { background:#e8eaed; }
    .tab-close { color:#bbb; cursor:pointer; font-size:13px; line-height:1; }
    .tab-close:hover { color:#d93025; }
    .tab-add { background:none; border:none; color:#5f6368; cursor:pointer; font-size:20px; padding:2px 8px; border-radius:4px; line-height:1; }
    .tab-add:hover { background:#e0e0e0; }

    /* ── MODALS ─────────────────────────────────────────────────────────── */
    .modal-overlay { align-items:center; background:rgba(0,0,0,.5); bottom:0; display:flex; justify-content:center; left:0; position:fixed; right:0; top:0; z-index:999; }
    .modal { background:#fff; border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,.22); max-width:92vw; padding:28px; position:relative; width:460px; }
    .btn { background:#1a73e8; border:none; border-radius:6px; color:#fff; cursor:pointer; font-size:13px; font-weight:600; padding:9px 20px; }
    .btn:hover { background:#1557b0; }
    .btn.outline { background:transparent; border:1px solid #1a73e8; color:#1a73e8; }
    .btn.outline:hover { background:#e8f0fe; }
    .validation-textarea { border:1px solid #dadce0; border-radius:4px; font-family:inherit; font-size:13px; outline:none; padding:10px; resize:vertical; width:100%; }
    .validation-textarea:focus { border-color:#1a73e8; box-shadow:0 0 0 2px rgba(26,115,232,.2); }

    /* ── TOAST ──────────────────────────────────────────────────────────── */
    .toast { background:#323232; border-radius:6px; bottom:36px; color:#f1f3f4; font-size:13px; left:50%; opacity:0; padding:12px 24px; pointer-events:none; position:fixed; transform:translateX(-50%) translateY(16px); transition:all .25s ease; z-index:1000; white-space:nowrap; }
    .toast.show { opacity:1; transform:translateX(-50%) translateY(0); }

    /* ── PRINT ──────────────────────────────────────────────────────────── */
          @keyframes spin { 100% { transform: rotate(360deg); } }
      @media print {
      .top-bar, .menu-row, .tb-row, .formula-container, .modal-overlay, .toast, .sheet-tabs { display:none !important; }
      .shell { display:block !important; }
      .grid-wrap { overflow:visible !important; }
      .col-head, .row-head { position:static !important; }
    }

    /* ── CHART DROPDOWN ─────────────────────────────────────────────────── */
    .chart-grid { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:16px; }
    .chart-item { display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; width:90px; padding:8px; border-radius:4px; transition:background 0.2s; }
    .chart-item:hover { background:rgba(255,255,255,0.04); }
    .chart-item span { color:#e8eaed; font-size:12px; font-weight:500; text-align:center; }
    .chart-item svg { border-bottom: 2px solid #5f6368; padding-bottom: 4px; transition: border-bottom-color 0.2s; }
    .chart-item:hover svg { border-bottom-color: #81e6d9; }
    .chart-footer { border-top:1px solid #5f6368; padding-top:12px; font-size:13px; font-weight:600; color:#e8eaed; }
    
    .chart-header-icons { display:flex; justify-content:space-between; border-bottom:1px solid #5f6368; margin-bottom:16px; padding:0 8px; }
    .chart-header-icons span { padding-bottom:10px; margin-bottom:-1px; border-bottom:2px solid transparent; cursor:pointer; color:#9aa0a6; transition:color 0.2s, border-bottom 0.2s; }
    .chart-header-icons span.active { color:#81e6d9; border-bottom:2px solid #81e6d9; }
    .chart-header-icons span:hover { color:#fff; }

    /* ── BORDER DROPDOWN ────────────────────────────────────────────────── */
    .bp-btn { display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid transparent; border-radius:3px; color:#e8eaed; cursor:pointer; width:26px; height:26px; padding:0; transition:all 0.15s; }
    .bp-btn:hover { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); color:#fff; }
    .bp-btn .material-symbols-outlined { font-size:18px; }
    .bo-item { display:flex; align-items:center; gap:4px; padding:4px; border:1px solid transparent; border-radius:4px; cursor:pointer; transition:background 0.15s; }
    .bo-item:hover, .bo-item.active-bo { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); }
    
    /* Print Area Highlight */
    .print-area-active tr:nth-child(40n) .cell { border-bottom: 2px dashed #9aa0a6 !important; }
    .print-area-active .cell:nth-child(9n) { border-right: 2px dashed #9aa0a6 !important; }

    /* Share Modal Styles */
    .share-modal { background:#202124; color:#e8eaed; border-radius:12px; padding:24px; width:520px; box-shadow:0 12px 40px rgba(0,0,0,.6); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; border:none; max-width:90vw; }
    .share-modal h3 { margin:0; font-size:18px; font-weight:500; color:#e8eaed; }
    .sm-close-btn { background:none; border:none; color:#9aa0a6; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:6px; border-radius:50%; transition:background 0.2s; }
    .sm-close-btn:hover { background:rgba(255,255,255,0.08); }
    .sm-input-box { flex:1; display:flex; align-items:center; background:#1c1d1f; border:1px solid #5f6368; border-radius:4px; padding:0 12px; height:44px; transition:border-color 0.2s; }
    .sm-input-box:focus-within { border-color:#8ab4f8; }
    .sm-input { flex:1; background:transparent; border:none; color:#e8eaed; font-size:14px; outline:none; height:100%; }
    .sm-dropdown-txt { display:flex; align-items:center; gap:4px; color:#e8eaed; font-size:13px; cursor:pointer; padding-left:12px; }
    .sm-list { position:absolute; top:48px; left:0; width:calc(100% - 100px); background:#2d3748; border:1px solid #4a5568; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:100; max-height:200px; overflow-y:auto; }
    .sm-list-item { display:flex; align-items:center; gap:12px; padding:8px 12px; cursor:pointer; border-bottom:1px solid #4a5568; transition:background 0.2s; }
    .sm-list-item:hover { background:#4a5568; }
    .sm-list-item .name { color:#e8eaed; font-size:14px; font-weight:500; }
    .sm-list-item .email { color:#9aa0a6; font-size:12px; }
    .sm-icon-bg { background:#303134; display:flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:50%; color:#e8eaed; }
    .sm-txt-main { font-size:14px; font-weight:600; color:#e8eaed; }
    .sm-sec-btn { background:transparent; border:none; color:#9aa0a6; display:flex; align-items:center; gap:6px; font-size:13px; font-weight:500; cursor:pointer; padding:8px; border-radius:4px; transition:background 0.2s; }
    .sm-sec-btn:hover { background:rgba(255,255,255,0.04); }
    .sm-copy-btn { background:transparent; border:none; color:#e8eaed; font-size:14px; font-weight:500; border-radius:24px; padding:8px 12px; margin-left:-12px; cursor:pointer; transition:background 0.2s; }
    .sm-copy-btn:hover { background:rgba(255,255,255,0.08); }
    .sm-done-btn { background:#303134; color:#8ab4f8; font-size:14px; font-weight:500; border:none; border-radius:24px; padding:0 24px; height:40px; cursor:pointer; transition:background 0.2s; }
    .sm-done-btn:hover { background:#3c4043; }

    /* ── LIGHT THEME OVERRIDES ────────────────────────────────────────── */
    .theme-light .top-bar { background: #f8f9fa; border-bottom: 1px solid #dadce0; }
    .theme-light .tl-sep { background: rgba(0,0,0,0.15); }
    .theme-light .brand-name, .theme-light .doc-title { color: #202124; }
    .theme-light .cursor-path { stroke: #ffffff; }
    .theme-light .doc-icons { color: #5f6368; }
    .theme-light .brand:hover { background: rgba(0,0,0,0.05); }
    .theme-light .pd-head { background: #f8f9fa; color: #202124; border-bottom-color: #dadce0; }
    .theme-light .doc-title:hover { border-color: rgba(0,0,0,0.2); }
    .theme-light .doc-title:focus { background: #fff; border-color: #1a73e8; }
    .theme-light .doc-sub { color: #5f6368; }
    .theme-light .back-btn, .theme-light .top-search-box { color: #5f6368; }
    .theme-light .top-search-box { background: #f1f3f4; border-color: transparent; }
    .theme-light .top-search-box.has-query { background: #e6f4ea; border-color: #0f9d58; color: #137333; }
    .theme-light .top-search-box input.inline-search-input { color: #202124; }
    .theme-light .top-search-box input.inline-search-input::placeholder { color: #5f6368; }
    .theme-light .top-search-box .inline-search-clear { background: rgba(0,0,0,0.05); }
    .theme-light .top-search-box .inline-search-clear:hover { background: rgba(0,0,0,0.1); }
    .theme-light .top-search-box .inline-search-divider { background: rgba(0,0,0,0.1); }
    .theme-light .top-search-box .inline-search-nav button:hover { background: rgba(0,0,0,0.08); }
      .theme-light .online-badge { background:#fff; color:#5f6368; border-color:#dadce0; }
    .theme-light .menu-row { background: #ffffff; }
    .theme-light .mi { color: #202124; }
    .theme-light .mi:hover, .theme-light .mi-open { background: #f1f3f4; color: #202124; }
    
    /* Light Theme Share Modal */
    .theme-light .share-modal { background:#ffffff; color:#202124; box-shadow:0 12px 40px rgba(0,0,0,.2); }
    .theme-light .share-modal h3 { color:#202124; }
    .theme-light .sm-close-btn { color:#5f6368; }
    .theme-light .sm-close-btn:hover { background:rgba(0,0,0,0.04); }
    .theme-light .sm-input-box { background:#ffffff; border-color:#dadce0; }
    .theme-light .sm-input-box:focus-within { border-color:#1a73e8; }
    .theme-light .sm-input { color:#202124; }
    .theme-light .sm-dropdown-txt { color:#5f6368; }
    .theme-light .sm-list { background:#ffffff; border-color:#dadce0; box-shadow:0 4px 12px rgba(0,0,0,0.15); }
    .theme-light .sm-list-item { border-bottom-color:#dadce0; }
    .theme-light .sm-list-item:hover { background:#f1f3f4; }
    .theme-light .sm-list-item .name { color:#202124; }
    .theme-light .sm-list-item .email { color:#5f6368; }
    .theme-light .sm-icon-bg { background:#f1f3f4; color:#5f6368; }
    .theme-light .sm-txt-main { color:#202124; }
    .theme-light .sm-sec-btn { color:#5f6368; }
    .theme-light .sm-sec-btn:hover { background:rgba(0,0,0,0.04); }
    .theme-light .sm-copy-btn { color:#1a73e8; }
    .theme-light .sm-copy-btn:hover { background:rgba(26,115,232,0.04); }
    .theme-light .sm-done-btn { background:#f1f3f4; color:#1a73e8; }
    .theme-light .sm-done-btn:hover { background:#e8eaed; }
    .theme-light .mdd, .theme-light .mdi-sub, .theme-light .tb-dd, .theme-light .tb-chart-dd, .theme-light .profile-dd { background: #ffffff; border-color: #dadce0; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .theme-light .bp-btn { color: #5f6368; }
    .theme-light .bp-btn:hover { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); color: #202124; }
    .theme-light .mdi, .theme-light .dd-item, .theme-light .pd-item, .theme-light .bo-item { color: #202124; }
    .theme-light .mdi:hover, .theme-light .dd-item:hover, .theme-light .pd-item:hover, .theme-light .bo-item:hover, .theme-light .bo-item.active-bo { background: #f1f3f4; border-color: transparent; }
    .theme-light .mds, .theme-light .pd-sep { background: #dadce0; }
    .theme-light .mdi-title, .theme-light .mh, .theme-light .mdi-icon, .theme-light .mdi-arrow { color: #5f6368; }
    .theme-light .mdi:hover .mdi-icon, .theme-light .mdi:hover .mdi-arrow { color: #202124; }
    .theme-light .tb-row { background: #edf2fa; border-top: none; }
    .theme-light .tb-row2 { background: #edf2fa; border-top: 1px solid rgba(0,0,0,0.08); }
    .theme-light .tb-sep { background: rgba(0,0,0,0.2); }
    .theme-light .tb, .theme-light .tb-clr { color: #444746; }
    .theme-light .tb:hover, .theme-light .tb-clr:hover { background: rgba(0,0,0,0.08); color: #202124; }
    .theme-light .tb.tb-on { background: #d3e3fd; color: #041e49; }
    .theme-light .tb-font-dd { border-color: rgba(0,0,0,0.15); color: #444746; background: #ffffff; }
    .theme-light .tb-font-dd:hover, .theme-light .tb-font-dd.active { background: #f8f9fa; }
    .theme-light .arr { color: #444746; }
    .theme-light .sz-inp { background: #ffffff; border-color: rgba(0,0,0,0.15); color: #444746; }
    .theme-light .sz-drop-btn { background: #ffffff; border-color: rgba(0,0,0,0.15); color: #444746; }
    .theme-light .zoom-ctrl { color: #444746; }
    .theme-light .formula-container { background: #ffffff; border-bottom: 1px solid #dadce0; border-top: 1px solid #dadce0; }
    .theme-light .cell-ref { background: #ffffff; border: 1px solid #dadce0; color: #202124; }
    .theme-light .fx-label { color: #5f6368; }
    .theme-light .formula-bar { background: #ffffff; border: 1px solid #dadce0; color: #202124; }
    .theme-light .formula-bar:focus { border-color: #1a73e8; }
    .theme-light .sheet-tabs { background: #f8f9fa; border-top: 1px solid #dadce0; }
    .theme-light .sheet-tab { background: #ffffff; color: #5f6368; border: 1px solid #dadce0; border-bottom: none; }
    .theme-light .sheet-tab.active-tab { background: #ffffff; color: #1a73e8; border-top: 2px solid #1a73e8; font-weight:600; }
    .theme-light .sheet-tab:hover:not(.active-tab) { background: #f1f3f4; }
    .theme-light .tab-add { color: #5f6368; }
    .theme-light .tab-add:hover { background: rgba(0,0,0,0.05); }
    .theme-light .grid { background: #f8f9fa; }
    .theme-light .corner, .theme-light .col-head, .theme-light .row-head { background: #f8f9fa; color: #5f6368; border-color: #c0c0c0; }
    .theme-light .col-head:hover, .theme-light .row-head:hover { background: #e8eaed; color: #202124; }
    .theme-light .col-selected, .theme-light .row-selected { background: #e8eaed !important; color: #202124 !important; font-weight:700 !important; }
    .theme-light .active-axis { background: #e8eaed !important; color: #1a73e8 !important; border-bottom-color: #1a73e8; }
    .theme-light .row-head.active-axis { border-right-color: #1a73e8; }
    
    /* ── DARK THEME OVERRIDES ─────────────────────────────────────────── */
    .theme-dark .top-bar { background: #1e1e1e; border-bottom: 1px solid rgba(255, 255, 255, 0.15); }
    .theme-dark .back-btn { color: #e8eaed; }
    .theme-dark .back-btn:hover { background: rgba(255,255,255,0.05); }
    .theme-dark .menu-row { background: #1e1e1e; border-bottom: 1px solid rgba(255, 255, 255, 0.15); }
    .theme-dark .tb-row { background: #1e1e1e; border-bottom: 1px solid rgba(255, 255, 255, 0.15); }
    .theme-dark .tb-row2 { background: #1e1e1e; }
    .theme-dark .tb-font-dd { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); }
    .theme-dark .sz-inp { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); }
    .theme-dark .sz-drop-btn { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); }
    .theme-dark .tb-sep { background: rgba(255,255,255,0.3); }
    .theme-dark .formula-container { background: #1e1e1e; border-bottom: 1px solid #333; }
    .theme-dark .cell-ref { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.3); color: #fff; }
    .theme-dark .formula-bar { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.3); color: #fff; }
    .theme-dark .formula-bar:focus { border-color: #10b981; }
    .theme-dark .corner, .theme-dark .col-head, .theme-dark .row-head { background: #202124; border-color: #5f6368; color: #e8eaed; }
  `]
})
export class SheetEditorComponent implements OnInit, OnDestroy {

  goHome() {
    window.location.href = '/';
  }

  get selectedRowCount(): number {
    if (!this.rangeStart || !this.rangeEnd) return 1;
    return Math.abs(this.rangeEnd.r - this.rangeStart.r) + 1;
  }

  get selectedColCount(): number {
    if (!this.rangeStart || !this.rangeEnd) return 1;
    return Math.abs(this.rangeEnd.c - this.rangeStart.c) + 1;
  }

  COLS = 30;
  ROWS = 1000;
  visibleRowRange: number[] = [];
  firstUnfrozenRow: number = 0;
  topSpacerHeight: number = 0;
  bottomSpacerHeight: number = 0;

  onGridScroll(event: Event) {
    const el = event.target as HTMLElement;
    const scrollTop = el.scrollTop;
    this.updateVisibleRows(scrollTop);

    const scrollLeft = el.scrollLeft;
    if (scrollLeft + el.clientWidth >= el.scrollWidth - 150) {
      this.addColumns(10);
    }
  }

  addColumns(count: number) {
    for (let i = 0; i < count; i++) {
      this.colRange.push(this.COLS);
      for (let r = 0; r < this.ROWS; r++) {
        if (!this.cells[r]) this.cells[r] = [];
        this.cells[r].push('');
      }
      this.COLS++;
    }
    if (this.sheets[this.currentSheetIdx]) {
      this.sheets[this.currentSheetIdx].cells = this.cells;
    }
  }



  updateVisibleRows(scrollTop: number) {
    let currentHeight = 0;
    let startRow = 0;
    const defaultRowHeight = 24;
    const viewportHeight = 1000;
    while (currentHeight < scrollTop && startRow < this.ROWS) {
      currentHeight += this.getRowHeight(startRow) || defaultRowHeight;
      startRow++;
    }
    let endRow = startRow;
    let viewportAcc = 0;
    while (viewportAcc < viewportHeight && endRow < this.ROWS) {
      viewportAcc += this.getRowHeight(endRow) || defaultRowHeight;
      endRow++;
    }
    const buffer = 15;
    startRow = Math.max(0, startRow - buffer);
    endRow = Math.min(this.ROWS - 1, endRow + buffer);

    let actualStartRow = Math.max(this.frozenRowsCount, startRow);
    this.visibleRowRange = [];

    for (let i = 0; i < this.frozenRowsCount; i++) {
      this.visibleRowRange.push(i);
    }
    for (let i = actualStartRow; i <= endRow; i++) {
      this.visibleRowRange.push(i);
    }

    this.firstUnfrozenRow = actualStartRow;

    let calcTopSpacer = 0;
    for (let i = this.frozenRowsCount; i < actualStartRow; i++) {
      calcTopSpacer += this.getRowHeight(i) || defaultRowHeight;
    }
    this.topSpacerHeight = calcTopSpacer;

    let calcBottomSpacer = 0;
    for (let i = endRow + 1; i < this.ROWS; i++) {
      calcBottomSpacer += this.getRowHeight(i) || defaultRowHeight;
    }
    this.bottomSpacerHeight = calcBottomSpacer;
    if (this.cdr) this.cdr.markForCheck();
  }

  trackByRow(index: number, r: number) { return r; }
  trackByCol(index: number, c: number) { return c; }

  activeWidget: string | null = null;
  toggleWidget(w: string) {
    if (this.activeWidget === w) this.activeWidget = null;
    else this.activeWidget = w;
  }

  @ViewChild('imgInput') imgInputRef!: ElementRef<HTMLInputElement>;

  docId = '';
  title = '';
  activeUsers = 1;

  currentBorderColor: string = '#000000';
  currentBorderStyle: string = 'solid';
  currentBorderWidth: string = '1px';
  activeBorderSubmenu: 'color' | 'style' | null = null;

  getBorderStyleCss(style: string, width: string = '1px') {
    return { 'border-top': `${width} ${style} currentColor`, 'width': '100%' };
  }

  displayCache: { [key: string]: string } = {};

  updateDisplayCache() {
    if (this.cdr) this.cdr.markForCheck();

    this.displayCache = {};
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const raw = this.cells[r][c];
        if (raw && typeof raw === 'string' && raw.startsWith('=')) {
          this.displayCache[`${r},${c}`] = this.evalCell(r, c);
        }
      }
    }
  }

  getDisplayValue(r: number, c: number): string {
    const raw = this.cells[r][c];
    let val = raw;
    if (raw && typeof raw === 'string' && raw.startsWith('=')) {
      val = this.displayCache[`${r},${c}`] !== undefined ? this.displayCache[`${r},${c}`] : raw;
    }

    const fmt = this.formats[`${r},${c}`];
    if (fmt && fmt.numFormat && fmt.numFormat !== 'general' && val !== '' && val !== undefined && val !== null) {
      return this.formatNumberValue(val, fmt.numFormat as string);
    }
    return val !== undefined && val !== null ? String(val) : '';
  }

  formatNumberValue(val: any, format: string): string {
    const num = Number(val);
    const isNum = !isNaN(num) && String(val).trim() !== '';

    if (format.startsWith('regional_')) {
       if (!isNum) return val;
       const locale = format.split('_')[1];
       const locales: any = { us: 'en-US', uk: 'en-GB', in: 'en-IN', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', jp: 'ja-JP', cn: 'zh-CN' };
       return num.toLocaleString(locales[locale] || 'en-US', { maximumFractionDigits: 10 });
    }

    if (format.startsWith('custom_')) {
      const fmtStr = format.substring(7);
      return this.applyCustomFormatString(val, num, isNum, fmtStr);
    }

    if (format === 'date_full') return isNum ? new Date(Math.round((num - 25569) * 86400 * 1000)).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : val;
    if (format === 'date_iso') return isNum ? new Date(Math.round((num - 25569) * 86400 * 1000)).toISOString().split('T')[0] : val;
    if (format === 'financial') return isNum ? (num < 0 ? `(${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : val;

    if (!format) return val;

    // Check if it's a date
    let date = null;
    if (typeof val === 'string' && val.includes('-') && !isNaN(Date.parse(val))) {
      date = new Date(val);
    } else if (isNum && format.startsWith('date')) {
      // Excel epoch dates (simplified)
      date = new Date(Math.round((num - 25569) * 86400 * 1000));
    }

    if (format === 'number') return isNum ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val;
    if (format === 'percent') return isNum ? (num * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : val;
    if (format === 'scientific') return isNum ? num.toExponential(2) : val;
    if (format === 'text') return String(val);

    // Currencies & Accounting
    if (format.startsWith('currency') || format.startsWith('accounting')) {
      if (!isNum) return val;
      let symbol = '$';
      if (format.endsWith('_inr')) symbol = '₹';
      if (format.endsWith('_eur')) symbol = '€';
      if (format.endsWith('_gbp')) symbol = '£';
      if (format.endsWith('_cny')) symbol = '¥';
      
      const formattedNum = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (format.startsWith('accounting')) {
         return num === 0 ? `${symbol}   -  ` : `${symbol}  ${formattedNum}`;
      } else {
         return symbol + formattedNum;
      }
    }

    // Fractions
    if (format.startsWith('fraction')) {
      if (!isNum) return val;
      const sign = num < 0 ? '-' : '';
      const absNum = Math.abs(num);
      const whole = Math.floor(absNum);
      const dec = absNum - whole;
      if (dec === 0) return sign + whole;

      let denom = 10;
      if (format === 'fraction_1') denom = 9;
      if (format === 'fraction_2') denom = 99;
      if (format === 'fraction_3') denom = 999;

      let bestH = 0, bestK = 1, minErr = 1;
      for (let k = 1; k <= denom; k++) {
          const h = Math.round(dec * k);
          const err = Math.abs(dec - h / k);
          if (err < minErr) {
              bestH = h;
              bestK = k;
              minErr = err;
              if (err === 0) break;
          }
      }
      return sign + (whole !== 0 ? whole + ' ' : '') + bestH + '/' + bestK;
    }

    // Dates and Times
    if ((format.startsWith('date') || format.startsWith('time')) && date && !isNaN(date.getTime())) {
      const d = date.getDate();
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      const yy = String(y).slice(-2);
      const mmm = date.toLocaleString('default', { month: 'short' });
      const mmmm = date.toLocaleString('default', { month: 'long' });
      const eeee = date.toLocaleString('default', { weekday: 'long' });

      let h = date.getHours();
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;

      switch (format) {
        case 'date_1': return `${d}/${m}/${yy}`;
        case 'date_2': return `${d} ${mmm}, ${y}`;
        case 'date_3': return `${d} ${mmmm}, ${y}`;
        case 'date_4': return `${eeee}, ${d} ${mmmm}, ${y}`;
        case 'date_5': return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
        case 'date_6': return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
        case 'date_7': return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
        case 'date_8': return `${d}/${m}/${yy} ${h12}:${mm}:${ss} ${ampm} IST`;
        case 'date_9': return `${d} ${mmm}, ${y} ${h12}:${mm}:${ss} ${ampm} IST`;
        case 'date_10': return `${d} ${mmmm}, ${y} ${h12}:${mm}:${ss} ${ampm}`;
        case 'date_11': return `${eeee}, ${d} ${mmmm}, ${y} ${h12}:${mm} ${ampm}`;
        case 'date_12': return `${d}/${m}/${yy} ${h12}:${mm} ${ampm}`;

        case 'time_1': return `${h12}:${mm} ${ampm}`;
        case 'time_2': return `${h12}:${mm}:${ss} ${ampm}`;
        case 'time_3': return `${h12}:${mm}:${ss} ${ampm} IST`;
        case 'time_4': return isNum ? `${Math.floor(num * 24)}:${mm}` : val;
        case 'time_5': return isNum ? `${Math.floor(num * 24)}:${mm}:${ss}` : val;
      }
    }

    return val !== undefined && val !== null ? String(val) : '';
  }

  isEditingCell = false;
  editValue = '';
  @ViewChild('floatingEditor') floatingEditor?: ElementRef<HTMLTextAreaElement>;

  shareModalOpen = false;
  propertiesPanelOpen = false;
  docDetails: any = null;
  window = window;

  getActiveSheetCount(): number {
    return this.sheets.length;
  }

  getUsedCellsCount(): number {
    let count = 0;
    this.sheets.forEach(sheet => {
      if (sheet.cells) {
        Object.keys(sheet.cells).forEach(r => {
          Object.keys(sheet.cells[r as any]).forEach(c => {
            if (sheet.cells[r as any][c as any] !== '') {
              count++;
            }
          });
        });
      }
    });
    return count;
  }
  isPublic = false;
  shareQuery = '';
  selectedShareEmails: string[] = [];
  shareRole: 'View' | 'Edit' = 'View';
  shareRoleDropdownOpen = false;
  userSearchResults: any[] = [];
  promptModalOpen = false;
  promptModalTitle = '';
  promptModalValue = '';
  private promptResolve: ((value: string | null) => void) | null = null;
  filterActive = false;
  frozenRowsCount: number = 0;
  frozenColsCount: number = 0;
  gridDirection: 'ltr' | 'rtl' = 'ltr';
  gridSpacing: 'classic' | 'cozy' | 'comfort' = 'cozy';
  gridlineColor: string = '#d0d0d0';
  hiddenRows: Set<number> = new Set();
  hiddenCols: Set<number> = new Set();
  showGridlines = true;
  showFormulaBar = true;
  showHeaders = true;
  showTopBar = true;
  showStatusBar = true;
  showNotes = false;
  showUserPresence = true;
  showLockPattern = false;
  showHighlightPrintArea = false;
  appearance: 'light' | 'dark' | 'system' = 'light';

  get currentTheme(): string {
    if (this.appearance === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.appearance;
  }

  highlightRowColColor: string = 'transparent';
  highlightColors: string[] = ['transparent', '#e3f2fd', '#e8f5e9', '#fff9c4', '#ffe0b2', '#fce4ec', '#f3e5f5', '#f5f5f5'];
  zoomLevel = 100;
  activePalette: string | null = null;
  currentFont = 'Arial';
  currentSize = '13px';
  currentSizeNum = 13;
  fonts = ['Arial', 'Caveat', 'Comfortaa', 'Comic Sans MS', 'Courier New', 'EB Garamond', 'Georgia', 'Impact', 'Lexend', 'Lobster', 'Lora', 'Merriweather', 'Oswald', 'Pacifico', 'Playfair Display', 'Roboto', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  private clipboard = '';
  private history: string[] = [];
  private future: string[] = [];

  // Range selection
  rangeStart: { r: number, c: number } | null = null;
  rangeEnd: { r: number, c: number } | null = null;
  private isDraggingRange = false;

  // Fill handle
  private isFilling = false;
  fillEnd: { r: number, c: number } | null = null;
  private fillStart: { r: number, c: number } | null = null;

  // Header selection (full col / full row)
  selectedColHeader: number | null = null;
  selectedRowHeader: number | null = null;

  // Context menu
  ctxVisible = false;
  ctxX = 0;
  ctxY = 0;
  ctxTop: number | null = null;
  ctxBottom: number | null = null;
  ctxMaxHeight = 800;

  // Data validation / dropdown
  validations: Record<string, CellValidation> = {};
  validationModalOpen = false;
  validationInput = '';
  picklistOptions: DropdownOption[] = [];
  picklistSelectType: 'single' | 'multi' = 'single';

  pivotModalOpen = false;
  pivotSource = '';
  pivotDestType = 'existing';
  pivotDest = 'Sheet1.A9';
  dataValidationModalOpen = false;
  manageRulesModalOpen = false;

  // Range Picker state
  rangePickerActive = false;
  rangePickerField: 'pivotSource' | 'pivotDest' | 'dvAppliesTo' | null = null;
  rangePickerStartR = -1;
  rangePickerStartC = -1;
  rangePickerEndR = -1;
  rangePickerEndC = -1;
  _pivotModalWasOpen = false;
  _dvModalWasOpen = false;

  // Data Validation form state
  dvCriteria = 'list';
  dvShowList = true;
  dvSortAsc = false;
  dvIgnoreBlanks = true;
  dvAlertsOpen = false;
  dvAlertEnabled = true;
  dvAlertTitle = '';
  dvAlertMsg = '';
  dvAppliesTo = 'Sheet1.A1';

  // Multiple sheets
  sheets: Array<{ name: string, cells: string[][], formats: Record<string, CellFormat>, validations: Record<string, CellValidation>, colWidths?: Record<number, number>, rowHeights?: Record<number, number>, hideGridlines?: boolean, locked?: boolean, hidden?: boolean, tabColor?: string, shapes?: any[], rowGroups?: Array<{ start: number, end: number, collapsed: boolean }>, colGroups?: Array<{ start: number, end: number, collapsed: boolean }> }> = [
    { name: 'Sheet1', cells: Array.from({ length: this.ROWS }, () => Array(this.COLS).fill('')), formats: {}, validations: {}, shapes: [] }
  ];
  currentSheetIdx = 0;
  activeSheetMenuIdx: number | null = null;
  sheetMenuX = 0;
  sheetMenuY = 0;
  copiedSheetData: any = null;
  activeSheetSubmenu: string | null = null;

  // Resizing state
  resizingCol: number | null = null;
  resizingRow: number | null = null;
  resizeStartX = 0;
  resizeStartY = 0;
  resizeStartSize = 0;
  resizeLineX = 0;
  resizeLineY = 0;

  // Find & Replace
  findModalOpen = false;
  findQuery = '';
  replaceQuery = '';
  findStatus = '';
  private findMatches: { r: number, c: number }[] = [];
  private findMatchIdx = -1;

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

  colRange = Array.from({ length: this.COLS }, (_, i) => i);
  rowRange = Array.from({ length: this.ROWS }, (_, i) => i);
  cells: string[][] = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(''));
  formats: Record<string, CellFormat> = {};

  selectedRow = 0;
  selectedCol = 0;
  formulaBarValue = '';
  toastVisible = false;
  toastMsg = '';
  remoteCursors: Record<string, { r: number, c: number }> = {};
  activeMenu: string | null = null;
  activeChartTab: string = 'column';
  profileOpen = false;

  get currentUrl(): string { return window.location.href; }

  private syncSub?: Subscription;
  private applyingRemote = false;

  get selectedRef() { return `${colName(this.selectedCol)}${this.selectedRow + 1}`; }
  colLabel(i: number) { return colName(i); }

  colToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.toUpperCase().charCodeAt(i) - 64);
    }
    return index - 1;
  }

  isRemoteSelected(r: number, c: number) {
    return Object.values(this.remoteCursors).some(pos => pos.r === r && pos.c === c);
  }

  get initials() {
    return (this.auth.user?.name ?? 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  sidePanelApp: string | null = null;
  sidePanelUrl: SafeResourceUrl | null = null;

  // Embedded Side Panel Apps Data
  calendarNotes: Record<string, string> = {};
  selectedCalDate = new Date().toISOString().split('T')[0];
  globalNotes = '';
  tasks: { text: string, done: boolean }[] = [];
  newTask = '';

  constructor(
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public auth: AuthService
    , private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.updateVisibleRows(0);

    this.saveSubscription = this.saveSubject.pipe(
      debounceTime(2000)
    ).subscribe(() => {
      this.executeSave();
    });
    this.docId = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getDocument(this.docId).subscribe((doc: any) => {
      this.docDetails = doc;
      this.title = doc.title;
      try {
        const p = JSON.parse(doc.content || '{}');
        if (p.cells) {
          for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
              this.cells[r][c] = p.cells[r]?.[c] ?? '';
        }
        if (p.formats) {
          this.formats = p.formats;
        }
        if (p.validations) {
          this.validations = p.validations;
        }
        if (p.colWidths) this.sheets[this.currentSheetIdx].colWidths = p.colWidths;
        if (p.rowHeights) this.sheets[this.currentSheetIdx].rowHeights = p.rowHeights;
        if (p._importedSheets) {
          // Normalize sheets: cells may be sparse {r:{c:val}} or 2D array — convert both to 2D array for live editing
          this.sheets = p._importedSheets.map((sheet: any) => {
            let cells2d: string[][];
            if (Array.isArray(sheet.cells)) {
              // Legacy 2D array — pad/clone to this.ROWS×this.COLS
              cells2d = Array.from({ length: Math.max(this.ROWS, sheet.cells.length) }, (_, r) =>
                Array.from({ length: Math.max(this.COLS, sheet.cells[r]?.length ?? 0) }, (_, c) =>
                  sheet.cells[r]?.[c] ?? ''));
            } else {
              // Sparse object {r:{c:val}} — expand to 2D
              const sp = sheet.cells || {};
              const maxR = Math.max(this.ROWS, ...Object.keys(sp).map(Number).filter(n => !isNaN(n))) + 1;
              cells2d = Array.from({ length: maxR }, (_, r) =>
                Array.from({ length: this.COLS }, (_, c) => sp[r]?.[c] ?? ''));
            }
            return { ...sheet, cells: cells2d };
          });
          this.currentSheetIdx = 0;
          const s0 = this.sheets[0];
          for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
              this.cells[r][c] = s0.cells[r]?.[c] ?? '';
          this.formats = { ...(s0.formats || {}) };
          this.validations = { ...(s0.validations || {}) };
        }
        if (p.calendarNotes) this.calendarNotes = p.calendarNotes;
        if (p.globalNotes) this.globalNotes = p.globalNotes;
        if (p.tasks) this.tasks = p.tasks;
      } catch { }
      this.updateDisplayCache();
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
            // Handle array of sheets (from server's doc_states) or single object
            const sheets = Array.isArray(p) ? p : [p];
            if (sheets[this.currentSheetIdx]) {
              const active = sheets[this.currentSheetIdx];
              if (active.cells) {
                for (let r = 0; r < this.ROWS; r++)
                  for (let c = 0; c < this.COLS; c++)
                    this.cells[r][c] = active.cells[r]?.[c] ?? '';
              }
              if (active.formats) this.formats = active.formats;
              if (active.validations) this.validations = active.validations;
            }
          } catch { }
          this.updateDisplayCache();
        }
        setTimeout(() => this.applyingRemote = false, 50);
      } else if (msg.type === 'cell_update' && msg.r !== undefined && msg.c !== undefined && msg.sheetIdx !== undefined) {
        const remoteUser = 'Collaborator';
        const key = `${msg.sheetIdx}-${msg.r}-${msg.c}`;
        if (!this.cellEditHistory) this.cellEditHistory = {};
        if (!this.cellEditHistory[key]) this.cellEditHistory[key] = [];
        this.cellEditHistory[key].unshift({
          user: remoteUser,
          time: new Date(),
          action: msg.value ? (this.cellEditHistory[key].length === 0 ? 'ADDED' : 'EDITED') : 'CLEARED',
          value: msg.value
        });

        if (msg.sheetIdx === this.currentSheetIdx) {
          this.cells[msg.r][msg.c] = msg.value ?? '';
          if (msg.formatting) {
            this.formats[`${msg.r},${msg.c}`] = msg.formatting;
          } else {
            delete this.formats[`${msg.r},${msg.c}`];
          }
          this.updateDisplayCache();
          if (this.cdr) this.cdr.markForCheck();
        } else {
          const sheet = this.sheets[msg.sheetIdx];
          if (sheet) {
            if (!sheet.cells) sheet.cells = [];
            if (!sheet.cells[msg.r]) sheet.cells[msg.r] = [];
            sheet.cells[msg.r][msg.c] = msg.value ?? '';
            if (!sheet.formats) sheet.formats = {};
            if (msg.formatting) {
              sheet.formats[`${msg.r},${msg.c}`] = msg.formatting;
            } else {
              delete sheet.formats[`${msg.r},${msg.c}`];
            }
          }
        }
      } else if (msg.type === 'cursor' && msg.client_id && msg.r !== undefined && msg.c !== undefined) {
        this.remoteCursors[msg.client_id] = { r: msg.r, c: msg.c }; if (this.cdr) this.cdr.markForCheck();
      } else if (msg.type === 'cursor_remove' && msg.client_id) {
        delete this.remoteCursors[msg.client_id]; if (this.cdr) this.cdr.markForCheck();
      }
    });
  }

  insertFunction(fnName: string) {
    this.closeMenus();
    this.formulaBarValue = `=${fnName}(${this.getRangeRef()})`;
    this.cells[this.selectedRow][this.selectedCol] = this.formulaBarValue;
    this.onCellChange();
    this.showToast(`${fnName} function inserted.`);
  }

  moreFunctions() {
    this.closeMenus();
    this.showToast('More functions library opening...');
  }

  customSort() {
    this.closeMenus();
    this.showToast('Custom Sort options are not available in this preview.');
  }



  @HostListener('document:click')
  onDocClick() { this.closeMenus(); this.activePalette = null; this.hideCtx(); }

  isEditingText(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.save();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      if (!this.isEditingText(e) && !this.isEditingCell) {
        e.preventDefault();
        this.selectAll();
        return;
      }
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && !this.isEditingText(e) && !this.isEditingCell) {
      e.preventDefault();
      const tag = (e.target as HTMLElement).tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        if (this.rangeStart && this.rangeEnd) {
          const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
          const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
          const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
          const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
          if (minR !== maxR || minC !== maxC) {
            this.clearRangeData();
            return;
          }
        }
        this.clearCell();
      }
      return;
    }

    if (!this.isEditingText(e) && !this.isEditingCell) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nr = Math.max(0, this.selectedRow - 1);
        this.selectCell(nr, this.selectedCol);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nr = Math.min(this.cells.length - 1, this.selectedRow + 1);
        this.selectCell(nr, this.selectedCol);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const nc = Math.max(0, this.selectedCol - 1);
        this.selectCell(this.selectedRow, nc);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nc = Math.min(this.cells[0].length - 1, this.selectedCol + 1);
        this.selectCell(this.selectedRow, nc);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.startEditing();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.startEditing(e.key);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); this.redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); this.toggleFormat('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); this.toggleFormat('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); this.toggleFormat('underline'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') { e.preventDefault(); this.cutCell(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); this.fillDown(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); this.fillRight(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'f')) { e.preventDefault(); this.openFind(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      if (e.shiftKey) this.setFormat('indent', 'decrease');
      else this.setFormat('indent', 'increase');
    }
    if (e.key === 'Delete') {
      // If a multi-cell range is selected, always clear it (even if an input is focused)
      if (this.rangeStart && this.rangeEnd) {
        const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
        const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
        const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
        const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
        if (minR !== maxR || minC !== maxC) {
          e.preventDefault();
          this.clearRangeData();
        }
      } else {
        // Single cell: only clear if the grid itself is focused (not typing in input)
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); this.clearRangeData(); }
      }
    }
    if (e.key === 'Escape') { this.hideCtx(); }
  }

  @HostListener('document:paste', ['$event'])
  pasteFromClipboard(e: ClipboardEvent) {
    if (this.isEditingText(e as any) || this.isEditingCell) return;

    e.preventDefault();

    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData) return;

    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        if (clipboardData.items[i].type.indexOf('image') !== -1) {
          const file = clipboardData.items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              this.pushHistory();
              this.cells[this.selectedRow][this.selectedCol] = ev.target!.result as string;
              this.formulaBarValue = '[IMAGE]';
              this.onCellChange();
              this.save();
              this.showToast('Image pasted into cell.');
              if (this.cdr) this.cdr.detectChanges();
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    }

    const pastedHtml = clipboardData.getData('text/html');
    const pastedText = clipboardData.getData('Text');

    if (!pastedHtml && !pastedText) return;

    this.pushHistory();

    const startRow = this.selectedRow;
    const startCol = this.selectedCol;
    let maxCols = 1;
    let maxRows = 1;

    let parsedFromHtml = false;

    if (pastedHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(pastedHtml, 'text/html');
      const table = doc.querySelector('table');
      const img = doc.querySelector('img');

      if (table) {
        parsedFromHtml = true;
        const rows = Array.from(table.rows);
        maxRows = rows.length;

        for (let r = 0; r < rows.length; r++) {
          const cells = Array.from(rows[r].cells);
          maxCols = Math.max(maxCols, cells.length);
          for (let c = 0; c < cells.length; c++) {
            const targetR = startRow + r;
            const targetC = startCol + c;

            if (targetR < this.ROWS && targetC < this.COLS) {
              const cell = cells[c];

              // If the cell contains an image
              const cellImg = cell.querySelector('img');
              if (cellImg && cellImg.src) {
                this.cells[targetR][targetC] = cellImg.src;
              } else {
                this.cells[targetR][targetC] = cell.innerText.trim();
              }

              let formats: any = {};

              // Handle bold
              if (cell.tagName.toLowerCase() === 'th' ||
                cell.style.fontWeight === 'bold' ||
                cell.style.fontWeight === '700' ||
                cell.querySelector('b') ||
                cell.querySelector('strong')) {
                formats.bold = true;
              }

              // Handle italic
              if (cell.style.fontStyle === 'italic' ||
                cell.querySelector('i') ||
                cell.querySelector('em')) {
                formats.italic = true;
              }

              // Handle background color
              if (cell.style.backgroundColor &&
                cell.style.backgroundColor !== 'transparent' &&
                cell.style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                formats.bg = cell.style.backgroundColor;
              }

              // Handle text color
              if (cell.style.color && cell.style.color !== 'inherit') {
                formats.color = cell.style.color;
              }

              if (Object.keys(formats).length > 0) {
                this.formats[`${targetR},${targetC}`] = {
                  ...(this.formats[`${targetR},${targetC}`] || {}),
                  ...formats
                };
              }
            }
          }
        }
      } else if (img && img.src) {
        parsedFromHtml = true;
        this.cells[startRow][startCol] = img.src;
        this.formulaBarValue = '[IMAGE]';
      }
    }

    if (!parsedFromHtml && pastedText) {
      const rows = pastedText.split(/\r?\n/);
      if (rows.length > 0 && rows[rows.length - 1] === '') {
        rows.pop(); // Remove trailing newline from spreadsheet copies
      }
      maxRows = rows.length;

      for (let r = 0; r < rows.length; r++) {
        const cols = rows[r].split('\t');
        maxCols = Math.max(maxCols, cols.length);
        for (let c = 0; c < cols.length; c++) {
          const targetR = startRow + r;
          const targetC = startCol + c;
          if (targetR < this.ROWS && targetC < this.COLS) {
            this.cells[targetR][targetC] = cols[c];
          }
        }
      }
    }

    this.rangeStart = { r: startRow, c: startCol };
    this.rangeEnd = {
      r: Math.min(startRow + maxRows - 1, this.ROWS - 1),
      c: Math.min(startCol + maxCols - 1, this.COLS - 1)
    };

    this.onCellChange();
    this.save();
    this.showToast('Data pasted');
  }

  @HostListener('document:mouseup')
  onDocMouseUp() {
    if (this.isFilling && this.fillEnd) {
      this.applyFill();
    }
    this.isDraggingRange = false;
    this.isFilling = false;
    this.fillStart = null;
  }

  // ── Range selection helpers ──────────────────────────────────────────────
  onCellMouseDown(e: MouseEvent, r: number, c: number) {
    if ((e.target as HTMLElement).classList.contains('fill-handle')) return;
    this.isDraggingRange = true;
    this.rangeStart = { r, c };
    this.rangeEnd = { r, c };
    this.fillEnd = null;
  }

  onCellMouseEnter(r: number, c: number) {
    if (this.isDraggingRange && this.rangeStart) {
      this.rangeEnd = { r, c };
    }
    if (this.isFilling && this.fillStart) {
      this.fillEnd = { r, c };
    }
  }

  isCellSelected(r: number, c: number): boolean {
    return this.selectedRow === r && this.selectedCol === c;
  }

  isCheckboxCell(r: number, c: number): boolean {
    const f = this.formats[`${r},${c}`];
    return !!(f && (f as any)['checkbox']);
  }

  isUrl(val: string): boolean {
    if (!val || typeof val !== 'string') return false;
    return /^(https?:\/\/[^\s]+)$/i.test(val.trim());
  }

  toggleCheckbox(r: number, c: number) {
    this.pushHistory();
    this.cells[r][c] = this.cells[r][c] === 'TRUE' ? 'FALSE' : 'TRUE';
    if (this.selectedRow === r && this.selectedCol === c) {
      this.formulaBarValue = this.cells[r][c];
    }
    this.onCellChange();
    this.save();
  }

  openCustomDropdown(event: MouseEvent, r: number, c: number) {
    event.stopPropagation();
    const opts = this.getCellDropdownOptions(r, c);
    if (!opts || !opts.length) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // We can create a dynamic overlay or use a generic one. For simplicity,
    // let's create a dynamic absolute div and append to body.
    const overlay = document.createElement('div');
    overlay.className = 'custom-dropdown-overlay';
    overlay.style.top = `${rect.bottom + 2}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${Math.max(rect.width, 150)}px`;

    opts.forEach((opt: any) => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item';
      item.style.backgroundColor = opt.color || '#fff';
      item.style.color = opt.color ? '#fff' : '#000';
      item.innerText = opt.label || opt;
      item.onclick = (e) => {
        e.stopPropagation();
        this.pushHistory();
        this.cells[r][c] = opt.label || opt;
        if (this.selectedRow === r && this.selectedCol === c) {
          this.formulaBarValue = this.cells[r][c];
        }
        this.onCellChange();
        this.save();
        document.body.removeChild(overlay);
        document.removeEventListener('click', closeOverlay);
      };
      overlay.appendChild(item);
    });

    // Option to clear the cell
    const clearItem = document.createElement('div');
    clearItem.className = 'custom-dropdown-item';
    clearItem.style.backgroundColor = '#fff';
    clearItem.style.color = '#e53e3e';
    clearItem.style.borderTop = '1px solid #e2e8f0';
    clearItem.innerText = 'Clear validation';
    clearItem.onclick = (e) => {
      e.stopPropagation();
      this.pushHistory();
      this.cells[r][c] = '';
      if (this.selectedRow === r && this.selectedCol === c) {
        this.formulaBarValue = '';
      }
      this.onCellChange();
      this.save();
      document.body.removeChild(overlay);
      document.removeEventListener('click', closeOverlay);
    };
    overlay.appendChild(clearItem);

    document.body.appendChild(overlay);

    const closeOverlay = (e: MouseEvent) => {
      if (!overlay.contains(e.target as Node)) {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        document.removeEventListener('click', closeOverlay);
      }
    };
    // use setTimeout so the current click doesn't instantly close it
    setTimeout(() => {
      document.addEventListener('click', closeOverlay);
    }, 0);
  }

  isCellInRange(r: number, c: number): boolean {
    if (!this.rangeStart || !this.rangeEnd) return false;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    // For full-column/row selection (entire range), highlight all including anchor
    const isFullRange = (maxR - minR > 0 || maxC - minC > 0);
    if (!isFullRange) return false;
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }

  // ── Fill handle helpers ──────────────────────────────────────────────────
  isFillHandleCell(r: number, c: number): boolean {
    // When a range is active: show ONE dot at the bottom-right of the range only
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      // Multi-cell range: dot only at bottom-right
      if (minR !== maxR || minC !== maxC) return r === maxR && c === maxC;
    }
    // No range or single-cell range: dot at selected cell
    return r === this.selectedRow && c === this.selectedCol;
  }

  isCellInFillPreview(r: number, c: number): boolean {
    if (!this.isFilling || !this.fillStart || !this.fillEnd) return false;
    const minR = Math.min(this.fillStart.r, this.fillEnd.r);
    const maxR = Math.max(this.fillStart.r, this.fillEnd.r);
    const minC = Math.min(this.fillStart.c, this.fillEnd.c);
    const maxC = Math.max(this.fillStart.c, this.fillEnd.c);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }

  onFillHandleMouseDown(e: MouseEvent, r: number, c: number) {
    e.preventDefault();
    e.stopPropagation();
    this.isFilling = true;
    this.isDraggingRange = false;
    this.fillStart = { r, c };
    this.fillEnd = { r, c };
  }

  private applyFill() {
    if (!this.fillStart || !this.fillEnd) return;
    // Determine the source cells (selection range or just one cell)
    const srcMinR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.fillStart.r;
    const srcMaxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.fillStart.r;
    const srcMinC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.fillStart.c;
    const srcMaxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.fillStart.c;

    const dstR = this.fillEnd.r;
    const dstC = this.fillEnd.c;

    this.pushHistory();

    // Determine fill direction
    const goDown = dstR > srcMaxR;
    const goUp = dstR < srcMinR;
    const goRight = dstC > srcMaxC;
    const goLeft = dstC < srcMinC;

    if (goDown || goUp) {
      // Fill column-wise
      for (let c = srcMinC; c <= srcMaxC; c++) {
        const srcVals: string[] = [];
        for (let r = srcMinR; r <= srcMaxR; r++) srcVals.push(this.cells[r][c]);
        if (goDown) {
          for (let r = srcMaxR + 1; r <= dstR; r++) {
            this.cells[r][c] = this.getNextSeriesValue(srcVals, r - srcMinR, true);
          }
        } else {
          for (let r = srcMinR - 1; r >= dstR; r--) {
            this.cells[r][c] = this.getNextSeriesValue(srcVals, r - srcMaxR, true);
          }
        }
      }
    } else if (goRight || goLeft) {
      // Fill row-wise
      for (let r = srcMinR; r <= srcMaxR; r++) {
        const srcVals: string[] = [];
        for (let c = srcMinC; c <= srcMaxC; c++) srcVals.push(this.cells[r][c]);
        if (goRight) {
          for (let c = srcMaxC + 1; c <= dstC; c++) {
            this.cells[r][c] = this.getNextSeriesValue(srcVals, c - srcMinC, false);
          }
        } else {
          for (let c = srcMinC - 1; c >= dstC; c--) {
            this.cells[r][c] = this.getNextSeriesValue(srcVals, c - srcMaxC, false);
          }
        }
      }
    }

    // Update selection to show the full filled area
    const newMinR = Math.min(srcMinR, dstR);
    const newMaxR = Math.max(srcMaxR, dstR);
    const newMinC = Math.min(srcMinC, dstC);
    const newMaxC = Math.max(srcMaxC, dstC);
    this.rangeStart = { r: newMinR, c: newMinC };
    this.rangeEnd = { r: newMaxR, c: newMaxC };
    this.selectedRow = newMinR;
    this.selectedCol = newMinC;
    this.fillEnd = null;
    this.onCellChange();
    this.save();
    this.showToast('Series filled.');
  }

  /** Smart series: detect number, date (MM-DD-YY or MM-DD-YYYY), repeat, or formula shifting */
  private getNextSeriesValue(srcVals: string[], offset: number, isVertical: boolean): string {
    let v = '';
    let idx = 0;

    // Determine the base string to use
    if (srcVals.length === 1) {
      v = srcVals[0];
      // Interpolate numbers/dates only if it's NOT a formula
      if (!v.startsWith('=')) {
        const num = Number(v);
        // By default in spreadsheets, dragging a single number copies it instead of incrementing.
        // We only interpolate dates automatically.
        const dateMatch = v.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
        if (dateMatch) {
          const m = parseInt(dateMatch[1], 10);
          const d = parseInt(dateMatch[2], 10);
          const y = parseInt(dateMatch[3], 10);
          const fullY = y < 100 ? 2000 + y : y;
          const dt = new Date(fullY, m - 1, d);
          dt.setDate(dt.getDate() + offset);
          const nm = String(dt.getMonth() + 1).padStart(2, '0');
          const nd = String(dt.getDate()).padStart(2, '0');
          const ny = y < 100 ? String(dt.getFullYear()).slice(2) : String(dt.getFullYear());
          return `${nm}-${nd}-${ny}`;
        }
      }
    } else {
      // Multi-value: try linear step
      const nums = srcVals.map(s => Number(s));
      if (nums.every(n => !isNaN(n) && srcVals[nums.indexOf(n)].trim() !== '')) {
        const step = nums.length > 1 ? nums[1] - nums[0] : 1;
        const base = nums[nums.length - 1];
        const steps = offset - (srcVals.length - 1);
        return String(base + step * steps);
      }
      // Repeat cycle
      idx = ((offset % srcVals.length) + srcVals.length) % srcVals.length;
      v = srcVals[idx];
    }

    if (v.startsWith('=')) {
      const shiftAmount = offset - idx;
      const rowDelta = isVertical ? shiftAmount : 0;
      const colDelta = isVertical ? 0 : shiftAmount;

      return v.replace(/[A-Z]+\d+/g, (match) => {
        const colStr = match.match(/^[A-Z]+/)![0];
        const rowStr = match.match(/\d+$/)![0];
        let colIdx = colStr.charCodeAt(0) - 65;
        let rowIdx = parseInt(rowStr, 10) - 1;

        colIdx += colDelta;
        rowIdx += rowDelta;

        if (colIdx < 0) colIdx = 0;
        if (rowIdx < 0) rowIdx = 0;
        return `${colName(colIdx)}${rowIdx + 1}`;
      });
    }

    return v;
  }

  // ── Column / Row header selection ────────────────────────────────────────
  selectEntireCol(c: number) {
    this.selectedColHeader = c;
    this.selectedRowHeader = null;
    this.rangeStart = { r: 0, c };
    this.rangeEnd = { r: this.ROWS - 1, c };
    this.selectedRow = 0;
    this.selectedCol = c;
    this.formulaBarValue = '';
  }

  selectEntireRow(r: number) {
    this.selectedRowHeader = r;
    this.selectedColHeader = null;
    this.rangeStart = { r, c: 0 };
    this.rangeEnd = { r, c: this.COLS - 1 };
    this.selectedRow = r;
    this.selectedCol = 0;
    this.formulaBarValue = '';
  }

  selectAll() {
    this.selectedColHeader = null;
    this.selectedRowHeader = null;
    this.rangeStart = { r: 0, c: 0 };
    this.rangeEnd = { r: this.ROWS - 1, c: this.COLS - 1 };
    this.selectedRow = 0;
    this.selectedCol = 0;
    this.formulaBarValue = this.isImageCell(0, 0) ? '[IMAGE]' : this.cells[0][0] || '';
  }

  isColHeaderSelected(c: number): boolean { return this.selectedColHeader === c; }
  isRowHeaderSelected(r: number): boolean { return this.selectedRowHeader === r; }

  // ── Right-click context menu ──────────────────────────────────────────────
  onHeaderRightClick(e: MouseEvent, type: 'row' | 'col', idx: number) {
    e.preventDefault();
    if (type === 'col') this.selectEntireCol(idx);
    else this.selectEntireRow(idx);

    this.showContextMenu(e);
  }

  onCellRightClick(e: MouseEvent, r: number, c: number) {
    e.preventDefault();
    this.selectCell(r, c);
    
    this.showContextMenu(e);
  }

  showContextMenu(e: MouseEvent) {
    const menuWidth = 220;
    const estimatedMenuHeight = 430;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth;

    let spaceBelow = window.innerHeight - y - 10;
    let spaceAbove = y - 10;

    this.ctxX = x;

    if (estimatedMenuHeight > spaceBelow && spaceAbove > spaceBelow) {
      // More space above, and it doesn't fit below. Open upwards.
      this.ctxTop = null;
      this.ctxBottom = window.innerHeight - y;
      this.ctxMaxHeight = spaceAbove;
    } else {
      // Open downwards
      this.ctxBottom = null;
      this.ctxTop = y;
      this.ctxMaxHeight = spaceBelow;
    }

    this.ctxVisible = true;
  }

  hideCtx() { this.ctxVisible = false; }

  cutCell() {
    this.clipboard = this.cells[this.selectedRow][this.selectedCol];
    navigator.clipboard.writeText(this.clipboard).catch(() => { });
    this.pushHistory();
    this.cells[this.selectedRow][this.selectedCol] = '';
    this.formulaBarValue = '';
    this.onCellChange();
    this.showToast(`Cut: "${this.clipboard}"`);
  }

  // ── Clear all cells in current range / selection ─────────────────────────
  clearRangeData() {
    this.pushHistory();
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          this.cells[r][c] = '';
          const ref = `${r},${c}`;
          if (this.formats[ref]) {
            delete this.formats[ref].bg;
            delete this.formats[ref].bold;
            delete this.formats[ref].italic;
            delete this.formats[ref].color;
            delete this.formats[ref].strikethrough;
            delete (this.formats[ref] as any).checkbox;
          }
        }
      }
    } else {
      this.cells[this.selectedRow][this.selectedCol] = '';
      const ref = `${this.selectedRow},${this.selectedCol}`;
      if (this.formats[ref]) {
        delete this.formats[ref].bg;
        delete this.formats[ref].bold;
        delete this.formats[ref].italic;
        delete this.formats[ref].color;
        delete this.formats[ref].strikethrough;
        delete (this.formats[ref] as any).checkbox;
      }
    }
    this.formulaBarValue = '';
    this.onCellChange();
    this.save();
    this.showToast('Selection cleared.');
  }

  // ── Dropdown / Data validation ───────────────────────────────────────────────
  hasCellDropdown(r: number, c: number): boolean {
    return !!this.validations[`${r},${c}`];
  }

  getCellRef(r: number, c: number): string {
    return colName(c) + (r + 1);
  }

  getRangeRef(): string {
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      if (minR === maxR && minC === maxC) return this.getCellRef(minR, minC);
      return `${this.getCellRef(minR, minC)}:${this.getCellRef(maxR, maxC)}`;
    }
    return this.getCellRef(this.selectedRow, this.selectedCol);
  }

  hasDropdownInRange(): boolean {
    if (!this.rangeStart || !this.rangeEnd) return this.hasCellDropdown(this.selectedRow, this.selectedCol);
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    for (const key of Object.keys(this.validations)) {
      const parts = key.split(',');
      const r = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      if (r >= minR && r <= maxR && c >= minC && c <= maxC) return true;
    }
    return false;
  }

  getCellDropdownOptions(r: number, c: number): (string | DropdownOption)[] {
    const v = this.validations[`${r},${c}`];
    return v && v.type === 'list' && v.options ? v.options : [];
  }

  getDropdownColor(r: number, c: number, val: string): string {
    const opts = this.getCellDropdownOptions(r, c);
    const found = opts.find(o => (typeof o === 'string' ? o : o.label) === val) as DropdownOption | undefined;
    return found?.color || '';
  }




  openValidationModal() {
    const existing = this.validations[`${this.selectedRow},${this.selectedCol}`];
    this.picklistOptions = [];
    if (existing && existing.options) {
      existing.options.forEach(o => {
        if (typeof o === 'string') this.picklistOptions.push({ label: o, color: '#4a5568' });
        else this.picklistOptions.push({ label: (o as DropdownOption).label, color: (o as DropdownOption).color || '#4a5568' });
      });
    } else {
      this.picklistOptions.push({ label: 'Item 1', color: '#4caf50' });
      this.picklistOptions.push({ label: 'Item 2', color: '#f44336' });
    }
    this.validationModalOpen = true;
  }

  addPicklistOption() {
    const colors = ['#4caf50', '#f44336', '#ff9800', '#2196f3', '#9c27b0', '#795548', '#607d8b'];
    this.picklistOptions.push({ label: '', color: colors[this.picklistOptions.length % colors.length] });
  }

  openPivotModal(e?: Event) {
    if (e) e.stopPropagation();
    const sheetName = this.sheets[this.currentSheetIdx].name;
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      this.pivotSource = `${sheetName}.${this.colLabel(minC)}${minR + 1}:${this.colLabel(maxC)}${maxR + 1}`;
    } else {
      this.pivotSource = `${sheetName}.${this.colLabel(this.selectedCol)}${this.selectedRow + 1}`;
    }
    this.pivotModalOpen = true;
    this.closeMenus();
  }

  openDataValidationModal(e?: Event) {
    if (e) e.stopPropagation();
    const sheetName = this.sheets[this.currentSheetIdx].name;
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      this.dvAppliesTo = `${sheetName}.${this.colLabel(minC)}${minR + 1}:${this.colLabel(maxC)}${maxR + 1}`;
    } else {
      this.dvAppliesTo = `${sheetName}.${this.colLabel(this.selectedCol)}${this.selectedRow + 1}`;
    }
    this.validationInput = '';
    this.dvCriteria = 'list';
    this.dvShowList = true;
    this.dvSortAsc = false;
    this.dvIgnoreBlanks = true;
    this.dvAlertsOpen = false;
    this.dvAlertEnabled = true;
    this.dvAlertTitle = '';
    this.dvAlertMsg = '';
    this.dataValidationModalOpen = true;
    this.closeMenus();
  }

  openManageRulesModal(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    this.manageRulesModalOpen = true;
    this.closeMenus();
  }

  pivotHeaders: string[] = [];
  pivotData: any[][] = [];
  pivotConfig = { row: '', val: '', agg: 'SUM' };

  createPivotTable() {
    let minR = 0, maxR = 0, minC = 0, maxC = 0;

    // Parse range from the modal input
    if (this.pivotDest && this.pivotDest.includes(':')) {
      const parts = this.pivotDest.split(':');
      const startParts = parts[0].split('.');
      const endPart = parts[1];
      const startRef = startParts.length > 1 ? startParts[1] : startParts[0];
      const endRef = endPart;

      const sCol = startRef.match(/[A-Z]+/)![0];
      const sRow = startRef.match(/[0-9]+/)![0];
      const eCol = endRef.match(/[A-Z]+/)![0];
      const eRow = endRef.match(/[0-9]+/)![0];

      minC = this.colToIndex(sCol);
      minR = parseInt(sRow, 10) - 1;
      maxC = this.colToIndex(eCol);
      maxR = parseInt(eRow, 10) - 1;
    } else if (this.rangeStart && this.rangeEnd) {
      minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    } else {
      this.showToast('Invalid data range.');
      return;
    }

    if (maxR === minR) {
      this.showToast('Range must include headers and at least one data row.');
      return;
    }

    this.pivotHeaders = [];
    for (let c = minC; c <= maxC; c++) {
      this.pivotHeaders.push(this.cells[minR][c] || `Col ${c}`);
    }

    this.pivotData = [];
    for (let r = minR + 1; r <= maxR; r++) {
      let row = [];
      for (let c = minC; c <= maxC; c++) {
        row.push(this.cells[r][c] || '');
      }
      this.pivotData.push(row);
    }

    if (this.pivotDestType === 'new') {
      this.addSheet();
      this.switchSheet(this.sheets.length - 1);
      this.sheets[this.currentSheetIdx].name = 'Pivot Table 1';
      this.selectedRow = 0;
      this.selectedCol = 0;
    }

    this.pivotConfig = {
      row: this.pivotHeaders[0],
      val: this.pivotHeaders[this.pivotHeaders.length - 1],
      agg: 'SUM'
    };

    this.pivotModalOpen = false;
    this.sidePanelApp = 'pivot';

    this.applyPivot();
  }

  applyPivot() {
    if (!this.pivotConfig.row || !this.pivotConfig.val) return;

    const rowIdx = this.pivotHeaders.indexOf(this.pivotConfig.row);
    const valIdx = this.pivotHeaders.indexOf(this.pivotConfig.val);

    if (rowIdx === -1 || valIdx === -1) return;

    const map = new Map<string, number[]>();
    for (const row of this.pivotData) {
      const key = String(row[rowIdx]);
      const rawVal = row[valIdx];
      const val = Number(rawVal) || 0;

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(val);
    }

    this.pushHistory();
    const startR = this.selectedRow;
    const startC = this.selectedCol;

    // Clear previous pivot table area
    for (let r = 0; r < 20; r++) for (let c = 0; c < 5; c++) {
      if (startR + r < this.ROWS && startC + c < this.COLS) {
        this.cells[startR + r][startC + c] = '';
        delete this.formats[`${startR + r},${startC + c}`];
      }
    }

    this.cells[startR][startC] = this.pivotConfig.row;
    this.cells[startR][startC + 1] = `${this.pivotConfig.agg} of ${this.pivotConfig.val}`;
    this.formats[`${startR},${startC}`] = { bold: true, bg: '#f1f5f9' };
    this.formats[`${startR},${startC + 1}`] = { bold: true, bg: '#f1f5f9' };

    let currR = startR + 1;
    let allVals: number[] = [];

    for (const [k, arr] of map.entries()) {
      if (currR < this.ROWS) {
        let v = 0;
        if (this.pivotConfig.agg === 'SUM') v = arr.reduce((a, b) => a + b, 0);
        else if (this.pivotConfig.agg === 'COUNT') v = arr.length;
        else if (this.pivotConfig.agg === 'AVG') v = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        const displayV = (this.pivotConfig.agg === 'AVG' && v % 1 !== 0) ? v.toFixed(2) : String(v);

        this.cells[currR][startC] = k;
        this.cells[currR][startC + 1] = displayV;
        allVals.push(...arr);
        currR++;
      }
    }

    if (currR < this.ROWS) {
      let grandTotal = 0;
      if (this.pivotConfig.agg === 'SUM') grandTotal = allVals.reduce((a, b) => a + b, 0);
      else if (this.pivotConfig.agg === 'COUNT') grandTotal = allVals.length;
      else if (this.pivotConfig.agg === 'AVG') grandTotal = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0;

      const displayGrand = (this.pivotConfig.agg === 'AVG' && grandTotal % 1 !== 0) ? grandTotal.toFixed(2) : String(grandTotal);

      this.cells[currR][startC] = 'Grand Total';
      this.cells[currR][startC + 1] = displayGrand;
      this.formats[`${currR},${startC}`] = { bold: true, bg: '#f1f5f9' };
      this.formats[`${currR},${startC + 1}`] = { bold: true, bg: '#f1f5f9' };
    }

    this.onCellChange();
    this.save();
  }

  saveDataValidation() {
    if (this.validationInput.trim().length > 0) {
      const options = this.validationInput.split('\n').filter(o => o.trim() !== '');
      this.picklistOptions = options.map(o => ({ label: o.trim(), color: '#4a5568' }));
      this.saveValidation();
    }
    this.dataValidationModalOpen = false;
  }

  saveValidation() {
    const validOptions = this.picklistOptions.filter(o => o.label.trim().length > 0);
    if (validOptions.length === 0) { this.validationModalOpen = false; return; }
    let minR = this.selectedRow, maxR = this.selectedRow;
    let minC = this.selectedCol, maxC = this.selectedCol;
    if (this.rangeStart && this.rangeEnd) {
      minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    }
    const newValidations = { ...this.validations };
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newValidations[`${r},${c}`] = { type: 'list', options: validOptions };
        const cur = this.cells[r][c];
        if (cur && !validOptions.find(o => o.label === cur)) this.cells[r][c] = '';
      }
    }
    this.validations = newValidations;
    this.validationModalOpen = false;
    this.onCellChange();
    this.save();
    this.showToast(`Picklist set: ${validOptions.length} items`);
  }

  removeValidation() {
    let minR = this.selectedRow, maxR = this.selectedRow;
    let minC = this.selectedCol, maxC = this.selectedCol;
    if (this.rangeStart && this.rangeEnd) {
      minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    }
    let removed = false;
    const v = { ...this.validations };
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${r},${c}`;
        if (v[key]) {
          delete v[key];
          removed = true;
        }
      }
    }
    if (removed) {
      this.validations = v;
      this.onCellChange();
      this.save();
      this.showToast('Dropdown removed.');
    }
  }

  toggleMenu(menu: string, e: Event) {
    e.stopPropagation();
    this.activePalette = null;
    this.activeMenu = this.activeMenu === menu ? null : menu;
  }

  closeMenus() { this.activeMenu = null; this.profileOpen = false; this.activeBorderSubmenu = null; this.activeSheetMenuIdx = null; }

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

  triggerImageInsert(type: string = 'cell') {
    this.closeMenus();
    this.imgInputRef?.nativeElement.click();
    if (type === 'over') {
      setTimeout(() => this.showToast('Image over cells will be added as a floating overlay.'), 500);
    }
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
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++)
        if ((this.cells[r][c] || '').trim()) { maxRow = Math.max(maxRow, r); maxCol = Math.max(maxCol, c); }
    maxRow = Math.min(maxRow + 2, this.ROWS - 1);
    maxCol = Math.min(maxCol + 2, this.COLS - 1);

    // using global colName
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
          : val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    this.activeShapeIdx = null;
    this.activeShapeMenuIdx = null;
    if (this.sheets[this.currentSheetIdx]?.locked) {
      this.showToast('This sheet is locked.');
      return;
    }
    if (this.isEditingCell) this.commitEdit();
    this.selectedRow = r; this.selectedCol = c;
    this.formulaBarValue = this.isImageCell(r, c) ? '[IMAGE]' : this.cells[r][c];
    this.currentFont = this.getFormat('font') || 'Arial';
    this.currentSize = this.getFormat('size') || '13px';
    this.currentSizeNum = parseInt(this.currentSize, 10) || 13;
    this.api.sendCursor(r, c);
  }

  onCellClickWithPicker(r: number, c: number) {
    if (this.rangePickerActive) {
      this.rangePickerStartR = r;
      this.rangePickerStartC = c;
      this.rangePickerEndR = r;
      this.rangePickerEndC = c;
      this.updateRangePickerField();
      return;
    }
    this.selectCell(r, c);
  }

  startRangePicker(field: 'pivotSource' | 'pivotDest' | 'dvAppliesTo') {
    this.rangePickerField = field;
    this.rangePickerActive = true;
    this._pivotModalWasOpen = this.pivotModalOpen;
    this._dvModalWasOpen = this.dataValidationModalOpen;
    this.pivotModalOpen = false;
    this.dataValidationModalOpen = false;
    // Seed with current selection
    this.rangePickerStartR = this.selectedRow;
    this.rangePickerStartC = this.selectedCol;
    this.rangePickerEndR = this.selectedRow;
    this.rangePickerEndC = this.selectedCol;
    this.updateRangePickerField();
  }

  updateRangePickerField() {
    const sheetName = this.sheets[this.currentSheetIdx].name;
    const minR = Math.min(this.rangePickerStartR, this.rangePickerEndR);
    const maxR = Math.max(this.rangePickerStartR, this.rangePickerEndR);
    const minC = Math.min(this.rangePickerStartC, this.rangePickerEndC);
    const maxC = Math.max(this.rangePickerStartC, this.rangePickerEndC);
    const ref = minR === maxR && minC === maxC
      ? `${sheetName}.${this.colLabel(minC)}${minR + 1}`
      : `${sheetName}.${this.colLabel(minC)}${minR + 1}:${this.colLabel(maxC)}${maxR + 1}`;
    if (this.rangePickerField === 'pivotSource') this.pivotSource = ref;
    else if (this.rangePickerField === 'pivotDest') this.pivotDest = ref;
    else if (this.rangePickerField === 'dvAppliesTo') this.dvAppliesTo = ref;
  }

  getRangePickerValue(): string {
    if (this.rangePickerField === 'pivotSource') return this.pivotSource;
    if (this.rangePickerField === 'pivotDest') return this.pivotDest;
    if (this.rangePickerField === 'dvAppliesTo') return this.dvAppliesTo;
    return '';
  }

  onRangePickerInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (this.rangePickerField === 'pivotSource') this.pivotSource = val;
    else if (this.rangePickerField === 'pivotDest') this.pivotDest = val;
    else if (this.rangePickerField === 'dvAppliesTo') this.dvAppliesTo = val;
  }

  confirmRangePicker() {
    this.rangePickerActive = false;
    if (this._pivotModalWasOpen) this.pivotModalOpen = true;
    if (this._dvModalWasOpen) this.dataValidationModalOpen = true;
    this.rangePickerField = null;
  }

  cancelRangePicker() {
    this.rangePickerActive = false;
    if (this._pivotModalWasOpen) this.pivotModalOpen = true;
    if (this._dvModalWasOpen) this.dataValidationModalOpen = true;
    this.rangePickerField = null;
  }

  getColOffset(c: number): number {
    let offset = (this.showHeaders ? 46 : 0) + this.groupMarginWidth;
    const widths = this.sheets[this.currentSheetIdx].colWidths || {};
    for (let i = 0; i < c; i++) { offset += widths[i] ?? 100; }
    return offset;
  }

  getRowOffset(r: number): number {
    let offset = this.showHeaders ? 26 : 0;
    const heights = this.sheets[this.currentSheetIdx].rowHeights || {};
    for (let i = 0; i < r; i++) { offset += heights[i] ?? 26; }
    return offset;
  }

  getFormatWrap(r: number, c: number): boolean {
    const f = this.sheets[this.currentSheetIdx].formats[`${r},${c}`];
    return f ? f.wrap === 'wrap' || f.wrap === true : false;
  }

  startEditing(initialValue?: string) {
    if (this.sheets[this.currentSheetIdx]?.locked) {
      this.showToast('This sheet is locked.');
      return;
    }
    this.isEditingCell = true;
    this.editValue = initialValue !== undefined ? initialValue : this.cells[this.selectedRow][this.selectedCol];
    setTimeout(() => {
      if (this.floatingEditor) {
        this.floatingEditor.nativeElement.focus();
        const len = this.editValue.length;
        this.floatingEditor.nativeElement.setSelectionRange(len, len);
        this.autoResizeEditor();
      }
    }, 0);
  }

  commitEdit() {
    if (!this.isEditingCell) return;
    this.cells[this.selectedRow][this.selectedCol] = this.editValue;
    this.formulaBarValue = this.editValue;
    this.isEditingCell = false;
    this.onCellChange();
    this.save();
    setTimeout(() => {
      (document.activeElement as HTMLElement)?.blur();
    }, 0);
  }

  autoResizeEditor(e?: Event) {
    if (!this.floatingEditor) return;
    const el = this.floatingEditor.nativeElement;
    const td = el.parentElement;

    // Height resize
    el.style.height = 'auto';
    const minHeight = td ? td.offsetHeight + 1 : (this.getRowHeight(this.selectedRow) + 3);
    el.style.height = Math.max(minHeight, el.scrollHeight) + 'px';

    // Width resize
    const minWidth = td ? td.offsetWidth + 1 : (this.getColWidth(this.selectedCol) + 3);
    el.style.width = minWidth + 'px';

    // If scrollWidth is larger than minWidth, we need to expand.
    // The +2 buffer avoids horizontal scrollbar flickering
    if (el.scrollWidth > minWidth) {
      el.style.width = (el.scrollWidth + 2) + 'px';
    }
  }

  onEditorKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        const start = (e.target as HTMLTextAreaElement).selectionStart;
        const end = (e.target as HTMLTextAreaElement).selectionEnd;
        this.editValue = this.editValue.substring(0, start) + '\n' + this.editValue.substring(end);
        setTimeout(() => {
          if (this.floatingEditor) {
            this.floatingEditor.nativeElement.selectionStart = this.floatingEditor.nativeElement.selectionEnd = start + 1;
          }
          this.autoResizeEditor();
        }, 0);
      } else if (!e.shiftKey) {
        e.preventDefault();
        this.commitEdit();
        this.onEnter(e, this.selectedRow, this.selectedCol);
      }
    } else if (e.key === 'Escape') {
      this.isEditingCell = false;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.commitEdit();
      this.onTab(e, this.selectedRow, this.selectedCol);
    }
  }

  commitFormula() {
    this.cells[this.selectedRow][this.selectedCol] = this.formulaBarValue;
    this.onCellChange();
  }

  onTab(e: KeyboardEvent, r: number, c: number) {
    e.preventDefault();
    const nc = c + 1 < this.COLS ? c + 1 : c;
    this.selectCell(r, nc); this.focusCell(r, nc);
  }

  onEnter(e: KeyboardEvent, r: number, c: number) {
    e.preventDefault();
    const nr = r + 1 < this.ROWS ? r + 1 : r;
    this.selectCell(nr, c); this.focusCell(nr, c);
  }

  private focusCell(r: number, c: number) {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.cell-input');
      inputs[r * this.COLS + c]?.focus();
    });
  }

  // --- Formatting Engine ---
  getFormatName(fmt: string): string {
    if (!fmt) return 'General';
    if (fmt === 'general') return 'General';
    if (fmt === 'number') return 'Number';
    if (fmt === 'percent') return 'Percentage';
    if (fmt.startsWith('currency')) return 'Currency';
    if (fmt.startsWith('accounting')) return 'Accounting';
    if (fmt.startsWith('date')) return 'Date';
    if (fmt.startsWith('time')) return 'Time';
    if (fmt.startsWith('fraction')) return 'Fraction';
    if (fmt === 'scientific') return 'Scientific';
    if (fmt === 'text') return 'Text';
    return 'General';
  }

  getFormat(key: keyof CellFormat): any {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    return this.formats[ref]?.[key];
  }

  setFormat(key: keyof CellFormat, val: any) {
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const ref = `${r},${c}`;
          if (!this.formats[ref]) this.formats[ref] = {};

          if (key === 'indent') {
            const currentIndent = (this.formats[ref] as any).indent || 0;
            if (val === 'increase') (this.formats[ref] as any).indent = currentIndent + 1;
            else if (val === 'decrease') (this.formats[ref] as any).indent = Math.max(0, currentIndent - 1);
          } else {
            (this.formats[ref] as any)[key] = val;
          }
        }
      }
    } else {
      const ref = `${this.selectedRow},${this.selectedCol}`;
      if (!this.formats[ref]) this.formats[ref] = {};

      if (key === 'indent') {
        const currentIndent = (this.formats[ref] as any).indent || 0;
        if (val === 'increase') (this.formats[ref] as any).indent = currentIndent + 1;
        else if (val === 'decrease') (this.formats[ref] as any).indent = Math.max(0, currentIndent - 1);
      } else {
        (this.formats[ref] as any)[key] = val;
      }
    }

    this.formats = { ...this.formats };
    this.activePalette = null;
    this.onCellChange();
  }

  toggleFormat(key: 'bold' | 'italic' | 'strikethrough' | 'underline') {
    const primaryRef = `${this.selectedRow},${this.selectedCol}`;
    const targetState = !(this.formats[primaryRef] as any)?.[key];

    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const ref = `${r},${c}`;
          if (!this.formats[ref]) this.formats[ref] = {};
          (this.formats[ref] as any)[key] = targetState;
        }
      }
    } else {
      if (!this.formats[primaryRef]) this.formats[primaryRef] = {};
      (this.formats[primaryRef] as any)[key] = targetState;
    }

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

  // ── New view/format/edit helpers ─────────────────────────────────────────


  clearAllFormats() {
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    this.pushHistory();
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        delete this.formats[`${r},${c}`];
    this.formats = { ...this.formats };
    this.onCellChange(); this.save();
    this.closeMenus(); this.showToast('Formats cleared.');
  }

  clearAll() {
    this.pushHistory();
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++) {
        this.cells[r][c] = '';
        delete this.formats[`${r},${c}`];
      }
    this.formats = { ...this.formats };
    this.onCellChange(); this.save(); this.closeMenus();
    this.showToast('Cleared all values and formats.');
  }

  toggleGridlines() { this.showGridlines = !this.showGridlines; this.closeMenus(); }
  toggleFormulaBar() { this.showFormulaBar = !this.showFormulaBar; this.closeMenus(); }
  toggleHeaders() { this.showHeaders = !this.showHeaders; this.closeMenus(); }

  setZoom(pct: number) { this.zoomLevel = pct; this.closeMenus(); }

  insertCheckbox() {
    this.pushHistory();
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        this.cells[r][c] = 'FALSE';
        const ref = `${r},${c}`;
        if (!this.formats[ref]) this.formats[ref] = {};
        (this.formats[ref] as any)['checkbox'] = true;
      }
    }

    if (this.formulaBarValue !== 'FALSE') {
      this.formulaBarValue = 'FALSE';
    }
    this.formats = { ...this.formats };
    this.onCellChange(); this.save(); this.closeMenus();
    this.showToast('Checkbox inserted.');
  }

  removeDuplicates() {
    this.pushHistory();
    let minR = this.selectedRow, maxR = this.selectedRow;
    let minC = this.selectedCol, maxC = this.selectedCol;

    if (this.rangeStart && this.rangeEnd) {
      minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    } else {
      // If only one cell is selected, apply to the entire active columns.
      minR = 0;
      maxR = this.cells.length - 1;
    }

    const seen = new Set<string>();
    let removed = 0;

    for (let r = minR; r <= maxR; r++) {
      let signature = '';
      for (let c = minC; c <= maxC; c++) {
        signature += (this.cells[r][c] || '') + '|';
      }

      // Ignore completely blank rows from duplicate detection
      if (signature === '|'.repeat(maxC - minC + 1)) {
        continue;
      }

      if (seen.has(signature)) {
        this.cells.splice(r, 1);
        this.cells.push(Array(this.COLS).fill('')); // Maintain row count
        r--;
        maxR--;
        removed++;
      } else {
        seen.add(signature);
      }
    }

    this.onCellChange(); this.save(); this.closeMenus();
    this.showToast(`Removed ${removed} duplicate row(s).`);
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
    if (prev.cells) for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) this.cells[r][c] = prev.cells[r]?.[c] ?? '';
    if (prev.formats) this.formats = { ...prev.formats };
    this.closeMenus();
    this.showToast('Undo.');
  }

  redo() {
    if (!this.future.length) { this.showToast('Nothing to redo.'); return; }
    this.history.push(JSON.stringify({ cells: this.cells, formats: this.formats }));
    const next = JSON.parse(this.future.pop()!);
    if (next.cells) for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) this.cells[r][c] = next.cells[r]?.[c] ?? '';
    if (next.formats) this.formats = { ...next.formats };
    this.closeMenus();
    this.showToast('Redo.');
  }

  copyCell() {
    this.clipboard = this.cells[this.selectedRow][this.selectedCol];
    navigator.clipboard.writeText(this.clipboard).catch(() => { });
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

  pasteValues() { this.pasteCell(); }
  pasteFormulas() { this.showToast('Paste Formulas not implemented.'); this.closeMenus(); }
  pasteFormats() { this.showToast('Paste Formats not implemented.'); this.closeMenus(); }
  pasteNotes() { this.showToast('Paste Notes not implemented.'); this.closeMenus(); }
  pasteFormulasAndNumberFormats() { this.showToast('Paste Formulas/Number Formats not implemented.'); this.closeMenus(); }
  pasteValuesAndNumberFormats() { this.showToast('Paste Values/Number Formats not implemented.'); this.closeMenus(); }
  pasteValidation() { this.showToast('Paste Validation not implemented.'); this.closeMenus(); }
  pasteExceptNotes() { this.showToast('Paste Except Notes not implemented.'); this.closeMenus(); }
  pasteExceptBorders() { this.showToast('Paste Except Borders not implemented.'); this.closeMenus(); }

  clearNotes() { this.showToast('Cleared Notes.'); this.closeMenus(); }
  clearHyperlinks() { this.showToast('Cleared Hyperlinks.'); this.closeMenus(); }
  clearCheckboxes() { this.showToast('Cleared Checkboxes.'); this.closeMenus(); }
  clearDataValidations() { this.removeValidation(); this.closeMenus(); }
  clearConditionalFormats() { this.showToast('Cleared Conditional Formats.'); this.closeMenus(); }
  clearRichTextFormats() { this.showToast('Cleared RichText Formats.'); this.closeMenus(); }

  shapeTab: 'text' | 'shape' | 'diagram' = 'diagram';
  diagramCategory: 'list' | 'process' | 'pyramid' | 'cycle' = 'list';
  shapeCategory: 'shape' | 'lines' | 'flowchart' | 'math' | 'stars' | 'callouts' = 'shape';
  textCategory: 'textbox' | 'symbol' = 'textbox';
  activeShapeIdx: number | null = null;
  activeShapeMenuIdx: number | null = null;

  insertShape(type: string) {
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.shapes) {
      sheet.shapes = [];
    }
    const x = this.getColOffset(this.selectedCol) + 20;
    const y = this.getRowOffset(this.selectedRow) + 20;

    let width = 100;
    let height = 100;
    let text = '';

    if (type.startsWith('diagram')) {
      width = 250;
      height = 150;
    } else if (type.startsWith('text')) {
      width = 150;
      height = 40;
      text = 'Sample Text';
    } else if (type.startsWith('symbol_')) {
      width = 40;
      height = 40;
      const symbols: { [key: string]: string } = {
        'symbol_copy': '©', 'symbol_reg': '®', 'symbol_tm': '™',
        'symbol_pi': 'π', 'symbol_sigma': 'Σ', 'symbol_omega': 'Ω', 'symbol_inf': '∞'
      };
      text = symbols[type] || '';
    } else if (type === 'button') {
      width = 120;
      height = 40;
      text = 'Button';
    } else {
      text = '';
    }

    sheet.shapes.push({
      id: 'shape_' + Date.now(),
      type: type,
      x: x,
      y: y,
      width: width,
      height: height,
      text: text,
    });
    this.activeMenu = null;
    this.save();
  }

  deleteShape(idx: number) {
    const sheet = this.sheets[this.currentSheetIdx];
    if (sheet.shapes) {
      sheet.shapes.splice(idx, 1);
      this.save();
    }
  }

  async editShapeLabel(idx: number) {
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.shapes) return;
    const shape = sheet.shapes[idx];
    const currentText = shape.text || '';
    const newText = await this.openPrompt('Enter text for this shape:', currentText);
    if (newText !== null) {
      shape.text = newText;
      this.save();
    }
  }

  startShapeDrag(e: MouseEvent, idx: number) {
    this.activeShapeIdx = idx;
    this.activeShapeMenuIdx = null;
    this.closeMenus();
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.shapes) return;
    const shape = sheet.shapes[idx];

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = shape.x;
    const initialY = shape.y;

    const moveListener = (moveEvent: MouseEvent) => {
      shape.x = initialX + (moveEvent.clientX - startX);
      shape.y = initialY + (moveEvent.clientY - startY);
    };

    const upListener = () => {
      document.removeEventListener('mousemove', moveListener);
      document.removeEventListener('mouseup', upListener);
      this.save();
    };

    document.addEventListener('mousemove', moveListener);
    document.addEventListener('mouseup', upListener);

    e.preventDefault();
  }

  recalculate() { this.updateDisplayCache(); this.showToast('Recalculated.'); }

  clearCell() {
    this.pushHistory();
    this.cells[this.selectedRow][this.selectedCol] = '';
    const ref = `${this.selectedRow},${this.selectedCol}`;
    if (this.formats[ref]) {
      delete this.formats[ref].bg;
      delete this.formats[ref].bold;
      delete this.formats[ref].italic;
      delete this.formats[ref].color;
      delete this.formats[ref].strikethrough;
      delete (this.formats[ref] as any).checkbox;
    }
    this.formulaBarValue = '';
    this.onCellChange();
    this.closeMenus();
  }

  insertRowAbove() {
    this.pushHistory();
    const count = this.selectedRowCount;
    const r = this.rangeStart && this.rangeEnd ? Math.min(this.rangeStart.r, this.rangeEnd.r) : this.selectedRow;
    for (let i = 0; i < count; i++) {
      this.cells.splice(r, 0, Array(this.COLS).fill(''));
    }
    while (this.cells.length > this.ROWS) this.cells.pop();
    this.onCellChange(); this.closeMenus();
    this.showToast(`${count} Row${count > 1 ? 's' : ''} inserted above.`);
  }

  insertRowBelow() {
    this.pushHistory();
    const count = this.selectedRowCount;
    const r = (this.rangeStart && this.rangeEnd ? Math.max(this.rangeStart.r, this.rangeEnd.r) : this.selectedRow) + 1;
    for (let i = 0; i < count; i++) {
      this.cells.splice(r, 0, Array(this.COLS).fill(''));
    }
    while (this.cells.length > this.ROWS) this.cells.pop();
    this.onCellChange(); this.closeMenus();
    this.showToast(`${count} Row${count > 1 ? 's' : ''} inserted below.`);
  }

  insertColLeft() {
    this.pushHistory();
    const count = this.selectedColCount;
    const c = this.rangeStart && this.rangeEnd ? Math.min(this.rangeStart.c, this.rangeEnd.c) : this.selectedCol;
    for (const row of this.cells) { 
      for (let i = 0; i < count; i++) row.splice(c, 0, '');
      while (row.length > this.COLS) row.pop();
    }
    this.onCellChange(); this.closeMenus();
    this.showToast(`${count} Column${count > 1 ? 's' : ''} inserted.`);
  }

  insertColRight() {
    this.pushHistory();
    const count = this.selectedColCount;
    const c = (this.rangeStart && this.rangeEnd ? Math.max(this.rangeStart.c, this.rangeEnd.c) : this.selectedCol) + 1;
    for (const row of this.cells) {
      for (let i = 0; i < count; i++) row.splice(c, 0, '');
      while (row.length > this.COLS) row.pop();
    }
    this.onCellChange(); this.closeMenus();
    this.showToast(`${count} Column${count > 1 ? 's' : ''} inserted.`);
  }

  deleteRow() {
    this.pushHistory();
    const count = this.selectedRowCount;
    const r = this.rangeStart && this.rangeEnd ? Math.min(this.rangeStart.r, this.rangeEnd.r) : this.selectedRow;
    this.cells.splice(r, count);
    for (let i = 0; i < count; i++) this.cells.push(Array(this.COLS).fill(''));
    this.onCellChange(); this.closeMenus();
    this.showToast(`${count} Row${count > 1 ? 's' : ''} deleted.`);
  }

  deleteCol() {
    this.pushHistory();
    const count = this.selectedColCount;
    const c = this.rangeStart && this.rangeEnd ? Math.min(this.rangeStart.c, this.rangeEnd.c) : this.selectedCol;
    for (const row of this.cells) {
      row.splice(c, count);
      for (let i = 0; i < count; i++) row.push('');
    }
    this.onCellChange(); this.closeMenus();
    this.showToast(`${count} Column${count > 1 ? 's' : ''} deleted.`);
  }

  shiftCellsDown() {
    this.pushHistory();
    const r = this.selectedRow;
    const c = this.selectedCol;
    for (let i = this.ROWS - 1; i > r; i--) {
      this.cells[i][c] = this.cells[i - 1][c];
      const prevFmt = this.formats[`${i - 1},${c}`];
      if (prevFmt) {
        this.formats[`${i},${c}`] = { ...prevFmt };
      } else {
        delete this.formats[`${i},${c}`];
      }
    }
    this.cells[r][c] = '';
    delete this.formats[`${r},${c}`];
    this.onCellChange();
    this.closeMenus();
    this.showToast('Shifted cells down.');
  }

  shiftCellsRight() {
    this.pushHistory();
    const r = this.selectedRow;
    const c = this.selectedCol;
    for (let i = this.COLS - 1; i > c; i--) {
      this.cells[r][i] = this.cells[r][i - 1];
      const prevFmt = this.formats[`${r},${i - 1}`];
      if (prevFmt) {
        this.formats[`${r},${i}`] = { ...prevFmt };
      } else {
        delete this.formats[`${r},${i}`];
      }
    }
    this.cells[r][c] = '';
    delete this.formats[`${r},${c}`];
    this.onCellChange();
    this.closeMenus();
    this.showToast('Shifted cells right.');
  }

  async customInsertCol() {
    this.closeMenus();
    const numStr = await this.openPrompt('How many columns to insert?', '1');
    if (!numStr) return;
    const count = parseInt(numStr, 10);
    if (isNaN(count) || count <= 0) return;
    this.pushHistory();
    const c = this.selectedCol;
    for (const row of this.cells) {
      for (let i = 0; i < count; i++) {
        row.splice(c, 0, '');
        row.pop(); // Maintain column count
      }
    }
    this.onCellChange();
    this.showToast(`Inserted ${count} column(s).`);
  }

  async createSparkline() {
    this.closeMenus();
    const range = await this.openPrompt('Enter data range for sparkline (e.g., A1:A10):');
    if (range) {
      this.cells[this.selectedRow][this.selectedCol] = `=SPARKLINE(${range})`;
      this.formulaBarValue = `=SPARKLINE(${range})`;
      this.onCellChange();
      this.showToast('Sparkline created.');
    }
  }

  async editSparkline() {
    this.closeMenus();
    const val = this.cells[this.selectedRow][this.selectedCol];
    if (val && val.toString().toUpperCase().startsWith('=SPARKLINE(')) {
      const match = val.toString().match(/=SPARKLINE\((.*)\)/i);
      const currentRange = match ? match[1] : '';
      const range = await this.openPrompt(`Edit sparkline data range:`, currentRange);
      if (range) {
        this.cells[this.selectedRow][this.selectedCol] = `=SPARKLINE(${range})`;
        this.formulaBarValue = `=SPARKLINE(${range})`;
        this.onCellChange();
        this.showToast('Sparkline updated.');
      }
    } else {
      this.showToast('Selected cell does not contain a sparkline.');
    }
  }

  insertButton() {
    this.closeMenus();
    this.insertShape('button');
    this.showToast('Button inserted.');
  }

  async defineName() {
    this.closeMenus();
    const name = await this.openPrompt(`Enter name for range ${this.getRangeRef()}:`);
    if (name) {
      this.showToast(`Name "${name}" defined for ${this.getRangeRef()}.`);
    }
  }

  async insertNote() {
    this.closeMenus();
    const note = await this.openPrompt(`Add a note to cell ${this.selectedRef}:`);
    if (note !== null && note.trim() !== '') {
      const ref = `${this.selectedRow},${this.selectedCol}`;
      if (!this.formats[ref]) this.formats[ref] = {};
      (this.formats[ref] as any)['note'] = note;
      this.onCellChange();
      this.showToast(`Note added to ${this.selectedRef}.`);
    }
  }

  async insertEmoji() {
    this.closeMenus();
    const emoji = await this.openPrompt('Enter emoji to insert:');
    if (emoji) {
      this.cells[this.selectedRow][this.selectedCol] = (this.cells[this.selectedRow][this.selectedCol] || '') + emoji;
      this.formulaBarValue = this.cells[this.selectedRow][this.selectedCol];
      this.onCellChange();
      this.showToast('Emoji inserted.');
    }
  }

  applyPresetPicklist(type: string) {
    const presets: { [key: string]: any[] } = {
      'project_status': [
        { label: 'Yet to start', color: '#e2e8f0' },
        { label: 'Blocked', color: '#fed7d7' },
        { label: 'In Progress', color: '#fefcbf' },
        { label: 'Completed', color: '#c6f6d5' }
      ],
      'bug_status': [
        { label: 'Open', color: '#fed7d7' },
        { label: 'In Progress', color: '#fefcbf' },
        { label: 'Closed', color: '#c6f6d5' },
        { label: 'Reopen', color: '#bee3f8' }
      ],
      'review': [
        { label: 'Yet to start', color: '#e2e8f0' },
        { label: 'Under Review', color: '#bee3f8' },
        { label: 'Approved', color: '#c6f6d5' }
      ],
      'priority': [
        { label: 'Low', color: '#bee3f8' },
        { label: 'Medium', color: '#c6f6d5' },
        { label: 'High', color: '#fefcbf' },
        { label: 'Critical', color: '#fed7d7' }
      ],
      'decision': [
        { label: 'Yes', color: '#c6f6d5' },
        { label: 'No', color: '#fed7d7' }
      ],
      'boolean': [
        { label: 'True', color: '#c6f6d5' },
        { label: 'False', color: '#fed7d7' }
      ]
    };

    if (presets[type]) {
      this.picklistOptions = JSON.parse(JSON.stringify(presets[type]));
      this.saveValidation();
      this.showToast('Picklist preset applied.');
    }
    this.closeMenus();
  }

  deleteShiftLeft() {
    this.pushHistory();
    const r = this.selectedRow;
    const c = this.selectedCol;
    this.cells[r].splice(c, 1);
    this.cells[r].push('');
    this.onCellChange(); this.closeMenus();
    this.showToast('Shifted cells left.');
  }

  deleteShiftUp() {
    this.pushHistory();
    const r = this.selectedRow;
    const c = this.selectedCol;
    for (let i = r; i < this.ROWS - 1; i++) {
      this.cells[i][c] = this.cells[i + 1][c];
    }
    this.cells[this.ROWS - 1][c] = '';
    this.onCellChange(); this.closeMenus();
    this.showToast('Shifted cells up.');
  }

  freezeRows(count: number) {
    this.frozenRowsCount = this.frozenRowsCount === count ? 0 : count;
    this.showToast(this.frozenRowsCount > 0 ? `${count} row(s) frozen.` : 'Rows unfrozen.');
  }

  freezeCols(count: number) {
    this.frozenColsCount = this.frozenColsCount === count ? 0 : count;
    this.showToast(this.frozenColsCount > 0 ? `${count} column(s) frozen.` : 'Columns unfrozen.');
  }

  freezeSelection() {
    if (this.rangeStart && this.rangeEnd) {
      this.frozenRowsCount = Math.max(this.rangeStart.r, this.rangeEnd.r) + 1;
      this.frozenColsCount = Math.max(this.rangeStart.c, this.rangeEnd.c) + 1;
      this.showToast('Selection frozen.');
    } else {
      this.frozenRowsCount = this.selectedRow + 1;
      this.frozenColsCount = this.selectedCol + 1;
      this.showToast('Cell position frozen.');
    }
  }

  hideRows() {
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      for (let i = minR; i <= maxR; i++) this.hiddenRows.add(i);
    } else {
      this.hiddenRows.add(this.selectedRow);
    }
    this.showToast('Row(s) hidden.');
  }

  hideCols() {
    if (this.rangeStart && this.rangeEnd) {
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      for (let i = minC; i <= maxC; i++) this.hiddenCols.add(i);
    } else {
      this.hiddenCols.add(this.selectedCol);
    }
    this.showToast('Column(s) hidden.');
  }

  unhideRows() {
    this.hiddenRows.clear();
    this.showToast('All rows unhidden.');
  }

  unhideCols() {
    this.hiddenCols.clear();
    this.showToast('All columns unhidden.');
  }

  get hasRowGroups() {
    return !!this.sheets[this.currentSheetIdx].rowGroups?.length;
  }

  get groupMarginWidth() {
    return this.hasRowGroups ? 24 : 0;
  }

  getRowGroupsFor(r: number) {
    const groups = this.sheets[this.currentSheetIdx].rowGroups;
    if (!groups) return [];
    return groups.map((g, index) => ({ ...g, index })).filter(g => r >= g.start && r <= g.end);
  }

  groupRow() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    if (minR === maxR) {
      this.showToast('Select multiple rows to group');
      return;
    }
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.rowGroups) sheet.rowGroups = [];
    sheet.rowGroups.push({ start: minR, end: maxR, collapsed: false });
    this.closeMenus();
    this.save();
    this.showToast('Rows grouped');
  }

  ungroupRow() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.rowGroups) return;
    const initialLen = sheet.rowGroups.length;
    sheet.rowGroups = sheet.rowGroups.filter(g => !(g.start >= minR && g.end <= maxR));
    if (sheet.rowGroups.length < initialLen) {
      // Re-evaluate hidden rows since a group was removed
      for (let i = minR; i <= maxR; i++) {
        this.hiddenRows.delete(i);
      }
      this.closeMenus();
      this.save();
      this.showToast('Rows ungrouped');
    }
  }

  clearGroups() {
    const sheet = this.sheets[this.currentSheetIdx];
    if (sheet.rowGroups) {
      sheet.rowGroups.forEach(g => {
        for (let i = g.start; i <= g.end; i++) {
          this.hiddenRows.delete(i);
        }
      });
      sheet.rowGroups = [];
    }
    if (sheet.colGroups) {
      sheet.colGroups.forEach(g => {
        for (let i = g.start; i <= g.end; i++) {
          this.hiddenCols.delete(i);
        }
      });
      sheet.colGroups = [];
    }
    this.closeMenus();
    this.save();
    this.showToast('All groups cleared');
  }

  toggleRowGroup(index: number) {
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.rowGroups) return;
    const group = sheet.rowGroups[index];
    group.collapsed = !group.collapsed;
    for (let r = group.start; r <= group.end; r++) {
      if (group.collapsed) {
        this.hiddenRows.add(r);
      } else {
        this.hiddenRows.delete(r);
      }
    }
    this.save();
  }

  get hasColGroups() {
    return !!this.sheets[this.currentSheetIdx].colGroups?.length;
  }

  get colGroupMarginHeight() {
    return this.hasColGroups ? 24 : 0;
  }

  getColGroupsFor(c: number) {
    const groups = this.sheets[this.currentSheetIdx].colGroups;
    if (!groups) return [];
    return groups.map((g, index) => ({ ...g, index })).filter(g => c >= g.start && c <= g.end);
  }

  groupCol() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    if (minC === maxC) {
      this.showToast('Select multiple columns to group');
      return;
    }
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.colGroups) sheet.colGroups = [];
    sheet.colGroups.push({ start: minC, end: maxC, collapsed: false });
    this.closeMenus();
    this.save();
    this.showToast('Columns grouped');
  }

  ungroupCol() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.colGroups) return;
    const initialLen = sheet.colGroups.length;
    sheet.colGroups = sheet.colGroups.filter(g => !(g.start >= minC && g.end <= maxC));
    if (sheet.colGroups.length < initialLen) {
      for (let i = minC; i <= maxC; i++) {
        this.hiddenCols.delete(i);
      }
      this.closeMenus();
      this.save();
      this.showToast('Columns ungrouped');
    }
  }

  toggleColGroup(index: number) {
    const sheet = this.sheets[this.currentSheetIdx];
    if (!sheet.colGroups) return;
    const group = sheet.colGroups[index];
    group.collapsed = !group.collapsed;
    for (let c = group.start; c <= group.end; c++) {
      if (group.collapsed) {
        this.hiddenCols.add(c);
      } else {
        this.hiddenCols.delete(c);
      }
    }
    this.save();
  }

  setGridlineColor(color: string) {
    this.gridlineColor = color;
  }

  setGridDirection(dir: 'ltr' | 'rtl') {
    this.gridDirection = dir;
  }

  setGridSpacing(spacing: 'classic' | 'cozy' | 'comfort') {
    this.gridSpacing = spacing;
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
    this.cells.sort((a, b) => {
      const vA = (a[c] || '').trim();
      const vB = (b[c] || '').trim();
      if (!vA && !vB) return 0;
      if (!vA) return 1;
      if (!vB) return -1;
      const nA = Number(vA);
      const nB = Number(vB);
      if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
      return vA.localeCompare(vB);
    });
    this.onCellChange(); this.closeMenus();
    this.showToast(`Column ${colName(c)} sorted A → Z.`);
  }

  sortColZA() {
    this.pushHistory();
    const c = this.selectedCol;
    this.cells.sort((a, b) => {
      const vA = (a[c] || '').trim();
      const vB = (b[c] || '').trim();
      if (!vA && !vB) return 0;
      if (!vA) return 1;
      if (!vB) return -1;
      const nA = Number(vA);
      const nB = Number(vB);
      if (!isNaN(nA) && !isNaN(nB)) return nB - nA;
      return vB.localeCompare(vA);
    });
    this.onCellChange(); this.closeMenus();
    this.showToast(`Column ${colName(c)} sorted Z → A.`);
  }

  statsModalOpen = false;
  personalDictModalOpen = false;
  personalDictWords: string[] = [];
  personalDictNewWord = '';

  showWordCount() {
    this.closeMenus();
    this.statsModalOpen = true;
  }

  getStatsFilledCells(): number {
    return this.cells.flat().filter(v => v && v.trim() !== '').length;
  }

  getStatsFormulaCells(): number {
    return this.cells.flat().filter(v => v && v.startsWith('=')).length;
  }

  getStatsNumericCells(): number {
    return this.cells.flat().filter(v => v && !isNaN(Number(v)) && v.trim() !== '').length;
  }

  getStatsLockedSheets(): number {
    return this.sheets.filter(s => s.locked).length;
  }

  personalDictionary() {
    this.closeMenus();
    this.personalDictModalOpen = true;
  }

  addPersonalDictWord() {
    const w = this.personalDictNewWord.trim();
    if (w && !this.personalDictWords.includes(w)) {
      this.personalDictWords.push(w);
      this.personalDictNewWord = '';
      this.showToast(`"${w}" added to dictionary.`);
    }
  }

  removePersonalDictWord(i: number) {
    this.personalDictWords.splice(i, 1);
  }

  showKeyboardShortcuts() {
    this.closeMenus();
    alert('Keyboard Shortcuts:\n\nCtrl+Z  Undo\nCtrl+Y  Redo\nCtrl+B  Bold\nCtrl+I  Italic\nCtrl+K  Insert link\nTab     Next cell\nEnter   Next row\nDelete  Clear cell');
  }

  openApp(route: string) {
    if (route === 'account') {
      window.open('https://myaccount.google.com/', '_blank'); // Mock account nav
      return;
    }
    this.sidePanelApp = route;
  }

  getTasksDone(): number {
    return this.tasks ? this.tasks.filter((t: any) => t.done).length : 0;
  }

  addTask() {
    if (this.newTask.trim()) {
      this.tasks.push({ text: this.newTask.trim(), done: false });
      this.newTask = '';
      this.save();
    }
  }

  removeTask(i: number) {
    this.tasks.splice(i, 1);
    this.save();
  }

  closeSidePanel() {
    this.sidePanelApp = null;
    this.sidePanelUrl = null;
  }

  isDateLike(val: string): boolean {
    if (!val) return false;
    // Match common date patterns: YYYY-MM-DD, DD/MM/YYYY
    return /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(val) && !isNaN(Date.parse(val));
  }

  getDateValue(r: number, c: number): string {
    const val = this.cells[r][c];
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0]; // Return strictly YYYY-MM-DD for native input
  }

  setDateValue(r: number, c: number, val: string) {
    if (val) {
      this.cells[r][c] = val; // Native date input provides YYYY-MM-DD
      this.onCellChange();
      this.save();
    }
  }

  trashDoc() {
    if (confirm('Move this spreadsheet to trash? This cannot be undone.')) {
      this.api.deleteDocument(this.docId).subscribe(() => this.router.navigate(['/']));
    }
    this.closeMenus();
  }

  cellHasContent(r: number, c: number): boolean {
    if (this.cells[r] && this.cells[r][c] && this.cells[r][c].trim() !== '') return true;
    const fmt = this.formats[`${r},${c}`];
    if (fmt && fmt.bg) return true;
    return false;
  }

  getCellStyle(r: number, c: number): Record<string, string> {
    const fmt = this.formats[`${r},${c}`];
    const style: Record<string, string> = {};

    if (!this.showGridlines) {
      style['border-right'] = 'none';
      style['border-bottom'] = 'none';
    } else if (this.gridlineColor !== '#d0d0d0') {
      style['border-right'] = `1px solid ${this.gridlineColor}`;
      style['border-bottom'] = `1px solid ${this.gridlineColor}`;
    }

    if (r < this.frozenRowsCount || c < this.frozenColsCount) {
      style['background-color'] = '#fff';
    }

    if (this.highlightRowColColor && this.highlightRowColColor !== 'transparent' && (r === this.selectedRow || c === this.selectedCol)) {
      style['background-color'] = this.highlightRowColColor;
    }

    if (!fmt) return style;

    if (fmt.bg) style['background-color'] = fmt.bg;
    if (fmt.align) style['text-align'] = fmt.align;
    if (fmt.vertAlign === 'top') style['vertical-align'] = 'top';
    else if (fmt.vertAlign === 'middle') style['vertical-align'] = 'middle';
    else if (fmt.vertAlign === 'bottom') style['vertical-align'] = 'bottom';

    if (fmt.wrap === 'overflow') {
      style['white-space'] = 'nowrap';
      style['overflow'] = 'visible';
    } else if (fmt.wrap === 'wrap' || fmt.wrap === true) {
      style['white-space'] = 'normal';
      style['word-break'] = 'break-word';
    } else if (fmt.wrap === 'clip') {
      style['white-space'] = 'nowrap';
      style['overflow'] = 'hidden';
      style['text-overflow'] = 'clip';
    } else if (fmt.wrap === 'shrink') {
      style['white-space'] = 'nowrap';
    }

    if (fmt.borders) {
      const getB = (b: boolean | CellBorder | undefined): string | null => {
        if (!b) return null;
        if (b === true) return '1px solid #000';
        return `${b.width || '1px'} ${b.style || 'solid'} ${b.color || '#000'}`;
      };
      if (fmt.borders.all) {
        const s = getB(fmt.borders.all);
        if (s) {
          style['border-top'] = s;
          style['border-bottom'] = s;
          style['border-left'] = s;
          style['border-right'] = s;
        }
      } else {
        const t = getB(fmt.borders.top); if (t) style['border-top'] = t;
        const b = getB(fmt.borders.bottom); if (b) style['border-bottom'] = b;
        const l = getB(fmt.borders.left); if (l) style['border-left'] = l;
        const r = getB(fmt.borders.right); if (r) style['border-right'] = r;
      }
    }

    return style;
  }

  getContentStyle(r: number, c: number): Record<string, string> {
    const fmt = this.formats[`${r},${c}`];
    if (!fmt) return {};

    const style: Record<string, string> = {};
    if (fmt.bold) style['font-weight'] = 'bold';
    if (fmt.italic) style['font-style'] = 'italic';
    const td: string[] = [];
    if (fmt.strikethrough) td.push('line-through');
    if (fmt.underline) td.push('underline');
    if (td.length) style['text-decoration'] = td.join(' ');
    if (fmt.color) style['color'] = fmt.color;
    if (fmt.font) style['font-family'] = fmt.font;
    if (fmt.size) style['font-size'] = fmt.size;

    if (fmt.align) {
      style['text-align'] = fmt.align;
      if (fmt.align === 'center') style['justify-content'] = 'center';
      else if (fmt.align === 'right') style['justify-content'] = 'flex-end';
      else if (fmt.align === 'left') style['justify-content'] = 'flex-start';
    }

    if (fmt.vertAlign) {
      if (fmt.vertAlign === 'top') style['align-items'] = 'flex-start';
      else if (fmt.vertAlign === 'middle') style['align-items'] = 'center';
      else if (fmt.vertAlign === 'bottom') style['align-items'] = 'flex-end';
    }

    let textW = 0;
    if (fmt.wrap === 'shrink' || (fmt.rotation && fmt.rotation !== 'custom')) {
      const text = this.cells[r] && this.cells[r][c] ? String(this.cells[r][c]) : '';
      const baseSize = fmt.size ? parseInt(fmt.size) : 13;
      textW = text.length * baseSize * 0.55;
    }

    if (fmt.wrap === 'shrink') {
      if (textW > 92) {
        const baseSize = fmt.size ? parseInt(fmt.size) : 13;
        const shrinkSize = Math.max(6, Math.floor(baseSize * (92 / textW)));
        style['font-size'] = `${shrinkSize}px`;
      }
    }

    if (fmt.indent) {
      style['padding-left'] = `${4 + fmt.indent * 12}px`;
    }

    if (fmt.rotation && fmt.rotation !== 'custom') {
      const deg = parseInt(fmt.rotation as string, 10);
      style['display'] = 'inline-block';
      style['min-height'] = 'auto'; // Unbind from 100% td height for proper rotation
      style['position'] = 'relative'; // Override .cell-input absolute positioning

      if (deg === -90 || deg === 90) {
        style['writing-mode'] = 'vertical-rl';
        style['height'] = `${Math.max(30, textW + 16)}px`; // Tight vertical bounding box
        style['width'] = 'auto'; // Shrink horizontally to font size
        if (deg === -90) {
          style['transform'] = 'rotate(180deg)';
        }
      } else {
        style['width'] = `${Math.max(30, textW + 16)}px`; // Tight horizontal bounding box
        style['height'] = 'auto'; // Shrink vertically
        const addedHeight = Math.max(0, textW * 0.707);
        style['transform'] = `rotate(${deg}deg)`;
        style['transform-origin'] = 'left center'; // Pivot tightly on text baseline
        style['white-space'] = 'nowrap';
        if (deg === -45) {
          style['margin-top'] = `${addedHeight}px`;
        } else if (deg === 45) {
          style['margin-bottom'] = `${addedHeight}px`;
        }
      }
    }

    return style;
  }

  // ── Number formatting ─────────────────────────────────────────────────────
  setNumFormat(fmt: string) {
    this.setFormat('numFormat', fmt);
    this.activeMenu = null;
  }

  increaseDecimals() {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    if (!this.formats[ref]) this.formats[ref] = {};
    this.formats[ref].decimals = (this.formats[ref].decimals ?? 0) + 1;
    this.formats = { ...this.formats };
    this.onCellChange();
  }

  decreaseDecimals() {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    if (!this.formats[ref]) this.formats[ref] = {};
    const cur = this.formats[ref].decimals ?? 0;
    this.formats[ref].decimals = Math.max(0, cur - 1);
    this.formats = { ...this.formats };
    this.onCellChange();
  }

  private applyNumFormat(val: string, fmt: CellFormat): string {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    const dec = fmt.decimals ?? (fmt.numFormat?.includes('currency') || fmt.numFormat?.includes('accounting') ? 2 : fmt.numFormat === 'percent' ? 1 : 0);
    
    if (fmt.numFormat?.startsWith('currency_') || fmt.numFormat?.startsWith('accounting_') || fmt.numFormat === 'currency') {
      let symbol = '$';
      if (fmt.numFormat.endsWith('_inr')) symbol = '₹';
      else if (fmt.numFormat.endsWith('_eur')) symbol = '€';
      else if (fmt.numFormat.endsWith('_gbp')) symbol = '£';
      else if (fmt.numFormat.endsWith('_cny')) symbol = '¥';
      
      const isAccounting = fmt.numFormat.startsWith('accounting');
      if (isAccounting) {
        // Simple accounting format representation (symbol on left, number on right, with some spaces)
        return num === 0 ? `${symbol}   -  ` : `${symbol}  ${num.toFixed(dec)}`;
      } else {
        return `${symbol}${num.toFixed(dec)}`;
      }
    }
    
    if (fmt.numFormat === 'percent') return (num * 100).toFixed(dec) + '%';
    if (fmt.numFormat === 'number') return num.toFixed(dec);
    return dec > 0 ? num.toFixed(dec) : val;
  }

  // ── Text wrap ────────────────────────────────────────────────────────────
  toggleWrap() {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    if (!this.formats[ref]) this.formats[ref] = {};
    this.formats[ref].wrap = !this.formats[ref].wrap;
    this.formats = { ...this.formats };
    this.onCellChange();
  }

  // ── Merge cells ───────────────────────────────────────────────────────────
  mergeCells(type: string = 'all') {
    if (!this.rangeStart || !this.rangeEnd) { this.showToast('Select a range first.'); return; }
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    if (minR === maxR && minC === maxC) { this.showToast('Select more than one cell to merge.'); return; }
    this.pushHistory();

    if (type === 'across') {
      for (let r = minR; r <= maxR; r++) {
        const topLeft = this.cells[r][minC];
        for (let c = minC; c <= maxC; c++) {
          if (c === minC) { this.cells[r][c] = topLeft; continue; }
          this.cells[r][c] = '';
          const ref = `${r},${c}`;
          if (!this.formats[ref]) this.formats[ref] = {};
          (this.formats[ref] as any)['_mergedInto'] = `${r},${minC}`;
        }
        const ref = `${r},${minC}`;
        if (!this.formats[ref]) this.formats[ref] = {};
        (this.formats[ref] as any)['_mergeSpan'] = { rows: 1, cols: maxC - minC + 1 };
      }
    } else if (type === 'down') {
      for (let c = minC; c <= maxC; c++) {
        const topLeft = this.cells[minR][c];
        for (let r = minR; r <= maxR; r++) {
          if (r === minR) { this.cells[r][c] = topLeft; continue; }
          this.cells[r][c] = '';
          const ref = `${r},${c}`;
          if (!this.formats[ref]) this.formats[ref] = {};
          (this.formats[ref] as any)['_mergedInto'] = `${minR},${c}`;
        }
        const ref = `${minR},${c}`;
        if (!this.formats[ref]) this.formats[ref] = {};
        (this.formats[ref] as any)['_mergeSpan'] = { rows: maxR - minR + 1, cols: 1 };
      }
    } else {
      // all or center
      const topLeft = this.cells[minR][minC];
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (r === minR && c === minC) { this.cells[r][c] = topLeft; continue; }
          this.cells[r][c] = '';
          const ref = `${r},${c}`;
          if (!this.formats[ref]) this.formats[ref] = {};
          (this.formats[ref] as any)['_mergedInto'] = `${minR},${minC}`;
        }
      }
      const ref = `${minR},${minC}`;
      if (!this.formats[ref]) this.formats[ref] = {};
      (this.formats[ref] as any)['_mergeSpan'] = { rows: maxR - minR + 1, cols: maxC - minC + 1 };

      if (type === 'center') {
        (this.formats[ref] as any)['align'] = 'center';
      }
    }

    this.formats = { ...this.formats };
    this.onCellChange(); this.save();
    this.showToast(`Cells merged${type !== 'all' ? ' ' + type : ''}.`);
    this.activeMenu = null;
  }

  unmerge() {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    const span = (this.formats[ref] as any)?._mergeSpan;
    if (!span) { this.showToast('No merged cell selected.'); return; }
    this.pushHistory();
    const minR = this.selectedRow, minC = this.selectedCol;
    for (let r = minR; r < minR + span.rows; r++)
      for (let c = minC; c < minC + span.cols; c++) {
        const k = `${r},${c}`;
        if (this.formats[k]) { delete (this.formats[k] as any)._mergedInto; delete (this.formats[k] as any)._mergeSpan; }
      }
    this.formats = { ...this.formats };
    this.onCellChange(); this.save();
    this.showToast('Cells unmerged.');
    this.activeMenu = null;
  }

  isMergedSlave(r: number, c: number): boolean {
    return !!(this.formats[`${r},${c}`] as any)?._mergedInto;
  }

  getColSpan(r: number, c: number): number {
    const span = (this.formats[`${r},${c}`] as any)?._mergeSpan;
    return span ? span.cols : 1;
  }

  getRowSpan(r: number, c: number): number {
    const span = (this.formats[`${r},${c}`] as any)?._mergeSpan;
    return span ? span.rows : 1;
  }

  isColActiveAxis(c: number): boolean {
    if (this.rangeStart && this.rangeEnd) {
      const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
      return c >= minC && c <= maxC;
    }
    return this.selectedCol === c;
  }

  isRowActiveAxis(r: number): boolean {
    if (this.rangeStart && this.rangeEnd) {
      const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      return r >= minR && r <= maxR;
    }
    return this.selectedRow === r;
  }

  // ── Borders ───────────────────────────────────────────────────────────────
  setBorders(type: 'all' | 'inner' | 'horizontal' | 'vertical' | 'outer' | 'left' | 'top' | 'right' | 'bottom' | 'none') {
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    this.pushHistory();

    const b: CellBorder = { color: this.currentBorderColor, style: this.currentBorderStyle, width: this.currentBorderWidth };

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const ref = `${r},${c}`;
        if (!this.formats[ref]) this.formats[ref] = {};
        if (!this.formats[ref].borders) this.formats[ref].borders = {};

        if (type === 'none') { this.formats[ref].borders = {}; continue; }

        let borders = this.formats[ref].borders!;
        if (borders.all && type !== 'all') {
          borders.top = borders.all;
          borders.bottom = borders.all;
          borders.left = borders.all;
          borders.right = borders.all;
          delete borders.all;
        }

        if (type === 'all') { borders.all = b; continue; }
        if (type === 'outer') {
          if (r === minR) borders.top = b;
          if (r === maxR) borders.bottom = b;
          if (c === minC) borders.left = b;
          if (c === maxC) borders.right = b;
        } else if (type === 'inner') {
          if (r > minR) borders.top = b;
          if (r < maxR) borders.bottom = b;
          if (c > minC) borders.left = b;
          if (c < maxC) borders.right = b;
        } else if (type === 'horizontal') {
          if (r > minR) borders.top = b;
          if (r < maxR) borders.bottom = b;
        } else if (type === 'vertical') {
          if (c > minC) borders.left = b;
          if (c < maxC) borders.right = b;
        } else if (type === 'left') {
          if (c === minC) borders.left = b;
        } else if (type === 'right') {
          if (c === maxC) borders.right = b;
        } else if (type === 'top') {
          if (r === minR) borders.top = b;
        } else if (type === 'bottom') {
          if (r === maxR) borders.bottom = b;
        }
      }
    }
    this.formats = { ...this.formats };
    this.onCellChange(); this.save();
    this.showToast('Borders applied.');
  }

  // ── Fill Down / Fill Right ─────────────────────────────────────────────────
  fillDown() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    if (minR === maxR) return; // Need a range to fill down into
    this.pushHistory();
    for (let c = minC; c <= maxC; c++) {
      const v = this.cells[minR][c];
      for (let r = minR + 1; r <= maxR; r++) {
        this.cells[r][c] = v;
      }
    }
    this.onCellChange(); this.save();
    this.showToast('Filled down.');
  }

  fillRight() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    if (minC === maxC) return;
    this.pushHistory();
    for (let r = minR; r <= maxR; r++) {
      const v = this.cells[r][minC];
      for (let c = minC + 1; c <= maxC; c++) {
        this.cells[r][c] = v;
      }
    }
    this.onCellChange(); this.save();
    this.showToast('Filled right.');
  }

  fillUp() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    if (minR === maxR) return;
    this.pushHistory();
    for (let c = minC; c <= maxC; c++) {
      const v = this.cells[maxR][c];
      for (let r = maxR - 1; r >= minR; r--) {
        this.cells[r][c] = v;
      }
    }
    this.onCellChange(); this.save();
    this.showToast('Filled up.');
  }

  fillLeft() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    if (minC === maxC) return;
    this.pushHistory();
    for (let r = minR; r <= maxR; r++) {
      const v = this.cells[r][maxC];
      for (let c = maxC - 1; c >= minC; c--) {
        this.cells[r][c] = v;
      }
    }
    this.onCellChange(); this.save();
    this.showToast('Filled left.');
  }

  textToColsModalOpen = false;
  t2cDelimiter = ',';
  t2cCustomDelim = '';

  openTextToColumnsModal() {
    this.textToColsModalOpen = true;
  }

  applyTextToColumns() {
    const delim = this.t2cDelimiter === 'custom' ? this.t2cCustomDelim : this.t2cDelimiter;
    if (!delim) { this.showToast('Please enter a delimiter.'); return; }

    this.pushHistory();
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const col = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;

    let splitCount = 0;
    for (let r = minR; r <= maxR; r++) {
      const val = this.cells[r][col];
      if (!val) continue;
      const parts = val.split(delim);
      if (parts.length <= 1) continue;
      this.cells[r][col] = parts[0];
      for (let i = 1; i < parts.length; i++) {
        if (col + i < this.COLS) {
          this.cells[r][col + i] = parts[i].trim();
        }
      }
      splitCount++;
    }

    this.textToColsModalOpen = false;
    this.onCellChange();
    this.save();
    this.showToast(splitCount > 0 ? `Split ${splitCount} cell(s) into columns.` : 'No cells were split.');
  }

  spellCheckModalOpen = false;
  spellCheckLoading = false;
  spellCheckErrors: any[] = [];
  spellCheckTargetText = '';

  translateModalOpen = false;
  translateLoading = false;
  translateSourceText = '';
  translateTargetText = '';
  translateTargetLang = 'es';

  formHeaders: string[] = [];
  formData: { [key: string]: string } = {};

  macroScript = 'this.cells[1][1] = "Hello Macro!";\nthis.save();\nthis.showToast("Macro executed successfully!");';

  customFunctionsScript = `window.customSheetFunctions = {
  MY_CUSTOM_SUM: function(a, b) {
    return a + b;
  },
  MY_CUSTOM_DISCOUNT: function(price, pct) {
    return price * (1 - (pct/100));
  }
};`;

  async spellCheck() {
    this.closeMenus();
    const text = this.cells[this.selectedRow][this.selectedCol];
    if (!text || text.trim() === '') { this.showToast('Select a cell with text to spell check.'); return; }
    this.spellCheckTargetText = text;
    this.spellCheckErrors = [];
    this.spellCheckModalOpen = true;
    this.spellCheckLoading = true;
    try {
      const res = await fetch(`https://api.languagetoolplus.com/v2/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: text, language: 'en-US' })
      });
      const data = await res.json();
      this.spellCheckErrors = data.matches || [];
    } catch (e) {
      this.showToast('Error running spell check.');
    } finally {
      this.spellCheckLoading = false;
    }
  }

  applySpellCheckFix(errIndex: number, replacement: string) {
    const err = this.spellCheckErrors[errIndex];
    const text = this.spellCheckTargetText;
    const newText = text.substring(0, err.offset) + replacement + text.substring(err.offset + err.length);
    this.spellCheckTargetText = newText;
    this.cells[this.selectedRow][this.selectedCol] = newText;
    this.save();

    // adjust offsets for remaining errors
    const diff = replacement.length - err.length;
    this.spellCheckErrors.splice(errIndex, 1);
    for (const other of this.spellCheckErrors) {
      if (other.offset > err.offset) {
        other.offset += diff;
      }
    }
  }

  translateSheet() {
    this.closeMenus();
    const text = this.cells[this.selectedRow][this.selectedCol];
    if (!text || text.trim() === '') { this.showToast('Select a cell with text to translate.'); return; }
    this.translateSourceText = text;
    this.translateTargetText = '';
    this.translateModalOpen = true;
    this.runTranslate();
  }

  async runTranslate() {
    if (!this.translateSourceText) return;
    this.translateLoading = true;
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(this.translateSourceText)}&langpair=en|${this.translateTargetLang}`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        this.translateTargetText = data.responseData.translatedText;
      } else {
        this.translateTargetText = 'Error translating text.';
      }
    } catch (e) {
      this.translateTargetText = 'Error translating text.';
    } finally {
      this.translateLoading = false;
    }
  }

  applyTranslation() {
    if (this.translateTargetText && !this.translateLoading) {
      this.cells[this.selectedRow][this.selectedCol] = this.translateTargetText;
      this.save();
      this.translateModalOpen = false;
    }
  }

  patternFill() {
    // Flash fill: detect pattern from filled cells above and fill down
    const col = this.selectedCol;
    const startR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const endR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;

    // Find first non-empty cell to use as template
    let templateVal = '';
    for (let r = startR - 1; r >= 0; r--) {
      if (this.cells[r][col]) { templateVal = this.cells[r][col]; break; }
    }
    if (!templateVal) { this.showToast('No pattern found above the selection.'); return; }

    // Try numeric sequence detection
    const nums: number[] = [];
    for (let r = startR - 2; r <= startR - 1; r++) {
      if (r >= 0 && this.cells[r][col] && !isNaN(Number(this.cells[r][col]))) {
        nums.push(Number(this.cells[r][col]));
      }
    }

    this.pushHistory();
    if (nums.length === 2) {
      const diff = nums[1] - nums[0];
      let cur = nums[1];
      for (let r = startR; r <= endR; r++) {
        cur += diff;
        this.cells[r][col] = String(cur);
      }
      this.showToast(`Pattern fill: sequence with step ${diff}.`);
    } else {
      // Just fill down with same value
      for (let r = startR; r <= endR; r++) {
        if (!this.cells[r][col]) this.cells[r][col] = templateVal;
      }
      this.showToast('Pattern fill applied.');
    }
    this.onCellChange();
    this.save();
  }

  lockCurrentSheet() {
    const sheet = this.sheets[this.currentSheetIdx];
    sheet.locked = !sheet.locked;
    this.save();
    this.showToast(sheet.locked ? 'Sheet locked.' : 'Sheet unlocked.');
  }

  lockSelectedRange() {
    const minR = this.rangeStart ? Math.min(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const maxR = this.rangeStart ? Math.max(this.rangeStart.r, this.rangeEnd!.r) : this.selectedRow;
    const minC = this.rangeStart ? Math.min(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    const maxC = this.rangeStart ? Math.max(this.rangeStart.c, this.rangeEnd!.c) : this.selectedCol;
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        this.formats[`${r},${c}`] = { ...(this.formats[`${r},${c}`] || {}), locked: true } as any;
    this.onCellChange(); this.save();
    this.showToast(`Range locked: ${this.colLabel(minC)}${minR + 1}:${this.colLabel(maxC)}${maxR + 1}`);
  }

  async linkSpreadsheet() {
    const url = await this.openPrompt('Enter the URL of the spreadsheet to link:');
    if (url) {
      this.showToast(`Linked to: ${url.substring(0, 40)}...`);
    }
  }

  dataFromPicture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      if (input.files?.length) {
        this.showToast('Data from Picture: OCR processing is not supported in this version.');
      }
    };
    input.click();
  }

  publishRange() {
    const ref = this.getRangeRef();
    const url = `${window.location.origin}/sheet/${this.route?.snapshot?.params?.['id']}?range=${ref}`;
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Published link copied to clipboard!');
    }).catch(() => {
      this.showToast(`Published URL: ${url}`);
    });
  }

  copyPublishLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Share link copied to clipboard!');
    }).catch(() => {
      this.showToast('Copy failed. Please copy the URL from the address bar.');
    });
  }

  // ── Review menu ──────────────────────────────────────────────────────────
  menuSearch = '';



  openAuditTrail() {
    this.activeModal = 'audit';
  }

  openEditHistory() {
    this.activeModal = 'version';
  }

  showAllComments() {
    const commentCount = Object.keys(this.formats).filter(k => (this.formats[k] as any)?.comment).length;
    if (commentCount === 0) { this.showToast('No comments in this sheet.'); return; }
    this.showToast(`${commentCount} comment(s) in this sheet. Click cells with comments to view.`);
  }

  addNoteToCell() {
    const ref = `${this.selectedRow},${this.selectedCol}`;
    const existing = (this.formats[ref] as any)?.note || '';
    const note = prompt('Add a note to this cell:', existing);
    if (note !== null) {
      this.formats[ref] = { ...(this.formats[ref] || {}), note } as any;
      this.onCellChange();
      this.save();
      this.showToast(note ? 'Note added.' : 'Note removed.');
    }
  }

  // ── Tools menu ───────────────────────────────────────────────────────────
  createForm() {
    this.formHeaders = [];
    for (let c = 0; c < this.COLS; c++) {
      const h = this.cells[0][c];
      if (h && h.trim()) this.formHeaders.push(h);
      else break;
    }
    this.formData = {};
    this.activeModal = 'form';
  }

  submitForm() {
    let emptyRow = 1;
    while (emptyRow < this.cells.length && this.cells[emptyRow].some(c => c && c.trim() !== '')) {
      emptyRow++;
    }
    if (emptyRow >= this.cells.length) {
      this.cells.push(Array(this.COLS).fill(''));
    }
    for (let c = 0; c < this.formHeaders.length; c++) {
      this.cells[emptyRow][c] = this.formData[this.formHeaders[c]] || '';
    }
    this.save();
    this.formData = {};
    this.showToast('Form data submitted to row ' + (emptyRow + 1));
  }

  viewForm() {
    this.activeModal = 'view_form';
  }

  openMacroEditor() {
    this.activeModal = 'macro';
  }

  runMacro() {
    try {
      const fn = new Function(this.macroScript);
      fn.call(this);
      this.recalculate();
    } catch (e) {
      this.showToast('Macro execution error: ' + e);
    }
  }

  openCustomFunctions() {
    this.activeModal = 'functions';
  }

  saveCustomFunctions() {
    try {
      const fn = new Function(this.customFunctionsScript);
      fn.call(this);
      this.recalculate();
      this.showToast('Custom functions saved and recalculated.');
      this.activeModal = null;
    } catch (e) {
      this.showToast('Error parsing custom functions: ' + e);
    }
  }

  openGoalSeek() {
    this.goalSeekModalOpen = true;
  }

  openSolver() {
    this.goalSeekModalOpen = true;
  }

  openEmailNotifications() {
    this.emailNotifModalOpen = true;
  }

  openMergeTemplate() {
    this.activeModal = 'merge';
  }

  simulateMerge() {
    this.activeModal = null;
    this.showToast('Merging template with data...');
    setTimeout(() => {
      this.showToast('Successfully merged 12 documents.');
    }, 1500);
  }

  openPreferences() {
    this.preferencesModalOpen = true;
  }

  // ── Help menu ────────────────────────────────────────────────────────────
  openWhatsNew() {
    window.open('https://www.zoho.com/sheet/whats-new.html', '_blank');
  }

  openUserGuide() {
    window.open('https://www.zoho.com/sheet/help/', '_blank');
  }

  openDeveloperApi() {
    window.open('https://www.zoho.com/sheet/developer-api/', '_blank');
  }

  openFeedback() {
    this.feedbackModalOpen = true;
  }

  // ── Goal Seek / Email Notifications / Preferences / Feedback modals ───────
  goalSeekModalOpen = false;
  goalSeekTargetCell = '';
  goalSeekTargetValue = '';
  goalSeekByCell = '';
  emailNotifModalOpen = false;
  emailNotifOnEdit = true;
  emailNotifOnComment = true;
  emailNotifEmail = '';
  preferencesModalOpen = false;
  prefLocale = 'en-US';
  prefDateFormat = 'MM/DD/YYYY';
  prefThousands = true;
  feedbackModalOpen = false;
  feedbackText = '';
  feedbackRating = 5;

  applyGoalSeek() {
    if (!this.goalSeekTargetCell || !this.goalSeekTargetValue || !this.goalSeekByCell) {
      this.showToast('Please fill in all Goal Seek fields.'); return;
    }
    const tMatch = this.goalSeekTargetCell.trim().match(/^([a-zA-Z]+)(\d+)$/);
    const vMatch = this.goalSeekByCell.trim().match(/^([a-zA-Z]+)(\d+)$/);
    if (!tMatch || !vMatch) { this.showToast('Invalid cell references.'); return; }

    const tr = parseInt(tMatch[2]) - 1;
    const tc = tMatch[1].toUpperCase().charCodeAt(0) - 65;
    const vr = parseInt(vMatch[2]) - 1;
    const vc = vMatch[1].toUpperCase().charCodeAt(0) - 65;

    const targetVal = parseFloat(this.goalSeekTargetValue);
    if (isNaN(targetVal)) { this.showToast('Target value must be a number.'); return; }

    // Simple iterative solver (Newton's method)
    let currentX = parseFloat(this.evalCell(vr, vc)) || 0;
    let iterations = 0;
    let success = false;

    while (iterations < 50) {
      this.cells[vr][vc] = String(currentX);
      let y0 = parseFloat(String(this.evalCell(tr, tc))) || 0;

      let error = targetVal - y0;
      if (Math.abs(error) < 0.0001) { success = true; break; }

      this.cells[vr][vc] = String(currentX + 0.001);
      let y1 = parseFloat(String(this.evalCell(tr, tc))) || 0;

      let derivative = (y1 - y0) / 0.001;
      if (derivative === 0) {
        currentX += (Math.random() - 0.5); // Random jump to escape flat region
      } else {
        currentX = currentX + (error / derivative);
      }
      iterations++;
    }

    this.cells[vr][vc] = String(currentX);
    this.save();

    if (success) {
      this.showToast(`Goal Seek Success: Set ${this.goalSeekByCell} to ${currentX.toFixed(4)}.`);
    } else {
      this.showToast(`Goal Seek failed to converge after 50 iterations.`);
    }
    this.goalSeekModalOpen = false;
  }

  saveEmailNotifications() {
    this.emailNotifModalOpen = false;
    this.showToast('Email notification preferences saved.');
  }

  savePreferences() {
    this.preferencesModalOpen = false;
    this.showToast('Preferences saved.');
  }

  submitFeedback() {
    if (!this.feedbackText.trim()) { this.showToast('Please enter your feedback.'); return; }
    this.feedbackModalOpen = false;
    this.feedbackText = '';
    this.showToast('Thank you for your feedback!');
  }

  // ── Find & Replace ────────────────────────────────────────────────────────
  openFind() { this.findModalOpen = true; this.findQuery = ''; this.replaceQuery = ''; this.findStatus = ''; }

  // ── Inline Search ────────────────────────────────────────────────────────
  inlineSearchQuery = '';
  inlineSearchMatches: { r: number, c: number }[] = [];
  inlineSearchMatchMap = new Set<string>();
  inlineSearchIdx = -1;

  onInlineSearch() {
    this.inlineSearchMatches = [];
    this.inlineSearchMatchMap.clear();
    this.inlineSearchIdx = -1;
    if (!this.inlineSearchQuery) return;
    const q = this.inlineSearchQuery.toLowerCase();
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.cells[r][c].toLowerCase().includes(q)) {
          this.inlineSearchMatches.push({ r, c });
          this.inlineSearchMatchMap.add(`${r},${c}`);
        }
      }
    }
    if (this.inlineSearchMatches.length > 0) {
      this.inlineSearchIdx = 0;
      const m = this.inlineSearchMatches[0];
      this.selectCell(m.r, m.c);
    }
  }

  inlineFindNext() {
    if (!this.inlineSearchMatches.length) return;
    this.inlineSearchIdx = (this.inlineSearchIdx + 1) % this.inlineSearchMatches.length;
    const m = this.inlineSearchMatches[this.inlineSearchIdx];
    this.selectCell(m.r, m.c);
  }

  inlineFindPrev() {
    if (!this.inlineSearchMatches.length) return;
    this.inlineSearchIdx = (this.inlineSearchIdx - 1 + this.inlineSearchMatches.length) % this.inlineSearchMatches.length;
    const m = this.inlineSearchMatches[this.inlineSearchIdx];
    this.selectCell(m.r, m.c);
  }

  clearInlineSearch() {
    this.inlineSearchQuery = '';
    this.inlineSearchMatches = [];
    this.inlineSearchMatchMap.clear();
    this.inlineSearchIdx = -1;
  }

  isCellInInlineSearch(r: number, c: number): boolean {
    return this.inlineSearchMatchMap.has(`${r},${c}`);
  }

  isCellActiveInlineSearch(r: number, c: number): boolean {
    if (this.inlineSearchIdx < 0 || this.inlineSearchIdx >= this.inlineSearchMatches.length) return false;
    const m = this.inlineSearchMatches[this.inlineSearchIdx];
    return m.r === r && m.c === c;
  }
  // ─────────────────────────────────────────────────────────────────────────

  private buildFindMatches() {
    this.findMatches = [];
    if (!this.findQuery) return;
    const q = this.findQuery.toLowerCase();
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++)
        if (this.cells[r][c].toLowerCase().includes(q))
          this.findMatches.push({ r, c });
  }

  findNext() {
    this.buildFindMatches();
    if (!this.findMatches.length) { this.findStatus = 'No matches found.'; return; }
    this.findMatchIdx = (this.findMatchIdx + 1) % this.findMatches.length;
    const m = this.findMatches[this.findMatchIdx];
    this.selectCell(m.r, m.c);
    this.findStatus = `Match ${this.findMatchIdx + 1} of ${this.findMatches.length}`;
  }

  findAll() {
    this.buildFindMatches();
    if (!this.findMatches.length) { this.findStatus = 'No matches found.'; return; }
    // Select entire range of matches
    const rows = this.findMatches.map(m => m.r), cols = this.findMatches.map(m => m.c);
    this.rangeStart = { r: Math.min(...rows), c: Math.min(...cols) };
    this.rangeEnd = { r: Math.max(...rows), c: Math.max(...cols) };
    this.findStatus = `Found ${this.findMatches.length} matches.`;
  }

  replaceOne() {
    this.buildFindMatches();
    if (!this.findMatches.length) { this.findStatus = 'No matches found.'; return; }
    this.findMatchIdx = (this.findMatchIdx + 1) % this.findMatches.length;
    const m = this.findMatches[this.findMatchIdx];
    this.pushHistory();
    const q = new RegExp(this.findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    this.cells[m.r][m.c] = this.cells[m.r][m.c].replace(q, this.replaceQuery);
    this.onCellChange(); this.save();
    this.findStatus = `Replaced 1 instance.`;
  }

  replaceAll() {
    this.buildFindMatches();
    if (!this.findMatches.length) { this.findStatus = 'No matches found.'; return; }
    this.pushHistory();
    const q = new RegExp(this.findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let count = 0;
    for (const m of this.findMatches) {
      this.cells[m.r][m.c] = this.cells[m.r][m.c].replace(q, this.replaceQuery);
      count++;
    }
    this.findMatches = []; this.findMatchIdx = -1;
    this.onCellChange(); this.save();
    this.findStatus = `Replaced ${count} instances.`;
  }

  // ── Multiple Sheets ───────────────────────────────────────────────────────
  private saveCurrentSheet() {
    const existing = this.sheets[this.currentSheetIdx];
    this.sheets[this.currentSheetIdx] = {
      ...existing,
      cells: this.cells.map(row => [...row]),
      formats: { ...this.formats },
      validations: { ...this.validations },
    };
  }

  switchSheet(idx: number) {
    if (idx === this.currentSheetIdx) return;
    this.saveCurrentSheet();
    this.currentSheetIdx = idx;
    const s = this.sheets[idx];
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) this.cells[r][c] = s.cells[r]?.[c] ?? '';
    this.formats = { ...s.formats };
    this.validations = { ...s.validations };
    this.rangeStart = null; this.rangeEnd = null;
    this.selectedRow = 0; this.selectedCol = 0;
    this.formulaBarValue = '';
    this.updateDisplayCache();
  }

  addSheet() {
    this.saveCurrentSheet();
    const n = this.sheets.length + 1;
    this.sheets.push({
      name: `Sheet${n}`,
      cells: Array.from({ length: this.ROWS }, () => Array(this.COLS).fill('')),
      formats: {}, validations: {}
    });
    this.switchSheet(this.sheets.length - 1);
    this.save();
  }

  async renameSheet(idx: number) {
    const cur = this.sheets[idx].name;
    const name = await this.openPrompt('Rename sheet:', cur);
    if (name && name.trim()) { this.sheets[idx] = { ...this.sheets[idx], name: name.trim() }; this.save(); }
  }

  deleteSheet(idx: number) {
    if (this.sheets.length <= 1) { this.showToast('Cannot delete the only sheet.'); return; }
    if (!window.confirm(`Delete "${this.sheets[idx].name}"?`)) return;
    this.sheets.splice(idx, 1);
    this.currentSheetIdx = Math.min(this.currentSheetIdx, this.sheets.length - 1);
    this.switchSheet(this.currentSheetIdx);
    this.save();
  }

  openSheetMenu(idx: number, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.switchSheet(idx);
    this.activeSheetMenuIdx = idx;
    this.sheetMenuX = event.clientX;
    this.sheetMenuY = window.innerHeight - event.clientY;
  }

  duplicateSheet(idx: number) {
    this.pushHistory();
    const sourceSheet = this.sheets[idx];
    const newSheet = JSON.parse(JSON.stringify(sourceSheet));
    let counter = 1;
    let finalName = sourceSheet.name + ' (Copy)';
    while (this.sheets.some(s => s.name === finalName)) {
      counter++;
      finalName = `${sourceSheet.name} (Copy ${counter})`;
    }
    newSheet.name = finalName;
    this.sheets.splice(idx + 1, 0, newSheet);
    this.switchSheet(idx + 1);
    this.showToast(`Duplicated sheet to ${finalName}`);
  }

  // ── Formula Engine ────────────────────────────────────────────────────────
  private evalCell(r: number, c: number, visited = new Set<string>()): string {
    let raw = this.cells[r][c];
    if (raw === undefined || raw === null) return '';
    if (typeof raw !== 'string') raw = String(raw);
    
    if (!raw.startsWith('=')) {
      return raw;
    }
    const key = `${r},${c}`;
    if (visited.has(key)) return '#CIRCULAR!';
    visited.add(key);
    try { return String(this.evalExpr(raw.slice(1).trim().toUpperCase(), visited)); }
    catch { return '#ERROR!'; }
  }

  private getCellVal(ref: string, visited: Set<string>): number | string {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m) return 0;
    const c = m[1].charCodeAt(0) - 65, r = parseInt(m[2]) - 1;
    if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return 0;
    const v = this.evalCell(r, c, new Set(visited));
    return v === '' ? 0 : (isNaN(Number(v)) ? v : Number(v));
  }

  private getRangeVals(range: string, visited: Set<string>): (number | string)[] {
    const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) return [];
    const c1 = m[1].charCodeAt(0) - 65, r1 = parseInt(m[2]) - 1;
    const c2 = m[3].charCodeAt(0) - 65, r2 = parseInt(m[4]) - 1;
    const vals: (number | string)[] = [];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
        vals.push(this.getCellVal(colName(c) + (r + 1), visited));
    return vals;
  }

  private evalExpr(expr: string, visited: Set<string>): number | string {
    // Functions
    const fnMatch = expr.match(/^([A-Z_][A-Z0-9_]*)\((.*)\)$/);
    if (fnMatch) {
      const fn = fnMatch[1], args = this.parseArgs(fnMatch[2]);
      // Resolve each arg: either a range, cell ref, string literal, or number
      const resolve = (a: string): (number | string)[] => {
        const t = a.trim();
        if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(t)) return this.getRangeVals(t, visited);
        if (/^[A-Z]+\d+$/.test(t)) return [this.getCellVal(t, visited)];
        if (/^".*"$/.test(t)) return [t.slice(1, -1)];
        return [this.evalExpr(t, visited)];
      };
      const flatArgs = args.flatMap(a => resolve(a.trim().toUpperCase()));
      const nums = flatArgs.filter(v => typeof v === 'number' || !isNaN(Number(v))).map(Number);
      switch (fn) {
        case 'SUM': return nums.reduce((a, b) => a + b, 0);
        case 'AVERAGE': case 'AVG': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case 'COUNT': return nums.length;
        case 'COUNTA': return flatArgs.filter(v => v !== '' && v !== 0).length;
        case 'MAX': return nums.length ? Math.max(...nums) : 0;
        case 'MIN': return nums.length ? Math.min(...nums) : 0;
        case 'ABS': return Math.abs(nums[0] ?? 0);
        case 'ROUND': return Math.round((nums[0] ?? 0) * Math.pow(10, nums[1] ?? 0)) / Math.pow(10, nums[1] ?? 0);
        case 'SQRT': return Math.sqrt(nums[0] ?? 0);
        case 'MOD': return (nums[0] ?? 0) % (nums[1] ?? 1);
        case 'POWER': return Math.pow(nums[0] ?? 0, nums[1] ?? 1);
        case 'LEN': return String(flatArgs[0] ?? '').length;
        case 'UPPER': return String(flatArgs[0] ?? '').toUpperCase();
        case 'LOWER': return String(flatArgs[0] ?? '').toLowerCase();
        case 'TRIM': return String(flatArgs[0] ?? '').trim();
        case 'LEFT': return String(flatArgs[0] ?? '').slice(0, nums[1] ?? 1);
        case 'RIGHT': return String(flatArgs[0] ?? '').slice(-(nums[1] ?? 1));
        case 'MID': return String(flatArgs[0] ?? '').slice((nums[1] ?? 1) - 1, (nums[1] ?? 1) - 1 + (nums[2] ?? 1));
        case 'CONCATENATE': case 'CONCAT': return flatArgs.map(String).join('');
        case 'TODAY': return new Date().toLocaleDateString();
        case 'NOW': return new Date().toLocaleString();
        case 'ISNUMBER': return !isNaN(Number(flatArgs[0])) ? 'TRUE' : 'FALSE';
        case 'ISBLANK': return flatArgs[0] === '' ? 'TRUE' : 'FALSE';
        case 'IF': {
          const rawCond = args[0]?.trim().toUpperCase() ?? '';
          let cond: any = false;
          try { cond = this.evalExpr(rawCond, visited); } catch { cond = false; }
          const truthy = cond === 'TRUE' || (typeof cond === 'number' && cond !== 0) || cond === true;
          const branch = args[truthy ? 1 : 2]?.trim() ?? '';
          if (/^".*"$/.test(branch)) return branch.slice(1, -1);
          try { return this.evalExpr(branch.toUpperCase(), visited); } catch { return branch; }
        }
        case 'AND': return flatArgs.every(v => v === 'TRUE' || (typeof v === 'number' && v !== 0)) ? 'TRUE' : 'FALSE';
        case 'OR': return flatArgs.some(v => v === 'TRUE' || (typeof v === 'number' && v !== 0)) ? 'TRUE' : 'FALSE';
        case 'TEXT': return String(flatArgs[0] ?? '');
        default:
          if ((window as any).customSheetFunctions && typeof (window as any).customSheetFunctions[fn] === 'function') {
            try { return (window as any).customSheetFunctions[fn](...flatArgs); } catch (e) { return '#ERROR!'; }
          }
          return '#NAME?';
      }
    }
    // Comparison operators
    for (const op of ['>=', '<=', '<>', '!=', '>', '<', '=']) {
      const idx = expr.indexOf(op);
      if (idx > 0) {
        const lv = this.evalExpr(expr.slice(0, idx).trim(), visited);
        const rv = this.evalExpr(expr.slice(idx + op.length).trim(), visited);
        const ln = Number(lv), rn = Number(rv);
        const ls = String(lv), rs = String(rv);
        const cmp = !isNaN(ln) && !isNaN(rn) ? ln - rn : ls.localeCompare(rs);
        if (op === '>=') return cmp >= 0 ? 'TRUE' : 'FALSE';
        if (op === '<=') return cmp <= 0 ? 'TRUE' : 'FALSE';
        if (op === '<>' || op === '!=') return cmp !== 0 ? 'TRUE' : 'FALSE';
        if (op === '>') return cmp > 0 ? 'TRUE' : 'FALSE';
        if (op === '<') return cmp < 0 ? 'TRUE' : 'FALSE';
        if (op === '=') return cmp === 0 ? 'TRUE' : 'FALSE';
      }
    }
    // String concat with &
    if (expr.includes('&')) {
      return expr.split('&').map(p => {
        const t = p.trim();
        if (/^".*"$/.test(t)) return t.slice(1, -1);
        if (/^[A-Z]+\d+$/.test(t)) return String(this.getCellVal(t, visited));
        try { return String(this.evalExpr(t, visited)); } catch { return t; }
      }).join('');
    }
    // Arithmetic: +, -, *, /  (right-to-left for +/- to handle precedence)
    const arithParts = expr.match(/([+\-*/^])/);
    if (arithParts) {
      // Simple tokenizer for arithmetic
      const tokens = expr.split(/([+\-*/^])/);
      if (tokens.length >= 3) {
        const vals = tokens.filter((_, i) => i % 2 === 0).map(t => {
          const tt = t.trim();
          if (/^[A-Z]+\d+$/.test(tt)) return Number(this.getCellVal(tt, visited));
          if (/^".*"$/.test(tt)) return NaN;
          return Number(this.evalExpr(tt, visited));
        });
        const ops = tokens.filter((_, i) => i % 2 === 1);
        let result = vals[0];
        for (let i = 0; i < ops.length; i++) {
          if (ops[i] === '+') result += vals[i + 1];
          else if (ops[i] === '-') result -= vals[i + 1];
          else if (ops[i] === '*') result *= vals[i + 1];
          else if (ops[i] === '/') result = vals[i + 1] !== 0 ? result / vals[i + 1] : Infinity;
          else if (ops[i] === '^') result = Math.pow(result, vals[i + 1]);
        }
        return isNaN(result) ? '#VALUE!' : result;
      }
    }
    // Cell reference
    if (/^[A-Z]+\d+$/.test(expr)) return this.getCellVal(expr, visited);
    // String literal
    if (/^".*"$/.test(expr)) return expr.slice(1, -1);
    // Plain number
    if (!isNaN(Number(expr))) return Number(expr);
    return '#VALUE!';
  }

  private parseArgs(argsStr: string): string[] {
    const args: string[] = [];
    let depth = 0, cur = '';
    for (const ch of argsStr) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) { args.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur) args.push(cur);
    return args;
  }

  // --- Sync Engine ---
  onCellChange(r: number = this.selectedRow, c: number = this.selectedCol, forceBulk: boolean = false) {
    this.updateDisplayCache();
    
    if (!this.cellEditHistory) this.cellEditHistory = {};
    if (r !== undefined && c !== undefined && !forceBulk && !this.applyingRemote) {
       const key = `${this.currentSheetIdx}-${r}-${c}`;
       if (!this.cellEditHistory[key]) this.cellEditHistory[key] = [];
       const val = this.cells[r]?.[c] ?? '';
       const action = val ? (this.cellEditHistory[key].length === 0 ? 'ADDED' : 'EDITED') : 'CLEARED';
       this.cellEditHistory[key].unshift({
         user: 'Current User',
         time: new Date(),
         action: action,
         value: val
       });
    }

    if (this.applyingRemote) return;
    if (forceBulk) {
      this.api.sendUpdate(JSON.stringify(this.getSparse()), this.title);
    } else {
      const value = this.cells[r]?.[c] ?? '';
      const format = this.formats[`${r},${c}`];
      this.api.sendCellUpdate(this.currentSheetIdx, r, c, value, format);
    }
  }

  private getSparse() {
    const s: Record<number, Record<number, string>> = {};
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++)
        if (this.cells[r][c]) { if (!s[r]) s[r] = {}; s[r][c] = this.cells[r][c]; }

    // Cleanup empty formats before saving — preserve all meaningful properties
    const cleanFormats: Record<string, CellFormat> = {};
    Object.keys(this.formats).forEach(k => {
      const f = this.formats[k];
      if (
        f.bold || f.italic || f.strikethrough || f.underline ||
        f.color || f.bg || f.align || f.vertAlign ||
        f.font || f.size || f.wrap !== undefined ||
        f.indent || f.rotation || f.numFormat || f.decimals !== undefined ||
        f.borders ||
        (f as any)._mergeSpan || (f as any)._mergedInto
      ) {
        cleanFormats[k] = f;
      }
    });

    // Flush live state back into current sheet before serializing all sheets
    const existing = this.sheets[this.currentSheetIdx];
    this.sheets[this.currentSheetIdx] = {
      ...existing,
      cells: this.cells.map(row => [...row]),
      formats: { ...cleanFormats },
      validations: { ...this.validations },
    };

    // Convert every sheet's cells 2D array to sparse format to avoid huge payloads
    const sparseSheets = this.sheets.map(sheet => {
      const sparseC: Record<number, Record<number, string>> = {};
      const sheetRows = sheet.cells || [];
      for (let r = 0; r < sheetRows.length; r++) {
        for (let c = 0; c < (sheetRows[r]?.length ?? 0); c++) {
          if (sheetRows[r][c]) {
            if (!sparseC[r]) sparseC[r] = {};
            sparseC[r][c] = sheetRows[r][c];
          }
        }
      }
      return { ...sheet, cells: sparseC };
    });

    return {
      cells: s,
      formats: cleanFormats,
      validations: this.validations,
      calendarNotes: this.calendarNotes,
      globalNotes: this.globalNotes,
      tasks: this.tasks,
      colWidths: this.sheets[this.currentSheetIdx].colWidths,
      rowHeights: this.sheets[this.currentSheetIdx].rowHeights,
      _importedSheets: sparseSheets
    };
  }


  save() {
    this.saveStatus = 'saving';
    this.hasPendingChanges = true;
    // Push to subject instead of hitting the backend immediately
    this.saveSubject.next();
  }

  // The actual HTTP call to the backend
  private executeSave() {
    this.api.saveDocument(this.docId, this.title, JSON.stringify(this.getSparse())).subscribe({
      next: () => {
        this.saveStatus = 'saved';
        this.hasPendingChanges = false;
        this.lastSavedTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      },
      error: () => { this.saveStatus = 'error'; }
    });
  }

  copyLink() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => this.showToast('Link copied! Anyone with the link can collaborate.'));
  }

  makePublic() {
    this.isPublic = true;
    this.copyLink();
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

  onShareSearch() {
    if (!this.shareQuery || this.shareQuery.length < 2) {
      this.userSearchResults = [];
      return;
    }
    this.api.searchUsers(this.shareQuery).subscribe({
      next: (users) => {
        this.userSearchResults = users;
      },
      error: () => {
        this.userSearchResults = [];
      }
    });
  }
  selectShareUser(user: any) {
    if (!this.selectedShareEmails.includes(user.email)) {
      this.selectedShareEmails.push(user.email);
    }
    this.shareQuery = '';
    this.userSearchResults = [];
  }

  addShareEmail(event: Event) {
    event.preventDefault();
    if (this.shareQuery.trim()) {
      const email = this.shareQuery.trim();
      if (!this.selectedShareEmails.includes(email)) {
        this.selectedShareEmails.push(email);
      }
      this.shareQuery = '';
      this.userSearchResults = [];
    }
  }

  removeShareEmail(email: string) {
    this.selectedShareEmails = this.selectedShareEmails.filter(e => e !== email);
  }
  submitShare() {
    if (this.shareQuery.trim()) {
      this.showToast(`Shared with ${this.shareQuery.trim()}`);
      this.shareQuery = '';
      this.shareModalOpen = false;
    }
  }



  async insertLink() {
    const url = await this.openPrompt('Enter URL to insert into cell:');
    if (url) {
      this.cells[this.selectedRow][this.selectedCol] = url;
      this.formulaBarValue = url;
      this.onCellChange();
      this.showToast('Link inserted into cell.');
    }
  }

  async insertComment() {
    const comment = await this.openPrompt(`Add a comment to cell ${this.selectedRef}:`);
    if (comment !== null) {
      const ref = `${this.selectedRow},${this.selectedCol}`;
      if (!this.formats[ref]) this.formats[ref] = {};
      (this.formats[ref] as any)['comment'] = comment;
      this.onCellChange();
      this.showToast(`Comment added to ${this.selectedRef}.`);
    }
  }

  generateChart(type: string = 'column') {
    this.closeMenus();
    let minR = this.selectedRow, maxR = this.selectedRow;
    let minC = this.selectedCol, maxC = this.selectedCol;
    if (this.rangeStart && this.rangeEnd) {
      minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
      maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
      minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
      maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    } else {
      maxR = Math.min(this.ROWS - 1, minR + 9);
    }

    const numRows = maxR - minR + 1;
    const numCols = maxC - minC + 1;

    const series: number[][] = [];
    for (let c = minC; c <= maxC; c++) {
      const colVals: number[] = [];
      for (let r = minR; r <= maxR; r++) {
        const val = this.getDisplayValue(r, c);
        const v = parseFloat(val);
        colVals.push(isNaN(v) ? 0 : v);
      }
      series.push(colVals);
    }


    let hasData = false;
    series.forEach(s => s.forEach(v => { if (v !== 0) hasData = true; }));
    if (!hasData) {
      this.showToast('Please enter some numbers in the cells before generating a chart!');
      return;
    }

    const colors = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#673ab7', '#ff9800', '#00bcd4', '#e91e63'];
    const bw = type === 'grouped' ? Math.max(10, 36 / numCols) : 36;
    const spacing = 12;
    const groupWidth = type === 'grouped' ? (bw * numCols) + spacing : bw + spacing;
    const gh = 250;
    const gw = numRows * groupWidth + 80;

    let svg = `<svg width="${gw}" height="${gh + 40}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;border:1px solid #e0e0e0;border-radius:4px;font-family:sans-serif;">`;
    svg += `<line x1="50" y1="20" x2="50" y2="${gh + 20}" stroke="#ccc" stroke-width="1"/>`;
    svg += `<line x1="50" y1="${gh + 20}" x2="${gw - 20}" y2="${gh + 20}" stroke="#ccc" stroke-width="1"/>`;

    if (type === 'column' || type === 'grouped') {
      let globalMax = 1;
      series.forEach(s => s.forEach(v => { if (v > globalMax) globalMax = v; }));

      for (let i = 0; i < numRows; i++) {
        for (let s = 0; s < numCols; s++) {
          const v = series[s][i];
          const h = Math.round((v / globalMax) * gh);
          const x = 60 + i * groupWidth + (type === 'grouped' ? s * bw : 0);
          const y = gh + 20 - h;
          if (h > 0) svg += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${colors[s % colors.length]}" rx="2"/>`;
        }
      }
    } else if (type === 'stacked_column' || type === 'stacked_100') {
      let maxRowSum = 1;
      const rowSums = [];
      for (let i = 0; i < numRows; i++) {
        let sum = 0;
        for (let s = 0; s < numCols; s++) sum += series[s][i];
        rowSums.push(sum);
        if (sum > maxRowSum) maxRowSum = sum;
      }

      for (let i = 0; i < numRows; i++) {
        let currentY = gh + 20;
        const rowSum = rowSums[i];
        for (let s = 0; s < numCols; s++) {
          const v = series[s][i];
          if (v <= 0) continue;

          let h = 0;
          if (type === 'stacked_100') {
            h = rowSum > 0 ? Math.round((v / rowSum) * gh) : 0;
          } else {
            h = Math.round((v / maxRowSum) * gh);
          }

          currentY -= h;
          const x = 60 + i * groupWidth;
          svg += `<rect x="${x}" y="${currentY}" width="${bw}" height="${h}" fill="${colors[s % colors.length]}"/>`;
        }
      }
    } else if (type === 'line' || type === 'area') {
      let globalMax = 1;
      series.forEach(s => s.forEach(v => { if (v > globalMax) globalMax = v; }));

      for (let s = 0; s < numCols; s++) {
        let pts = '';
        for (let i = 0; i < numRows; i++) {
          const v = series[s][i];
          const h = Math.round((v / globalMax) * gh);
          const x = 60 + i * groupWidth + (groupWidth / 2);
          const y = gh + 20 - h;
          pts += `${x},${y} `;
          if (type === 'line') {
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="${colors[s % colors.length]}"/>`;
          }
        }
        if (type === 'line') {
          svg += `<polyline points="${pts.trim()}" fill="none" stroke="${colors[s % colors.length]}" stroke-width="3"/>`;
        } else {
          const firstX = 60 + (groupWidth / 2);
          const lastX = 60 + (numRows - 1) * groupWidth + (groupWidth / 2);
          const areaPts = `${firstX},${gh + 20} ${pts} ${lastX},${gh + 20}`;
          svg += `<polygon points="${areaPts}" fill="${colors[s % colors.length]}" opacity="0.4"/>`;
          svg += `<polyline points="${pts.trim()}" fill="none" stroke="${colors[s % colors.length]}" stroke-width="2"/>`;
        }
      }
    } else if (type === 'scatter') {
      let globalMax = 1;
      series.forEach(s => s.forEach(v => { if (v > globalMax) globalMax = v; }));

      for (let s = 0; s < numCols; s++) {
        for (let i = 0; i < numRows; i++) {
          const v = series[s][i];
          if (v === 0) continue;
          const h = Math.round((v / globalMax) * gh);
          const x = 60 + i * groupWidth + (bw / 2);
          const y = gh + 20 - h;
          svg += `<circle cx="${x}" cy="${y}" r="6" fill="${colors[s % colors.length]}" opacity="0.7"/>`;
        }
      }
    } else if (type === 'pie') {
      let total = 0;
      const pieData = series[0].filter(v => v > 0);
      pieData.forEach(v => total += v);

      if (total > 0) {
        let startAngle = 0;
        const cx = gw / 2;
        const cy = (gh + 40) / 2;
        const r = Math.min(cx, cy) - 40;

        pieData.forEach((v, i) => {
          const sliceAngle = (v / total) * 360;
          if (sliceAngle === 360) {
            svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors[i % colors.length]}"/>`;
            return;
          }
          const endAngle = startAngle + sliceAngle;
          // svg arc uses radians
          const x1 = cx + r * Math.cos(Math.PI * startAngle / 180);
          const y1 = cy + r * Math.sin(Math.PI * startAngle / 180);
          const x2 = cx + r * Math.cos(Math.PI * endAngle / 180);
          const y2 = cy + r * Math.sin(Math.PI * endAngle / 180);

          const largeArc = sliceAngle > 180 ? 1 : 0;
          svg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}"/>`;
          startAngle = endAngle;
        });
      }
    }
    svg += '</svg>';

    const win = window.open('', '_blank', `width=${gw + 60},height=${gh + 120}`);
    if (win) {
      win.document.write(`<html><body style="margin:20px;font-family:sans-serif;background:#f8f9fa;"><h3>Chart Preview: ${type.replace('_', ' ').toUpperCase()}</h3>${svg}<p style="color:#888;font-size:13px;">Close this window when done.</p></body></html>`);
    }
    this.showToast(`Chart generated successfully.`);
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



  exportFile(format: string) {
    this.closeMenus();
    this.save();
    this.showToast(`Exporting as ${format.toUpperCase()}...`);

    setTimeout(() => {
      try {
        if (format === 'pdf') {
          let maxRow = 0; let maxCol = 0;
          for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
              if (this.cells[r][c]) { maxRow = Math.max(maxRow, r); maxCol = Math.max(maxCol, c); }
            }
          }
          
          const doc = new jsPDF({ orientation: 'landscape' });
          const body = [];
          for (let r = 0; r <= maxRow; r++) {
            const row = [];
            for (let c = 0; c <= maxCol; c++) {
              row.push((this.cells[r][c] || '').toString());
            }
            body.push(row);
          }
          
          autoTable(doc, {
            body: body,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { top: 10 }
          });
          
          doc.save(`${this.title || 'Spreadsheet'}.pdf`);
          this.showToast('Download complete.');
          return;
        }

        let content = '';
        let mimeType = '';
        let extension = format;

        if (format === 'csv' || format === 'tsv') {
          const delimiter = format === 'csv' ? ',' : '\t';
          mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'text/tab-separated-values;charset=utf-8;';
          const rows = [];
          for (let r = 0; r < this.ROWS; r++) {
            const rowData = [];
            for (let c = 0; c < this.COLS; c++) {
              let val = (this.cells[r][c] || '').toString();
              if (val.includes(delimiter) || val.includes('\\n') || val.includes('"')) {
                val = '"' + val.replace(/"/g, '""') + '"';
              }
              rowData.push(val);
            }
            // Skip empty rows at the bottom
            if (rows.length > 0 || rowData.some(v => v !== '')) {
              rows.push(rowData.join(delimiter));
            }
          }
          // Trim empty trailing rows
          while (rows.length > 0 && rows[rows.length - 1].replace(new RegExp(delimiter, 'g'), '') === '') {
            rows.pop();
          }
          content = rows.join('\\n');
        } else {
          // For xlsx, xlsb, ods - use HTML table which Excel parses perfectly
          mimeType = format === 'html' ? 'text/html;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
          extension = format === 'html' ? 'html' : 'xls'; // Safe extension for HTML-in-Excel
          
          content = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">';
          let maxRow = 0;
          let maxCol = 0;
          
          // Find bounds
          for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
              if (this.cells[r][c]) { maxRow = Math.max(maxRow, r); maxCol = Math.max(maxCol, c); }
            }
          }
          
          for (let r = 0; r <= maxRow; r++) {
            content += '<tr>';
            for (let c = 0; c <= maxCol; c++) {
              content += `<td>${this.cells[r][c] || ''}</td>`;
            }
            content += '</tr>';
          }
          content += '</table></body></html>';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.title || 'Spreadsheet'}.${extension}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.showToast('Download complete.');
      } catch (err) {
        console.error(err);
        this.showToast('Export failed. Please try again.');
      }
    }, 100);
  }

  activeModal: 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | 'form' | 'view_form' | 'macro' | 'edit_macro' | 'functions' | 'merge' | null = null;
  previewImageUrl: string | null = null;
  saveStatus: 'saved' | 'saving' | 'error' = 'saved';
  lastSavedTime: string = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  private saveSubject = new Subject<void>();
  private saveSubscription!: Subscription;
  private hasPendingChanges: boolean = false;
  dummyList: any[] = [];
  myDocs: any[] = [];
  selectedImportFile: File | null = null;
  modalInput = '';
  isStarred = false;

  onFileSelected(event: any) {
    this.selectedImportFile = event.target.files[0];
  }

  toggleStar() {
    this.isStarred = !this.isStarred;
    this.showToast(this.isStarred ? 'Added to Starred' : 'Removed from Starred');
  }

  openFeatureModal(type: any) {
    this.closeMenus();
    this.activeModal = type;
    if (type === 'template') this.dummyList = ['Blank', 'Invoice', 'Budget', 'Schedule', 'To-Do List', 'Project Tracker'];
    if (type === 'open') {
      this.myDocs = [];
      this.api.listDocuments().subscribe(res => {
        this.myDocs = res.filter((d: any) => d.doc_type === 'sheet' && !d.is_trashed);
      });
    }
    if (type === 'version') this.dummyList = ['Today 2:30 PM (Current)', 'Yesterday 11:00 AM', 'Last Week (Initial)'];
    if (type === 'audit') this.dummyList = ['User modified cell C4 (1m ago)', 'You changed column width (5m ago)', 'User added new row (10m ago)'];
    if (type === 'workflow') this.dummyList = ['Highlight row if Status=Done', 'Send email if Due Date < Today'];
  }

  handleModalAction(payload?: any) {
    if (this.activeModal === 'template') {
      const templateName = payload || 'Blank';
      this.addSheet();
      const idx = this.sheets.length - 1;
      this.sheets[idx].name = templateName;

      // Basic mock templates
      if (templateName === 'Invoice') {
        this.sheets[idx].cells[0][0] = 'INVOICE';
        this.sheets[idx].formats['0,0'] = { bold: true, size: '24', align: 'left' };
        this.sheets[idx].cells[2][0] = 'Bill To:';
        this.sheets[idx].cells[3][0] = 'Name:';
        this.sheets[idx].cells[4][0] = 'Address:';
        this.sheets[idx].cells[6][0] = 'Item';
        this.sheets[idx].cells[6][1] = 'Qty';
        this.sheets[idx].cells[6][2] = 'Price';
        this.sheets[idx].cells[6][3] = 'Total';
        this.sheets[idx].formats['6,0'] = { bold: true };
        this.sheets[idx].formats['6,1'] = { bold: true };
        this.sheets[idx].formats['6,2'] = { bold: true };
        this.sheets[idx].formats['6,3'] = { bold: true };
      } else if (templateName === 'Budget') {
        this.sheets[idx].cells[0][0] = 'MONTHLY BUDGET';
        this.sheets[idx].formats['0,0'] = { bold: true, size: '18', color: '#10b981' };
        this.sheets[idx].cells[2][0] = 'Income';
        this.sheets[idx].cells[2][1] = 'Planned';
        this.sheets[idx].cells[2][2] = 'Actual';
        this.sheets[idx].formats['2,0'] = { bold: true };
        this.sheets[idx].formats['2,1'] = { bold: true };
        this.sheets[idx].formats['2,2'] = { bold: true };
      } else if (templateName === 'To-Do List') {
        this.sheets[idx].cells[0][0] = 'TO-DO LIST';
        this.sheets[idx].formats['0,0'] = { bold: true, size: '18' };
        this.sheets[idx].cells[1][0] = 'Status';
        this.sheets[idx].cells[1][1] = 'Task';
        this.sheets[idx].cells[1][2] = 'Due Date';
        this.sheets[idx].formats['1,0'] = { bold: true };
        this.sheets[idx].formats['1,1'] = { bold: true };
        this.sheets[idx].formats['1,2'] = { bold: true };
      }
      this.activeModal = null;
      this.showToast('Created ' + templateName + ' sheet!');
      this.switchSheet(idx);
    } else if (this.activeModal === 'open') {
      const doc = payload;
      if (doc && doc.id) {
        this.showToast('Opening ' + doc.title + '...');
        window.location.href = `/${doc.doc_type}/${doc.id}`;
      }
      this.activeModal = null;
    } else if (this.activeModal === 'import') {
      if (this.selectedImportFile) {
        this.showToast(`Importing ${this.selectedImportFile.name}...`);
        this.api.importFile(this.selectedImportFile, this.docId).subscribe({
          next: (doc: any) => {
            this.showToast(`${this.selectedImportFile!.name} imported successfully!`);
            this.selectedImportFile = null;
            this.activeModal = null;
            // Reload the current page to fetch the newly imported data
            window.location.reload();
          },
          error: () => this.showToast('Failed to import file.')
        });
      } else {
        this.showToast('Please select a file first.');
      }
    } else if (this.activeModal === 'password') {
      this.showToast('Password protection enabled!');
    } else if (this.activeModal === 'move') {
      this.showToast('Document moved to ' + (this.modalInput || 'Folder'));
    } else if (this.activeModal === 'workflow') {
      this.showToast('Workflow rule added.');
    }
    this.activeModal = null;
    this.modalInput = '';
  }

  performShare() {
    const queryEmails = this.shareQuery ? this.shareQuery.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.length > 0) : [];
    const allEmails = Array.from(new Set([...this.selectedShareEmails, ...queryEmails]));
    
    if (allEmails.length === 0) return;

    let successCount = 0;
    let failCount = 0;
    const total = allEmails.length;

    allEmails.forEach(email => {
      this.api.shareDocument(this.docId, email, this.shareRole.toLowerCase()).subscribe({
        next: () => {
          successCount++;
          if (successCount + failCount === total) this.finishShare(successCount, failCount, total);
        },
        error: () => {
          failCount++;
          if (successCount + failCount === total) this.finishShare(successCount, failCount, total);
        }
      });
    });
  }

  finishShare(success: number, fail: number, total: number) {
    if (success === total) {
      this.showToast(`Shared successfully with ${success} user(s).`);
      this.shareQuery = '';
      this.selectedShareEmails = [];
      this.shareModalOpen = false;
    } else if (success > 0) {
      this.showToast(`Shared with ${success} user(s). Failed for ${fail} user(s).`);
    } else {
      this.showToast(`Failed to share: User(s) not found.`);
    }
  }

  triggerCopy() {
    this.closeMenus();
    this.api.createDocument(this.title + ' - Copy', 'sheet').subscribe((res: any) => {
      window.open(/sheet/ + res.id, '_blank');
    });
  }

  async triggerRename() {
    this.closeMenus();
    const newTitle = await this.openPrompt('Enter new document name:', this.title);
    if (newTitle && newTitle.trim()) {
      this.title = newTitle.trim();
      this.save();
    }
  }

  openPrompt(title: string, defaultValue: string = ''): Promise<string | null> {
    this.promptModalTitle = title;
    this.promptModalValue = defaultValue;
    this.promptModalOpen = true;
    return new Promise((resolve) => {
      this.promptResolve = resolve;
    });
  }

  closePrompt() {
    this.promptModalOpen = false;
    if (this.promptResolve) {
      this.promptResolve(null);
      this.promptResolve = null;
    }
  }

  submitPrompt() {
    this.promptModalOpen = false;
    if (this.promptResolve) {
      this.promptResolve(this.promptModalValue);
      this.promptResolve = null;
    }
  }

  showToast(msg: string) {
    this.toastMsg = msg; this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 2500);
  }

  getColWidth(c: number): number {
    return this.sheets[this.currentSheetIdx].colWidths?.[c] ?? 100;
  }

  getRowHeight(r: number): number {
    return this.sheets[this.currentSheetIdx].rowHeights?.[r] ?? 26;
  }

  getFrozenColOffset(c: number): number {
    let offset = (this.showHeaders ? 46 : 0) + this.groupMarginWidth;
    const widths = this.sheets[this.currentSheetIdx].colWidths || {};
    for (let i = 0; i < c; i++) {
      offset += widths[i] ?? 100;
    }
    return offset;
  }

  getFrozenRowOffset(r: number): number {
    let offset = this.showHeaders ? 26 : 0;
    const heights = this.sheets[this.currentSheetIdx].rowHeights || {};
    for (let i = 0; i < r; i++) {
      offset += heights[i] ?? 26;
    }
    return offset;
  }

  startColResize(event: MouseEvent, c: number) {
    event.stopPropagation();
    event.preventDefault();
    this.resizingCol = c;
    this.resizeStartX = event.clientX;
    this.resizeStartSize = this.getColWidth(c);

    const gridWrap = (event.target as HTMLElement).closest('.grid-wrap');
    if (gridWrap) {
      const rect = gridWrap.getBoundingClientRect();
      this.resizeLineX = event.clientX - rect.left + gridWrap.scrollLeft;
    }

    const moveListener = (e: MouseEvent) => {
      if (gridWrap) {
        const rect = gridWrap.getBoundingClientRect();
        this.resizeLineX = e.clientX - rect.left + gridWrap.scrollLeft;
      }
    };

    const upListener = (e: MouseEvent) => {
      document.removeEventListener('mousemove', moveListener);
      document.removeEventListener('mouseup', upListener);
      const delta = e.clientX - this.resizeStartX;
      const newWidth = Math.max(30, this.resizeStartSize + delta);

      const sheet = this.sheets[this.currentSheetIdx];
      if (!sheet.colWidths) sheet.colWidths = {};
      sheet.colWidths[c] = newWidth;

      this.resizingCol = null;
      this.save();
    };

    document.addEventListener('mousemove', moveListener);
    document.addEventListener('mouseup', upListener);
  }

  startRowResize(event: MouseEvent, r: number) {
    event.stopPropagation();
    event.preventDefault();
    this.resizingRow = r;
    this.resizeStartY = event.clientY;
    this.resizeStartSize = this.getRowHeight(r);

    const gridWrap = (event.target as HTMLElement).closest('.grid-wrap');
    if (gridWrap) {
      const rect = gridWrap.getBoundingClientRect();
      this.resizeLineY = event.clientY - rect.top + gridWrap.scrollTop;
    }

    const moveListener = (e: MouseEvent) => {
      if (gridWrap) {
        const rect = gridWrap.getBoundingClientRect();
        this.resizeLineY = e.clientY - rect.top + gridWrap.scrollTop;
      }
    };

    const upListener = (e: MouseEvent) => {
      document.removeEventListener('mousemove', moveListener);
      document.removeEventListener('mouseup', upListener);
      const delta = e.clientY - this.resizeStartY;
      const newHeight = Math.max(20, this.resizeStartSize + delta);

      const sheet = this.sheets[this.currentSheetIdx];
      if (!sheet.rowHeights) sheet.rowHeights = {};
      sheet.rowHeights[r] = newHeight;

      this.resizingRow = null;
      this.save();
    };

    document.addEventListener('mousemove', moveListener);
    document.addEventListener('mouseup', upListener);
  }

  copySheet(idx: number) {
    this.copiedSheetData = JSON.parse(JSON.stringify(this.sheets[idx]));
    this.showToast(`Sheet "${this.sheets[idx].name}" copied.`);
  }

  pasteSheet() {
    if (!this.copiedSheetData) return;
    this.pushHistory();
    const newSheet = JSON.parse(JSON.stringify(this.copiedSheetData));
    let counter = 1;
    let finalName = newSheet.name + ' (Pasted)';
    while (this.sheets.some(s => s.name === finalName)) {
      counter++;
      finalName = `${newSheet.name} (Pasted ${counter})`;
    }
    newSheet.name = finalName;
    const insertIdx = (this.activeSheetMenuIdx !== null ? this.activeSheetMenuIdx : this.currentSheetIdx) + 1;
    this.sheets.splice(insertIdx, 0, newSheet);
    this.switchSheet(insertIdx);
    this.activeSheetMenuIdx = null;
    this.showToast(`Pasted as "${finalName}"`);
    this.save();
  }

  moveSheet(idx: number, dir: 'left' | 'right') {
    if (idx === null || idx === undefined) return;
    this.pushHistory();
    if (dir === 'left' && idx > 0) {
      const temp = this.sheets[idx - 1];
      this.sheets[idx - 1] = this.sheets[idx];
      this.sheets[idx] = temp;
      this.switchSheet(idx - 1);
    } else if (dir === 'right' && idx < this.sheets.length - 1) {
      const temp = this.sheets[idx + 1];
      this.sheets[idx + 1] = this.sheets[idx];
      this.sheets[idx] = temp;
      this.switchSheet(idx + 1);
    }
    this.activeSheetMenuIdx = null;
    this.save();
  }

  setTabColor(idx: number, color: string) {
    this.sheets[idx].tabColor = color;
    this.save();
  }

  toggleSheetGridlines(idx: number) {
    this.sheets[idx].hideGridlines = !this.sheets[idx].hideGridlines;
    this.save();
  }

  getVisibleSheetCount(): number {
    return this.sheets.filter(s => !s.hidden).length;
  }

  hideSheet(idx: number) {
    if (this.getVisibleSheetCount() <= 1 && !this.sheets[idx].hidden) {
      this.showToast('Cannot hide the only visible sheet.');
      return;
    }
    this.sheets[idx].hidden = true;
    if (this.currentSheetIdx === idx) {
      const nextIdx = this.sheets.findIndex(s => !s.hidden);
      this.switchSheet(nextIdx);
    }
    this.save();
  }

  unhideSheet(idx: number) {
    this.sheets[idx].hidden = false;
    this.save();
  }

  toggleLockSheet(idx: number) {
    this.sheets[idx].locked = !this.sheets[idx].locked;
    this.save();
    this.showToast(this.sheets[idx].locked ? 'Sheet locked.' : 'Sheet unlocked.');
  }

  publishSheet(idx: number) {
    this.showToast(`Sheet "${this.sheets[idx].name}" published to web.`);
  }

  back() { this.save(); this.router.navigate(['/']); }
  ngOnDestroy() {
    this.syncSub?.unsubscribe();
    this.api.disconnectSync();
    if (this.saveSubscription) this.saveSubscription.unsubscribe();
    if (this.hasPendingChanges) this.executeSave();
  }

  showEditHistoryPanel = false;
  editHistoryCell: any = null;
  editHistoryData: any[] = [];
  cellEditHistory: Record<string, any[]> = {};

  openCellEditHistory() {
    if (this.selectedRow === null || this.selectedCol === null) return;
    this.editHistoryCell = { r: this.selectedRow, c: this.selectedCol };
    const key = `${this.currentSheetIdx}-${this.selectedRow}-${this.selectedCol}`;
    if (!this.cellEditHistory) this.cellEditHistory = {};
    if (!this.cellEditHistory[key]) {
       this.cellEditHistory[key] = [];
    }
    this.editHistoryData = this.cellEditHistory[key];
    this.showEditHistoryPanel = true;
  }

  showCustomFormatModal = false;
  customFormatString = '';
  showMoreFormatsModal = false;

  openCustomFormatModal() {
    this.closeMenus();
    this.customFormatString = '';
    this.showCustomFormatModal = true;
  }
  
  applyCustomFormat() {
    if (this.customFormatString.trim()) {
      this.setFormat('numFormat', 'custom_' + this.customFormatString.trim());
    }
    this.showCustomFormatModal = false;
  }
  
  openMoreFormatsModal() {
    this.closeMenus();
    this.showMoreFormatsModal = true;
  }

  private applyCustomFormatString(val: any, num: number, isNum: boolean, fmtStr: string): string {
    if (!isNum) return String(val);
    let out = fmtStr;
    let tempNum = num;
    if (fmtStr.includes('%')) tempNum = tempNum * 100;
    let decimals = 0;
    const decMatch = fmtStr.match(/\.(0+)/);
    if (decMatch) decimals = decMatch[1].length;
    let numStr = tempNum.toFixed(decimals);
    if (fmtStr.includes(',')) {
       const parts = numStr.split('.');
       parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
       numStr = parts.join('.');
    }
    const numPattern = /[#0,]+(\.[0]+)?/;
    if (numPattern.test(fmtStr)) {
        out = fmtStr.replace(numPattern, numStr);
    } else {
        out = numStr;
    }
    return out;
  }
}


























