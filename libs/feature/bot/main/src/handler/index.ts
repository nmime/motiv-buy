/**
 * Bot Handlers Index
 *
 * Exports all bot handler classes for use in the bot service and module.
 *
 * STANDARD HANDLER ORGANIZATION:
 * - Each domain has its own folder (balance/, profile/, statistics/, settings/, order/)
 * - Each folder contains: {domain}.handler.ts, {domain}.keyboards.ts, index.ts
 * - Handlers use Grammy Composer pattern
 * - Keyboards are separated from handlers for better organization
 */

// Core handlers (flat)
export * from './command.handler';
export * from './menu.handler';
export * from './callback-router.handler';

// Legacy handlers (backward compatibility - will be deprecated)
export * from './menu-action.handler';
export * from './profile-action.handler';
export * from './balance-action.handler';
export * from './statistics-action.handler';
export * from './order-action.handler';
export * from './settings-action.handler';

// New organized handlers (preferred)
export * from './balance';
export * from './profile';
export * from './statistics';
export * from './settings';
export * from './order';
