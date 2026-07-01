import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface HomeCard {
  id: number;
  section: string;
  icon: string;
  title: string;
  description: string;
  color: string | null;
  order: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  private location = inject(Location);
  private http = inject(HttpClient);

  problems: HomeCard[] = [];
  features: HomeCard[] = [];

  ngOnInit(): void {
    this.location.replaceState('/home');
    this.loadCards();
  }

  private async loadCards(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ success: boolean; data: HomeCard[] }>(
          `${environment.apiUrl}/HomeCard`
        )
      );
      if (response.success) {
        this.problems = response.data.filter(c => c.section === 'problems');
        this.features = response.data.filter(c => c.section === 'features');
      }
    } catch (e) {
      console.error('Nu s-au putut încărca cardurile:', e);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/auth']);
  }
  goTo(path: string): void {
    this.router.navigate([path]);
  }
}
