/**
 * HTML Escape Utility Tests
 */

import { escapeHtml, escapeHtmlInObject } from '../utils/html-escape.util';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    const input = '<script>alert("XSS")</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';

    expect(escapeHtml(input)).toBe(expected);
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape quotes', () => {
    expect(escapeHtml('Say "Hello"')).toBe('Say &quot;Hello&quot;');
    expect(escapeHtml("It's mine")).toBe('It&#039;s mine');
  });

  it('should handle empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle already escaped strings', () => {
    const input = '&lt;div&gt;';
    const expected = '&amp;lt;div&amp;gt;';

    expect(escapeHtml(input)).toBe(expected);
  });
});

describe('escapeHtmlInObject', () => {
  it('should escape strings in objects', () => {
    const input = {
      name: '<script>alert("XSS")</script>',
      title: 'Test & Demo',
    };

    const result = escapeHtmlInObject(input);

    expect(result.name).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(result.title).toBe('Test &amp; Demo');
  });

  it('should escape strings in arrays', () => {
    const input = ['<div>', 'Tom & Jerry', '"quoted"'];

    const result = escapeHtmlInObject(input);

    expect(result[0]).toBe('&lt;div&gt;');
    expect(result[1]).toBe('Tom &amp; Jerry');
    expect(result[2]).toBe('&quot;quoted&quot;');
  });

  it('should handle nested objects', () => {
    const input = {
      user: {
        name: '<script>',
        info: {
          bio: 'Tom & Jerry',
        },
      },
    };

    const result = escapeHtmlInObject(input);

    expect(result.user.name).toBe('&lt;script&gt;');
    expect(result.user.info.bio).toBe('Tom &amp; Jerry');
  });

  it('should preserve non-string values', () => {
    const input = {
      count: 42,
      active: true,
      data: null,
      items: [1, 2, 3],
    };

    const result = escapeHtmlInObject(input);

    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.data).toBeNull();
    expect(result.items).toEqual([1, 2, 3]);
  });
});
