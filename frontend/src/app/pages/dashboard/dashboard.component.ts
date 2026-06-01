import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dash">
      <header class="header">
        <div class="logo">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon" style="color:#2563eb; margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
          Office Suite
        </div>
        <div class="actions">
          <button class="btn btn-ghost" (click)="create('sheet')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm" style="color:#10b981; margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Spreadsheet
          </button>
          <button class="btn btn-ghost" (click)="create('doc')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm" style="color:#3b82f6; margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Document
          </button>
          <button class="btn btn-ghost" (click)="create('slide')">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm" style="color:#f59e0b; margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
            Presentation
          </button>
        </div>
        <div class="user-area">
          <div class="avatar">{{ initials }}</div>
          <span class="uname">{{ auth.user?.name }}</span>
          <button class="btn btn-outline-sm" (click)="auth.logout()">Sign out</button>
        </div>
      </header>

      <main class="main">
        <h2 class="section-title">Your Documents</h2>
        <div class="grid" *ngIf="docs.length > 0; else empty">
          <div class="card" *ngFor="let doc of docs" (click)="open(doc)">
            <div class="card-icon">
              <svg *ngIf="doc.doc_type === 'sheet'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-lg" style="color:#10b981;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              <svg *ngIf="doc.doc_type === 'doc'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-lg" style="color:#3b82f6;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <svg *ngIf="doc.doc_type === 'slide'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-lg" style="color:#f59e0b;"><path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
            </div>
            <div class="card-body">
              <div class="card-name">{{ doc.title }}</div>
              <div class="card-meta">{{ doc.doc_type | titlecase }} · {{ formatDate(doc.updated_at) }}</div>
            </div>
            <div class="card-actions" (click)="$event.stopPropagation()">
              <button class="icon-btn" title="Copy shareable link" (click)="copyLink(doc)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
              </button>
              <button class="icon-btn del" title="Delete" (click)="delete(doc)">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="icon-sm"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        </div>
        <ng-template #empty>
          <div class="empty">
            <p>No documents yet.</p>
            <p>Create one using the buttons above.</p>
          </div>
        </ng-template>
      </main>

      <div class="toast" [class.show]="toastVisible">{{ toastMsg }}</div>
    </div>
  `,
  styles: [`
    .dash { min-height: 100vh; background: #f7f8fc; }
    .header {
      display: flex; align-items: center; gap: 16px;
      padding: 0 32px; height: 60px;
      background: #fff; border-bottom: 1px solid #e5e7eb;
      position: sticky; top: 0; z-index: 10;
    }
    .logo { font-size: 18px; font-weight: 700; color: #111; margin-right: 8px; white-space: nowrap; }
    .actions { display: flex; gap: 8px; flex: 1; }
    .user-area { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; background: #2563eb;
      color: #fff; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .uname { font-size: 14px; font-weight: 500; color: #374151; }

    .btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: all .15s; }
    .btn-ghost { background: #f3f4f6; color: #374151; }
    .btn-ghost:hover { background: #e5e7eb; }
    .btn-outline-sm { background: #fff; color: #6b7280; border: 1px solid #e5e7eb; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-outline-sm:hover { border-color: #d1d5db; color: #374151; }

    .main { max-width: 960px; margin: 0 auto; padding: 40px 24px; }
    .section-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #111; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .card {
      background: #fff; border-radius: 12px; padding: 16px 20px;
      display: flex; align-items: center; gap: 14px;
      cursor: pointer; border: 1px solid #e5e7eb;
      transition: box-shadow .15s, border-color .15s;
    }
    .card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); border-color: #d1d5db; }
    .card-icon { font-size: 28px; flex-shrink: 0; }
    .card-body { flex: 1; min-width: 0; }
    .card-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-meta { font-size: 12px; color: #9ca3af; margin-top: 3px; }
    .card-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 6px; opacity: 0.6; transition: opacity .15s, background .15s; }
    .icon-btn:hover { opacity: 1; background: #f3f4f6; }
    .icon-btn.del:hover { background: #fee2e2; }

    .empty { text-align: center; padding: 80px 0; color: #9ca3af; font-size: 15px; line-height: 2; }

    .toast {
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: #111; color: #fff; padding: 10px 24px; border-radius: 8px;
      font-size: 14px; opacity: 0; transition: all .25s; pointer-events: none;
    }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .icon { width: 22px; height: 22px; display: inline-block; vertical-align: middle; }
    .icon-sm { width: 16px; height: 16px; display: inline-block; vertical-align: middle; }
    .icon-lg { width: 28px; height: 28px; display: inline-block; vertical-align: middle; }
    .btn-ghost { display: flex; align-items: center; }
    .logo { display: flex; align-items: center; }
    .icon-btn { display: flex; align-items: center; justify-content: center; }
  `]
})
export class DashboardComponent implements OnInit {
  docs: any[] = [];
  toastVisible = false;
  toastMsg = '';

  get initials() {
    return (this.auth.user?.name ?? 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {}

  ngOnInit() { this.load(); }

  load() { this.api.listDocuments().subscribe(d => this.docs = d); }

  create(type: string) {
    this.api.createDocument('Untitled', type).subscribe((doc: any) => {
      this.router.navigate([`/${doc.doc_type}/${doc.id}`]);
    });
  }

  open(doc: any) { this.router.navigate([`/${doc.doc_type}/${doc.id}`]); }

  delete(doc: any) {
    this.api.deleteDocument(doc.id).subscribe(() => this.load());
  }

  copyLink(doc: any) {
    const url = `${window.location.origin}/${doc.doc_type}/${doc.id}`;
    navigator.clipboard.writeText(url).then(() => this.showToast('Link copied! Share it with anyone.'));
  }

  formatDate(d: string) {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  showToast(msg: string) {
    this.toastMsg = msg; this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 2500);
  }
}