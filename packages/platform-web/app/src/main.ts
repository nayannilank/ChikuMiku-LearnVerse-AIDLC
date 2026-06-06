import { createHeaderLogo } from './components/HeaderLogo';

const API_BASE = 'http://localhost:3000';

function renderApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // Header
  const header = document.createElement('header');
  header.appendChild(createHeaderLogo({ maxHeight: 36 }));
  app.appendChild(header);

  // Main container
  const container = document.createElement('div');
  container.className = 'app-container';
  app.appendChild(container);

  renderLoginForm(container);
}

function renderLoginForm(container: HTMLElement): void {
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'login-card';

  card.innerHTML = `
    <h2>Sign In</h2>
    <form id="login-form">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" autocomplete="username" required />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required />
      </div>
      <button type="submit" class="login-btn">Log In</button>
    </form>
    <div id="message-area"></div>
  `;

  container.appendChild(card);

  const form = card.querySelector('#login-form') as HTMLFormElement;
  form.addEventListener('submit', handleLogin);
}

async function handleLogin(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const usernameInput = form.querySelector('#username') as HTMLInputElement;
  const passwordInput = form.querySelector('#password') as HTMLInputElement;
  const submitBtn = form.querySelector('.login-btn') as HTMLButtonElement;
  const messageArea = document.getElementById('message-area') as HTMLElement;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showMessage(messageArea, 'Please enter both username and password.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';
  messageArea.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      renderWelcome();
    } else {
      const errorMsg = data.message || data.error || 'Login failed. Please try again.';
      showMessage(messageArea, errorMsg, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Network error. Is the API server running?';
    showMessage(messageArea, errorMsg, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log In';
  }
}

function renderWelcome(): void {
  const container = document.querySelector('.app-container') as HTMLElement;
  if (!container) return;

  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'welcome-card';
  card.innerHTML = `
    <h2>Welcome!</h2>
    <p>You are logged in.</p>
  `;
  container.appendChild(card);
}

function showMessage(area: HTMLElement, text: string, type: 'success' | 'error'): void {
  area.innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', renderApp);
