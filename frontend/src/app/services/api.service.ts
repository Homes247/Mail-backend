import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SyncMessage {
  type: 'update' | 'presence' | 'cursor' | 'cursor_remove';
  content?: string;
  title?: string;
  users?: number;
  client_id?: string;
  r?: number;
  c?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService implements OnDestroy {
  base = environment.apiUrl;
  wsBase = environment.wsUrl;
  private socket: WebSocket | null = null;
  private currentDocId: string | null = null;
  private messageSubject = new Subject<SyncMessage>();

  constructor(private http: HttpClient) { }

  createDocument(title: string, doc_type: string): Observable<any> {
    return this.http.post(`${this.base}/documents/`, { title, doc_type });
  }

  listDocuments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/documents/`);
  }

  getDocument(id: string): Observable<any> {
    return this.http.get(`${this.base}/documents/${id}`);
  }

  saveDocument(id: string, title: string, content: string): Observable<any> {
    return this.http.put(`${this.base}/documents/${id}`, { title, content });
  }

  deleteDocument(id: string): Observable<any> {
    return this.http.delete(`${this.base}/documents/${id}`);
  }

  restoreDocument(id: string): Observable<any> {
    return this.http.put(`${this.base}/documents/${id}`, { is_trashed: 0 });
  }

  shareDocument(docId: string, email: string, permission: string): Observable<any> {
    return this.http.post(`${this.base}/documents/${docId}/share`, { email, permission });
  }

  exportDocument(doc_id: string, format: string, password?: string): Observable<Blob> {
    const payload: any = { doc_id, format };
    if (password) payload.password = password;
    return this.http.post(`${this.base}/export`, payload, { responseType: 'blob' });
  }

  searchUsers(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/auth/search-users?q=${encodeURIComponent(query)}`);
  }

  // CHAT ENDPOINTS
  getChatConversations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/chat/conversations`);
  }

  getChatMessages(userId: number): Observable<any> {
    return this.http.get<any>(`${this.base}/chat/messages/${userId}`);
  }

  sendChatMessage(toUserId: number, message: string): Observable<any> {
    return this.http.post<any>(`${this.base}/chat/send`, { to_user_id: toUserId, message });
  }

  getChatChannels(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/chat/channels`);
  }

  getChannelMessages(channelId: number): Observable<any> {
    return this.http.get<any>(`${this.base}/chat/channels/${channelId}/messages`);
  }

  sendChannelMessage(channelId: number, message: string): Observable<any> {
    return this.http.post<any>(`${this.base}/chat/channels/${channelId}/send`, { message });
  }

  getChatContacts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/chat/contacts`);
  }

  connectSync(docId: string): Observable<SyncMessage> {
    this.disconnectSync();
    this.currentDocId = docId;
    this.socket = new WebSocket(`${this.wsBase}/ws/${docId}`);

    this.socket.onmessage = (event) => {
      try { this.messageSubject.next(JSON.parse(event.data)); } catch { }
    };
    this.socket.onerror = (err) => console.error('WS error', err);
    this.socket.onclose = () => {
      if (this.currentDocId === docId) setTimeout(() => this.connectSync(docId), 3000);
    };
    return this.messageSubject.asObservable();
  }

  sendUpdate(content: string, title: string): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: 'update', content, title }));
  }

  sendCursor(r: number, c: number): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: 'cursor', r, c }));
  }

  disconnectSync(): void {
    this.currentDocId = null;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnectSync();
    this.messageSubject.complete();
  }
}