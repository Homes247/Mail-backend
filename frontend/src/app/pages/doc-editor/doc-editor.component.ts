import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatWidgetComponent } from '../../components/chat-widget/chat-widget.component';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-doc-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatWidgetComponent],
  template: `
    <div class="shell" (click)="closeMenus($event)">
      <!-- Header Bar -->
      <div class="header-bar">
        <div class="header-left">
          <button class="back-btn" (click)="back()" title="Back to Dashboard" style="background:none; border:none; cursor:pointer; color:inherit; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; flex-shrink:0; opacity:0.8; margin-right:4px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
          <div class="brand-btn" title="Writer">
            <span class="material-symbols-outlined" style="font-size:22px;">description</span>
            <span class="brand-label">Writer</span>
          </div>
          <div class="doc-meta">
            <div class="title-row">
              <input class="title-input" [(ngModel)]="title" (blur)="save()" placeholder="Untitled Document" [style.width.ch]="(title || 'Untitled Document').length + 3" />
              <button class="star-btn" (click)="toggleStar()" title="Star">
                <span class="material-symbols-outlined" [class.filled]="isStarred">{{ isStarred ? 'star' : 'star_border' }}</span>
              </button>
              <span class="save-status">
                <span class="material-symbols-outlined" style="font-size:15px;">cloud_done</span> 
                {{ isSaving ? 'Saving...' : savedTimeStr }}
              </span>
            </div>
            
          </div>
        </div>

        <div class="header-right">
          <span class="collab-badge" *ngIf="activeUsers > 1">
            <span class="material-symbols-outlined" style="font-size:16px;">group</span>
            {{ activeUsers }}
          </span>
          <button class="share-btn" (click)="shareModalOpen = true; closeMenus()">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
          <div style="position:relative;">
            <button class="header-icon-btn" (click)="toggleMenu('notif', $event)" title="Notifications"><span class="material-symbols-outlined">notifications</span></button>
            <div class="dropdown notif-dd shadow-lg" *ngIf="activeMenu === 'notif'" (click)="$event.stopPropagation()">
              <div style="padding:12px; font-weight:600; border-bottom:1px solid #e0e3e8; font-size:12px; color:#5f6368;">NOTIFICATION</div>
              <div style="padding:24px 16px; text-align:center; color:#5f6368; font-size:13px;">You haven't received any notifications yet</div>
            </div>
          </div>
          
          <div style="position:relative;">
            <div class="avatar" (click)="toggleMenu('profile', $event)" [title]="auth.user?.name ?? ''" style="cursor:pointer;">{{ initials }}</div>
            <div class="dropdown profile-dd shadow-lg" *ngIf="activeMenu === 'profile'" (click)="$event.stopPropagation()">
              <div style="padding:16px; text-align:center; border-bottom:1px solid #e0e3e8;">
                <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, #667eea, #764ba2); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:600; margin:0 auto 8px;">{{ initials }}</div>
                <div style="font-weight:600; font-size:14px; color:#202124;">{{ auth.user?.email || 'admin@vsnapmail.co.in' }}</div>
                <div style="font-size:12px; color:#5f6368; margin-top:2px;">User ID: {{ auth.user?.id || 1 }}</div>
              </div>
              <div style="padding:8px 0;">
                <div class="dd-item" (click)="auth.logout()">
                  <span class="material-symbols-outlined dd-icon">logout</span>
                  <span class="dd-text">Sign Out</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="menu-bar-row" style="display:flex; align-items:center; padding: 2px 12px; background: #fff; border-bottom: 1px solid #dadce0; position: relative; z-index: 205;">
            <div class="menu-bar" (mousedown)="$event.preventDefault()">
              <div class="menu-item" (click)="toggleMenu('file', $event)" [class.active]="activeMenu === 'file'">
                File
                <div class="dropdown" *ngIf="activeMenu === 'file'">
                  <div class="dd-item" (click)="newDoc()"><span class="material-symbols-outlined dd-icon">note_add</span><span class="dd-text">New</span></div>
                  <div class="dd-item" (click)="docInput.click(); closeMenus()"><span class="material-symbols-outlined dd-icon">folder_open</span><span class="dd-text">Open</span><span class="dd-hint">Ctrl+O</span></div>
                  <div class="dd-item" (click)="makeCopy()"><span class="material-symbols-outlined dd-icon">content_copy</span><span class="dd-text">Make a copy</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="shareModalOpen = true; closeMenus()"><span class="material-symbols-outlined dd-icon">share</span><span class="dd-text">Share</span></div>
                  <div class="dd-item" (click)="emailDoc()"><span class="material-symbols-outlined dd-icon">mail</span><span class="dd-text">Email</span></div>
                  <div class="dd-item" (click)="exportFile('docx')"><span class="material-symbols-outlined dd-icon">download</span><span class="dd-text">Download (.docx)</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="renameDoc()"><span class="material-symbols-outlined dd-icon">edit</span><span class="dd-text">Rename</span></div>
                  <div class="dd-item" (click)="trashDoc()"><span class="material-symbols-outlined dd-icon">delete</span><span class="dd-text">Move to trash</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="showVersionHistory()"><span class="material-symbols-outlined dd-icon">history</span><span class="dd-text">Version history</span></div>
                  <div class="dd-item" (click)="makeOffline()"><span class="material-symbols-outlined dd-icon">offline_pin</span><span class="dd-text">Make available offline</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="showDetails()"><span class="material-symbols-outlined dd-icon">info</span><span class="dd-text">Details</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('edit', $event)" [class.active]="activeMenu === 'edit'">
                Edit
                <div class="dropdown" *ngIf="activeMenu === 'edit'">
                  <div class="dd-item" (click)="exec('undo')"><span class="material-symbols-outlined dd-icon">undo</span><span class="dd-text">Undo</span><span class="dd-hint">Ctrl+Z</span></div>
                  <div class="dd-item" (click)="exec('redo')"><span class="material-symbols-outlined dd-icon">redo</span><span class="dd-text">Redo</span><span class="dd-hint">Ctrl+Y</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="showToast('Use Ctrl+X to cut')"><span class="material-symbols-outlined dd-icon">content_cut</span><span class="dd-text">Cut</span><span class="dd-hint">Ctrl+X</span></div>
                  <div class="dd-item" (click)="showToast('Use Ctrl+C to copy')"><span class="material-symbols-outlined dd-icon">content_copy</span><span class="dd-text">Copy</span><span class="dd-hint">Ctrl+C</span></div>
                  <div class="dd-item" (click)="showToast('Use Ctrl+V to paste')"><span class="material-symbols-outlined dd-icon">content_paste</span><span class="dd-text">Paste</span><span class="dd-hint">Ctrl+V</span></div>
                  <div class="dd-item" (click)="exec('selectAll')"><span class="dd-text">Select all</span><span class="dd-hint">Ctrl+A</span></div>
                  <div class="dd-item" (click)="exec('delete')"><span class="dd-text">Delete</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="exec('selectAll')"><span class="material-symbols-outlined dd-icon">select_all</span><span class="dd-text">Select all</span><span class="dd-hint">Ctrl+A</span></div>
                  <div class="dd-item" (click)="exec('delete')"><span class="material-symbols-outlined dd-icon">backspace</span><span class="dd-text">Delete</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="openFind()"><span class="material-symbols-outlined dd-icon">search</span><span class="dd-text">Find and replace</span><span class="dd-hint">Ctrl+F</span></div>
                  <div class="dd-item" (click)="exec('delete')"><span class="material-symbols-outlined dd-icon">backspace</span><span class="dd-text">Delete</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="openFind()"><span class="material-symbols-outlined dd-icon">search</span><span class="dd-text">Find and replace</span><span class="dd-hint">Ctrl+F</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('view', $event)" [class.active]="activeMenu === 'view'">
                View
                <div class="dropdown" *ngIf="activeMenu === 'view'">
                  <div class="dd-item" (click)="toggleViewMode()"><span class="material-symbols-outlined dd-icon">edit_note</span><span class="dd-text">Mode: {{ viewMode }}</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="togglePrintLayout()"><span class="material-symbols-outlined dd-icon">{{ showPrintLayout ? 'check_box' : 'check_box_outline_blank' }}</span><span class="dd-text">Print layout</span></div>
                  <div class="dd-item" (click)="toggleRuler()"><span class="material-symbols-outlined dd-icon">{{ showRuler ? 'check_box' : 'check_box_outline_blank' }}</span><span class="dd-text">Ruler</span></div>
                  <div class="dd-item" (click)="toggleEquationToolbar()"><span class="material-symbols-outlined dd-icon">{{ showEquationToolbar ? 'check_box' : 'check_box_outline_blank' }}</span><span class="dd-text">Equation toolbar</span></div>
                  <div class="dd-item" (click)="toggleRuler()"><span class="dd-text">{{ showRuler ? '✓ ' : '' }}Show ruler</span></div>
                  <div class="dd-item" (click)="toggleEquationToolbar()"><span class="dd-text">{{ showEquationToolbar ? '✓ ' : '' }}Show equation toolbar</span></div>
                  <div class="dd-item" (click)="toggleNonPrinting()"><span class="dd-text">{{ showNonPrinting ? '✓ ' : '' }}Show non-printing characters</span><span class="dd-hint">Ctrl+Shift+P</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="toggleFullScreen()"><span class="material-symbols-outlined dd-icon">fullscreen</span><span class="dd-text">Full screen</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('insert', $event)" [class.active]="activeMenu === 'insert'">
                Insert
                <div class="dropdown" *ngIf="activeMenu === 'insert'">
                  <div class="dd-item" (click)="imageInput.click(); closeMenus()"><span class="material-symbols-outlined dd-icon">image</span><span class="dd-text">Image</span></div>
                  <div class="dd-item" (click)="insertTable()"><span class="material-symbols-outlined dd-icon">table</span><span class="dd-text">Table</span></div>
                  <div class="dd-item" (click)="insertLink()"><span class="material-symbols-outlined dd-icon">link</span><span class="dd-text">Link</span><span class="dd-hint">Ctrl+K</span></div>
                  <div class="dd-item" (click)="insertDrawing()"><span class="material-symbols-outlined dd-icon">draw</span><span class="dd-text">Drawing</span></div>
                  <div class="dd-item" (click)="insertChart()"><span class="material-symbols-outlined dd-icon">bar_chart</span><span class="dd-text">Chart</span></div>
                  <div class="dd-item" (click)="insertSymbol()"><span class="material-symbols-outlined dd-icon">special_character</span><span class="dd-text">Special characters</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="exec('insertHorizontalRule')"><span class="material-symbols-outlined dd-icon">horizontal_rule</span><span class="dd-text">Horizontal line</span></div>
                  <div class="dd-item" (click)="insertBreak()"><span class="material-symbols-outlined dd-icon">insert_page_break</span><span class="dd-text">Page break</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('format', $event)" [class.active]="activeMenu === 'format'">
                Format
                <div class="dropdown" *ngIf="activeMenu === 'format'">
                  <div class="dd-item" (click)="exec('bold')"><span class="material-symbols-outlined dd-icon">format_bold</span><span class="dd-text">Bold</span><span class="dd-hint">Ctrl+B</span></div>
                  <div class="dd-item" (click)="exec('italic')"><span class="material-symbols-outlined dd-icon">format_italic</span><span class="dd-text">Italic</span><span class="dd-hint">Ctrl+I</span></div>
                  <div class="dd-item" (click)="exec('underline')"><span class="material-symbols-outlined dd-icon">format_underlined</span><span class="dd-text">Underline</span><span class="dd-hint">Ctrl+U</span></div>
                  <div class="dd-item" (click)="exec('strikeThrough')"><span class="material-symbols-outlined dd-icon">strikethrough_s</span><span class="dd-text">Strikethrough</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="exec('justifyLeft')"><span class="material-symbols-outlined dd-icon">format_align_left</span><span class="dd-text">Align left</span></div>
                  <div class="dd-item" (click)="exec('justifyCenter')"><span class="material-symbols-outlined dd-icon">format_align_center</span><span class="dd-text">Align center</span></div>
                  <div class="dd-item" (click)="exec('justifyRight')"><span class="material-symbols-outlined dd-icon">format_align_right</span><span class="dd-text">Align right</span></div>
                  <div class="dd-item" (click)="exec('justifyFull')"><span class="material-symbols-outlined dd-icon">format_align_justify</span><span class="dd-text">Justify</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('tools', $event)" [class.active]="activeMenu === 'tools'">
                Tools
                <div class="dropdown" *ngIf="activeMenu === 'tools'">
                  <div class="dd-item" (click)="checkSpelling()"><span class="material-symbols-outlined dd-icon">spellcheck</span><span class="dd-text">Spelling and grammar</span></div>
                  <div class="dd-item" (click)="showWordCount()"><span class="material-symbols-outlined dd-icon">123</span><span class="dd-text">Word count</span><span class="dd-hint">Ctrl+Shift+C</span></div>
                  <div class="dd-item" (click)="openDictionary()"><span class="material-symbols-outlined dd-icon">dictionary</span><span class="dd-text">Dictionary</span><span class="dd-hint">Ctrl+Shift+Y</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('help', $event)" [class.active]="activeMenu === 'help'">
                Help
                <div class="dropdown" *ngIf="activeMenu === 'help'">
                  <div class="dd-item" (click)="showToast('Coming soon')"><span class="material-symbols-outlined dd-icon">help</span><span class="dd-text">Writer Help</span></div>
                  <div class="dd-item" (click)="showToast('Coming soon')"><span class="material-symbols-outlined dd-icon">keyboard</span><span class="dd-text">Keyboard shortcuts</span><span class="dd-hint">Ctrl+/</span></div>
                </div>
            </div>
          </div>
        </div>

      <!-- Formatting Toolbar -->
      <div class="fmt-bar" (mousedown)="$event.preventDefault()">
        <button class="fb" (click)="exec('undo')" title="Undo"><span class="material-symbols-outlined">undo</span></button>
        <button class="fb" (click)="exec('redo')" title="Redo"><span class="material-symbols-outlined">redo</span></button>
        <button class="fb" (click)="printDoc()" title="Print"><span class="material-symbols-outlined">print</span></button>
        <span class="sep"></span>

        <div class="menu-item style-dropdown" (click)="toggleMenu('style', $event)" [class.active]="activeMenu === 'style'" title="Paragraph style">
          <span style="max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block; vertical-align:middle;">{{ activeBlockStyle }}</span> <span class="material-symbols-outlined arrow-icon" style="vertical-align:middle;">expand_more</span>
          <div class="dropdown style-dd" *ngIf="activeMenu === 'style'">
            <div class="dd-item" (click)="changeStyle('p', 'Normal')"><span class="dd-text" style="font-size:14px;">Normal</span></div>
            <div class="dd-item" (click)="changeStyle('h1', 'Title')"><span class="dd-text" style="font-size:22px;font-weight:700;">Title</span></div>
            <div class="dd-item" (click)="changeStyle('h2', 'Subtitle')"><span class="dd-text" style="font-size:16px;color:#5f6368;">Subtitle</span></div>
            <div class="dd-item" (click)="changeStyle('h3', 'Heading 1')"><span class="dd-text" style="font-size:18px;font-weight:600;">Heading 1</span></div>
            <div class="dd-item" (click)="changeStyle('h4', 'Heading 2')"><span class="dd-text" style="font-size:15px;font-weight:600;">Heading 2</span></div>
            <div class="dd-item" (click)="changeStyle('h5', 'Heading 3')"><span class="dd-text" style="font-size:13px;font-weight:600;">Heading 3</span></div>
          </div>
        </div>
        
        <span class="sep"></span>

        <div class="menu-item font-dropdown" (click)="toggleMenu('font', $event)" [class.active]="activeMenu === 'font'" title="Font family">
          <span [style.font-family]="activeFontFamily" style="max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block; vertical-align:middle;">{{ activeFontFamily }}</span> <span class="material-symbols-outlined arrow-icon" style="vertical-align:middle;">expand_more</span>
          <div class="dropdown font-dd" *ngIf="activeMenu === 'font'">
            <div class="dd-item" *ngFor="let font of fonts" (click)="changeFont(font)">
              <span class="dd-text" [style.font-family]="font">{{ font }}</span>
            </div>
          </div>
        </div>

        <span class="sep"></span>

        <div class="font-size-control" style="position: relative;">
          <button class="fb size-btn" (click)="decrementFontSize()" title="Decrease font size"><span class="material-symbols-outlined">remove</span></button>
          
          <div class="size-input-wrapper" (click)="showFontSizeMenu = !showFontSizeMenu; $event.stopPropagation()">
            <input class="size-input" [(ngModel)]="activeFontSize" (change)="onFontSizeInputChange()" (click)="$event.stopPropagation()" />
            <span class="material-symbols-outlined">arrow_drop_down</span>
          </div>

          <button class="fb size-btn" (click)="incrementFontSize()" title="Increase font size"><span class="material-symbols-outlined">add</span></button>
          <div class="dropdown" *ngIf="showFontSizeMenu" (click)="$event.stopPropagation()" style="position: absolute; top: 100%; left: 24px; width: 52px; min-width: 52px; z-index: 1000; max-height: 250px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; border: 1px solid #ccc; padding: 4px 0; display: block;">
            <div class="dd-item" style="padding: 6px 12px; text-align: center; cursor: pointer; border-bottom: none;" *ngFor="let s of [8,9,10,11,12,14,18,24,30,36,48,60,72]" (click)="changeFontSize(s)">{{ s }}</div>
          </div>
        </div>

        <span class="sep"></span>

        <button class="fb" (click)="exec('bold')" [class.active-fb]="isBold" title="Bold (Ctrl+B)"><span class="material-symbols-outlined">format_bold</span></button>
        <button class="fb" (click)="exec('italic')" [class.active-fb]="isItalic" title="Italic (Ctrl+I)"><span class="material-symbols-outlined">format_italic</span></button>
        <button class="fb" (click)="exec('underline')" [class.active-fb]="isUnderline" title="Underline (Ctrl+U)"><span class="material-symbols-outlined">format_underlined</span></button>
        <button class="fb" (click)="exec('strikeThrough')" [class.active-fb]="isStrikethrough" title="Strikethrough"><span class="material-symbols-outlined">strikethrough_s</span></button>
        
        <label class="fb color-btn" title="Text color" style="cursor:pointer; position:relative; overflow:hidden;">
          <span class="material-symbols-outlined">format_color_text</span>
          <span class="color-indicator" [style.background]="activeColor"></span>
          <input type="color" [(ngModel)]="activeColor" (change)="execVal('foreColor', activeColor)" style="position:absolute; opacity:0; width:0; height:0;" />
        </label>
        
        <label class="fb color-btn" title="Highlight color" style="cursor:pointer; position:relative; overflow:hidden;">
          <span class="material-symbols-outlined">format_ink_highlighter</span>
          <span class="color-indicator" [style.background]="activeHighlight"></span>
          <input type="color" [(ngModel)]="activeHighlight" (change)="execVal('hiliteColor', activeHighlight)" style="position:absolute; opacity:0; width:0; height:0;" />
        </label>

        <span class="sep"></span>

        <button class="fb" (click)="exec('justifyLeft')" title="Align left"><span class="material-symbols-outlined">format_align_left</span></button>
        <button class="fb" (click)="exec('justifyCenter')" title="Align center"><span class="material-symbols-outlined">format_align_center</span></button>
        <button class="fb" (click)="exec('justifyRight')" title="Align right"><span class="material-symbols-outlined">format_align_right</span></button>
        <button class="fb" (click)="exec('justifyFull')" title="Justify"><span class="material-symbols-outlined">format_align_justify</span></button>

        <span class="sep"></span>

        <button class="fb" (click)="exec('insertUnorderedList')" title="Bulleted list"><span class="material-symbols-outlined">format_list_bulleted</span></button>
        <button class="fb" (click)="exec('insertOrderedList')" title="Numbered list"><span class="material-symbols-outlined">format_list_numbered</span></button>
        <button class="fb" (click)="exec('indent')" title="Increase indent"><span class="material-symbols-outlined">format_indent_increase</span></button>
        <button class="fb" (click)="exec('outdent')" title="Decrease indent"><span class="material-symbols-outlined">format_indent_decrease</span></button>

        <span class="sep"></span>

        <button class="fb" (click)="insertLink()" title="Insert link"><span class="material-symbols-outlined">link</span></button>
        <button class="fb" (click)="imageInput.click()" title="Insert image"><span class="material-symbols-outlined">image</span></button>
        <button class="fb" (click)="insertTable()" title="Insert table"><span class="material-symbols-outlined">table</span></button>
      </div>

      <div class="equation-bar" *ngIf="showEquationToolbar">
         <button class="fb" (click)="insertText('α')">α</button> <button class="fb" (click)="insertText('β')">β</button> <button class="fb" (click)="insertText('γ')">γ</button> <span class="sep"></span>
         <button class="fb" (click)="insertText('∑')">∑</button> <button class="fb" (click)="insertText('∫')">∫</button> <button class="fb" (click)="insertText('√')">√</button> <span class="sep"></span>
         <button class="fb" (click)="insertText('∞')">∞</button> <button class="fb" (click)="insertText('≠')">≠</button> <button class="fb" (click)="insertText('≈')">≈</button>
      </div>

      <div class="editor-layout">
        <div class="sidebar" *ngIf="showPrintLayout">
          <div class="thumbnail" *ngFor="let p of pageCountArray; let i = index" (click)="scrollToPage(i)">
            <div class="thumb-page">
              <button class="delete-page-btn" (click)="deletePage(i, $event)" title="Delete Page">&times;</button>
            </div>
            <div class="thumb-label">{{ i + 1 }}</div>
          </div>
          <div class="add-page-btn-wrapper" style="margin-top: 16px; display: flex; justify-content: center;">
            <button (click)="insertBreak()" title="Add new page" style="width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 1px solid #dadce0; box-shadow: 0 1px 3px rgba(60,64,67,.1); display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <span class="material-symbols-outlined" style="color: #1a73e8; font-size: 24px;">add</span>
            </button>
          </div>
        </div>
        <div class="page-area" #pageArea [class.no-print]="!showPrintLayout" (scroll)="updateOverlay()" (mousedown)="onPageMouseDown($event)">
          <div style="margin: 0 auto; width: 816px; display:flex; flex-direction: column; align-items: center; padding-bottom: 48px;">
            <div class="ruler" *ngIf="showRuler"></div>
            <div style="position: relative; width: 816px;">
              <div class="page-bg-layer" *ngIf="showPrintLayout">
                 <div class="page-bg" *ngFor="let p of pageCountArray"></div>
              </div>
              <div class="page" [attr.contenteditable]="viewMode === 'Editing' ? 'true' : 'false'" #editor
                [class.show-np]="showNonPrinting"
                (input)="onInput(editor)" (blur)="save()">
              </div>
            </div>
          </div>
        </div>
      </div>

      <input type="file" #imageInput (change)="onImageUpload($event)" accept="image/*" style="display: none">
      <input type="file" #docInput (change)="onDocOpen($event)" accept=".txt,.html" style="display: none">
      <div class="toast" [class.show]="toastVisible">{{ toastMsg }}</div>

      <!-- Image Resize Overlay -->
      <div class="resize-overlay" *ngIf="selectedImage" 
           [style.top.px]="overlayRect.top" [style.left.px]="overlayRect.left" 
           [style.width.px]="overlayRect.width" [style.height.px]="overlayRect.height">
        <div class="resize-handle tl" (mousedown)="startResize($event, 'tl')"></div>
        <div class="resize-handle tr" (mousedown)="startResize($event, 'tr')"></div>
        <div class="resize-handle bl" (mousedown)="startResize($event, 'bl')"></div>
        <div class="resize-handle br" (mousedown)="startResize($event, 'br')"></div>
      </div>

      <!-- Find Dialog -->
      <div class="find-dialog" *ngIf="findDialogVisible">
        <input type="text" [(ngModel)]="findTextQuery" placeholder="Find in document" (keyup.enter)="executeFind()">
        <button class="btn outline" (click)="executeFind()">Next</button>
        <button class="btn outline" (click)="findDialogVisible = false">Close</button>
      </div>

      <!-- Drawing Modal -->
      <div class="modal-overlay" *ngIf="drawingModalVisible">
        <div class="modal" style="width: 600px;">
          <h3>Drawing Canvas</h3>
          <canvas #drawCanvas width="560" height="300" style="border: 1px solid #ccc; cursor: crosshair; background: #fff;"
            (mousedown)="startDraw($event)" (mousemove)="draw($event)" (mouseup)="stopDraw()" (mouseleave)="stopDraw()"></canvas>
          <div class="modal-actions" style="margin-top: 16px;">
            <button class="btn outline" (click)="clearDrawing()">Clear</button>
            <div style="flex: 1"></div>
            <button class="btn outline" (click)="drawingModalVisible = false">Cancel</button>
            <button class="btn" (click)="insertDrawingImage()">Save and Close</button>
          </div>
        </div>
      </div>

      <!-- Chart Modal -->
      <div class="modal-overlay" *ngIf="chartModalVisible">
        <div class="modal">
          <h3>Insert Chart</h3>
          <p style="color: #5f6368; font-size: 13px;">Generate a dynamic bar chart from data</p>
          <div style="margin-top: 12px; text-align: left;">
            <label style="display:block; margin-bottom: 4px; font-weight: 500;">Chart Title:</label>
            <input type="text" [(ngModel)]="chartTitle" class="form-control" placeholder="e.g. Sales">
          </div>
          <div style="margin-top: 12px; text-align: left;">
            <label style="display:block; margin-bottom: 4px; font-weight: 500;">Values (comma separated numbers):</label>
            <input type="text" [(ngModel)]="chartValues" class="form-control" placeholder="e.g. 10, 25, 15, 30">
          </div>
          <div class="modal-actions" style="margin-top: 16px;">
            <button class="btn outline" (click)="chartModalVisible = false">Cancel</button>
            <button class="btn" (click)="generateAndInsertChart()">Insert Chart</button>
          </div>
        </div>
      </div>

      <!-- Share Modal -->
      <div class="modal-overlay" *ngIf="shareModalOpen" (click)="shareModalOpen = false">
        <div class="modal share-modal" (click)="$event.stopPropagation()">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="background:#1a73e8; color:#fff; display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:4px;">
                <span class="material-symbols-outlined" style="font-size:16px;">description</span>
          </div>
              <h3>Share "{{ title || 'Untitled document' }}"</h3>
            </div>
          </div>
            <button class="sm-close-btn" (click)="shareModalOpen = false" style="position: absolute; top: 12px; right: 16px; background: none; border: none;">
              <span class="material-symbols-outlined" style="font-size:20px;">close</span>
            </button>
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
              <button (click)="performShare()" style="background:#1a73e8; color:#fff; border:none; border-radius:24px; font-weight:500; font-size:14px; padding:0 24px; height:44px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#1557b0'" onmouseout="this.style.background='#1a73e8'">Share</button>
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

      <!-- Dictionary Modal -->
      <div class="modal-overlay" *ngIf="dictModalOpen">
        <div class="modal" style="width: 400px; max-height: 80vh; overflow-y: auto; text-align: left;">
          <h3 style="margin-top: 0;">Dictionary</h3>
          <div style="display: flex; gap: 8px; margin-top: 12px; margin-bottom: 16px;">
            <input type="text" [(ngModel)]="dictWord" class="form-control" placeholder="Enter a word" (keyup.enter)="searchDictionary()">
            <button class="btn" (click)="searchDictionary()">Search</button>
          </div>
          
          <div *ngIf="dictLoading" style="text-align: center; color: #5f6368; padding: 20px;">Searching...</div>
          <div *ngIf="dictError" style="color: #ea4335; text-align: center; padding: 20px;">{{ dictError }}</div>
          
          <div *ngIf="dictResults && dictResults.length > 0">
            <div *ngFor="let result of dictResults" style="margin-bottom: 16px;">
              <h4 style="margin: 0; font-size: 18px; color: #202124;">{{ result.word }} <span style="font-size: 14px; color: #5f6368; font-weight: normal;">{{ result.phonetic }}</span></h4>
              <div *ngFor="let meaning of result.meanings" style="margin-top: 8px;">
                <div style="font-style: italic; color: #1a73e8; font-size: 13px;">{{ meaning.partOfSpeech }}</div>
                <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 13px; color: #3c4043;">
                  <li *ngFor="let def of meaning.definitions" style="margin-bottom: 4px;">
                    {{ def.definition }}
                    <div *ngIf="def.example" style="color: #5f6368; font-style: italic; margin-top: 2px;">"{{ def.example }}"</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="modal-actions" style="margin-top: 16px;">
            <button class="btn outline" (click)="dictModalOpen = false">Close</button>
          </div>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="status-bar">
        <div class="status-left">
          <div class="status-item" (click)="toggleWidget('chat')">
            <span class="material-symbols-outlined" style="font-size:16px;color:#d32f2f;">chat</span>
            <span>Chats</span>
         </div>
          <div class="status-item" (click)="toggleWidget('channels')">
            <span class="material-symbols-outlined" style="font-size:16px;">group</span>
            <span>Channels</span>
         </div>
          <div class="status-item" (click)="toggleWidget('contacts')">
            <span class="material-symbols-outlined" style="font-size:16px;">person</span>
            <span>Contacts</span>
          </div>
          <span class="status-divider"></span>
          <div class="status-info">Words: {{ wordCount }}</div>
          <div class="status-info">Chars: {{ charCount }}</div>
          <div class="status-info">Page: {{ currentPage }} of {{ pageCountArray.length }}</div>
        </div>
        <div class="status-right">
          <div class="status-info">{{ viewMode }}</div>
          <span class="status-divider"></span>
          <button class="zoom-btn" (click)="zoomOut()"><span class="material-symbols-outlined" style="font-size:16px;">remove</span></button>
          <div class="status-info">{{ zoomLevel }}%</div>
          <button class="zoom-btn" (click)="zoomIn()"><span class="material-symbols-outlined" style="font-size:16px;">add</span></button>
         </div>
      </div>

      <app-chat-widget [activeWidget]="activeWidget" (close)="activeWidget=null"></app-chat-widget>

    </div>
  `,
  styleUrls: ['./doc-editor.component.css']
})
export class DocEditorComponent implements OnInit, OnDestroy {
  activeWidget: string | null = null;
  toggleWidget(w: string) {
    if (this.activeWidget === w) this.activeWidget = null;
    else this.activeWidget = w;
  }
  docId = '';
  activeFontFamily = 'Arial';
  activeFontSize = 11;
  activeBlockStyle = 'Normal text';
  fonts = ['Arial', 'Caveat', 'Comfortaa', 'Comic Sans MS', 'Courier New', 'EB Garamond', 'Georgia', 'Impact', 'Lexend', 'Lobster', 'Lora', 'Merriweather', 'Oswald', 'Pacifico', 'Playfair Display', 'Roboto', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

  title = 'Untitled';
  htmlContent = '';
  activeUsers = 1;
  activeMenu: string | null = null;
  wordCount = 0;
  charCount = 0;
  currentPage = 1;
  zoomLevel = 100;
  isSaving = false;
  lastSavedTime: Date | null = null;
  isStarred = false;

  get savedTimeStr() {
    if (!this.lastSavedTime) return 'Saved';
    return 'Saved at ' + this.lastSavedTime.toLocaleTimeString();
  }

  isBold = false;
  isItalic = false;
  isUnderline = false;
  isStrikethrough = false;
  activeColor = '#000000';
  activeHighlight = '#ffffff';

  get currentUrl(): string { return window.location.href; }
  
  viewMode: 'Editing' | 'Viewing' = 'Editing';
  showPrintLayout = true;
  showRuler = false;
  showEquationToolbar = false;
  showNonPrinting = false;

  shareModalOpen = false;
  isPublic = false;
  shareQuery = '';
  shareRoleDropdownOpen = false;
  shareRole = 'View';
  userSearchResults: any[] = [];
  findDialogVisible = false;
  findTextQuery = '';
  pageCountArray: number[] = [0];
  toastVisible = false;
  toastMsg = '';

  dictModalOpen = false;
  dictWord = '';
  dictLoading = false;
  dictError = '';
  dictResults: any[] = [];
  private syncSub?: Subscription;
  private applyingRemote = false;

  selectedImage: HTMLImageElement | null = null;
  overlayRect = { top: 0, left: 0, width: 0, height: 0 };
  isResizing = false;
  resizeCorner = 'br';
  startX = 0;
  startW = 0;

  isDraggingImage = false;
  dragStartX = 0;
  dragStartY = 0;
  imgStartX = 0;
  imgStartY = 0;

  // Drawing Modal State
  drawingModalVisible = false;
  isDrawing = false;
  drawCtx: CanvasRenderingContext2D | null = null;
  lastX = 0;
  lastY = 0;
  @ViewChild('drawCanvas') drawCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Chart Modal State
  chartModalVisible = false;
  chartTitle = 'Quarterly Revenue';
  chartValues = '40, 80, 60, 100';

  @ViewChild('pageArea') pageAreaRef!: ElementRef<HTMLElement>;

  get initials() {
    return (this.auth.user?.name ?? 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public auth: AuthService
  ) { }

  ngOnInit() {
    this.docId = this.route.snapshot.paramMap.get('id') ?? '';
    document.execCommand('defaultParagraphSeparator', false, 'div');
    
    this.api.getDocument(this.docId).subscribe((doc: any) => {
      this.title = doc.title;
      if (doc.updated_at) {
        this.lastSavedTime = new Date(doc.updated_at);
      }
      try { 
        const p = JSON.parse(doc.content || '{}'); 
        this.htmlContent = p.html ?? '<div><br></div>'; 
        const el = document.querySelector('.page') as HTMLElement;
        if (el) {
          el.innerHTML = this.htmlContent;
          try { document.execCommand('enableObjectResizing', false, 'false'); } catch (e) { }
          setTimeout(() => {
             this.autoPaginate();
             this.updatePageHeight();

            // Setup selection change listener
            document.addEventListener('selectionchange', this.onSelectionChange.bind(this));
          }, 100);
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
            this.htmlContent = p.html ?? '<div><br></div>';
            const el = document.querySelector('.page') as HTMLElement;
            if (el) {
              el.innerHTML = this.htmlContent;
              try { document.execCommand('enableObjectResizing', false, 'false'); } catch (e) { }
              setTimeout(() => {
                 this.autoPaginate();
                 this.updatePageHeight();
              }, 100);
            }
          } catch { }
        }
        setTimeout(() => this.applyingRemote = false, 50);
      }
    });
  }


  onSelectionChange() {
    if (this.viewMode !== 'Editing') return;

    // Update toolbar buttons based on selection
    this.isBold = document.queryCommandState('bold');
    this.isItalic = document.queryCommandState('italic');
    this.isUnderline = document.queryCommandState('underline');
    this.isStrikethrough = document.queryCommandState('strikeThrough');

    // Attempt to get font family
    const fontName = document.queryCommandValue('fontName');
    if (fontName) {
      this.activeFontFamily = fontName.replace(/["']/g, '').split(',')[0].trim();
    }

    // Attempt to get format block
    const formatBlock = document.queryCommandValue('formatBlock');
    if (formatBlock) {
      if (formatBlock === 'p' || formatBlock === 'div') this.activeBlockStyle = 'Normal text';
      else if (formatBlock === 'h1') this.activeBlockStyle = 'Title';
      else if (formatBlock === 'h2') this.activeBlockStyle = 'Subtitle';
      else if (formatBlock === 'h3') this.activeBlockStyle = 'Heading 1';
      else if (formatBlock === 'h4') this.activeBlockStyle = 'Heading 2';
      else if (formatBlock === 'h5') this.activeBlockStyle = 'Heading 3';
    }
  }

  toggleStar() {
    this.isStarred = !this.isStarred;
    this.showToast(this.isStarred ? 'Starred' : 'Unstarred');
  }

  toggleMenu(menu: string, event: Event) {
    event.stopPropagation();
    this.activeMenu = this.activeMenu === menu ? null : menu;
  }

  closeMenus(event?: Event) {
    this.activeMenu = null;
    this.showFontSizeMenu = false;
  }

  newDoc() {
    this.api.createDocument('Untitled', 'doc').subscribe((doc: any) => {
      this.closeMenus();
      window.location.href = `/doc/${doc.id}`;
    });
  }

  renameDoc() {
    this.closeMenus();
    setTimeout(() => {
      const el = document.querySelector('.title-input') as HTMLInputElement;
      if (el) el.focus();
    }, 10);
  }

  makeCopy() {
    this.closeMenus();
    this.api.createDocument(this.title + ' (Copy)', 'doc').subscribe((doc: any) => {
      this.api.saveDocument(doc.id, doc.title, JSON.stringify({ html: this.htmlContent })).subscribe(() => {
        window.location.href = `/doc/${doc.id}`;
      });
    });
  }

  trashDoc() {
    this.closeMenus();
    if (confirm('Are you sure you want to move this document to the trash?')) {
      this.api.deleteDocument(this.docId).subscribe(() => {
        this.router.navigate(['/']);
      });
    }
  }

  openFind() {
    this.closeMenus();
    this.findDialogVisible = true;
    setTimeout(() => {
      const input = document.querySelector('.find-dialog input') as HTMLInputElement;
      if (input) input.focus();
    }, 10);
  }

  executeFind() {
    if (this.findTextQuery) {
      const el = document.querySelector('.page') as HTMLElement;
      if (el) el.focus();
      
      // Try to find the text. If we hit the end, reset selection and search from top.
      if (!(window as any).find(this.findTextQuery)) {
        window.getSelection()?.removeAllRanges();
        if (!(window as any).find(this.findTextQuery)) {
          this.showToast('Text not found.');
        }
      }
    }
  }

  toggleFullScreen() {
    this.closeMenus();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        this.showToast('Could not enable full screen.');
      });
    } else {
      document.exitFullscreen();
    }
  }
  showFontSizeMenu = false;

