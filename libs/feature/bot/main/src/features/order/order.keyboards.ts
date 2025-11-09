/**
 * Order Feature Keyboards
 *
 * Inline keyboard builders for the order creation and management feature
 */

import { InlineKeyboard } from 'grammy';
import { availableTopics, Order, OrderDisplayLocation, OrderStatus, UserGender } from './order.types';

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

function getStatusText(status: OrderStatus): string {
  const textMap: Record<OrderStatus, string> = {
    [OrderStatus.Active]: 'Активен',
    [OrderStatus.Paused]: 'Остановлен',
    [OrderStatus.Moderation]: 'На модерации',
    [OrderStatus.Rejected]: 'Отклонен',
    [OrderStatus.Completed]: 'Завершен',
    [OrderStatus.Deleted]: 'Удален',
  };

  return textMap[status] || 'Неизвестно';
}

/**
 * Main Menu Keyboard (from specification)
 */
export function createMainMenuKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Row 1: Buy subscribers (prominent button)
  keyboard.text('👥 Купить подписчиков', 'order:list').row();

  // Row 2: Traffic selling and My orders
  keyboard.text('🤖 Продажа трафика', 'traffic:manage').text('📋 Мои заказы', 'order:list').row();

  // Row 3: Profile and Balance
  keyboard.text('👤 Профиль', 'profile:view').text('💰 Баланс', 'balance:view').row();

  // Row 4: Support
  keyboard.text('🏢 Тех. поддержка', 'support:contact');

  return keyboard;
}

/**
 * A1: Order List Keyboard (with pagination)
 */
export function createOrderListKeyboard(orders: Order[], showDeleted = false, page = 1): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // New order button
  keyboard.text('🆕 Новый заказ', 'order:create:start').row();

  // Search button
  keyboard.text('🔍 Поиск', 'order:search').row();

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
    const statusText = getStatusText(order.status);
    const label = `${statusEmoji} ${order.config.name || 'Без названия'}`;
    const subtitle = `${order.stats.totalSubscribers} подписчиков | ${statusText}`;

    keyboard.text(`${label}\n${subtitle}`, `order:view:${order.id}`).row();
  });

  // Pagination buttons
  if (totalPages > 1) {
    const paginationRow: Array<{ text: string; callback_data: string }> = [];

    if (page > 1) {
      paginationRow.push({ text: '◀️ Пред', callback_data: `order:list:page:${page - 1}` });
    }

    paginationRow.push({ text: `${page}/${totalPages}`, callback_data: 'noop' });

    if (page < totalPages) {
      paginationRow.push({ text: 'След ▶️', callback_data: `order:list:page:${page + 1}` });
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
    keyboard.text('🗑️ Удаленные заказы', 'order:deleted').row();
  }

  // Back button
  keyboard.text('◀️ Назад', 'menu:main');

  return keyboard;
}

/**
 * A2: Channel Link Input Helper Keyboard
 */
export function createChannelLinkHelpKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('🔗 Зачем нужна пригласительная ссылка?', 'order:help:invite_link')
    .row()
    .text('📝 Как создать пригласительную ссылку?', 'order:help:create_invite')
    .row()
    .text('◀️ Назад', 'order:list');

  return keyboard;
}

/**
 * A3: Add Bot as Admin Keyboard
 */
export function createAddBotAdminKeyboard(channelUsername?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Main add button - opens channel selector
  keyboard.text('➕ Добавить в канал/чат', 'order:bot:add_dialog').row();

  // Alternative add button
  if (channelUsername) {
    keyboard.url('➕ Добавить в канал', `https://t.me/${channelUsername}?startgroup=admin`).row();
  }

  // Confirmation button
  keyboard.text('✅ Я добавил бота в администраторы', 'order:bot:check').row();

  // Skip button
  keyboard.text('❌ Я не хочу добавлять бота (не рекомендуется)', 'order:bot:skip').row();

  // Back button
  keyboard.text('◀️ Назад', 'order:create:back');

  return keyboard;
}

/**
 * A4: Moderation Status Keyboard
 */
export function createModerationKeyboard(orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Continue to configuration
  keyboard.text('⚙️ Продолжить настройку ➡️', `order:config:start:${orderId}`).row();

  // Skip configuration
  keyboard.text('Пропустить (использовать настройки по умолчанию)', `order:config:skip:${orderId}`).row();

  // Top menu row
  keyboard.text('💻 Интеграция (API)', 'order:integration').text('🔄 Передать бота', 'order:transfer').row();

  // Stop button
  keyboard.text('⏸️ Остановить', `order:stop:${orderId}`).row();

  // Back button
  keyboard.text('◀️ Назад', 'order:list');

  return keyboard;
}

/**
 * A5: Order Configuration Menu Keyboard
 */
