import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const auth = inject(AuthService);
  return from(auth.getToken()).pipe(
    switchMap(token => {
      console.log('Token for', req.url, ':', token ? 'EXISTS' : 'NULL');
      return next(
        token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req
      );
    })
  );
};
