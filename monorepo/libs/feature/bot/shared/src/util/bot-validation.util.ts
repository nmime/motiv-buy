/**
 * Bot Validation Utilities
 *
 * Comprehensive validation utilities for bot inputs, configurations,
 * and user data. Includes security validation and sanitization.
 */

import { BotContext, BotUser } from '../type';

/**
 * Validation Result Interface
 */
export interface ValidationResult {
  /** Validation success flag */
  isValid: boolean;

  /** Validation error message */
  error?: string;

  /** Sanitized value (if applicable) */
  sanitized?: any;

  /** Additional validation metadata */
  metadata?: Record<string, any>;
}

/**
 * Message Validation Options
 */
export interface MessageValidationOptions {
  /** Maximum message length */
  maxLength?: number;

  /** Minimum message length */
  minLength?: number;

  /** Allow empty messages */
  allowEmpty?: boolean;

  /** Prohibited words */
  prohibitedWords?: string[];

  /** Allowed characters regex */
  allowedCharsRegex?: RegExp;

  /** URL validation */
  allowUrls?: boolean;

  /** Mention validation */
  allowMentions?: boolean;

  /** Hashtag validation */
  allowHashtags?: boolean;
}

/**
 * User Input Validation Options
 */
export interface UserInputValidationOptions extends MessageValidationOptions {
  /** Input type */
  type?: 'text' | 'email' | 'phone' | 'username' | 'password' | 'numeric';

  /** Custom validation regex */
  customRegex?: RegExp;

  /** Trim whitespace */
  trim?: boolean;

  /** Convert to lowercase */
  toLowerCase?: boolean;

  /** Convert to uppercase */
  toUpperCase?: boolean;
}

/**
 * Bot Validation Utilities Class
 */
export class BotValidationUtil {
  /**
   * Validate message content
   *
   * @param message - Message content to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateMessage(message: string, options: MessageValidationOptions = {}): ValidationResult {
    const {
      maxLength = 4096,
      minLength = 0,
      allowEmpty = false,
      prohibitedWords = [],
      allowedCharsRegex,
      allowUrls = true,
      allowMentions = true,
      allowHashtags = true,
    } = options;

    // Check for empty message
    if (!message || message.trim().length === 0) {
      if (allowEmpty) {
        return { isValid: true, sanitized: message };
      }

      return { isValid: false, error: 'Message cannot be empty' };
    }

    // Check message length
    if (message.length < minLength) {
      return {
        isValid: false,
        error: `Message must be at least ${minLength} characters long`,
      };
    }

    if (message.length > maxLength) {
      return {
        isValid: false,
        error: `Message cannot exceed ${maxLength} characters`,
      };
    }

    // Check prohibited words
    const lowerMessage = message.toLowerCase();
    for (const word of prohibitedWords) {
      if (lowerMessage.includes(word.toLowerCase())) {
        return {
          isValid: false,
          error: 'Message contains prohibited content',
        };
      }
    }

    // Check allowed characters
    if (allowedCharsRegex && !allowedCharsRegex.test(message)) {
      return {
        isValid: false,
        error: 'Message contains invalid characters',
      };
    }

    // Check URLs if not allowed
    if (!allowUrls && this.containsUrl(message)) {
      return {
        isValid: false,
        error: 'URLs are not allowed in messages',
      };
    }

    // Check mentions if not allowed
    if (!allowMentions && this.containsMention(message)) {
      return {
        isValid: false,
        error: 'Mentions are not allowed in messages',
      };
    }

    // Check hashtags if not allowed
    if (!allowHashtags && this.containsHashtag(message)) {
      return {
        isValid: false,
        error: 'Hashtags are not allowed in messages',
      };
    }

    return {
      isValid: true,
      sanitized: this.sanitizeMessage(message),
    };
  }

  /**
   * Validate user input
   *
   * @param input - User input to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateUserInput(input: string, options: UserInputValidationOptions = {}): ValidationResult {
    let processedInput = input;

    // Apply text transformations
    if (options.trim) {
      processedInput = processedInput.trim();
    }

    if (options.toLowerCase) {
      processedInput = processedInput.toLowerCase();
    }

    if (options.toUpperCase) {
      processedInput = processedInput.toUpperCase();
    }

    // Validate based on type
    if (options.type) {
      const typeValidation = this.validateByType(processedInput, options.type);
      if (!typeValidation.isValid) {
        return typeValidation;
      }
    }

    // Apply custom regex validation
    if (options.customRegex && !options.customRegex.test(processedInput)) {
      return {
        isValid: false,
        error: 'Input does not match required format',
      };
    }

    // Apply message validation
    const messageValidation = this.validateMessage(processedInput, options);
    if (!messageValidation.isValid) {
      return messageValidation;
    }

    return {
      isValid: true,
      sanitized: processedInput,
    };
  }

  /**
   * Validate bot user
   *
   * @param user - Bot user to validate
   * @returns Validation result
   */
  static validateBotUser(user: BotUser): ValidationResult {
    if (!user) {
      return { isValid: false, error: 'User is null or undefined' };
    }

    // Check required fields
    if (!user.id) {
      return { isValid: false, error: 'User ID is required' };
    }

    if (!user.first_name || user.first_name.trim().length === 0) {
      return { isValid: false, error: 'User first name is required' };
    }

    // Validate user ID
    if (typeof user.id !== 'number' || user.id <= 0) {
      return { isValid: false, error: 'Invalid user ID' };
    }

    // Validate username if present
    if (user.username && !this.isValidUsername(user.username)) {
      return { isValid: false, error: 'Invalid username format' };
    }

    return { isValid: true };
  }

