import Decimal from 'decimal.js';

/**
 * Decimal Utility for Exact Arithmetic Operations
 *
 * This utility provides type-safe, precision-accurate decimal calculations
 * to replace JavaScript's native floating-point arithmetic which has precision issues.
 *
 * Example problems with native JS:
 * - 0.1 + 0.2 === 0.3 // false (0.30000000000000004)
 * - 0.1 + 0.7 === 0.8 // false (0.7999999999999999)
 *
 * Use this utility for:
 * - Financial calculations (money, payments, balances)
 * - Currency conversions
 * - Price calculations
 * - Any decimal arithmetic requiring exact precision
 */

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 20, // Maximum significant digits
  rounding: Decimal.ROUND_HALF_UP, // Standard rounding (banker's rounding)
  toExpNeg: -7, // Format for numbers >= 1e-7
  toExpPos: 20, // Format for numbers <= 1e+20
});

/**
 * Type alias for decimal values (string representation in database)
 * This provides semantic clarity for database decimal columns
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type DecimalString = string;

/**
 * Type guard to check if a value is a valid decimal string
 */
export function isDecimalString(value: unknown): value is DecimalString {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    new Decimal(value);

    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a value can be converted to Decimal
 */
export function isDecimalValue(value: unknown): value is Decimal.Value {
  if (value === null || value === undefined) {
    return false;
  }

  try {
    new Decimal(value as Decimal.Value);

    return true;
  } catch {
    return false;
  }
}

/**
 * Create a Decimal instance from various input types
 * @throws {Error} If value cannot be converted to Decimal
 */
export function decimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/**
 * Safely create a Decimal instance, returns null if invalid
 */
export function decimalOrNull(value: unknown): Decimal | null {
  if (!isDecimalValue(value)) {
    return null;
  }

  try {
    return new Decimal(value);
  } catch {
    return null;
  }
}

/**
 * Add two decimal values
 */
export function add(a: Decimal.Value, b: Decimal.Value): Decimal {
  return new Decimal(a).plus(b);
}

/**
 * Subtract b from a
 */
export function subtract(a: Decimal.Value, b: Decimal.Value): Decimal {
  return new Decimal(a).minus(b);
}

/**
 * Multiply two decimal values
 */
export function multiply(a: Decimal.Value, b: Decimal.Value): Decimal {
  return new Decimal(a).times(b);
}

/**
 * Divide a by b
 * @throws {Error} If b is zero
 */
export function divide(a: Decimal.Value, b: Decimal.Value): Decimal {
  const divisor = new Decimal(b);
  if (divisor.isZero()) {
    throw new Error('Division by zero');
  }

  return new Decimal(a).dividedBy(divisor);
}

/**
 * Calculate percentage: (value / total) * 100
 */
export function percentage(value: Decimal.Value, total: Decimal.Value): Decimal {
  const totalDecimal = new Decimal(total);
  if (totalDecimal.isZero()) {
    return new Decimal(0);
  }

  return new Decimal(value).dividedBy(totalDecimal).times(100);
}

/**
 * Apply percentage to value: value * (percentage / 100)
 */
export function applyPercentage(value: Decimal.Value, percent: Decimal.Value): Decimal {
  return new Decimal(value).times(new Decimal(percent).dividedBy(100));
}

/**
 * Get the absolute value
 */
export function abs(value: Decimal.Value): Decimal {
  return new Decimal(value).abs();
}

/**
 * Get the maximum of multiple values
 */
export function max(...values: Decimal.Value[]): Decimal {
  if (values.length === 0) {
    throw new Error('max() requires at least one value');
  }

  return Decimal.max(...values);
}

/**
 * Get the minimum of multiple values
 */
export function min(...values: Decimal.Value[]): Decimal {
  if (values.length === 0) {
    throw new Error('min() requires at least one value');
  }

  return Decimal.min(...values);
}

/**
 * Sum an array of decimal values
 */
export function sum(values: Decimal.Value[]): Decimal {
  return values.reduce((total: Decimal, value: Decimal.Value) => total.plus(value), new Decimal(0));
}

/**
 * Calculate average of decimal values
 */
export function average(values: Decimal.Value[]): Decimal {
  if (values.length === 0) {
    throw new Error('average() requires at least one value');
  }

  return sum(values).dividedBy(values.length);
}

/**
 * Calculate weighted average
 * @param values Array of [value, weight] tuples
 */
export function weightedAverage(values: Array<[Decimal.Value, Decimal.Value]>): Decimal {
  if (values.length === 0) {
    throw new Error('weightedAverage() requires at least one value');
  }

  let totalWeighted = new Decimal(0);
  let totalWeight = new Decimal(0);

  for (const [value, weight] of values) {
    totalWeighted = totalWeighted.plus(new Decimal(value).times(weight));
    totalWeight = totalWeight.plus(weight);
  }

  if (totalWeight.isZero()) {
    throw new Error('Total weight cannot be zero');
  }

  return totalWeighted.dividedBy(totalWeight);
}

/**
 * Round to specified decimal places
 */
export function round(value: Decimal.Value, decimalPlaces: number): Decimal {
  return new Decimal(value).toDecimalPlaces(decimalPlaces);
}

/**
 * Compare two decimal values
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compare(a: Decimal.Value, b: Decimal.Value): number {
  return new Decimal(a).comparedTo(b);
}

/**
 * Check if a equals b
 */
export function equals(a: Decimal.Value, b: Decimal.Value): boolean {
  return new Decimal(a).equals(b);
}

/**
 * Check if a is greater than b
 */
export function greaterThan(a: Decimal.Value, b: Decimal.Value): boolean {
  return new Decimal(a).greaterThan(b);
}

/**
 * Check if a is greater than or equal to b
 */
export function greaterThanOrEqual(a: Decimal.Value, b: Decimal.Value): boolean {
  return new Decimal(a).greaterThanOrEqualTo(b);
}

/**
 * Check if a is less than b
 */
export function lessThan(a: Decimal.Value, b: Decimal.Value): boolean {
  return new Decimal(a).lessThan(b);
}

/**
 * Check if a is less than or equal to b
 */
export function lessThanOrEqual(a: Decimal.Value, b: Decimal.Value): boolean {
  return new Decimal(a).lessThanOrEqualTo(b);
}

/**
 * Check if value is zero
 */
export function isZero(value: Decimal.Value): boolean {
  return new Decimal(value).isZero();
}

/**
 * Check if value is positive
 */
export function isPositive(value: Decimal.Value): boolean {
  return new Decimal(value).greaterThan(0);
}

/**
 * Check if value is negative
 */
export function isNegative(value: Decimal.Value): boolean {
  return new Decimal(value).lessThan(0);
}

/**
 * Check if value is within range [min, max] (inclusive)
 */
export function isInRange(value: Decimal.Value, minValue: Decimal.Value, maxValue: Decimal.Value): boolean {
  const dec = new Decimal(value);

  return dec.greaterThanOrEqualTo(minValue) && dec.lessThanOrEqualTo(maxValue);
}

/**
 * Clamp value to range [min, max]
 */
export function clamp(value: Decimal.Value, minValue: Decimal.Value, maxValue: Decimal.Value): Decimal {
  const dec = new Decimal(value);
  const min = new Decimal(minValue);
  const max = new Decimal(maxValue);

  if (dec.lessThan(min)) {
    return min;
  }

  if (dec.greaterThan(max)) {
    return max;
  }

  return dec;
}

/**
 * Format decimal for database storage (string with specified decimal places)
 * This matches PostgreSQL decimal(precision, scale) format
 */
export function toDbString(value: Decimal.Value, decimalPlaces = 8): DecimalString {
  return new Decimal(value).toFixed(decimalPlaces);
}

/**
 * Format decimal for display (string with specified decimal places, no trailing zeros)
 */
export function toDisplayString(value: Decimal.Value, decimalPlaces = 2): string {
  const dec = new Decimal(value);
  // Round to specified decimal places, then remove trailing zeros using Decimal native methods
  const rounded = dec.toDecimalPlaces(decimalPlaces);

  // Convert to string and remove trailing zeros after decimal point
  // Using a more efficient regex to avoid backtracking
  const str = rounded.toString();
  if (!str.includes('.')) {
    return str;
  }
  return str.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * Parse string from database to Decimal
 */
export function fromDbString(value: DecimalString): Decimal {
  return new Decimal(value);
}

/**
 * Convert Decimal to number (ONLY use for display/logging, not calculations!)
 * @warning This may lose precision for very large or small numbers
 */
export function toNumber(value: Decimal.Value): number {
  return new Decimal(value).toNumber();
}

/**
 * Safe conversion from potentially unsafe parseFloat
 * Use this to replace parseFloat() calls
 */
export function fromFloat(value: string | number): Decimal {
  return new Decimal(value);
}

/**
 * Helper for currency conversion
 * Converts amount from one currency to another using rates
 */
export function convertCurrency(amount: Decimal.Value, fromRate: Decimal.Value, toRate: Decimal.Value): Decimal {
  const toRateDecimal = new Decimal(toRate);
  if (toRateDecimal.isZero()) {
    throw new Error('Target currency rate cannot be zero');
  }

  const amountInUsd = new Decimal(amount).times(fromRate);

  return amountInUsd.dividedBy(toRateDecimal);
}

/**
 * Ensure value is non-negative (returns 0 if negative)
 */
export function ensureNonNegative(value: Decimal.Value): Decimal {
  return max(value, 0);
}

/**
 * Calculate fee from amount and fee percentage
 */
export function calculateFee(amount: Decimal.Value, feePercentage: Decimal.Value): Decimal {
  return applyPercentage(amount, feePercentage);
}

/**
 * Calculate amount after deducting fee
 */
export function deductFee(amount: Decimal.Value, feePercentage: Decimal.Value): Decimal {
  const fee = calculateFee(amount, feePercentage);

  return subtract(amount, fee);
}

export { Decimal };
