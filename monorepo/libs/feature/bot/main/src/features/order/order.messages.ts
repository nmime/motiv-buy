/**
 * Order Feature Messages
 *
 * Message templates for the order creation and management feature
 */

import { Order, OrderSessionState, ChannelInfo, OrderStatus } from './order.types';
import { escapeHtml } from './utils/html-escape.util';

/**
 * Main Menu Message (from specification)
 */
export function getMainMenuMessage(): string {
  return `═══════════════════════════════════════
        <b>SubGram - Реклама в телеграм ботах</b>
             12,403 monthly users
═══════════════════════════════════════

Выбери нужный пункт 👇`;
}

/**
 * A1: Order List Message
 */
export function getOrderListMessage(ordersCount: number): string {
  return `═══════════════════════════════════════
            <b>Мои заказы</b>
═══════════════════════════════════════

Всего заказов: ${ordersCount}

Выберите заказ для просмотра или создайте новый:`;
}

/**
 * A2: Channel Link Input Message
 */
export function getChannelLinkInputMessage(): string {
  return `═══════════════════════════════════════
         <b>Создание нового заказа</b>
             Шаг 1 из 4
═══════════════════════════════════════

Пришлите публичную или пригласительную
ссылку на Ваш канал/чат

<b>Примеры правильных ссылок:</b>
• https://t.me/yourchannel
• https://t.me/+InviteLink123abc`;
}

/**
 * A3: Add Bot as Admin Message
 */
export function getAddBotAdminMessage(channel: ChannelInfo, botUsername: string): string {
  return `═══════════════════════════════════════
         <b>Создание нового заказа</b>
             Шаг 2 из 4
═══════════════════════════════════════

Отлично! Канал найден ✅
<b>Название:</b> ${escapeHtml(channel.title)}
<b>Подписчиков:</b> ${channel.subscriberCount.toLocaleString()}

Теперь добавьте этот бот в
администраторы Вашего канала/чата:

      <code>@${escapeHtml(botUsername)}</code>

⚠️ <b>Это требуется, чтобы мы могли
получать точные данные о вступлениях
и отписках</b>`;
}

/**
 * A4: Moderation Status Message
 */
export function getModerationMessage(channel: ChannelInfo, botAdded: boolean): string {
  const botStatus = botAdded ? '✅ Бот добавлен в админы' : '⚠️ Бот не добавлен';

  return `═══════════════════════════════════════
         <b>Создание нового заказа</b>
             Шаг 3 из 4
═══════════════════════════════════════

Ваш заказ отправлен на модерацию! ✅

<b>Канал:</b> ${escapeHtml(channel.title)}
<b>Ссылка:</b> ${channel.username ? `t.me/${escapeHtml(channel.username)}` : 'Приватный канал'}
<b>Статус:</b> 🟡 Ожидает проверки
${botStatus}

Обычно модерация занимает 5-30 минут.
Мы уведомим вас, когда заказ будет
одобрен.

┌─────────────────────────────────────┐
│                                     │
│  Желаете настроить параметры        │
│  заказа прямо сейчас?               │
│                                     │
│  • Пол и регион подписчиков         │
│  • Количество в день                │
│  • Цену за подписчика               │
│  • Расписание показов               │
│                                     │
└─────────────────────────────────────┘`;
}

/**
 * A5: Configuration Menu Message
 */
export function getConfigurationMessage(order: Order): string {
  const config = order.config;

  return `═══════════════════════════════════════
          <b>Настройки заказа</b>
═══════════════════════════════════════

<b>━━━━━━━━━ ОСНОВНЫЕ НАСТРОЙКИ ━━━━━━━━━</b>

📝 <b>Название:</b> ${escapeHtml(config.name)}
🔗 <b>Ссылка:</b> ${escapeHtml(config.channelLink)}

<b>━━━━━━━ ПАРАМЕТРЫ ПОДПИСЧИКОВ ━━━━━━━━</b>

📊 <b>Пользователей в день:</b> ${config.usersPerDay}
📈 <b>Пользователей всего:</b> ${config.totalUsers}
🕐 <b>Распределить в течение дня:</b> ${config.distributeDaily ? 'Да ✅' : 'Нет ❌'}
📉 <b>Учитывать отписки:</b> ${config.accountUnsubscribes ? 'Да ✅' : 'Нет ❌'}

<b>━━━━━━━━ ТАРГЕТИНГ АУДИТОРИИ ━━━━━━━━━</b>

👥 <b>Пол:</b> ${getGenderText(config.targetAudience.gender)}
🌍 <b>Регион:</b> ${config.targetAudience.regions.length > 0 ? config.targetAudience.regions.join(', ') : 'Любой'}
⚡ <b>Активность:</b> ${config.targetAudience.activeOnly ? 'Только активные' : 'Любая'}

<b>━━━━━━━━━━━ ФИНАНСЫ ━━━━━━━━━━━━━━━━━</b>

💸 <b>Цена за подписчика:</b> ${config.pricePerSubscriber.toFixed(2)} ₽
🚫 <b>Исключенные тематики:</b> ${config.excludedTopics.length || 'Нет'}

<b>━━━━━━━━━ ЗАПУСК И РАСПИСАНИЕ ━━━━━━━━</b>

🕐 <b>Запуск:</b> ${config.startTime ? formatDate(config.startTime) : 'Сейчас'}
📋 <b>Расписание:</b> ${config.schedule ? 'Настроено' : 'Выкл.'}

<b>━━━━━━━━━━ МЕСТА ПОКАЗОВ ━━━━━━━━━━━━</b>

📍 <b>Показы:</b> ${getLocationText(config.displayLocation)}

<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>

💰 <b>Примерная стоимость:</b> ${(config.totalUsers * config.pricePerSubscriber).toFixed(2)} ₽`;
}

