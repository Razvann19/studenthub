import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'help',
    loadComponent: () => import('./pages/help/help.component').then(m => m.HelpComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms.component').then(m => m.TermsComponent),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy.component').then(m => m.PrivacyComponent),
  },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.component').then(m => m.AuthComponent),
  },
  {
    path: 'callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: 'setup',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/setup/setup.component').then(m => m.SetupComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    children: [
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'profile/edit',
        loadComponent: () => import('./pages/edit-profile/edit-profile.component').then(m => m.EditProfileComponent),
      },
      {
        path: 'cantina',
        loadComponent: () => import('./pages/dashboard/cantina/cantina.component').then(m => m.CantinaComponent),
      },
      {
        path: 'courses',
        loadComponent: () => import('./pages/dashboard/courses/courses.component').then(m => m.CoursesComponent),
      },
      {
        path: 'courses/:id',
        loadComponent: () => import('./pages/dashboard/course-detail/course-detail.component').then(m => m.CourseDetailComponent),
      },
      {
        path: 'activities',
        loadComponent: () => import('./pages/dashboard/activities/activities.component').then(m => m.ActivitiesComponent),
      },
      {
        path: 'activities/:id',
        loadComponent: () => import('./pages/dashboard/activity-chat/activity-chat.component').then(m => m.ActivityChatComponent),
      },
      {
        path: 'nova',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/nova/nova.component').then(m => m.NovaComponent),
      },
    ]
  },
  { path: '**', redirectTo: 'home' },
];
