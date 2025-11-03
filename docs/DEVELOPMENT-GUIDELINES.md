# **MOTIV-BUY DEVELOPMENT GUIDELINES**

## 📋 **1. CODE CONVENTIONS**

### **1.1 TypeScript Configuration**
- **Strict Mode:** ALWAYS enabled (`strict: true`)
- **Target:** ES2023 with CommonJS modules
- **Decorators:** Enabled for NestJS (`emitDecoratorMetadata`, `experimentalDecorators`)
- **Source Maps:** Always generate for debugging
- **Incremental:** Build incrementally for faster compilation
- **NO `any` TYPE:** Forbidden - use proper types or `unknown`
- **NO `as` ASSERTIONS:** Avoid unless critically needed - use type guards instead

### **1.2 TypeScript Strict Rules**

#### **FORBIDDEN: `any` Type**
```typescript
// ❌ FORBIDDEN:
function processData(data: any) {
  return data.value;
}

const result: any = await fetchData();

// ✅ CORRECT: Use proper types
function processData(data: UserData | ProductData) {
  return data.value;
}

const result: ApiResponse<UserData> = await fetchData();

// ✅ CORRECT: Use unknown if type truly unknown
function processData(data: unknown) {
  if (isUserData(data)) {
    return data.value;
  }
  throw new Error('Invalid data');
}
```

#### **FORBIDDEN: Type Assertions (unless critical)**
```typescript
// ❌ AVOID:
const user = response.data as User;
const element = document.getElementById('root') as HTMLElement;

// ✅ CORRECT: Use type guards
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  );
}

const user = response.data;
if (isUser(user)) {
  // TypeScript knows user is User here
  console.log(user.name);
}

// ✅ ACCEPTABLE: DOM elements (critically needed)
const element = document.getElementById('root');
if (element instanceof HTMLElement) {
  element.style.color = 'red';
}

// ✅ ACCEPTABLE: Type narrowing when safe
const error = new Error('message') as CustomError;  // When extending Error
```

#### **Use `unknown` Instead of `any`**
```typescript
// ✅ CORRECT: Handle unknown data
function handleError(error: unknown): void {
  if (error instanceof Error) {
    this.logger.error('Error occurred', error);
  } else if (typeof error === 'string') {
    this.logger.error('Error occurred', new Error(error));
  } else {
    this.logger.error('Unknown error', new Error('Unknown error'));
  }
}

// ✅ CORRECT: Validate external data
function parseApiResponse(data: unknown): User {
  if (!isValidUserData(data)) {
    throw new ValidationException('Invalid user data');
  }
  return data;  // TypeScript knows data is User now
}
```

### **1.3 Naming Conventions**

#### **Files:**
```
✅ CORRECT:
- auth.controller.ts         (Controllers)
- auth.service.ts            (Services)
- jwt-auth.guard.ts          (Guards)
- auth-response.dto.ts       (DTOs)
- User.entity.ts             (Entities - PascalCase)
- User.repository.ts         (Repositories)
- auth.module.ts             (Modules)
- auth.service.spec.ts       (Tests)

❌ INCORRECT:
- AuthController.ts          (use lowercase with dots)
- user_entity.ts             (use dots, not underscores)
- auth-service-spec.ts       (use .spec.ts not -spec.ts)
```

#### **Classes & Types:**
```typescript
✅ CORRECT:
class UserEntity {}          // PascalCase for classes
enum UserStatus {}           // NO "Enum" suffix!
interface AuthConfig {}      // PascalCase for interfaces
type AsyncResult<T, E> = ... // PascalCase for types

❌ INCORRECT:
enum UserStatusEnum {}       // FORBIDDEN by ESLint
class user_entity {}         // Must be PascalCase
```

#### **Variables & Functions:**
```typescript
✅ CORRECT:
const userId = '123';                    // camelCase
let firstName = 'John';                  // camelCase
async function createUser() {}           // camelCase
const _privateVar = 'test';              // Leading underscore allowed

❌ INCORRECT:
const UserId = '123';                    // Not PascalCase
const user_id = '123';                   // Not snake_case
```

