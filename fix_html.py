import re

path = 'c:/Users/Homes247/Desktop/office-suite/frontend/src/app/pages/doc-editor/doc-editor.component.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# I want to find the original full menu-bar
menu_bar_match = re.search(r'<div class="menu-bar" \(mousedown\)="\\.preventDefault\(\)">(.*?)<div class="top-right">', content, re.DOTALL)
if menu_bar_match:
    menu_bar_html = menu_bar_match.group(1)
    
    # Remove trailing </div> that belong to the outer layout
    menu_bar_html = menu_bar_html.rsplit('</div>', 3)[0]
    
    new_header = f'''      <!-- Top Title Bar -->
      <div class="header-bar">
        <div class="header-left">
          <button class="back-btn" (click)="back()" title="Back to Dashboard">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
          <div class="brand-btn" title="Writer">
            <span class="material-symbols-outlined" style="font-size:22px; color: #1a73e8;">description</span>
            <span class="brand-label" style="font-weight:600; font-size:18px; color: #5f6368;">Writer</span>
          </div>
          <div class="title-row" style="margin-left:8px;">
            <input class="title-input" [(ngModel)]="title" (blur)="save()" placeholder="Untitled Document" [style.width.ch]="(title || \\'Untitled Document\\').length + 3" />
            <button class="star-btn" (click)="toggleStar()" title="Star">
              <span class="material-symbols-outlined" [class.filled]="isStarred">{{{{ isStarred ? 'star' : 'star_border' }}}}</span>
            </button>
            <span class="save-status">
              <span class="material-symbols-outlined" style="font-size:15px;">cloud_done</span> 
              {{{{ isSaving ? 'Saving...' : 'Saved' }}}}
            </span>
          </div>
        </div>

        <div class="header-right">
          <span class="collab-badge" *ngIf="activeUsers > 1">
            <span class="material-symbols-outlined" style="font-size:16px;">group</span>
            {{{{ activeUsers }}}}
          </span>
          <button class="share-btn" (click)="shareModalOpen = true; closeMenus()" style="background:#1a73e8; color:#fff; border:none; padding:8px 16px; border-radius:24px; cursor:pointer; font-weight:500; display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:18px;">share</span> Share
          </button>
          
          <div style="position:relative;">
            <button class="header-icon-btn" (click)="toggleMenu('notif', )" title="Notifications" style="background:none; border:none; cursor:pointer; padding:8px; border-radius:50%;"><span class="material-symbols-outlined">notifications</span></button>
            <div class="dropdown notif-dd shadow-lg" *ngIf="activeMenu === 'notif'" (click)=".stopPropagation()">
              <div style="padding:12px; font-weight:600; border-bottom:1px solid #e0e3e8; font-size:12px; color:#5f6368;">NOTIFICATION</div>
              <div style="padding:24px 16px; text-align:center; color:#5f6368; font-size:13px;">You haven't received any notifications yet</div>
            </div>
          </div>
          
          <div style="position:relative;">
            <div class="avatar" (click)="toggleMenu('profile', )" [title]="auth.user?.name ?? ''" style="cursor:pointer; width:36px; height:36px; border-radius:50%; background:#ea4335; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600;">{{{{ initials }}}}</div>
            <div class="dropdown profile-dd shadow-lg" *ngIf="activeMenu === 'profile'" (click)=".stopPropagation()">
              <div style="padding:16px; text-align:center; border-bottom:1px solid #e0e3e8;">
                <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, #667eea, #764ba2); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:600; margin:0 auto 8px;">{{{{ initials }}}}</div>
                <div style="font-weight:600; font-size:14px; color:#202124;">{{{{ auth.user?.email || 'admin@vsnapmail.co.in' }}}}</div>
                <div style="font-size:12px; color:#5f6368; margin-top:2px;">User ID: {{{{ auth.user?.id || 1 }}}}</div>
              </div>
              <div style="padding:8px 0;">
                <div class="dd-item" (click)="auth.logout()">
                  <span class="material-symbols-outlined dd-icon">logout</span>
                  <span class="dd-text">Sign out</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu Bar Row -->
      <div class="menu-bar" (mousedown)=".preventDefault()">{menu_bar_html}
      </div>'''

    content = re.sub(r'<!-- Top Title Bar -->.*?<!-- Formatting Toolbar -->', new_header + '\\n\\n      <!-- Formatting Toolbar -->', content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed successfully!')
else:
    print('Could not find menu_bar_html')
