/**
 * BrandingPanel — Framework-agnostic branding panel component.
 *
 * Creates an HTMLElement displaying the ChikuMiku LearnVerse brand identity
 * with a title, subtitle, stat badges, and a logo watermark. Used as the
 * left panel in the two-panel login layout.
 *
 * Usage:
 *   import { createBrandingPanel } from './components/BrandingPanel';
 *   document.body.appendChild(createBrandingPanel());
 *
 * Validates: Requirements 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5
 */

/**
 * Creates a branding panel DOM element for the login view.
 *
 * The returned element contains:
 * - Title "ChikuMiku LearnVerse" (26px Bold #2C2341)
 * - Subtitle "Where Curiosity Comes Alive ✨"
 * - Three stat badges: "7+ Subjects", "LKG-12 Grades", "AI Powered"
 * - A logo watermark (75% width, 5% opacity, centered, pointer-events: none)
 *
 * The watermark image has an error handler that hides its container if the
 * image fails to load, ensuring graceful degradation.
 *
 * @returns An HTMLElement suitable for insertion as the left branding panel.
 */
export function createBrandingPanel(): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'branding-panel';
  panel.setAttribute('aria-label', 'Brand information');

  // Watermark container (Req 4.1, 4.2, 4.3, 4.4, 4.5)
  const watermark = document.createElement('div');
  watermark.className = 'watermark';
  Object.assign(watermark.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '75%',
    opacity: '0.05',
    pointerEvents: 'none',
    zIndex: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const watermarkImg = document.createElement('img');
  watermarkImg.src = '/ChikuMiku-LearnVerse-Logo.png';
  watermarkImg.alt = '';
  watermarkImg.setAttribute('aria-hidden', 'true');
  Object.assign(watermarkImg.style, {
    width: '100%',
    height: 'auto',
    objectFit: 'contain',
  });

  // Handle watermark image error by hiding the container (Req 4.5)
  watermarkImg.addEventListener('error', () => {
    watermark.style.display = 'none';
  });

  watermark.appendChild(watermarkImg);
  panel.appendChild(watermark);

  // Content container (above watermark in z-index)
  const content = document.createElement('div');
  Object.assign(content.style, {
    position: 'relative',
    zIndex: '1',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  });

  // Title (Req 2.3)
  const title = document.createElement('h1');
  title.className = 'branding-title';
  title.textContent = 'ChikuMiku LearnVerse';
  Object.assign(title.style, {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#2C2341',
    margin: '0',
  });
  content.appendChild(title);

  // Subtitle (Req 2.4)
  const subtitle = document.createElement('p');
  subtitle.className = 'branding-subtitle';
  subtitle.textContent = 'Where Curiosity Comes Alive ✨';
  Object.assign(subtitle.style, {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0',
  });
  content.appendChild(subtitle);

  // Stat badges container (Req 2.5)
  const badgesContainer = document.createElement('div');
  badgesContainer.className = 'branding-badges';
  Object.assign(badgesContainer.style, {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  });

  const badges = ['7+ Subjects', 'LKG-12 Grades', 'AI Powered'];
  for (const badgeText of badges) {
    const badge = document.createElement('span');
    badge.className = 'branding-badge';
    badge.textContent = badgeText;
    Object.assign(badge.style, {
      padding: '6px 14px',
      borderRadius: '16px',
      backgroundColor: 'rgba(155, 89, 182, 0.1)',
      color: '#9B59B6',
      fontSize: '12px',
      fontWeight: '600',
    });
    badgesContainer.appendChild(badge);
  }
  content.appendChild(badgesContainer);

  panel.appendChild(content);

  return panel;
}