#### **Enum Members:**
```typescript
✅ CORRECT:
enum UserStatus {
  Active = 'Active',                     // StrictPascalCase
  Inactive = 'Inactive',
  Blocked = 'Blocked',
}

❌ INCORRECT:
enum UserStatus {
  active = 'active',                     // Must be PascalCase
  ACTIVE = 'ACTIVE',                     // Not SCREAMING_SNAKE_CASE
}
```

### **1.4 Import/Export Patterns**

#### **Import Order:**
```typescript
// 1. External dependencies
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 2. Absolute path imports (@app/...)
import { AsyncResult, Ok, Err } from '@app/common-shared';
import { UserRepository } from '@app/database';

// 3. Relative imports (use sparingly, prefer absolute)
import { AuthService } from '../service';
```

#### **Barrel Exports (index.ts):**
```typescript
// libs/common/exception/src/index.ts
export * from './abstract';
export * from './decorator';
export * from './dto';
export * from './exception-general';
export * from './factory';
```

**Benefits:** Clean imports across the codebase
```typescript
// Instead of:
import { BaseException } from '@app/common-exception/abstract/base.exception';

// Use:
import { BaseException } from '@app/common-exception';
```

### **1.5 Module Architecture**

#### **🚨 CRITICAL: Feature Module Import Rules**

**ABSOLUTE RULES:**
1. **ALL shared functionality MUST be created in `libs`** - because it will be used by both API app and bot app
2. **`libs/feature/*/main`** - Domain-specific business logic and services used by THIS domain AND apps
3. **`libs/feature/*/shared`** - Domain-related utilities/types/guards that OTHER domains can use
4. **Never import `main` modules in libs** - this causes circular dependencies

```
/libs/feature/auth/
  ├── main/                  # ⚠️ ONLY for apps (apps/api, apps/bot)
  │   │                      # Contains: Business logic for THIS domain
  │   ├── controller/        # HTTP endpoints (apps use these)
  │   ├── service/           # Core auth business logic (used by this domain + apps)
  │   └── auth-main.module.ts
  └── shared/                # ✅ Can be used by other libs AND apps
      │                      # Contains: Domain utilities OTHER domains need
      ├── dto/               # Data transfer objects (other domains may use)
      ├── guard/             # JwtAuthGuard (other domains use for protection)
      ├── decorator/         # @CurrentUserId() (other domains use)
      ├── type/              # Auth-related types (other domains reference)
      └── auth-shared.module.ts
```

#### **Import Examples:**

```typescript
// ❌ FORBIDDEN: Lib importing another lib's main module
// File: libs/feature/payment/main/src/service/payment.service.ts
import { AuthService } from '@app/feature-auth-main';  // WRONG! Circular dependency risk

// ✅ CORRECT: Lib importing another lib's shared utilities
// File: libs/feature/payment/main/src/controller/payment.controller.ts
import { JwtAuthGuard, CurrentUserId } from '@app/feature-auth-shared';  // CORRECT!

// ✅ CORRECT: Using shared DTOs and types
// File: libs/feature/user/main/src/service/user.service.ts
import { UserStatus, UserDto } from '@app/feature-user-shared';  // CORRECT!
import { AuthResponseDto } from '@app/feature-auth-shared';      // CORRECT!

// ✅ CORRECT: Apps importing main modules
// File: apps/api/src/api.module.ts
import { AuthMainModule } from '@app/feature-auth-main';    // CORRECT!
import { UserMainModule } from '@app/feature-user-main';    // CORRECT!
import { PaymentMainModule } from '@app/feature-payment-main';  // CORRECT!

// ✅ CORRECT: Apps can also import shared if needed
// File: apps/bot/src/bot.module.ts
import { UserMainModule } from '@app/feature-user-main';    // CORRECT!
import { UserStatus } from '@app/feature-user-shared';      // CORRECT!
```

#### **What Goes in `main` vs `shared`:**

**`feature/*/main/` (Domain business logic + Apps only):**
- **Controllers** - HTTP endpoints that apps expose
- **Services** - Core business logic for THIS domain
- **Domain-specific logic** - Functions used by this feature and consumed by apps
- **Feature module** - Main module definition that apps import
- **Internal providers** - Services that support this domain's functionality

**Examples:**
- `AuthService.login()` - Core auth logic (used by AuthController and apps)
- `UserService.createUser()` - User creation logic (used by UserController and apps)
- `PaymentService.processPayment()` - Payment logic (used by PaymentController and apps)

