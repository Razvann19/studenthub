import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AcademicOption {
  id: number;
  value: string;
  years: number;
  order: number;
}

@Injectable({ providedIn: 'root' })
export class AcademicOptionsService {
  private http = inject(HttpClient);

  async getByStudyType(studyType: string): Promise<AcademicOption[]> {
    const response = await firstValueFrom(
      this.http.get<{ success: boolean; data: AcademicOption[] }>(
        `${environment.apiUrl}/AcademicOptions/${studyType}`
      )
    );
    return response.success ? response.data : [];
  }
}
