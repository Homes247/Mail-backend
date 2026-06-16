import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ComposeMail, MailCounts, MailDetail, MailResponse } from '../../models/mail.model';

@Injectable({ providedIn: 'root' })
export class MailService {
  private apiUrl = environment.apiUrl;
  private countsSubject = new BehaviorSubject<MailCounts>({ inbox: 0, drafts: 0, trash: 0 });
  counts$ = this.countsSubject.asObservable();

  private refreshSubject = new Subject<void>();
  refresh$ = this.refreshSubject.asObservable();

  triggerRefresh() {
    this.refreshSubject.next();
  }

  constructor(private http: HttpClient) { }

  getCounts(): Observable<MailCounts> {
    return this.http.get<MailCounts>(`${this.apiUrl}/mails/counts`).pipe(
      tap(counts => this.countsSubject.next(counts))
    );
  }

  getInbox(search?: string, page = 1): Observable<MailResponse> {
    let params = new HttpParams().set('page', page);
    if (search) params = params.set('search', search);
    return this.http.get<MailResponse>(`${this.apiUrl}/mails/inbox`, { params });
  }

  getSent(search?: string, page = 1): Observable<MailResponse> {
    let params = new HttpParams().set('page', page);
    if (search) params = params.set('search', search);
    return this.http.get<MailResponse>(`${this.apiUrl}/mails/sent`, { params });
  }

  getDrafts(page = 1): Observable<MailResponse> {
    return this.http.get<MailResponse>(`${this.apiUrl}/mails/drafts`, { params: { page } });
  }

  getTrash(page = 1): Observable<MailResponse> {
    return this.http.get<MailResponse>(`${this.apiUrl}/mails/trash`, { params: { page } });
  }

  getMail(id: number): Observable<MailDetail> {
    return this.http.get<MailDetail>(`${this.apiUrl}/mails/${id}`);
  }

  sendMail(compose: ComposeMail): Observable<any> {
    return this.http.post(`${this.apiUrl}/mails/send`, compose);
  }

  saveDraft(compose: ComposeMail): Observable<any> {
    return this.http.post(`${this.apiUrl}/mails/send`, { ...compose, is_draft: 1 });
  }

  trashMail(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mails/${id}/trash`);
  }

  restoreMail(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/mails/${id}/restore`, {});
  }

  /** Permanently delete a mail that is already in trash */
  deletePermanently(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/mails/${id}/permanent`);
  }

  /** Bulk move mails to trash */
  bulkTrash(ids: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/mails/bulk-trash`, { ids });
  }

  /** Bulk permanently delete mails */
  bulkDeletePermanently(ids: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/mails/bulk-delete`, { ids });
  }

  /** Bulk restore mails from trash */
  bulkRestore(ids: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/mails/bulk-restore`, { ids });
  }

  uploadAttachment(mailId: number, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post(`${this.apiUrl}/mails/${mailId}/upload`, form);
  }

  uploadAttachmentWithProgress(mailId: number, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post(`${this.apiUrl}/mails/${mailId}/upload`, form, {
      reportProgress: true,
      observe: 'events'
    });
  }

  getContacts(search?: string): Observable<any[]> {
    let params = new HttpParams().set('global', 'true');
    if (search) params = params.set('search', search);
    return this.http.get<any[]>(`${this.apiUrl}/users`, { params });
  }
}