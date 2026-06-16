import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="widget-panel shadow-lg" *ngIf="activeWidget" (click)="$event.stopPropagation()">
      
      <!-- CHAT VIEW -->
      <ng-container *ngIf="activeWidget === 'chat' && !openedChatId">
        <div class="wp-header-chat">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="chat-av">
                <img *ngIf="currentUser?.avatar_url" [src]="currentUser.avatar_url" onerror="this.style.display='none'">
                <span *ngIf="!currentUser?.avatar_url" style="color:#10b981;">ME</span>
            </div>
            <div>
              <div style="font-size:14px; font-weight:600; color:#fff;">{{ currentUser?.name || 'admin' }}</div>
              <div style="font-size:11px; color:#d2e3fc; display:flex; align-items:center; gap:4px;">
                <div style="width:6px; height:6px; background:#4ade80; border-radius:50%;"></div> Online
              </div>
            </div>
          </div>
          <span class="material-symbols-outlined chat-close" (click)="close.emit()">close</span>
        </div>
        <div class="wp-search">
          <span class="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search chats..." [(ngModel)]="searchQuery">
        </div>
        <div class="wp-section-title">RECENT CHATS</div>
        <div class="wp-body-list">
          <div class="chat-list-item" *ngFor="let c of filteredConversations()" (click)="openChat(c.other_user.id)">
            <div class="cli-av" [style.background]="c.other_user.avatar_color || '#6366f1'">
              <img *ngIf="c.other_user.avatar_url" [src]="c.other_user.avatar_url">
              <span *ngIf="!c.other_user.avatar_url">{{ getInitials(c.other_user.name) }}</span>
              <div [class]="'cli-status ' + (isOnline(c.other_user.last_login) ? 'online' : 'offline')"></div>
            </div>
            <div class="cli-info">
              <div class="cli-top">
                <span class="cli-name">{{ c.other_user.name }}</span>
                <span class="cli-time">{{ formatTime(c.last_time) }}</span>
              </div>
              <div class="cli-preview" [style.color]="c.other_user.id === currentUser?.id ? '#10b981' : '#5f6368'">
                {{ c.last_message || 'No messages yet' }}
              </div>
            </div>
            <div *ngIf="c.unread > 0" style="background:#ef4444; color:white; font-size:10px; font-weight:bold; border-radius:10px; padding:2px 6px; margin-left:8px;">{{c.unread}}</div>
          </div>
          <div *ngIf="conversations.length === 0" style="padding: 20px; text-align:center; color:#9aa0a6; font-size:13px;">
            No recent chats
          </div>
        </div>
      </ng-container>

      <!-- OPENED CHAT CONVERSATION VIEW -->
      <ng-container *ngIf="activeWidget === 'chat' && openedChatId">
        <div class="wp-header-white" style="background:#f8f9fa;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined icon-btn" (click)="closeChat()">arrow_back</span>
            <div class="cli-av" style="width:32px; height:32px; font-size:12px; margin-right:4px;" [style.background]="openedChatUser?.avatar_color || '#6366f1'">
                <img *ngIf="openedChatUser?.avatar_url" [src]="openedChatUser.avatar_url">
                <span *ngIf="!openedChatUser?.avatar_url">{{ getInitials(openedChatUser?.name || '?') }}</span>
            </div>
            <div style="display:flex; flex-direction:column;">
                <span style="font-size:14px; font-weight:600; color:#202124;">{{ openedChatUser?.name }}</span>
                <span style="font-size:11px; color:#5f6368;">{{ isOnline(openedChatUser?.last_login) ? 'Online' : 'Away' }}</span>
            </div>
          </div>
        </div>
        <div class="wp-body-list" style="padding:12px; display:flex; flex-direction:column; gap:8px; flex:1; background:#f1f3f4;" #scrollMe>
            <div *ngFor="let msg of messages" style="display:flex; flex-direction:column; max-width:80%;" [style.align-self]="msg.is_mine ? 'flex-end' : 'flex-start'">
                <div style="padding:8px 12px; border-radius:12px; font-size:13px; line-height:1.4; word-break:break-word;" [style.background]="msg.is_mine ? '#6a35ff' : '#fff'" [style.color]="msg.is_mine ? '#fff' : '#202124'">
                    {{ msg.message }}
                </div>
                <div style="font-size:10px; color:#9aa0a6; margin-top:2px; display:flex; justify-content:flex-end;">{{ formatTime(msg.created_at) }}</div>
            </div>
        </div>
        <div style="padding:8px; border-top:1px solid #e0e0e0; display:flex; gap:8px; background:#fff;">
           <input type="text" placeholder="Type a message..." [(ngModel)]="newMessage" (keydown.enter)="sendMessage()" style="flex:1; border:1px solid #dadce0; border-radius:20px; padding:8px 14px; outline:none; font-size:13px;">
           <span class="material-symbols-outlined" style="color:#6a35ff; cursor:pointer; align-self:center; font-size:24px;" (click)="sendMessage()">send</span>
        </div>
      </ng-container>

            <!-- CHANNELS VIEW -->
      <ng-container *ngIf="activeWidget === 'channels' && !openedChannelId">
        <div class="wp-header-white">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined" style="color:#6366f1;">hub</span>
            <span style="font-size:15px; font-weight:600; color:#202124;">Channels</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined icon-btn" style="color:#6366f1;">add</span>
            <span class="material-symbols-outlined icon-btn" (click)="close.emit()">close</span>
          </div>
        </div>
        <div class="wp-search">
          <span class="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search channels..." [(ngModel)]="searchQuery">
        </div>
        <div class="wp-section-title">MY CHANNELS</div>
        <div class="wp-body-list">
          <div class="chat-list-item" *ngFor="let c of filteredChannels()" (click)="openChannel(c.id, c.name)">
            <div class="cli-av" style="background:#6366f1">#</div>
            <div class="cli-info">
              <div class="cli-top">
                <span class="cli-name">{{ c.name }}</span>
                <span class="cli-time">{{ formatTime(c.last_time) }}</span>
              </div>
              <div class="cli-preview">{{ c.last_message || 'No messages' }}</div>
            </div>
          </div>
          <div *ngIf="channels.length === 0" style="padding: 20px; text-align:center; color:#9aa0a6; font-size:13px;">
            No channels
          </div>
        </div>
      </ng-container>

      <!-- OPENED CHANNEL VIEW -->
      <ng-container *ngIf="activeWidget === 'channels' && openedChannelId">
        <div class="wp-header-white" style="background:#f8f9fa;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined icon-btn" (click)="closeChannel()">arrow_back</span>
            <div class="cli-av" style="width:32px; height:32px; font-size:16px; margin-right:4px; background:#6366f1;">#</div>
            <div style="display:flex; flex-direction:column;">
                <span style="font-size:14px; font-weight:600; color:#202124;">{{ openedChannelName }}</span>
                <span style="font-size:11px; color:#5f6368;">Channel</span>
            </div>
          </div>
        </div>
        <div class="wp-body-list" style="padding:12px; display:flex; flex-direction:column; gap:8px; flex:1; background:#f1f3f4;" #scrollMe>
            <div *ngFor="let msg of messages" style="display:flex; flex-direction:column; max-width:80%;" [style.align-self]="msg.is_mine ? 'flex-end' : 'flex-start'">
                <span *ngIf="!msg.is_mine" style="font-size:11px; color:#5f6368; margin-bottom:2px; margin-left:4px;">{{ msg.sender_name }}</span>
                <div style="padding:8px 12px; border-radius:12px; font-size:13px; line-height:1.4; word-break:break-word;" [style.background]="msg.is_mine ? '#6a35ff' : '#fff'" [style.color]="msg.is_mine ? '#fff' : '#202124'">
                    {{ msg.message }}
                </div>
                <div style="font-size:10px; color:#9aa0a6; margin-top:2px; display:flex; justify-content:flex-end;">{{ formatTime(msg.created_at) }}</div>
            </div>
        </div>
        <div style="padding:8px; border-top:1px solid #e0e0e0; display:flex; gap:8px; background:#fff;">
           <input type="text" placeholder="Type a message..." [(ngModel)]="newMessage" (keydown.enter)="sendMessage()" style="flex:1; border:1px solid #dadce0; border-radius:20px; padding:8px 14px; outline:none; font-size:13px;">
           <span class="material-symbols-outlined" style="color:#6a35ff; cursor:pointer; align-self:center; font-size:24px;" (click)="sendMessage()">send</span>
        </div>
      </ng-container>

      <!-- CONTACTS VIEW -->
      <ng-container *ngIf="activeWidget === 'contacts'">
        <div class="wp-header-white">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-outlined" style="color:#6366f1;">contact_mail</span>
            <span style="font-size:15px; font-weight:600; color:#202124;">Contacts</span>
          </div>
          <span class="material-symbols-outlined icon-btn" (click)="close.emit()">close</span>
        </div>
        <div class="wp-search">
          <span class="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search contacts..." [(ngModel)]="searchQuery">
        </div>
        <div class="wp-section-title">ALL CONTACTS</div>
        <div class="wp-body-list">
          <div class="chat-list-item" *ngFor="let u of filteredContacts()" (click)="openWidgetChat(u.id)">
            <div class="cli-av" [style.background]="u.avatar_color || '#6366f1'">
                <img *ngIf="u.avatar_url" [src]="u.avatar_url">
                <span *ngIf="!u.avatar_url">{{ getInitials(u.name) }}</span>
            </div>
            <div class="cli-info" style="border:none;">
              <div class="cli-top">
                <span class="cli-name">{{ u.name }} {{ u.id === currentUser?.id ? '(You)' : '' }}</span>
              </div>
              <div class="cli-preview">{{ isOnline(u.last_login) ? 'Online' : 'Offline' }}</div>
            </div>
            <span class="material-symbols-outlined chat-icon-btn">chat_bubble_outline</span>
          </div>
        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    .widget-panel { position: fixed; bottom: 48px; left: 16px; width: 340px; background: #fff; border-radius: 12px; z-index: 10000; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15); height: 500px; }
    
    .wp-header-chat { background: #6a35ff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: flex-start; border-top-left-radius: 12px; border-top-right-radius: 12px; }
    .chat-av { width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; border: 2px solid #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .chat-av img { width: 100%; height: 100%; object-fit: cover; }
    .chat-close { color: rgba(255,255,255,0.7); cursor: pointer; border-radius: 50%; padding: 4px; transition: 0.2s; background: rgba(255,255,255,0.1); font-size: 18px; }
    .chat-close:hover { background: rgba(255,255,255,0.2); color: #fff; }

    .wp-header-white { background: #fff; padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; border-top-left-radius: 12px; border-top-right-radius: 12px; }
    .icon-btn { color: #5f6368; cursor: pointer; font-size: 20px; transition: 0.2s; border-radius: 4px; padding: 4px;}
    .icon-btn:hover { background: #f1f3f4; }

    .wp-search { padding: 12px 16px; position: relative; border-bottom: 1px solid #f1f3f4; background: #fff; }
    .wp-search input { width: 100%; border: none; outline: none; font-size: 13px; color: #202124; padding-left: 28px; }
    .wp-search input::placeholder { color: #9aa0a6; }
    .wp-search .material-symbols-outlined { position: absolute; left: 16px; top: 11px; font-size: 18px; color: #9aa0a6; }

    .wp-section-title { font-size: 11px; font-weight: 700; color: #9aa0a6; padding: 12px 16px 8px; letter-spacing: 0.5px; background: #fff; }
    
    .wp-body-list { flex: 1; overflow-y: auto; padding-bottom: 8px; background: #fff; }
    .chat-list-item { display: flex; align-items: center; padding: 10px 16px; cursor: pointer; transition: background 0.2s; }
    .chat-list-item:hover { background: #f8f9fa; }
    
    .cli-av { width: 40px; height: 40px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; margin-right: 12px; position: relative; flex-shrink: 0; }
    .cli-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .cli-status { position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; }
    .cli-status.online { background: #f59e0b; }
    .cli-status.offline { background: #9ca3af; }
    
    .cli-info { flex: 1; min-width: 0; border-bottom: 1px solid #f1f3f4; padding-bottom: 10px; margin-bottom: -10px; }
    .cli-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
    .cli-name { font-size: 14px; font-weight: 600; color: #202124; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cli-time { font-size: 11px; color: #9aa0a6; flex-shrink: 0; margin-left: 8px; }
    .cli-preview { font-size: 13px; color: #5f6368; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    .chat-icon-btn { color: #6366f1; border: 1px solid #e0e7ff; background: #f5f8ff; border-radius: 6px; padding: 6px; font-size: 18px; margin-left: 12px; transition: background 0.2s; }
    .chat-icon-btn:hover { background: #e0e7ff; }
  `]
})
export class ChatWidgetComponent implements OnInit, OnDestroy {
  @Input() activeWidget: string | null = null;
  @Output() close = new EventEmitter<void>();

  currentUser: any = null;
  conversations: any[] = [];
  channels: any[] = [];
  contacts: any[] = [];
  
  openedChatId: number | null = null;
  openedChatUser: any = null;
  openedChannelId: number | null = null;
  openedChannelName: string = '';
  messages: any[] = [];
  newMessage = '';
  searchQuery = '';

  private pollInterval: any;

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit() {
    this.currentUser = this.auth.user;
    this.startPolling();
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  startPolling() {
    this.pollData();
    this.pollInterval = setInterval(() => this.pollData(), 3000);
  }

    pollData() {
    if (this.activeWidget === 'chat') {
        if (this.openedChatId) {
            this.api.getChatMessages(this.openedChatId).subscribe(res => {
                if (res && res.messages) {
                    this.messages = res.messages;
                    this.openedChatUser = res.other_user;
                }
            });
        } else {
            this.api.getChatConversations().subscribe(res => this.conversations = res);
        }
    } else if (this.activeWidget === 'channels') {
        if (this.openedChannelId) {
            this.api.getChannelMessages(this.openedChannelId).subscribe(res => {
                if (res && res.messages) {
                    this.messages = res.messages;
                }
            });
        } else {
            this.api.getChatChannels().subscribe(res => this.channels = res);
        }
    } else if (this.activeWidget === 'contacts') {
        this.api.getChatContacts().subscribe(res => this.contacts = res);
    }
  }

  filteredConversations() {
      if (!this.searchQuery) return this.conversations;
      const q = this.searchQuery.toLowerCase();
      return this.conversations.filter(c => c.other_user.name.toLowerCase().includes(q));
  }

  filteredChannels() {
      if (!this.searchQuery) return this.channels;
      const q = this.searchQuery.toLowerCase();
      return this.channels.filter(c => c.name.toLowerCase().includes(q));
  }

  filteredContacts() {
      if (!this.searchQuery) return this.contacts;
      const q = this.searchQuery.toLowerCase();
      return this.contacts.filter(c => c.name.toLowerCase().includes(q));
  }

  openWidgetChat(userId: number) {
      this.activeWidget = 'chat';
      this.openChat(userId);
  }

  openChat(userId: number) {
      this.openedChatId = userId;
      this.messages = [];
      this.searchQuery = '';
      this.pollData();
  }

  openChannel(channelId: number, channelName: string) {
      this.openedChannelId = channelId;
      this.openedChannelName = channelName;
      this.messages = [];
      this.searchQuery = '';
      this.pollData();
  }

  closeChannel() {
      this.openedChannelId = null;
      this.openedChannelName = '';
      this.pollData();
  }

  closeChat() {
      this.openedChatId = null;
      this.openedChatUser = null;
      this.pollData();
  }

    sendMessage() {
      if (!this.newMessage.trim()) return;
      if (this.activeWidget === 'chat' && this.openedChatId) {
          this.api.sendChatMessage(this.openedChatId, this.newMessage).subscribe(() => {
              this.newMessage = '';
              this.pollData();
          });
      } else if (this.activeWidget === 'channels' && this.openedChannelId) {
          this.api.sendChannelMessage(this.openedChannelId, this.newMessage).subscribe(() => {
              this.newMessage = '';
              this.pollData();
          });
      }
  }

  getInitials(name: string): string {
      if (!name) return '??';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  isOnline(lastLogin: string | null): boolean {
      if (!lastLogin) return false;
      const diff = (Date.now() - new Date(lastLogin).getTime()) / 60000;
      return diff <= 10;
  }

  formatTime(isoString: string | null): string {
      if (!isoString) return '';
      const d = new Date(isoString);
      return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
}
