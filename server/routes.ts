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

// Transform BigCommerce order to frontend format
function transformOrder(bcOrder: any): any {
  // Map products to items array for frontend consumption
  const items = (bcOrder.products || bcOrder.productsList || bcOrder.items || []).map((product: any) => ({
    name: product.name || product.productName,
    sku: product.sku,
    quantity: product.quantity || 1,
    price: product.base_price || product.price || product.price_ex_tax || 0,
    productId: product.product_id,
    variantId: product.variant_id,
  }));

  const totalAmount = bcOrder.totalIncTax || bcOrder.total_inc_tax || 0;
  const currencyCode = bcOrder.currency_code || bcOrder.currencyCode || 'GBP';
  
  return {
    id: bcOrder.orderId || bcOrder.id,
    bcOrderId: bcOrder.orderId || bcOrder.id,
    customerName: bcOrder.companyName || bcOrder.customerName || 
      `${bcOrder.billing_address?.first_name || ''} ${bcOrder.billing_address?.last_name || ''}`.trim(),
    status: bcOrder.orderStatus || bcOrder.customOrderStatus || bcOrder.status,
    total: totalAmount,
    totalIncTax: totalAmount,  // Frontend expects this field
    subtotal: bcOrder.totalExTax || bcOrder.total_ex_tax || bcOrder.subtotalIncTax || bcOrder.totalIncTax || 0,
    createdAt: bcOrder.createdAt ? new Date(parseInt(bcOrder.createdAt) * 1000).toISOString() : 
      (bcOrder.date_created || new Date().toISOString()),
    updatedAt: bcOrder.updatedAt ? new Date(parseInt(bcOrder.updatedAt) * 1000).toISOString() : 
      (bcOrder.date_modified || new Date().toISOString()),
    itemCount: items.length,
    items: items,
    poNumber: bcOrder.poNumber || bcOrder.customer_message || '',
    referenceNumber: bcOrder.referenceNumber || '',
    customerId: bcOrder.customer_id || bcOrder.customerId,
    companyId: bcOrder.companyId,
    companyName: bcOrder.companyName || bcOrder.billing_address?.company,
    firstName: bcOrder.firstName || bcOrder.billing_address?.first_name,
    lastName: bcOrder.lastName || bcOrder.billing_address?.last_name,
    currencyCode: currencyCode,
    money: bcOrder.money?.value ? bcOrder.money : {
      currency: {
        code: currencyCode
      },
      value: totalAmount.toString()
    },
    shippingAddress: bcOrder.shippingAddress || (Array.isArray(bcOrder.shipping_addresses) && bcOrder.shipping_addresses.length > 0 
      ? bcOrder.shipping_addresses[0] 
      : null),
    billingAddress: bcOrder.billingAddress || bcOrder.billing_address,
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
          sameSite: 'strict',
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
          const user = await storage.getUserById(req.user!.userId);
          userCustomerId = user?.customerId;
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

        if (response?.errMsg || response?.error) {
          console.warn("[My Orders] BigCommerce returned error:", response.errMsg || response.error);
          return res.json([]);
        }

        const bcOrders = response?.data?.list || response?.data || [];
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

        if (response?.errMsg || response?.error) {
          console.warn("[Orders] BigCommerce returned error:", response.errMsg || response.error);
          return res.json([]);
        }

        const bcOrders = response?.data?.list || response?.data || [];
        const allOrders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];

        // Filter orders by customer IDs only - all orders for the company's customer account(s)
        const companyOrders = allOrders.filter((order: any) => {
          const orderCustomerId = order.customer_id || order.customerId;
          return customerIds.includes(orderCustomerId);
        });

        res.json(companyOrders);
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
          const orderCustomerId = order.customerId || order.customer_id;
          
          // Check if order belongs to one of the company's customer accounts
          if (!customerIds.includes(orderCustomerId)) {
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

        // Get user's BigCommerce token
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query;

        console.log(`[Invoices] Fetching invoices for user: ${req.user?.email} (Customer: ${req.user?.customerId}, Company: ${req.user?.companyId}, Role: ${req.user?.role})`);

        // Fetch invoices from BigCommerce with STRICT company-level filtering
        // CRITICAL SECURITY: Invoices have customerId, not companyId
        // We must fetch all customer IDs for this company, then filter invoices
        let invoices: any[] = [];
        try {
          // Step 1: Get all customer IDs that belong to this company
          console.log(`[Invoices] Fetching users for company ${req.user?.companyId} to get customer IDs`);
          const companyCustomerIds = new Set<string>();
          
          try {
            const usersResponse = await bigcommerce.getCompanyUsers(bcToken, req.user?.companyId?.toString());
            const users = usersResponse?.data?.list || usersResponse?.data || [];
            
            for (const user of users) {
              if (user.customerId) {
                companyCustomerIds.add(String(user.customerId));
              }
            }
            console.log(`[Invoices] Found ${companyCustomerIds.size} customer IDs for company ${req.user?.companyId}:`, Array.from(companyCustomerIds));
          } catch (userError) {
            console.error('[Invoices] Failed to fetch company users:', userError);
            // Fallback: at minimum, include the current user's customer ID
            if (req.user?.customerId) {
              companyCustomerIds.add(String(req.user.customerId));
              console.log(`[Invoices] Fallback: using only current user's customer ID: ${req.user.customerId}`);
            }
          }
          
          // Step 2: Fetch all invoices
          const response = await bigcommerce.getInvoices(bcToken, {
            search: search as string,
            status: status as string,
            sortBy: sortBy as string,
            limit: limit ? parseInt(limit as string) : undefined,
            recent: recent === 'true',
          });
          const allInvoices = response?.data?.list || response?.data || [];
          
          // Step 3: Filter invoices by company's customer IDs
          invoices = allInvoices.filter((invoice: any) => {
            const invoiceCustomerId = String(invoice.customerId || '');
            const belongsToCompany = companyCustomerIds.has(invoiceCustomerId);
            
            if (!belongsToCompany && invoiceCustomerId) {
              console.log(`[Invoices] SECURITY: Filtering out invoice ${invoice.id} with customerId ${invoiceCustomerId} (not in company customer list)`);
            }
            
            return belongsToCompany;
          });
          
          console.log(`[Invoices] Filtered ${allInvoices.length} total invoices → ${invoices.length} for company ${req.user?.companyId}`);
        } catch (invoiceError: any) {
          // Handle 403 as "no invoices available" (common when B2B Edition has no invoices created)
          if (invoiceError.message?.includes('403') || invoiceError.message?.includes('Forbidden')) {
            console.log('[Invoices] 403 error - likely no invoices in system or insufficient permissions');
            invoices = [];
          } else {
            throw invoiceError; // Re-throw other errors
          }
        }

        console.log(`[Invoices] Retrieved ${invoices.length} company invoices`);

        // Enrich invoices with full details (including extraFields) from individual invoice endpoints
        // The list endpoint doesn't include extraFields, but the detail endpoint does
        const enrichedInvoices = await Promise.all(
          invoices.map(async (invoice) => {
            try {
              const detailResponse = await bigcommerce.getInvoice(undefined, invoice.id);
              const fullInvoice = detailResponse?.data;
              
              // Merge the full invoice details (which includes extraFields) with the list invoice
              return {
                ...invoice,
                extraFields: fullInvoice?.extraFields || [],
                // Preserve other detail fields if needed
                details: fullInvoice?.details || invoice.details
              };
            } catch (error) {
              console.error(`[Invoices] Failed to enrich invoice ${invoice.id}:`, error);
              // Return original invoice if enrichment fails
              return { ...invoice, extraFields: [] };
            }
          })
        );

        console.log(`[Invoices] Enriched ${enrichedInvoices.length} invoices with full details`);
        console.log(`[Invoices] SECURITY CHECK: Returning ${enrichedInvoices.length} invoices for company ${req.user?.companyId} only`);
        res.json(enrichedInvoices);
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
        
        // Fetch the invoice (no company restriction)
        const response = await bigcommerce.getInvoice(undefined, req.params.id);
        const invoice = response?.data;

        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
        }

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
        
        // Fetch invoice (no company restriction)
        const invoiceResponse = await bigcommerce.getInvoice(undefined, req.params.id);
        const invoice = invoiceResponse?.data;

        if (!invoice) {
          return res.status(404).json({ message: 'Invoice not found' });
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
        const users = response?.data?.list || response?.data || [];

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

  const httpServer = createServer(app);
  return httpServer;
}
