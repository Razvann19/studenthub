import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CoursesService, Course } from '../../../services/courses.service';
import {LastSeenService} from '../../../services/last-seen.service';

@Component({
  selector: 'app-courses',
  standalone: true,
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.scss',
})
export class CoursesComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  router = inject(Router);
  private lastSeenService = inject(LastSeenService);
  unreadCounts = signal<Record<string, number>>({});
  private pollInterval: any = null;


  courses = signal<Course[]>([]);
  loading = signal(true);

  get user() { return this.authService.currentUser; }

  get sectionLabel(): string {
    const user = this.user;
    if (!user?.section || !user?.year) return '';
    const romani = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    return `${user.section} — Anul ${romani[(user.year ?? 1) - 1]}`;
  }

  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }
    const courses = await this.coursesService.getMyCourses();
    this.courses.set(courses);
    this.loading.set(false);
    await this.loadUnreadCounts();
    this.pollInterval = setInterval(() => {
      this.loadUnreadCounts();
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  async loadUnreadCounts(): Promise<void> {
    const counts = await this.lastSeenService.getUnreadCounts();
    this.unreadCounts.set(counts);
  }

  getUnreadCount(courseId: number): number {
    return this.unreadCounts()[`course-${courseId}`] ?? 0;
  }

  goToEditProfile(): void {
    this.router.navigate(['/dashboard/profile/edit']);
  }
  goToCourse(course: Course): void {
    this.router.navigate(['/dashboard/courses', course.id], {
      state: { name: course.name }
    });
  }
  getShortName(course: Course): string {
    return course.shortName || course.name.slice(0, 3).toUpperCase();
  }
}
