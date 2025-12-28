/**
 * Order Feature Keyboards
 *
 * Inline keyboard builders for the order creation and management feature
 * All keyboards accept BotContext for i18n translations
 */

import { InlineKeyboard } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import {
  availableTopics,
  Order,
  OrderCreationOrigin,
  OrderDisplayLocation,
  OrderStatus,
  UserGender,
} from '@app/feature-order-shared';

/**
 * Get the callback for back navigation based on origin
 */
function getBackCallback(origin?: OrderCreationOrigin): string {
  const callbackMap: Record<OrderCreationOrigin, string> = {
    buy_traffic: 'menu:buy_traffic',
    orders_list: 'order:list',
  };

  return callbackMap[origin || 'orders_list'];
}

/**
 * Pagination configuration
 */
const _ordersPerPage = 10;
const _maxInlineButtons = 100;

/**
 * Helper functions
 */

function getStatusEmoji(status: OrderStatus): string {
  const emojiMap: Record<OrderStatus, string> = {
    [OrderStatus.Active]: '🟢',
    [OrderStatus.Paused]: '⏸️',
    [OrderStatus.Moderation]: '🟡',
    [OrderStatus.Rejected]: '🔴',
    [OrderStatus.Completed]: '✅',
    [OrderStatus.Deleted]: '🗑️',
  };

  return emojiMap[status] || '⚪';
}

function getStatusTextKey(status: OrderStatus): string {
  const keyMap: Record<OrderStatus, string> = {
    [OrderStatus.Active]: 'orders.status.active',
    [OrderStatus.Paused]: 'orders.status.paused',
    [OrderStatus.Moderation]: 'orders.status.moderation',
    [OrderStatus.Rejected]: 'orders.status.rejected',
    [OrderStatus.Completed]: 'orders.status.completed',
    [OrderStatus.Deleted]: 'orders.status.deleted',
  };

  return keyMap[status] || 'orders.status.unknown';
}

/**
 * A1: Order List Keyboard (with pagination)
 * NOTE: Main menu is now handled by MenuActionHandler.createMainMenuKeyboard(ctx) with translations
 */
export function createOrderListKeyboard(
  ctx: BotContext,
  orders: Order[],
  showDeleted = false,
  page = 1,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // New order button
  keyboard.text(ctx.t('orders.btn_new'), 'order:create:start').row();

  // Search button
  keyboard.text(ctx.t('orders.btn_search'), 'order:search').row();

  // Filter orders
  const filteredOrders = orders.filter((o) =>
    !showDeleted ? o.status !== OrderStatus.Deleted : o.status === OrderStatus.Deleted,
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / _ordersPerPage);
  const startIndex = (page - 1) * _ordersPerPage;
  const endIndex = Math.min(startIndex + _ordersPerPage, filteredOrders.length);
  const pageOrders = filteredOrders.slice(startIndex, endIndex);

  // List orders for current page
  pageOrders.forEach((order) => {
    const statusEmoji = getStatusEmoji(order.status);
    const statusText = ctx.t(getStatusTextKey(order.status));
    const label = `${statusEmoji} ${order.config.name || ctx.t('orders.list.no_name')}`;
    const subtitle = `${order.stats.totalSubscribers} ${ctx.t('orders.list.subscribers')} | ${statusText}`;

    keyboard.text(`${label}\n${subtitle}`, `order:view:${order.id}`).row();
  });

  // Pagination buttons
  if (totalPages > 1) {
    const paginationRow: Array<{ text: string; callback_data: string }> = [];

    if (page > 1) {
      paginationRow.push({ text: ctx.t('orders.list.btn_prev'), callback_data: `order:list:page:${page - 1}` });
    }

    paginationRow.push({ text: `${page}/${totalPages}`, callback_data: 'noop' });

    if (page < totalPages) {
      paginationRow.push({ text: ctx.t('orders.list.btn_next'), callback_data: `order:list:page:${page + 1}` });
    }

    // Add pagination buttons to keyboard
    paginationRow.forEach((btn, idx) => {
      if (idx > 0) {
        keyboard.text(btn.text, btn.callback_data);
      } else {
        keyboard.text(btn.text, btn.callback_data).row();
      }
    });

    keyboard.row();
  }

  // Show deleted orders button
  if (!showDeleted && orders.some((o) => o.status === OrderStatus.Deleted)) {
    keyboard.text(ctx.t('orders.list.btn_deleted'), 'order:deleted').row();
  }

  // Back button
  keyboard.text(ctx.t('orders.common.btn_back'), 'menu:main');

  return keyboard;
}

/**
 * A2: Channel Link Input Helper Keyboard
 */
