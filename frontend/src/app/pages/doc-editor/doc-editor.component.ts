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
      <div class="top-bar">
        <div class="top-left">
          <button class="back" (click)="back()" title="Back to Dashboard">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div class="doc-meta">
            <input class="title-input" [(ngModel)]="title" (blur)="save()" placeholder="Untitled document" />
            <div class="menu-bar" (mousedown)="$event.preventDefault()">
              <div class="menu-item" (click)="toggleMenu('file', $event)" [class.active]="activeMenu === 'file'">
                File
                <div class="dropdown" *ngIf="activeMenu === 'file'">
                  <div class="dd-item" (click)="newDoc()"><span class="dd-text">New</span></div>
                  <div class="dd-item" (click)="docInput.click(); closeMenus()"><span class="dd-text">Open</span><span class="dd-hint">Ctrl+O</span></div>
                  <div class="dd-item" (click)="makeCopy()"><span class="dd-text">Make a copy</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="shareModalOpen = true; closeMenus()"><span class="dd-text">Share</span></div>
                  <div class="dd-item" (click)="emailDoc()"><span class="dd-text">Email</span></div>
                  <div class="dd-item" (click)="exportFile('docx')"><span class="dd-text">Download (.docx)</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="renameDoc()"><span class="dd-text">Rename</span></div>
                  <div class="dd-item" (click)="trashDoc()"><span class="dd-text">Move to trash</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="showVersionHistory()"><span class="dd-text">Version history</span></div>
                  <div class="dd-item" (click)="makeOffline()"><span class="dd-text">Make available offline</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="showDetails()"><span class="dd-text">Details</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('edit', $event)" [class.active]="activeMenu === 'edit'">
                Edit
                <div class="dropdown" *ngIf="activeMenu === 'edit'">
                  <div class="dd-item" (click)="exec('undo')"><span class="dd-text">Undo</span><span class="dd-hint">Ctrl+Z</span></div>
                  <div class="dd-item" (click)="exec('redo')"><span class="dd-text">Redo</span><span class="dd-hint">Ctrl+Y</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="showToast('Use Ctrl+X to cut')"><span class="dd-text">Cut</span><span class="dd-hint">Ctrl+X</span></div>
                  <div class="dd-item" (click)="showToast('Use Ctrl+C to copy')"><span class="dd-text">Copy</span><span class="dd-hint">Ctrl+C</span></div>
                  <div class="dd-item" (click)="showToast('Use Ctrl+V to paste')"><span class="dd-text">Paste</span><span class="dd-hint">Ctrl+V</span></div>
                  <div class="dd-item" (click)="showToast('Use Ctrl+Shift+V')"><span class="dd-text">Paste without formatting</span><span class="dd-hint">Ctrl+Shift+V</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="exec('selectAll')"><span class="dd-text">Select all</span><span class="dd-hint">Ctrl+A</span></div>
                  <div class="dd-item" (click)="exec('delete')"><span class="dd-text">Delete</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="openFind()"><span class="dd-text">Find</span><span class="dd-hint">Ctrl+F</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('view', $event)" [class.active]="activeMenu === 'view'">
                View
                <div class="dropdown" *ngIf="activeMenu === 'view'">
                  <div class="dd-item" (click)="toggleViewMode()"><span class="dd-text">Mode: {{ viewMode }}</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="togglePrintLayout()"><span class="dd-text">{{ showPrintLayout ? '✓ ' : '' }}Show print layout</span></div>
                  <div class="dd-item" (click)="toggleRuler()"><span class="dd-text">{{ showRuler ? '✓ ' : '' }}Show ruler</span></div>
                  <div class="dd-item" (click)="toggleEquationToolbar()"><span class="dd-text">{{ showEquationToolbar ? '✓ ' : '' }}Show equation toolbar</span></div>
                  <div class="dd-item" (click)="toggleNonPrinting()"><span class="dd-text">{{ showNonPrinting ? '✓ ' : '' }}Show non-printing characters</span><span class="dd-hint">Ctrl+Shift+P</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="toggleFullScreen()"><span class="dd-text">Full screen</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('insert', $event)" [class.active]="activeMenu === 'insert'">
                Insert
                <div class="dropdown" *ngIf="activeMenu === 'insert'">
                  <div class="dd-item" (click)="imageInput.click(); closeMenus()"><span class="dd-text">Image</span></div>
                  <div class="dd-item" (click)="insertTable()"><span class="dd-text">Table</span></div>
                  <div class="dd-item" (click)="insertBuildingBlock()"><span class="dd-text">Building blocks</span></div>
                  <div class="dd-item" (click)="insertSmartChip()"><span class="dd-text">Smart chips</span></div>
                  <div class="dd-item" (click)="insertSignature()"><span class="dd-text">eSignature</span><span class="dd-premium">Premium</span></div>
                  <div class="dd-item" (click)="insertLink()"><span class="dd-text">Link</span><span class="dd-hint">Ctrl+K</span></div>
                  <div class="dd-item" (click)="insertDrawing()"><span class="dd-text">Drawing</span></div>
                  <div class="dd-item" (click)="insertChart()"><span class="dd-text">Chart</span></div>
                  <div class="dd-item" (click)="insertSymbol()"><span class="dd-text">Symbols</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="insertHTML('&emsp;&emsp;')"><span class="dd-text">Tab</span><span class="dd-hint">Shift+F11</span></div>
                  <div class="dd-item" (click)="exec('insertHorizontalRule')"><span class="dd-text">Horizontal line</span></div>
                  <div class="dd-item" (click)="insertBreak()"><span class="dd-text">Break</span></div>
                  <div class="dd-item" (click)="insertHTML('🔖')"><span class="dd-text">Bookmark</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('format', $event)" [class.active]="activeMenu === 'format'">
                Format
                <div class="dropdown" *ngIf="activeMenu === 'format'">
                  <div class="dd-item" (click)="exec('bold')"><span class="dd-text">Bold</span><span class="dd-hint">Ctrl+B</span></div>
                  <div class="dd-item" (click)="exec('italic')"><span class="dd-text">Italic</span><span class="dd-hint">Ctrl+I</span></div>
                  <div class="dd-item" (click)="exec('underline')"><span class="dd-text">Underline</span><span class="dd-hint">Ctrl+U</span></div>
                  <div class="dd-item" (click)="exec('strikeThrough')"><span class="dd-text">Strikethrough</span><span class="dd-hint">Alt+Shift+5</span></div>
                  <div class="dd-sep"></div>
                  <div class="dd-item" (click)="exec('justifyLeft')"><span class="dd-text">Align left</span><span class="dd-hint">Ctrl+Shift+L</span></div>
                  <div class="dd-item" (click)="exec('justifyCenter')"><span class="dd-text">Align center</span><span class="dd-hint">Ctrl+Shift+E</span></div>
                  <div class="dd-item" (click)="exec('justifyRight')"><span class="dd-text">Align right</span><span class="dd-hint">Ctrl+Shift+R</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('tools', $event)" [class.active]="activeMenu === 'tools'">
                Tools
                <div class="dropdown" *ngIf="activeMenu === 'tools'">
                  <div class="dd-item" (click)="checkSpelling()"><span class="dd-text">Spelling and grammar</span></div>
                  <div class="dd-item" (click)="showWordCount()"><span class="dd-text">Word count</span><span class="dd-hint">Ctrl+Shift+C</span></div>
                  <div class="dd-item" (click)="openDictionary()"><span class="dd-text">Dictionary</span><span class="dd-hint">Ctrl+Shift+Y</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('extensions', $event)" [class.active]="activeMenu === 'extensions'">
                Extensions
                <div class="dropdown" *ngIf="activeMenu === 'extensions'">
                  <div class="dd-item" (click)="showToast('No extensions installed')"><span class="dd-text">Add-ons</span></div>
                </div>
              </div>
              <div class="menu-item" (click)="toggleMenu('help', $event)" [class.active]="activeMenu === 'help'">
                Help
                <div class="dropdown" *ngIf="activeMenu === 'help'">
                  <div class="dd-item" (click)="showToast('Coming soon')"><span class="dd-text">Docs Help</span></div>
                  <div class="dd-item" (click)="showToast('Coming soon')"><span class="dd-text">Keyboard shortcuts</span><span class="dd-hint">Ctrl+/</span></div>
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
            <button class="btn outline" (click)="shareModalOpen = true; closeMenus()">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm" style="margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
              Share
            </button>
          </div>
          <div class="avatar" [title]="auth.user?.name ?? ''">{{ initials }}</div>
        </div>
      </div>

      <div class="fmt-bar" (mousedown)="$event.preventDefault()">
        <button class="fb" (click)="exec('undo')" title="Undo">↩</button>
        <button class="fb" (click)="exec('redo')" title="Redo">↪</button>
        <button class="fb" (click)="printDoc()" title="Print">🖨️</button>
        <span class="sep"></span>
        <button class="fb" (click)="exec('bold')" title="Bold"><b>B</b></button>
        <button class="fb" (click)="exec('italic')" title="Italic"><i>I</i></button>
        <button class="fb" (click)="exec('underline')" title="Underline"><u>U</u></button>
        <span class="sep"></span>
        <button class="fb" (click)="exec('justifyLeft')" title="Left">⬅</button>
        <button class="fb" (click)="exec('justifyCenter')" title="Center">↔</button>
        <button class="fb" (click)="exec('justifyRight')" title="Right">➡</button>
        <span class="sep"></span>
        <button class="fb" (click)="exec('insertUnorderedList')" title="Bullet List">•</button>
        <button class="fb" (click)="exec('insertOrderedList')" title="Numbered List">1.</button>
        <span class="sep"></span>

        <div class="menu-item style-dropdown" (click)="toggleMenu('style', $event)" [class.active]="activeMenu === 'style'" title="Styles">
          {{ activeBlockStyle }} <span class="arrow">▼</span>
          <div class="dropdown" *ngIf="activeMenu === 'style'" style="min-width: 160px;">
            <div class="dd-item" (click)="changeStyle('p', 'Normal text')"><span class="dd-text" style="font-size: 14px;">Normal text</span></div>
            <div class="dd-item" (click)="changeStyle('h1', 'Title')"><span class="dd-text" style="font-size: 24px; font-weight: bold;">Title</span></div>
            <div class="dd-item" (click)="changeStyle('h2', 'Subtitle')"><span class="dd-text" style="font-size: 18px; color: #5f6368;">Subtitle</span></div>
            <div class="dd-item" (click)="changeStyle('h3', 'Heading 1')"><span class="dd-text" style="font-size: 20px;">Heading 1</span></div>
            <div class="dd-item" (click)="changeStyle('h4', 'Heading 2')"><span class="dd-text" style="font-size: 16px;">Heading 2</span></div>
            <div class="dd-item" (click)="changeStyle('h5', 'Heading 3')"><span class="dd-text" style="font-size: 14px; font-weight: bold;">Heading 3</span></div>
          </div>
        </div>
        
        <span class="sep"></span>

        <div class="menu-item font-dropdown" (click)="toggleMenu('font', $event)" [class.active]="activeMenu === 'font'" title="Font">
          <span [style.font-family]="activeFontFamily">{{ activeFontFamily }}</span> <span class="arrow">▼</span>
          <div class="dropdown" *ngIf="activeMenu === 'font'" style="min-width: 160px; max-height: 300px; overflow-y: auto;">
            <div class="dd-item" *ngFor="let font of fonts" (click)="changeFont(font)">
              <span class="dd-text" [style.font-family]="font">{{ font }}</span>
            </div>
          </div>
        </div>

        <span class="sep"></span>

        <div class="font-size-control">
          <button class="fb size-btn" (click)="decrementFontSize()" title="Decrease font size">−</button>
          <input class="size-input" [(ngModel)]="activeFontSize" (change)="onFontSizeInputChange()" />
          <button class="fb size-btn" (click)="incrementFontSize()" title="Increase font size">+</button>
        </div>

        <span class="sep"></span>
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
              <button class="delete-page-btn" (click)="deletePage(i, $event)" title="Delete Page">×</button>
            </div>
            <div class="thumb-label">{{ i + 1 }}</div>
          </div>
        </div>
        <div class="page-area" #pageArea [class.no-print]="!showPrintLayout" (scroll)="updateOverlay()" (mousedown)="onPageMouseDown($event)">
          <div style="display:flex; flex-direction: column; align-items: center;">
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
          <h3 style="margin-top: 0; color: #202124;">Share this document</h3>
          <p style="color: #5f6368; font-size: 14px; margin-bottom: 24px;">Choose a platform to share the link with collaborators:</p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
             <button class="btn" style="background: #25d366; color: #fff;" (click)="shareTo('whatsapp')">WhatsApp</button>
             <button class="btn" style="background: #ea4335; color: #fff;" (click)="shareTo('email')">Email</button>
             <button class="btn outline" (click)="copyLink()">Copy Link</button>
          </div>
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e8eaed;">
            <div style="font-size: 12px; color: #5f6368; margin-bottom: 8px;">Or share this link directly:</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="text" [value]="currentUrl" readonly style="flex:1; padding: 8px 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 12px; color: #5f6368; background: #f8f9fa; outline: none;">
              <button class="btn" (click)="copyLink()" style="white-space: nowrap; font-size: 13px;">Copy</button>
            </div>
          </div>
          <button (click)="shareModalOpen = false" style="position: absolute; top: 12px; right: 16px; background: none; border: none; font-size: 20px; cursor: pointer; color: #5f6368; line-height: 1;">×</button>
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
    .bottom-chat-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: #f8f9fa; border-top: 1px solid #e0e0e0; z-index: 9999; height: 36px; box-shadow: 0 -1px 3px rgba(0,0,0,0.05); }
    .bcb-item { display: flex; align-items: center; gap: 8px; padding: 0 16px; cursor: pointer; border-right: 1px solid #e0e0e0; font-size: 13px; font-weight: 500; color: #202124; transition: background 0.2s; position: relative; }
    .bcb-item:hover { background: #e8f0fe; }
    .bcb-item .material-symbols-outlined { font-size: 18px; }
    .bcb-badge { position: absolute; top: -6px; left: 16px; background: #d32f2f; color: #fff; font-size: 10px; font-weight: bold; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }

    /* Widgets */
    .widget-panel { position: fixed; bottom: 48px; right: 24px; width: 300px; background: #fff; border-radius: 8px; border: 1px solid #e0e0e0; z-index: 10000; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .wp-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e0e0e0; font-weight: 500; color: #202124; background: #f8f9fa; }
    .wp-body { padding: 16px; flex: 1; min-height: 200px; display: flex; flex-direction: column; }

    .shell { display: flex; flex-direction: column; height: calc(100vh - 36px); background: #f9fbfd; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    
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
      position: absolute; top: 100%; left: 0; min-width: 320px;
      background: #fff; border: 1px solid #dadce0; border-radius: 4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15); padding: 6px 0;
      z-index: 100; display: flex; flex-direction: column;
    }
    .dd-item { 
      padding: 6px 24px 6px 36px; font-size: 14px; color: #202124; cursor: pointer;
      display: flex; justify-content: space-between; align-items: center;
    }
    .dd-item:hover { background: #f1f3f4; }
    .dd-text { flex: 1; }
    .dd-hint { color: #5f6368; font-size: 12px; margin-left: 16px; }
    .dd-premium { background: #1a73e8; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 12px; font-weight: 600; margin-left: 16px; }
    .dd-sep { height: 1px; background: #e8eaed; margin: 6px 0; }

    .top-right { display: flex; align-items: center; gap: 12px; }
    .badge { font-size: 12px; background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 12px; font-weight: 600; display: flex; align-items: center; white-space: nowrap; }
    .btn { padding: 8px 16px; background: #c2e7ff; color: #001d35; border: none; border-radius: 24px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; }
    .btn.outline { background: #c2e7ff; color: #001d35; }
    .btn:hover { background: #b3d4ec; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%; background: #1a73e8;
      color: #fff; font-size: 14px; font-weight: 500; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; cursor: default;
    }

    .fmt-bar {
      display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
      padding: 6px 16px; background: #edf2fa; border-radius: 24px; margin: 0 16px;
      position: relative; z-index: 200;
    }
    .fb { min-width: 32px; height: 32px; padding: 0 8px; background: none; border: 1px solid transparent; border-radius: 4px; cursor: pointer; font-size: 14px; color: #444746; display: flex; align-items: center; justify-content: center;}
    .fb:hover { background: #e0e6ed; }
    .fsel { height: 32px; border: 1px solid transparent; border-radius: 4px; font-size: 14px; padding: 0 8px; cursor: pointer; background: transparent; color: #444746; outline: none; }
    .fsel:hover { background: #e0e6ed; }
    .sep { width: 1px; height: 20px; background: #c7c7c7; margin: 0 6px; }

    .arrow { font-size: 10px; margin-left: 4px; color: #5f6368; }
    .style-dropdown { min-width: 100px; display: flex; justify-content: space-between; align-items: center; }
    .font-dropdown { min-width: 130px; display: flex; justify-content: space-between; align-items: center; }
    .font-size-control { display: flex; align-items: center; background: #fff; border: 1px solid #dadce0; border-radius: 4px; height: 30px; overflow: hidden; }
    .font-size-control .size-btn { width: 26px; height: 30px; border-radius: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #444746; background: transparent; border: none; cursor: pointer; }
    .font-size-control .size-btn:hover { background: #e0e6ed; }
    .font-size-control .size-input { width: 32px; height: 100%; text-align: center; border: none; border-left: 1px solid #dadce0; border-right: 1px solid #dadce0; font-size: 14px; outline: none; padding: 0; color: #202124; background: #fff; }

    .doc-editor { display: flex; flex-direction: column; height: 100vh; background: #f9fbfd; }
    
    .editor-layout { display: flex; flex: 1; overflow: hidden; background: #f9fbfd; }
    .sidebar { width: 140px; background: #f8f9fa; border-right: 1px solid #dadce0; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; align-items: center; gap: 16px; }
    .thumbnail { display: flex; flex-direction: column; align-items: center; cursor: pointer; opacity: 0.8; position: relative; }
    .thumbnail:hover { opacity: 1; }
    .thumb-page { width: 90px; height: 116px; background: #fff; border: 1px solid #dadce0; margin-bottom: 6px; box-shadow: 0 1px 2px rgba(60,64,67,.1); position: relative; }
    .thumbnail:hover .thumb-page { border-color: #1a73e8; }
    .delete-page-btn {
      position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%;
      background: #ea4335; color: white; border: none; font-size: 14px; line-height: 14px;
      font-weight: bold; cursor: pointer; display: none; align-items: center; justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3); padding: 0;
    }
    .thumbnail:hover .delete-page-btn { display: flex; }
    .thumb-label { font-size: 11px; color: #5f6368; font-weight: 500; }

    .page-area { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; justify-content: center; background: #f9fbfd; scroll-behavior: smooth; }
    
    .page-bg-layer { position: absolute; top: 0; left: 0; width: 100%; z-index: 0; pointer-events: none; display: flex; flex-direction: column; gap: 24px; }
    .page-bg { width: 816px; height: 1056px; background: #fff; box-shadow: 0 1px 3px 1px rgba(60,64,67,.15); border-radius: 2px; }

    .page {
      width: 816px; min-height: 1056px; 
      background-color: transparent; 
      box-shadow: none;
      padding: 96px; border-radius: 2px; outline: none; font-size: 11pt;
      line-height: 1.5; color: #000; font-family: Arial, sans-serif;
      position: relative; z-index: 1; box-sizing: border-box;
    }
    .page-area.no-print .page { padding: 20px 0; box-shadow: none; background-color: transparent; }
    .page-area.no-print .page-bg-layer { display: none; }
    .ruler { height: 16px; background: url('https://upload.wikimedia.org/wikipedia/commons/7/7b/Ruler_15_cm.png') repeat-x; opacity: 0.3; margin-bottom: 8px; width: 816px; }
    .equation-bar { padding: 4px 16px; background: #f1f3f4; display: flex; gap: 8px; border-top: 1px solid #e8eaed; font-family: math; justify-content: center; }
    .page.show-np p::after, .page.show-np div::after { content: '¶'; color: #9aa0a6; padding-left: 4px; font-weight: normal; }
    
    :host ::ng-deep .page img { max-width: 100%; height: auto; display: inline-block; cursor: pointer; }
    
    .resize-overlay {
      position: fixed; border: 2px solid #1a73e8; pointer-events: none; z-index: 100; box-sizing: border-box;
    }
    .resize-handle {
      position: absolute; width: 16px; height: 16px; background: #1a73e8;
      border: 2px solid #fff; pointer-events: auto; box-sizing: border-box;
      border-radius: 2px;
    }
    .resize-handle.tl { top: -8px; left: -8px; cursor: nwse-resize; }
    .resize-handle.tr { top: -8px; right: -8px; cursor: nesw-resize; }
    .resize-handle.bl { bottom: -8px; left: -8px; cursor: nesw-resize; }
    .resize-handle.br { bottom: -8px; right: -8px; cursor: nwse-resize; }

    .page:empty::before { content: ''; }
    
    .toast {
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: #323232; color: #f1f3f4; padding: 12px 24px; border-radius: 4px;
      font-size: 14px; opacity: 0; transition: all .25s; pointer-events: none;
      z-index: 1000;
    }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center;
    }
    .modal { background: white; padding: 24px; border-radius: 8px; width: 460px; max-width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.2); position: relative; }
    .share-modal { text-align: left; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
    .form-control { width: 100%; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
    .form-control:focus { outline: none; border-color: #1a73e8; }
    .find-dialog { position: absolute; top: 70px; right: 24px; background: #fff; padding: 12px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; gap: 8px; z-index: 300; }
    .find-dialog input {
      border: 1px solid #dadce0; border-radius: 4px; padding: 6px 12px; font-size: 14px;
      outline: none; width: 200px;
    }
    .find-dialog input:focus { border-color: #1a73e8; }

    /* ===== PRINT STYLES ===== */
    @media print {
      .top-bar, .fmt-bar, .equation-bar, .sidebar, .find-dialog,
      .modal-overlay, .toast, .resize-overlay { display: none !important; }
      .shell { display: block !important; }
      .editor-layout { display: block !important; overflow: visible !important; }
      .page-area { padding: 0 !important; overflow: visible !important; display: block !important; }
      .page { width: 100% !important; min-height: auto !important; box-shadow: none !important;
              padding: 15mm 20mm !important; margin: 0 !important; }
      .page-bg-layer { display: none !important; }
    }
  `]
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
  get currentUrl(): string { return window.location.href; }
  
  viewMode: 'Editing' | 'Viewing' = 'Editing';
  showPrintLayout = true;
  showRuler = false;
  showEquationToolbar = false;
  showNonPrinting = false;

  shareModalOpen = false;
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
  ) {}

  ngOnInit() {
    this.docId = this.route.snapshot.paramMap.get('id') ?? '';
    document.execCommand('defaultParagraphSeparator', false, 'div');
    
    this.api.getDocument(this.docId).subscribe((doc: any) => {
      this.title = doc.title;
      try { 
        const p = JSON.parse(doc.content || '{}'); 
        this.htmlContent = p.html ?? '<div><br></div>'; 
        const el = document.querySelector('.page') as HTMLElement;
        if (el) {
          el.innerHTML = this.htmlContent;
          try { document.execCommand('enableObjectResizing', false, 'false'); } catch (e) {}
          setTimeout(() => {
             this.autoPaginate();
             this.updatePageHeight();
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
              try { document.execCommand('enableObjectResizing', false, 'false'); } catch (e) {}
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

  toggleMenu(menu: string, event: Event) {
    event.stopPropagation();
    this.activeMenu = this.activeMenu === menu ? null : menu;
  }

  closeMenus(event?: Event) {
    this.activeMenu = null;
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
      try { document.execCommand('enableObjectResizing', false, 'false'); } catch (e) {}
    }
    document.execCommand(cmd, false); 
    setTimeout(() => {
      this.updateOverlay();
      this.updatePageHeight();
      this.save();
    }, 10);
  }

  execVal(cmd: string, e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (val) document.execCommand(cmd, false, val);
    (e.target as HTMLSelectElement).value = '';
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
    if (el) el.focus();
    document.execCommand('fontSize', false, '7'); 
    const fontEls = document.querySelectorAll('font[size="7"]');
    fontEls.forEach(f => {
      (f as HTMLElement).removeAttribute('size');
      (f as HTMLElement).style.fontSize = val;
    });
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
    if (el) el.focus();
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
    this.insertHTML('<br><br><div style="page-break-after: always; height: 1px; border-bottom: 2px dashed #ccc; margin: 20px 0;"></div><br>');
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
    svg += `<text x="${width/2}" y="30" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle" fill="#202124">${this.chartTitle}</text>`;
    
    vals.forEach((v, i) => {
      const h = (v / max) * (height - 80);
      const x = 20 + i * barWidth + 10;
      const y = height - 30 - h;
      const color = colors[i % colors.length];
      svg += `<rect x="${x}" y="${y}" width="${barWidth - 20}" height="${h}" fill="${color}" rx="2" />`;
      svg += `<text x="${x + (barWidth-20)/2}" y="${y - 8}" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="#5f6368">${v}</text>`;
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

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.style.position === 'absolute') continue;
      
      const childTop = child.offsetTop;
      const childHeight = child.offsetHeight;
      const childBottom = childTop + childHeight;
      
      const currentPage = Math.floor(childTop / 1080) + 1;
      const textBottomLimit = (currentPage - 1) * 1080 + 960;
      
      if (childBottom > textBottomLimit) {
         const nextPageTextStart = currentPage * 1080 + 96;
         const pushAmount = nextPageTextStart - childTop;
         child.style.marginTop = Math.max(0, pushAmount) + 'px';
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

    children.forEach(child => {
      // If the child mathematically sits within this page's vertical coordinate block, remove it
      if (child.offsetTop >= pageTopY && child.offsetTop < pageBottomY) {
        child.remove();
        elementsDeleted = true;
      }
    });

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
    this.autoPaginate();
    const el = document.querySelector('.page') as HTMLElement;
    if (el) {
      this.htmlContent = el.innerHTML;
      if (!this.htmlContent.trim() || this.htmlContent.trim() === '<div><br></div>') {
         this.htmlContent = '<div><br></div>';
         el.innerHTML = this.htmlContent;
      }
    }
    this.api.saveDocument(this.docId, this.title, JSON.stringify({ html: this.htmlContent })).subscribe();
  }

  shareTo(platform: string) {
    this.closeMenus();
    this.shareModalOpen = false;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this document: ${this.title}\n\n`);
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${text}${url}`, '_blank');
    } else if (platform === 'email') {
      this.emailDoc();
    }
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
  ngOnDestroy() { this.syncSub?.unsubscribe(); this.api.disconnectSync(); }
}