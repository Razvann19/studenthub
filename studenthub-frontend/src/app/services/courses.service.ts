import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Course {
  id: number;
  name: string;
  shortName: string | null;
}

@Injectable({ providedIn: 'root' })
export class CoursesService {
  private http = inject(HttpClient);

  async getMyCourses(): Promise<Course[]> {
    const response = await firstValueFrom(
      this.http.get<{ success: boolean; data: Course[] }>(
        `${environment.apiUrl}/Courses/my`
      )
    );
    return response.success ? response.data : [];
  }
}
