import {
  all,
  andThen,
  any,
  AsyncResult,
  DomainError,
  Err,
  fromNullable,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  matchMap,
  NotFoundError,
  Ok,
  Result,
  toNullable,
  tryCatch,
  tryCatchAsync,
  unwrapOr,
  unwrapOrElse,
  ValidationError,
} from '../result.type';

describe('Result Type System', () => {
  describe('Basic Construction', () => {
    it('should create Ok result', () => {
      const result = Ok(42);
      expect(result.ok).toBe(true);
      expect(result.err).toBe(false);
      expect(result.val).toBe(42);
    });

    it('should create Err result', () => {
      const result = Err('error message');
      expect(result.ok).toBe(false);
      expect(result.err).toBe(true);
      expect(result.val).toBe('error message');
    });
  });

  describe('Type Guards', () => {
    it('should check if result is Ok', () => {
      const result: Result<number, string> = Ok(42);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it('should check if result is Err', () => {
      const result: Result<number, string> = Err('error');
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('Unwrapping', () => {
    it('should unwrapOr with default value for Err', () => {
      const result = Err('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });

    it('should unwrapOr with actual value for Ok', () => {
      const result = Ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should unwrapOrElse with computed default for Err', () => {
      const result: Result<number, string> = Err('error');
      const value = unwrapOrElse(result, (err) => err.length);
      expect(value).toBe(5);
    });

    it('should unwrapOrElse with actual value for Ok', () => {
      const result: Result<number, string> = Ok(42);
      const value = unwrapOrElse(result, () => 0);
      expect(value).toBe(42);
    });
  });

  describe('Transformations', () => {
    it('should map Ok value', () => {
      const result = Ok(5);
      const mapped = map(result, (x: number) => x * 2);
      expect(mapped.ok).toBe(true);
      expect(mapped.val).toBe(10);
    });

    it('should not map Err value', () => {
      const result: Result<number, string> = Err('error');
      const mapped = map(result, (x: number) => x * 2);
      expect(mapped.err).toBe(true);
      expect(mapped.val).toBe('error');
    });

    it('should mapErr on Err', () => {
      const result: Result<number, string> = Err('error');
      const mapped = mapErr(result, (err) => err.toUpperCase());
      expect(mapped.err).toBe(true);
      expect(mapped.val).toBe('ERROR');
    });

    it('should not mapErr on Ok', () => {
      const result: Result<number, string> = Ok(42);
      const mapped = mapErr(result, () => '');
      expect(mapped.ok).toBe(true);
      expect(mapped.val).toBe(42);
    });
  });

  describe('Chaining', () => {
    const divide = (a: number, b: number): Result<number, string> => {
      if (b === 0) {
        return Err('Division by zero');
      }

      return Ok(a / b);
    };

    const sqrt = (n: number): Result<number, string> => {
      if (n < 0) {
        return Err('Negative number');
      }

      return Ok(Math.sqrt(n));
    };

    it('should chain successful operations', () => {
      const result = andThen(divide(100, 4), sqrt);
      expect(result.ok).toBe(true);
      expect(result.val).toBe(5);
    });

    it('should stop chaining on first error', () => {
      const result = andThen(divide(100, 0), sqrt);
      expect(result.err).toBe(true);
      expect(result.val).toBe('Division by zero');
    });

    it('should propagate error from chained function', () => {
      const result = andThen(divide(-100, 4), sqrt);
      expect(result.err).toBe(true);
      expect(result.val).toBe('Negative number');
    });
  });

  describe('Combining Results', () => {
    it('should combine all successful results', () => {
      const results = [Ok(1), Ok(2), Ok(3)];
      const combined = all(results);
      expect(combined.ok).toBe(true);
      expect(combined.val).toEqual([1, 2, 3]);
    });

    it('should fail if any result fails', () => {
      const results: Result<number, string>[] = [Ok(1), Err('error'), Ok(3)];

      const combined = all(results);
      expect(combined.err).toBe(true);
      expect(combined.val).toBe('error');
    });

    it('should return first Ok with any', () => {
      const results: Result<number, string>[] = [Err('error1'), Ok(2), Ok(3)];

      const result = any(results);
      expect(result.ok).toBe(true);
      expect(result.val).toBe(2);
    });

    it('should return last Err if all fail', () => {
      const results: Result<number, string>[] = [Err('error1'), Err('error2'), Err('error3')];

      const result = any(results);
      expect(result.err).toBe(true);
      expect(result.val).toBe('error3');
    });
  });

  describe('Exception Handling', () => {
    it('should catch exceptions with tryCatch', () => {
      const result = tryCatch(() => JSON.parse('invalid json') as unknown);
      expect(result.err).toBe(true);
      expect(result.val).toBeInstanceOf(Error);
    });

    it('should return Ok for successful execution', () => {
      const result = tryCatch(() => JSON.parse('{"valid": true}') as { valid: boolean });
      expect(result.ok).toBe(true);
      expect(result.val).toEqual({ valid: true });
    });

    it('should catch async exceptions', async () => {
      const result = await tryCatchAsync(async () => {
        await Promise.resolve();
        throw new Error('Async error');
      });

      expect(result.err).toBe(true);
      expect(result.val).toBeInstanceOf(Error);
    });

    it('should return Ok for successful async execution', async () => {
      const result = await tryCatchAsync(async () => {
        return await Promise.resolve('success');
      });

      expect(result.ok).toBe(true);
      expect(result.val).toBe('success');
    });
  });

  describe('Nullable Conversions', () => {
    it('should convert non-null value to Ok', () => {
      const result = fromNullable('value', 'error');
      expect(result.ok).toBe(true);
      expect(result.val).toBe('value');
    });

    it('should convert null to Err', () => {
      const result = fromNullable(null, 'error');
      expect(result.err).toBe(true);
      expect(result.val).toBe('error');
    });

    it('should convert undefined to Err', () => {
      const result = fromNullable(undefined, 'error');
      expect(result.err).toBe(true);
      expect(result.val).toBe('error');
    });

    it('should convert Ok to value', () => {
      const result = Ok(42);
      expect(toNullable(result)).toBe(42);
    });

    it('should convert Err to null', () => {
      const result: Result<number, string> = Err('error');
      expect(toNullable(result)).toBeNull();
    });
  });

  describe('Pattern Matching', () => {
    it('should execute ok handler for Ok result', () => {
      const okHandler = jest.fn();
      const errHandler = jest.fn();

      const result = Ok(42);
      match(result, {
        ok: okHandler,
        err: errHandler,
      });

      expect(okHandler).toHaveBeenCalledWith(42);
      expect(errHandler).not.toHaveBeenCalled();
    });

    it('should execute err handler for Err result', () => {
      const okHandler = jest.fn();
      const errHandler = jest.fn();

      const result: Result<number, string> = Err('error');
      match(result, {
        ok: okHandler,
        err: errHandler,
      });

      expect(okHandler).not.toHaveBeenCalled();
      expect(errHandler).toHaveBeenCalledWith('error');
    });

    it('should map Ok to single type', () => {
      const result = Ok(42);
      const message = matchMap(result, {
        ok: (val: number) => `Success: ${val}`,
        err: (err: string) => `Error: ${err}`,
      });

      expect(message).toBe('Success: 42');
    });

    it('should map Err to single type', () => {
      const result: Result<number, string> = Err('failed');
      const message = matchMap(result, {
        ok: (val: number) => `Success: ${val}`,
        err: (err: string) => `Error: ${err}`,
      });

      expect(message).toBe('Error: failed');
    });
  });

  describe('Domain Errors', () => {
    it('should create ValidationError with code', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.context).toEqual({ field: 'email' });
    });

    it('should create NotFoundError with code', () => {
      const error = new NotFoundError('User not found', { id: '123' });
      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
      expect(error.context).toEqual({ id: '123' });
    });

    it('should work with Result type', () => {
      const result: Result<string, DomainError> = Err(new ValidationError('Invalid email'));

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val).toBeInstanceOf(ValidationError);
        expect(result.val.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Real-world Example', () => {
    interface User {
      id: string;
      email: string;
      name: string;
    }

    class UserService {
      validateEmail(email: string): Result<void, ValidationError> {
        if (!email.includes('@')) {
          return Err(new ValidationError('Invalid email format'));
        }

        return Ok(undefined);
      }

      findUser(email: string): User | null {
        // Simulate database lookup
        if (email === 'test@example.com') {
          return { id: '1', email, name: 'Test User' };
        }

        return null;
      }

      async getUserByEmail(email: string): AsyncResult<User, DomainError> {
        const validation = this.validateEmail(email);
        if (validation.err) {
          return await Promise.resolve(validation);
        }

        const user = this.findUser(email);
        if (!user) {
          return await Promise.resolve(Err(new NotFoundError('User not found', { email })));
        }

        return await Promise.resolve(Ok(user));
      }
    }

    it('should validate and find user', async () => {
      const service = new UserService();
      const result = await service.getUserByEmail('test@example.com');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.email).toBe('test@example.com');
      }
    });

    it('should return validation error for invalid email', async () => {
      const service = new UserService();
      const result = await service.getUserByEmail('invalid-email');

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val).toBeInstanceOf(ValidationError);
        expect(result.val.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return not found error for non-existent user', async () => {
      const service = new UserService();
      const result = await service.getUserByEmail('notfound@example.com');

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val).toBeInstanceOf(NotFoundError);
        expect(result.val.code).toBe('NOT_FOUND');
      }
    });
  });
});
