import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getMe(): Promise<User> {
    return firstValueFrom(
      this.http.get<{ data: User }>(`${this.api}/auth/me`).pipe(map(r => r.data))
    );
  }

  completeProfile(body: { studyType: string; faculty: string; year: number; section?: string }): Promise<User> {
    return firstValueFrom(
      this.http.post<{ data: User }>(`${this.api}/auth/complete-profile`, body).pipe(map(r => r.data))
    );
  }
}
