# Motiv-Buy [@MotivBuyRoBot](https://t.me/MotivBuyRoBot)

Цифровой маркетплейс для мотивированного трафика в Telegram. Построен на NestJS, TypeScript, PostgreSQL, Redis и NATS. Мультипровайдерные платежи, курсы в реальном времени, масштабируемая микросервисная архитектура.

## Автор

**@nmime** - [t.me/nmime](https://t.me/nmime)

## Технологический стек

- **Backend Framework:** NestJS 11.x + Fastify 5.x
- **Язык:** TypeScript 5.9 (strict mode)
- **База данных:** PostgreSQL с MikroORM 6.x
- **Кэш:** Redis (ioredis 5.x)
- **Очередь сообщений:** NATS 2.x
- **Платформа бота:** grammY 1.x
- **Платёжные провайдеры:** CryptoBot, Heleket, YooKassa
- **Провайдеры курсов (Крипто):** CoinGecko, Binance, CryptoCompare, Kraken, CoinCodex, Huobi, OKX
- **Провайдеры курсов (Фиат):** ExchangeRate API, Frankfurter, FreeCurrency API, Coinbase, OpenExchangeRates
- **Инструмент сборки:** Nx 22.x Monorepo
- **Пакетный менеджер:** pnpm 10.x
- **Контейнеризация:** Docker & Docker Compose

## Структура проекта

```
motiv-buy/
├── apps/
│   ├── api/          # REST API приложение
│   ├── bot/          # Telegram бот приложение
│   └── migration/    # CLI для миграций базы данных
├── libs/
│   ├── common/       # Общие компоненты
│   │   ├── exception/     # Обработка исключений
│   │   ├── health/        # Проверки работоспособности
│   │   ├── intl/          # Интернационализация
│   │   ├── logger/        # Утилиты логирования
│   │   ├── nats/          # NATS сообщения
│   │   ├── redis/         # Redis утилиты
│   │   ├── response/      # Форматирование ответов
│   │   ├── shared/        # Общие утилиты
│   │   └── validation/    # Валидационные пайпы
│   ├── database/     # Сущности и репозитории БД
│   └── feature/      # Доменные модули
│       ├── auth/          # Аутентификация и авторизация
│       ├── balance/       # Управление балансом пользователей
│       ├── bot/           # Функции бота
│       ├── currency/      # Управление валютами
│       ├── notification/  # Уведомления
│       ├── payment/       # Обработка платежей
│       ├── statistic/     # Статистика и аналитика
│       ├── traffic/       # Отслеживание трафика
│       └── user/          # Управление пользователями
├── config/           # Конфигурационные файлы
├── docs/            # Документация проекта
└── scripts/         # Вспомогательные скрипты
```

## Приложения

### API (`apps/api`)

REST API бэкенд, предоставляющий HTTP эндпоинты для веб-клиентов и внешних интеграций.

**Функции:**

- Аутентификация и авторизация пользователей
- Обработка платежей
- Управление балансом
- Статистика и аналитика
- Проверки работоспособности и мониторинг

### Bot (`apps/bot`)

Telegram бот интерфейс для взаимодействия с пользователями.

**Функции:**

- Интеграция с Telegram Bot API
- Интерактивные команды
- Уведомления о платежах
- Управление пользователями
- Бизнес-логика бота

### Migration (`apps/migration`)

CLI инструмент для управления миграциями схемы базы данных.

**Функции:**

- Создание миграций
- Запуск/откат миграций
- Проверка статуса миграций
- Настройка чистой базы данных

## Разработка

### Требования

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (опционально)

### Установка

```bash
# Установка зависимостей
pnpm install

# Сборка всех проектов
pnpm run build

# Запуск тестов
pnpm run test
```

### Команды разработки

```bash
# Запуск всех сервисов в режиме разработки
pnpm run dev

# Запуск конкретного приложения
pnpm run dev:api       # Запуск API сервера
pnpm run dev:bot       # Запуск Telegram бота
pnpm run dev:migration # Запуск CLI миграций

# Сборка конкретного приложения
pnpm run build:api
pnpm run build:bot
pnpm run build:migration

# Запуск тестов
pnpm run test              # Запуск всех тестов
pnpm run test:watch        # Режим наблюдения
pnpm run test:coverage     # С покрытием
pnpm run test:affected     # Только затронутые тесты

# Качество кода
pnpm run lint              # Проверка кода
pnpm run lint:fix          # Исправление проблем
pnpm run format            # Форматирование кода
pnpm run format:check      # Проверка форматирования

# Миграции базы данных
pnpm run migration:run     # Запуск ожидающих миграций
pnpm run migration:revert  # Откат последней миграции
pnpm run migration:status  # Проверка статуса миграций
pnpm run migration:create  # Создание новой миграции
pnpm run migration:fresh   # Чистая база данных (⚠️ УДАЛЯЕТ ВСЕ ТАБЛИЦЫ!)
```

## Деплой

### Быстрый старт - Деплой с нуля

**→ [docs/DEPLOY.md](docs/DEPLOY.md)** - Единое руководство со всем необходимым

Это руководство охватывает:

- Настройку сервера
- GitHub секреты (что заполнять и где)
- Деплой на staging
- Деплой на production

### GitHub Actions Workflows

- **CI:** Автоматическое тестирование, линтинг и Docker сборки (запускается при push/PR)
- **Deploy:** Ручной деплой на staging (любая ветка кроме master) или production (только master)
- **Update SSL:** Автоматическое обновление SSL сертификатов
- **CodeQL:** Анализ безопасности
- **Run Migrations:** Ручной запуск миграций базы данных

### Как деплоить

**Staging:**

```bash
# 1. Отправьте вашу ветку
git push origin feature/my-feature

# 2. Перейдите в GitHub → Actions → Deploy
# 3. Выберите вашу ветку и staging окружение
# 4. Нажмите "Run workflow"
```

**Production:**

```bash
# 1. Слейте в master
git checkout master
git merge feature/my-feature
git push origin master

# 2. Перейдите в GitHub → Actions → Deploy
# 3. Выберите ветку master и production окружение
# 4. Нажмите "Run workflow"
```

## Документация

### API документация (Production)

- **[External API (HTML)](https://api.motivbuy.com/api/v1/docs/external/html)** - Документация внешнего API (HTML)
- **[External API (JSON)](https://api.motivbuy.com/api/v1/docs/external)** - Документация внешнего API (OpenAPI JSON)
- **[Public API](https://api.motivbuy.com/api/v1/docs/public)** - Документация публичного API
- **[Private API](https://api.motivbuy.com/api/v1/docs/private)** - Документация приватного/внутреннего API

### Документация проекта

- **[CLAUDE.md](CLAUDE.md)** - Стандарты кода и рекомендации по разработке
- **[docs/DEPLOY.md](docs/DEPLOY.md)** - Деплой с нуля
- **[docs/](docs/)** - Вся документация

## Лицензия

MIT License - Свободно для использования, модификации и распространения.
