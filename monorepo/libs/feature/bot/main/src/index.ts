export { BotMainModule } from './bot-main.module';
export { BotService } from './service';
export * from './service';
// Note: Handlers are not exported to prevent circular dependency with traffic-main
// Handlers import interfaces from shared modules instead
// export * from './handler';
export * from './composer';
export * from './middleware';
export * from './util';
export * from './config';
