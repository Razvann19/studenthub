import {ApplicationConfig, inject, provideZoneChangeDetection} from '@angular/core';
import { provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MSAL_INSTANCE, MSAL_GUARD_CONFIG, MSAL_INTERCEPTOR_CONFIG, MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { PublicClientApplication, LogLevel, BrowserCacheLocation } from '@azure/msal-browser';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { environment } from '../environments/environment';

export function MSALInstanceFactory(): PublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.msalConfig.clientId,
      authority: `https://login.microsoftonline.com/${environment.msalConfig.tenantId}`,
      redirectUri: environment.msalConfig.redirectUri,
      postLogoutRedirectUri: environment.msalConfig.postLogoutRedirectUri,
    },
    cache: { cacheLocation: BrowserCacheLocation.LocalStorage },
    system: { loggerOptions: { logLevel: LogLevel.Warning } },
  });
}

function initializeApp(authService: AuthService) {
  return () => authService.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: MSAL_INSTANCE, useFactory: MSALInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useValue: {} },
    { provide: MSAL_INTERCEPTOR_CONFIG, useValue: {} },
    MsalService,
    MsalBroadcastService,
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      return authService.initialize();
    }),
  ],
};