**`feature/*/shared/` (Cross-domain utilities):**
- **DTOs** - Data structures OTHER domains need to reference
- **Guards** - Protection mechanisms OTHER domains use (e.g., `JwtAuthGuard`)
- **Decorators** - Utilities OTHER domains use (e.g., `@CurrentUserId()`)
- **Interfaces/Types** - Type definitions OTHER domains reference
- **Constants** - Enums and constants OTHER domains need (e.g., `UserStatus`)
- **Validators** - Validation logic OTHER domains reuse
- **Utilities** - Helper functions OTHER domains call

**Examples:**
- `JwtAuthGuard` - Used by payment, user, and other domains to protect routes
- `@CurrentUserId()` - Used by payment, user domains to get authenticated user
- `AuthResponseDto` - Referenced by other domains that return auth data
- `UserStatus` enum - Referenced by other domains that work with users

#### **Module Definition Pattern:**
```typescript
// libs/feature/auth/main/src/auth-main.module.ts
@Module({
  imports: [
    DatabaseModule,          // Core infrastructure
    AuthSharedModule,        // Own shared module
    UserSharedModule,        // Other feature's shared (✅ allowed)
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],    // Export for apps to use
})
export class AuthMainModule {}

// libs/feature/auth/shared/src/auth-shared.module.ts
@Module({
  imports: [JwtModule],
  providers: [JwtAuthGuard, JwtStrategy],
  exports: [JwtAuthGuard, JwtStrategy],
})
export class AuthSharedModule {}
```

#### **Dependency Graph:**
```
apps/
  ├── api/                    ✅ Imports: auth-main, user-main, payment-main
  │   └── Uses both app and bot → ALL shared functionality in libs
  └── bot/                    ✅ Imports: auth-main, user-main
      └── Uses both app and bot → ALL shared functionality in libs

libs/feature/
  ├── auth/
  │   ├── main/              ⚠️  Only imported by apps (api, bot)
  │   │   ├── service/       # AuthService - business logic for auth domain
  │   │   └── controller/    # AuthController - HTTP endpoints for api app
  │   └── shared/            ✅ Imported by other libs & apps
  │       ├── guard/         # JwtAuthGuard - used by payment, user controllers
  │       ├── decorator/     # @CurrentUserId() - used by payment, user
  │       └── dto/           # AuthResponseDto - referenced by others
  ├── user/
  │   ├── main/              ⚠️  Only imported by apps (api, bot)
  │   │   ├── service.ts     # UserService - business logic for user domain
  │   │   │   └── ✅ Imports: auth-shared (JwtAuthGuard, CurrentUserId)
  │   │   └── controller.ts  # UserController - HTTP endpoints
  │   │       └── ✅ Imports: auth-shared (JwtAuthGuard, CurrentUserId)
  │   └── shared/            ✅ Imported by other libs & apps
  │       ├── dto/           # UserDto - referenced by payment
  │       ├── type/          # UserStatus enum - used by payment
  │       └── decorator/     # User-related decorators
  └── payment/
      ├── main/              ⚠️  Only imported by apps (api, bot)
      │   ├── service.ts     # PaymentService - business logic for payment
      │   │   └── ✅ Imports: user-shared, auth-shared (NOT main!)
      │   └── controller.ts  # PaymentController - HTTP endpoints
      │       └── ✅ Imports: user-shared, auth-shared, JwtAuthGuard
      └── shared/            ✅ Imported by other libs & apps
          ├── dto/           # PaymentDto - can be used by others
          └── type/          # Payment-related types
```

#### **Key Architectural Principle:**

> **"Any functionality used by BOTH api app AND bot app MUST live in libs"**

This ensures:
- ✅ Code reuse between apps
- ✅ No duplication of business logic
- ✅ Single source of truth
- ✅ Clean dependency boundaries
- ✅ No circular dependencies

### **1.6 Dependency Injection**

#### **Constructor Injection Pattern:**
```typescript
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userRepository: UserRepository,
    @InjectRedis() private readonly redisClient: RedisClient,
    private readonly configService: ConfigService,
  ) {}
}
```

**Rules:**
- Use `private readonly` for injected dependencies
- Use `@Inject()` decorators for custom tokens
- Initialize logger with class name for context

