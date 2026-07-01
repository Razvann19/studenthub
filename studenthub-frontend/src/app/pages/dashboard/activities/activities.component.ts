import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ActivitiesService, Activity } from '../../../services/activities.service';
import { LastSeenService } from '../../../services/last-seen.service';

@Component({
  selector: 'app-activities',
  standalone: true,
  templateUrl: './activities.component.html',
  styleUrl: './activities.component.scss',
})
export class ActivitiesComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private activitiesService = inject(ActivitiesService);
  private lastSeenService = inject(LastSeenService);
  router = inject(Router);
  private pollInterval: any = null;


  unreadCounts = signal<Record<string, number>>({});
  activities = signal<Activity[]>([]);
  loading = signal(true);

  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }
    const activities = await this.activitiesService.getAll();
    this.activities.set(activities);
    this.loading.set(false);

    const counts = await this.lastSeenService.getUnreadCounts();
    this.unreadCounts.set(counts);

    this.pollInterval = setInterval(() => {
      this.lastSeenService.getUnreadCounts().then(counts => {
        this.unreadCounts.set(counts);
      });
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  goToActivity(activity: Activity): void {
    this.router.navigate(['/dashboard/activities', activity.id], {
      state: { name: activity.name }
    });
  }

  getUnreadCount(activityId: number): number {
    return this.unreadCounts()[`activity-${activityId}`] ?? 0;
  }
}
