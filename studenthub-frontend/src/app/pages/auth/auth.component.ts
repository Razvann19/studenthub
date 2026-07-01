import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent {
  private authService = inject(AuthService);

  login(): void {
    if (this.authService.isLoggedIn) {
      this.authService.logout();
    } else {
      this.authService.login();
    }
  }
}
