import { renderTemplate, renderButtons } from '../template-renderer.util';

/**
 * Template Renderer Utility Tests
 *
 * Test Coverage:
 * - Basic variable interpolation
 * - Number formatting
 * - Edge cases (empty templates, missing variables)
 * - Button rendering with template variables
 * - Nested structures
 * - Error handling
 */
describe('template-renderer.util', () => {
  describe('renderTemplate', () => {
    it('should render simple string variable', () => {
      const template = 'Hello <%= name %>!';
      const variables = { name: 'John' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Hello John!');
    });

    it('should render multiple variables', () => {
      const template = '<%= greeting %> <%= name %>, you have <%= count %> messages';
      const variables = { greeting: 'Hello', name: 'Alice', count: 5 };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Hello Alice, you have 5 messages');
    });

    it('should render number variables', () => {
      const template = 'Balance: $<%= amount %>';
      const variables = { amount: 150 };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Balance: $150');
    });

    it('should render template with decimal numbers', () => {
      const template = 'Price: <%= price %> USD';
      const variables = { price: 99.99 };

      const result = renderTemplate(template, variables);

      expect(result).toBe('Price: 99.99 USD');
    });

    it('should handle empty template', () => {
      const template = '';
      const variables = { name: 'Test' };

      const result = renderTemplate(template, variables);

      expect(result).toBe('');
    });

    it('should handle template without variables', () => {
      const template = 'Static text without variables';
      const variables = {};

      const result = renderTemplate(template, variables);

      expect(result).toBe('Static text without variables');
    });

    it('should handle template with conditional logic', () => {
      const template = '<% if (it.count > 0) { %>You have <%= count %> items<% } else { %>No items<% } %>';
      const variablesWithItems = { count: 3 };
      const variablesEmpty = { count: 0 };

      expect(renderTemplate(template, variablesWithItems)).toBe('You have 3 items');
      expect(renderTemplate(template, variablesEmpty)).toBe('No items');
    });

    it('should handle template with loops', () => {
      const template = '<% it.items.forEach(item => { %><%= item %> <% }) %>';
      const variables = { items: ['apple', 'banana', 'cherry'] } as any;

      const result = renderTemplate(template, variables as any);

      expect(result).toBe('apple banana cherry ');
    });

    it('should escape HTML when needed', () => {
      const template = 'Message: <%= message %>';
      const variables = { message: '<script>alert("xss")</script>' };

      const result = renderTemplate(template, variables);

      // Eta escapes HTML by default with <%= %>
      expect(result).toContain('&lt;script&gt;');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello <%= name %>!';
      const variables = {};

      // Eta will throw or return undefined for missing variables
      expect(() => renderTemplate(template, variables)).toThrow();
    });
  });

  describe('renderButtons', () => {
    it('should render buttons with template variables', () => {
      const buttons = [
        [{ text: 'User <%= name %>', callback_data: 'user_<%= id %>' }],
        [{ text: 'Balance: $<%= balance %>', callback_data: 'balance' }],
      ];

      const variables = { name: 'John', id: 123, balance: 50 };

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([
        [{ text: 'User John', callback_data: 'user_123' }],
        [{ text: 'Balance: $50', callback_data: 'balance' }],
      ]);
    });

    it('should handle empty button array', () => {
      const buttons: unknown[][] = [];
      const variables = { name: 'Test' };

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([]);
    });

    it('should handle buttons without template variables', () => {
      const buttons = [[{ text: 'Static Button', callback_data: 'static' }]];

      const variables = {};

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([[{ text: 'Static Button', callback_data: 'static' }]]);
    });

    it('should preserve non-string button properties', () => {
      const buttons = [
        [
          {
            text: 'Button <%= name %>',
            callback_data: 'data',
            some_number: 42,
            some_boolean: true,
            some_object: { nested: 'value' },
          },
        ],
      ];

      const variables = { name: 'Test' };

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([
        [
          {
            text: 'Button Test',
            callback_data: 'data',
            some_number: 42,
            some_boolean: true,
            some_object: { nested: 'value' },
          },
        ],
      ]);
    });

    it('should handle multiple button rows', () => {
      const buttons = [
        [
          { text: 'Button 1', callback_data: 'btn1' },
          { text: 'Button 2', callback_data: 'btn2' },
        ],
        [{ text: 'Row 2 Button', callback_data: 'row2' }],
        [{ text: 'User <%= name %>', callback_data: 'user' }],
      ];

      const variables = { name: 'Alice' };

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([
        [
          { text: 'Button 1', callback_data: 'btn1' },
          { text: 'Button 2', callback_data: 'btn2' },
        ],
        [{ text: 'Row 2 Button', callback_data: 'row2' }],
        [{ text: 'User Alice', callback_data: 'user' }],
      ]);
    });

    it('should handle null buttons gracefully', () => {
      const buttons = [[null, { text: 'Valid', callback_data: 'ok' }]];
      const variables = { name: 'Test' };

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([[null, { text: 'Valid', callback_data: 'ok' }]]);
    });

    it('should handle non-object buttons gracefully', () => {
      const buttons = [['string_button', 123, true]];
      const variables = { name: 'Test' };

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([['string_button', 123, true]]);
    });

    it('should clone buttons without mutating original', () => {
      const originalButtons = [[{ text: 'User <%= name %>', callback_data: 'user' }]];

      const variables = { name: 'John' };

      const result = renderButtons(originalButtons, variables);

      // Original should remain unchanged
      expect(originalButtons).toEqual([[{ text: 'User <%= name %>', callback_data: 'user' }]]);

      // Result should have rendered values
      expect(result).toEqual([[{ text: 'User John', callback_data: 'user' }]]);
    });

    it('should handle complex button structures', () => {
      const buttons = [
        [
          {
            text: 'Order #<%= orderId %>',
            callback_data: 'order_<%= orderId %>',
            url: 'https://example.com/order/<%= orderId %>',
          },
        ],
      ];

      const variables = { orderId: 12345 };

      const result = renderButtons(buttons, variables);

      expect(result).toEqual([
        [
          {
            text: 'Order #12345',
            callback_data: 'order_12345',
            url: 'https://example.com/order/12345',
          },
        ],
      ]);
    });
  });
});
