/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { validate } from 'class-validator';
import { MenuActionDto, MenuActionResponseDto } from '../menu-action.dto';
import { MenuActionType } from '../../type/callback-data.interface';

describe('MenuActionDto', () => {
  describe('Validation', () => {
    it('should validate valid menu action dto', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        menuId: 'profile',
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should require action field', async () => {
      const dto = new MenuActionDto({
        userId: '123456789',
        chatId: '-987654321',
      } as Partial<MenuActionDto>);

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'action')).toBe(true);
    });

    it('should require userId field', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        chatId: '-987654321',
      } as any);

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'userId')).toBe(true);
    });

    it('should require chatId field', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        userId: '123456789',
      } as Partial<MenuActionDto>);

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'chatId')).toBe(true);
    });

    it('should validate action enum values', async () => {
      const dto = new MenuActionDto({
        action: 'invalid-action' as unknown as MenuActionType,
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'action')).toBe(true);
    });

    it('should allow optional fields', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        menuId: 'profile',
        params: { page: 1 },
        messageId: '12345',
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate menuId as string when provided', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        menuId: 123 as unknown as string,
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'menuId')).toBe(true);
    });

    it('should validate params as object when provided', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        params: 'invalid' as unknown as Record<string, unknown>,
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'params')).toBe(true);
    });

    it('should validate messageId as string when provided', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        messageId: 12345 as unknown as string,
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'messageId')).toBe(true);
    });
  });

  describe('Constructor', () => {
    it('should create instance with all properties', () => {
      const data = {
        action: MenuActionType.Execute,
        menuId: 'settings',
        params: { setting: 'theme' },
        userId: '123456789',
        chatId: '-987654321',
        messageId: '12345',
      };

      const dto = new MenuActionDto(data);

      expect(dto.action).toBe(data.action);
      expect(dto.menuId).toBe(data.menuId);
      expect(dto.params).toEqual(data.params);
      expect(dto.userId).toBe(data.userId);
      expect(dto.chatId).toBe(data.chatId);
      expect(dto.messageId).toBe(data.messageId);
    });

    it('should create instance with minimum required properties', () => {
      const data = {
        action: MenuActionType.Navigate,
        userId: '123456789',
        chatId: '-987654321',
      };

      const dto = new MenuActionDto(data);

      expect(dto.action).toBe(data.action);
      expect(dto.userId).toBe(data.userId);
      expect(dto.chatId).toBe(data.chatId);
      expect(dto.menuId).toBeUndefined();
      expect(dto.params).toBeUndefined();
      expect(dto.messageId).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty params object', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Navigate,
        params: {},
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle complex nested params', async () => {
      const dto = new MenuActionDto({
        action: MenuActionType.Execute,
        params: {
          filters: { status: 'active', type: 'premium' },
          pagination: { page: 1, limit: 10 },
          sort: { field: 'created', order: 'desc' },
        },
        userId: '123456789',
        chatId: '-987654321',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});

describe('MenuActionResponseDto', () => {
  describe('Validation', () => {
    it('should validate valid response dto', async () => {
      const dto = new MenuActionResponseDto({
        success: true,
        message: 'Action completed successfully',
        nextMenu: 'profile',
        data: { result: 'ok' },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should require success field', async () => {
      const dto = new MenuActionResponseDto({
        message: 'Test message',
      } as Partial<MenuActionResponseDto>);

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'success')).toBe(true);
    });

    it('should allow all optional fields', async () => {
      const dto = new MenuActionResponseDto({
        success: false,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate message as string when provided', async () => {
      const dto = new MenuActionResponseDto({
        success: true,
        message: 123 as unknown as string,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });

    it('should validate nextMenu as string when provided', async () => {
      const dto = new MenuActionResponseDto({
        success: true,
        nextMenu: { menu: 'profile' } as unknown as string,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'nextMenu')).toBe(true);
    });

    it('should validate data as object when provided', async () => {
      const dto = new MenuActionResponseDto({
        success: true,
        data: 'invalid' as unknown as Record<string, unknown>,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'data')).toBe(true);
    });
  });

  describe('Constructor', () => {
    it('should create instance with all properties', () => {
      const data = {
        success: true,
        message: 'Success message',
        nextMenu: 'dashboard',
        data: { userId: '123', status: 'updated' },
      };

      const dto = new MenuActionResponseDto(data);

      expect(dto.success).toBe(data.success);
      expect(dto.message).toBe(data.message);
      expect(dto.nextMenu).toBe(data.nextMenu);
      expect(dto.data).toEqual(data.data);
    });

    it('should create instance with minimum required properties', () => {
      const data = {
        success: false,
      };

      const dto = new MenuActionResponseDto(data);

      expect(dto.success).toBe(data.success);
      expect(dto.message).toBeUndefined();
      expect(dto.nextMenu).toBeUndefined();
      expect(dto.data).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data object', async () => {
      const dto = new MenuActionResponseDto({
        success: true,
        data: {},
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle complex response data', async () => {
      const dto = new MenuActionResponseDto({
        success: true,
        message: 'Complex operation completed',
        data: {
          results: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
          ],
          pagination: { page: 1, total: 2, hasNext: false },
          metadata: { timestamp: '2023-01-01T00:00:00Z', version: '1.0' },
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should validate DTOs under performance threshold', async () => {
      const start = performance.now();

      const dtos = Array(100)
        .fill(null)
        .map(
          (_, i) =>
            new MenuActionDto({
              action: MenuActionType.Navigate,
              menuId: `menu-${i}`,
              userId: i.toString(),
              chatId: `-${i}`,
            }),
        );

      const validationPromises = dtos.map((dto) => validate(dto));
      await Promise.all(validationPromises);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // Should validate 100 DTOs under 1 second
    });
  });
});
