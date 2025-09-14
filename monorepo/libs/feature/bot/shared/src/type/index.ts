export * from './bot-context.interface';
export * from './menu-config.interface';
export * from './session.interface';
export * from './callback-data.interface';

// Re-export commonly used interfaces with aliases
export type { MenuConfig, MenuButton, MenuNavigation, MenuActionResult } from './menu-config.interface';
export type { BotContext, BotUser, BotChat } from './bot-context.interface';
export type { SessionInterface, SessionData } from './session.interface';
