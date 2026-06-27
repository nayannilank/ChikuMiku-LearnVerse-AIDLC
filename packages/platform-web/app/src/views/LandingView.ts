/**
 * LandingView — Welcome/landing page for the LearnVerse web application.
 *
 * Displays a hero section with headline, feature cards, subject pills,
 * and CTA buttons. Uses the ChikuMiku LearnVerse design system tokens.
 *
 * Usage:
 *   import { createLandingView } from './views/LandingView';
 *   document.getElementById('app')!.appendChild(createLandingView());
 */

import { createHeaderLogo } from '../components/HeaderLogo';

/** Feature card data for the features grid. */
interface FeatureCard {
  emoji: string;
  title: string;
  description: string;
}

const FEATURES: FeatureCard[] = [
  {
    emoji: '📚',
    title: '7 Subjects',
    description: 'English, Hindi, Kannada, Maths, Science, Computers & EVS — all in one place.',
  },
  {
    emoji: '🗣️',
    title: 'Pronunciation',
    description: 'AI-powered pronunciation practice for English, Hindi, and Kannada words.',
  },
  {
    emoji: '📷',
    title: 'Scan Textbooks',
    description: 'Point your camera at any textbook page and get instant AI explanations.',
  },
  {
    emoji: '🧠',
    title: 'Quizzes & Revision',
    description: 'Smart quizzes that adapt to your child\'s learning pace and progress.',
  },
];

const SUBJECTS = ['English', 'Hindi', 'Kannada', 'Maths', 'Science', 'Computers', 'EVS'];

const SUBJECT_COLORS: Record<string, string> = {
  English: '#5DADE2',
  Hindi: '#F7C948',
  Kannada: '#9B59B6',
  Maths: '#E94F9B',
  Science: '#4ECDC4',
  Computers: '#4A6CF7',
  EVS: '#27AE60',
};

/**
 * Creates the complete landing page view element.
 *
 * @returns An HTMLElement representing the full landing page.
 */
export function createLandingView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'landing-view';
  Object.assign(container.style, {
    minHeight: '100vh',
    backgroundColor: '#F8F5FF',
    display: 'flex',
    flexDirection: 'column',
  });

  // --- Header ---
  const header = document.createElement('header');
  header.className = 'landing-view__header';
  header.setAttribute('aria-label', 'Site header');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '56px',
    padding: '0 24px',
    backgroundColor: '#2C2341',
    boxSizing: 'border-box',
    flexShrink: '0',
  });

  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 36,
    altText: 'ChikuMiku LearnVerse',
  });
  header.appendChild(logo);

  // Nav links on the right
  const navLinks = document.createElement('nav');
  navLinks.setAttribute('aria-label', 'Primary navigation');
  Object.assign(navLinks.style, {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  });

  const loginLink = createNavLink('Login', '#login');
  const registerLink = createNavLink('Register', '#register');
  navLinks.appendChild(loginLink);
  navLinks.appendChild(registerLink);
  header.appendChild(navLinks);

  container.appendChild(header);

  // --- Hero Section ---
  const hero = document.createElement('section');
  hero.className = 'landing-view__hero';
  hero.setAttribute('aria-label', 'Welcome');
  Object.assign(hero.style, {
    textAlign: 'center',
    padding: '3rem 1.5rem 2rem',
    maxWidth: '700px',
    margin: '0 auto',
  });

  const headline = document.createElement('h1');
  headline.textContent = 'Where Curiosity Comes Alive \u2728';
  Object.assign(headline.style, {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#2C2341',
    margin: '0 0 1rem 0',
    lineHeight: '1.2',
  });
  hero.appendChild(headline);

  const subtitle = document.createElement('p');
  subtitle.textContent =
    'ChikuMiku LearnVerse is an AI-powered learning platform designed for children in classes 1\u20135. ' +
    'Interactive lessons, pronunciation practice, textbook scanning, and smart quizzes \u2014 all in 7 subjects.';
  Object.assign(subtitle.style, {
    fontSize: '1rem',
    color: '#6B7280',
    lineHeight: '1.6',
    margin: '0 0 2rem 0',
    maxWidth: '560px',
    marginLeft: 'auto',
    marginRight: 'auto',
  });
  hero.appendChild(subtitle);

  // CTA Buttons
  const ctaRow = document.createElement('div');
  Object.assign(ctaRow.style, {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  });

  const registerCta = createCtaButton('Get Started \u2014 Register', '#register', true);
  const loginCta = createCtaButton('Login', '#login', false);
  ctaRow.appendChild(registerCta);
  ctaRow.appendChild(loginCta);
  hero.appendChild(ctaRow);

  container.appendChild(hero);

  // --- Features Grid ---
  const featuresSection = document.createElement('section');
  featuresSection.className = 'landing-view__features';
  featuresSection.setAttribute('aria-label', 'Features');
  Object.assign(featuresSection.style, {
    padding: '2rem 1.5rem',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  });

  const featuresGrid = document.createElement('div');
  Object.assign(featuresGrid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.25rem',
  });

  for (const feature of FEATURES) {
    featuresGrid.appendChild(createFeatureCard(feature));
  }
  featuresSection.appendChild(featuresGrid);
  container.appendChild(featuresSection);

  // --- Subject Pills ---
  const subjectsSection = document.createElement('section');
  subjectsSection.className = 'landing-view__subjects';
  subjectsSection.setAttribute('aria-label', 'Subjects covered');
  Object.assign(subjectsSection.style, {
    padding: '1.5rem',
    textAlign: 'center',
  });

  const subjectsTitle = document.createElement('h2');
  subjectsTitle.textContent = 'Subjects We Cover';
  Object.assign(subjectsTitle.style, {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#2C2341',
    marginBottom: '1rem',
  });
  subjectsSection.appendChild(subjectsTitle);

  const pillsRow = document.createElement('div');
  Object.assign(pillsRow.style, {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '0.75rem',
  });

  for (const subject of SUBJECTS) {
    const pill = document.createElement('span');
    pill.textContent = subject;
    const color = SUBJECT_COLORS[subject] || '#9B59B6';
    Object.assign(pill.style, {
      display: 'inline-block',
      padding: '0.4rem 1rem',
      borderRadius: '20px',
      fontSize: '0.85rem',
      fontWeight: '600',
      color: color,
      backgroundColor: `${color}18`,
      border: `1px solid ${color}40`,
    });
    pillsRow.appendChild(pill);
  }
  subjectsSection.appendChild(pillsRow);
  container.appendChild(subjectsSection);

  return container;
}

