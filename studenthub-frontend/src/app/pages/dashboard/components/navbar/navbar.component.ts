import { Component, inject, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { MsalService } from '@azure/msal-angular';
import { User } from '../../../../models/user.model';
import { environment } from '../../../../../environments/environment';
import { Subscription } from 'rxjs';
import {SidebarService} from '../../../../services/sidebar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private msal = inject(MsalService);
  private sub: Subscription | null = null;
  private sidebarService = inject(SidebarService);


  userMenuOpen = signal(false);
  langMenuOpen = signal(false);
  currentLang = signal<'RO' | 'EN'>('RO');
  currentUser = signal<User | null>(null);
  profilePhotoUrl = signal<string | null>(null);
  showHamburger = signal(false);

  ngOnInit(): void {
    this.sub = this.authService.user$.subscribe(user => {
      this.currentUser.set(user);
      if (user?.profilePhotoUrl) {
        const base = environment.apiUrl.replace('/api', '');
        this.profilePhotoUrl.set(`${base}/uploads/${user.profilePhotoUrl}?t=${Date.now()}`);
      } else {
        this.profilePhotoUrl.set(null);
      }
    });
    this.checkMobile();
    window.addEventListener('resize', () => this.checkMobile());
  }

  private checkMobile(): void {
    this.showHamburger.set(window.innerWidth < 768);
  }

  toggleSidebar(): void {
    this.sidebarService.toggle();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get user() {
    // Prioritate: user din DB, fallback: cont MSAL
    if (this.currentUser()) return this.currentUser();

    const account = this.msal.instance.getAllAccounts()[0];
    if (account) {
      const parts = (account.name ?? account.username).split(' ');
      const reordered = parts.length > 1
        ? parts[parts.length - 1] + ' ' + parts.slice(0, -1).join(' ')
        : parts[0];

      return {
        fullName: reordered,
        email: account.username,
        studyType: null,
        section: null,
        year: null,
        isAdmin: false,
        id: 0,
        faculty: null,
        profilePhotoUrl: undefined,
      } as User;
    }
    return null;
  }

  get displayName(): string {
    const name = this.user?.fullName ?? '';
    const parts = name.split(' ');
    if (parts.length <= 2) return name;
    return parts[0][0] + '. ' + parts.slice(1).join(' ');
  }

  get initials(): string {
    const name = this.user?.fullName ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
    this.langMenuOpen.set(false);
  }

  toggleLangMenu(): void {
    this.langMenuOpen.update(v => !v);
    this.userMenuOpen.set(false);
  }

  setLang(lang: 'RO' | 'EN'): void {
    this.currentLang.set(lang);
    this.langMenuOpen.set(false);
    (window as any).triggerTranslate(lang);
  }

  goToProfile(): void {
    this.userMenuOpen.set(false);
    this.router.navigate(['/dashboard/profile']);
  }

  goToEditProfile(): void {
    this.userMenuOpen.set(false);
    this.router.navigate(['/dashboard/profile/edit']);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper') && !target.closest('.lang-menu-wrapper')) {
      this.userMenuOpen.set(false);
      this.langMenuOpen.set(false);
    }
  }
  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
