export const environment = {
  production: false,
  apiUrl: 'http://localhost:5076/api',
  msalConfig: {
    clientId: '5664b036-83c1-441c-bed5-434a53933c07',
    tenantId: '6bb41fe4-40a3-4a10-b6cd-38278e78b21a',
    redirectUri: 'http://localhost:4200/callback',
    postLogoutRedirectUri: 'http://localhost:4200',
    graphScope: 'https://graph.microsoft.com/User.Read',
  },
  apiScope: 'api://5664b036-83c1-441c-bed5-434a53933c07/access_as_student',
};
