import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { BulkForwardService } from '../../core/services/bulk-forward.service';

interface ConversationItem {
  conversation_id: number;
  other_user: {
    id: number;
    name: string;
    email: string;
    avatar_color: string;
    avatar_url: string | null;
    last_login?: string | null;
  };
  last_message: string | null;
  last_time: string | null;
  unread: number;
}

interface ChatMsg {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar_color: string;
  sender_avatar_url: string | null;
  message: string;
  is_mine: boolean;
  is_file?: boolean;
  file_path?: string;
  created_at: string;
  is_edited?: boolean;
  updated_at?: string;
  delete_status?: boolean;
  is_read?: boolean;
  reactions?: any;
  uploading?: boolean;
  progress?: number;
  loaded_mb?: number;
  total_mb?: number;
  uploadSub?: any;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>

<div class="chat-shell" [class.dark]="isDark">
  <!-- SIDEBAR -->
  <aside class="chat-sidebar">
    <div class="chat-sidebar-header">
      <h3>Chats</h3>
      <div class="sidebar-actions">
        <button class="icon-action" title="New chat" (click)="newChatModal = true; loadAllUsers()">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="icon-action" title="Minimize" (click)="goBack()">
          <span class="material-symbols-outlined">remove</span>
        </button>
      </div>
    </div>
    <div class="chat-search-wrap">
      <span class="material-symbols-outlined cs-icon">search</span>
      <input class="chat-search" [(ngModel)]="chatSearch" placeholder="Search conversations..."/>
    </div>
    <div class="section-label">Recent Chats</div>
    <div class="chat-list">
      <!-- Pinned Saved Messages (You) -->
      <div class="chat-item" *ngIf="currentUser && (!chatSearch || 'saved messages (you)'.includes(chatSearch.toLowerCase()))"
        [class.active]="activeConv?.other_user?.id === currentUser?.id"
        (click)="openOrCreateChat(currentUser.id)"
        style="border-left: 3px solid #10b981;">
        <div class="ci-avatar-wrap">
          <div class="ci-avatar" style="background:#10b981">ME</div>
          <span class="status-dot online"></span>
        </div>
        <div class="ci-info">
          <div class="ci-top">
            <span class="ci-name">Saved Messages (You)</span>
            <span class="ci-time">{{ getSavedMsgTime() }}</span>
          </div>
          <div class="ci-bottom">
            <span class="ci-last" style="color:#10b981;font-style:italic;">Personal Space</span>
          </div>
        </div>
      </div>
      <div class="chat-item" *ngFor="let c of filteredConversations"
        [class.active]="activeConv?.conversation_id === c.conversation_id"
        (click)="selectConversation(c)">
        <div class="ci-avatar-wrap">
          <img *ngIf="c.other_user.avatar_url" [src]="c.other_user.avatar_url" class="ci-avatar-img"/>
          <div *ngIf="!c.other_user.avatar_url" class="ci-avatar" [style.background]="c.other_user.avatar_color">
            {{ getInitials(c.other_user.name) }}
          </div>
          <span [class]="'status-dot ' + getStatusFromLastLogin(c.other_user.last_login)"></span>
        </div>
        <div class="ci-info">
          <div class="ci-top">
            <span class="ci-name">{{ c.other_user.name }}</span>
            <span class="ci-time">{{ formatMsgTime(c.last_time) }}</span>
          </div>
          <div class="ci-bottom">
            <span class="ci-last">{{ c.last_message || 'No messages yet' }}</span>
            <span class="ci-badge" *ngIf="c.unread > 0">{{ c.unread }}</span>
          </div>
        </div>
      </div>
      <div class="chat-empty-list" *ngIf="filteredConversations.length === 0 && !loading">
        <span class="material-symbols-outlined">chat_bubble_outline</span>
        <p>{{ chatSearch ? 'No results' : 'No conversations yet' }}</p>
        <button class="new-chat-btn-sm" (click)="newChatModal = true; loadAllUsers()">Start a chat</button>
      </div>
    </div>
  </aside>

  <!-- MAIN -->
  <section class="chat-main" *ngIf="activeConv; else noChat">
    <div class="chat-topbar">
      <div class="ct-left" (click)="toggleProfile()" style="cursor:pointer">
        <img *ngIf="activeConv.other_user.avatar_url" [src]="activeConv.other_user.avatar_url" class="ct-avatar-img" (click)="viewProfilePic($event, activeConv.other_user)"/>
        <div *ngIf="!activeConv.other_user.avatar_url" class="ct-avatar" [style.background]="activeConv.other_user.avatar_color">
          {{ getInitials(activeConv.other_user.name) }}
        </div>
        <div>
          <div class="ct-name">{{ activeConv.other_user.name }}</div>
          <div [class]="'ct-status ' + getStatusFromLastLogin(activeConv.other_user.last_login)">
            <span [class]="'status-dot-inline ' + getStatusFromLastLogin(activeConv.other_user.last_login)"></span>
            {{ getStatusFromLastLogin(activeConv.other_user.last_login) === 'online' ? 'Online' : 'Away' }}
          </div>
        </div>
      </div>
      <div class="ct-actions">
        <button class="ct-btn" title="Select Messages" (click)="toggleSelectionMode()">
          <span class="material-symbols-outlined">checklist</span>
        </button>
        <button class="ct-btn" title="Search in chat" (click)="toggleChatSearch()">
          <span class="material-symbols-outlined">search</span>
        </button>
        <button class="ct-btn" title="Voice call" (click)="startCall('voice')">
          <span class="material-symbols-outlined">call</span>
        </button>
        <button class="ct-btn" title="Video call" (click)="startCall('video')">
          <span class="material-symbols-outlined">videocam</span>
        </button>
        <button class="ct-btn" title="Compose email" (click)="composeEmail()">
          <span class="material-symbols-outlined">mail</span>
        </button>
        <button class="ct-btn" title="View profile" (click)="toggleProfile()">
          <span class="material-symbols-outlined">person</span>
        </button>
      </div>
    </div>

    <!-- SEARCH IN CHAT BAR -->
    <div class="chat-search-bar" *ngIf="chatMsgSearch !== null">
      <span class="material-symbols-outlined" style="font-size:18px;color:#94a3b8">search</span>
      <input [(ngModel)]="chatMsgSearch" placeholder="Search in conversation..." autofocus/>
      <span class="search-count" *ngIf="chatMsgSearch">{{ filteredMessages.length }} found</span>
      <button class="csb-close" (click)="chatMsgSearch = null"><span class="material-symbols-outlined" style="font-size:16px">close</span></button>
    </div>

