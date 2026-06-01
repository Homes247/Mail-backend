import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface AuthUser { id: string; name: string; email: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = `${environment.apiUrl}/auth`;
  private _user: AuthUser | null = null;

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('auth_user');
    if (stored) try { this._user = JSON.parse(stored); } catch { }
  }

  get token(): string | null { return localStorage.getItem('auth_token'); }
  get user(): AuthUser | null { return this._user; }
  get isLoggedIn(): boolean { return !!this.token; }

  register(name: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/register`, { name, email, password }).pipe(
      tap((res: any) => this.store(res))
    );
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/login`, { email, password }).pipe(
      tap((res: any) => this.store(res))
    );
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this._user = null;
    this.router.navigate(['/login']);
  }

  private store(res: any) {
    localStorage.setItem('auth_token', res.token);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    this._user = res.user;
  }
}