### **1.7 Error Handling with Result Types**

#### **Service Layer - Return Results:**
```typescript
import { AsyncResult, Ok, Err } from '@app/common-shared';

// ✅ CORRECT: Return Result type
async authDev(userId: string): AsyncResult<AuthResultDto, NotInDevModeException> {
  if (!this.configService.isDev) {
    return Err(new NotInDevModeException());
  }

  const token = await this.jwtService.signAsync({ userId });
  return Ok(new AuthResultDto({ token }));
}

// ❌ INCORRECT: Don't throw from services
async authDev(userId: string): Promise<AuthResultDto> {
  if (!this.configService.isDev) {
    throw new NotInDevModeException();  // Don't do this!
  }
  return new AuthResultDto({ token });
}
```

#### **Controller Layer - Let Interceptor Handle:**
```typescript
@Get('/auth/dev')
async authDev(@Query() dto: AuthDevRequestDto): AsyncResult<...> {
  // Return result directly, ResponseTransformer unwraps it
  return await this.authService.authDev(dto.id);
}
```

**How it Works:**
1. Service returns `Ok(value)` or `Err(exception)`
2. `ResponseTransformer` interceptor unwraps result
3. If `Err`, throws the exception → HTTP error response
4. If `Ok`, returns the value → HTTP success response

### **1.8 DTO Validation**

#### **Always Validate with Decorators:**
```typescript
import { IsString, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramWidgetAuthDto {
  @ApiProperty({ description: 'Telegram user ID', example: '123456789' })
  @IsNumberString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hash!: string;
}
```

**Rules:**
- ALWAYS use `class-validator` decorators
- ALWAYS add `@ApiProperty()` for Swagger docs
- Use `!` for required fields (non-null assertion)
- Use `?` for optional fields

### **1.9 Async/Await Best Practices**

#### **Parallel Execution:**
```typescript
// ✅ CORRECT: Run independent operations in parallel
const [total, active, blocked] = await Promise.all([
  this.userRepository.count(),
  this.userRepository.count({ status: UserStatus.Active }),
  this.userRepository.count({ status: UserStatus.Blocked }),
]);

// ❌ INCORRECT: Sequential when parallel is possible
const total = await this.userRepository.count();
const active = await this.userRepository.count({ status: UserStatus.Active });
const blocked = await this.userRepository.count({ status: UserStatus.Blocked });
```

#### **Error Handling in Non-Critical Operations:**
```typescript
// For operations like logging/tracking that shouldn't break main flow
async trackUserActivity(userId: string): Promise<void> {
  try {
    await this.redisClient.set(`activity:${userId}`, Date.now());
  } catch (error: unknown) {  // ✅ Note: unknown, not any
    this.logger.error('Failed to track activity', error);
    // Don't throw - this is non-critical
  }
}
```

---

## 🔒 **2. SECURITY PRACTICES**

### **2.1 Environment Variables**

#### **NEVER Use process.env Directly:**
```typescript
// ❌ WRONG:
const secret = process.env.JWT_SECRET;

// ✅ CORRECT:
@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  getSecret(): string {
    return this.configService.get<string>('JWT_SECRET');
  }
}
```

#### **Configuration Module Pattern:**
```typescript
export interface AppConfig {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
}

export function createAppConfig(configService: ConfigService): AppConfig {
  return {
    nodeEnv: configService.get<string>('NODE_ENV', 'development'),
    port: configService.get<number>('PORT', 3000),
    jwtSecret: configService.getOrThrow<string>('JWT_SECRET'), // Throws if missing
  };
}
```

### **2.2 Secrets Management**

#### **NEVER Commit:**
- `.env` files with actual secrets
- API keys, tokens, passwords
- Database credentials
- Private keys

#### **ALWAYS:**
- Use `.env.example` with dummy values
- Store secrets in environment variables
- Use `ConfigService.getOrThrow()` for critical config
- Validate configuration on startup

### **2.3 Authentication & Authorization**

#### **JWT Authentication Pattern:**
```typescript
// Guard implementation
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    return super.canActivate(context);
  }
}

// Controller usage
@Controller('profile')
export class ProfileController {
  @Get()
  @UseGuards(JwtAuthGuard)  // Require authentication
  async getProfile(@CurrentUserId() userId: string): AsyncResult<UserDto, UserNotFoundException> {
    return this.profileService.getProfile(userId);
  }
}
```

