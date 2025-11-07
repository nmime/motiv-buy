export { BotMainModule } from './bot-main.module';
export { BotService } from './service';
export * from './service';
// Note: Handlers are not exported to prevent circular dependency with traffic-main
// Handlers import TrafficService and ModerationService, creating a cycle
// The module itself provides these handlers internally
// export * from './handler';

// Export token for app-level dependency injection
export { ModerationServiceToken } from './handler/moderation-action.handler';

export * from './composer';
export * from './middleware';
export * from './util';
export * from './config';