export function createChannelLinkHelpKeyboard(ctx: BotContext, origin?: OrderCreationOrigin): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text(ctx.t('orders.help.invite_link_why'), 'order:help:invite_link')
    .row()
    .text(ctx.t('orders.help.invite_link_how'), 'order:help:create_invite')
    .row()
    .text(ctx.t('orders.common.btn_back'), getBackCallback(origin));

  return keyboard;
}

/**
 * A3: Add Bot as Admin Keyboard
 */
export function createAddBotAdminKeyboard(
  ctx: BotContext,
  channelUsername?: string,
  origin?: OrderCreationOrigin,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Main add button - opens channel selector
  keyboard.text(ctx.t('orders.bot_admin.btn_add_channel'), 'order:bot:add_dialog').row();

  // Alternative add button
  if (channelUsername) {
    keyboard
      .url(ctx.t('orders.bot_admin.btn_add_to_channel'), `https://t.me/${channelUsername}?startgroup=admin`)
      .row();
  }

  // Confirmation button
  keyboard.text(ctx.t('orders.bot_admin.btn_added_confirm'), 'order:bot:check').row();

  // Skip button
  keyboard.text(ctx.t('orders.bot_admin.btn_skip'), 'order:bot:skip').row();

  // Back button
  keyboard.text(ctx.t('orders.common.btn_back'), getBackCallback(origin));

  return keyboard;
}

/**
 * A4: Moderation Status Keyboard
 */
export function createModerationKeyboard(
  ctx: BotContext,
  orderId: string,
  origin?: OrderCreationOrigin,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Continue to configuration
  keyboard.text(ctx.t('orders.moderation.btn_continue_setup'), `order:config:start:${orderId}`).row();

  // Skip configuration
  keyboard.text(ctx.t('orders.moderation.btn_skip_setup'), `order:config:skip:${orderId}`).row();

  // Top menu row
  keyboard
    .text(ctx.t('orders.moderation.btn_integration'), 'order:integration')
    .text(ctx.t('orders.moderation.btn_transfer'), 'order:transfer')
    .row();

  // Stop button
  keyboard.text(ctx.t('orders.moderation.btn_stop'), `order:stop:${orderId}`).row();

  // Back button
  keyboard.text(ctx.t('orders.common.btn_back'), getBackCallback(origin));

  return keyboard;
}

/**
 * A5: Order Configuration Menu Keyboard
 */
export function createConfigurationKeyboard(ctx: BotContext, orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // View channel button
  keyboard.text(ctx.t('orders.config.btn_view_channel'), `order:view_channel:${orderId}`).row();

  // Basic settings
  keyboard.text(ctx.t('orders.config.btn_edit_name'), `order:edit:name:${orderId}`).row();
  keyboard.text(ctx.t('orders.config.btn_edit_link'), `order:edit:link:${orderId}`).row();

  // Subscriber parameters
  keyboard.text(ctx.t('orders.config.btn_daily_users'), `order:edit:daily:${orderId}`).row();
  keyboard.text(ctx.t('orders.config.btn_total_users'), `order:edit:total:${orderId}`).row();
  keyboard.text(ctx.t('orders.config.btn_distribute'), `order:toggle:distribute:${orderId}`).row();
  keyboard.text(ctx.t('orders.config.btn_count_unsubscribes'), `order:toggle:unsubscribes:${orderId}`).row();

  // Target audience
  keyboard.text(ctx.t('orders.config.btn_audience_settings'), `order:edit:audience:${orderId}`).row();

  // Financial
  keyboard.text(ctx.t('orders.config.btn_price_per_sub'), `order:edit:price:${orderId}`).row();
  keyboard.text(ctx.t('orders.config.btn_excluded_topics'), `order:edit:topics:${orderId}`).row();

  // Schedule
  keyboard.text(ctx.t('orders.config.btn_start_time'), `order:edit:start_time:${orderId}`).row();
  keyboard.text(ctx.t('orders.config.btn_schedule'), `order:edit:schedule:${orderId}`).row();

  // Display locations
  keyboard.text(ctx.t('orders.config.btn_locations'), `order:edit:locations:${orderId}`).row();

  // Done button
  keyboard.text(ctx.t('orders.config.btn_done'), `order:config:done:${orderId}`);

  return keyboard;
}

/**
 * Target Audience Configuration Keyboard
 */
export function createAudienceConfigKeyboard(ctx: BotContext, orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard.text(ctx.t('orders.audience.btn_gender'), `order:audience:gender:${orderId}`).row();
  keyboard.text(ctx.t('orders.audience.btn_region'), `order:audience:region:${orderId}`).row();
  keyboard.text(ctx.t('orders.audience.btn_age'), `order:audience:age:${orderId}`).row();
  keyboard.text(ctx.t('orders.audience.btn_activity'), `order:audience:activity:${orderId}`).row();
  keyboard.text(ctx.t('orders.audience.btn_save'), `order:audience:save:${orderId}`);

  return keyboard;
}