    <div class="messages-area" #messagesArea>
      <ng-container *ngFor="let group of groupedMessages">
        <div class="day-divider"><span>{{ group.date }}</span></div>
        <div *ngFor="let msg of group.messages" class="msg-row" [class.mine]="msg.is_mine" [class.highlight]="chatMsgSearch && msg.message.toLowerCase().includes(chatMsgSearch.toLowerCase())">
          <!-- Deleted message placeholder -->
          <div *ngIf="msg.delete_status" style="display:flex;align-items:center;gap:8px;padding:8px 14px;opacity:0.6;width:100%;">
            <span class="material-symbols-outlined" style="font-size:16px;color:#94a3b8">block</span>
            <em style="color:#94a3b8;font-size:0.82em;">This message was deleted</em>
            <span style="margin-left:auto;font-size:0.7em;color:#94a3b8;">{{ formatMsgTime(msg.created_at) }}</span>
          </div>
          <ng-template #msgMeta let-msg="msg">
            <div class="msg-meta">
              <ng-container *ngIf="!msg.is_edited">{{ formatMsgTime(msg.created_at) }}</ng-container>
              <ng-container *ngIf="msg.is_edited">{{ formatMsgTime(msg.updated_at || msg.created_at) }} <span style="font-style:italic;opacity:0.7;margin-left:3px;font-size:0.9em;">Edited</span></ng-container>
              <ng-container *ngIf="msg.is_mine">
                <span class="material-symbols-outlined msg-tick" [class.read]="isMsgRead(msg)" [title]="isMsgRead(msg) ? 'Read' : 'Delivered'">{{ getMsgTickIcon(msg) }}</span>
              </ng-container>
            </div>
          </ng-template>
          <ng-container *ngIf="!msg.delete_status">
          <div class="msg-avatar" *ngIf="!msg.is_mine" [style.background]="msg.sender_avatar_color">
            {{ getInitials(msg.sender_name) }}
          </div>
          <div class="msg-bubble-wrap">
            <div style="display:flex; align-items:center; gap:8px;" [style.flex-direction]="msg.is_mine ? 'row-reverse' : 'row'">
            <input type="checkbox" *ngIf="selectionMode" [checked]="selectedMessages.has(msg.id)" (change)="toggleMessageSelection(msg)" class="msg-checkbox" />
            <div class="msg-bubble" [class.mine]="msg.is_mine" [class.is-uploading]="msg.uploading">
              <ng-container *ngIf="msg.uploading">
                <div style="display:flex; align-items:center; gap:12px; min-width: 200px; max-width:100%; overflow:hidden;">
                  <div style="position:relative; width:44px; height:44px; flex-shrink:0; background:rgba(255,255,255,0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;" (click)="$event.stopPropagation(); cancelUpload(msg)" title="Cancel Upload">
                    <svg viewBox="0 0 36 36" style="position:absolute; inset:0; width:44px; height:44px; transform:rotate(-90deg); pointer-events:none;">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="white" stroke-width="3" [attr.stroke-dasharray]="(msg.progress || 0) + ', 100'" />
                    </svg>
                    <span class="material-symbols-outlined" style="font-size:18px; color:white;">close</span>
                  </div>
                  <div style="display:flex; flex-direction:column; min-width:0; flex:1; overflow:hidden;">
                    <span style="word-break:break-all; white-space:normal; font-weight:600; font-size:13px; line-height:1.4;">{{ msg.message }}</span>
                    <span style="font-size:11px; opacity:0.8; margin-top:2px;">{{ msg.loaded_mb | number:'1.1-2' }} MB / {{ msg.total_mb | number:'1.1-2' }} MB</span>
                  </div>
                  <ng-container *ngTemplateOutlet="msgMeta; context:{msg:msg}"></ng-container>
                </div>
              </ng-container>
              <ng-container *ngIf="!msg.uploading && !msg.is_file">
                <!-- Inline edit mode -->
                <ng-container *ngIf="editingMessageId !== msg.id">
                  {{ msg.message }}
                </ng-container>
                <div *ngIf="editingMessageId === msg.id" style="display:flex;flex-direction:column;gap:6px;min-width:180px;">
                  <input [(ngModel)]="editText" (keydown.enter)="saveEdit(msg)" style="width:100%;padding:6px 10px;border:1px solid #e2e7ff;border-radius:8px;font-family:'Inter',sans-serif;font-size:0.85rem;outline:none;" />
                  <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button (click)="saveEdit(msg)" style="background:#4f46e5;color:white;border:none;border-radius:6px;padding:4px 12px;font-size:0.75rem;cursor:pointer;">Save</button>
                    <button (click)="editingMessageId=null" style="background:#f1f5f9;color:#475569;border:none;border-radius:6px;padding:4px 12px;font-size:0.75rem;cursor:pointer;">Cancel</button>
                  </div>
                </div>
                <ng-container *ngTemplateOutlet="msgMeta; context:{msg:msg}"></ng-container>
              </ng-container>
              <div *ngIf="msg.is_file && !msg.uploading" class="msg-file-attachment">
                <div class="mfa-preview" *ngIf="isImage(msg.file_path)">
                  <img [src]="getFileUrl(msg.file_path)" (click)="lightboxUrl = getFileUrl(msg.file_path)"/>
                </div>
                <div class="mfa-info">
                  <span class="material-symbols-outlined">description</span>
                  <span class="mfa-name">{{ msg.message }}</span>
                  <a [href]="getFileUrl(msg.file_path)" target="_blank" [download]="msg.message" class="mfa-download">
                    <span class="material-symbols-outlined">download</span>
                  </a>
                </div>
                <div style="padding: 0 4px 4px;">
                  <ng-container *ngTemplateOutlet="msgMeta; context:{msg:msg}"></ng-container>
                </div>
              </div>
              <!-- Message action buttons -->
              <div *ngIf="msg.is_mine && !msg.is_file && editingMessageId !== msg.id && !msg.uploading" class="msg-action-btns">
                <button (click)="startEdit(msg)" title="Edit" class="msg-action-btn"><span class="material-symbols-outlined" style="font-size:14px">edit</span></button>
                <button (click)="deleteMessage(msg)" title="Delete" class="msg-action-btn"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button>
              </div>
            </div>
            </div>
          </div>
          </ng-container>
        </div>
      </ng-container>
      <div class="typing-row" *ngIf="sending">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="smart-replies">
        <button class="smart-reply" (click)="useReply('Sounds good!')">Sounds good!</button>
        <button class="smart-reply" (click)="useReply('Got it, thanks!')">Got it, thanks!</button>
        <button class="smart-reply" (click)="useReply('Let me check and get back.')">Let me check and get back.</button>
      </div>
      <!-- EMOJI PICKER -->
      <div class="emoji-picker" *ngIf="emojiOpen">
        <div class="emoji-grid">
          <button *ngFor="let e of emojis" class="emoji-btn" (click)="insertEmoji(e)">{{ e }}</button>
        </div>
      </div>
      <div class="input-wrap">
        <input type="file" #chatFileInput style="display:none" (change)="onChatFileSelect($event)" multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip"/>
        <button class="input-icon-btn" title="Attach file" (click)="chatFileInput.click()">
          <span class="material-symbols-outlined">attach_file</span>
        </button>
        <button class="input-icon-btn" title="Send photo" (click)="chatFileInput.click()">
          <span class="material-symbols-outlined">image</span>
        </button>
        <button class="input-icon-btn" title="Emoji" (click)="emojiOpen = !emojiOpen">
          <span class="material-symbols-outlined">mood</span>
        </button>
        <textarea class="chat-textarea" [(ngModel)]="messageText"
          (keydown.enter)="onEnterSend($event)" placeholder="Write a message..." rows="1"></textarea>
        <button class="send-msg-btn" (click)="sendMessage()" [disabled]="!messageText.trim() && chatFiles.length === 0">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="attached-files" *ngIf="chatFiles.length > 0" [style.background]="isDark ? '#0f172a' : '#f8f9ff'">
        <div class="af-item" *ngFor="let f of chatFiles; let i = index">
          <span class="material-symbols-outlined">attach_file</span>
          <span class="af-name">{{ f.name }}</span>
          <button class="af-remove" (click)="removeChatFile(i)">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
    </div>
    
    <div class="selection-footer" *ngIf="selectionMode" style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; background:#f8fafc; border-top:1px solid #e2e8f0; z-index:100;">
      <span style="font-size:0.95rem;font-weight:600;color:#1e293b">{{ selectedMessages.size }} messages selected</span>
      <div style="display:flex;gap:12px;">
        <button style="padding:8px 20px; border:1px solid #cbd5e1; border-radius:8px; background:white; color:#475569; cursor:pointer; font-weight:500;" (click)="toggleSelectionMode()">Cancel</button>
        <button style="padding:8px 20px; border:none; border-radius:8px; background:#4f46e5; color:white; cursor:pointer; display:flex; align-items:center; gap:6px; font-weight:500;" [disabled]="selectedMessages.size === 0" (click)="forwardSelectedMessages()">
          <span class="material-symbols-outlined" style="font-size:18px;">forward</span> Forward
        </button>
      </div>
    </div>

  </section>