/**
 * A6: View Order Message
 */
export function getViewOrderMessage(order: Order, balance: number): string {
  const stats = order.stats;
  const config = order.config;

  return `═══════════════════════════════════════
           <b>Заказ #${escapeHtml(order.id)}</b>
═══════════════════════════════════════

<b>${escapeHtml(config.name)}</b>
🔗 ${escapeHtml(config.channelLink)}

Тематика: ${escapeHtml(order.channel.category || '🎮 Игры')}
Статус: ${getStatusEmoji(order.status)} ${getStatusText(order.status)}

<b>━━━━━━━━━ ПОЛЬЗОВАТЕЛИ ━━━━━━━━━━━━━━</b>

👥 <b>Всего:</b> ${stats.totalSubscribers.toLocaleString()}
📊 <b>За сегодня:</b> ${stats.subscribersToday}
📈 <b>CR (% оставшихся):</b> ${stats.conversionRate.toFixed(2)}%

💡 <b>CR (Conversion Rate)</b> - процент
подписчиков, которые остались в канале

• Чем ниже CR, тем ниже приоритет
  показа (норма - от 50% и выше)
• Если CR низкий, рекомендуем
  увеличить цену за подписчика

<b>━━━━━━━━━━━ ФИНАНСЫ ━━━━━━━━━━━━━━━━━</b>

💰 <b>Ср. цена подписчика:</b> ${stats.avgPrice.toFixed(2)}₽/пдп
💸 <b>Потрачено:</b> ${stats.totalSpent.toFixed(2)}₽
🎯 <b>План:</b> ${config.totalUsers} подписчиков
📊 <b>Примерная стоимость:</b> ${(config.totalUsers * config.pricePerSubscriber).toFixed(2)}₽

<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>

ℹ️ Фиксация подписчиков происходит
автоматически по понедельникам

<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>

          <b>ИНФОРМАЦИЯ О КАНАЛЕ</b>

  Telegram
  ${escapeHtml(order.channel.title)}
  ${escapeHtml(order.channel.description || 'Games catalog')}
  @${escapeHtml(order.channel.username || 'channel')}

<b>━━━━━━━━━━━━ БАЛАНС ━━━━━━━━━━━━━━━━━</b>

      ⬇️ <b>Баланс аккаунта</b> ⬇️

         <b>${balance.toFixed(2)} ₽</b>`;
}

/**
 * Order Statistics Detailed Message
 */
export function getOrderStatsMessage(order: Order): string {
  const stats = order.stats;

  let dailyStatsText = '';
  stats.dailyStats.slice(-7).forEach(day => {
    dailyStatsText += `\n📅 ${day.date}: ${day.subscribers} подписчиков (CR: ${day.conversionRate.toFixed(2)}%)`;
  });

  return `═══════════════════════════════════════
        <b>Статистика заказа #${order.id}</b>
═══════════════════════════════════════

<b>📊 Подробная статистика:</b>

За сегодня: ${stats.subscribersToday} подписчиков
За неделю: ${stats.dailyStats.slice(-7).reduce((sum, d) => sum + d.subscribers, 0)} подписчиков
За месяц: ${stats.totalSubscribers} подписчиков

<b>📉 Отписки:</b>
Всего: ${stats.unsubscribes}
За неделю: ${stats.dailyStats.slice(-7).reduce((sum, d) => sum + d.unsubscribes, 0)}

<b>🎯 Conversion Rate:</b>
Текущий: ${stats.conversionRate.toFixed(2)}%
За неделю: ${(stats.dailyStats.slice(-7).reduce((sum, d) => sum + d.conversionRate, 0) / 7).toFixed(2)}%

<b>💰 Финансы:</b>
Потрачено за месяц: ${stats.totalSpent.toFixed(2)}₽
Средняя цена: ${stats.avgPrice.toFixed(2)}₽

<b>📈 Последние 7 дней:</b>${dailyStatsText}`;
}

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  invalidLink: '❌ Неверный формат ссылки. Пожалуйста, отправьте ссылку в формате https://t.me/...',
  channelNotFound: '❌ Канал не найден. Проверьте, что канал существует и ссылка правильная',
  noAccess: '❌ Нет доступа к каналу. Убедитесь, что канал публичный или ссылка действительна',
  botNotAdmin: '❌ Бот не найден в администраторах канала. Пожалуйста, добавьте его и попробуйте снова',
  insufficientBalance: '❌ Недостаточно средств. Пополните баланс',
  moderationRejected: '❌ Заказ отклонен модерацией. Причина: {reason}',
};

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  orderCreated: '✅ Заказ создан успешно!',
  orderUpdated: '✅ Заказ обновлен',
  orderStarted: '✅ Заказ запущен! Показы начнутся в течение 5 минут',
  orderStopped: '✅ Заказ остановлен',
  orderDeleted: '✅ Заказ удален',
  botAdded: '✅ Бот успешно добавлен в администраторы',
  configSaved: '✅ Настройки сохранены',
  statsCopied: '✅ Статистика скопирована в буфер обмена',
};

/**
 * Helper functions
 */

function getGenderText(gender: string): string {
  const genderMap: Record<string, string> = {
    any: 'Любой',
    male: 'Мужской',
    female: 'Женский',
  };
  return genderMap[gender] || 'Любой';
}

function getLocationText(location: string): string {
  const locationMap: Record<string, string> = {
    my_bots_only: 'Только в моих ботах',
    other_bots_only: 'Только в чужих ботах',
    both: 'В моих и чужих ботах',
  };
  return locationMap[location] || 'В моих и чужих ботах';
}

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

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
