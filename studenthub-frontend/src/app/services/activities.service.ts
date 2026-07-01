import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Activity {
  id: number;
  name: string;
  emoji: string | null;
}

@Injectable({ providedIn: 'root' })
export class ActivitiesService {
  private http = inject(HttpClient);

  async getAll(): Promise<Activity[]> {
    const response = await firstValueFrom(
      this.http.get<{ success: boolean; data: Activity[] }>(
        `${environment.apiUrl}/Activities`
      )
    );
    return response.success ? response.data : [];
  }
}
