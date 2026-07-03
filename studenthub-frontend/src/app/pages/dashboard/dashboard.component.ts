import {Component, ElementRef, inject, OnInit, signal, ViewChild} from '@angular/core';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';
import { MsalService } from '@azure/msal-angular';
import {filter, firstValueFrom} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {NovaService} from '../../services/nova.service';
import {FormsModule} from '@angular/forms';
import {SidebarService} from '../../services/sidebar.service';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private msal = inject(MsalService);
  router = inject(Router);
  isHomePage = signal(true)
  private http = inject(HttpClient);
  platformOnlineCount = signal<number>(0);
  private novaService = inject(NovaService);


  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.isHomePage.set(e.url === '/dashboard');
      });
  }
  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }
    await this.loadPlatformCount();
    setInterval(() => this.loadPlatformCount(), 30000);

  }
  async loadPlatformCount(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ count: number }>(`${environment.apiUrl}/Online/platform`)
      );
      this.platformOnlineCount.set(res.count);
    } catch {}
  }

  get user() {
    if (this.authService.currentUser) return this.authService.currentUser;

    const account = this.msal.instance.getAllAccounts()[0];
    if (account) {
      const parts = (account.name ?? account.username).split(' ');
      const fullName = parts.length > 1
        ? parts[parts.length - 1] + ' ' + parts.slice(0, -1).join(' ')
        : parts[0];
      return {
        fullName,
        email: account.username,
        studyType: null,
        section: null,
        year: null,
        isAdmin: false,
        id: 0,
        faculty: null,
      };
    }
    return null;
  }

  getFirstName(): string {
    const name = this.user?.fullName ?? '';
    const parts = name.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  }
  openNova(): void {
    this.router.navigate(['/nova']);
  }
  showNovaPopup = signal(false);

  toggleNova(): void {
    this.showNovaPopup.set(!this.showNovaPopup());
  }

  openNovaFullscreen(): void {
    this.showNovaPopup.set(false);
    this.router.navigate(['/dashboard/nova']);
  }
  isNovaFullscreen(): boolean {
    const url = this.router.url;
    return url.includes('/nova') ||
      url.includes('/cantina') ||
      url.includes('/activities/') ||
      url.includes('/courses/') ;
  }


  popupMessages = signal<{ role: 'user' | 'assistant'; content: string; time: string }[]>([]);
  popupInput = '';
  popupSending = signal(false);
  popupExpired = signal(false);
  private inactivityTimer: any = null;
  private readonly INACTIVITY_MS = 60 * 60 * 1000; // 1 ora

  @ViewChild('popupMessagesList') popupMessagesList!: ElementRef;

  private resetInactivityTimer(): void {
    clearTimeout(this.inactivityTimer);
    this.popupExpired.set(false);
    this.inactivityTimer = setTimeout(() => {
      this.popupMessages.set([]);
      this.popupExpired.set(true);
      setTimeout(() => this.popupExpired.set(false), 5000);
    }, this.INACTIVITY_MS);
  }

  async sendPopupMessage(): Promise<void> {
    const text = this.popupInput.trim();
    if (!text || this.popupSending()) return;

    this.popupMessages.update(m => [...m, {
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    }]);
    this.popupInput = '';
    this.popupSending.set(true);
    this.resetInactivityTimer();

    setTimeout(() => this.scrollPopupToBottom(), 50);

    try {
      const history = this.popupMessages().slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }));
      const response = await this.novaService.chatSimple(text, history);
      this.popupMessages.update(m => [...m, {
        role: 'assistant',
        content: response,
        time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
      }]);
      setTimeout(() => this.scrollPopupToBottom(), 50);
    } finally {
      this.popupSending.set(false);
    }
  }

  onPopupKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendPopupMessage();
    }
  }

  private scrollPopupToBottom(): void {
    try {
      const el = this.popupMessagesList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  private sidebarService = inject(SidebarService);
  sidebarOpen = this.sidebarService.isOpen;

  closeSidebar(): void {
    this.sidebarService.close();
  }
}
