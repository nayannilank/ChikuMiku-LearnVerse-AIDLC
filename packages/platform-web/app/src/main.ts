import './styles/home.css';

import { createHeader } from './components/Header';
import { createBackgroundWatermark } from './components/BackgroundWatermark';
import { createLoginCard } from './components/LoginCard';
import { loginUser } from './services/AuthService';

function renderApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // Header with register navigation
  const header = createHeader({
    onRegisterClick: () => {
      window.location.hash = '#register';
    },
  });
  app.appendChild(header);

  // Background watermark (decorative)
  const watermark = createBackgroundWatermark();
  app.appendChild(watermark);

  // Main content container
  const main = document.createElement('div');
  main.className = 'main-content';

  // Login card with forgot-password navigation and submission handler
  const loginCard = createLoginCard({
    onForgotPassword: () => {
      window.location.hash = '#forgot-password';
    },
    onSubmit: async (username: string, password: string): Promise<void> => {
      const result = await loginUser(username, password);
      if (result.success) {
        // Render a simple welcome state on successful login
        main.innerHTML = '';
        const welcomeCard = document.createElement('div');
        welcomeCard.className = 'welcome-card';
        welcomeCard.innerHTML = `
          <h2>Welcome!</h2>
          <p>You are logged in.</p>
        `;
        main.appendChild(welcomeCard);
      } else {
        throw new Error(result.error || 'Login failed. Please try again.');
      }
    },
  });

  main.appendChild(loginCard);
  app.appendChild(main);
}

document.addEventListener('DOMContentLoaded', renderApp);
