import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import {SidebarService} from '../../../../services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private authService = inject(AuthService);

  get user() { return this.authService.currentUser; }

  navItems = [
    { icon: '🏠', label: 'Acasă', route: '/dashboard' },
    { icon: '📚', label: 'Cursurile mele', route: '/dashboard/courses' },
    { icon: '📅', label: 'Activități', route: '/dashboard/activities' },
    { icon: '🍽️', label: 'Cantina', route: '/dashboard/cantina' },
  ];

  private sidebarService = inject(SidebarService);
  isOpen = this.sidebarService.isOpen;

  closeOnMobile(): void {
    if (window.innerWidth < 768) {
      this.sidebarService.close();
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