  <!-- PROFILE SIDEBAR -->
  <aside class="profile-sidebar" *ngIf="profileOpen && activeConv">
    <div class="ps-header">
      <h4>Profile</h4>
      <button class="ps-close" (click)="profileOpen=false"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="ps-body">
      <div class="ps-avatar-wrap" (click)="viewProfilePic($event, activeConv.other_user)">
        <img *ngIf="activeConv.other_user.avatar_url" [src]="activeConv.other_user.avatar_url" class="ps-avatar-img"/>
        <div *ngIf="!activeConv.other_user.avatar_url" class="ps-avatar" [style.background]="activeConv.other_user.avatar_color">
          {{ getInitials(activeConv.other_user.name) }}
        </div>
      </div>
      <div class="ps-name">{{ activeConv.other_user.name }}</div>
      <div class="ps-email">{{ activeConv.other_user.email }}</div>
      <div class="ps-status-row">
        <span [class]="'status-dot-inline ' + getStatusFromLastLogin(activeConv.other_user.last_login)"></span>
        {{ getStatusFromLastLogin(activeConv.other_user.last_login) === 'online' ? 'Online' : 'Away' }}
      </div>
      <div class="ps-actions">
        <button class="ps-action-btn" (click)="toggleMute()">
          <span class="material-symbols-outlined">{{ isMuted(activeConv.other_user.id) ? 'notifications_off' : 'notifications' }}</span>
          {{ isMuted(activeConv.other_user.id) ? 'Unmute' : 'Mute' }}
        </button>
        <button class="ps-action-btn" (click)="toggleBlock()">
          <span class="material-symbols-outlined">{{ isBlocked(activeConv.other_user.id) ? 'lock_open' : 'block' }}</span>
          {{ isBlocked(activeConv.other_user.id) ? 'Unblock' : 'Block' }}
        </button>
        <button class="ps-action-btn" (click)="composeEmail()">
          <span class="material-symbols-outlined">mail</span> Email
        </button>
      </div>
    </div>
  </aside>