#### **Current User Decorator (Secure):**
```typescript
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return request.user.userId;
  }
);
```

### **2.4 Input Validation**

#### **ALWAYS Validate ALL Inputs:**
```typescript
// DTO with validation
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password!: string;
}
```

#### **SQL Injection Prevention:**
```typescript
// ✅ CORRECT: Use ORM methods (MikroORM handles escaping)
await this.userRepository.findOne({ email: userEmail });

// ❌ WRONG: Raw queries without parameters
await em.getConnection().execute(`SELECT * FROM users WHERE email = '${userEmail}'`);

// ✅ CORRECT: If you must use raw queries, use parameters
await em.getConnection().execute(
  'SELECT * FROM users WHERE email = ?',
  [userEmail],
);
```

### **2.5 Rate Limiting**

#### **Module-Level Configuration:**
```typescript
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,      // 1 second
        limit: 3,        // 3 requests max
      },
      {
        name: 'long',
        ttl: 60000,     // 1 minute
        limit: 100,      // 100 requests max
      },
    ]),
  ],
})
```

#### **Endpoint-Level:**
```typescript
@Post('login')
@Throttle({ short: { limit: 5, ttl: 60000 } })  // 5 login attempts per minute
async login(@Body() dto: LoginDto): AsyncResult<AuthResultDto, InvalidCredentialsException> {
  return this.authService.login(dto);
}
```

### **2.6 Logging Security**

#### **Automatic Redaction:**
```typescript
// Protected variables (automatically redacted by logger):
const protectedVars = [
  'authorization',
  'password',
  'api-key',
  'token',
  'jwt',
  'secret',
  'cookie',
];

// ✅ CORRECT: Logger automatically redacts
this.logger.debug('User login', {
  email: 'user@example.com',
  password: 'secret123',  // Will be [redacted]
});

// Output: User login { email: 'user@example.com', password: '[redacted]' }
```

#### **Don't Log Sensitive Data:**
```typescript
// ❌ WRONG:
this.logger.log(`User ${userId} paid with card ${cardNumber}`);

// ✅ CORRECT:
this.logger.log(`User ${userId} completed payment`, {
  paymentMethod: 'card',
  last4: cardNumber.slice(-4),  // Only last 4 digits
});
```

### **2.7 Telegram Authentication Validation**

#### **Always Validate Telegram Widget Data:**
```typescript
import { checkSignature } from '@grammyjs/validator';

async validateTelegramAuth(dto: TelegramWidgetAuthDto): AsyncResult<User, TmaDataValidationException> {
  // 1. Validate signature
  const isValid = checkSignature(this.botToken, {
    id: dto.id,
    first_name: dto.first_name,
    auth_date: dto.auth_date,
    hash: dto.hash,
  });

  if (!isValid) {
    return Err(new TmaDataValidationException('Invalid signature'));
  }

  // 2. Check auth date freshness (24 hours max)
  const authTimestamp = Number(dto.auth_date);
  const currentTime = Math.floor(Date.now() / 1000);

  if (currentTime - authTimestamp > 24 * 60 * 60) {
    return Err(new TmaDataValidationException('Auth data expired'));
  }

  return Ok(/* proceed */);
}
```

---

## 🎨 **3. CODE STYLE**

### **3.1 Prettier Configuration**
```json
{
  "singleQuote": true,           // Use 'text' not "text"
  "trailingComma": "all",        // Trailing commas everywhere
  "tabWidth": 2,                 // 2 spaces (not tabs)
  "printWidth": 120,             // 120 character line length
  "endOfLine": "lf",             // Unix line endings
  "semi": true,                  // Semicolons required
  "arrowParens": "always",       // (x) => x not x => x
  "bracketSpacing": true         // { x } not {x}
}
```

### **3.2 Code Formatting Rules**

#### **Strings:**
```typescript
// ✅ CORRECT:
const name = 'John';
const greeting = `Hello, ${name}`;

// ❌ INCORRECT:
const name = "John";           // Use single quotes
const greeting = 'Hello ' + name;  // Use template literals for concatenation
```