  hideFontSizeMenu() {
    setTimeout(() => { this.showFontSizeMenu = false; }, 150);
  }

  toggleViewMode() { this.viewMode = this.viewMode === 'Editing' ? 'Viewing' : 'Editing'; this.closeMenus(); }
  togglePrintLayout() { this.showPrintLayout = !this.showPrintLayout; this.closeMenus(); }
  toggleRuler() { this.showRuler = !this.showRuler; this.closeMenus(); }
  toggleEquationToolbar() { this.showEquationToolbar = !this.showEquationToolbar; this.closeMenus(); }
  toggleNonPrinting() { this.showNonPrinting = !this.showNonPrinting; this.closeMenus(); }

  insertImage() {
    this.closeMenus();
    const url = prompt('Enter image URL:', 'https://');
    if (url) {
      document.execCommand('insertImage', false, url);
    }
  }

  onImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        document.execCommand('insertImage', false, dataUrl);
      };
      reader.readAsDataURL(file);
    }
    (event.target as HTMLInputElement).value = '';
  }

  onDocOpen(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const content = file.name.endsWith('.html') ? text : text.replace(/\n/g, '<br>');
        
        this.api.createDocument(file.name.replace(/\.[^/.]+$/, ""), 'doc').subscribe((doc: any) => {
          this.api.saveDocument(doc.id, doc.title, JSON.stringify({ html: content })).subscribe(() => {
            window.location.href = `/doc/${doc.id}`;
          });
        });
      };
      reader.readAsText(file);
    }
    (event.target as HTMLInputElement).value = '';
  }

  emailDoc() {
    this.closeMenus();
    const subject = encodeURIComponent(`Document: ${this.title}`);
    const body = encodeURIComponent(`Check out this document I am sharing with you:\n\n${window.location.href}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  showVersionHistory() {
    this.closeMenus();
    alert(`Version History\n\nOnly the current active version is available for this document.\nAuto-save is active.`);
  }

  makeOffline() {
    this.closeMenus();
    try {
      localStorage.setItem(`offline_doc_${this.docId}`, this.htmlContent);
      this.showToast('Document cached for offline access.');
    } catch {
      this.showToast('Failed to enable offline access.');
    }
  }

  showDetails() {
    this.closeMenus();
    const el = document.querySelector('.page') as HTMLElement;
    const text = el ? (el.innerText || '') : '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    alert(`Document Details\n\nTitle: ${this.title}\nLocation: My Drive\nActive Users: ${this.activeUsers}\nWords: ${words}\nCharacters: ${chars}`);
  }

  showWordCount() {
    this.closeMenus();
    const el = document.querySelector('.page') as HTMLElement;
    if (el) {
      const text = el.innerText || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      alert(`Word count\n\nWords: ${words}\nCharacters: ${chars}`);
    }
  }

  printDoc() {
    this.closeMenus();
    // Use @media print rules — UI chrome is hidden via CSS
    window.print();
  }

  insertLink() {
    this.closeMenus();
    const url = prompt('Enter link URL:', 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  }

  exec(cmd: string) { 
    this.closeMenus();
    const el = document.querySelector('.page') as HTMLElement;
    if (el) {
      if (!el.contains(window.getSelection()?.anchorNode || null)) {
        el.focus();
      }
      try { document.execCommand('enableObjectResizing', false, 'false'); } catch (e) { }
    }
    document.execCommand(cmd, false); 
    setTimeout(() => {
      this.updateOverlay();
      this.updatePageHeight();
      this.save();
    }, 10);
  }

  execVal(cmd: string, val: string | Event) {
    this.closeMenus();
    const el = document.querySelector('.page') as HTMLElement;
    if (el) el.focus();

    let value = typeof val === 'string' ? val : (val.target as HTMLSelectElement).value;
    if (value) document.execCommand(cmd, false, value);

    if (typeof val !== 'string') {
      (val.target as HTMLSelectElement).value = '';
    }

    setTimeout(() => {
      this.updateOverlay();
      this.updatePageHeight();
      this.save();
    }, 10);
  }

  changeFont(font: string) {
    this.activeFontFamily = font;
    document.execCommand('fontName', false, font);
    this.closeMenus();
    setTimeout(() => { this.updatePageHeight(); this.save(); }, 10);
  }

  changeFontSize(size: number) {
    this.activeFontSize = size;
    const val = size + 'pt';
    const el = document.querySelector('.page') as HTMLElement;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      const span = document.createElement('span');
      span.style.fontSize = val;
      span.innerHTML = '&#8203;';
      const range = sel.getRangeAt(0);
      range.insertNode(span);
      range.setStart(span.firstChild!, 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
    document.execCommand('fontSize', false, '7'); 
    const fontEls = document.querySelectorAll('font[size="7"]');
    fontEls.forEach(f => {
        f.removeAttribute('size');
        f.setAttribute('style', `font-size: ${val}`);
    });
    }

    this.closeMenus();
    setTimeout(() => { this.updatePageHeight(); this.save(); }, 10);
  }

  onFontSizeInputChange() {
    if (this.activeFontSize > 0) this.changeFontSize(this.activeFontSize);
  }

  incrementFontSize() {
    this.changeFontSize(this.activeFontSize + 1);
  }

  decrementFontSize() {
    if (this.activeFontSize > 1) {
      this.changeFontSize(this.activeFontSize - 1);
    }
  }

  changeStyle(style: string, label: string) {
    this.activeBlockStyle = label;
    document.execCommand('formatBlock', false, style);
    this.closeMenus();
    setTimeout(() => { this.updatePageHeight(); this.save(); }, 10);
  }

  insertText(text: string) {
    const el = document.querySelector('.page') as HTMLElement;
    if (el) el.focus();
    document.execCommand('insertText', false, text);
    this.closeMenus();
  }

  insertHTML(html: string) {
    const el = document.querySelector('.page') as HTMLElement;
    if (!el) return;

    el.focus();
    const sel = window.getSelection();
    if (sel) {
      let hasValidRange = false;
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (el.contains(range.commonAncestorContainer)) {
          hasValidRange = true;
        }
      }

      // If no valid selection inside the editor, place cursor at the end
      if (!hasValidRange) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false); // collapse to end
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    document.execCommand('insertHTML', false, html);
    this.closeMenus();
  }

  insertTable() {
    this.closeMenus();
    const input = prompt('Enter table dimensions (Rows x Columns), e.g., "3x4":', '3x3');
    if (!input) return;
    
    const parts = input.toLowerCase().split('x');
    const rows = parseInt(parts[0]?.trim() || '3', 10);
    const cols = parseInt(parts[1]?.trim() || '3', 10);
    
    if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
      alert('Invalid dimensions. Please enter in format "Rows x Columns", like "3x4".');
      return;
    }
    
    let html = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;"><tbody>';
    for (let r = 0; r < Math.min(rows, 20); r++) {
      html += '<tr>';
      for (let c = 0; c < Math.min(cols, 20); c++) {
        html += '<td><br></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><br>';
    
    this.insertHTML(html);
  }

  insertBreak() {
    const el = document.querySelector('.page') as HTMLElement;
    if (!el) return;

    // Get current selection
    const sel = window.getSelection();
    let targetBlock: HTMLElement | null = null;

    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer as HTMLElement;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement as HTMLElement;

      // Traverse up to find the direct child of .page
      while (node && node !== el && node.parentElement !== el) {
        node = node.parentElement as HTMLElement;
      }
      if (node && node.parentElement === el) {
        targetBlock = node as HTMLElement;
      }
    }

    const breakHTML = '<div class="manual-page-break" style="page-break-after: always;"></div><div class="page-break-content" style="min-height: 20px;">&#8203;</div>';

    if (targetBlock) {
      targetBlock.insertAdjacentHTML('afterend', breakHTML);
      const newBlock = targetBlock.nextElementSibling?.nextElementSibling;
      if (newBlock) {
        const range = document.createRange();
        range.selectNodeContents(newBlock);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    } else {
      el.insertAdjacentHTML('beforeend', breakHTML);
      const newBlock = el.lastElementChild;
      if (newBlock) {
        const range = document.createRange();
        range.selectNodeContents(newBlock);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }

    this.closeMenus();
    this.onInput(el); // Force update
  }

  insertBuildingBlock() {
    this.insertHTML('<strong>Meeting Notes</strong><br><em>Date:</em><br><em>Attendees:</em><br><em>Action Items:</em><br><ul><li><br></li></ul><br>');
  }

  insertSmartChip() {
    this.closeMenus();
    const name = prompt('Enter user name for Smart Chip:');
    if (name) {
      const el = document.querySelector('.page') as HTMLElement;
      if (el) el.focus();
      document.execCommand('insertHTML', false, `<span contenteditable="false" style="background: #e8f0fe; color: #1a73e8; padding: 2px 8px; border-radius: 12px; font-weight: 500; margin: 0 4px;">@${name}</span>&nbsp;`);
    }
  }

  insertSignature() {
    this.closeMenus();
    const name = prompt('Enter your name for eSignature:');
    if (name) {
      const el = document.querySelector('.page') as HTMLElement;
      if (el) el.focus();
      document.execCommand('insertHTML', false, `<span contenteditable="false" style="font-family: cursive, 'Brush Script MT'; font-size: 1.5em; color: #000080; margin: 0 4px;">${name}</span>&nbsp;`);
    }
  }

  insertDrawing() {
    this.closeMenus();
    this.drawingModalVisible = true;
    setTimeout(() => {
      const canvas = this.drawCanvasRef?.nativeElement;
      if (canvas) {
        this.drawCtx = canvas.getContext('2d');
        if (this.drawCtx) {
          this.drawCtx.fillStyle = '#ffffff';
          this.drawCtx.fillRect(0, 0, canvas.width, canvas.height);
          this.drawCtx.strokeStyle = '#1a73e8';
          this.drawCtx.lineWidth = 3;
          this.drawCtx.lineCap = 'round';
        }
      }
    }, 100);
  }

  startDraw(e: MouseEvent) {
    this.isDrawing = true;
    this.lastX = e.offsetX;
    this.lastY = e.offsetY;
  }
  
  draw(e: MouseEvent) {
    if (!this.isDrawing || !this.drawCtx) return;
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(this.lastX, this.lastY);
    this.drawCtx.lineTo(e.offsetX, e.offsetY);
    this.drawCtx.stroke();
    this.lastX = e.offsetX;
    this.lastY = e.offsetY;
  }
  
  stopDraw() { this.isDrawing = false; }
  
  clearDrawing() {
    const canvas = this.drawCanvasRef?.nativeElement;
    if (this.drawCtx && canvas) {
      this.drawCtx.fillStyle = '#ffffff';
      this.drawCtx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  insertDrawingImage() {
    const canvas = this.drawCanvasRef?.nativeElement;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      this.drawingModalVisible = false;
      const el = document.querySelector('.page') as HTMLElement;
      if (el) el.focus();
      document.execCommand('insertImage', false, dataUrl);
    }
  }

  insertChart() {
    this.closeMenus();
    this.chartModalVisible = true;
  }

  generateAndInsertChart() {
    const vals = this.chartValues.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
    if (vals.length === 0) {
      alert('Please enter valid numbers separated by commas.');
      return;
    }
    
    const max = Math.max(...vals, 1);
    const width = 400;
    const height = 250;
    const barWidth = (width - 40) / vals.length;
    const colors = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#673ab7', '#ff9800'];
    
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border:1px solid #ccc; border-radius: 4px;">`;
    svg += `<text x="${width / 2}" y="30" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle" fill="#202124">${this.chartTitle}</text>`;
    
    vals.forEach((v, i) => {
      const h = (v / max) * (height - 80);
      const x = 20 + i * barWidth + 10;
      const y = height - 30 - h;
      const color = colors[i % colors.length];
      svg += `<rect x="${x}" y="${y}" width="${barWidth - 20}" height="${h}" fill="${color}" rx="2" />`;
      svg += `<text x="${x + (barWidth - 20) / 2}" y="${y - 8}" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="#5f6368">${v}</text>`;
    });
    
    svg += `</svg>`;
    
    const svg64 = btoa(unescape(encodeURIComponent(svg)));
    const image64 = 'data:image/svg+xml;base64,' + svg64;

    this.chartModalVisible = false;
    const el = document.querySelector('.page') as HTMLElement;
    if (el) el.focus();
    document.execCommand('insertImage', false, image64);
  }

  insertSymbol() {
    this.closeMenus();
    const sym = prompt('Enter a symbol or emoji to insert (e.g. ☺, ©, Ω):');
    if (sym) {
      const el = document.querySelector('.page') as HTMLElement;
      if (el) el.focus();
      document.execCommand('insertText', false, sym);
    }
  }

  onInput(editor: HTMLElement) {
    if (this.applyingRemote) return;
    this.autoPaginate();
    this.htmlContent = editor.innerHTML;
    this.updateOverlay();
    this.updatePageHeight();
    this.updateCounts();
    this.api.sendUpdate(JSON.stringify({ html: this.htmlContent }), this.title);
  }

  autoPaginate() {
    const pageEl = document.querySelector('.page') as HTMLElement;
    if (!pageEl || !this.showPrintLayout) return;
    
    // Auto-wrap raw text nodes that the browser creates to ensure we can measure them
    const childNodes = Array.from(pageEl.childNodes);
    for (const node of childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
        const div = document.createElement('div');
        node.parentNode?.insertBefore(div, node);
        div.appendChild(node);
      }
    }

    const children = Array.from(pageEl.children) as HTMLElement[];

    // Reset margins to recalculate natural flow
    children.forEach(child => {
      if (child.style.position !== 'absolute') child.style.marginTop = '0px';
    });

    let forceNextPage = false;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.style.position === 'absolute') continue;
      
      const childTop = child.offsetTop;
      const childHeight = child.offsetHeight;
      const childBottom = childTop + childHeight;
      
      const currentPage = Math.floor(childTop / 1080) + 1;
      const textBottomLimit = (currentPage - 1) * 1080 + 960;
      
      if (forceNextPage || childBottom > textBottomLimit) {
         const nextPageTextStart = currentPage * 1080 + 96;
         const pushAmount = nextPageTextStart - childTop;
         child.style.marginTop = Math.max(0, pushAmount) + 'px';
        forceNextPage = false;
      }

      // Detect manual page break either on the child itself or if it contains a break element
      const isBreak = child.style?.pageBreakAfter === 'always' ||
        child.classList?.contains('manual-page-break') ||
        (child.querySelector && child.querySelector('[style*="page-break-after: always"], .manual-page-break'));

      if (isBreak) {
        forceNextPage = true;
      }
    }
  }

  updatePageHeight() {
    if (!this.showPrintLayout) return;
    const el = document.querySelector('.page') as HTMLElement;
    if (el) {
      el.style.height = 'auto'; // Reset to measure natural content height
      const naturalHeight = el.scrollHeight;
      
      // Calculate exact number of pages needed 
      // Divide by 1080 because naturalHeight includes the 24px gaps injected by autoPaginate
      const pages = Math.max(1, Math.ceil(naturalHeight / 1080));
      
      // Snap container to exact boundaries including 24px gap between pages
      const exactHeight = (pages * 1056) + ((pages - 1) * 24);
      el.style.height = exactHeight + 'px';

      if (this.pageCountArray.length !== pages) {
        this.pageCountArray = new Array(pages).fill(0);
      }
    }
  }

  scrollToPage(index: number) {
    if (this.pageAreaRef && this.pageAreaRef.nativeElement) {
      // Each page is 1056px + 24px gap. 
      // The ruler and padding at the top of the scroll area might add offset, but scrolling exactly to page boundaries:
      const yOffset = index * (1056 + 24);
      this.pageAreaRef.nativeElement.scrollTo({ top: yOffset, behavior: 'smooth' });
    }
  }

  deletePage(index: number, event: Event) {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to delete Page ${index + 1}?`)) return;

    const pageEl = document.querySelector('.page') as HTMLElement;
    if (!pageEl) return;

    const pageTopY = index * 1080;
    const pageBottomY = (index + 1) * 1080;

    const children = Array.from(pageEl.children) as HTMLElement[];
    let elementsDeleted = false;
    let lastChildOnPrevPage: HTMLElement | null = null;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // If the child mathematically sits within this page's vertical coordinate block, remove it
      if (child.offsetTop >= pageTopY && child.offsetTop < pageBottomY) {
        if (!elementsDeleted && lastChildOnPrevPage) {
          const breakEls = lastChildOnPrevPage.classList.contains('manual-page-break')
            ? [lastChildOnPrevPage]
            : Array.from(lastChildOnPrevPage.querySelectorAll('.manual-page-break'));
          breakEls.forEach((el: any) => el.remove());
        }
        child.remove();
        elementsDeleted = true;
      } else if (child.offsetTop < pageTopY) {
        lastChildOnPrevPage = child;
      }
    }

    if (!elementsDeleted && lastChildOnPrevPage) {
      const breakEls = (lastChildOnPrevPage as any).classList.contains('manual-page-break')
        ? [lastChildOnPrevPage]
        : Array.from((lastChildOnPrevPage as any).querySelectorAll('.manual-page-break'));
      if (breakEls.length > 0) {
        breakEls.forEach((el: any) => (el as HTMLElement).remove());
        elementsDeleted = true;
      }
    }

    if (elementsDeleted) {
      this.save(); // Save will trigger autoPaginate() which recalculates all margins instantly
      this.updatePageHeight(); // Shrink the physical container and update sidebar thumbnails
      this.showToast(`Page ${index + 1} deleted.`);
    } else {
      this.updatePageHeight(); // Clean up any ghost pages
      this.showToast('Page is already empty.');
    }
  }

  @HostListener('window:resize') 
  onWindowResize() { this.updateOverlay(); }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.save();
      return;
    }

    if (this.selectedImage && (e.key === 'Backspace' || e.key === 'Delete')) {
      this.selectedImage.remove();
      this.selectedImage = null;
      this.updateOverlay();
      this.save();
      e.preventDefault();
      e.stopPropagation();
    }
  }

  onPageMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    
    // If we click a resize handle, do not reset the selected image
    if (target.classList.contains('resize-handle')) {
      return; 
    }

    if (target.tagName === 'IMG') {
      e.preventDefault(); // Prevent native drag-and-drop ghosting
      this.selectedImage = target as HTMLImageElement;
      
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNode(target);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // Convert to absolute positioning for free dragging if not already
      const pageEl = document.querySelector('.page') as HTMLElement;
      if (this.selectedImage.style.position !== 'absolute' && pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const imgRect = this.selectedImage.getBoundingClientRect();
        
        this.selectedImage.style.position = 'absolute';
        this.selectedImage.style.left = (imgRect.left - pageRect.left) + 'px';
        this.selectedImage.style.top = (imgRect.top - pageRect.top) + 'px';
        this.selectedImage.style.margin = '0';
      }
      
      this.updateOverlay();

      // Initiate custom free drag
      this.isDraggingImage = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.imgStartX = parseFloat(this.selectedImage.style.left || '0');
      this.imgStartY = parseFloat(this.selectedImage.style.top || '0');
    } else {
      if (this.selectedImage) {
        this.selectedImage = null;
        this.updateOverlay();
      }
    }
  }

  updateOverlay() {
    if (!this.selectedImage) return;
    const rect = this.selectedImage.getBoundingClientRect();
    this.overlayRect = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  }

  startResize(e: MouseEvent, corner: string) {
    e.preventDefault();
    e.stopPropagation();
    this.isResizing = true;
    this.resizeCorner = corner;
    this.startX = e.clientX;
    this.startW = this.selectedImage!.offsetWidth;
    this.imgStartX = parseFloat(this.selectedImage!.style.left || '0');
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.isResizing && this.selectedImage) {
      const dx = e.clientX - this.startX;
      let newW = this.startW;
      
      if (this.resizeCorner === 'br' || this.resizeCorner === 'tr') {
        newW = Math.max(50, this.startW + dx);
      } else {
        newW = Math.max(50, this.startW - dx);
      }

      this.selectedImage.style.width = newW + 'px';
      this.selectedImage.style.height = 'auto'; 
      this.updateOverlay();
    } else if (this.isDraggingImage && this.selectedImage) {
      let newLeft = this.imgStartX + (e.clientX - this.dragStartX);
      let newTop = this.imgStartY + (e.clientY - this.dragStartY);
      
      // Constrain to physical page boundaries
      const pageEl = document.querySelector('.page') as HTMLElement;
      if (pageEl) {
        const maxLeft = pageEl.offsetWidth - this.selectedImage.offsetWidth;
        const maxTop = pageEl.offsetHeight - this.selectedImage.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
      }

      this.selectedImage.style.left = newLeft + 'px';
      this.selectedImage.style.top = newTop + 'px';
      this.updateOverlay();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.isResizing || this.isDraggingImage) {
      this.isResizing = false;
      this.isDraggingImage = false;
      this.save();
    }
  }

  save() {
    this.isSaving = true;
    this.autoPaginate();
    const el = document.querySelector('.page') as HTMLElement;
    if (el) {
      this.htmlContent = el.innerHTML;
      if (!this.htmlContent.trim() || this.htmlContent.trim() === '<div><br></div>') {
         this.htmlContent = '<div><br></div>';
         el.innerHTML = this.htmlContent;
      }
    }
    this.api.saveDocument(this.docId, this.title, JSON.stringify({ html: this.htmlContent })).subscribe(() => {
      this.isSaving = false;
      this.lastSavedTime = new Date();
    });
  }

  onShareSearch() {
    if (this.shareQuery.trim().length < 2) {
      this.userSearchResults = [];
      return;
    }
    this.api.searchUsers(this.shareQuery).subscribe(users => {
      this.userSearchResults = users.filter((u: any) => u.id !== this.auth.user?.id);
    });
  }

  selectShareUser(user: any) {
    this.shareQuery = user.email;
    this.userSearchResults = [];
  }

  performShare() {
    if (!this.shareQuery) return;
    this.api.shareDocument(this.docId, this.shareQuery, this.shareRole.toLowerCase()).subscribe({
      next: () => {
        this.showToast(`Shared with ${this.shareQuery}`);
        this.shareQuery = '';
    this.shareModalOpen = false;
      },
      error: () => this.showToast('Failed to share: User not found.')
    });
  }

  makePublic() {
    this.isPublic = true;
    this.copyLink();
  }

  copyLink() {
    this.closeMenus();
    this.shareModalOpen = false;
    navigator.clipboard.writeText(window.location.href)
      .then(() => this.showToast('Link copied! Anyone with the link can collaborate.'));
  }

  exportFile(format: string) {
    this.save();
    this.api.exportDocument(this.docId, format).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${this.title}.${format}`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  checkSpelling() {
    this.closeMenus();
    this.showToast('Browser spellcheck is active. Right-click underlined words for suggestions.');
  }

  openDictionary() {
    this.closeMenus();
    const selection = window.getSelection();
    this.dictWord = selection ? selection.toString().trim() : '';
    this.dictModalOpen = true;
    this.dictResults = [];
    this.dictError = '';
    if (this.dictWord) {
      this.searchDictionary();
    }
  }

  searchDictionary() {
    if (!this.dictWord.trim()) return;
    this.dictLoading = true;
    this.dictError = '';
    this.dictResults = [];
    
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(this.dictWord.trim())}`)
      .then(res => {
        if (!res.ok) throw new Error('Word not found');
        return res.json();
      })
      .then(data => {
        this.dictResults = data;
        this.dictLoading = false;
      })
      .catch(err => {
        this.dictError = 'Definition not found.';
        this.dictLoading = false;
      });
  }

  showToast(msg: string) {
    this.toastMsg = msg; this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 2500);
  }

  back() { this.save(); this.router.navigate(['/']); }

  zoomIn() {
    if (this.zoomLevel < 200) {
      this.zoomLevel += 10;
      const page = document.querySelector('.page') as HTMLElement;
      if (page) page.style.transform = `scale(${this.zoomLevel / 100})`;
    }
  }

  zoomOut() {
    if (this.zoomLevel > 50) {
      this.zoomLevel -= 10;
      const page = document.querySelector('.page') as HTMLElement;
      if (page) page.style.transform = `scale(${this.zoomLevel / 100})`;
    }
  }

  updateCounts() {
    const el = document.querySelector('.page') as HTMLElement;
    if (el) {
      const text = el.innerText || '';
      this.charCount = text.length;
      this.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    }
  }

  ngOnDestroy() {
    document.removeEventListener('selectionchange', this.onSelectionChange.bind(this));
    this.syncSub?.unsubscribe();
    this.api.disconnectSync();
  }
}