  /**
   * Validate email address
   *
   * @param email - Email to validate
   * @returns Validation result
   */
  static validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !email.trim()) {
      return { isValid: false, error: 'Email is required' };
    }

    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    return { isValid: true, sanitized: email.toLowerCase().trim() };
  }

  /**
   * Validate phone number
   *
   * @param phone - Phone number to validate
   * @returns Validation result
   */
  static validatePhone(phone: string): ValidationResult {
    // Basic international phone number regex
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;

    if (!phone || !phone.trim()) {
      return { isValid: false, error: 'Phone number is required' };
    }

    // Remove all non-digit characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    if (!phoneRegex.test(cleanPhone)) {
      return { isValid: false, error: 'Invalid phone number format' };
    }

    return { isValid: true, sanitized: cleanPhone };
  }

  /**
   * Validate username
   *
   * @param username - Username to validate
   * @returns Validation result
   */
  static validateUsername(username: string): ValidationResult {
    if (!username || !username.trim()) {
      return { isValid: false, error: 'Username is required' };
    }

    if (!this.isValidUsername(username)) {
      return {
        isValid: false,
        error: 'Username must be 3-32 characters, alphanumeric and underscores only',
      };
    }

    return { isValid: true, sanitized: username.toLowerCase().trim() };
  }

  /**
   * Sanitize message content
   *
   * @param message - Message to sanitize
   * @returns Sanitized message
   */
  static sanitizeMessage(message: string): string {
    if (!message) {
      return '';
    }

    return message
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Sanitize user input
   *
   * @param input - Input to sanitize
   * @returns Sanitized input
   */
  static sanitizeInput(input: string): string {
    if (!input) {
      return '';
    }

    return input
      .replace(/[<>\"'&]/g, '') // Remove dangerous characters
      .replace(/\0/g, '') // Remove null bytes
      .replace(/\r\n/g, '\n') // Normalize line endings
      .trim();
  }

  /**
   * Check if message contains URL
   *
   * @param message - Message to check
   * @returns True if contains URL
   */
  private static containsUrl(message: string): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    return urlRegex.test(message);
  }

  /**
   * Check if message contains mention
   *
   * @param message - Message to check
   * @returns True if contains mention
   */
  private static containsMention(message: string): boolean {
    const mentionRegex = /@\w+/g;

    return mentionRegex.test(message);
  }

  /**
   * Check if message contains hashtag
   *
   * @param message - Message to check
   * @returns True if contains hashtag
   */
  private static containsHashtag(message: string): boolean {
    const hashtagRegex = /#\w+/g;

    return hashtagRegex.test(message);
  }

  /**
   * Validate by input type
   *
   * @param input - Input to validate
   * @param type - Input type
   * @returns Validation result
   */
  private static validateByType(
    input: string,
    type: 'text' | 'email' | 'phone' | 'username' | 'password' | 'numeric',
  ): ValidationResult {
    switch (type) {
      case 'email':
        return this.validateEmail(input);

      case 'phone':
        return this.validatePhone(input);

      case 'username':
        return this.validateUsername(input);

      case 'password':
        return this.validatePassword(input);

      case 'numeric':
        return this.validateNumeric(input);

      case 'text':
      default:
        return { isValid: true };
    }
  }

  /**
   * Validate password
   *
   * @param password - Password to validate
   * @returns Validation result
   */
  private static validatePassword(password: string): ValidationResult {
    if (!password) {
      return { isValid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) {
      return { isValid: false, error: 'Password cannot exceed 128 characters' };
    }

    // Check for at least one uppercase, lowercase, digit, and special character
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return {
        isValid: false,
        error: 'Password must contain uppercase, lowercase, digit, and special character',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate numeric input
   *
   * @param input - Input to validate
   * @returns Validation result
   */
  private static validateNumeric(input: string): ValidationResult {
    if (!input || !input.trim()) {
      return { isValid: false, error: 'Numeric value is required' };
    }

    const numericRegex = /^-?\d+(\.\d+)?$/;
    if (!numericRegex.test(input.trim())) {
      return { isValid: false, error: 'Invalid numeric format' };
    }

    const number = parseFloat(input.trim());
    if (isNaN(number)) {
      return { isValid: false, error: 'Invalid number' };
    }

    return { isValid: true, sanitized: number.toString() };
  }

  /**
   * Check if username is valid
   *
   * @param username - Username to check
   * @returns True if valid
   */
  private static isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;

    return usernameRegex.test(username);
  }
}