#### **Object Literals:**
```typescript
// ✅ CORRECT:
const user = {
  name,              // Shorthand
  age: 25,
  isActive: true,
};

// ❌ INCORRECT:
const user = {
  name: name,        // Don't repeat property name
  age: 25,
  isActive: true
};                   // Missing trailing comma
```

#### **Arrays:**
```typescript
// ✅ CORRECT:
const items = [
  'item1',
  'item2',
  'item3',           // Trailing comma
];

// ❌ INCORRECT:
const items = [
  'item1',
  'item2',
  'item3'            // Missing trailing comma
];
```

### **3.3 Spacing Rules**

#### **Blank Lines Before Returns:**
```typescript
// ✅ CORRECT:
function calculateTotal(items: Item[]): number {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * 0.1;

  return subtotal + tax;  // Blank line before return
}

// ❌ INCORRECT:
function calculateTotal(items: Item[]): number {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * 0.1;
  return subtotal + tax;  // No blank line
}
```

#### **Class Member Spacing:**
```typescript
// ✅ CORRECT:
class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepository: UserRepository) {}

  async findUser(id: string): Promise<User> {
    return this.userRepository.findOne({ id });
  }

  private validateUser(user: User): boolean {
    return user.status === UserStatus.Active;
  }
}
```

### **3.4 Forbidden Patterns**

#### **No var:**
```typescript
// ❌ FORBIDDEN:
var x = 10;

// ✅ USE:
const x = 10;  // If value doesn't change
let y = 20;    // If value changes
```

#### **No console:**
```typescript
// ❌ FORBIDDEN (in production code):
console.log('Debug message');

// ✅ USE:
this.logger.log('Debug message');
this.logger.debug('Debug details', { context });
this.logger.error('Error occurred', error);
```

#### **No Template Curly in Strings:**
```typescript
// ❌ FORBIDDEN:
const message = 'Hello ${name}';  // Won't interpolate!

// ✅ USE:
const message = `Hello ${name}`;  // Backticks for templates
```

#### **Use Explicit Equality:**
```typescript
// ❌ AVOID:
if (user == null) {}

// ✅ USE:
if (user === null || user === undefined) {}
// Or:
if (!user) {}
```

### **3.5 TypeScript Specific**

#### **Explicit Return Types:**
```typescript
// ✅ CORRECT:
async function getUser(id: string): Promise<User | null> {
  return await userRepository.findOne({ id });
}

// ❌ AVOID (implicit return type):
async function getUser(id: string) {
  return await userRepository.findOne({ id });
}
```

#### **Explicit Accessibility:**
```typescript
// ✅ CORRECT:
class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly repository: UserRepository) {}

  async findUser(id: string): Promise<User> {}

  private validateUser(user: User): boolean {}
}

// Note: public keyword is optional (default), just omit it
```

---

## 📚 **4. USAGE PATTERNS**

### **4.1 Database Operations (MikroORM)**

#### **Entity Definition:**
```typescript
@Entity({ tableName: 'users' })
@Index({ name: 'ix__users__telegram_id', properties: ['telegramId'] })
export class UserEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'bigint', unique: true, fieldName: 'telegram_id' })
  telegramId!: string;

  @Property({ type: 'varchar', length: 100 })
  firstName!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Enum(() => UserStatus)
  @Property({ type: 'varchar', length: 20 })
  status!: UserStatus;

  @OneToMany('UserBalanceEntity', 'user')
  balances = new Collection<UserBalanceEntity>(this);

  constructor(data: EntityConstructorData<UserEntity>) {
    Object.assign(this, data);
  }
}
```

**Rules:**
- Use `fieldName` for snake_case column names
- Always specify column types explicitly
- Use indexes for frequently queried fields
- Use `defaultRaw` for database-level defaults

#### **Repository Pattern:**
```typescript
export class UserRepository extends EntityRepository<UserEntity> {
  async findByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return this.findOne({ telegramId });
  }

  async createUser(data: CreateUserData): Promise<UserEntity> {
    const user = new UserEntity(data);
    await this.em.persistAndFlush(user);

    return user;
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<void> {
    await this.nativeUpdate({ id }, { status });
  }
}
```

**Rules:**
- Encapsulate queries in repository methods
- Use `persistAndFlush()` for immediate persistence
- Use `nativeUpdate()` for bulk updates
- Return `null` for not found (not undefined)

