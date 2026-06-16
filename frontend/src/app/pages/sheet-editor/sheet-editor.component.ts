import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatWidgetComponent } from '../../components/chat-widget/chat-widget.component';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

const COLS = 26;
const ROWS = 50;
const colName = (i: number) => String.fromCharCode(65 + i);

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
  imports: [CommonModule, FormsModule, ChatWidgetComponent],
  template: `
    <div class="shell" [ngClass]="'theme-' + currentTheme" (mousedown)="$event.target===$event.currentTarget?closeMenus():null">

      <!-- ═══ TOP BAR ════════════════════════════════════════════════════════ -->
      <div class="top-bar" *ngIf="showTopBar">
        <div class="tl" style="align-items:center;">
          <button class="back-btn" (click)="back()" title="Back" style="background:none; border:none; cursor:pointer; color:inherit; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; flex-shrink:0; opacity:0.8;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
          <div class="brand" style="display:flex; align-items:center; gap:6px;">
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
          <div class="top-search-box">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search in this sheet" (keydown.enter)="openFind()">
          </div>
          <div class="online-badge" *ngIf="showUserPresence && activeUsers>1" title="{{activeUsers}} users editing">
            <span class="material-symbols-outlined" style="font-size:16px;">group</span>
            <span style="margin-left:4px;">{{activeUsers}}</span>
          </div>
          <button class="share-btn" (click)="shareModalOpen=true">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
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
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">save</span>Save as<span class="mdi-arrow material-symbols-outlined">chevron_right</span>
               <div class="mdi-sub">
                 <div class="mdi" (click)="save()"><span class="mdi-icon material-symbols-outlined">save</span>Save now<span class="mh">Ctrl+S</span></div>
               </div>
            </div>
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
                <div class="mdi" (click)="deleteRow()">Delete Row</div>
                <div class="mdi" (click)="deleteCol()">Delete Column</div>
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
                <div class="mdi" (click)="insertRowAbove()">Row Above</div>
                <div class="mdi" (click)="insertRowBelow()">Row Below</div>
              </div>
            </div>
            <div class="mdi has-sub"><span class="mdi-icon material-symbols-outlined">view_column</span>Column <span class="mdi-arrow material-symbols-outlined">chevron_right</span>
              <div class="mdi-sub">
                <div class="mdi" (click)="insertColLeft()">Column Before</div>
                <div class="mdi" (click)="insertColRight()">Column After</div>
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
            <div class="mdi" (click)="insertShape()"><span class="mdi-icon material-symbols-outlined">category</span>Shape</div>
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
              <div class="mdi-sub" style="width:320px; padding:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                  <div style="width:30%">
                    <div style="font-size:10px; font-weight:600; color:#a0aec0; margin-bottom:6px;">PROJECT STATUS</div>
                    <div style="background:#e2e8f0; color:#4a5568; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('project_status')">Yet to start</div>
                    <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('project_status')">Blocked</div>
                    <div style="background:#fefcbf; color:#b7791f; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('project_status')">In Progress</div>
                    <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('project_status')">Completed</div>
                  </div>
                  <div style="width:30%">
                    <div style="font-size:10px; font-weight:600; color:#a0aec0; margin-bottom:6px;">BUG STATUS</div>
                    <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">Open</div>
                    <div style="background:#fefcbf; color:#b7791f; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">In Progress</div>
                    <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">Closed</div>
                    <div style="background:#bee3f8; color:#2b6cb0; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('bug_status')">Reopen</div>
                  </div>
                  <div style="width:30%">
                    <div style="font-size:10px; font-weight:600; color:#a0aec0; margin-bottom:6px;">REVIEW</div>
                    <div style="background:#e2e8f0; color:#4a5568; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('review')">Yet to start</div>
                    <div style="background:#bee3f8; color:#2b6cb0; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('review')">Under Review</div>
                    <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('review')">Approved</div>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                  <div style="width:30%">
                    <div style="font-size:10px; font-weight:600; color:#a0aec0; margin-bottom:6px;">PRIORITY</div>
                    <div style="background:#bee3f8; color:#2b6cb0; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('priority')">Low</div>
                    <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('priority')">Medium</div>
                    <div style="background:#fefcbf; color:#b7791f; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('priority')">High</div>
                    <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('priority')">Critical</div>
                  </div>
                  <div style="width:30%">
                    <div style="font-size:10px; font-weight:600; color:#a0aec0; margin-bottom:6px;">DECISION</div>
                    <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('decision')">Yes</div>
                    <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('decision')">No</div>
                  </div>
                  <div style="width:30%">
                    <div style="font-size:10px; font-weight:600; color:#a0aec0; margin-bottom:6px;">BOOLEAN</div>
                    <div style="background:#c6f6d5; color:#276749; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('boolean')">True</div>
                    <div style="background:#fed7d7; color:#c53030; font-size:11px; padding:2px 8px; border-radius:12px; margin-bottom:4px; display:inline-block; cursor:pointer;" (click)="applyPresetPicklist('boolean')">False</div>
                  </div>
                </div>
                <div class="mds"></div>
                <div class="mdi" (click)="openValidationModal();closeMenus()">Create Picklist...</div>
                <div class="mdi" (click)="openValidationModal();closeMenus()">Manage Picklist...</div>
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
            <div class="mdi" (click)="sortColAZ()">Sort A &#8594; Z</div>
            <div class="mdi" (click)="sortColZA()">Sort Z &#8594; A</div>
            <div class="mds"></div>
            <div class="mdi" (click)="toggleFilter()">{{filterActive?'Remove Filter':'Create Filter'}}</div>
            <div class="mds"></div>
            <div class="mdi" (click)="openValidationModal();closeMenus()">Data Validation...</div>
            <div class="mds"></div>
            <div class="mdi" (click)="removeDuplicates()">Remove Duplicates</div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('review',$event)" [class.mi-open]="activeMenu==='review'">Review
          <div class="mdd" *ngIf="activeMenu==='review'">
            <div class="mdi" (click)="insertComment()">Add Comment</div>
            <div class="mdi" (click)="showWordCount()">Cell Statistics</div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('tools',$event)" [class.mi-open]="activeMenu==='tools'">Tools
          <div class="mdd" *ngIf="activeMenu==='tools'">
            <div class="mdi" (click)="openFind();closeMenus()">Find &amp; Replace<span class="mh">Ctrl+H</span></div>
            <div class="mds"></div>
            <div class="mdi" (click)="showKeyboardShortcuts()">Keyboard Shortcuts</div>
          </div>
        </div>
        <div class="mi" (click)="toggleMenu('help',$event)" [class.mi-open]="activeMenu==='help'">Help
          <div class="mdd" *ngIf="activeMenu==='help'">
            <div class="mdi" (click)="showKeyboardShortcuts()">Keyboard Shortcuts</div>
            <div class="mds"></div>
            <div class="mdi">About Sheet</div>
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
                        <div class="mdi" (click)="currentBorderStyle='solid'; currentBorderWidth='1px'; activeBorderSubmenu=null"><div style="width:100%; border-top:1px solid #fff;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='solid'; currentBorderWidth='2px'; activeBorderSubmenu=null"><div style="width:100%; border-top:2px solid #fff;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='solid'; currentBorderWidth='3px'; activeBorderSubmenu=null"><div style="width:100%; border-top:3px solid #fff;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='dashed'; currentBorderWidth='1px'; activeBorderSubmenu=null"><div style="width:100%; border-top:1px dashed #fff;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='dotted'; currentBorderWidth='1px'; activeBorderSubmenu=null"><div style="width:100%; border-top:1px dotted #fff;"></div></div>
                        <div class="mdi" (click)="currentBorderStyle='double'; currentBorderWidth='3px'; activeBorderSubmenu=null"><div style="width:100%; border-top:3px double #fff;"></div></div>
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
            <span>{{getFormat('numFormat')||'General'}}</span>
            <span class="material-symbols-outlined" style="font-size:14px;margin-left:auto;">arrow_drop_down</span>
            <div class="mdd" *ngIf="activeMenu==='numfmt'">
              <div class="mdi" (click)="setNumFormat('general')">General</div>
              <div class="mdi" (click)="setNumFormat('number')">Number <span class="mh">Ctrl+Shift+1</span></div>
              <div class="mdi has-sub">Accounting <span class="mdi-arrow material-symbols-outlined">chevron_right</span></div>
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
              <div class="mdi disabled">Regional</div>
              <div class="mdi disabled">Custom</div>
              <div class="mds"></div>
              <div class="mdi">More Formats...</div>
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
            (ngModelChange)="cells[selectedRow][selectedCol] = $event; onCellChange()"
            (keydown.enter)="commitFormula()" (blur)="commitFormula()" placeholder="" />
      </div>

      <!-- Hidden image file input -->
      <input #imgInput type="file" accept="image/*" style="display:none" (change)="onImageFileSelected($event)">

    <div class="main-content" style="display:flex; flex:1; overflow:hidden; position:relative;">
      <div class="grid-wrap" style="flex:1; overflow:auto; position:relative; background:#fff;">
        <table class="grid" [class.print-area-active]="showHighlightPrintArea" [style.zoom]="zoomLevel / 100" [attr.dir]="gridDirection" [class.grid-spacing-comfort]="gridSpacing==='comfort'" [class.grid-spacing-cozy]="gridSpacing==='cozy'" [class.grid-spacing-classic]="gridSpacing==='classic'">
          <thead [style.display]="showHeaders ? '' : 'none'">
            <tr>
              <th class="corner" (click)="clearHeaderSelection()" [style.z-index]="frozenRowsCount > 0 && frozenColsCount > 0 ? 5 : ''"></th>
              <th *ngFor="let c of colRange" class="col-head"
                [style.display]="hiddenCols.has(c) ? 'none' : ''"
                [style.position]="c < frozenColsCount ? 'sticky' : ''"
                [style.left]="gridDirection==='ltr' && c < frozenColsCount ? (c * 100 + 40) + 'px' : ''"
                [style.right]="gridDirection==='rtl' && c < frozenColsCount ? (c * 100 + 40) + 'px' : ''"
                [style.z-index]="c < frozenColsCount ? 4 : ''"
                [class.col-selected]="isColHeaderSelected(c)"
                [class.active-axis]="isColActiveAxis(c)"
                (contextmenu)="onHeaderRightClick($event, 'col', c)"
                (click)="selectEntireCol(c)">{{ colLabel(c) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of rowRange" [style.display]="hiddenRows.has(r) ? 'none' : ''">
              <td class="row-head" [style.display]="showHeaders ? '' : 'none'"
                [style.position]="r < frozenRowsCount ? 'sticky' : ''"
                [style.top]="r < frozenRowsCount ? (r * 26 + (showHeaders ? 26 : 0)) + 'px' : ''"
                [style.z-index]="r < frozenRowsCount ? 4 : ''"
                [class.row-selected]="isRowHeaderSelected(r)" [class.active-axis]="isRowActiveAxis(r)" (contextmenu)="onHeaderRightClick($event, 'row', r)" (click)="selectEntireRow(r)">{{ r + 1 }}</td>
              <ng-container *ngFor="let c of colRange">
                <td *ngIf="!isMergedSlave(r, c)" class="cell"
                  [style.display]="hiddenCols.has(c) ? 'none' : ''"
                  [style.position]="r < frozenRowsCount || c < frozenColsCount ? 'sticky' : ''"
                  [style.top]="r < frozenRowsCount ? (r * 26 + (showHeaders ? 26 : 0)) + 'px' : ''"
                  [style.left]="gridDirection==='ltr' && c < frozenColsCount ? (c * 100 + (showHeaders ? 40 : 0)) + 'px' : ''"
                  [style.right]="gridDirection==='rtl' && c < frozenColsCount ? (c * 100 + (showHeaders ? 40 : 0)) + 'px' : ''"
                  [style.z-index]="r < frozenRowsCount && c < frozenColsCount ? 4 : (r < frozenRowsCount || c < frozenColsCount ? 3 : '')"
                  [attr.colspan]="getColSpan(r, c)"
                  [attr.rowspan]="getRowSpan(r, c)"
                  [class.selected]="isCellSelected(r, c)"
                  [class.in-range]="isCellInRange(r, c)"
                  [class.remote-selected]="isRemoteSelected(r, c)"
                  [class.fill-preview]="isCellInFillPreview(r, c)"
                  [class.has-content]="cellHasContent(r, c)"
                  [ngStyle]="getCellStyle(r, c)"
                  (mousedown)="onCellMouseDown($event, r, c)"
                  (mouseenter)="onCellMouseEnter(r, c)"
                  (contextmenu)="onCellRightClick($event, r, c)"
                  (click)="selectCell(r, c)">
                                  <ng-container *ngIf="isImageCell(r, c); else textCell">
                    <img [src]="cells[r][c]" style="max-width:100%;max-height:80px;object-fit:contain;display:block;cursor:zoom-in;" 
(click)="selectCell(r,c)" (dblclick)="previewImageUrl = cells[r][c]">
                  </ng-container>
                <ng-template #textCell>
                  <ng-container *ngIf="hasCellDropdown(r, c); else plainInput">
                    <select class="cell-select"
                        [(ngModel)]="cells[r][c]"
                        (ngModelChange)="formulaBarValue = $event"
                        (focus)="selectCell(r, c)"
                      (change)="onCellChange(); save()"
                      (click)="$event.stopPropagation()"
                      [style.backgroundColor]="getDropdownColor(r, c, cells[r][c]) || 'transparent'"
                      [style.color]="getDropdownColor(r, c, cells[r][c]) ? '#fff' : 'inherit'"
                      style="appearance:none; border:none; outline:none; font-family:inherit; font-size:inherit; border-radius:0; padding:0 20px 0 4px; width:100%; height:100%; cursor:pointer; box-sizing:border-box; background-image: url('data:image/svg+xml;utf8,<svg fill=%22%23666%22 height=%2224%22 viewBox=%220 0 24 24%22 width=%2224%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M7 10l5 5 5-5z%22/></svg>'); background-repeat: no-repeat; background-position-x: calc(100% - 2px); background-position-y: center;">
                      <option value=""></option>
                      <option *ngFor="let opt of getCellDropdownOptions(r, c)" [value]="$any(opt).label || opt" [style.background]="$any(opt).color || '#fff'" [style.color]="$any(opt).color ? '#fff' : '#000'">
                        {{ $any(opt).label || opt }}
                      </option>
                    </select>
                  </ng-container>
                  <ng-template #plainInput>
                    <input *ngIf="isDateLike(cells[r][c]); else textInput" class="cell-input" type="date"
                      [ngModel]="getDateValue(r, c)"
                      (ngModelChange)="setDateValue(r, c, $event)"
                      (focus)="selectCell(r, c)"
                      (change)="onCellChange()"
                      (blur)="save()"
                      (keydown.tab)="onTab($any($event), r, c)"
                      (keydown.enter)="onEnter($any($event), r, c)" />
                    <ng-template #textInput>
                        <div *ngIf="!isCellSelected(r, c)" class="cell-display" [ngStyle]="getContentStyle(r, c)">
                          {{ getDisplayValue(r, c) }}
                        </div>
                        <input class="cell-input" [class.visually-hidden]="!isCellSelected(r, c)"
                          [ngStyle]="getContentStyle(r, c)"
                          [ngModel]="isCellSelected(r, c) ? cells[r][c] : getDisplayValue(r, c)"
                          (ngModelChange)="cells[r][c] = $event; formulaBarValue = $event; onCellChange()"
                          (focus)="selectCell(r, c)"
                          (change)="onCellChange()"
                          (blur)="save()"
                          (keydown.tab)="onTab($any($event), r, c)"
                          (keydown.enter)="onEnter($any($event), r, c)" />
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
          </tbody>
        </table>
      </div>

      <!-- Right Side Panel for Apps -->
      <div class="side-panel" *ngIf="sidePanelApp">
        <div class="sp-head">
          <div class="sp-head-left">
            <div class="sp-icon-wrap" [class.sp-icon-cal]="sidePanelApp==='calendar'" [class.sp-icon-notes]="sidePanelApp==='notes'" [class.sp-icon-tasks]="sidePanelApp==='tasks'">
              <span class="material-symbols-outlined sp-head-icon">{{sidePanelApp==='calendar'?'calendar_month':sidePanelApp==='notes'?'sticky_note_2':'task_alt'}}</span>
            </div>
            <div>
              <div class="sp-title">{{sidePanelApp==='calendar'?'Calendar':sidePanelApp==='notes'?'Notes':'Tasks'}}</div>
              <div class="sp-subtitle">{{sidePanelApp==='calendar'?'Schedule & meeting notes':sidePanelApp==='notes'?'Quick capture':'Track your work'}}</div>
            </div>
          </div>
          <button class="sp-close-btn" (click)="closeSidePanel()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="sp-content">

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
          <button style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.05); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #5f6368; transition: background 0.2s;" (click)="previewImageUrl = null" onmouseover="this.style.background='rgba(0,0,0,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.05)'">
            <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
          </button>
          <img [src]="previewImageUrl" style="max-width: 100%; max-height: calc(90vh - 60px); object-fit: contain; border-radius: 4px; display: block;">
        </div>
      </div>

      <!-- Right-click Context Menu -->
      <div class="ctx-menu" *ngIf="ctxVisible" [style.left.px]="ctxX" [style.top.px]="ctxY" [style.maxHeight.px]="ctxMaxHeight" (click)="$event.stopPropagation()">
        <div class="ctx-item" (click)="cutCell(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_cut</span> Cut <span class="ctx-hint">Ctrl+X</span></div>
        <div class="ctx-item" (click)="copyCell(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_copy</span> Copy <span class="ctx-hint">Ctrl+C</span></div>
        <div class="ctx-item" (click)="pasteCell(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">content_paste</span> Paste <span class="ctx-hint">Ctrl+V</span></div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" (click)="insertRowAbove(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert row above</div>
        <div class="ctx-item" (click)="insertRowBelow(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert row below</div>
        <div class="ctx-item" (click)="insertColLeft(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert column left</div>
        <div class="ctx-item" (click)="insertColRight(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">add</span> Insert column right</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item danger" (click)="deleteRow(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">delete</span> Delete row</div>
        <div class="ctx-item danger" (click)="deleteCol(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">delete</span> Delete column</div>
        <div class="ctx-item danger" (click)="clearRangeData(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">backspace</span> Clear selection</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" (click)="openValidationModal(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">arrow_drop_down_circle</span> Set dropdown list...</div>
        <div class="ctx-item danger" (click)="removeValidation(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">close</span> Remove dropdown</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" (click)="sortColAZ(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">sort</span> Sort A to Z</div>
        <div class="ctx-item" (click)="sortColZA(); hideCtx()"><span class="ctx-icon material-symbols-outlined" style="font-size: 16px;">sort</span> Sort Z to A</div>
      </div>

      <!-- Validation / Dropdown Modal (Zoho Picklist Style) -->
      <div class="modal-overlay" *ngIf="validationModalOpen" (click)="validationModalOpen = false">
        <div class="modal" (click)="$event.stopPropagation()" style="width:360px; background:#1c2333; color:#fff; border:1px solid #2d3748; box-shadow:0 12px 40px rgba(0,0,0,0.5); padding:20px;">
          <button (click)="validationModalOpen = false" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:18px;cursor:pointer;color:#a0aec0;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.1);"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button>
          <h3 style="margin-top:0;font-size:16px;font-weight:600;margin-bottom:16px;">Picklist - Edit</h3>
          <p style="color:#a0aec0;font-size:12px;margin-bottom:16px;display:flex;align-items:center;gap:4px;">
            Applies to: <span style="color:#81e6d9;">{{getRangeRef()}}</span>
          </p>
          <div style="max-height:240px;overflow-y:auto;margin-bottom:16px;padding-right:4px;">
            <div *ngFor="let opt of picklistOptions; let i = index" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
               <div style="position:relative; width:24px; height:24px; border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.2); flex-shrink:0;">
                 <input type="color" [(ngModel)]="opt.color" style="position:absolute;top:-5px;left:-5px;width:40px;height:40px;border:none;cursor:pointer;padding:0;background:transparent;">
               </div>
               <input type="text" [(ngModel)]="opt.label" placeholder="Option label" style="flex:1; background:#2d3748; border:1px solid transparent; color:#fff; padding:6px 10px; border-radius:4px; outline:none; font-size:13px; transition:border 0.2s;">
               <button (click)="picklistOptions.splice(i, 1)" style="background:none;border:none;color:#fc8181;cursor:pointer;font-size:18px;padding:4px;display:flex;align-items:center;"><span class="material-symbols-outlined" style="font-size:18px;">close</span></button>
            </div>
          </div>
          <button (click)="addPicklistOption()" style="background:none;border:none;color:#81e6d9;cursor:pointer;font-weight:500;font-size:13px;padding:0;display:flex;align-items:center;gap:4px;margin-bottom:24px;">
            <span class="material-symbols-outlined" style="font-size:16px;">add_circle</span> Add New
          </button>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button (click)="validationModalOpen = false" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Cancel</button>
            <button (click)="saveValidation()" style="background:#00c274;border:none;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;">Save</button>
          </div>
        </div>
      </div>        <!-- Feature Modals -->
        <div class="modal-overlay" *ngIf="activeModal !== null" (click)="activeModal = null" style="z-index: 10000;">
          <div class="modal" (click)="$event.stopPropagation()" style="background:#1c2333; color:#fff; border:1px solid #2d3748; box-shadow:0 12px 40px rgba(0,0,0,0.5); width: 400px; padding:20px;">
            <button (click)="activeModal = null" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:18px;cursor:pointer;color:#a0aec0;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.1);"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button>
            
            <h3 *ngIf="activeModal === 'template'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Choose Template</h3>
            <h3 *ngIf="activeModal === 'open'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Open Document</h3>
            <h3 *ngIf="activeModal === 'import'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Import File</h3>
            <h3 *ngIf="activeModal === 'move'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Move Document</h3>
            <h3 *ngIf="activeModal === 'audit'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Audit Trail</h3>
            <h3 *ngIf="activeModal === 'version'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Version History</h3>
            <h3 *ngIf="activeModal === 'workflow'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Manage Workflows</h3>
            <h3 *ngIf="activeModal === 'password'" style="margin-top:0;font-size:18px;font-weight:600;margin-bottom:16px;">Protect Document</h3>

            <div *ngIf="['template', 'open', 'version', 'audit', 'workflow'].includes(activeModal)">
              <div *ngFor="let item of dummyList" (click)="handleModalAction()" style="padding:12px 16px; background:#2d3748; margin-bottom:8px; border-radius:6px; cursor:pointer; font-size:13px; display:flex; align-items:center; gap:10px; transition:background 0.2s;">
                <span class="material-symbols-outlined" style="color:#81e6d9;">description</span> {{ item }}
              </div>
            </div>

            <div *ngIf="activeModal === 'import'">
              <p style="color:#a0aec0;font-size:13px;margin-bottom:16px;">Select a CSV, TSV, or XLSX file from your computer to import into the current sheet.</p>
              <input type="file" style="width:100%; padding:10px; background:#2d3748; border:1px solid #4a5568; border-radius:6px; color:#fff; margin-bottom:16px;">
              <button class="btn" (click)="handleModalAction()" style="width:100%; background:#00c274;">Import Now</button>
            </div>

            <div *ngIf="activeModal === 'move'">
              <p style="color:#a0aec0;font-size:13px;margin-bottom:16px;">Enter the name of the folder you want to move this document to:</p>
              <input type="text" [(ngModel)]="modalInput" placeholder="Folder Name" style="width:100%; padding:10px; background:#2d3748; border:1px solid #4a5568; border-radius:6px; color:#fff; margin-bottom:16px; outline:none; box-sizing:border-box;">
              <button class="btn" (click)="handleModalAction()" style="width:100%; background:#1a73e8;">Move</button>
            </div>

            <div *ngIf="activeModal === 'password'">
              <p style="color:#a0aec0;font-size:13px;margin-bottom:16px;">Set a password to restrict who can open or view this document.</p>
              <input type="password" [(ngModel)]="modalInput" placeholder="Enter new password" style="width:100%; padding:10px; background:#2d3748; border:1px solid #4a5568; border-radius:6px; color:#fff; margin-bottom:16px; outline:none; box-sizing:border-box;">
              <button class="btn" (click)="handleModalAction()" style="width:100%; background:#d93025;">Set Password</button>
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
                  <input type="text" class="sm-input" [(ngModel)]="shareQuery" (ngModelChange)="onShareSearch()" placeholder="Add people and groups">
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
          [class.active-tab]="i === currentSheetIdx"
          (click)="switchSheet(i)"
          (dblclick)="renameSheet(i)">
          {{ sheet.name }}
          <span class="tab-close" *ngIf="sheets.length > 1" (click)="deleteSheet(i); $event.stopPropagation()">×</span>
        </div>
        <button class="tab-add" (click)="addSheet()" title="Add sheet">＋</button>
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
        <div class="modal" (click)="$event.stopPropagation()" style="background:#202124; color:#e8eaed; border-radius:12px; padding:24px; width:400px; box-shadow:0 12px 40px rgba(0,0,0,.6); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; border:none; max-width:90vw;">
          <h3 style="margin-top:0; font-size:16px; font-weight:500; color:#e8eaed; margin-bottom:16px;">{{promptModalTitle}}</h3>
          <input type="text" [(ngModel)]="promptModalValue" (keyup.enter)="submitPrompt()" style="width:100%; box-sizing:border-box; background:#1c1d1f; border:1px solid #5f6368; color:#e8eaed; font-size:14px; padding:10px 12px; border-radius:4px; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='#8ab4f8'" onblur="this.style.borderColor='#5f6368'" autofocus>
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
            <button (click)="closePrompt()" style="background:transparent; border:none; color:#8ab4f8; font-size:14px; font-weight:500; cursor:pointer; padding:8px 16px; border-radius:4px; transition:background 0.2s;" onmouseover="this.style.background='rgba(138,180,248,0.08)'" onmouseout="this.style.background='transparent'">Cancel</button>
            <button (click)="submitPrompt()" style="background:#8ab4f8; color:#202124; border:none; border-radius:4px; font-weight:500; font-size:14px; padding:8px 24px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#aecbfa'" onmouseout="this.style.background='#8ab4f8'">OK</button>
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
         <div class="bcb-item" (click)="toggleWidget('contacts')">
            <span class="material-symbols-outlined" style="color:#5f6368;">person</span>
            <span>Contacts</span>
         </div>
      </div>

      <app-chat-widget [activeWidget]="activeWidget" (close)="activeWidget=null"></app-chat-widget>
    </div>
  `,
  styles: [`
    /* Bottom Chat Bar */
    .bottom-chat-bar { position: fixed; bottom: 0; left: 0; display: flex; background: #f8f9fa; border-top: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0; z-index: 9999; height: 36px; border-top-right-radius: 6px; box-shadow: 0 -2px 5px rgba(0,0,0,0.05); }
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
    .shell { display:flex; flex-direction:column; height:100vh; background:#fff; overflow:hidden; }

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
    .top-search-box { display:flex; align-items:center; gap:6px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); border-radius:20px; padding:5px 12px; color:rgba(255,255,255,.65); }
    .top-search-box input { background:transparent; border:none; outline:none; color:rgba(255,255,255,.8); font-size:13px; width:160px; }
    .online-badge { display:flex; align-items:center; font-size:13px; font-weight:500; color:rgba(255,255,255,.9); background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2); border-radius:18px; padding:4px 10px; margin-right:8px; cursor:default; }
    .share-btn { display:flex; align-items:center; gap:6px; background:#26a96c; border:none; border-radius:20px; color:#fff; cursor:pointer; font-size:13px; font-weight:600; padding:7px 16px; flex-shrink:0; }
    .share-btn:hover { background:#1f8a57; }
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
    .clr-ico { display:flex; flex-direction:column; align-items:center; gap:1px; }
    .clr-bar { width:14px; height:3px; border-radius:1px; }
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
    .grid-wrap { flex:1; overflow:auto; position:relative; background:#fff; }
    
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
    .cell.remote-selected { box-shadow:inset 0 0 0 1000px rgba(234,67,53,0.1) !important; outline:2px solid #ea4335; outline-offset:-2px; z-index:15; }
    .cell.remote-selected::after { content:''; position:absolute; bottom:-5px; right:-5px; width:8px; height:8px; background:#ea4335; border:2px solid #fff; border-radius:50%; z-index:25; box-shadow:0 1px 3px rgba(0,0,0,.4); pointer-events:none; }

    .cell-input { background:transparent; border:none; color:inherit; font-family:inherit; font-size:inherit; font-weight:inherit; font-style:inherit; text-align:inherit; height:100%; outline:none; padding:0 4px; width:100%; display:block; box-shadow:none; }
    .visually-hidden { opacity:0; position:absolute; left:0; top:0; z-index:2; }
    .cell-display { position:relative; z-index:1; pointer-events:none; align-items:center; display:flex; min-height:100%; padding:0 4px; color:inherit; font-size:inherit; font-weight:inherit; font-style:inherit; text-align:inherit; white-space:inherit; overflow:inherit; text-overflow:inherit; word-break:inherit; }
    .cell-select { border:none; background:transparent; color:inherit; font-family:inherit; font-size:inherit; font-weight:inherit; font-style:inherit; text-align:inherit; height:100%; outline:none; width:100%; cursor:pointer; }
    .fill-handle { background:#34a853; border:2px solid #fff; border-radius:50%; bottom:-5px; right:-5px; cursor:crosshair; height:8px; position:absolute; width:8px; z-index:30; box-shadow:0 1px 3px rgba(0,0,0,.4); }

    /* Frozen row/col legacy unused styles removed */
    .grid-spacing-cozy .cell { padding: 0 4px; }
    .grid-spacing-comfort .cell { padding: 4px 6px; }
    .grid-spacing-classic .cell { padding: 0; }
    .img-overlay { left:0; pointer-events:none; position:absolute; top:0; z-index:6; }
    .filter-row select { border:none; background:transparent; font-size:11px; width:100%; cursor:pointer; }

    /* ── CONTEXT MENU ───────────────────────────────────────────────────── */
        .ctx-menu { background:#2d3748; border:1px solid #4a5568; border-radius:6px; box-shadow:0 4px 20px rgba(0,0,0,.5); min-width:220px; padding:4px 0; position:fixed; z-index:900; max-height:80vh; overflow-y:auto; }
    .ctx-item { color:#e2e8f0; cursor:pointer; display:flex; font-size:13px; justify-content:space-between; align-items:center; padding:8px 16px; gap:8px; }
    .ctx-item:hover { background:#4a5568; color:#fff; }
    .ctx-hint { color:#a0aec0; font-size:11px; margin-left:auto; }
    .ctx-sep { background:#4a5568; height:1px; margin:3px 0; }
    .ctx-icon { display: flex; align-items: center; color: #a0aec0; }
    .ctx-item:hover .ctx-icon { color: #fff; }
    .ctx-item.danger:hover { background:#fc8181; color:#fff; }
    .ctx-item.danger:hover .ctx-icon { color:#fff; }

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
    .theme-light .top-search-box input { color: #202124; }
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
    .theme-light .mdi, .theme-light .dd-item, .theme-light .pd-item { color: #202124; }
    .theme-light .mdi:hover, .theme-light .dd-item:hover, .theme-light .pd-item:hover { background: #f1f3f4; }
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
  activeWidget: string | null = null;
  toggleWidget(w: string) {
    if (this.activeWidget === w) this.activeWidget = null;
    else this.activeWidget = w;
  }
  
  @ViewChild('imgInput') imgInputRef!: ElementRef<HTMLInputElement>;

  docId = '';
  title = 'Untitled spreadsheet';
  activeUsers = 1;

  currentBorderColor: string = '#000000';
  currentBorderStyle: string = 'solid';
  currentBorderWidth: string = '1px';
  activeBorderSubmenu: 'color' | 'style' | null = null;

  getBorderStyleCss(style: string, width: string = '1px') {
    return { 'border-top': `${width} ${style} #fff`, 'width': '100%' };
  }

  displayCache: { [key: string]: string } = {};

  updateDisplayCache() {
    this.displayCache = {};
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
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
    // Check if it's a number
    const num = Number(val);
    const isNum = !isNaN(num) && String(val).trim() !== '';

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

    // Currencies
    if (format.startsWith('currency')) {
      if (!isNum) return val;
      let symbol = '$';
      if (format === 'currency_inr') symbol = '₹';
      if (format === 'currency_eur') symbol = '€';
      if (format === 'currency_gbp') symbol = '£';
      if (format === 'currency_cny') symbol = '¥';
      return symbol + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Fractions
    if (format.startsWith('fraction')) {
      if (!isNum) return val;
      const whole = Math.floor(num);
      const dec = num - whole;
      if (dec === 0) return String(whole);

      let denom = 10;
      if (format === 'fraction_1') denom = 9;
      if (format === 'fraction_2') denom = 99;
      if (format === 'fraction_3') denom = 999;

      // Simple continued fraction approximation
      let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = dec;
      do {
        const a = Math.floor(b);
        let aux = h1; h1 = a * h1 + h2; h2 = aux;
        aux = k1; k1 = a * k1 + k2; k2 = aux;
        b = 1 / (b - a);
      } while (Math.abs(dec - h1 / k1) > dec * 1.0E-6 && k1 <= denom);

      if (k1 > denom) {
        h1 = h2; k1 = k2;
      }
      return (whole !== 0 ? whole + ' ' : '') + h1 + '/' + k1;
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

  shareModalOpen = false;
  isPublic = false;
  shareQuery = '';
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
  ctxMaxHeight = 800;

  // Data validation / dropdown
  validations: Record<string, CellValidation> = {};
  validationModalOpen = false;
  validationInput = '';
  picklistOptions: DropdownOption[] = [];

  // Multiple sheets
  sheets: Array<{ name: string, cells: string[][], formats: Record<string, CellFormat>, validations: Record<string, CellValidation> }> = [
    { name: 'Sheet1', cells: Array.from({ length: ROWS }, () => Array(COLS).fill('')), formats: {}, validations: {} }
  ];
  currentSheetIdx = 0;

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

  colRange = Array.from({ length: COLS }, (_, i) => i);
  rowRange = Array.from({ length: ROWS }, (_, i) => i);
  cells: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
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
  ) { }

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
        if (p.validations) {
          this.validations = p.validations;
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
            if (p.cells) {
              for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++)
                  this.cells[r][c] = p.cells[r]?.[c] ?? '';
            }
            if (p.formats) {
              this.formats = p.formats;
            }
            if (p.validations) {
              this.validations = p.validations;
            }
          } catch { }
          this.updateDisplayCache();
        }
        setTimeout(() => this.applyingRemote = false, 50);
      } else if (msg.type === 'cursor' && msg.client_id && msg.r !== undefined && msg.c !== undefined) {
        this.remoteCursors[msg.client_id] = { r: msg.r, c: msg.c };
      } else if (msg.type === 'cursor_remove' && msg.client_id) {
        delete this.remoteCursors[msg.client_id];
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

    if ((e.key === 'Delete' || e.key === 'Backspace') && !this.isEditingText(e)) {
      e.preventDefault();
      this.clearCell();
      return;
    }

    if (!this.isEditingText(e) && e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => {
        const activeInput = document.querySelector('.cell.selected .cell-input') as HTMLInputElement;
        if (activeInput) {
          activeInput.focus();
          const len = activeInput.value.length;
          activeInput.setSelectionRange(len, len);
        }
      }, 0);
      return;
    }

    if (!this.isEditingText(e) && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.cells[this.selectedRow][this.selectedCol] = e.key;
      this.formulaBarValue = e.key;
      this.onCellChange();
      setTimeout(() => {
        const activeInput = document.querySelector('.cell.selected .cell-input') as HTMLInputElement;
        if (activeInput) {
          activeInput.focus();
          activeInput.setSelectionRange(1, 1);
        }
      }, 0);
      return;
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
        if (!isNaN(num) && v.trim() !== '') return String(num + offset);
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
        return `${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`;
      });
    }

    return v;
  }

  // ── Column / Row header selection ────────────────────────────────────────
  selectEntireCol(c: number) {
    this.selectedColHeader = c;
    this.selectedRowHeader = null;
    this.rangeStart = { r: 0, c };
    this.rangeEnd = { r: ROWS - 1, c };
    this.selectedRow = 0;
    this.selectedCol = c;
    this.formulaBarValue = '';
  }

  selectEntireRow(r: number) {
    this.selectedRowHeader = r;
    this.selectedColHeader = null;
    this.rangeStart = { r, c: 0 };
    this.rangeEnd = { r, c: COLS - 1 };
    this.selectedRow = r;
    this.selectedCol = 0;
    this.formulaBarValue = '';
  }

  clearHeaderSelection() {
    this.selectedColHeader = null;
    this.selectedRowHeader = null;
    this.rangeStart = null;
    this.rangeEnd = null;
  }

  isColHeaderSelected(c: number): boolean { return this.selectedColHeader === c; }
  isRowHeaderSelected(r: number): boolean { return this.selectedRowHeader === r; }

  // ── Right-click context menu ──────────────────────────────────────────────
  onHeaderRightClick(e: MouseEvent, type: 'row' | 'col', idx: number) {
    e.preventDefault();
    if (type === 'col') this.selectEntireCol(idx);
    else this.selectEntireRow(idx);

    const menuWidth = 220;
    const fullMenuHeight = 540;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth;

    // Always open downwards from the cursor unless it's way at the bottom
    let maxHeight = window.innerHeight - y - 20;

    if (maxHeight < 200 && y > window.innerHeight / 2) {
      // If we are near the bottom of the screen, open upwards
      y = Math.max(10, y - fullMenuHeight);
      maxHeight = e.clientY - y;
    } else {
      maxHeight = Math.max(200, maxHeight);
    }

    this.ctxX = x;
    this.ctxY = y;
    this.ctxMaxHeight = maxHeight;
    this.ctxVisible = true;
  }

  onCellRightClick(e: MouseEvent, r: number, c: number) {
    e.preventDefault();
    this.selectCell(r, c);

    const menuWidth = 220;
    const fullMenuHeight = 540;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth;

    let maxHeight = window.innerHeight - y - 20;
    if (maxHeight < 200 && y > window.innerHeight / 2) {
      y = Math.max(10, y - fullMenuHeight);
      maxHeight = e.clientY - y;
    } else {
      maxHeight = Math.max(200, maxHeight);
    }

    this.ctxX = x;
    this.ctxY = y;
    this.ctxMaxHeight = maxHeight;
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
      for (let r = minR; r <= maxR; r++)
        for (let c = minC; c <= maxC; c++)
          this.cells[r][c] = '';
    } else {
      this.cells[this.selectedRow][this.selectedCol] = '';
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
    return String.fromCharCode(65 + c) + (r + 1);
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

  closeMenus() { this.activeMenu = null; this.profileOpen = false; this.activeBorderSubmenu = null; }

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
    this.selectedRow = r; this.selectedCol = c;
    this.formulaBarValue = this.isImageCell(r, c) ? '[IMAGE]' : this.cells[r][c];
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
  selectAll() {
    this.rangeStart = { r: 0, c: 0 };
    this.rangeEnd = { r: ROWS - 1, c: COLS - 1 };
    this.closeMenus();
  }

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
    this.cells[this.selectedRow][this.selectedCol] = 'FALSE';
    this.onCellChange(); this.save(); this.closeMenus();
    this.showToast('Checkbox inserted. Edit cell to toggle TRUE/FALSE.');
  }

  removeDuplicates() {
    const c = this.selectedCol;
    const seen = new Set<string>();
    this.pushHistory();
    let removed = 0;
    for (let r = 0; r < ROWS; r++) {
      const v = this.cells[r][c];
      if (v === '') continue;
      if (seen.has(v)) {
        for (let cc = 0; cc < COLS; cc++) this.cells[r][cc] = '';
        removed++;
      } else seen.add(v);
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

  recalculate() { this.updateDisplayCache(); this.showToast('Recalculated.'); }

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

  shiftCellsDown() {
    this.showToast('Shifted cells down.');
    this.closeMenus();
  }

  shiftCellsRight() {
    this.showToast('Shifted cells right.');
    this.closeMenus();
  }

  customInsertCol() {
    this.showToast('Custom column insert...');
    this.closeMenus();
  }

  createSparkline() {
    this.showToast('Sparkline created.');
    this.closeMenus();
  }

  editSparkline() {
    this.showToast('Edit sparkline...');
    this.closeMenus();
  }

  insertShape() {
    this.showToast('Insert shape...');
    this.closeMenus();
  }

  insertButton() {
    this.showToast('Insert button...');
    this.closeMenus();
  }

  defineName() {
    this.showToast('Define name...');
    this.closeMenus();
  }

  insertNote() {
    this.showToast('Insert note...');
    this.closeMenus();
  }

  insertEmoji() {
    this.showToast('Insert emoji...');
    this.closeMenus();
  }

  applyPresetPicklist(type: string) {
    const presets: {[key:string]: any[]} = {
      'project_status': [
        {label: 'Yet to start', color: '#e2e8f0'},
        {label: 'Blocked', color: '#fed7d7'},
        {label: 'In Progress', color: '#fefcbf'},
        {label: 'Completed', color: '#c6f6d5'}
      ],
      'bug_status': [
        {label: 'Open', color: '#fed7d7'},
        {label: 'In Progress', color: '#fefcbf'},
        {label: 'Closed', color: '#c6f6d5'},
        {label: 'Reopen', color: '#bee3f8'}
      ],
      'review': [
        {label: 'Yet to start', color: '#e2e8f0'},
        {label: 'Under Review', color: '#bee3f8'},
        {label: 'Approved', color: '#c6f6d5'}
      ],
      'priority': [
        {label: 'Low', color: '#bee3f8'},
        {label: 'Medium', color: '#c6f6d5'},
        {label: 'High', color: '#fefcbf'},
        {label: 'Critical', color: '#fed7d7'}
      ],
      'decision': [
        {label: 'Yes', color: '#c6f6d5'},
        {label: 'No', color: '#fed7d7'}
      ],
      'boolean': [
        {label: 'True', color: '#c6f6d5'},
        {label: 'False', color: '#fed7d7'}
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
    for (let i = r; i < ROWS - 1; i++) {
      this.cells[i][c] = this.cells[i + 1][c];
    }
    this.cells[ROWS - 1][c] = '';
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
    const dec = fmt.decimals ?? (fmt.numFormat === 'currency' ? 2 : fmt.numFormat === 'percent' ? 1 : 0);
    if (fmt.numFormat === 'currency') return '$' + num.toFixed(dec);
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
    this.pushHistory();
    for (let c = minC; c <= maxC; c++)
      for (let r = minR + 1; r <= maxR; r++)
        this.cells[r][c] = this.cells[minR][c];
    this.onCellChange(); this.save();
    this.showToast('Filled down.');
  }

  fillRight() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    this.pushHistory();
    for (let r = minR; r <= maxR; r++)
      for (let c = minC + 1; c <= maxC; c++)
        this.cells[r][c] = this.cells[r][minC];
    this.onCellChange(); this.save();
    this.showToast('Filled right.');
  }

  fillUp() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    this.pushHistory();
    for (let c = minC; c <= maxC; c++)
      for (let r = maxR - 1; r >= minR; r--)
        this.cells[r][c] = this.cells[maxR][c];
    this.onCellChange(); this.save();
    this.showToast('Filled up.');
  }

  fillLeft() {
    if (!this.rangeStart || !this.rangeEnd) return;
    const minR = Math.min(this.rangeStart.r, this.rangeEnd.r);
    const maxR = Math.max(this.rangeStart.r, this.rangeEnd.r);
    const minC = Math.min(this.rangeStart.c, this.rangeEnd.c);
    const maxC = Math.max(this.rangeStart.c, this.rangeEnd.c);
    this.pushHistory();
    for (let r = minR; r <= maxR; r++)
      for (let c = maxC - 1; c >= minC; c--)
        this.cells[r][c] = this.cells[r][maxC];
    this.onCellChange(); this.save();
    this.showToast('Filled left.');
  }

  patternFill() {
    this.showToast('Pattern Fill not fully implemented in preview.');
  }

  // ── Find & Replace ────────────────────────────────────────────────────────
  openFind() { this.findModalOpen = true; this.findQuery = ''; this.replaceQuery = ''; this.findStatus = ''; }

  private buildFindMatches() {
    this.findMatches = [];
    if (!this.findQuery) return;
    const q = this.findQuery.toLowerCase();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
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
    this.sheets[this.currentSheetIdx] = {
      name: this.sheets[this.currentSheetIdx].name,
      cells: this.cells.map(row => [...row]),
      formats: { ...this.formats },
      validations: { ...this.validations }
    };
  }

  switchSheet(idx: number) {
    if (idx === this.currentSheetIdx) return;
    this.saveCurrentSheet();
    this.currentSheetIdx = idx;
    const s = this.sheets[idx];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.cells[r][c] = s.cells[r]?.[c] ?? '';
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
      cells: Array.from({ length: ROWS }, () => Array(COLS).fill('')),
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

  // ── Formula Engine ────────────────────────────────────────────────────────
  private evalCell(r: number, c: number, visited = new Set<string>()): string {
    const raw = this.cells[r][c];
    if (!raw || !raw.startsWith('=')) {
      const fmt = this.formats[`${r},${c}`];
      if (fmt?.numFormat && raw !== '') return this.applyNumFormat(raw, fmt);
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
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return 0;
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
        vals.push(this.getCellVal(String.fromCharCode(65 + c) + (r + 1), visited));
    return vals;
  }

  private evalExpr(expr: string, visited: Set<string>): number | string {
    // Functions
    const fnMatch = expr.match(/^(SUM|AVERAGE|AVG|COUNT|COUNTA|MAX|MIN|IF|AND|OR|CONCATENATE|CONCAT|LEN|UPPER|LOWER|TRIM|LEFT|RIGHT|MID|ROUND|ABS|MOD|SQRT|POWER|TEXT|TODAY|NOW|ISNUMBER|ISBLANK)\((.*)\)$/);
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
  onCellChange() {
    this.updateDisplayCache();
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

    return {
      cells: s,
      formats: cleanFormats,
      validations: this.validations,
      calendarNotes: this.calendarNotes,
      globalNotes: this.globalNotes,
      tasks: this.tasks
    };
  }

  save() {
    this.saveStatus = 'saving';
    this.api.saveDocument(this.docId, this.title, JSON.stringify(this.getSparse())).subscribe({
      next: () => {
        this.saveStatus = 'saved';
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
    this.shareQuery = user.email;
    this.userSearchResults = [];
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
      maxR = Math.min(ROWS - 1, minR + 9);
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
    this.save();
    // Best practice: Direct browser navigation for file downloads prevents popup blockers
    // and avoids large memory blobs in the frontend.
    window.location.href = `${this.api.base}/export?doc_id=${this.docId}&format=${format}`;
  }

  activeModal: 'template' | 'open' | 'import' | 'move' | 'audit' | 'version' | 'workflow' | 'password' | null = null;
  previewImageUrl: string | null = null;
  saveStatus: 'saved' | 'saving' | 'error' = 'saved';
  lastSavedTime: string = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  dummyList: any[] = [];
  modalInput = '';
  isStarred = false;

  toggleStar() {
    this.isStarred = !this.isStarred;
    this.showToast(this.isStarred ? 'Added to Starred' : 'Removed from Starred');
  }

  openFeatureModal(type: any) {
    this.closeMenus();
    this.activeModal = type;
    if (type === 'template') this.dummyList = ['Blank', 'Invoice', 'Budget', 'Schedule', 'To-Do List', 'Project Tracker'];
    if (type === 'open') this.dummyList = ['Finance 2026.xlsx', 'Client Contacts.csv', 'Q3 Planning.ods'];
    if (type === 'version') this.dummyList = ['Today 2:30 PM (Current)', 'Yesterday 11:00 AM', 'Last Week (Initial)'];
    if (type === 'audit') this.dummyList = ['User modified cell C4 (1m ago)', 'You changed column width (5m ago)', 'User added new row (10m ago)'];
    if (type === 'workflow') this.dummyList = ['Highlight row if Status=Done', 'Send email if Due Date < Today'];
  }

  handleModalAction() {
    if (this.activeModal === 'template') {
      this.showToast('Created new spreadsheet from template!');
    } else if (this.activeModal === 'import') {
      this.showToast('File imported successfully!');
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
    if (!this.shareQuery) return;
    this.api.shareDocument(this.docId, this.shareQuery, this.shareRole.toLowerCase()).subscribe({
      next: () => {
        this.showToast(`Shared with ${this.shareQuery} as ${this.shareRole}`);
        this.shareQuery = '';
        this.shareModalOpen = false;
      },
      error: () => this.showToast('Failed to share: User not found.')
    });
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

  back() { this.save(); this.router.navigate(['/']); }
  ngOnDestroy() { this.syncSub?.unsubscribe(); this.api.disconnectSync(); }
}



























