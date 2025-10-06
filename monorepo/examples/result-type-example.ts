/**
 * Result Type System Usage Example
 *
 * This file demonstrates how to use the Result<T, E> type system
 * in the motiv-buy monorepo.
 */

import {
  Ok,
  Err,
  Result,
  AsyncResult,
  DomainResult,
  AsyncDomainResult,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  match,
  andThen,
  map,
} from '@app/common-shared';

// ============================================================================
// Example 1: Simple synchronous function
// ============================================================================

function parseNumber(input: string): Result<number, string> {
  const num = Number(input);
  if (isNaN(num)) {
    return Err(`Invalid number: ${input}`);
  }
  return Ok(num);
}

// Usage
const result1 = parseNumber('42');
if (result1.ok) {
  console.log('Parsed number:', result1.val); // 42
}

const result2 = parseNumber('invalid');
if (result2.err) {
  console.error('Error:', result2.val); // "Invalid number: invalid"
}

// ============================================================================
// Example 2: Chaining operations
// ============================================================================

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return Err('Division by zero');
  return Ok(a / b);
}

function sqrt(n: number): Result<number, string> {
  if (n < 0) return Err('Cannot take square root of negative number');
  return Ok(Math.sqrt(n));
}

// Chain: parse -> divide -> sqrt
const chainedResult = andThen(
  andThen(
    parseNumber('100'),
    (n) => divide(n, 4),
  ),
  sqrt,
);

match(chainedResult, {
  ok: (value) => console.log('Result:', value), // 5
  err: (error) => console.error('Error:', error),
});

// ============================================================================
// Example 3: Async operations with domain errors
// ============================================================================

interface User {
  id: string;
  email: string;
  name: string;
}

class UserService {
  private users: Map<string, User> = new Map([
    ['1', { id: '1', email: 'john@example.com', name: 'John Doe' }],
    ['2', { id: '2', email: 'jane@example.com', name: 'Jane Smith' }],
  ]);

  async getUserById(id: string): AsyncDomainResult<User> {
    // Validation
    if (!id || id.trim() === '') {
      return Err(new ValidationError('User ID is required'));
    }

    // Simulate async database call
    await new Promise((resolve) => setTimeout(resolve, 100));

    const user = this.users.get(id);
    if (!user) {
      return Err(new NotFoundError('User not found', { id }));
    }

    return Ok(user);
  }

  async authenticateUser(
    email: string,
    password: string,
  ): AsyncDomainResult<User> {
    if (!email || !password) {
      return Err(new ValidationError('Email and password are required'));
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find user by email
    const user = Array.from(this.users.values()).find(
      (u) => u.email === email,
    );

    if (!user) {
      return Err(new UnauthorizedError('Invalid credentials'));
    }

    // In real app, verify password hash
    if (password !== 'password123') {
      return Err(new UnauthorizedError('Invalid credentials'));
    }

    return Ok(user);
  }

  async updateUserName(
    id: string,
    newName: string,
  ): AsyncDomainResult<User> {
    if (!newName || newName.trim() === '') {
      return Err(new ValidationError('Name cannot be empty'));
    }

    const userResult = await this.getUserById(id);
    if (userResult.err) {
      return userResult;
    }

    const user = userResult.val;
    const updatedUser = { ...user, name: newName };
    this.users.set(id, updatedUser);

    return Ok(updatedUser);
  }
}

// ============================================================================
// Example 4: Real-world usage
// ============================================================================

async function demonstrateRealWorldUsage() {
  const userService = new UserService();

  // Successful user retrieval
  console.log('\n=== Example 4a: Get User ===');
  const userResult = await userService.getUserById('1');
  match(userResult, {
    ok: (user) => {
      console.log('✓ Found user:', user.name, `(${user.email})`);
    },
    err: (error) => {
      console.error('✗ Error:', `[${error.code}]`, error.message);
      if (error.context) {
        console.error('  Context:', error.context);
      }
    },
  });

  // User not found
  console.log('\n=== Example 4b: User Not Found ===');
  const notFoundResult = await userService.getUserById('999');
  match(notFoundResult, {
    ok: (user) => console.log('✓ Found user:', user.name),
    err: (error) => {
      console.error('✗ Error:', `[${error.code}]`, error.message);
      if (error.context) {
        console.error('  Context:', error.context);
      }
    },
  });

  // Validation error
  console.log('\n=== Example 4c: Validation Error ===');
  const validationResult = await userService.getUserById('');
  match(validationResult, {
    ok: (user) => console.log('✓ Found user:', user.name),
    err: (error) => {
      console.error('✗ Error:', `[${error.code}]`, error.message);
    },
  });

  // Authentication success
  console.log('\n=== Example 4d: Authentication Success ===');
  const authResult = await userService.authenticateUser(
    'john@example.com',
    'password123',
  );
  match(authResult, {
    ok: (user) => console.log('✓ Authenticated as:', user.name),
    err: (error) => console.error('✗ Auth failed:', error.message),
  });

  // Authentication failure
  console.log('\n=== Example 4e: Authentication Failure ===');
  const authFailResult = await userService.authenticateUser(
    'john@example.com',
    'wrongpassword',
  );
  match(authFailResult, {
    ok: (user) => console.log('✓ Authenticated as:', user.name),
    err: (error) => console.error('✗ Auth failed:', `[${error.code}]`, error.message),
  });

  // Update user
  console.log('\n=== Example 4f: Update User ===');
  const updateResult = await userService.updateUserName('1', 'John Updated');
  match(updateResult, {
    ok: (user) => console.log('✓ Updated user name:', user.name),
    err: (error) => console.error('✗ Update failed:', error.message),
  });

  // Chain operations
  console.log('\n=== Example 4g: Chained Operations ===');
  const getUserResult = await userService.getUserById('2');
  const mappedResult = map(getUserResult, (user) => ({
    displayName: `${user.name} <${user.email}>`,
    userId: user.id,
  }));

  if (mappedResult.ok) {
    console.log('✓ Display name:', mappedResult.val.displayName);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateRealWorldUsage().catch(console.error);
}

export { UserService, parseNumber, divide, sqrt };