/**
 * Gender Selection Keyboard
 */
export function createGenderKeyboard(ctx: BotContext, orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text(ctx.t('orders.gender.any'), `order:gender:${UserGender.Any}:${orderId}`)
    .row()
    .text(ctx.t('orders.gender.male'), `order:gender:${UserGender.Male}:${orderId}`)
    .row()
    .text(ctx.t('orders.gender.female'), `order:gender:${UserGender.Female}:${orderId}`);

  return keyboard;
}

/**
 * Excluded Topics Keyboard
 */
export function createTopicsKeyboard(ctx: BotContext, orderId: string, selectedTopics: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  availableTopics.forEach((topic) => {
    const isSelected = selectedTopics.includes(topic.id);
    const prefix = isSelected ? '☑' : '☐';
    keyboard.text(`${prefix} ${topic.name}`, `order:topic:${topic.id}:${orderId}`).row();
  });

  keyboard.text(ctx.t('orders.audience.btn_save'), `order:topics:save:${orderId}`);

  return keyboard;
}

/**
 * Display Location Selection Keyboard
 */
export function createLocationKeyboard(ctx: BotContext, orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text(ctx.t('orders.location.my_bots_only'), `order:location:${OrderDisplayLocation.MyBotsOnly}:${orderId}`)
    .row()
    .text(ctx.t('orders.location.other_bots_only'), `order:location:${OrderDisplayLocation.OtherBotsOnly}:${orderId}`)
    .row()
    .text(ctx.t('orders.location.both'), `order:location:${OrderDisplayLocation.Both}:${orderId}`);

  return keyboard;
}

/**
 * A6: View Order Keyboard
 */
export function createViewOrderKeyboard(ctx: BotContext, order: Order): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Check if order is in terminal state
  const terminalStatuses = [OrderStatus.Completed, OrderStatus.Deleted, OrderStatus.Rejected];
  const isTerminal = terminalStatuses.includes(order.status);

  // For terminal orders, only show back button
  if (isTerminal) {
    keyboard.text(ctx.t('orders.view.btn_back_to_list'), 'order:list');

    return keyboard;
  }

  // View channel button
  if (order.channel.username) {
    keyboard.url(ctx.t('orders.config.btn_view_channel'), `https://t.me/${order.channel.username}`).row();
  }

  // Refresh stats
  keyboard.text(ctx.t('orders.view.btn_refresh_stats'), `order:refresh:${order.id}`).row();

  // Settings and Statistics
  keyboard
    .text(ctx.t('orders.view.btn_settings'), `order:config:start:${order.id}`)
    .text(ctx.t('orders.view.btn_statistics'), `order:stats:${order.id}`)
    .row();

  // Duplicate
  keyboard.text(ctx.t('orders.view.btn_duplicate'), `order:duplicate:${order.id}`).row();

  // Start/Stop and Delete
  const actionText =
    order.status === OrderStatus.Active ? ctx.t('orders.view.btn_stop') : ctx.t('orders.view.btn_start');

  keyboard
    .text(actionText, `order:toggle:${order.id}`)
    .text(ctx.t('orders.view.btn_delete'), `order:delete:${order.id}`)
    .row();

  // Download IDs and Report
  keyboard
    .text(ctx.t('orders.view.btn_download_ids'), `order:download:ids:${order.id}`)
    .text(ctx.t('orders.view.btn_download_report'), `order:download:report:${order.id}`)
    .row();

  // Help
  keyboard.text(ctx.t('orders.view.btn_troubleshoot'), 'order:help:troubleshoot').row();

  // Balance section
  keyboard.text(ctx.t('orders.view.btn_balance_section'), 'balance:view').row();
  keyboard
    .text(ctx.t('orders.view.btn_balance'), 'balance:view')
    .text(ctx.t('orders.view.btn_topup'), 'balance:topup')
    .row();

  // Back to orders list
  keyboard.text(ctx.t('orders.view.btn_back_to_list'), 'order:list');

  return keyboard;
}

/**
 * Order Statistics Keyboard
 */
export function createStatsKeyboard(ctx: BotContext, orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text(ctx.t('orders.stats.btn_download_excel'), `order:download:excel:${orderId}`)
    .row()
    .text(ctx.t('orders.common.btn_back'), `order:view:${orderId}`);

  return keyboard;
}

/**
 * Delete Confirmation Keyboard
 */
export function createDeleteConfirmKeyboard(ctx: BotContext, orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text(ctx.t('orders.delete.btn_confirm'), `order:delete:confirm:${orderId}`)
    .text(ctx.t('orders.delete.btn_cancel'), `order:view:${orderId}`);

  return keyboard;
}