// --- Helper Functions ---

function createNavLink(text: string, href: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.textContent = text;
  link.href = href;
  Object.assign(link.style, {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    padding: '6px 16px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    transition: 'background-color 0.2s, border-color 0.2s',
    cursor: 'pointer',
  });
  link.addEventListener('mouseenter', () => {
    link.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    link.style.borderColor = 'rgba(255, 255, 255, 0.7)';
  });
  link.addEventListener('mouseleave', () => {
    link.style.backgroundColor = 'transparent';
    link.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  });
  link.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = href;
  });
  return link;
}

function createCtaButton(text: string, href: string, isPrimary: boolean): HTMLAnchorElement {
  const btn = document.createElement('a');
  btn.textContent = text;
  btn.href = href;
  btn.setAttribute('role', 'button');

  if (isPrimary) {
    Object.assign(btn.style, {
      display: 'inline-block',
      padding: '0.75rem 2rem',
      fontSize: '1rem',
      fontWeight: '600',
      color: '#FFFFFF',
      backgroundColor: '#E94F9B',
      borderRadius: '22px',
      textDecoration: 'none',
      border: 'none',
      cursor: 'pointer',
      transition: 'background-color 0.2s, transform 0.1s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#d4408a';
      btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = '#E94F9B';
      btn.style.transform = 'translateY(0)';
    });
  } else {
    Object.assign(btn.style, {
      display: 'inline-block',
      padding: '0.75rem 2rem',
      fontSize: '1rem',
      fontWeight: '600',
      color: '#2C2341',
      backgroundColor: 'transparent',
      borderRadius: '22px',
      textDecoration: 'none',
      border: '2px solid #2C2341',
      cursor: 'pointer',
      transition: 'background-color 0.2s, color 0.2s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#2C2341';
      btn.style.color = '#FFFFFF';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'transparent';
      btn.style.color = '#2C2341';
    });
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = href;
  });

  return btn;
}

function createFeatureCard(feature: FeatureCard): HTMLElement {
  const card = document.createElement('div');
  Object.assign(card.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    textAlign: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
  });
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
  });

  const emoji = document.createElement('div');
  emoji.textContent = feature.emoji;
  emoji.setAttribute('aria-hidden', 'true');
  Object.assign(emoji.style, {
    fontSize: '2rem',
    marginBottom: '0.75rem',
  });
  card.appendChild(emoji);

  const title = document.createElement('h3');
  title.textContent = feature.title;
  Object.assign(title.style, {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#2C2341',
    margin: '0 0 0.5rem 0',
  });
  card.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = feature.description;
  Object.assign(desc.style, {
    fontSize: '0.85rem',
    color: '#6B7280',
    lineHeight: '1.5',
    margin: '0',
  });
  card.appendChild(desc);

  return card;
}
