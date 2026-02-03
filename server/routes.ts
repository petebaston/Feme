import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { bigcommerce } from "./bigcommerce";
import { DatabaseStorage } from "./storage";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  authenticateToken,
  sessionTimeout,
  requireCompanyAccess,
  trackSession,
  clearSession,
  type AuthRequest
} from "./auth";
import { filterByCompany, verifyResourceOwnership } from "./filters";
import { db } from "./db";
import { bigcommerceOrdersCache } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const storage = new DatabaseStorage();

// Helper to extract user token from request (DEPRECATED - for backward compatibility only)
function getUserToken(req: any): string {
  const authHeader = req.headers.authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

// Helper to get BigCommerce token from server-side storage
async function getBigCommerceToken(req: AuthRequest): Promise<string> {
  if (!req.user) {
    throw new Error('User not authenticated');
  }

  const bcToken = await storage.getUserToken(req.user.userId);

  if (!bcToken) {
    throw new Error('BigCommerce token not found for user. Please login again.');
  }

  return bcToken;
}

import { B2BOrder, FrontendOrder } from './types';

// Transform BigCommerce order to frontend format
function transformOrder(bcOrder: B2BOrder | any): FrontendOrder {
  // Map products to items array for frontend consumption
  const items = (bcOrder.products || bcOrder.productsList || bcOrder.items || []).map((product: any) => ({
    name: product.name || product.productName,
    sku: product.sku,
    quantity: product.quantity || 1,
    price: product.base_price || product.price || product.price_ex_tax || 0,
    productId: product.productId || product.product_id, // Normalize to camelCase
    variantId: product.variantId || product.variant_id,
  }));

  // Ensure total values are numbers
  const totalAmount = typeof bcOrder.totalIncTax === 'string' ? parseFloat(bcOrder.totalIncTax) : (bcOrder.totalIncTax || 0);
  const subtotalAmount = typeof bcOrder.totalExTax === 'string' ? parseFloat(bcOrder.totalExTax) : (bcOrder.totalExTax || bcOrder.subtotalIncTax || 0);
  
  const currencyCode = bcOrder.currencyCode || bcOrder.currency_code || 'GBP';
  
  // Handle different status fields from B2B vs Standard
  const status = bcOrder.status || bcOrder.orderStatus || bcOrder.customOrderStatus || 'Incomplete';

  // Reliable date handling
  let createdAt = new Date().toISOString();
  if (bcOrder.createdAt) {
      // If number (timestamp in seconds), convert. If string, use as is.
      createdAt = typeof bcOrder.createdAt === 'number' 
        ? new Date(bcOrder.createdAt * 1000).toISOString()
        : new Date(bcOrder.createdAt).toISOString();
  } else if (bcOrder.date_created) {
      createdAt = new Date(bcOrder.date_created).toISOString();
  }

  let updatedAt = new Date().toISOString();
  if (bcOrder.updatedAt) {
      updatedAt = typeof bcOrder.updatedAt === 'number'
        ? new Date(bcOrder.updatedAt * 1000).toISOString()
        : new Date(bcOrder.updatedAt).toISOString();
  } else if (bcOrder.date_modified) {
      updatedAt = new Date(bcOrder.date_modified).toISOString();
  }

  return {
    id: bcOrder.orderId || bcOrder.id,
    bcOrderId: bcOrder.orderId || bcOrder.id,
    customerName: bcOrder.companyName || (bcOrder.billingAddress ? `${bcOrder.billingAddress.first_name} ${bcOrder.billingAddress.last_name}`.trim() : 'Guest'),
    status: status,
    total: totalAmount,
    totalIncTax: totalAmount,  // Frontend expects this field
    subtotal: subtotalAmount,
    createdAt: createdAt,
    updatedAt: updatedAt,
    itemCount: items.length,
    items: items,
    poNumber: bcOrder.poNumber || bcOrder.customer_message || '',
    referenceNumber: bcOrder.referenceNumber || '',
    customerId: bcOrder.customer_id || bcOrder.customerId, // Use both snake and camel
    companyId: bcOrder.companyId,
    companyName: bcOrder.companyName || bcOrder.billingAddress?.company,
    firstName: bcOrder.firstName || bcOrder.billingAddress?.first_name,
    lastName: bcOrder.lastName || bcOrder.billingAddress?.last_name,
    currencyCode: currencyCode,
    money: bcOrder.money ? bcOrder.money : {
      currency: {
        code: currencyCode
      },
      value: totalAmount.toString()
    },
    shippingAddress: bcOrder.shippingAddress || (Array.isArray(bcOrder.shipping_addresses) && bcOrder.shipping_addresses.length > 0 
      ? bcOrder.shipping_addresses[0] 
      : null),
    billingAddress: bcOrder.billingAddress || bcOrder.billing_address || null,
    // Custom fields from ERP integrations
    extraFields: bcOrder.extraFields || [],
    extraInt1: bcOrder.extraInt1,
    extraInt2: bcOrder.extraInt2,
    extraInt3: bcOrder.extraInt3,
    extraInt4: bcOrder.extraInt4,
    extraInt5: bcOrder.extraInt5,
    extraStr1: bcOrder.extraStr1,
    extraStr2: bcOrder.extraStr2,
    extraStr3: bcOrder.extraStr3,
    extraStr4: bcOrder.extraStr4,
    extraStr5: bcOrder.extraStr5,
    extraText: bcOrder.extraText,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints (Items 1, 2, 6, 7)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      console.log('[Login] Attempting BigCommerce login for:', email);
      const result = await bigcommerce.login(email, password);

      // Extract customerId from BigCommerce JWT token
      let customerId: number | undefined;
      try {
        const decoded = jwt.decode(result.token) as any;
        if (decoded?.bc_customer_id) {
          customerId = decoded.bc_customer_id;
          console.log('[Login] Extracted customerId from BC token:', customerId);
        }
      } catch (error) {
        console.warn('[Login] Could not decode BigCommerce token for customerId');
      }

      // Get user from database to include in JWT
      let user = await storage.getUserByEmail(email);
      
      // Fetch company data from BigCommerce using the token
      let companyId = user?.companyId;
      try {
        const companyData = await bigcommerce.getCompany(result.token);
        if (companyData?.data?.companyId || companyData?.data?.id) {
          companyId = companyData.data.companyId || companyData.data.id;
        }
      } catch (error) {
        console.log('[Login] Could not fetch company data, using existing or undefined');
      }

      // If user doesn't exist locally, create them
      if (!user) {
        user = await storage.createUser({
          email,
          password: await bcrypt.hash(password, 10),
          name: email.split('@')[0],
          role: 'buyer',
          companyId,
          customerId,
        });
      } else {
        // Update company ID or customerId if changed
        const updates: any = {};
        if (companyId && user.companyId !== companyId) {
          updates.companyId = companyId;
        }
        if (customerId && user.customerId !== customerId) {
          updates.customerId = customerId;
        }
        if (Object.keys(updates).length > 0) {
          const updatedUser = await storage.updateUser(user.id, updates);
          if (updatedUser) user = updatedUser;
        }
      }

      // Ensure user exists at this point
      if (!user) {
        throw new Error('User creation failed');
      }

      // Store BigCommerce token server-side (two-token authentication system)
      await storage.storeUserToken(user.id, result.token, companyId || undefined);

      // Generate JWT tokens (use freshly extracted customerId if available)
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        companyId: user.companyId || companyId || undefined,
        customerId: customerId || user.customerId || undefined,
        role: user.role || 'buyer',
      };

      const accessToken = generateAccessToken(tokenPayload, rememberMe);
      const refreshToken = generateRefreshToken(tokenPayload, rememberMe);

      // Track session
      trackSession(user.id, accessToken);

      // Set refresh token as HTTP-only cookie if remember me is enabled (Item 7)
      if (rememberMe) {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax', // Changed from 'strict' to 'lax' for Replit iframe compatibility
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days to match token expiry
        });
      }

      console.log('[Login] Login successful, tokens generated');
      res.json({
        accessToken,
        refreshToken: rememberMe ? undefined : refreshToken, // Only return in response if not using cookie
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        },
        // BigCommerce token is now stored server-side, not returned to frontend
      });
    } catch (error: any) {
      console.error("[Login] Login failed:", error.message);
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Logout endpoint (Item 2)
  app.post("/api/auth/logout", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user) {
        clearSession(req.user.userId);
        // Clear BigCommerce token from server-side storage
        await storage.clearUserToken(req.user.userId);
      }
      res.clearCookie('refreshToken');
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("[Logout] Error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Register endpoint (Item 6)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, companyName } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create company if provided
      let companyId: string | undefined;
      if (companyName) {
        // This would need to be integrated with BigCommerce B2B company creation
        // For now, we'll create a local company record
      }

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: 'buyer',
        companyId,
      });

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        companyId: user.companyId || undefined,
        customerId: user.customerId || undefined,
        role: user.role || 'buyer',
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      trackSession(user.id, accessToken);

      res.status(201).json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error("[Register] Error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Get current user (validate token)
  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // CRITICAL: Validate BigCommerce token still exists
      const bcToken = await storage.getUserToken(req.user.userId);
      if (!bcToken) {
        console.error("[Me] BigCommerce token not found for user:", req.user.email);
        return res.status(401).json({ 
          message: "Session expired", 
          reason: "bigcommerce_token_missing" 
        });
      }

      // Return user info (token is valid)
      res.json({
        user: {
          userId: req.user.userId,
          email: req.user.email,
          role: req.user.role,
          companyId: req.user.companyId,
        }
      });
    } catch (error) {
      console.error("[Me] Error:", error);
      res.status(500).json({ message: "Failed to get user info" });
    }
  });

  // Token refresh endpoint (Item 1)
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token required" });
      }

      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        companyId: payload.companyId,
        role: payload.role,
      });

      trackSession(payload.userId, accessToken);

      res.json({ accessToken });
    } catch (error) {
      console.error("[Refresh] Error:", error);
      res.status(500).json({ message: "Token refresh failed" });
    }
  });

  // Password reset request (Items 3, 4)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        return res.json({ message: "If an account exists, a password reset link will be sent" });
      }

      // Generate reset token (24 hour expiry)
      const resetToken = generateAccessToken({
        userId: user.id,
        email: user.email,
      });

      // In production, send email with reset link
      // For now, just return token (Item 4)
      console.log(`[Password Reset] Token for ${email}: ${resetToken}`);

      res.json({
        message: "If an account exists, a password reset link will be sent",
        // Remove this in production - only for development
        resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
      });
    } catch (error) {
      console.error("[Forgot Password] Error:", error);
      res.status(500).json({ message: "Failed to process password reset" });
    }
  });

  // Password reset confirmation (Item 3)
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      const payload = verifyAccessToken(token);
      if (!payload) {
        return res.status(403).json({ message: "Invalid or expired reset token" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await storage.updateUser(payload.userId, { password: hashedPassword });

      // Clear all sessions for this user
      clearSession(payload.userId);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("[Reset Password] Error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // GraphQL Proxy - Securely proxy GraphQL requests to BigCommerce
  app.post("/api/graphql", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get BigCommerce user token from server-side storage
      const bcToken = await getBigCommerceToken(req);
      
      // Forward GraphQL query to BigCommerce with proper authentication
      const storeHash = process.env.BIGCOMMERCE_STORE_HASH || '';
      const channelId = process.env.VITE_CHANNEL_ID || '1';
      
      const graphqlEndpoint = 'https://api-b2b.bigcommerce.com/graphql';
      
      console.log('[GraphQL Proxy] Forwarding query to BigCommerce');
      
      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${bcToken}`,
          'X-Store-Hash': storeHash,
          'X-Channel-Id': channelId,
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('[GraphQL Proxy] BigCommerce error:', data);
        return res.status(response.status).json(data);
      }

      console.log('[GraphQL Proxy] Query successful');
      res.json(data);
    } catch (error: any) {
      console.error('[GraphQL Proxy] Error:', error.message);
      res.status(500).json({ 
        errors: [{ message: 'GraphQL proxy error', extensions: { originalError: error.message } }] 
      });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const stats = await bigcommerce.getDashboardStats(bcToken);
        res.json(stats);
      } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ message: "Failed to fetch dashboard stats" });
      }
    }
  );

  // Orders endpoints
  
  // My Orders - Only logged-in user's orders
  app.get("/api/my-orders",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[My Orders] Fetching orders for user:', req.user?.email);
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query;

        // Get user's customer ID from the JWT token or database (for backward compatibility)
        let userCustomerId = req.user?.customerId;
        if (!userCustomerId) {
          console.warn('[My Orders] No customerId in JWT token, fetching from database...');
          const user = await storage.getUser(req.user!.userId);
          userCustomerId = user?.customerId || undefined;
          if (!userCustomerId) {
            console.warn('[My Orders] No customer ID found for user');
            return res.json([]);
          }
          console.log('[My Orders] Retrieved customerId from database:', userCustomerId);
        }

        console.log(`[My Orders] Filtering orders for customer ID ${userCustomerId}`);

        // Fetch all orders from standard BigCommerce API
        const response = await bigcommerce.getOrders(bcToken, {
          search: search as string,
          status: status as string,
          sortBy: sortBy as string,
          limit: limit ? parseInt(limit as string) : 1000,
          recent: recent === 'true',
        }, req.user?.companyId);

        if ((response as any)?.errMsg || (response as any)?.error) {
          console.warn("[My Orders] BigCommerce returned error:", (response as any).errMsg || (response as any).error);
          return res.json([]);
        }

        const bcOrders = response.data || [];
        const allOrders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];

        // Filter orders by this user's customer ID only
        const myOrders = allOrders.filter((order: any) => {
          const orderCustomerId = order.customer_id || order.customerId;
          return orderCustomerId === userCustomerId;
        });

        console.log(`[My Orders] Found ${myOrders.length} orders for customer ${userCustomerId}`);
        res.json(myOrders);
      } catch (error) {
        console.error("My Orders fetch error:", error);
        res.status(500).json({ message: "Failed to fetch orders" });
      }
    }
  );
  
  // Company Orders - All orders for the user's company
  app.get("/api/orders",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[Orders] Fetching company orders for user:', req.user?.email);
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query;

        // Get user's company ID
        const companyId = req.user?.companyId;
        if (!companyId) {
          console.warn('[Orders] No company ID found for user');
          return res.json([]);
        }

        // Fetch all customer IDs for this company (like we do for invoices)
        const customerIds = await bigcommerce.getCompanyCustomerIds(bcToken, companyId);
        
        if (customerIds.length === 0) {
          console.warn('[Orders] No customer IDs found for company', companyId);
          return res.json([]);
        }

        console.log(`[Orders] Filtering orders for company ${companyId} with ${customerIds.length} customer IDs`);

        // Fetch all orders from standard BigCommerce API
        const response = await bigcommerce.getOrders(bcToken, {
          search: search as string,
          status: status as string,
          sortBy: sortBy as string,
          limit: limit ? parseInt(limit as string) : 1000,
          recent: recent === 'true',
        }, companyId);

        if ((response as any)?.errMsg || (response as any)?.error) {
          console.warn("[Orders] BigCommerce returned error:", (response as any).errMsg || (response as any).error);
          return res.json([]);
        }

        const bcOrders = response.data || [];
        const allOrders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];

        // Filter orders by customer IDs only - all orders for the company's customer account(s)
        const companyOrders = allOrders.filter((order: any) => {
          const orderCustomerId = order.customer_id || order.customerId;
          return orderCustomerId && customerIds.includes(orderCustomerId);
        });

        // Fetch B2B orders with extra fields and merge them
        const b2bOrdersResponse = await bigcommerce.getB2BOrdersWithExtraFields(companyId);
        const b2bOrders = b2bOrdersResponse?.data || [];
        
        // Create a map of B2B orders by bcOrderId for quick lookup
        const b2bOrderMap = new Map<string, any>();
        for (const b2bOrder of b2bOrders) {
          const bcOrderId = b2bOrder.bcOrderId?.toString();
          if (bcOrderId) {
            b2bOrderMap.set(bcOrderId, b2bOrder);
          }
        }

        // Enrich orders with extra fields from B2B API
        const enrichedOrders = companyOrders.map((order: any) => {
          const orderId = order.id?.toString() || order.bcOrderId?.toString();
          const b2bOrder = b2bOrderMap.get(orderId);
          
          if (b2bOrder) {
            return {
              ...order,
              poNumber: b2bOrder.poNumber || order.poNumber || '',
              extraFields: b2bOrder.extraFields || [],
              extraInt1: b2bOrder.extraInt1,
              extraInt2: b2bOrder.extraInt2,
              extraInt3: b2bOrder.extraInt3,
              extraInt4: b2bOrder.extraInt4,
              extraInt5: b2bOrder.extraInt5,
              extraStr1: b2bOrder.extraStr1,
              extraStr2: b2bOrder.extraStr2,
              extraStr3: b2bOrder.extraStr3,
              extraStr4: b2bOrder.extraStr4,
              extraStr5: b2bOrder.extraStr5,
              extraText: b2bOrder.extraText,
            };
          }
          return order;
        });

        console.log(`[Orders] Returning ${enrichedOrders.length} orders (${b2bOrderMap.size} enriched with B2B extra fields)`);
        res.json(enrichedOrders);
      } catch (error) {
        console.error("Orders fetch error:", error);
        res.status(500).json({ message: "Failed to fetch orders" });
      }
    }
  );

  app.get("/api/orders/:id",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);

        // Get companyId for caching
        let companyId: string | undefined;
        try {
          const companyResponse = await bigcommerce.getCompany(bcToken);
          companyId = companyResponse?.data?.companyId || companyResponse?.data?.id;
        } catch (e) {
          console.log('[Order] Could not fetch companyId for cache, continuing without cache');
        }

        const response = await bigcommerce.getOrder(bcToken, req.params.id, companyId);
        const bcOrder = response?.data;
        if (!bcOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        const order = transformOrder(bcOrder);

        // CRITICAL: Verify resource ownership by checking customer IDs
        // Admins see all orders
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          if (!req.user?.companyId) {
            return res.status(403).json({ message: 'Company ID not found' });
          }
          
          // Get company's customer IDs
          const customerIds = await bigcommerce.getCompanyCustomerIds(bcToken, req.user.companyId);
          const orderCustomerId = order.customerId;
          
          // Check if order belongs to one of the company's customer accounts
          if (!orderCustomerId || !customerIds.includes(orderCustomerId)) {
            return res.status(403).json({ message: 'Access denied to this order' });
          }
        }

        res.json(order);
      } catch (error: any) {
        console.error("Order fetch error:", error);
        // If order not found, return 404
        if (error.message && error.message.includes('Order not found')) {
          return res.status(404).json({ message: "Order not found" });
        }
        res.status(500).json({ message: "Failed to fetch order" });
      }
    }
  );

  // Get invoice linked to an order
  app.get("/api/orders/:id/invoice",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const orderId = req.params.id;

        console.log(`[Order→Invoice] Fetching invoice for order ${orderId}`);

        // Get company's Customer ID for filtering
        let companyCustomerId: string | null = null;
        try {
          const companyResponse = await bigcommerce.getCompanyDetails(req.user!.companyId!);
          const companyData = companyResponse?.data;
          const customerIdField = companyData?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          companyCustomerId = customerIdField?.fieldValue || null;
        } catch (error) {
          console.error(`[Order→Invoice] Failed to get company Customer ID:`, error);
          return res.status(500).json({ message: 'Failed to verify company access' });
        }

        if (!companyCustomerId) {
          console.warn(`[Order→Invoice] No Customer ID found for company ${req.user?.companyId}`);
          return res.json(null);
        }

        // Fetch all invoices
        const response = await bigcommerce.getInvoices(undefined, {});
        const allInvoices = response?.data?.list || response?.data || [];

        // Enrich and filter invoices
        const enrichedInvoices = await Promise.all(
          allInvoices.map(async (invoice: any) => {
            try {
              const detailResponse = await bigcommerce.getInvoice(undefined, invoice.id);
              const fullInvoice = detailResponse?.data;
              return {
                ...invoice,
                ...fullInvoice,
                extraFields: fullInvoice?.extraFields || [],
              };
            } catch (error) {
              return { ...invoice, extraFields: [] };
            }
          })
        );

        // Filter by company Customer ID
        const companyInvoices = enrichedInvoices.filter((invoice: any) => {
          const customerField = invoice.extraFields?.find((f: any) => f.fieldName === 'Customer');
          const invoiceCustomerId = customerField?.fieldValue;
          return invoiceCustomerId === companyCustomerId;
        });

        // Find invoice matching this order's ID
        const linkedInvoice = companyInvoices.find((invoice: any) => {
          return invoice.orderNumber === orderId || invoice.orderNumber === String(orderId);
        });

        if (linkedInvoice) {
          console.log(`[Order→Invoice] Found invoice ${linkedInvoice.id} for order ${orderId}`);
          res.json(linkedInvoice);
        } else {
          console.log(`[Order→Invoice] No invoice found for order ${orderId}`);
          res.json(null);
        }
      } catch (error) {
        console.error("Order invoice fetch error:", error);
        res.status(500).json({ message: "Failed to fetch invoice for order" });
      }
    }
  );

  app.patch("/api/orders/:id",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const response = await bigcommerce.updateOrder(bcToken, req.params.id, req.body);

        const order = response?.data;

        // CRITICAL: Verify resource ownership before allowing update
        if (order && !verifyResourceOwnership(order, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this order' });
        }

        res.json(order || null);
      } catch (error) {
        console.error("Order update error:", error);
        res.status(500).json({ message: "Failed to update order" });
      }
    }
  );

  // Quotes endpoints
  app.get("/api/quotes",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query;

        const response = await bigcommerce.getQuotes(bcToken, {
          search: search as string,
          status: status as string,
          sortBy: sortBy as string,
          limit: limit ? parseInt(limit as string) : undefined,
          recent: recent === 'true',
        });

        // Check for BigCommerce error responses (they return 200 with errMsg)
        if (response?.errMsg || response?.error) {
          console.warn("[Quotes] BigCommerce returned error:", response.errMsg || response.error);
          return res.json([]);
        }

        const quotes = response?.data?.list || response?.data || [];

        // CRITICAL: Filter by company to ensure multi-tenant isolation
        const filteredQuotes = filterByCompany(quotes, req.user?.companyId, req.user?.role);

        res.json(filteredQuotes);
      } catch (error) {
        console.error("Quotes fetch error:", error);
        res.status(500).json({ message: "Failed to fetch quotes" });
      }
    }
  );

  app.get("/api/quotes/:id",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const response = await bigcommerce.getQuote(bcToken, req.params.id);
        const quote = response?.data;

        // CRITICAL: Verify resource ownership
        if (quote && !verifyResourceOwnership(quote, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this quote' });
        }

        res.json(quote || null);
      } catch (error) {
        console.error("Quote fetch error:", error);
        res.status(500).json({ message: "Failed to fetch quote" });
      }
    }
  );

  app.patch("/api/quotes/:id",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const response = await bigcommerce.updateQuote(bcToken, req.params.id, req.body);
        const quote = response?.data;

        // CRITICAL: Verify resource ownership
        if (quote && !verifyResourceOwnership(quote, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this quote' });
        }

        res.json(quote || null);
      } catch (error) {
        console.error("Quote update error:", error);
        res.status(500).json({ message: "Failed to update quote" });
      }
    }
  );

  app.post("/api/quotes",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        // Associate quote with user's company
        const quoteData = {
          ...req.body,
          companyId: req.user?.companyId,
        };
        const response = await bigcommerce.createQuote(bcToken, quoteData);
        res.json(response?.data || null);
      } catch (error) {
        console.error("Quote creation error:", error);
        res.status(500).json({ message: "Failed to create quote" });
      }
    }
  );

  app.post("/api/quotes/:id/convert-to-order",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);

        // First verify quote ownership
        const quoteResponse = await bigcommerce.getQuote(bcToken, req.params.id);
        const quote = quoteResponse?.data;

        if (quote && !verifyResourceOwnership(quote, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this quote' });
        }

        const response = await bigcommerce.convertQuoteToOrder(bcToken, req.params.id);
        res.json(response?.data || null);
      } catch (error) {
        console.error("Quote conversion error:", error);
        res.status(500).json({ message: "Failed to convert quote to order" });
      }
    }
  );

  // Invoices endpoints  
  app.get("/api/invoices",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        // Disable caching to prevent stale data
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query;

        console.log(`[Invoices] Fetching invoices for user: ${req.user?.email} (Company: ${req.user?.companyId})`);

        if (!req.user || !req.user.companyId) {
             return res.status(400).json({ message: "Company ID required" });
        }

        // Get company's customer IDs to fetch orders
        const customerIds = await bigcommerce.getCompanyCustomerIds(bcToken, req.user.companyId);
        console.log(`[Invoices] Company ${req.user.companyId} has ${customerIds.length} customer IDs`);

        if (customerIds.length === 0) {
          console.warn(`[Invoices] No customer IDs found for company ${req.user?.companyId}`);
          return res.json([]);
        }

        // Get company orders (to match invoice.orderNumber to order.id)
        const ordersResponse = await bigcommerce.getOrders(bcToken, { limit: 1000, offset: 0 });
        const b2bOrders = ordersResponse?.data || [];
        
        let companyOrders = [...b2bOrders];
        
        // If B2B API returns no orders, fall back to standard API and filter by customer IDs
        if (b2bOrders.length === 0) {
          try {
            const standardOrdersResponse = await bigcommerce.getStandardBigCommerceOrders({ limit: 250 });
            const standardOrders = standardOrdersResponse.data.list;
            companyOrders = standardOrders.filter((order: B2BOrder) => {
              const orderCustomerId = order.customer_id || order.customerId;
              return orderCustomerId && customerIds.includes(orderCustomerId);
            });
          } catch (error) {
            console.error('[Invoices] Failed to fetch from standard API:', error);
          }
        } else {
          // Filter B2B orders by customer IDs
          companyOrders = b2bOrders.filter((order: any) => {
            const orderCustomerId = order.customer_id || order.customerId;
            return orderCustomerId && customerIds.includes(orderCustomerId);
          });
        }

        const companyOrderIds = companyOrders.map((order: any) => order.id || order.bcOrderId);
        console.log(`[Invoices] Found ${companyOrderIds.length} company orders: ${JSON.stringify(companyOrderIds)}`);

        // Fetch all invoices
        const response = await bigcommerce.getInvoices(undefined, {
          search: search as string,
          status: status as string,
          sortBy: sortBy as string,
          limit: limit ? parseInt(limit as string) : undefined,
          recent: recent === 'true',
        });

        const allInvoices = response?.data?.list || response?.data || [];
        console.log(`[Invoices] Retrieved ${allInvoices.length} total invoices from BigCommerce`);

        // Get company's Customer ID from extraFields (e.g., "FEM01")
        let companyCustomerId: string | null = null;
        try {
          const companyResponse = await bigcommerce.getCompanyDetails(req.user!.companyId!);
          const companyData = companyResponse?.data;
          const customerIdField = companyData?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          companyCustomerId = customerIdField?.fieldValue || null;
          console.log(`[Invoices] Company ${req.user?.companyId} Customer ID: ${companyCustomerId}`);
        } catch (error) {
          console.error(`[Invoices] Failed to get company Customer ID:`, error);
        }

        // Enrich ALL invoices with full details FIRST (to get extraFields for filtering)
        const enrichedAllInvoices = await Promise.all(
          allInvoices.map(async (invoice: any) => {
            try {
              const detailResponse = await bigcommerce.getInvoice(undefined, invoice.id);
              const fullInvoice = detailResponse?.data;
              return {
                ...invoice,
                extraFields: fullInvoice?.extraFields || [],
                details: fullInvoice?.details || invoice.details
              };
            } catch (error) {
              console.error(`[Invoices] Failed to enrich invoice ${invoice.id}:`, error);
              return { ...invoice, extraFields: [] };
            }
          })
        );

        // CRITICAL: Filter invoices by matching Customer ID in extraFields (Architect-approved method)
        let customerIdMatches = 0;
        let orderNumberMatches = 0;
        let missingBothFields = 0;
        
        const companyInvoices = enrichedAllInvoices.filter((invoice: any) => {
          // Check if invoice has Customer field in extraFields
          const invoiceCustomer = invoice.extraFields?.find((f: any) => f.fieldName === 'Customer');
          const invoiceCustomerId = invoiceCustomer?.fieldValue || null;
          
          // Primary: If company has Customer ID AND invoice has Customer field, match by Customer ID
          if (companyCustomerId && invoiceCustomerId) {
            const matches = invoiceCustomerId === companyCustomerId;
            if (matches) customerIdMatches++;
            return matches;
          }
          
          // Fallback: If invoice missing Customer field OR company missing Customer ID, filter by order numbers
          const orderNumber = invoice.orderNumber ? String(invoice.orderNumber) : null;
          const matchesOrder = orderNumber && companyOrderIds.some((orderId: any) => String(orderId) === orderNumber);
          
          if (matchesOrder) {
            orderNumberMatches++;
          } else if (!invoiceCustomerId && !orderNumber) {
            missingBothFields++;
          }
          
          return matchesOrder;
        });

        console.log(`[Invoices] Filtered ${allInvoices.length} total → ${companyInvoices.length} for company ${req.user?.companyId}`);
        console.log(`[Invoices] Filtering stats: ${customerIdMatches} by Customer ID (${companyCustomerId}), ${orderNumberMatches} by order number, ${missingBothFields} missing both fields (excluded)`);

        res.json(companyInvoices);
      } catch (error) {
        console.error("Invoices fetch error:", error);
        res.status(500).json({ message: "Failed to fetch invoices" });
      }
    }
  );

  app.get("/api/invoices/:id",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);

        // Get company's Customer ID using REST API (not GraphQL)
        let companyCustomerId: string | null = null;
        try {
          const companyResponse = await bigcommerce.getCompanyDetails(req.user!.companyId!);
          const companyData = companyResponse?.data;
          const customerIdField = companyData?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          companyCustomerId = customerIdField?.fieldValue || null;
        } catch (error) {
          console.error(`[Invoice Detail] Failed to get company Customer ID:`, error);
          return res.status(500).json({ message: 'Failed to verify access' });
        }

        // Fetch the invoice
        const response = await bigcommerce.getInvoice(undefined, req.params.id);
        const invoice = response?.data;

        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }

        // SECURITY: Verify invoice belongs to user's company
        const customerField = invoice.extraFields?.find((f: any) => f.fieldName === 'Customer');
        const invoiceCustomerId = customerField?.fieldValue;

        if (invoiceCustomerId !== companyCustomerId) {
          console.log(`[Invoice Detail] SECURITY: Blocking invoice ${req.params.id} - Customer ${invoiceCustomerId} !== ${companyCustomerId}`);
          return res.status(403).json({ message: 'Access denied to this invoice' });
        }

        console.log(`[Invoice Detail] Retrieved invoice ${req.params.id} for company ${req.user?.companyId}`);
        res.json(invoice);
      } catch (error) {
        console.error("Invoice fetch error:", error);
        res.status(500).json({ message: "Failed to fetch invoice" });
      }
    }
  );

  app.get("/api/invoices/:id/pdf",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);

        // Get company's Customer ID using REST API (not GraphQL)
        let companyCustomerId: string | null = null;
        try {
          const companyResponse = await bigcommerce.getCompanyDetails(req.user!.companyId!);
          const companyData = companyResponse?.data;
          const customerIdField = companyData?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          companyCustomerId = customerIdField?.fieldValue || null;
        } catch (error) {
          console.error(`[Invoice PDF] Failed to get company Customer ID:`, error);
          return res.status(500).json({ message: 'Failed to verify access' });
        }

        // Fetch invoice first to verify ownership
        const invoiceResponse = await bigcommerce.getInvoice(undefined, req.params.id);
        const invoice = invoiceResponse?.data;

        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }

        // SECURITY: Verify invoice belongs to user's company
        const customerField = invoice.extraFields?.find((f: any) => f.fieldName === 'Customer');
        const invoiceCustomerId = customerField?.fieldValue;

        if (invoiceCustomerId !== companyCustomerId) {
          console.log(`[Invoice PDF] SECURITY: Blocking invoice ${req.params.id} - Customer ${invoiceCustomerId} !== ${companyCustomerId}`);
          return res.status(403).json({ message: 'Access denied to this invoice' });
        }

        // Get PDF URL from BigCommerce
        const pdfResponse = await bigcommerce.getInvoicePdf(undefined, req.params.id);
        const pdfUrl = pdfResponse?.data?.url;

        if (!pdfUrl) {
          return res.status(404).json({ message: 'PDF not available for this invoice' });
        }

        // Fetch the actual PDF file from S3
        const pdfFileResponse = await fetch(pdfUrl);

        if (!pdfFileResponse.ok) {
          throw new Error('Failed to download PDF from storage');
        }

        const pdfBuffer = await pdfFileResponse.arrayBuffer();

        console.log(`[Invoice PDF] Generated PDF for invoice ${req.params.id} for company ${req.user?.companyId}`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=invoice-${invoice.invoiceNumber || req.params.id}.pdf`);
        res.send(Buffer.from(pdfBuffer));
      } catch (error: any) {
        console.error("Invoice PDF error:", error);
        res.status(500).json({ message: error.message || "Failed to generate invoice PDF" });
      }
    }
  );

  // Company endpoints
  app.get("/api/company",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const response = await bigcommerce.getCompany(bcToken);
        const company = response?.data;

        // Users can only view their own company (unless admin)
        if (company && !verifyResourceOwnership(company, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }

        // Also fetch full company details to get extraFields (including aged invoice data)
        if (company?.companyId) {
          try {
            const fullCompanyResponse = await bigcommerce.getCompanyDetails(company.companyId);
            if (fullCompanyResponse?.data) {
              // Merge extraFields from full company details into GraphQL company data
              // Ensure extraFields is always an array for consistent frontend parsing
              const extraFields = fullCompanyResponse.data.extraFields;
              company.extraFields = Array.isArray(extraFields) ? extraFields : [];
            } else {
              // REST API returned but no data - set empty array
              company.extraFields = [];
            }
          } catch (error: any) {
            // Log error but don't fail the request - extraFields is optional
            console.error(`[Company] Failed to fetch extraFields for company ${company.companyId}:`, error.message);
            company.extraFields = [];
            // Add error flag so frontend can show warning
            company.extraFieldsError = true;
          }
        } else {
          company.extraFields = [];
        }

        res.json(company || {});
      } catch (error) {
        console.error("Company fetch error:", error);
        res.status(500).json({ message: "Failed to fetch company" });
      }
    }
  );

  app.get("/api/company/credit",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        // Disable caching to prevent stale data
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        if (!req.user?.companyId) {
          return res.status(400).json({ message: 'Company ID required' });
        }

        const companyId = req.user.companyId;
        console.log(`\n========== COMPREHENSIVE CREDIT INVESTIGATION FOR COMPANY ${companyId} ==========\n`);

        // TEST 1: Check if company credit feature is enabled at store level
        console.log('TEST 1: Checking company credit configuration...');
        const configResult = await bigcommerce.getCompanyCreditConfiguration();
        console.log('Config Result:', JSON.stringify(configResult, null, 2));

        // TEST 2: Try to fetch company credit (will fail if feature is disabled)
        console.log('\nTEST 2: Attempting to fetch company credit...');
        const creditResult = await bigcommerce.getCompanyCredit(companyId);
        console.log('Credit Result:', JSON.stringify(creditResult, null, 2));

        // TEST 3: Fetch full company details to check for credit in extraFields
        console.log('\nTEST 3: Fetching full company details for extraFields...');
        const companyResult = await bigcommerce.getCompanyDetails(companyId);
        console.log('Company Result:', JSON.stringify(companyResult, null, 2));

        // Analyze results
        console.log('\n========== ANALYSIS ==========');
        
        let creditData: any = {
          creditEnabled: false,
          creditCurrency: 'GBP',
          availableCredit: 0,
          creditLimit: 0,
          balance: 0,
          limitPurchases: false,
          creditHold: false,
          source: 'none'
        };

        // Priority 1: If credit endpoint works, use that
        if (creditResult?.data) {
          console.log('✅ Found credit data from /credit endpoint');
          creditData = {
            creditEnabled: true,
            ...creditResult.data,
            source: '/api/v3/io/companies/{companyId}/credit'
          };
        }
        // Priority 2: Check extraFields in company details
        else if (companyResult?.data?.extraFields) {
          console.log('Checking extraFields for credit limit...');
          const extraFields = companyResult.data.extraFields;
          console.log('ExtraFields:', JSON.stringify(extraFields, null, 2));
          
          // Look for credit-related fields
          const creditField = extraFields.find((f: any) => 
            f.fieldName?.toLowerCase().includes('credit') || 
            f.fieldName?.toLowerCase().includes('limit')
          );
          
          if (creditField) {
            console.log('✅ Found credit in extraFields:', creditField);
            creditData.creditLimit = parseFloat(creditField.fieldValue) || 0;
            creditData.creditEnabled = true;
            creditData.source = `extraFields.${creditField.fieldName}`;
          } else {
            console.log('❌ No credit-related fields found in extraFields');
            console.log('Available field names:', extraFields.map((f: any) => f.fieldName));
          }
        }

        console.log('\n========== FINAL CREDIT DATA ==========');
        console.log(JSON.stringify(creditData, null, 2));
        console.log('=========================================\n');

        res.json(creditData);
      } catch (error: any) {
        console.error("Company credit fetch error:", error);
        res.status(500).json({ 
          message: "Failed to fetch company credit",
          error: error.message 
        });
      }
    }
  );

  app.get("/api/company/users",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        // Disable caching to prevent stale data
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const bcToken = await getBigCommerceToken(req);
        
        // For non-admin users, pass companyId to filter at the API level for better performance
        // Admins fetch all users without companyId filter
        const companyIdForQuery = (req.user?.role === 'admin' || req.user?.role === 'superadmin') 
          ? undefined 
          : req.user?.companyId;
        
        const response = await bigcommerce.getCompanyUsers(bcToken, companyIdForQuery);
        const users = response?.data || [];

        console.log(`[Users] Total users fetched from API: ${users.length}`);
        console.log(`[Users] User companyId: ${req.user?.companyId}, role: ${req.user?.role}`);

        // Apply client-side filter as additional security layer
        const filteredUsers = filterByCompany(users, req.user?.companyId, req.user?.role);

        console.log(`[Users] Final filtered users: ${filteredUsers.length}`);
        res.json(filteredUsers);
      } catch (error) {
        console.error("Company users fetch error:", error);
        res.status(500).json({ message: "Failed to fetch company users" });
      }
    }
  );

  app.get("/api/company/addresses",
    authenticateToken,
    sessionTimeout,

    async (req: AuthRequest, res) => {
      try {
        // Disable caching to prevent stale data
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const bcToken = await getBigCommerceToken(req);
        // Pass company filter directly to BigCommerce API (like users endpoint)
        const response = await bigcommerce.getCompanyAddresses(bcToken, req.user?.companyId);
        const addresses = response?.data?.list || response?.data || [];

        console.log(`[Addresses] RAW API returned ${addresses.length} addresses for company ${req.user?.companyId}`);

        // Deduplicate addresses by id or addressId (BigCommerce sometimes returns duplicates)
        let uniqueAddresses = addresses.filter((addr: any, index: number, self: any[]) => 
          index === self.findIndex((a: any) => 
            (a.id && a.id === addr.id) || (a.addressId && a.addressId === addr.addressId)
          )
        );

        console.log(`[Addresses] After deduplication: ${uniqueAddresses.length} unique addresses (removed ${addresses.length - uniqueAddresses.length} duplicates)`);

        // If no addresses found in address book, try to use company's default address
        if (uniqueAddresses.length === 0 && req.user?.companyId) {
          try {
            console.log(`[Addresses] No address book entries found, fetching company default address for ${req.user.companyId}`);
            const companyResponse = await bigcommerce.getCompanyDetails(req.user.companyId);
            const company = companyResponse?.data;

            // Check if company has address fields populated
            if (company && company.addressLine1) {
              console.log('[Addresses] Company has default address, adding to results');
              const defaultAddress = {
                id: `company-${company.companyId}`,
                addressId: `company-${company.companyId}`,
                companyId: company.companyId,
                firstName: company.companyName?.split(' ')[0] || '',
                lastName: company.companyName?.split(' ').slice(1).join(' ') || '',
                addressLine1: company.addressLine1,
                addressLine2: company.addressLine2 || '',
                city: company.city || '',
                stateCode: company.state || '',
                stateName: company.state || '',
                zipCode: company.zipCode || '',
                country: company.country || '',
                countryCode: company.country || '',
                countryName: company.country || '',
                phoneNumber: company.companyPhone || '',
                isDefaultShipping: true,
                isDefaultBilling: true,
                label: 'Company Headquarters'
              };
              uniqueAddresses = [defaultAddress];
              console.log('[Addresses] Added company default address:', JSON.stringify(defaultAddress, null, 2));
            }
          } catch (companyError) {
            console.log('[Addresses] Could not fetch company default address:', companyError);
          }
        }

        // Note: Already filtered by BigCommerce API, but apply filterByCompany for admin access control
        const filteredAddresses = filterByCompany(uniqueAddresses, req.user?.companyId, req.user?.role);

        console.log(`[Addresses] Final filtered count: ${filteredAddresses.length} addresses`);
        res.json(filteredAddresses);
      } catch (error) {
        console.error("Company addresses fetch error:", error);
        res.status(500).json({ message: "Failed to fetch company addresses" });
      }
    }
  );

  // Accessible companies endpoint (Item 12)
  app.get("/api/company/accessible", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const companies = await storage.getAccessibleCompanies(req.user.userId);
      res.json(companies);
    } catch (error) {
      console.error("Accessible companies fetch error:", error);
      res.status(500).json({ message: "Failed to fetch accessible companies" });
    }
  });

  // Switch company endpoint (Item 12)
  app.post("/api/company/switch", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ message: "Company ID required" });
      }

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify user has access to this company
      const accessibleCompanies = await storage.getAccessibleCompanies(req.user.userId);
      const hasAccess = accessibleCompanies.some(c => c.id === companyId);

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this company" });
      }

      // Update user's current company
      await storage.updateUser(req.user.userId, { companyId });

      // Generate new token with updated companyId
      const newToken = generateAccessToken({
        ...req.user,
        companyId,
      });

      res.json({
        message: "Company switched successfully",
        accessToken: newToken,
      });
    } catch (error) {
      console.error("Company switch error:", error);
      res.status(500).json({ message: "Failed to switch company" });
    }
  });

  // Update company endpoint (Item 13)
  app.patch("/api/company/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has permission to edit company
      if (!['admin', 'manager'].includes(req.user.role || '')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Update company (this would also sync with BigCommerce in production)
      const updatedCompany = await storage.updateCompany(id, updates);

      res.json(updatedCompany);
    } catch (error) {
      console.error("Company update error:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Company hierarchy endpoint (Item 11)
  app.get("/api/company/hierarchy", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const companyId = req.query.companyId as string || req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ message: "Company ID required" });
      }

      const hierarchy = await storage.getCompanyHierarchy(companyId);
      const [currentCompany] = await storage.getAccessibleCompanies(req.user?.userId || '');

      res.json({
        parent: hierarchy.parent,
        children: hierarchy.children,
        current: currentCompany || null,
      });
    } catch (error) {
      console.error("Company hierarchy fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company hierarchy" });
    }
  });

  // User management endpoints
  app.post("/api/users", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.patch("/api/users/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.delete("/api/users/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  // Address management endpoints
  app.post("/api/addresses", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.patch("/api/addresses/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.delete("/api/addresses/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.patch("/api/addresses/:id/set-default", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  // Products endpoints
  app.get("/api/products/search", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const bcToken = await getBigCommerceToken(req);
      const { query } = req.query;
      const response = await bigcommerce.searchProducts(bcToken, query as string || '');
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Product search error:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Cart endpoints (Items 31, 32)
  app.get("/api/cart", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const bcToken = await getBigCommerceToken(req);
      // In production, use BigCommerce cart API
      // For now, return mock cart data
      res.json({
        id: 'cart-1',
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
      });
    } catch (error) {
      console.error("Cart fetch error:", error);
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post("/api/cart/items", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const bcToken = await getBigCommerceToken(req);
      const { items } = req.body;

      // In production, add items to BigCommerce cart
      console.log('[Cart] Adding items:', items);

      res.json({ message: "Items added to cart", items });
    } catch (error) {
      console.error("Cart add error:", error);
      res.status(500).json({ message: "Failed to add items to cart" });
    }
  });

  app.patch("/api/cart/items/:id", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const bcToken = await getBigCommerceToken(req);
      const { quantity } = req.body;

      console.log(`[Cart] Updating item ${req.params.id} to quantity ${quantity}`);

      res.json({ message: "Cart item updated" });
    } catch (error) {
      console.error("Cart update error:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/items/:id", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const bcToken = await getBigCommerceToken(req);

      console.log(`[Cart] Removing item ${req.params.id}`);

      res.json({ message: "Cart item removed" });
    } catch (error) {
      console.error("Cart delete error:", error);
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  // Shopping Lists endpoints - using BigCommerce API
  app.get("/api/shopping-lists", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const bcToken = await getBigCommerceToken(req);
      const response = await bigcommerce.getShoppingLists(bcToken);
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Shopping lists fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping lists" });
    }
  });

  app.get("/api/shopping-lists/:id", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const bcToken = await getBigCommerceToken(req);
      const response = await bigcommerce.getShoppingList(bcToken, req.params.id);
      if (!response?.data) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      res.json(response.data);
    } catch (error) {
      console.error("Shopping list fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping list" });
    }
  });

  app.post("/api/shopping-lists", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const list = await storage.createShoppingList(req.body);
      res.status(201).json(list);
    } catch (error) {
      console.error("Shopping list create error:", error);
      res.status(500).json({ message: "Failed to create shopping list" });
    }
  });

  app.patch("/api/shopping-lists/:id", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const list = await storage.updateShoppingList(req.params.id, req.body);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      res.json(list);
    } catch (error) {
      console.error("Shopping list update error:", error);
      res.status(500).json({ message: "Failed to update shopping list" });
    }
  });

  app.delete("/api/shopping-lists/:id", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteShoppingList(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Shopping list delete error:", error);
      res.status(500).json({ message: "Failed to delete shopping list" });
    }
  });

  // Shopping List Items endpoints - using local database
  app.get("/api/shopping-lists/:id/items", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getShoppingListItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Shopping list items fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping list items" });
    }
  });

  app.post("/api/shopping-lists/:id/items", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const item = await storage.addShoppingListItem({
        ...req.body,
        listId: req.params.id
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Shopping list item add error:", error);
      res.status(500).json({ message: "Failed to add shopping list item" });
    }
  });

  app.patch("/api/shopping-list-items/:id", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const item = await storage.updateShoppingListItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Shopping list item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Shopping list item update error:", error);
      res.status(500).json({ message: "Failed to update shopping list item" });
    }
  });

  app.delete("/api/shopping-list-items/:id", authenticateToken, sessionTimeout, async (req: AuthRequest, res) => {
    try {
      const success = await storage.deleteShoppingListItem(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Shopping list item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Shopping list item delete error:", error);
      res.status(500).json({ message: "Failed to delete shopping list item" });
    }
  });

  // Compatibility: /api/v3 route aliases for client parity
  // These mirror existing /api/* endpoints to support clients expecting /api/v3/* paths

  // Auth (v3 aliases)
  app.post("/api/v3/login", async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      console.log('[Login v3] Attempting BigCommerce login for:', email);
      const result = await bigcommerce.login(email, password);

      // Extract customerId from BigCommerce JWT token
      let customerId: number | undefined;
      try {
        const decoded = jwt.decode(result.token) as any;
        if (decoded?.bc_customer_id) {
          customerId = decoded.bc_customer_id;
          console.log('[Login v3] Extracted customerId from BC token:', customerId);
        }
      } catch (_) {}

      // Get or create user locally
      let user = await storage.getUserByEmail(email);

      // Fetch company data from BigCommerce using the token
      let companyId = user?.companyId;
      try {
        const companyData = await bigcommerce.getCompany(result.token);
        if (companyData?.data?.companyId || companyData?.data?.id) {
          companyId = companyData.data.companyId || companyData.data.id;
        }
      } catch (_) {}

      if (!user) {
        user = await storage.createUser({
          email,
          password: await bcrypt.hash(password, 10),
          name: email.split('@')[0],
          role: 'buyer',
          companyId,
          customerId,
        });
      } else {
        const updates: any = {};
        if (companyId && user.companyId !== companyId) updates.companyId = companyId;
        if (customerId && user.customerId !== customerId) updates.customerId = customerId;
        if (Object.keys(updates).length > 0) {
          const updatedUser = await storage.updateUser(user.id, updates);
          if (updatedUser) user = updatedUser;
        }
      }

      if (!user) {
        throw new Error('User creation failed');
      }

      await storage.storeUserToken(user.id, result.token, companyId || undefined);

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        companyId: user.companyId || companyId || undefined,
        customerId: customerId || user.customerId || undefined,
        role: user.role || 'buyer',
      };

      const accessToken = generateAccessToken(tokenPayload, rememberMe);
      const refreshToken = generateRefreshToken(tokenPayload, rememberMe);

      trackSession(user.id, accessToken);

      if (rememberMe) {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax', // Changed from 'strict' to 'lax' for Replit iframe compatibility
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }

      res.json({
        accessToken,
        refreshToken: rememberMe ? undefined : refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        },
      });
    } catch (error: any) {
      console.error("[Login v3] Login failed:", error.message);
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  app.post("/api/v3/logout", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user) {
        clearSession(req.user.userId);
        await storage.clearUserToken(req.user.userId);
      }
      res.clearCookie('refreshToken');
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("[Logout v3] Error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Dashboard stats (v3 alias)
  app.get("/api/v3/dashboard/stats",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const stats = await bigcommerce.getDashboardStats(bcToken);
        res.json(stats);
      } catch (error) {
        console.error("[Dashboard v3] stats error:", error);
        res.status(500).json({ message: "Failed to fetch dashboard stats" });
      }
    }
  );

  // Orders (v3 aliases)
  app.get("/api/v3/orders",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[Orders v3] Fetching company orders for user:', req.user?.email);
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query as any;

        const companyId = req.user?.companyId;
        if (!companyId) {
          console.warn('[Orders v3] No company ID found for user');
          return res.json([]);
        }

        const customerIds = await bigcommerce.getCompanyCustomerIds(bcToken, companyId);
        if (customerIds.length === 0) {
          console.warn('[Orders v3] No customer IDs found for company', companyId);
          return res.json([]);
        }

        const response = await bigcommerce.getOrders(bcToken, {
          search,
          status,
          sortBy,
          limit: limit ? parseInt(String(limit)) : 1000,
          recent: String(recent) === 'true',
        }, companyId);

        if ((response as any)?.errMsg || (response as any)?.error) {
          console.warn("[Orders v3] BigCommerce returned error:", (response as any).errMsg || (response as any).error);
          return res.json([]);
        }

        const bcOrders = response?.data || [];
        const allOrders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];
        const companyOrders = allOrders.filter((order: any) => {
          const orderCustomerId = order.customer_id || order.customerId;
          return orderCustomerId && customerIds.includes(orderCustomerId);
        });
        res.json(companyOrders);
      } catch (error) {
        console.error("[Orders v3] fetch error:", error);
        res.status(500).json({ message: "Failed to fetch orders" });
      }
    }
  );

  app.get("/api/v3/orders/:id",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);

        let companyId: string | undefined;
        try {
          const companyResponse = await bigcommerce.getCompany(bcToken);
          companyId = companyResponse?.data?.companyId || companyResponse?.data?.id;
        } catch (_) {}

        const response = await bigcommerce.getOrder(bcToken, req.params.id, companyId);
        const bcOrder = response?.data;
        if (!bcOrder) {
          return res.status(404).json({ message: "Order not found" });
        }

        const order = transformOrder(bcOrder);

        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          if (!req.user?.companyId) {
            return res.status(403).json({ message: 'Company ID not found' });
          }
          const customerIds = await bigcommerce.getCompanyCustomerIds(bcToken, req.user.companyId);
          const orderCustomerId = order.customerId;
          if (!orderCustomerId || !customerIds.includes(orderCustomerId)) {
            return res.status(403).json({ message: 'Access denied to this order' });
          }
        }

        res.json(order);
      } catch (error: any) {
        console.error("[Orders v3] fetch error:", error);
        if (error.message && error.message.includes('Order not found')) {
          return res.status(404).json({ message: "Order not found" });
        }
        res.status(500).json({ message: "Failed to fetch order" });
      }
    }
  );

  // Quotes (v3 aliases)
  app.get("/api/v3/quotes",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query as any;
        const response = await bigcommerce.getQuotes(bcToken, {
          search,
          status,
          sortBy,
          limit: limit ? parseInt(String(limit)) : undefined,
          recent: String(recent) === 'true',
        });
        if (response?.errMsg || response?.error) {
          console.warn("[Quotes v3] BigCommerce returned error:", response.errMsg || response.error);
          return res.json([]);
        }
        const quotes = response?.data?.list || response?.data || [];
        const filteredQuotes = filterByCompany(quotes, req.user?.companyId, req.user?.role);
        res.json(filteredQuotes);
      } catch (error) {
        console.error("[Quotes v3] fetch error:", error);
        res.status(500).json({ message: "Failed to fetch quotes" });
      }
    }
  );

  app.get("/api/v3/quotes/:id",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const response = await bigcommerce.getQuote(bcToken, req.params.id);
        const quote = response?.data;
        if (quote && !verifyResourceOwnership(quote, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this quote' });
        }
        res.json(quote || null);
      } catch (error) {
        console.error("[Quotes v3] fetch error:", error);
        res.status(500).json({ message: "Failed to fetch quote" });
      }
    }
  );

  // Company (v3 aliases)
  app.get("/api/v3/company",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const response = await bigcommerce.getCompany(bcToken);
        const company = response?.data;
        if (company && !verifyResourceOwnership(company, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this company' });
        }
        res.json(company || {});
      } catch (error) {
        console.error("[Company v3] fetch error:", error);
        res.status(500).json({ message: "Failed to fetch company" });
      }
    }
  );

  app.get("/api/v3/company/users",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        const bcToken = await getBigCommerceToken(req);
        const companyIdForQuery = (req.user?.role === 'admin' || req.user?.role === 'superadmin')
          ? undefined
          : req.user?.companyId;
        const response = await bigcommerce.getCompanyUsers(bcToken, companyIdForQuery);
        const users = response?.data || [];
        const filteredUsers = filterByCompany(users, req.user?.companyId, req.user?.role);
        res.json(filteredUsers);
      } catch (error) {
        console.error("[Company v3] users fetch error:", error);
        res.status(500).json({ message: "Failed to fetch company users" });
      }
    }
  );

  app.get("/api/v3/company/addresses",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        const bcToken = await getBigCommerceToken(req);
        const response = await bigcommerce.getCompanyAddresses(bcToken, req.user?.companyId);
        const addresses = response?.data?.list || response?.data || [];
        let uniqueAddresses = addresses.filter((addr: any, index: number, self: any[]) =>
          index === self.findIndex((a: any) => (a.id && a.id === addr.id) || (a.addressId && a.addressId === addr.addressId))
        );
        if (uniqueAddresses.length === 0 && req.user?.companyId) {
          try {
            const companyResponse = await bigcommerce.getCompanyDetails(req.user.companyId);
            const company = companyResponse?.data;
            if (company && company.addressLine1) {
              const defaultAddress = {
                id: `company-${company.companyId}`,
                addressId: `company-${company.companyId}`,
                companyId: company.companyId,
                firstName: company.companyName?.split(' ')[0] || '',
                lastName: company.companyName?.split(' ').slice(1).join(' ') || '',
                addressLine1: company.addressLine1,
                addressLine2: company.addressLine2 || '',
                city: company.city || '',
                stateCode: company.state || '',
                stateName: company.state || '',
                zipCode: company.zipCode || '',
                country: company.country || '',
                countryCode: company.country || '',
                countryName: company.country || '',
                phoneNumber: company.companyPhone || '',
                isDefaultShipping: true,
                isDefaultBilling: true,
                label: 'Company Headquarters'
              };
              uniqueAddresses = [defaultAddress];
            }
          } catch (_) {}
        }
        const filteredAddresses = filterByCompany(uniqueAddresses, req.user?.companyId, req.user?.role);
        res.json(filteredAddresses);
      } catch (error) {
        console.error("[Company v3] addresses fetch error:", error);
        res.status(500).json({ message: "Failed to fetch company addresses" });
      }
    }
  );

  // Invoices (v3 aliases)
  app.get("/api/v3/invoices",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query as any;

        if (!req.user?.companyId) {
          return res.status(403).json({ message: 'Company ID required for invoice access' });
        }

        let invoices: any[] = [];
        try {
          const response = await bigcommerce.getInvoices(bcToken, {
            companyId: req.user.companyId,
            search,
            status,
            sortBy,
            limit: limit ? parseInt(String(limit)) : undefined,
            recent: String(recent) === 'true',
          });
          invoices = response?.data?.list || response?.data || [];
        } catch (invoiceError: any) {
          if (invoiceError.message?.includes('companyId is required')) {
            console.error('[Invoices v3] SECURITY ERROR: Missing companyId parameter');
            return res.status(500).json({ message: 'Server configuration error' });
          }
          if (invoiceError.message?.includes('403') || invoiceError.message?.includes('Forbidden')) {
            invoices = [];
          } else {
            throw invoiceError;
          }
        }

        const enrichedInvoices = await Promise.all(
          invoices.map(async (invoice) => {
            try {
              const detailResponse = await bigcommerce.getInvoice(undefined, invoice.id);
              const fullInvoice = detailResponse?.data;
              return { ...invoice, extraFields: fullInvoice?.extraFields || [], details: fullInvoice?.details || invoice.details };
            } catch (_) {
              return { ...invoice, extraFields: [] };
            }
          })
        );

        // Company extraFields filter as defense-in-depth
        let companyInvoices: any[] = [];
        try {
          const companyResponse = await bigcommerce.getCompany(bcToken);
          const companyData = companyResponse?.data;
          const customerIdField = companyData?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          const companyCustomerId = customerIdField?.fieldValue || null;
          companyInvoices = companyCustomerId ? enrichedInvoices.filter((invoice: any) => {
            const customerField = invoice.extraFields?.find((f: any) => f.fieldName === 'Customer');
            const invoiceCustomerId = customerField?.fieldValue;
            return invoiceCustomerId === companyCustomerId;
          }) : [];
        } catch (_) {
          companyInvoices = [];
        }

        res.json(companyInvoices);
      } catch (error) {
        console.error("[Invoices v3] fetch error:", error);
        res.status(500).json({ message: "Failed to fetch invoices" });
      }
    }
  );

  app.get("/api/v3/invoices/:id",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        if (!req.user?.companyId) {
          return res.status(403).json({ message: 'Company ID required for invoice access' });
        }
        const response = await bigcommerce.getInvoice(undefined, req.params.id);
        const invoice = response?.data;
        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }
        try {
          const companyResponse = await bigcommerce.getCompany(bcToken);
          const companyData = companyResponse?.data;
          const customerIdField = companyData?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          const companyCustomerId = customerIdField?.fieldValue || null;
          if (companyCustomerId) {
            const customerField = invoice.extraFields?.find((f: any) => f.fieldName === 'Customer');
            const invoiceCustomerId = customerField?.fieldValue;
            if (invoiceCustomerId !== companyCustomerId) {
              return res.status(403).json({ message: 'Access denied to this invoice' });
            }
          }
        } catch (_) {}
        res.json(invoice);
      } catch (error) {
        console.error("[Invoices v3] fetch error:", error);
        res.status(500).json({ message: "Failed to fetch invoice" });
      }
    }
  );

  app.get("/api/v3/invoices/:id/pdf",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        if (!req.user?.companyId) {
          return res.status(403).json({ message: 'Company ID required for invoice access' });
        }
        const invoiceResponse = await bigcommerce.getInvoice(undefined, req.params.id);
        const invoice = invoiceResponse?.data;
        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }
        try {
          const companyResponse = await bigcommerce.getCompany(bcToken);
          const companyData = companyResponse?.data;
          const customerIdField = companyData?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          const companyCustomerId = customerIdField?.fieldValue || null;
          if (companyCustomerId) {
            const customerField = invoice.extraFields?.find((f: any) => f.fieldName === 'Customer');
            const invoiceCustomerId = customerField?.fieldValue;
            if (invoiceCustomerId !== companyCustomerId) {
              return res.status(403).json({ message: 'Access denied to this invoice' });
            }
          }
        } catch (error) {
          return res.status(500).json({ message: 'Failed to verify access' });
        }
        const pdfResponse = await bigcommerce.getInvoicePdf(undefined, req.params.id);
        const pdfUrl = pdfResponse?.data?.url;
        if (!pdfUrl) {
          return res.status(404).json({ message: 'PDF not available for this invoice' });
        }
        const pdfFileResponse = await fetch(pdfUrl);
        if (!pdfFileResponse.ok) {
          throw new Error('Failed to download PDF from storage');
        }
        const pdfBuffer = await pdfFileResponse.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=invoice-${invoice.invoiceNumber || req.params.id}.pdf`);
        res.send(Buffer.from(pdfBuffer));
      } catch (error: any) {
        console.error("[Invoices v3] PDF error:", error);
        res.status(500).json({ message: error.message || "Failed to generate invoice PDF" });
      }
    }
  );

  // ============================================
  // EXTRA FIELDS ENDPOINTS
  // Per BigCommerce B2B API: Extra fields allow custom data
  // for orders, companies, invoices, etc.
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis
  // ============================================

  // Get extra field configurations
  app.get("/api/extra-fields/configs",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[Extra Fields] Fetching all extra field configurations...');

        const [orderConfigs, companyConfigs, invoiceConfigs] = await Promise.all([
          bigcommerce.getOrderExtraFieldConfigs(),
          bigcommerce.getCompanyExtraFieldConfigs(),
          bigcommerce.getInvoiceExtraFieldConfigs(),
        ]);

        res.json({
          orders: orderConfigs?.data || [],
          companies: companyConfigs?.data || [],
          invoices: invoiceConfigs?.data || [],
        });
      } catch (error) {
        console.error("[Extra Fields] Config fetch error:", error);
        res.status(500).json({ message: "Failed to fetch extra field configurations" });
      }
    }
  );

  // Get order with extra fields (GraphQL)
  app.get("/api/orders/:id/extra-fields",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const orderId = req.params.id;

        console.log(`[Extra Fields] Fetching extra fields for order ${orderId}`);

        const response = await bigcommerce.getOrderWithExtraFields(bcToken, orderId);

        if (!response?.data) {
          // Fallback: Return empty extra fields if GraphQL fails
          return res.json({ extraFields: [], message: 'Extra fields not available for this order' });
        }

        // Extract just the extra fields from the order
        const extraFields = response.data.extraFields || [];
        const extraIntFields = {
          extraInt1: response.data.extraInt1,
          extraInt2: response.data.extraInt2,
          extraInt3: response.data.extraInt3,
          extraInt4: response.data.extraInt4,
          extraInt5: response.data.extraInt5,
        };
        const extraStrFields = {
          extraStr1: response.data.extraStr1,
          extraStr2: response.data.extraStr2,
          extraStr3: response.data.extraStr3,
          extraStr4: response.data.extraStr4,
          extraStr5: response.data.extraStr5,
        };
        const extraText = response.data.extraText;

        res.json({
          extraFields,
          ...extraIntFields,
          ...extraStrFields,
          extraText,
        });
      } catch (error) {
        console.error("[Extra Fields] Order extra fields error:", error);
        res.status(500).json({ message: "Failed to fetch order extra fields" });
      }
    }
  );

  // Get company with extra fields
  app.get("/api/company/extra-fields",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);

        console.log('[Extra Fields] Fetching company extra fields');

        const response = await bigcommerce.getCompanyWithExtraFields(bcToken);

        if (!response?.data) {
          return res.json({ extraFields: [], message: 'Extra fields not available' });
        }

        res.json({
          company: response.data,
          extraFields: response.data.extraFields || [],
        });
      } catch (error) {
        console.error("[Extra Fields] Company extra fields error:", error);
        res.status(500).json({ message: "Failed to fetch company extra fields" });
      }
    }
  );

  // ============================================
  // COMPANY HIERARCHY ENDPOINTS
  // Per BigCommerce B2B API: Parent-subsidiary company relationships
  // ============================================

  // Get company hierarchy
  app.get("/api/company/hierarchy",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Hierarchy] Fetching hierarchy for company ${req.user.companyId}`);
        const response = await bigcommerce.getCompanyHierarchy(req.user.companyId);

        res.json(response?.data || { parent: null, children: [] });
      } catch (error) {
        console.error("[Hierarchy] Error:", error);
        res.status(500).json({ message: "Failed to fetch company hierarchy" });
      }
    }
  );

  // Get subsidiaries
  app.get("/api/company/subsidiaries",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Subsidiaries] Fetching subsidiaries for company ${req.user.companyId}`);
        const response = await bigcommerce.getCompanySubsidiaries(req.user.companyId);

        res.json(response?.data || []);
      } catch (error) {
        console.error("[Subsidiaries] Error:", error);
        res.status(500).json({ message: "Failed to fetch subsidiaries" });
      }
    }
  );

  // Attach subsidiary (admin only)
  app.post("/api/company/subsidiaries",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        const { childCompanyId } = req.body;
        if (!childCompanyId) {
          return res.status(400).json({ message: "Child company ID required" });
        }

        console.log(`[Subsidiaries] Attaching company ${childCompanyId} to ${req.user.companyId}`);
        await bigcommerce.attachCompanyAsSubsidiary(req.user.companyId, childCompanyId);

        res.json({ message: "Subsidiary attached successfully" });
      } catch (error) {
        console.error("[Subsidiaries] Attach error:", error);
        res.status(500).json({ message: "Failed to attach subsidiary" });
      }
    }
  );

  // Detach subsidiary (admin only)
  app.delete("/api/company/subsidiaries/:companyId",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { companyId } = req.params;
        console.log(`[Subsidiaries] Detaching company ${companyId}`);
        await bigcommerce.detachCompanyFromParent(companyId);

        res.json({ message: "Subsidiary detached successfully" });
      } catch (error) {
        console.error("[Subsidiaries] Detach error:", error);
        res.status(500).json({ message: "Failed to detach subsidiary" });
      }
    }
  );

  // ============================================
  // INVOICE PAYMENT ENDPOINTS
  // Per BigCommerce B2B API: Record and track invoice payments
  // ============================================

  // Get payments for an invoice
  app.get("/api/invoices/:id/payments",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log(`[Payments] Fetching payments for invoice ${req.params.id}`);
        const response = await bigcommerce.getInvoicePayments(req.params.id);

        res.json(response?.data || []);
      } catch (error) {
        console.error("[Payments] Error:", error);
        res.status(500).json({ message: "Failed to fetch invoice payments" });
      }
    }
  );

  // Record a payment
  app.post("/api/invoices/:id/payments",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const { amount, paymentMethod, reference, paymentDate, notes } = req.body;

        if (!amount || !paymentMethod) {
          return res.status(400).json({ message: "Amount and payment method are required" });
        }

        console.log(`[Payments] Recording payment of ${amount} for invoice ${req.params.id}`);
        const response = await bigcommerce.recordInvoicePayment(req.params.id, {
          amount: parseFloat(amount),
          paymentMethod,
          reference,
          paymentDate,
          notes,
        });

        res.json(response?.data || { success: true });
      } catch (error) {
        console.error("[Payments] Record error:", error);
        res.status(500).json({ message: "Failed to record payment" });
      }
    }
  );

  // Get all payments (admin only)
  app.get("/api/payments",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const { companyId, status, limit, offset } = req.query;

        console.log('[Payments] Fetching all payments');
        const response = await bigcommerce.getAllPayments({
          companyId: companyId as string,
          status: status as string,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
        });

        res.json(response?.data || []);
      } catch (error) {
        console.error("[Payments] Error:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
      }
    }
  );

  // ============================================
  // COMPANY ROLES & PERMISSIONS ENDPOINTS
  // Per BigCommerce B2B API: Role-based access control
  // ============================================

  // Get company roles
  app.get("/api/company/roles",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Roles] Fetching roles for company ${req.user.companyId}`);
        const response = await bigcommerce.getCompanyRoles(req.user.companyId);

        res.json(response?.data || []);
      } catch (error) {
        console.error("[Roles] Error:", error);
        res.status(500).json({ message: "Failed to fetch company roles" });
      }
    }
  );

  // Get role details
  app.get("/api/company/roles/:roleId",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Roles] Fetching role ${req.params.roleId}`);
        const response = await bigcommerce.getCompanyRole(req.user.companyId, req.params.roleId);

        if (!response?.data) {
          return res.status(404).json({ message: "Role not found" });
        }

        res.json(response.data);
      } catch (error) {
        console.error("[Roles] Error:", error);
        res.status(500).json({ message: "Failed to fetch role" });
      }
    }
  );

  // Get available permissions
  app.get("/api/company/permissions",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Permissions] Fetching permissions for company ${req.user.companyId}`);
        const response = await bigcommerce.getCompanyPermissions(req.user.companyId);

        res.json(response?.data || []);
      } catch (error) {
        console.error("[Permissions] Error:", error);
        res.status(500).json({ message: "Failed to fetch permissions" });
      }
    }
  );

  // Create a role (admin only)
  app.post("/api/company/roles",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        const { name, permissions } = req.body;
        if (!name) {
          return res.status(400).json({ message: "Role name is required" });
        }

        console.log(`[Roles] Creating role ${name}`);
        const response = await bigcommerce.createCompanyRole(req.user.companyId, {
          name,
          permissions: permissions || [],
        });

        res.status(201).json(response?.data || { success: true });
      } catch (error) {
        console.error("[Roles] Create error:", error);
        res.status(500).json({ message: "Failed to create role" });
      }
    }
  );

  // Update a role (admin only)
  app.patch("/api/company/roles/:roleId",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        const { name, permissions } = req.body;
        console.log(`[Roles] Updating role ${req.params.roleId}`);
        const response = await bigcommerce.updateCompanyRole(req.user.companyId, req.params.roleId, {
          name,
          permissions,
        });

        res.json(response?.data || { success: true });
      } catch (error) {
        console.error("[Roles] Update error:", error);
        res.status(500).json({ message: "Failed to update role" });
      }
    }
  );

  // Delete a role (admin only)
  app.delete("/api/company/roles/:roleId",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Roles] Deleting role ${req.params.roleId}`);
        await bigcommerce.deleteCompanyRole(req.user.companyId, req.params.roleId);

        res.status(204).send();
      } catch (error) {
        console.error("[Roles] Delete error:", error);
        res.status(500).json({ message: "Failed to delete role" });
      }
    }
  );

  // ============================================
  // PAYMENT TERMS & METHODS ENDPOINTS
  // Per BigCommerce B2B API: Configure payment options
  // ============================================

  // Get all payment methods
  app.get("/api/payment-methods",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[Payment Methods] Fetching all payment methods');
        const response = await bigcommerce.getPaymentMethods();

        res.json(response?.data || []);
      } catch (error) {
        console.error("[Payment Methods] Error:", error);
        res.status(500).json({ message: "Failed to fetch payment methods" });
      }
    }
  );

  // Get company payment methods
  app.get("/api/company/payment-methods",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Payment Methods] Fetching for company ${req.user.companyId}`);
        const response = await bigcommerce.getCompanyPaymentMethods(req.user.companyId);

        res.json(response?.data || []);
      } catch (error) {
        console.error("[Payment Methods] Error:", error);
        res.status(500).json({ message: "Failed to fetch company payment methods" });
      }
    }
  );

  // Update company payment methods (admin only)
  app.put("/api/company/payment-methods",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        const { paymentMethodIds } = req.body;
        if (!Array.isArray(paymentMethodIds)) {
          return res.status(400).json({ message: "Payment method IDs required" });
        }

        console.log(`[Payment Methods] Updating for company ${req.user.companyId}`);
        const response = await bigcommerce.updateCompanyPaymentMethods(req.user.companyId, paymentMethodIds);

        res.json(response?.data || { success: true });
      } catch (error) {
        console.error("[Payment Methods] Update error:", error);
        res.status(500).json({ message: "Failed to update payment methods" });
      }
    }
  );

  // Get company payment terms
  app.get("/api/company/payment-terms",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Payment Terms] Fetching for company ${req.user.companyId}`);
        const response = await bigcommerce.getCompanyPaymentTerms(req.user.companyId);

        res.json(response?.data || { paymentTerms: null, creditLimit: null });
      } catch (error) {
        console.error("[Payment Terms] Error:", error);
        res.status(500).json({ message: "Failed to fetch payment terms" });
      }
    }
  );

  // Update company payment terms (admin only)
  app.put("/api/company/payment-terms",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        const { paymentTerms, creditLimit, creditHold } = req.body;
        console.log(`[Payment Terms] Updating for company ${req.user.companyId}`);
        const response = await bigcommerce.updateCompanyPaymentTerms(req.user.companyId, {
          paymentTerms,
          creditLimit,
          creditHold,
        });

        res.json(response?.data || { success: true });
      } catch (error) {
        console.error("[Payment Terms] Update error:", error);
        res.status(500).json({ message: "Failed to update payment terms" });
      }
    }
  );

  // ============================================
  // ORDER MANAGEMENT ENDPOINTS
  // Per BigCommerce B2B API: Order operations
  // ============================================

  // Reassign order to different company (admin only)
  app.put("/api/orders/:id/reassign",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { targetCompanyId } = req.body;
        if (!targetCompanyId) {
          return res.status(400).json({ message: "Target company ID required" });
        }

        console.log(`[Orders] Reassigning order ${req.params.id} to company ${targetCompanyId}`);
        const response = await bigcommerce.reassignOrder(req.params.id, targetCompanyId);

        res.json(response?.data || { success: true });
      } catch (error) {
        console.error("[Orders] Reassign error:", error);
        res.status(500).json({ message: "Failed to reassign order" });
      }
    }
  );

  // Bulk assign orders (admin only)
  app.post("/api/orders/bulk-assign",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { orderIds, companyId } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
          return res.status(400).json({ message: "Order IDs required" });
        }
        if (!companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Orders] Bulk assigning ${orderIds.length} orders to company ${companyId}`);
        const response = await bigcommerce.bulkAssignOrders(orderIds, companyId);

        res.json(response?.data || { success: true, count: orderIds.length });
      } catch (error) {
        console.error("[Orders] Bulk assign error:", error);
        res.status(500).json({ message: "Failed to bulk assign orders" });
      }
    }
  );

  // ============================================
  // CSV EXPORT ENDPOINTS
  // Export data in CSV format for reporting
  // ============================================

  // Export orders as CSV
  app.get("/api/orders/export/csv",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);
        const companyId = req.user?.companyId;

        if (!companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Export] Exporting orders for company ${companyId}`);

        // Fetch orders
        const customerIds = await bigcommerce.getCompanyCustomerIds(bcToken, companyId);
        const response = await bigcommerce.getOrders(bcToken, { limit: 1000 }, companyId);
        const allOrders = response?.data || [];

        // Filter to company orders
        const companyOrders = allOrders.filter((order: any) => {
          const orderCustomerId = order.customer_id || order.customerId;
          return orderCustomerId && customerIds.includes(orderCustomerId);
        });

        // Build CSV
        const csvHeaders = ['Order ID', 'Date', 'Customer', 'Company', 'PO Number', 'Status', 'Total'];
        const csvRows = companyOrders.map((order: any) => {
          return [
            order.orderId || order.id,
            new Date(order.createdAt || order.date_created).toISOString().split('T')[0],
            `${order.firstName || ''} ${order.lastName || ''}`.trim() || order.customerName || '',
            order.companyName || '',
            order.poNumber || '',
            order.orderStatus || order.status || '',
            order.totalIncTax || order.total_inc_tax || 0,
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [csvHeaders.join(','), ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=orders-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
      } catch (error) {
        console.error("[Export] Orders CSV error:", error);
        res.status(500).json({ message: "Failed to export orders" });
      }
    }
  );

  // Export invoices as CSV
  app.get("/api/invoices/export/csv",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        const bcToken = await getBigCommerceToken(req);

        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        console.log(`[Export] Exporting invoices for company ${req.user.companyId}`);

        // Get company Customer ID for filtering
        let companyCustomerId: string | null = null;
        try {
          const companyResponse = await bigcommerce.getCompanyDetails(req.user.companyId);
          const customerIdField = companyResponse?.data?.extraFields?.find((f: any) => f.fieldName === 'Customer ID');
          companyCustomerId = customerIdField?.fieldValue || null;
        } catch (error) {
          console.log('[Export] Could not get company Customer ID');
        }

        // Fetch invoices
        const response = await bigcommerce.getInvoices(undefined, { limit: 1000 });
        const allInvoices = response?.data?.list || response?.data || [];

        // Filter to company invoices
        const companyInvoices = companyCustomerId
          ? allInvoices.filter((inv: any) => {
              const customerField = inv.extraFields?.find((f: any) => f.fieldName === 'Customer');
              return customerField?.fieldValue === companyCustomerId;
            })
          : allInvoices;

        // Build CSV
        const csvHeaders = ['Invoice Number', 'Date', 'Due Date', 'Customer', 'Status', 'Total'];
        const csvRows = companyInvoices.map((invoice: any) => {
          return [
            invoice.invoiceNumber || invoice.id,
            new Date(invoice.createdAt || invoice.invoiceDate).toISOString().split('T')[0],
            invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
            invoice.customerName || '',
            invoice.status || '',
            invoice.total || 0,
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [csvHeaders.join(','), ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=invoices-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
      } catch (error) {
        console.error("[Export] Invoices CSV error:", error);
        res.status(500).json({ message: "Failed to export invoices" });
      }
    }
  );

  // ============================================
  // BULK OPERATIONS ENDPOINTS
  // Per BigCommerce B2B API: Bulk create/update operations
  // ============================================

  // Bulk create companies (admin only)
  app.post("/api/companies/bulk",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { companies } = req.body;
        if (!Array.isArray(companies) || companies.length === 0) {
          return res.status(400).json({ message: "Companies array required" });
        }

        console.log(`[Bulk] Creating ${companies.length} companies`);
        const response = await bigcommerce.bulkCreateCompanies(companies);

        res.status(201).json(response?.data || { success: true, count: companies.length });
      } catch (error) {
        console.error("[Bulk] Create companies error:", error);
        res.status(500).json({ message: "Failed to bulk create companies" });
      }
    }
  );

  // Bulk create users (admin only)
  app.post("/api/company/users/bulk",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        if (!req.user?.companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        const { users } = req.body;
        if (!Array.isArray(users) || users.length === 0) {
          return res.status(400).json({ message: "Users array required" });
        }

        console.log(`[Bulk] Creating ${users.length} users for company ${req.user.companyId}`);
        const response = await bigcommerce.bulkCreateUsers(req.user.companyId, users);

        res.status(201).json(response?.data || { success: true, count: users.length });
      } catch (error) {
        console.error("[Bulk] Create users error:", error);
        res.status(500).json({ message: "Failed to bulk create users" });
      }
    }
  );

  // Bulk update company statuses (admin only)
  app.put("/api/companies/bulk-status",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { updates } = req.body;
        if (!Array.isArray(updates) || updates.length === 0) {
          return res.status(400).json({ message: "Updates array required" });
        }

        console.log(`[Bulk] Updating ${updates.length} company statuses`);
        const response = await bigcommerce.bulkUpdateCompanyStatuses(updates);

        res.json(response?.data || { success: true, count: updates.length });
      } catch (error) {
        console.error("[Bulk] Update statuses error:", error);
        res.status(500).json({ message: "Failed to bulk update company statuses" });
      }
    }
  );

  // ============================================
  // SUPER ADMIN ENDPOINTS
  // Per BigCommerce B2B API: Super admin masquerade functions
  // ============================================

  // Begin masquerade as company (super admin only)
  app.post("/api/masquerade/begin",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Super admin access required" });
        }

        const { companyId } = req.body;
        if (!companyId) {
          return res.status(400).json({ message: "Company ID required" });
        }

        const bcToken = await getBigCommerceToken(req);
        console.log(`[Masquerade] Beginning masquerade for company ${companyId}`);
        const response = await bigcommerce.beginMasquerade(bcToken, companyId);

        res.json(response?.data || { success: true, companyId });
      } catch (error) {
        console.error("[Masquerade] Begin error:", error);
        res.status(500).json({ message: "Failed to begin masquerade" });
      }
    }
  );

  // End masquerade session (super admin only)
  app.post("/api/masquerade/end",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        if (req.user?.role !== 'superadmin') {
          return res.status(403).json({ message: "Super admin access required" });
        }

        const bcToken = await getBigCommerceToken(req);
        console.log('[Masquerade] Ending masquerade session');
        const response = await bigcommerce.endMasquerade(bcToken);

        res.json(response?.data || { success: true });
      } catch (error) {
        console.error("[Masquerade] End error:", error);
        res.status(500).json({ message: "Failed to end masquerade" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
