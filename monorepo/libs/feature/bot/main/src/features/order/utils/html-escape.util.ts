/**
 * HTML Escape Utility
 *
 * Prevents XSS attacks by escaping HTML special characters in user input
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (!text) {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape HTML in object properties recursively
 */
export function escapeHtmlInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return escapeHtml(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => escapeHtmlInObject(item)) as unknown as T;
  }

  if (obj && typeof obj === 'object') {
    const escaped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      escaped[key] = escapeHtmlInObject(value);
    }

    return escaped as T;
  }

  return obj;
}
