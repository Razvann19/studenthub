import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { AcademicOptionsService, AcademicOption } from '../../services/academic-options.service';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss',
})
export class EditProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private academicOptionsService = inject(AcademicOptionsService);

  studyType = '';
  section = '';
  an = '';
  faculty = 'Automatică și Calculatoare';

  sectiiDisponibile = signal<string[]>([]);
  aniDisponibili = signal<string[]>([]);
  private academicOptions: AcademicOption[] = [];

  currentPhotoUrl = signal<string | null>(null);
  previewPhotoUrl = signal<string | null>(null);
  selectedFile: File | null = null;

  loading = signal(false);
  saving = signal(false);
  uploadingPhoto = signal(false);
  error = signal('');
  success = signal('');

  resetPasswordUrl = 'https://student.upt.ro/docs/Instructiuni%20resetare%20parola%20cont-UPT.pdf';

  get anIndex(): number {
    const romani: Record<string, number> = {
      'Anul I': 1, 'Anul II': 2, 'Anul III': 3,
      'Anul IV': 4, 'Anul V': 5, 'Anul VI': 6
    };
    return romani[this.an] ?? 0;
  }

  get initials(): string {
    const name = this.authService.currentUser?.fullName ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }
    const user = this.authService.currentUser;
    if (user) {
      this.studyType = user.studyType ?? '';
      this.section = user.section ?? '';
      this.faculty = user.faculty ?? 'Automatică și Calculatoare';

      const aniMap: Record<number, string> = {
        1: 'Anul I',
        2: 'Anul II',
        3: 'Anul III',
        4: 'Anul IV',
        5: 'Anul V',
        6: 'Anul VI'
      };
      this.an = user.year ? (aniMap[user.year] ?? '') : '';

      if (user.profilePhotoUrl) {
        const base = environment.apiUrl.replace('/api', '');
        this.currentPhotoUrl.set(`${base}/uploads/${user.profilePhotoUrl}`);
      }

      if (this.studyType) {
        await this.loadAcademicOptions(this.studyType);
        if (this.section) {
          this.updateAni();
        }
      }
    }
    this.loading.set(false);
  }

  private async loadAcademicOptions(studyType: string): Promise<void> {
    this.academicOptions = await this.academicOptionsService.getByStudyType(studyType);
    this.sectiiDisponibile.set(this.academicOptions.map(o => o.value));
  }

  private updateAni(): void {
    const selectedOption = this.academicOptions.find(o => o.value === this.section);
    if (selectedOption) {
      const romani = ['I', 'II', 'III', 'IV', 'V', 'VI'];
      const ani = Array.from({ length: selectedOption.years }, (_, i) => `Anul ${romani[i]}`);
      this.aniDisponibili.set(ani);
    } else {
      this.aniDisponibili.set([]);
    }
  }

  async onTipStudiuChange(): Promise<void> {
    this.section = '';
    this.an = '';
    this.aniDisponibili.set([]);
    await this.loadAcademicOptions(this.studyType);
  }

  onSectionChange(): void {
    this.an = '';
    this.updateAni();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const maxMb = 5;

    if (file.size > maxMb * 1024 * 1024) {
      this.error.set(`Poza depășește ${maxMb}MB.`);
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.error.set('Doar fișiere JPG, PNG sau WEBP.');
      return;
    }

    this.selectedFile = file;
    this.error.set('');

    const reader = new FileReader();
    reader.onload = (e) => this.previewPhotoUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async uploadPhoto(): Promise<void> {
    if (!this.selectedFile) return;

    this.uploadingPhoto.set(true);
    this.error.set('');

    try {
      const formData = new FormData();
      formData.append('file', this.selectedFile);

      const response = await firstValueFrom(
        this.http.post<{ success: boolean; data: { url: string } }>(
          `${environment.apiUrl}/ProfilePhoto/upload`,
          formData
        )
      );

      if (response.success) {
        const base = environment.apiUrl.replace('/api', '');
        this.currentPhotoUrl.set(`${base}${response.data.url}?t=${Date.now()}`);
        this.previewPhotoUrl.set(null);
        this.selectedFile = null;
        this.success.set('Poza actualizată cu succes!');
        await this.authService.syncUser(false);
        setTimeout(() => this.success.set(''), 3000);
      }
    } catch {
      this.error.set('Eroare la încărcarea pozei.');
    } finally {
      this.uploadingPhoto.set(false);
    }
  }

  async removePhoto(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/ProfilePhoto`)
      );
      this.currentPhotoUrl.set(null);
      this.previewPhotoUrl.set(null);
      await this.authService.syncUser(false);
    } catch {
      this.error.set('Eroare la ștergerea pozei.');
    }
  }

  async saveProfile(): Promise<void> {
    if (!this.studyType || !this.section || !this.an) {
      this.error.set('Completează toate câmpurile.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.http.put<{ success: boolean; data: any }>(
          `${environment.apiUrl}/auth/update-profile`,
          {
            studyType: this.studyType,
            faculty: this.faculty,
            year: this.anIndex,
            section: this.section,
          }
        )
      );

      if (response.success) {
        await this.authService.syncUser(false);
        this.success.set('Profil salvat cu succes!');
        setTimeout(() => this.success.set(''), 3000);
      }
    } catch {
      this.error.set('Eroare la salvarea profilului.');
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/profile']);
  }

  openResetPassword(): void {
    window.open(this.resetPasswordUrl, '_blank');
  }
}
