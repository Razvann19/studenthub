import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LastSeenService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/LastSeen`;

  async updateLastSeen(roomId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.base}/${roomId}`, {}));
    } catch {}
  }

  async getUnreadCounts(): Promise<Record<string, number>> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: Record<string, number> }>(
          `${this.base}/unread-counts`
        )
      );
      return res.success ? res.data : {};
    } catch {
      return {};
    }
  }

  async getRoomInfo(roomId: string): Promise<{ lastSeenAt: string | null }> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: { lastSeenAt: string | null } }>(
          `${this.base}/room-info/${roomId}`
        )
      );
      return res.success ? res.data : { lastSeenAt: null };
    } catch {
      return { lastSeenAt: null };
    }
  }
}