export function createConfigurationKeyboard(orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // View channel button
  keyboard.text('VIEW CHANNEL', `order:view_channel:${orderId}`).row();

  // Basic settings
  keyboard.text('📝 Изменить название заказа', `order:edit:name:${orderId}`).row();
  keyboard.text('🔗 Изменить ссылку', `order:edit:link:${orderId}`).row();

  // Subscriber parameters
  keyboard.text('📊 Пользователей в день', `order:edit:daily:${orderId}`).row();
  keyboard.text('📈 Пользователей всего', `order:edit:total:${orderId}`).row();
  keyboard.text('🕐 Распределить в течение дня', `order:toggle:distribute:${orderId}`).row();
  keyboard.text('📉 Учитывать отписки', `order:toggle:unsubscribes:${orderId}`).row();

  // Target audience
  keyboard.text('👥 NEW Настройка пользователей', `order:edit:audience:${orderId}`).row();

  // Financial
  keyboard.text('💸 Цена за подписчика', `order:edit:price:${orderId}`).row();
  keyboard.text('🚫 Исключенные тематики', `order:edit:topics:${orderId}`).row();

  // Schedule
  keyboard.text('🕐 Запуск по времени', `order:edit:start_time:${orderId}`).row();
  keyboard.text('📋 Расписание', `order:edit:schedule:${orderId}`).row();

  // Display locations
  keyboard.text('📍 Места показов', `order:edit:locations:${orderId}`).row();

  // Done button
  keyboard.text('✅ Готово', `order:config:done:${orderId}`);

  return keyboard;
}

/**
 * Target Audience Configuration Keyboard
 */
export function createAudienceConfigKeyboard(orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard.text('👤 Пол', `order:audience:gender:${orderId}`).row();
  keyboard.text('🌍 Регион', `order:audience:region:${orderId}`).row();
  keyboard.text('🎂 Возраст', `order:audience:age:${orderId}`).row();
  keyboard.text('⚡ Активность', `order:audience:activity:${orderId}`).row();
  keyboard.text('Сохранить', `order:audience:save:${orderId}`);

  return keyboard;
}

/**
 * Gender Selection Keyboard
 */
export function createGenderKeyboard(orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('Любой (по умолчанию)', `order:gender:${UserGender.Any}:${orderId}`)
    .row()
    .text('Мужской', `order:gender:${UserGender.Male}:${orderId}`)
    .row()
    .text('Женский', `order:gender:${UserGender.Female}:${orderId}`);

  return keyboard;
}

/**
 * Excluded Topics Keyboard
 */
export function createTopicsKeyboard(orderId: string, selectedTopics: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  availableTopics.forEach((topic) => {
    const isSelected = selectedTopics.includes(topic.id);
    const prefix = isSelected ? '☑' : '☐';
    keyboard.text(`${prefix} ${topic.name}`, `order:topic:${topic.id}:${orderId}`).row();
  });

  keyboard.text('Сохранить', `order:topics:save:${orderId}`);

  return keyboard;
}

/**
 * Display Location Selection Keyboard
 */
export function createLocationKeyboard(orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('📍 Только в моих ботах', `order:location:${OrderDisplayLocation.MyBotsOnly}:${orderId}`)
    .row()
    .text('🌐 Только в чужих ботах', `order:location:${OrderDisplayLocation.OtherBotsOnly}:${orderId}`)
    .row()
    .text('🔄 В моих и чужих ботах', `order:location:${OrderDisplayLocation.Both}:${orderId}`);

  return keyboard;
}

/**
 * A6: View Order Keyboard
 */
export function createViewOrderKeyboard(order: Order): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // View channel button
  if (order.channel.username) {
    keyboard.url('VIEW CHANNEL', `https://t.me/${order.channel.username}`).row();
  }

  // Refresh stats
  keyboard.text('🔄 Обновить статистику', `order:refresh:${order.id}`).row();

  // Settings and Statistics
  keyboard
    .text('⚙️ Настройки', `order:config:start:${order.id}`)
    .text('📊 Статистика', `order:stats:${order.id}`)
    .row();

  // Duplicate
  keyboard.text('📋 Дублировать', `order:duplicate:${order.id}`).row();

  // Start/Stop and Delete
  const actionText = order.status === OrderStatus.Active ? '⏸️ Остановить' : '▶️ Запустить';
  keyboard.text(actionText, `order:toggle:${order.id}`).text('🗑️ Удалить', `order:delete:${order.id}`).row();

  // Download IDs and Report
  keyboard
    .text('💾 Скачать ID участников', `order:download:ids:${order.id}`)
    .text('📄 Отчет (скачать PDF)', `order:download:report:${order.id}`)
    .row();

  // Help
  keyboard.text('❓ Заказ не работает? Причины', 'order:help:troubleshoot').row();

  // Balance section
  keyboard.text('⬇️ Баланс аккаунта ⬇️', 'balance:view').row();
  keyboard.text('👤 Остаток', 'balance:view').text('💸 Пополнить баланс', 'balance:topup').row();

  // Back to orders list
  keyboard.text('◀️ Назад к списку заказов', 'order:list');

  return keyboard;
}

/**
 * Order Statistics Keyboard
 */
export function createStatsKeyboard(orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('📥 Скачать полный отчет (Excel)', `order:download:excel:${orderId}`)
    .row()
    .text('◀️ Назад', `order:view:${orderId}`);

  return keyboard;
}

/**
 * Delete Confirmation Keyboard
 */
export function createDeleteConfirmKeyboard(orderId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard.text('✅ Да, удалить', `order:delete:confirm:${orderId}`).text('❌ Отмена', `order:view:${orderId}`);

  return keyboard;
}
