import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicOptionsService, AcademicOption } from '../../services/academic-options.service';
import {AuthService} from '../../services/auth.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private academicOptionsService = inject(AcademicOptionsService);
  private authService = inject(AuthService);

  tipStudiu = '';
  sectie = '';
  an = '';

  sectiiDisponibile = signal<string[]>([]);
  aniDisponibili = signal<string[]>([]);
  private academicOptions: AcademicOption[] = [];

  loading = signal(false);
  loadingOptions = signal(true);
  error = signal('');

  get anIndex(): number {
    const romani: Record<string, number> = {
      'Anul I': 1, 'Anul II': 2, 'Anul III': 3,
      'Anul IV': 4, 'Anul V': 5, 'Anul VI': 6
    };
    return romani[this.an] ?? 0;
  }

  get isFormValid(): boolean {
    return !!this.tipStudiu && !!this.sectie && !!this.an;
  }

  async ngOnInit(): Promise<void> {
    this.loadingOptions.set(false);
  }

  async onTipStudiuChange(): Promise<void> {
    this.sectie = '';
    this.an = '';
    this.aniDisponibili.set([]);
    this.loadingOptions.set(true);
    this.academicOptions = await this.academicOptionsService.getByStudyType(this.tipStudiu);
    this.sectiiDisponibile.set(this.academicOptions.map(o => o.value));
    this.loadingOptions.set(false);
  }

  onSectionChange(): void {
    this.an = '';
    const selectedOption = this.academicOptions.find(o => o.value === this.sectie);
    if (selectedOption) {
      const romani = ['I', 'II', 'III', 'IV', 'V', 'VI'];
      const ani = Array.from({ length: selectedOption.years }, (_, i) => `Anul ${romani[i]}`);
      this.aniDisponibili.set(ani);
    } else {
      this.aniDisponibili.set([]);
    }
  }

  async submit(): Promise<void> {
    if (!this.isFormValid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(
          `${environment.apiUrl}/auth/complete-profile`,
          {
            studyType: this.tipStudiu,
            faculty: 'Automatică și Calculatoare',
            year: this.anIndex,
            section: this.sectie,
          }
        )
      );

      if (response.success) {
        await this.authService.syncUser(false);
        this.router.navigate(['/dashboard']);
      } else {
        this.error.set(response.message ?? 'A apărut o eroare.');
      }
    } catch {
      this.error.set('A apărut o eroare. Încearcă din nou.');
    } finally {
      this.loading.set(false);
    }
  }
}
