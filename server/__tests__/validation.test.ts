// Best Practice: API validation testing (Item 100)
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  createAddressSchema,
  sanitizeEmail,
  sanitizeString,
} from '../validation';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'John Doe',
      };

      expect(() => registerSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'Password123',
        name: 'John Doe',
      };

      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject weak password', () => {
      const weakPassword = {
        email: 'test@example.com',
        password: 'weak',
        name: 'John Doe',
      };

      expect(() => registerSchema.parse(weakPassword)).toThrow();
    });

    it('should require password with uppercase, lowercase, and number', () => {
      const noUppercase = {
        email: 'test@example.com',
        password: 'password123',
        name: 'John Doe',
      };

      expect(() => registerSchema.parse(noUppercase)).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password',
      };

      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should allow rememberMe field', () => {
      const withRememberMe = {
        email: 'test@example.com',
        password: 'password',
        rememberMe: true,
      };

      expect(() => loginSchema.parse(withRememberMe)).not.toThrow();
    });
  });

  describe('createAddressSchema', () => {
    it('should validate valid address', () => {
      const validAddress = {
        label: 'Home',
        type: 'shipping' as const,
        street1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      };

      expect(() => createAddressSchema.parse(validAddress)).not.toThrow();
    });

    it('should reject invalid address type', () => {
      const invalidType = {
        label: 'Home',
        type: 'invalid',
        street1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      };

      expect(() => createAddressSchema.parse(invalidType)).toThrow();
    });
  });
});

describe('Sanitization Helpers', () => {
  describe('sanitizeEmail', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeEmail('Test@EXAMPLE.com')).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should replace multiple spaces with single space', () => {
      expect(sanitizeString('hello    world')).toBe('hello world');
    });
  });
});
