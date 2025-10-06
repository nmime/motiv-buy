/**
 * PM2 Production Process Manager Configuration
 *
 * Usage:
 *   Start all apps: pm2 start ecosystem.config.js
 *   Start specific app: pm2 start ecosystem.config.js --only api
 *   Monitor: pm2 monit
 *   Logs: pm2 logs
 *   Stop all: pm2 stop all
 *   Restart all: pm2 restart all
 *
 * Environment-specific:
 *   Production: pm2 start ecosystem.config.js --env production
 *   Staging: pm2 start ecosystem.config.js --env staging
 */

module.exports = {
  apps: [
    {
      // API Application
      name: 'motiv-buy-api',
      script: './dist/apps/api/main.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
      },

      // Logging
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process Management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },

    {
      // Telegram Bot Application
      name: 'motiv-buy-bot',
      script: './dist/apps/bot/main.js',
      instances: 1, // Single instance for bot (stateful)
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',

      env: {
        NODE_ENV: 'development',
      },

      env_production: {
        NODE_ENV: 'production',
      },

      env_staging: {
        NODE_ENV: 'staging',
      },

      // Logging
      error_file: './logs/bot-error.log',
      out_file: './logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process Management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
    },
  ],

  // PM2 Deploy Configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-production-server.com'],
      ref: 'origin/master',
      repo: 'git@github.com:yourusername/motiv-buy.git',
      path: '/var/www/motiv-buy',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production',
      },
    },

    staging: {
      user: 'deploy',
      host: ['your-staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/motiv-buy.git',
      path: '/var/www/motiv-buy-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging',
      },
    },
  },
};
