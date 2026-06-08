/**
 * Escapes HTML special characters in a string to prevent XSS attacks.
 *
 * Uses the browser's built-in DOM text encoding to safely escape
 * user-provided or API-provided strings before inserting into DOM.
 *
 * @param str - The raw string to escape
 * @returns The HTML-escaped string safe for use in innerHTML
 */
export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