### **4.2 Exception Handling**

#### **Creating Custom Exceptions:**
```typescript
export class UserNotFoundException extends Exception({
  kind: ExceptionKind.NotFound,
  problemType: 'user_not_found',
  title: 'User Not Found',
}) {
  constructor() {
    super({
      detail: 'User not found',
    });
  }
}
```

#### **Documenting Exceptions:**
```typescript
@Get('/users/:id')
@ApiProblemExceptions([
  [UserNotFoundException, { description: 'User does not exist' }],
  [UnauthorizedException, { description: 'Not authenticated' }],
])
async getUser(@Param('id') id: string): AsyncResult<UserDto, UserNotFoundException> {
  return this.userService.findById(id);
}
```

### **4.3 Logging Best Practices**

#### **Logger Initialization:**
```typescript
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);  // Use class name
}
```

#### **Log Levels:**
```typescript
// DEBUG: Detailed diagnostic information
this.logger.debug('Processing auth request', { userId, method: 'jwt' });

// LOG (INFO): General informational messages
this.logger.log('User authenticated successfully', { userId });

// WARN: Warning messages
this.logger.warn('Token near expiration', { userId, expiresIn: '5m' });

// ERROR: Error conditions
this.logger.error('Authentication failed', error, { userId });
```

#### **Contextual Logging:**
```typescript
// ✅ CORRECT: Include context
this.logger.log('User created', {
  userId: user.id,
  telegramId: user.telegramId,
  timestamp: new Date(),
});

// ❌ AVOID: Generic messages
this.logger.log('Success');
```

### **4.4 Testing Patterns**

#### **Unit Test Structure:**
```typescript
describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as jest.Mocked<JwtService>;

    mockUserRepository = {
      findOne: jest.fn(),
      persistAndFlush: jest.fn(),
    } as jest.Mocked<UserRepository>;

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('authDev', () => {
    it('should return error when not in dev mode', async () => {
      const result = await service.authDev('123');

      expect(result.err).toBe(true);
      expect(result.val).toBeInstanceOf(NotInDevModeException);
    });

    it('should return auth token in dev mode', async () => {
      mockJwtService.signAsync.mockResolvedValue('token123');

      const result = await service.authDev('123');

      expect(result.ok).toBe(true);
      expect(result.val).toEqual({ token: 'token123' });
    });
  });
});
```

### **4.5 Configuration Management**

#### **Creating Config Interfaces:**
```typescript
export interface DatabaseConfig {
  host: string;
  port: number;
  dbName: string;
  user: string;
  password: string;
  debug: boolean;
}

export function createDatabaseConfig(config: ConfigService): DatabaseConfig {
  return {
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.get<number>('DB_PORT', 5432),
    dbName: config.getOrThrow<string>('DB_NAME'),
    user: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    debug: config.get<string>('NODE_ENV') === 'development',
  };
}
```

#### **Using Configuration:**
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateConfig,  // Validate on startup
    }),
  ],
})
export class AppModule {}
```

### **4.6 API Documentation**

#### **Swagger Decorators:**
```typescript
@Controller('users')
@ApiTags('users')  // Group in Swagger UI
export class UserController {
  @Get('/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiOkResponse({ type: UserDto, description: 'User found' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBearerAuth()  // Requires JWT
  async getUser(@Param('id') id: string): AsyncResult<UserDto, UserNotFoundException> {
    return this.userService.findById(id);
  }
}
```

#### **DTO Documentation:**
```typescript
export class UserDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'John', description: 'User first name' })
  firstName!: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  email?: string;
}
```

### **4.7 Module Composition**

#### **Feature Module:**
```typescript
@Module({
  imports: [
    DatabaseModule,              // Shared database connection
    ConfigModule,                 // Global config
    AuthSharedModule,            // ✅ Shared guards/decorators
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserRepository,
  ],
  exports: [
    UserService,                 // Export for other modules
  ],
})
export class UserMainModule {}
```

#### **Root App Module:**
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot(),
    RedisModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // ✅ Feature modules (main modules only in apps)
    AuthMainModule,
    UserMainModule,
    PaymentMainModule,
  ],
})
export class ApiModule {}
```

---

## 🚀 **5. BUILD & DEPLOYMENT**

