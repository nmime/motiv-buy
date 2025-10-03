/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { KeyboardUtil } from '../keyboard.util';
import { MenuConfig, MenuType } from '../../type';

describe('KeyboardUtil', () => {
  describe('createInlineKeyboard', () => {
    it('should create inline keyboard from menu configuration', () => {
      const menuConfig: MenuConfig = {
        type: MenuType.Main,
        title: 'Test Menu',
        buttons: [
          [
            { text: 'Button 1', callbackData: 'action:1' },
            { text: 'Button 2', callbackData: 'action:2' },
          ],
          [{ text: 'URL Button', callbackData: 'url:test', url: 'https://example.com' }],
        ],
        isInline: true,
      };

      const keyboard = KeyboardUtil.createInlineKeyboard(menuConfig);

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: 'Button 1', callback_data: 'action:1', url: undefined },
            { text: 'Button 2', callback_data: 'action:2', url: undefined },
          ],
          [{ text: 'URL Button', callback_data: 'url:test', url: 'https://example.com' }],
        ],
      });
    });

    it('should handle empty button configuration', () => {
      const menuConfig: MenuConfig = {
        type: MenuType.Main,
        title: 'Empty Menu',
        buttons: [],
        isInline: true,
      };

      const keyboard = KeyboardUtil.createInlineKeyboard(menuConfig);

      expect(keyboard).toEqual({
        inline_keyboard: [],
      });
    });
  });

  describe('createReplyKeyboard', () => {
    it('should create reply keyboard with default options', () => {
      const buttons = [['Button 1', 'Button 2'], ['Button 3']];

      const keyboard = KeyboardUtil.createReplyKeyboard(buttons);

      expect(keyboard).toEqual({
        keyboard: [[{ text: 'Button 1' }, { text: 'Button 2' }], [{ text: 'Button 3' }]],
        resize_keyboard: true,
        one_time_keyboard: false,
        selective: false,
      });
    });

    it('should create reply keyboard with custom options', () => {
      const buttons = [['Test Button']];
      const options = {
        resizeKeyboard: false,
        oneTimeKeyboard: true,
        selective: true,
      };

      const keyboard = KeyboardUtil.createReplyKeyboard(buttons, options);

      expect(keyboard).toEqual({
        keyboard: [[{ text: 'Test Button' }]],
        resize_keyboard: false,
        one_time_keyboard: true,
        selective: true,
      });
    });

    it('should handle empty buttons array', () => {
      const keyboard = KeyboardUtil.createReplyKeyboard([]);

      expect(keyboard).toEqual({
        keyboard: [],
        resize_keyboard: true,
        one_time_keyboard: false,
        selective: false,
      });
    });
  });

  describe('createPaginationKeyboard', () => {
    it('should create pagination keyboard for middle page', () => {
      const keyboard = KeyboardUtil.createPaginationKeyboard(3, 5, 'list');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '◀️ Previous', callback_data: 'list:previous:2' },
            { text: '3/5', callback_data: 'page_info' },
            { text: 'Next ▶️', callback_data: 'list:next:4' },
          ],
        ],
      });
    });

    it('should create pagination keyboard for first page', () => {
      const keyboard = KeyboardUtil.createPaginationKeyboard(1, 5, 'list');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '1/5', callback_data: 'page_info' },
            { text: 'Next ▶️', callback_data: 'list:next:2' },
          ],
        ],
      });
    });

    it('should create pagination keyboard for last page', () => {
      const keyboard = KeyboardUtil.createPaginationKeyboard(5, 5, 'list');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '◀️ Previous', callback_data: 'list:previous:4' },
            { text: '5/5', callback_data: 'page_info' },
          ],
        ],
      });
    });

    it('should create pagination keyboard for single page', () => {
      const keyboard = KeyboardUtil.createPaginationKeyboard(1, 1, 'list');

      expect(keyboard).toEqual({
        inline_keyboard: [[{ text: '1/1', callback_data: 'page_info' }]],
      });
    });

    it('should handle invalid page numbers', () => {
      const keyboard = KeyboardUtil.createPaginationKeyboard(0, 5, 'list');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '0/5', callback_data: 'page_info' },
            { text: 'Next ▶️', callback_data: 'list:next:1' },
          ],
        ],
      });
    });
  });

  describe('createConfirmationKeyboard', () => {
    it('should create confirmation keyboard with default text', () => {
      const keyboard = KeyboardUtil.createConfirmationKeyboard('confirm:yes', 'confirm:no');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm:yes' },
            { text: '❌ Cancel', callback_data: 'confirm:no' },
          ],
        ],
      });
    });

    it('should create confirmation keyboard with custom text', () => {
      const keyboard = KeyboardUtil.createConfirmationKeyboard(
        'action:proceed',
        'action:abort',
        '🚀 Go Ahead',
        '🛑 Stop',
      );

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '🚀 Go Ahead', callback_data: 'action:proceed' },
            { text: '🛑 Stop', callback_data: 'action:abort' },
          ],
        ],
      });
    });
  });

  describe('createNumberedListKeyboard', () => {
    it('should create numbered list keyboard with default items per row', () => {
      const items = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'];
      const keyboard = KeyboardUtil.createNumberedListKeyboard(items, 'select');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '1. Option A', callback_data: 'select:0' },
            { text: '2. Option B', callback_data: 'select:1' },
            { text: '3. Option C', callback_data: 'select:2' },
          ],
          [
            { text: '4. Option D', callback_data: 'select:3' },
            { text: '5. Option E', callback_data: 'select:4' },
          ],
        ],
      });
    });

    it('should create numbered list keyboard with custom items per row', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];
      const keyboard = KeyboardUtil.createNumberedListKeyboard(items, 'choose', 2);

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '1. Item 1', callback_data: 'choose:0' },
            { text: '2. Item 2', callback_data: 'choose:1' },
          ],
          [{ text: '3. Item 3', callback_data: 'choose:2' }],
        ],
      });
    });

    it('should handle empty items array', () => {
      const keyboard = KeyboardUtil.createNumberedListKeyboard([], 'select');

      expect(keyboard).toEqual({
        inline_keyboard: [],
      });
    });

    it('should handle single item', () => {
      const keyboard = KeyboardUtil.createNumberedListKeyboard(['Only Item'], 'select');

      expect(keyboard).toEqual({
        inline_keyboard: [[{ text: '1. Only Item', callback_data: 'select:0' }]],
      });
    });
  });

  describe('removeKeyboard', () => {
    it('should create remove keyboard markup with default options', () => {
      const keyboard = KeyboardUtil.removeKeyboard();

      expect(keyboard).toEqual({
        remove_keyboard: true,
        selective: false,
      });
    });

    it('should create selective remove keyboard markup', () => {
      const keyboard = KeyboardUtil.removeKeyboard(true);

      expect(keyboard).toEqual({
        remove_keyboard: true,
        selective: true,
      });
    });
  });

  describe('createNavigationKeyboard', () => {
    it('should create navigation keyboard with default options', () => {
      const keyboard = KeyboardUtil.createNavigationKeyboard();

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '◀️ Back', callback_data: 'back' },
            { text: '🏠 Home', callback_data: 'menu:main' },
          ],
        ],
      });
    });

    it('should create navigation keyboard with custom callbacks', () => {
      const keyboard = KeyboardUtil.createNavigationKeyboard('custom:back', 'custom:home');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '◀️ Back', callback_data: 'custom:back' },
            { text: '🏠 Home', callback_data: 'custom:home' },
          ],
        ],
      });
    });

    it('should create navigation keyboard with only back button', () => {
      const keyboard = KeyboardUtil.createNavigationKeyboard('back', 'home', true, false);

      expect(keyboard).toEqual({
        inline_keyboard: [[{ text: '◀️ Back', callback_data: 'back' }]],
      });
    });

    it('should create navigation keyboard with only home button', () => {
      const keyboard = KeyboardUtil.createNavigationKeyboard('back', 'home', false, true);

      expect(keyboard).toEqual({
        inline_keyboard: [[{ text: '🏠 Home', callback_data: 'home' }]],
      });
    });

    it('should create empty navigation keyboard when no buttons requested', () => {
      const keyboard = KeyboardUtil.createNavigationKeyboard('back', 'home', false, false);

      expect(keyboard).toEqual({
        inline_keyboard: [],
      });
    });
  });

  describe('mergeKeyboards', () => {
    it('should merge multiple inline keyboards', () => {
      const keyboard1 = {
        inline_keyboard: [[{ text: 'Button 1', callback_data: 'action:1' }]],
      };

      const keyboard2 = {
        inline_keyboard: [
          [{ text: 'Button 2', callback_data: 'action:2' }],
          [{ text: 'Button 3', callback_data: 'action:3' }],
        ],
      };

      const keyboard3 = {
        inline_keyboard: [[{ text: 'Button 4', callback_data: 'action:4' }]],
      };

      const merged = KeyboardUtil.mergeKeyboards(keyboard1, keyboard2, keyboard3);

      expect(merged).toEqual({
        inline_keyboard: [
          [{ text: 'Button 1', callback_data: 'action:1' }],
          [{ text: 'Button 2', callback_data: 'action:2' }],
          [{ text: 'Button 3', callback_data: 'action:3' }],
          [{ text: 'Button 4', callback_data: 'action:4' }],
        ],
      });
    });

    it('should handle empty keyboards in merge', () => {
      const keyboard1 = {
        inline_keyboard: [[{ text: 'Button 1', callback_data: 'action:1' }]],
      };

      const emptyKeyboard = {};

      const keyboard2 = {
        inline_keyboard: [[{ text: 'Button 2', callback_data: 'action:2' }]],
      };

      const merged = KeyboardUtil.mergeKeyboards(keyboard1, emptyKeyboard, keyboard2);

      expect(merged).toEqual({
        inline_keyboard: [
          [{ text: 'Button 1', callback_data: 'action:1' }],
          [{ text: 'Button 2', callback_data: 'action:2' }],
        ],
      });
    });

    it('should handle null/undefined keyboards in merge', () => {
      const keyboard1 = {
        inline_keyboard: [[{ text: 'Button 1', callback_data: 'action:1' }]],
      };

      const merged = KeyboardUtil.mergeKeyboards(keyboard1, null as any, undefined as any);

      expect(merged).toEqual({
        inline_keyboard: [[{ text: 'Button 1', callback_data: 'action:1' }]],
      });
    });

    it('should return empty keyboard when merging only empty keyboards', () => {
      const merged = KeyboardUtil.mergeKeyboards({}, null as any, undefined as any);

      expect(merged).toEqual({
        inline_keyboard: [],
      });
    });

    it('should handle single keyboard merge', () => {
      const keyboard = {
        inline_keyboard: [[{ text: 'Single Button', callback_data: 'single' }]],
      };

      const merged = KeyboardUtil.mergeKeyboards(keyboard);

      expect(merged).toEqual(keyboard);
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle very large button arrays', () => {
      const largeButtonArray = Array(100)
        .fill(null)
        .map((_, i) => [`Button ${i + 1}`]);

      const keyboard = KeyboardUtil.createReplyKeyboard(largeButtonArray);

      expect(keyboard.keyboard).toHaveLength(100);
      expect(keyboard.keyboard[99]).toEqual([{ text: 'Button 100' }]);
    });

    it('should handle very long button text', () => {
      const longText = 'A'.repeat(1000);
      const buttons = [[longText]];

      const keyboard = KeyboardUtil.createReplyKeyboard(buttons);

      expect(keyboard.keyboard[0][0].text).toBe(longText);
      expect(keyboard.keyboard[0][0].text.length).toBe(1000);
    });

    it('should handle high page numbers in pagination', () => {
      const keyboard = KeyboardUtil.createPaginationKeyboard(999, 1000, 'list');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '◀️ Previous', callback_data: 'list:previous:998' },
            { text: '999/1000', callback_data: 'page_info' },
            { text: 'Next ▶️', callback_data: 'list:next:1000' },
          ],
        ],
      });
    });

    it('should handle special characters in callback data', () => {
      const specialCallback = 'action:test@#$%^&*()[]{}|\\:";\'<>?,./';
      const keyboard = KeyboardUtil.createConfirmationKeyboard(specialCallback, 'cancel');

      expect(keyboard.inline_keyboard[0][0].callback_data).toBe(specialCallback);
    });

    it('should handle Unicode text in buttons', () => {
      const unicodeText = '🌟 Test 测试 🎉 Тест';
      const buttons = [[unicodeText]];

      const keyboard = KeyboardUtil.createReplyKeyboard(buttons);

      expect(keyboard.keyboard[0][0].text).toBe(unicodeText);
    });

    it('should handle empty strings in numbered list', () => {
      const items = ['', 'Valid Item', ''];
      const keyboard = KeyboardUtil.createNumberedListKeyboard(items, 'select');

      expect(keyboard).toEqual({
        inline_keyboard: [
          [
            { text: '1. ', callback_data: 'select:0' },
            { text: '2. Valid Item', callback_data: 'select:1' },
            { text: '3. ', callback_data: 'select:2' },
          ],
        ],
      });
    });
  });

  describe('Performance Tests', () => {
    it('should create keyboards under performance threshold', () => {
      const start = performance.now();

      // Create multiple keyboards of different types
      KeyboardUtil.createReplyKeyboard([['Test']]);
      KeyboardUtil.createPaginationKeyboard(1, 10, 'test');
      KeyboardUtil.createConfirmationKeyboard('yes', 'no');
      KeyboardUtil.createNumberedListKeyboard(['A', 'B', 'C'], 'select');
      KeyboardUtil.createNavigationKeyboard();

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50); // Should complete under 50ms
    });

    it('should handle concurrent keyboard creation', () => {
      const promises = Array(10)
        .fill(null)
        .map((_, i) => {
          return Promise.resolve(KeyboardUtil.createNumberedListKeyboard([`Item ${i}`], 'select'));
        });

      return Promise.all(promises).then((results) => {
        expect(results).toHaveLength(10);
        results.forEach((result, i) => {
          expect(result.inline_keyboard[0][0].text).toBe(`1. Item ${i}`);
        });
      });
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during keyboard creation', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many keyboards
      for (let i = 0; i < 100; i++) {
        KeyboardUtil.createReplyKeyboard([['Test Button']]);
        KeyboardUtil.createInlineKeyboard({
          type: MenuType.Main,
          title: 'Test',
          buttons: [[{ text: 'Test', callbackData: 'test' }]],
          isInline: true,
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });
});
