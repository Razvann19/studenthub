import {Component, inject} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  private router = inject(Router);

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
