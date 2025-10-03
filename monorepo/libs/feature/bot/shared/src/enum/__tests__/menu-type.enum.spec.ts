/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MenuType } from '../menu-type.enum';

describe('MenuType Enum', () => {
  describe('Enum Values', () => {
    it('should have correct string values', () => {
      expect(MenuType.Main).toBe('main');
      expect(MenuType.Profile).toBe('profile');
      expect(MenuType.Settings).toBe('settings');
      expect(MenuType.Auth).toBe('auth');
      expect(MenuType.Balance).toBe('balance');
      expect(MenuType.Traffic).toBe('traffic');
      expect(MenuType.Statistics).toBe('statistics');
      expect(MenuType.Help).toBe('help');
      expect(MenuType.Admin).toBe('admin');
      expect(MenuType.Campaign).toBe('campaign');
      expect(MenuType.Withdrawal).toBe('withdrawal');
      expect(MenuType.Referral).toBe('referral');
      expect(MenuType.Notifications).toBe('notifications');
      expect(MenuType.Verification).toBe('verification');
      expect(MenuType.Error).toBe('error');
    });

    it('should have all expected enum keys', () => {
      const expectedKeys = [
        'Main',
        'Profile',
        'Settings',
        'Auth',
        'Balance',
        'Traffic',
        'Statistics',
        'Help',
        'Admin',
        'Campaign',
        'Withdrawal',
        'Referral',
        'Notifications',
        'Verification',
        'Error',
      ];

      const actualKeys = Object.keys(MenuType);
      expect(actualKeys).toEqual(expect.arrayContaining(expectedKeys));
      expect(actualKeys).toHaveLength(expectedKeys.length);
    });

    it('should have unique values', () => {
      const values = Object.values(MenuType);
      const uniqueValues = [...new Set(values)];

      expect(values).toHaveLength(uniqueValues.length);
    });
  });

  describe('Type Safety', () => {
    it('should allow valid enum values', () => {
      const validMenuType: MenuType = MenuType.Main;
      expect(validMenuType).toBe('main');
    });

    it('should be usable in switch statements', () => {
      const testMenu = MenuType.Profile;
      let result = '';

      switch (testMenu) {
        case MenuType.Main:
          result = 'main menu';
          break;
        case MenuType.Profile:
          result = 'profile menu';
          break;
        case MenuType.Settings:
          result = 'settings menu';
          break;
        case MenuType.Auth:
        case MenuType.Balance:
        case MenuType.Traffic:
        case MenuType.Statistics:
        case MenuType.Help:
        case MenuType.Admin:
        case MenuType.Campaign:
        case MenuType.Withdrawal:
        case MenuType.Referral:
        case MenuType.Notifications:
        case MenuType.Verification:
        case MenuType.Error:
          result = 'other menu';
          break;
        default:
          result = 'unknown menu';
      }

      expect(result).toBe('profile menu');
    });

    it('should be comparable with string values', () => {
      expect(MenuType.Main === 'main').toBe(true);
      expect(MenuType.Profile === 'profile').toBe(true);
      expect(MenuType.Settings !== 'main').toBe(true);
    });
  });

  describe('Enum Iteration', () => {
    it('should be iterable as values', () => {
      const values = Object.values(MenuType);

      expect(values).toContain('main');
      expect(values).toContain('profile');
      expect(values).toContain('settings');
      expect(values).not.toContain('invalid');
    });

    it('should be iterable as entries', () => {
      const entries = Object.entries(MenuType);

      expect(entries).toContainEqual(['Main', 'main']);
      expect(entries).toContainEqual(['Profile', 'profile']);
      expect(entries).toContainEqual(['Settings', 'settings']);
    });

    it('should support mapping operations', () => {
      const menuLabels = Object.values(MenuType).map((value) => value.charAt(0).toUpperCase() + value.slice(1));

      expect(menuLabels).toContain('Main');
      expect(menuLabels).toContain('Profile');
      expect(menuLabels).toContain('Settings');
    });
  });

  describe('Runtime Validation', () => {
    it('should validate enum membership', () => {
      const isValidMenuType = (value: string): value is MenuType => {
        return Object.values(MenuType).includes(value as MenuType);
      };

      expect(isValidMenuType('main')).toBe(true);
      expect(isValidMenuType('profile')).toBe(true);
      expect(isValidMenuType('invalid')).toBe(false);
      expect(isValidMenuType('')).toBe(false);
      expect(isValidMenuType('Main')).toBe(false); // Case sensitive
    });

    it('should support type guards', () => {
      const isMainMenu = (menuType: MenuType): boolean => {
        return menuType === MenuType.Main;
      };

      expect(isMainMenu(MenuType.Main)).toBe(true);
      expect(isMainMenu(MenuType.Profile)).toBe(false);
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize correctly to JSON', () => {
      const menuData = {
        currentMenu: MenuType.Profile,
        availableMenus: [MenuType.Main, MenuType.Settings, MenuType.Help],
      };

      const json = JSON.stringify(menuData);
      const parsed = JSON.parse(json);

      expect(parsed.currentMenu).toBe('profile');
      expect(parsed.availableMenus).toEqual(['main', 'settings', 'help']);
    });

    it('should deserialize correctly from JSON', () => {
      const jsonString = '{"menu": "profile", "previousMenu": "main"}';
      const parsed = JSON.parse(jsonString);

      expect(parsed.menu).toBe(MenuType.Profile);
      expect(parsed.previousMenu).toBe(MenuType.Main);
    });
  });

  describe('Edge Cases', () => {
    it('should handle enum in arrays correctly', () => {
      const publicMenus = [MenuType.Main, MenuType.Help, MenuType.Auth];

      const restrictedMenus = [MenuType.Admin, MenuType.Settings];

      expect(publicMenus).toHaveLength(3);
      expect(restrictedMenus).toHaveLength(2);
      expect(publicMenus).toContain(MenuType.Main);
      expect(restrictedMenus).not.toContain(MenuType.Help);
    });

    it('should work with Sets and Maps', () => {
      const menuSet = new Set([MenuType.Main, MenuType.Profile, MenuType.Main]);
      expect(menuSet.size).toBe(2); // Duplicate removed

      const menuMap = new Map([
        [MenuType.Main, 'Main Menu'],
        [MenuType.Profile, 'User Profile'],
      ]);

      expect(menuMap.get(MenuType.Main)).toBe('Main Menu');
    });

    it('should support filtering operations', () => {
      const allMenus = Object.values(MenuType);
      const userMenus = allMenus.filter((menu) => ![MenuType.Admin, MenuType.Error].includes(menu));

      expect(userMenus).not.toContain(MenuType.Admin);
      expect(userMenus).not.toContain(MenuType.Error);
      expect(userMenus).toContain(MenuType.Main);
      expect(userMenus).toContain(MenuType.Profile);
    });
  });

  describe('Performance Tests', () => {
    it('should perform enum operations efficiently', () => {
      const start = performance.now();

      // Perform many enum operations
      for (let i = 0; i < 10000; i++) {
        const menu = MenuType.Profile;
        menu === MenuType.Main; // Check if main
        Object.values(MenuType); // Get values
        Object.values(MenuType).includes(menu); // Check includes
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should complete under 100ms
    });
  });
});
