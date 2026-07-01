import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private sub: Subscription | null = null;

  user = signal<User | null>(null);
  profilePhoto = signal<string | null>(null);
  loading = signal(true);

  get initials(): string {
    const name = this.user()?.fullName ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  get memberSince(): string {
    const user = this.user();
    if (user?.createdAt) {
      const date = new Date(user.createdAt);
      return date.toLocaleDateString('ro-RO', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    }
    return '—';
  }

  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }

    this.sub = this.authService.user$.subscribe(user => {
      this.user.set(user);
      if (user?.profilePhotoUrl) {
        const base = environment.apiUrl.replace('/api', '');
        this.profilePhoto.set(`${base}/uploads/${user.profilePhotoUrl}?t=${Date.now()}`);
      } else {
        this.profilePhoto.set(null);
      }
    });

    this.loading.set(false);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  goToEdit(): void {
    this.router.navigate(['/dashboard/profile/edit']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
