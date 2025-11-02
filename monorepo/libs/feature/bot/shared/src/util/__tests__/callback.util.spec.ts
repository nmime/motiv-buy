/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-escape, sonarjs/no-nested-functions */
import { CallbackUtil } from '../callback.util';

describe('CallbackUtil', () => {
  describe('parseCallbackData', () => {
    it('should parse callback data with parameters', () => {
      const result = CallbackUtil.parseCallbackData('menu:profile:edit:123');

      expect(result).toEqual({
        action: 'menu',
        params: ['profile', 'edit', '123'],
        isValid: true,
      });
    });

    it('should parse callback data without parameters', () => {
      const result = CallbackUtil.parseCallbackData('back');

      expect(result).toEqual({
        action: 'back',
        params: [],
        isValid: true,
      });
    });

    it('should handle empty callback data', () => {
      const result = CallbackUtil.parseCallbackData('');

      expect(result).toEqual({
        action: '',
        params: [],
        isValid: false,
      });
    });

    it('should handle null/undefined callback data', () => {
      const result1 = CallbackUtil.parseCallbackData(null as any);
      const result2 = CallbackUtil.parseCallbackData(undefined as any);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });
  });

  describe('createActionCallback', () => {
    it('should create action callback with parameters', () => {
      const callback = CallbackUtil.createActionCallback('action', 'test', 'param1', 'param2');
      expect(callback).toBe('action:test:param1:param2');
    });

    it('should create action callback without parameters', () => {
      const callback = CallbackUtil.createActionCallback('action', 'test');
      expect(callback).toBe('action:test');
    });

    it('should handle empty parameters', () => {
      const callback = CallbackUtil.createActionCallback('action', 'test', '');
      expect(callback).toBe('action:test:');
    });
  });

  describe('createMenuCallback', () => {
    it('should create menu navigation callback', () => {
      const callback = CallbackUtil.createMenuCallback('profile', 'navigate');
      expect(callback).toBe('menu:profile:navigate');
    });

    it('should create menu callback without action', () => {
      const callback = CallbackUtil.createMenuCallback('profile');
      expect(callback).toBe('menu:profile');
    });
  });

  describe('validateCallbackData', () => {
    it('should validate correct callback format', () => {
      expect(CallbackUtil.validateCallbackData('menu:profile')).toBe(true);
      expect(CallbackUtil.validateCallbackData('action:test:param')).toBe(true);
    });

    it('should reject invalid callback format', () => {
      expect(CallbackUtil.validateCallbackData('')).toBe(false);
      expect(CallbackUtil.validateCallbackData(null as any)).toBe(false);
      expect(CallbackUtil.validateCallbackData('::::')).toBe(false);
    });

    it('should handle callback data length limits', () => {
      const longCallback = 'a'.repeat(65);
      expect(CallbackUtil.validateCallbackData(longCallback)).toBe(false);

      const validCallback = 'a'.repeat(63);
      expect(CallbackUtil.validateCallbackData(validCallback)).toBe(true);
    });
  });

  describe('encodeCallbackData', () => {
    it('should encode callback data safely', () => {
      const encoded = CallbackUtil.encodeCallbackData({ action: 'test', id: 123 });
      expect(encoded).toMatch(/^[A-Za-z0-9+\/]*={0,2}$/); // Base64 pattern
    });

    it('should handle encoding errors', () => {
      const circular: any = {};
      circular.self = circular;

      expect(() => CallbackUtil.encodeCallbackData(circular)).toThrow();
    });
  });

  describe('decodeCallbackData', () => {
    it('should decode callback data correctly', () => {
      const data = { action: 'test', id: 123 };
      const encoded = CallbackUtil.encodeCallbackData(data);
      const decoded = CallbackUtil.decodeCallbackData(encoded);

      expect(decoded).toEqual(data);
    });

    it('should handle invalid base64', () => {
      expect(() => CallbackUtil.decodeCallbackData('invalid-base64!')).toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should process callbacks under performance threshold', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        CallbackUtil.parseCallbackData(`action:test:${i}`);
        CallbackUtil.createActionCallback('action', 'test', i.toString());
        CallbackUtil.validateCallbackData(`menu:item:${i}`);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in callback data', () => {
      const callback = 'menu:test@#$%^&*()';
      const result = CallbackUtil.parseCallbackData(callback);

      expect(result.action).toBe('menu');
      expect(result.params[0]).toBe('test@#$%^&*()');
    });

    it('should handle Unicode characters', () => {
      const callback = 'action:测试:🎉';
      const result = CallbackUtil.parseCallbackData(callback);

      expect(result.params).toEqual(['测试', '🎉']);
    });
  });
});
