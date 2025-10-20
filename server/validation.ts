import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Best Practice: Centralized validation schemas using Zod

// User Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  companyName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'buyer', 'user']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  jobTitle: z.string().optional(),
});

// Company Schemas
export const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  industry: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().positive().optional(),
  paymentTerms: z.string().optional(),
});

// Address Schemas
export const createAddressSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  type: z.enum(['shipping', 'billing', 'both']),
  street1: z.string().min(1, 'Street address is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(3, 'Postal code is required'),
  country: z.string().min(2, 'Country is required'),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

// Order Schemas
export const createOrderSchema = z.object({
  shippingAddressId: z.string().uuid('Invalid shipping address ID'),
  billingAddressId: z.string().uuid('Invalid billing address ID'),
  paymentMethod: z.enum(['po', 'card', 'invoice']),
  poNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOrderSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'shipped', 'delivered', 'cancelled']).optional(),
  poStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  notes: z.string().optional(),
});

// Quote Schemas
export const createQuoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    sku: z.string(),
    quantity: z.number().positive(),
    price: z.number().positive().optional(),
  })).min(1, 'At least one item is required'),
  expiryDate: z.string().datetime().optional(),
});

// Cart Schemas
export const addToCartSchema = z.object({
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
});

// Pagination Schema
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().positive().max(100)).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Best Practice: Validation middleware factory
export function validate(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          message: 'Validation failed',
          errors,
        });
      }
      next(error);
    }
  };
}

// Best Practice: Query parameter validation
export function validateQuery(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          message: 'Invalid query parameters',
          errors,
        });
      }
      next(error);
    }
  };
}

// Best Practice: Sanitization helpers
export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};
