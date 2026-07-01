import { Injectable, inject, signal } from '@angular/core';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { InteractionStatus, EventType } from '@azure/msal-browser';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, SyncResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private msal = inject(MsalService);
  private msalBroadcast = inject(MsalBroadcastService);
  private http = inject(HttpClient);
  private router = inject(Router);

  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();
  isReady = signal(false);

  get currentUser(): User | null { return this.userSubject.value; }
  get isLoggedIn(): boolean { return this.msal.instance.getAllAccounts().length > 0; }

  async initialize(): Promise<void> {
    await this.msal.instance.initialize();

    // Proceseaza redirect-ul o singura data
    const redirectResult = await this.msal.instance.handleRedirectPromise();

    if (redirectResult?.account) {
      // Tocmai a venit de la Microsoft cu succes
      this.msal.instance.setActiveAccount(redirectResult.account);
      await this.syncUser(true);
    }

    this.isReady.set(true);
  }

  login(): void {
    this.msal.loginRedirect({
      scopes: ['openid', 'profile', 'email', environment.apiScope]
    });
  }

  logout(): void {
    this.userSubject.next(null);

    // Curata conturile din MSAL local fara redirect la Microsoft
    const accounts = this.msal.instance.getAllAccounts();
    accounts.forEach(account => {
      this.msal.instance.clearCache();
    });

    // Redirect direct la home
    window.location.href = '/home';
  }

  async getToken(): Promise<string | null> {
    const account = this.msal.instance.getAllAccounts()[0];
    if (!account) return null;
    try {
      const result = await this.msal.instance.acquireTokenSilent({
        scopes: [environment.apiScope], account
      });
      return result.accessToken;
    } catch {
      this.login();
      return null;
    }
  }

  async syncUser(shouldNavigate = true): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; data: SyncResponse }>(
          `${environment.apiUrl}/auth/sync`, {}
        )
      );
      if (response.success) {
        const user = response.data.user;
        // Reordoneaza numele: Prenume Nume → Nume Prenume
        if (user.fullName) {
          const parts = user.fullName.split(' ');
          user.fullName = parts.length > 1
            ? parts[parts.length - 1] + ' ' + parts.slice(0, -1).join(' ')
            : user.fullName;
        }
        this.userSubject.next(user);
        if (shouldNavigate) {
          response.data.isFirstLogin
            ? this.router.navigate(['/setup'])
            : this.router.navigate(['/dashboard']);
        }
      }
    } catch (e) {
      console.error('Sync failed', e);
    }
  }
}