### **5.1 Build Commands**
```bash
# Development
pnpm dev:api                    # Run API in dev mode
pnpm dev:bot                    # Run bot in dev mode

# Build
pnpm build                      # Build all projects
pnpm build:api                  # Build API only
pnpm build:bot                  # Build bot only

# Testing
pnpm test                       # Run all tests
pnpm test:watch                 # Watch mode
pnpm test:coverage              # With coverage
pnpm test:affected              # Only affected by changes

# Code Quality
pnpm lint                       # Lint all code
pnpm lint:fix                   # Auto-fix linting issues
pnpm typecheck                  # Type checking
pnpm format                     # Format with Prettier

# Database
pnpm migration:create           # Create new migration
pnpm migration:run              # Run pending migrations
pnpm migration:revert           # Revert last migration
```

### **5.2 Environment Setup**
```bash
# Required for all environments
NODE_ENV=development|production
PORT=3000
JWT_SECRET=minimum_32_characters_long_secret_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=motivbuy
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password

# Optional
LOG_LEVEL=debug|info|warn|error
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

---

## ✅ **6. PRE-COMMIT CHECKLIST**

Before committing code, ensure:

- [ ] All tests pass (`pnpm test`)
- [ ] No linting errors (`pnpm lint`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Code formatted with Prettier (`pnpm format`)
- [ ] No `console.log` statements in production code
- [ ] No secrets or `.env` files committed
- [ ] All DTOs have validation decorators
- [ ] All endpoints have Swagger documentation
- [ ] Services return `AsyncResult<T, E>` types
- [ ] Error handling follows Result pattern
- [ ] Logger used instead of console
- [ ] Configuration uses `ConfigService`
- [ ] **No `any` types used**
- [ ] **No `as` assertions (unless critically needed)**
- [ ] **No `main` module imports in libs**
- [ ] **Only `shared` modules imported between libs**

---

## 📦 **7. ARCHITECTURE SUMMARY**

### **Dependency Flow:**
```
apps/
  ├── api/                   # REST API server
  │   └── Imports: *-main modules ✅
  │   └── Reason: Consumes business logic from libs
  └── bot/                   # Telegram bot
      └── Imports: *-main modules ✅
      └── Reason: Consumes same business logic as API

🔑 KEY RULE: Any functionality used by BOTH api AND bot → MUST be in libs!

libs/
  ├── common/                # Infrastructure (exceptions, logging, validation)
  │   └── Can be imported anywhere ✅
  ├── database/              # ORM, entities, repositories
  │   └── Can be imported anywhere ✅
  └── feature/               # Domain business logic
      ├── auth/
      │   ├── main/          ⚠️  Only apps import (AuthService, AuthController)
      │   │   └── Contains: Core auth business logic
      │   └── shared/        ✅ Anyone imports (JwtAuthGuard, @CurrentUserId)
      │       └── Contains: Auth utilities OTHER domains need
      ├── user/
      │   ├── main/          ⚠️  Only apps import (UserService, UserController)
      │   │   └── Imports: auth-shared ✅ (uses JwtAuthGuard)
      │   │   └── Contains: Core user business logic
      │   └── shared/        ✅ Anyone imports (UserStatus, UserDto)
      │       └── Contains: User types OTHER domains reference
      └── payment/
          ├── main/          ⚠️  Only apps import (PaymentService, PaymentController)
          │   └── Imports: user-shared, auth-shared ✅
          │   └── Contains: Core payment business logic
          └── shared/        ✅ Anyone imports (PaymentDto, PaymentStatus)
              └── Contains: Payment types OTHER domains reference
```

### **Type Safety Rules:**
- ✅ Use proper types (interfaces, types, enums)
- ✅ Use `unknown` for truly unknown data
- ✅ Use type guards for runtime validation
- ❌ Never use `any`
- ❌ Avoid `as` assertions (use type guards instead)
- ✅ Enable all strict TypeScript flags

### **Module Import Rules:**
- ✅ Apps import `feature/*/main` modules
- ✅ Libs import `feature/*/shared` modules
- ✅ Common/database modules can be imported anywhere
- ❌ Never import `feature/*/main` in libs
- ❌ Prevents circular dependencies
- ❌ Maintains clear architectural boundaries

---

**Remember:** These guidelines ensure code quality, type safety, security, and maintainable architecture!
