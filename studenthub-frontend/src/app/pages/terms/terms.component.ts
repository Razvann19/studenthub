import {Component, inject} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
})
export class TermsComponent {
  private router = inject(Router);

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
