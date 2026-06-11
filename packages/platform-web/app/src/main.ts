import './styles/home.css';

import { createRouter } from './router/HashRouter';
import { createHomeView } from './views/HomeView';
import { createRegistrationView } from './views/RegistrationView';
import { createForgotPasswordView } from './views/ForgotPasswordView';
import { createResetPasswordView } from './views/ResetPasswordView';

function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  createRouter({
    mountPoint: app,
    routes: [
      {
        pattern: /^$/,
        handler: () => createHomeView(),
      },
      {
        pattern: /^register$/,
        handler: () => createRegistrationView(),
      },
      {
        pattern: /^forgot-password$/,
        handler: () => createForgotPasswordView(),
      },
      {
        pattern: /^reset-password/,
        handler: (params) => createResetPasswordView(params.token || ''),
      },
    ],
    fallback: () => createHomeView(),
  });
}

document.addEventListener('DOMContentLoaded', initApp);