  <ng-template #noChat>
    <section class="chat-empty">
      <span class="material-symbols-outlined empty-icon">chat_bubble_outline</span>
      <div class="empty-title">Select a conversation</div>
      <div class="empty-sub">Choose from your recent chats or start a new one</div>
      <button class="empty-new-btn" (click)="newChatModal = true; loadAllUsers()">
        <span class="material-symbols-outlined" style="font-size:16px">edit</span> New Chat
      </button>
    </section>
  </ng-template>
</div>

<!-- IMAGE LIGHTBOX -->
<div class="lightbox-overlay" *ngIf="lightboxUrl" (click)="lightboxUrl=null">
  <img [src]="lightboxUrl" class="lightbox-img"/>
  <button class="lightbox-close"><span class="material-symbols-outlined">close</span></button>
</div>

<!-- CALL MODAL -->
<div class="call-overlay" *ngIf="callActive" [class.dark]="isDark">
  <div class="call-card">
    <div class="call-type">{{ callType === 'video' ? 'Video Call' : 'Voice Call' }}</div>
    <div class="call-avatar" *ngIf="activeConv" [style.background]="activeConv.other_user.avatar_color">
      <img *ngIf="activeConv.other_user.avatar_url" [src]="activeConv.other_user.avatar_url" class="call-avatar-img"/>
      <span *ngIf="!activeConv.other_user.avatar_url">{{ getInitials(activeConv.other_user.name) }}</span>
    </div>
    <div class="call-name" *ngIf="activeConv">{{ activeConv.other_user.name }}</div>
    <div class="call-status">{{ callStatus }}</div>
    <div class="call-timer" *ngIf="callStatus === 'Connected'">{{ callTimer }}</div>
    <div class="call-actions">
      <button class="call-action-btn mute-btn" (click)="callMuted=!callMuted" [class.active]="callMuted">
        <span class="material-symbols-outlined">{{ callMuted ? 'mic_off' : 'mic' }}</span>
      </button>
      <button class="call-action-btn hangup-btn" (click)="endCall()">
        <span class="material-symbols-outlined">call_end</span>
      </button>
      <button class="call-action-btn speaker-btn" (click)="callSpeaker=!callSpeaker" [class.active]="callSpeaker">
        <span class="material-symbols-outlined">{{ callSpeaker ? 'volume_up' : 'volume_off' }}</span>
      </button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div class="chat-toast" *ngIf="toastMsg" [class.dark]="isDark">{{ toastMsg }}</div>

<!-- NEW CHAT MODAL -->
<div class="modal-overlay" *ngIf="newChatModal" (click)="newChatModal = false">
  <div class="new-chat-modal" [class.dark]="isDark" (click)="$event.stopPropagation()">
    <div class="ncm-header">
      <span class="material-symbols-outlined">person_add</span>
      <h3>New Chat</h3>
      <button class="modal-close" (click)="newChatModal = false">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="ncm-search">
      <span class="material-symbols-outlined">search</span>
      <input [(ngModel)]="newChatSearch" placeholder="Search by name or email..." autofocus/>
    </div>
    <div class="ncm-list">
      <div class="ncm-item" *ngFor="let u of filteredAllUsers" (click)="startChatWith(u)">
        <img *ngIf="u.avatar_url" [src]="u.avatar_url" class="ncm-avatar-img"/>
        <div *ngIf="!u.avatar_url" class="ncm-avatar" [style.background]="u.avatar_color || '#4f46e5'">
          {{ getInitials(u.name) }}
        </div>
        <div class="ncm-info">
          <div class="ncm-name">{{ u.name }}</div>
          <div class="ncm-email">{{ u.email }}</div>
        </div>
        <span class="material-symbols-outlined" style="color:#4f46e5;font-size:18px">arrow_forward</span>
      </div>
      <div class="ncm-empty" *ngIf="filteredAllUsers.length === 0">No users found</div>
    </div>
  </div>
</div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing:border-box;margin:0;padding:0; }
    .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-flex;align-items:center;justify-content:center;line-height:1; }
    :host { display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;position:relative; }

    .chat-shell { display:flex;flex:1;min-height:0;font-family:'Inter',sans-serif;background:#faf8ff;border-radius:12px;overflow:hidden;border:1px solid #e2e7ff; }
    .chat-shell.dark { background:#0f172a;border-color:#1e293b; }

    .chat-sidebar { width:300px;min-width:300px;background:white;display:flex;flex-direction:column;border-right:1px solid #e2e7ff;overflow:hidden; }
    .chat-shell.dark .chat-sidebar { background:#1e293b;border-right-color:#334155; }
    .chat-sidebar-header { display:flex;align-items:center;justify-content:space-between;padding:18px 16px 12px;border-bottom:1px solid #f2f3ff;flex-shrink:0; }
    .chat-shell.dark .chat-sidebar-header { border-bottom-color:#334155; }
    .chat-sidebar-header h3 { font-size:1rem;font-weight:700;color:#131b2e; }
    .chat-shell.dark .chat-sidebar-header h3 { color:#e2e8f0; }
    .sidebar-actions { display:flex;gap:4px; }
    .icon-action { background:none;border:none;cursor:pointer;color:#777587;padding:6px;border-radius:6px;transition:all 0.15s;display:flex;align-items:center; }
    .icon-action:hover { background:#eaedff;color:#3525cd; }
    .chat-shell.dark .icon-action { color:#94a3b8; }
    .chat-shell.dark .icon-action:hover { background:#334155;color:#a5b4fc; }
    .icon-action .material-symbols-outlined { font-size:18px; }

    .chat-search-wrap { position:relative;margin:10px 12px;flex-shrink:0;display:flex;align-items:center; }
    .cs-icon { position:absolute;left:10px;font-size:18px;color:#777587; }
    .chat-search { width:100%;padding:9px 10px 9px 36px;border:1px solid #e2e7ff;border-radius:8px;font-family:'Inter',sans-serif;font-size:0.875rem;outline:none;background:#f2f3ff;color:#131b2e; }
    .chat-shell.dark .chat-search { background:#0f172a;border-color:#334155;color:#e2e8f0; }
    .chat-search:focus { border-color:#3525cd;background:white; }
    .chat-shell.dark .chat-search:focus { background:#1e293b; }
    .chat-search::placeholder { color:#777587; }

    .section-label { padding:8px 16px 4px;font-size:0.68rem;font-weight:700;color:#777587;text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0; }
    .chat-list { flex:1;overflow-y:auto; }

    .chat-item { display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #f2f3ff; }
    .chat-shell.dark .chat-item { border-bottom-color:#1e293b; }
    .chat-item:hover { background:#f2f3ff; }
    .chat-shell.dark .chat-item:hover { background:#273344; }
    .chat-item.active { background:#eaedff; }
    .chat-shell.dark .chat-item.active { background:#1e1b4b; }

    .ci-avatar-wrap { position:relative;flex-shrink:0;width:42px;height:42px; }
    .ci-avatar { width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:0.78rem;font-weight:700; }
    .ci-avatar-img { width:42px;height:42px;border-radius:50%;object-fit:cover; }
    .status-dot { position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;border:2px solid white; }
    .chat-shell.dark .status-dot { border-color:#1e293b; }
    .status-dot.online { background:#22c55e; }
    .status-dot.away { background:#f59e0b; }
    .ci-info { flex:1;min-width:0; }
    .ci-top { display:flex;justify-content:space-between;align-items:baseline; }
    .ci-name { font-size:0.875rem;font-weight:600;color:#131b2e; }
    .chat-shell.dark .ci-name { color:#e2e8f0; }
    .ci-time { font-size:0.7rem;color:#777587; }
    .ci-bottom { display:flex;justify-content:space-between;align-items:center;margin-top:2px; }
    .ci-last { font-size:0.8rem;color:#464555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px; }
    .chat-shell.dark .ci-last { color:#94a3b8; }
    .ci-badge { background:#4f46e5;color:white;border-radius:999px;font-size:0.68rem;font-weight:700;padding:1px 6px;min-width:18px;text-align:center;flex-shrink:0; }
    .chat-empty-list { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;gap:8px;color:#94a3b8;font-size:13px; }
    .chat-empty-list .material-symbols-outlined { font-size:32px;opacity:0.4; }
    .new-chat-btn-sm { margin-top:8px;padding:8px 16px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600; }

    .chat-main { flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden; }
    .chat-topbar { background:white;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e7ff;flex-shrink:0; }
    .chat-shell.dark .chat-topbar { background:#1e293b;border-bottom-color:#334155; }
    .ct-left { display:flex;align-items:center;gap:12px; }
    .ct-avatar { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:0.78rem;font-weight:700; }
    .ct-avatar-img { width:40px;height:40px;border-radius:50%;object-fit:cover; }
    .ct-name { font-size:0.925rem;font-weight:700;color:#131b2e; }
    .chat-shell.dark .ct-name { color:#e2e8f0; }
    .ct-status { display:flex;align-items:center;gap:5px;font-size:0.78rem;font-weight:500; }
    .ct-status.online { color:#22c55e; }
    .status-dot-inline { width:8px;height:8px;border-radius:50%;display:inline-block; }
    .status-dot-inline.online { background:#22c55e; }
    .status-dot-inline.away { background:#f59e0b; }
    .ct-actions { display:flex;gap:6px; }
    .ct-btn { background:none;border:1px solid #e2e7ff;border-radius:8px;padding:6px 10px;cursor:pointer;color:#464555;transition:all 0.15s;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:4px; }
    .ct-btn .material-symbols-outlined { font-size:18px; }
    .ct-btn:hover { border-color:#3525cd;color:#3525cd;background:#eaedff; }
    .chat-shell.dark .ct-btn { border-color:#334155;color:#94a3b8; }
    .chat-shell.dark .ct-btn:hover { border-color:#4f46e5;color:#a5b4fc;background:#1e1b4b; }

    .messages-area { flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:14px;background:#f8f9ff; }
    .chat-shell.dark .messages-area { background:#0f172a; }
    .day-divider { display:flex;align-items:center;justify-content:center;margin:8px 0; }
    .day-divider span { font-size:0.72rem;font-weight:700;color:#777587;background:white;border:1px solid #e2e7ff;padding:4px 16px;border-radius:999px;letter-spacing:0.08em;text-transform:uppercase; }
    .chat-shell.dark .day-divider span { background:#1e293b;border-color:#334155;color:#64748b; }

    .msg-row { display:flex;align-items:flex-end;gap:10px; }
    .msg-row.mine { flex-direction:row-reverse; }
    .msg-avatar { width:30px;height:30px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:white;font-size:0.65rem;font-weight:700; }
    .msg-bubble-wrap { display:flex;flex-direction:column;max-width:62%;min-width:0;overflow:hidden;word-break:break-word; }
    .msg-row.mine .msg-bubble-wrap { align-items:flex-end; }
    .msg-bubble { padding:11px 16px;border-radius:18px;font-size:0.875rem;line-height:1.55;color:#131b2e;background:white;border:1px solid #e2e7ff;border-bottom-left-radius:4px;word-break:break-word; position:relative;overflow:hidden; }
    .msg-bubble.mine { background:#4f46e5;color:white;border-color:#4f46e5;border-bottom-left-radius:18px;border-bottom-right-radius:4px; }
    .msg-bubble.is-uploading { background:#4f46e5 !important; color:white !important; border-color:#4f46e5 !important; }
    .chat-shell.dark .msg-bubble.is-uploading { background:#4f46e5 !important; color:white !important; border-color:#4f46e5 !important; }
    .chat-shell.dark .msg-bubble:not(.mine) { background:#1e293b; color:#e2e8f0; border-color:#334155; }
    .msg-action-btns { position:absolute;top:-6px;right:-6px;display:flex;gap:2px;opacity:0;transition:opacity 0.15s;background:white;border-radius:8px;padding:2px 4px;box-shadow:0 1px 4px rgba(0,0,0,0.12); }
    .msg-bubble:hover .msg-action-btns { opacity:1; }
    .msg-action-btn { border:none;background:transparent;cursor:pointer;padding:3px;border-radius:4px;color:#64748b;display:flex;align-items:center; }
    .msg-action-btn:hover { background:#f1f5f9;color:#4f46e5; }
    .chat-shell.dark .msg-action-btns { background:#334155;box-shadow:0 1px 4px rgba(0,0,0,0.3); }
    .chat-shell.dark .msg-action-btn { color:#94a3b8; }
    .chat-shell.dark .msg-action-btn:hover { background:#475569;color:#818cf8; }
    .msg-meta { display:flex; align-items:center; justify-content:flex-end; gap:4px; font-size:0.65rem; color:#94a3b8; margin-top:2px; line-height:1; }
    .msg-row:not(.mine) .msg-meta { color:#64748b; }
    .chat-shell.dark .msg-row:not(.mine) .msg-meta { color:#94a3b8; }
    .msg-row.mine .msg-meta { color:rgba(255,255,255,0.75); }
    .msg-tick { font-size:16px !important; margin-left:3px; vertical-align:middle; color:#64748b !important; font-weight:bold; }
    .msg-row.mine .msg-meta .msg-tick { opacity:1 !important; font-size:16px !important; color:#64748b !important; font-weight:bold; }
    .msg-row.mine .msg-meta .msg-tick.read { color:#3b82f6 !important; filter:none !important; }
    .msg-tick.read { color:#3b82f6 !important; }
    .typing-row { display:flex;align-items:flex-end;gap:10px; }
    .typing-indicator { display:flex;gap:4px;align-items:center;padding:12px 16px;background:white;border-radius:18px;border:1px solid #e2e7ff; }
    .chat-shell.dark .typing-indicator { background:#1e293b;border-color:#334155; }
    .typing-indicator span { width:7px;height:7px;border-radius:50%;background:#3525cd;animation:bounce 1.2s infinite;opacity:0.6; }
    .typing-indicator span:nth-child(2){animation-delay:0.2s;} .typing-indicator span:nth-child(3){animation-delay:0.4s;}
    @keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:0.4;}40%{transform:scale(1.1);opacity:1;}}

    .chat-input-area { background:white;border-top:1px solid #e2e7ff;padding:12px 16px 16px;flex-shrink:0; }
    .chat-shell.dark .chat-input-area { background:#1e293b;border-top-color:#334155; }
    .smart-replies { display:flex;gap:8px;margin-bottom:10px;overflow-x:auto;padding-bottom:2px; }
    .smart-reply { white-space:nowrap;padding:6px 14px;background:white;border:1px solid #e2e7ff;border-radius:999px;font-family:'Inter',sans-serif;font-size:0.78rem;font-weight:500;color:#464555;cursor:pointer;transition:all 0.15s; }
    .smart-reply:hover { background:#eaedff;color:#3525cd; }
    .chat-shell.dark .smart-reply { background:#0f172a;border-color:#334155;color:#94a3b8; }
    .chat-shell.dark .smart-reply:hover { background:#1e1b4b;color:#a5b4fc; }
    .input-wrap { display:flex;align-items:center;gap:4px;border:1px solid #e2e7ff;border-radius:14px;padding:6px 8px;background:#f2f3ff;transition:all 0.2s; }
    .input-wrap:focus-within { border-color:#3525cd;background:white; }
    .chat-shell.dark .input-wrap { background:#0f172a;border-color:#334155; }
    .chat-shell.dark .input-wrap:focus-within { border-color:#4f46e5; }
    .chat-textarea { flex:1;border:none;background:transparent;outline:none;resize:none;font-family:'Inter',sans-serif;font-size:0.875rem;color:#131b2e;max-height:60px;line-height:1.4;min-height:20px;height:20px; }
    .chat-shell.dark .chat-textarea { color:#e2e8f0; }
    .chat-textarea::placeholder { color:#777587; }
    .send-msg-btn { background:#4f46e5;color:white;border:none;border-radius:10px;width:36px;height:36px;cursor:pointer;flex-shrink:0;transition:all 0.2s;display:flex;align-items:center;justify-content:center; }
    .send-msg-btn .material-symbols-outlined { font-size:18px; }
    .send-msg-btn:hover:not(:disabled){background:#4338ca;} 
    .send-msg-btn:disabled{background:#94a3b8;cursor:not-allowed;opacity:0.8;}

    .chat-empty { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:white; }
    .chat-shell.dark .chat-empty { background:#0f172a; }
    .empty-icon { font-size:56px;opacity:0.3; }
    .empty-title { font-size:1.1rem;font-weight:700;color:#131b2e; }
    .chat-shell.dark .empty-title { color:#e2e8f0; }
    .empty-sub { font-size:0.875rem;color:#777587; }
    .empty-new-btn { margin-top:8px;padding:10px 24px;background:#4f46e5;color:white;border:none;border-radius:10px;cursor:pointer;font-family:'Inter',sans-serif;font-size:0.875rem;font-weight:600;display:flex;align-items:center;gap:6px; }
    .empty-new-btn:hover { background:#4338ca; }

    .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:3000;display:flex;align-items:center;justify-content:center; }
    .new-chat-modal { background:white;border-radius:20px;width:420px;max-width:calc(100vw - 32px);box-shadow:0 32px 80px rgba(0,0,0,0.2);overflow:hidden; }
    .chat-shell.dark .new-chat-modal { background:#1e293b; }
    .ncm-header { display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid #f1f5f9; }
    .chat-shell.dark .ncm-header { border-bottom-color:#334155; }
    .ncm-header .material-symbols-outlined { color:#4f46e5;font-size:22px; }
    .ncm-header h3 { font-size:15px;font-weight:700;color:#131b2e;flex:1; }
    .chat-shell.dark .ncm-header h3 { color:#e2e8f0; }
    .modal-close { background:none;border:none;cursor:pointer;color:#6b7280;padding:4px;border-radius:6px;display:flex;align-items:center; }
    .ncm-search { display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #f1f5f9; }
    .chat-shell.dark .ncm-search { border-bottom-color:#334155; }
    .ncm-search .material-symbols-outlined { color:#94a3b8;font-size:18px; }
    .ncm-search input { flex:1;border:none;outline:none;font-family:'Inter',sans-serif;font-size:14px;color:#131b2e;background:transparent; }
    .chat-shell.dark .ncm-search input { color:#e2e8f0; }
    .ncm-list { max-height:320px;overflow-y:auto; }
    .ncm-item { display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;transition:background 0.12s; }
    .ncm-item:hover { background:#f2f3ff; }
    .chat-shell.dark .ncm-item:hover { background:#273344; }
    .ncm-avatar { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;flex-shrink:0; }
    .ncm-avatar-img { width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0; }
    .ncm-info { flex:1; }
    .ncm-name { font-size:14px;font-weight:600;color:#131b2e; }
    .chat-shell.dark .ncm-name { color:#e2e8f0; }
    .ncm-email { font-size:12px;color:#6b7280; }
    .ncm-empty { padding:24px;text-align:center;color:#94a3b8;font-size:13px; }

    /* NEW CHAT MODAL DARK (standalone - outside chat-shell) */
    .new-chat-modal.dark { background:#1e293b; }
    .new-chat-modal.dark .ncm-header { border-bottom-color:#334155; }
    .new-chat-modal.dark .ncm-header h3 { color:#e2e8f0; }
    .new-chat-modal.dark .modal-close { color:#94a3b8; }
    .new-chat-modal.dark .ncm-search { border-bottom-color:#334155; }
    .new-chat-modal.dark .ncm-search input { color:#e2e8f0; }
    .new-chat-modal.dark .ncm-item:hover { background:#273344; }
    .new-chat-modal.dark .ncm-name { color:#e2e8f0; }
    .new-chat-modal.dark .ncm-email { color:#64748b; }

    /* SEARCH IN CHAT BAR */
    .chat-search-bar { display:flex;align-items:center;gap:8px;padding:8px 16px;background:white;border-bottom:1px solid #e2e7ff;flex-shrink:0; }
    .chat-shell.dark .chat-search-bar { background:#1e293b;border-bottom-color:#334155; }
    .chat-search-bar input { flex:1;border:none;outline:none;font-family:'Inter',sans-serif;font-size:13px;color:#131b2e;background:transparent; }
    .chat-shell.dark .chat-search-bar input { color:#e2e8f0; }
    .search-count { font-size:11px;color:#4f46e5;font-weight:600;white-space:nowrap; }
    .csb-close { background:none;border:none;cursor:pointer;color:#94a3b8;padding:2px;border-radius:4px;display:flex;align-items:center; }
    .csb-close:hover { background:#f1f5f9;color:#475569; }
    .msg-row.highlight .msg-bubble { box-shadow:0 0 0 2px #4f46e5;background:#eef2ff !important; }
    .chat-shell.dark .msg-row.highlight .msg-bubble { background:#1e1b4b !important; }
    .msg-row.highlight .msg-bubble.mine { box-shadow:0 0 0 2px #818cf8; }

    /* INPUT ICON BUTTONS */
    .input-icon-btn { background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px;border-radius:6px;display:flex;align-items:center;transition:all 0.15s;flex-shrink:0; }
    .input-icon-btn .material-symbols-outlined { font-size:20px; }
    .input-icon-btn:hover { color:#4f46e5;background:#eef2ff; }
    .chat-shell.dark .input-icon-btn:hover { color:#a5b4fc;background:#1e1b4b; }

    /* EMOJI PICKER */
    .emoji-picker { background:white;border:1px solid #e2e7ff;border-radius:12px;padding:8px;margin-bottom:8px;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-height:180px;overflow-y:auto; }
    .chat-shell.dark .emoji-picker { background:#1e293b;border-color:#334155; }
    .emoji-grid { display:flex;flex-wrap:wrap;gap:2px; }
    .emoji-btn { background:none;border:none;cursor:pointer;font-size:20px;width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background 0.1s; }
    .emoji-btn:hover { background:#eef2ff; }
    .chat-shell.dark .emoji-btn:hover { background:#334155; }

    /* ATTACHED FILES */
    .attached-files { display:flex;flex-wrap:wrap;gap:8px;padding:8px 12px;background:#f8f9ff;border-top:1px solid #e2e7ff; max-height:120px; overflow-y:auto; }
    .chat-shell.dark .attached-files { background:#0f172a;border-top-color:#334155; }
    .af-item { display:flex;align-items:center;gap:6px;background:white;border:1px solid #e2e7ff;padding:4px 10px;border-radius:8px;font-size:0.75rem;color:#464555; }
    .chat-shell.dark .af-item { background:#1e293b;border-color:#334155;color:#94a3b8; }
    .af-name { max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .af-remove { background:none;border:none;cursor:pointer;color:#94a3b8;display:flex;align-items:center;padding:2px;border-radius:4px; }
    .af-remove:hover { color:#ef4444;background:#fee2e2; }
    .af-remove .material-symbols-outlined { font-size:14px; }

    /* MESSAGE FILE ATTACHMENT */
    .msg-file-attachment { display:flex;flex-direction:column;gap:8px;min-width:180px; }
    .mfa-preview { width:100%;max-height:200px;overflow:hidden;border-radius:8px;cursor:pointer; }
    .mfa-preview img { width:100%;height:100%;object-fit:cover;transition:transform 0.2s; }
    .mfa-preview img:hover { transform:scale(1.02); }
    .mfa-info { display:flex;align-items:center;gap:8px;padding:4px 0; }
    .mfa-name { font-size:0.8rem;font-weight:500;flex:1;word-break:break-all;white-space:normal;line-height:1.4; }
    .mfa-download { color:inherit;opacity:0.7;transition:opacity 0.2s;display:flex;align-items:center; }
    .mfa-download:hover { opacity:1; }
    .mfa-download .material-symbols-outlined { font-size:18px; }
    .msg-bubble.mine .mfa-download { color:white; }

    /* PROFILE SIDEBAR */
    .profile-sidebar { width:280px;min-width:280px;background:white;border-left:1px solid #e2e7ff;display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto; }
    .chat-shell.dark .profile-sidebar { background:#1e293b;border-left-color:#334155; }
    .ps-header { display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #f1f5f9;flex-shrink:0; }
    .chat-shell.dark .ps-header { border-bottom-color:#334155; }
    .ps-header h4 { font-size:14px;font-weight:700;color:#131b2e; }
    .chat-shell.dark .ps-header h4 { color:#e2e8f0; }
    .ps-close { background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px;border-radius:6px;display:flex;align-items:center; }
    .ps-close:hover { background:#f1f5f9; }
    .chat-shell.dark .ps-close:hover { background:#334155; }
    .ps-body { display:flex;flex-direction:column;align-items:center;padding:24px 16px;gap:8px; }
    .ps-avatar-wrap { cursor:pointer;margin-bottom:8px; }
    .ps-avatar-img { width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #e2e7ff;transition:transform 0.2s; }
    .ps-avatar-img:hover { transform:scale(1.08); }
    .chat-shell.dark .ps-avatar-img { border-color:#334155; }
    .ps-avatar { width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:1.6rem;font-weight:700; }
    .ps-name { font-size:16px;font-weight:700;color:#131b2e;text-align:center; }
    .chat-shell.dark .ps-name { color:#e2e8f0; }
    .ps-email { font-size:12px;color:#64748b;text-align:center; }
    .ps-status-row { display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#22c55e;margin:4px 0 12px; }
    .ps-actions { display:flex;flex-direction:column;gap:4px;width:100%;margin-top:8px; }
    .ps-action-btn { display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #e2e7ff;border-radius:10px;background:white;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;color:#464555;transition:all 0.15s;width:100%;text-align:left; }
    .ps-action-btn:hover { border-color:#4f46e5;color:#4f46e5;background:#eef2ff; }
    .ps-action-btn .material-symbols-outlined { font-size:18px; }
    .chat-shell.dark .ps-action-btn { background:#0f172a;border-color:#334155;color:#94a3b8; }
    .chat-shell.dark .ps-action-btn:hover { border-color:#4f46e5;color:#a5b4fc;background:#1e1b4b; }

    /* LIGHTBOX */
    .lightbox-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:5000;display:flex;align-items:center;justify-content:center;cursor:pointer; }
    .lightbox-img { max-width:90vw;max-height:85vh;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,0.3); }
    .lightbox-close { position:fixed;top:20px;right:20px;background:rgba(255,255,255,0.15);border:none;color:white;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center; }
    .lightbox-close:hover { background:rgba(255,255,255,0.3); }

    /* TOAST */
    .chat-toast { position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:10px 24px;border-radius:10px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;z-index:6000;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:toastIn 0.3s ease; }
    .chat-toast.dark { background:#334155; }
    @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(12px);} to{opacity:1;transform:translateX(-50%) translateY(0);} }

    /* CALL MODAL */
    .call-overlay { position:fixed;inset:0;background:rgba(15,23,42,0.92);backdrop-filter:blur(12px);z-index:5000;display:flex;align-items:center;justify-content:center;animation:overlayIn 0.3s ease; }
    @keyframes overlayIn { from{opacity:0;} to{opacity:1;} }
    .call-card { display:flex;flex-direction:column;align-items:center;gap:16px;padding:48px 60px;border-radius:24px;background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.5);backdrop-filter:blur(20px); }
    .call-type { font-size:13px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em; }
    .call-avatar { width:100px;height:100px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:2rem;font-weight:700;position:relative;overflow:hidden; }
    .call-avatar-img { width:100%;height:100%;object-fit:cover; }
    .call-avatar::after { content:'';position:absolute;inset:-4px;border-radius:50%;border:3px solid rgba(79,70,229,0.5);animation:callPulse 2s ease-in-out infinite; }
    @keyframes callPulse { 0%,100%{transform:scale(1);opacity:0.5;} 50%{transform:scale(1.1);opacity:1;} }
    .call-name { font-size:22px;font-weight:700;color:#f1f5f9; }
    .call-status { font-size:14px;color:#94a3b8;animation:statusBlink 1.5s ease-in-out infinite; }
    @keyframes statusBlink { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
    .call-timer { font-size:18px;font-weight:600;color:#a5b4fc;font-variant-numeric:tabular-nums; }
    .call-actions { display:flex;gap:20px;margin-top:16px; }
    .call-action-btn { width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s; }
    .call-action-btn .material-symbols-outlined { font-size:24px; }
    .mute-btn { background:rgba(71,85,105,0.5);color:white; }
    .mute-btn:hover { background:rgba(71,85,105,0.8); }
    .mute-btn.active { background:#f59e0b;color:#0f172a; }
    .hangup-btn { background:#ef4444;color:white; }
    .hangup-btn:hover { background:#dc2626; }
    .speaker-btn { background:rgba(71,85,105,0.5);color:white; }
    .speaker-btn:hover { background:rgba(71,85,105,0.8); }
    .speaker-btn.active { background:#22c55e;color:#0f172a; }
  `]
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesArea') messagesArea!: ElementRef;

  currentUser: any = null;
  conversations: ConversationItem[] = [];
  activeConv: ConversationItem | null = null;
  messages: ChatMsg[] = [];
  messageText = '';
  chatSearch = '';
  sending = false;
  loading = false;
  newChatModal = false;
  newChatSearch = '';
  allUsers: any[] = [];
  private shouldScroll = false;

  // New features
  profileOpen = false;
  emojiOpen = false;
  chatMsgSearch: string | null = null;
  chatFiles: File[] = [];
  lightboxUrl: string | null = null;
  toastMsg: string | null = null;
  editingMessageId: number | null = null;
  editText = '';

  // Call features
  callActive = false;
  callType: 'voice' | 'video' = 'voice';
  callStatus = 'Calling...';
  callTimer = '00:00';
  callMuted = false;
  callSpeaker = false;
  private callInterval: any = null;
  private callSeconds = 0;

  emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🔥', '🎉', '👏', '😊', '🙏', '💪', '✅', '⭐', '💡', '📎', '🚀', '😢', '😮', '🤝', '💯', '🎯', '☕', '🌟', '💬', '📌', '🎊'];

  get isDark(): boolean { return localStorage.getItem('vmail_dark') === '1'; }

  get filteredConversations() {
    const q = this.chatSearch.toLowerCase();
    const base = this.conversations.filter(c => c.other_user.id !== this.currentUser?.id);
    return q ? base.filter(c => c.other_user.name.toLowerCase().includes(q)) : base;
  }

  getSavedMsgTime(): string {
    const selfConv = this.conversations.find(c => c.other_user.id === this.currentUser?.id);
    return selfConv?.last_time || '';
  }

  get filteredAllUsers() {
    const q = this.newChatSearch.toLowerCase();
    return q ? this.allUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : this.allUsers;
  }

  getInitials(name: string): string {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  }

  /** Online = last_login within 10 minutes; else away. */
  getStatusFromLastLogin(lastLogin: string | null | undefined): string {
    // Determine user status based on heartbeat timestamp
    if (!lastLogin) return 'away';
    const diffMin = (Date.now() - new Date(lastLogin).getTime()) / 60000;
    return diffMin <= 10 ? 'online' : 'away';
  }

  private bulkFwdService = inject(BulkForwardService);

  constructor(private router: Router, private http: HttpClient, private auth: AuthService) { }

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.currentUser = u;
    });
    this.loadConversations();
    // Handle navigation from contacts/main-layout
    const state = window.history.state;
    if (state?.contactName || state?.userId) {
      setTimeout(() => this.openChatByState(state), 300);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll && this.messagesArea) {
      const el = this.messagesArea.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  loadConversations() {
    this.loading = true;
    this.http.get<ConversationItem[]>(`${environment.apiUrl}/chat/conversations`).subscribe({
      next: (data) => {
        this.conversations = (data || []).map(c => {
          if (c.other_user && c.other_user.id === this.currentUser?.id) {
            c.other_user.name = "Saved Messages (You)";
            c.other_user.avatar_color = "#10b981";
          }
          return c;
        });
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  openChatByState(state: any) {
    if (state.userId) {
      this.openOrCreateChat(state.userId);
    } else if (state.contactName) {
      this.loadAllUsers(() => {
        const user = this.allUsers.find(u => u.name.toLowerCase() === state.contactName.toLowerCase());
        if (user) this.openOrCreateChat(user.id);
      });
    }
  }

  loadAllUsers(callback?: () => void) {
    this.http.get<any[]>(`${environment.apiUrl}/users`).subscribe({
      next: (users) => {
        const seen = new Set<number>();
        const filtered = users.filter(u => {
          if (u.id === this.currentUser?.id) return false;
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        });
        const meUser = users.find(u => u.id === this.currentUser?.id);
        if (meUser) {
          this.allUsers = [
            {
              ...meUser,
              name: 'Saved Messages (You)',
              avatar_color: '#10b981'
            },
            ...filtered
          ];
        } else {
          this.allUsers = filtered;
        }
        if (callback) callback();
      }
    });
  }

  selectConversation(c: ConversationItem) {
    this.activeConv = c;
    c.unread = 0;
    this.loadMessages(c.other_user.id);
  }

  loadMessages(otherUserId: number) {
    this.http.get<any>(`${environment.apiUrl}/chat/messages/${otherUserId}`).subscribe({
      next: (data) => {
        const serverMsgIds = new Set(data.messages.map((m: any) => m.id));
        // Preserve local-only messages (uploading temp msgs have negative IDs, not on server)
        const localOnlyMessages = this.messages.filter(m => !serverMsgIds.has(m.id));
        this.messages = [...data.messages, ...localOnlyMessages];
        this.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        this.shouldScroll = true;
      }
    });
  }

  openOrCreateChat(userId: number) {
    // Check if conversation exists
    const existing = this.conversations.find(c => c.other_user.id === userId);
    if (existing) {
      // Ensure self-chat has correct label
      if (existing.other_user.id === this.currentUser?.id) {
        existing.other_user.name = 'Saved Messages (You)';
        existing.other_user.avatar_color = '#10b981';
      }
      this.selectConversation(existing);
    } else {
      // Load user info and create virtual conversation entry
      this.http.get<any>(`${environment.apiUrl}/chat/messages/${userId}`).subscribe({
        next: (data) => {
          const isSelf = userId === this.currentUser?.id;
          const conv: ConversationItem = {
            conversation_id: data.conversation_id,
            other_user: isSelf ? {
              ...data.other_user,
              name: 'Saved Messages (You)',
              avatar_color: '#10b981'
            } : data.other_user,
            last_message: null,
            last_time: null,
            unread: 0
          };
          // Add to top if not already there
          if (!this.conversations.find(c => c.conversation_id === conv.conversation_id)) {
            this.conversations.unshift(conv);
          }
          this.activeConv = conv;
          // Prevent race condition: preserve local-only messages
          const serverMsgIds = new Set(data.messages.map((m: any) => m.id));
          const localOnlyMessages = this.messages.filter(m => !serverMsgIds.has(m.id));

          this.messages = [...data.messages, ...localOnlyMessages];
          this.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          this.shouldScroll = true;
          this.newChatModal = false;
        }
      });
    }
  }

  startChatWith(user: any) {
    this.newChatModal = false;
    this.openOrCreateChat(user.id);
  }

  sendMessage() {
    if ((!this.messageText.trim() && this.chatFiles.length === 0) || !this.activeConv) return;

    const otherId = this.activeConv.other_user.id;

    // Send text message if any
    if (this.messageText.trim()) {
      const text = this.messageText.trim();
      this.messageText = '';
      this.sending = true;
      this.http.post<ChatMsg>(`${environment.apiUrl}/chat/send`, {
        to_user_id: otherId,
        message: text
      }).subscribe({
        next: (msg) => {
          this.messages.push(msg);
          this.shouldScroll = true;
          this.sending = false;
          if (this.activeConv) { this.activeConv.last_message = text; this.activeConv.last_time = msg.created_at; }
        },
        error: () => { this.sending = false; }
      });
    }

    // Send files
    if (this.chatFiles.length > 0) {
      const filesToSend = [...this.chatFiles];
      this.chatFiles = [];

      filesToSend.forEach(file => {
        const tempId = -Math.floor(Math.random() * 1000000);
        const tempMsg: ChatMsg = {
          id: tempId,
          sender_id: this.currentUser?.id || 0,
          sender_name: this.currentUser?.name || '',
          sender_avatar_color: '#4f46e5',
          sender_avatar_url: null,
          message: file.name,
          is_mine: true,
          is_file: true,
          created_at: new Date().toISOString(),
          uploading: true,
          progress: 0
        };
        this.messages.push(tempMsg);
        this.shouldScroll = true;
        // Get the reference that is actually inside the array
        const msgRef = this.messages[this.messages.length - 1];

        const url = `${environment.apiUrl}/chat/upload-stream?to_user_id=${otherId}&filename=${encodeURIComponent(file.name)}&mime_type=${encodeURIComponent(file.type)}`;
        msgRef.uploadSub = this.http.post<ChatMsg>(url, file, {
          reportProgress: true,
          observe: 'events'
        }).subscribe({
          next: (event: any) => {
            if (event.type === 1) { // HttpEventType.UploadProgress
              const progress = Math.round(100 * event.loaded / (event.total || 1));
              const m = this.messages.find(x => x.id === tempId);
              if (m) {
                m.progress = progress;
                m.loaded_mb = event.loaded / (1024 * 1024);
                m.total_mb = (event.total || event.loaded) / (1024 * 1024);
              }
            } else if (event.type === 4) { // HttpEventType.Response
              const msg = event.body;
              const idx = this.messages.findIndex(x => x.id === tempId);
              if (idx !== -1) {
                this.messages[idx] = msg;
              } else {
                this.messages.push(msg);
              }
              this.shouldScroll = true;
              if (this.activeConv) { this.activeConv.last_message = '📎 File: ' + msg.message; this.activeConv.last_time = msg.created_at; }
            }
          },
          error: () => {
            const idx = this.messages.findIndex(x => x.id === tempId);
            if (idx !== -1) {
              this.messages[idx].message = 'Upload failed';
              this.messages[idx].uploading = false;
            }
          }
        });
      });
    }
  }

  onEnterSend(event: KeyboardEvent) {
    if (!event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  cancelUpload(msg: ChatMsg) {
    const target = this.messages.find(m => m.id === msg.id);
    if (target && target.uploadSub) {
      target.uploadSub.unsubscribe();
      target.uploadSub = null;
    }
    this.messages = this.messages.filter(m => m.id !== msg.id);
  }

  useReply(text: string) { this.messageText = text; }
  goBack() { this.router.navigate(['/inbox']); }
  composeEmail() {
    if (this.activeConv) {
      window.dispatchEvent(new CustomEvent('vmail:compose', { detail: { to: [this.activeConv.other_user.email] } }));
    }
  }

  // ── New feature methods ──

  get filteredMessages(): ChatMsg[] {
    if (!this.chatMsgSearch) return [];
    const q = this.chatMsgSearch.toLowerCase();
    return this.messages.filter(m => m.message.toLowerCase().includes(q));
  }

  // ── User-local timestamp helpers ──
  isMsgRead(msg: ChatMsg): boolean {
    if (msg.is_read) return true;
    if (this.activeConv && this.currentUser && this.activeConv.other_user.id === this.currentUser.id) return true;
    return false;
  }

  getMsgTickIcon(msg: ChatMsg): string {
    if (this.isMsgRead(msg)) return 'done_all';
    if (this.activeConv) {
      const status = this.getStatusFromLastLogin(this.activeConv.other_user.last_login);
      if (status === 'online') return 'done_all';
    }
    return 'done';
  }

  formatMsgTime(iso: string | null | undefined): string {
    if (!iso) return '';
    if (iso.length <= 8) return iso;
    let safeIso = iso.trim();
    if (!safeIso.endsWith('Z') && !safeIso.includes('+') && !safeIso.includes('-') && safeIso.includes('T')) {
      safeIso += 'Z';
    } else if (!safeIso.includes('T') && safeIso.length > 10) {
      safeIso = safeIso.replace(' ', 'T') + 'Z';
    }
    const d = new Date(safeIso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatGroupDate(iso: string | null | undefined): string {
    if (!iso || iso.length <= 8) return 'Today';
    let safeIso = iso.trim();
    if (!safeIso.endsWith('Z') && !safeIso.includes('+') && !safeIso.includes('-') && safeIso.includes('T')) {
      safeIso += 'Z';
    } else if (!safeIso.includes('T') && safeIso.length > 10) {
      safeIso = safeIso.replace(' ', 'T') + 'Z';
    }
    const d = new Date(safeIso);
    if (isNaN(d.getTime())) return 'Today';
    const now = new Date();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  }

  get groupedMessages(): { date: string, messages: ChatMsg[] }[] {
    const groups: { [key: string]: ChatMsg[] } = {};
    const msgs = this.chatMsgSearch ? this.filteredMessages : this.messages;
    msgs.forEach(msg => {
      const key = this.formatGroupDate(msg.created_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(msg);
    });
    return Object.keys(groups).map(date => ({ date, messages: groups[date] }));
  }

  get displayMessages(): ChatMsg[] {
    return this.messages;
  }

  toggleChatSearch() {
    this.chatMsgSearch = this.chatMsgSearch === null ? '' : null;
  }

  toggleProfile() {
    this.profileOpen = !this.profileOpen;
  }

  insertEmoji(e: string) {
    this.messageText += e;
    this.emojiOpen = false;
  }

  onChatFileSelect(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files || []) as File[];
    this.chatFiles.push(...files);
    (event.target as HTMLInputElement).value = '';
  }

  removeChatFile(index: number) {
    this.chatFiles.splice(index, 1);
  }

  getFileUrl(path?: string) {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    let filename = path;
    if (path.includes('/files/')) {
      filename = path.split('/files/').pop() || path;
    } else if (path.includes('/uploads/')) {
      filename = path.split('/uploads/').pop() || path;
    }

    return `${environment.apiUrl}/files/${filename}`;
  }

  isImage(path?: string) {
    if (!path) return false;
    const ext = path.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  }

  viewProfilePic(event: Event, user: any) {
    event.stopPropagation();
    if (user.avatar_url) {
      this.lightboxUrl = user.avatar_url;
    }
  }

  isMuted(userId: number): boolean {
    const muted = JSON.parse(localStorage.getItem('vmail_muted') || '[]');
    return muted.includes(userId);
  }

  toggleMute() {
    if (!this.activeConv) return;
    const uid = this.activeConv.other_user.id;
    let muted = JSON.parse(localStorage.getItem('vmail_muted') || '[]');
    if (muted.includes(uid)) {
      muted = muted.filter((id: number) => id !== uid);
      this.showToast('Notifications unmuted');
    } else {
      muted.push(uid);
      this.showToast('Notifications muted');
    }
    localStorage.setItem('vmail_muted', JSON.stringify(muted));
  }

  isBlocked(userId: number): boolean {
    const blocked = JSON.parse(localStorage.getItem('vmail_blocked') || '[]');
    return blocked.includes(userId);
  }

  toggleBlock() {
    if (!this.activeConv) return;
    const uid = this.activeConv.other_user.id;
    let blocked = JSON.parse(localStorage.getItem('vmail_blocked') || '[]');
    if (blocked.includes(uid)) {
      blocked = blocked.filter((id: number) => id !== uid);
      this.showToast('User unblocked');
    } else {
      blocked.push(uid);
      this.showToast('User blocked');
    }
    localStorage.setItem('vmail_blocked', JSON.stringify(blocked));
  }

  showToast(msg: string) {
    this.toastMsg = msg;
    setTimeout(() => this.toastMsg = null, 2500);
  }

  startCall(type: 'voice' | 'video') {
    if (!this.activeConv) return;
    this.callType = type;
    this.callActive = true;
    this.callStatus = 'Calling...';
    this.callMuted = false;
    this.callSpeaker = false;
    this.callSeconds = 0;
    this.callTimer = '00:00';
    // Simulate ringing then connect
    setTimeout(() => {
      if (this.callActive) {
        this.callStatus = 'Ringing...';
        setTimeout(() => {
          if (this.callActive) {
            this.callStatus = 'Connected';
            this.callInterval = setInterval(() => {
              this.callSeconds++;
              const m = Math.floor(this.callSeconds / 60).toString().padStart(2, '0');
              const s = (this.callSeconds % 60).toString().padStart(2, '0');
              this.callTimer = `${m}:${s}`;
            }, 1000);
          }
        }, 2000);
      }
    }, 1500);
  }

  endCall() {
    this.callActive = false;
    this.callStatus = '';
    if (this.callInterval) {
      clearInterval(this.callInterval);
      this.callInterval = null;
    }
    if (this.callSeconds > 0) {
      this.showToast(`Call ended • ${this.callTimer}`);
    } else {
      this.showToast('Call ended');
    }
    this.callSeconds = 0;
  }

  // ── Edit / Delete message ──
  startEdit(msg: ChatMsg) {
    this.editingMessageId = msg.id;
    this.editText = msg.message;
  }

  saveEdit(msg: ChatMsg) {
    if (!this.editText.trim()) return;
    const finalMessage = this.editText.trim();
    // Optimistic update
    const oldMessage = msg.message;
    msg.message = finalMessage;
    msg.is_edited = true;
    this.editingMessageId = null;
    this.http.post<any>(`${environment.apiUrl}/chat/messages/${msg.id}/edit`, { message: finalMessage }).subscribe({
      next: (res) => {
        if (res && res.updated_at) msg.updated_at = res.updated_at;
      },
      error: (err) => {
        console.error('Edit failed', err);
        msg.message = oldMessage;
        msg.is_edited = false;
      }
    });
  }

  deleteMessage(msg: ChatMsg) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    // Optimistic soft-delete
    msg.delete_status = true;
    msg.message = '';
    msg.is_file = false;
    msg.file_path = undefined;
    this.http.post<any>(`${environment.apiUrl}/chat/messages/${msg.id}/delete`, {}).subscribe({
      error: (err) => {
        console.error('Delete failed', err);
        msg.delete_status = false;
      }
    });
  }

  // BULK FORWARDING
  selectionMode = false;
  selectedMessages = new Set<number>();

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    this.selectedMessages.clear();
  }

  toggleMessageSelection(msg: ChatMsg) {
    if (this.selectedMessages.has(msg.id)) {
      this.selectedMessages.delete(msg.id);
    } else {
      this.selectedMessages.add(msg.id);
    }
  }

  forwardSelectedMessages() {
    if (this.selectedMessages.size === 0) return;
    const msgsToForward = this.messages.filter(m => this.selectedMessages.has(m.id));
    this.bulkFwdService.openModal(msgsToForward, 'chat');
  }
}