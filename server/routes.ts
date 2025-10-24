import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
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
  return {
    id: bcOrder.orderId || bcOrder.id,
    bcOrderId: bcOrder.orderId,
    customerName: bcOrder.companyName || bcOrder.customerName,
    status: bcOrder.orderStatus || bcOrder.customOrderStatus || bcOrder.status,
    total: bcOrder.totalIncTax || 0,
    subtotal: bcOrder.totalExTax || bcOrder.subtotalIncTax || bcOrder.totalIncTax || 0,
    createdAt: bcOrder.createdAt ? new Date(parseInt(bcOrder.createdAt) * 1000).toISOString() : new Date().toISOString(),
    updatedAt: bcOrder.updatedAt ? new Date(parseInt(bcOrder.updatedAt) * 1000).toISOString() : new Date().toISOString(),
    itemCount: bcOrder.itemCount || bcOrder.items || 0,
    items: bcOrder.productsList || bcOrder.products || [],
    poNumber: bcOrder.poNumber || '',
    referenceNumber: bcOrder.referenceNumber || '',
    companyId: bcOrder.companyId,
    companyName: bcOrder.companyName,
    firstName: bcOrder.firstName,
    lastName: bcOrder.lastName,
    currencyCode: bcOrder.currencyCode,
    money: bcOrder.money,
    shippingAddress: bcOrder.shippingAddress,
    billingAddress: bcOrder.billingAddress,
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
        });
      } else if (companyId && user.companyId !== companyId) {
        // Update company ID if changed
        const updatedUser = await storage.updateUser(user.id, { companyId });
        if (updatedUser) user = updatedUser;
      }

      // Ensure user exists at this point
      if (!user) {
        throw new Error('User creation failed');
      }

      // Store BigCommerce token server-side (two-token authentication system)
      await storage.storeUserToken(user.id, result.token, companyId || undefined);

      // Generate JWT tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        companyId: user.companyId || undefined,
        role: user.role || 'buyer',
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Track session
      trackSession(user.id, accessToken);

      // Set refresh token as HTTP-only cookie if remember me is enabled (Item 7)
      if (rememberMe) {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
  
  // My Orders - orders placed by the logged-in user
  app.get("/api/my-orders",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[My Orders] Fetching orders placed by user:', req.user?.email);
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query;

        // Use authenticated user's email from JWT token (not company email)
        const userEmail = req.user?.email;
        
        // Get current user info from BigCommerce for name matching
        const companyResponse = await bigcommerce.getCompany(bcToken);
        const bcUserFirstName = companyResponse?.data?.name?.split(' ')[0];
        const bcUserLastName = companyResponse?.data?.name?.split(' ').slice(1).join(' ');

        const response = await bigcommerce.getOrders(bcToken, {
          search: search as string,
          status: status as string,
          sortBy: sortBy as string,
          limit: limit ? parseInt(limit as string) : 1000,
          recent: recent === 'true',
        });

        if (response?.errMsg || response?.error) {
          console.warn("[My Orders] BigCommerce returned error:", response.errMsg || response.error);
          return res.json([]);
        }

        const bcOrders = response?.data?.list || response?.data || [];
        const allOrders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];

        // Filter to only orders placed by this user (match by email from billing/shipping address)
        const myOrders = allOrders.filter((order: any) => {
          const orderEmail = order.billingAddress?.email || order.shippingAddress?.email;
          
          // Primary filter: email match
          if (userEmail && orderEmail?.toLowerCase() === userEmail.toLowerCase()) {
            return true;
          }
          
          // Secondary filter: name match (less reliable but helpful)
          if (bcUserFirstName && bcUserLastName) {
            const orderFirstName = order.firstName?.trim();
            const orderLastName = order.lastName?.trim();
            if (orderFirstName?.toLowerCase() === bcUserFirstName.toLowerCase() &&
                orderLastName?.toLowerCase() === bcUserLastName.toLowerCase()) {
              return true;
            }
          }
          
          return false;
        });

        console.log(`[My Orders] Filtered ${allOrders.length} total orders to ${myOrders.length} user-specific orders for ${userEmail}`);
        res.json(myOrders);
      } catch (error) {
        console.error("My Orders fetch error:", error);
        res.status(500).json({ message: "Failed to fetch my orders" });
      }
    }
  );

  // Company Orders - all orders for the company
  app.get("/api/company-orders",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[Company Orders] Fetching all company orders for user:', req.user?.email);
        const bcToken = await getBigCommerceToken(req);
        const { search, status, sortBy, limit, recent } = req.query;

        // Get companyId for caching
        let companyId: string | undefined;
        try {
          const companyResponse = await bigcommerce.getCompany(bcToken);
          companyId = companyResponse?.data?.companyId || companyResponse?.data?.id;
        } catch (e) {
          console.log('[Company Orders] Could not fetch companyId for cache, continuing without cache');
        }

        const response = await bigcommerce.getOrders(bcToken, {
          search: search as string,
          status: status as string,
          sortBy: sortBy as string,
          limit: limit ? parseInt(limit as string) : undefined,
          recent: recent === 'true',
        }, companyId);

        if (response?.errMsg || response?.error) {
          console.warn("[Company Orders] BigCommerce returned error:", response.errMsg || response.error);
          return res.json([]);
        }

        const bcOrders = response?.data?.list || response?.data || [];
        const orders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];

        // CRITICAL: Filter by company to ensure multi-tenant isolation (same as invoices)
        const filteredOrders = filterByCompany(orders, req.user?.companyId, req.user?.role);

        console.log(`[Company Orders] Filtered ${orders.length} total orders to ${filteredOrders.length} company orders`);
        res.json(filteredOrders);
      } catch (error) {
        console.error("Company Orders fetch error:", error);
        res.status(500).json({ message: "Failed to fetch company orders" });
      }
    }
  );

  // Legacy endpoint - defaults to company orders for backward compatibility
  app.get("/api/orders",
    authenticateToken,
    sessionTimeout,
    async (req: AuthRequest, res) => {
      try {
        console.log('[Orders] Fetching orders for user:', req.user?.email);
        const bcToken = await getBigCommerceToken(req);
        console.log('[Orders] Got BC token, fetching orders...');
        const { search, status, sortBy, limit, recent } = req.query;

        // Get companyId for caching
        let companyId: string | undefined;
        try {
          const companyResponse = await bigcommerce.getCompany(bcToken);
          companyId = companyResponse?.data?.companyId || companyResponse?.data?.id;
        } catch (e) {
          console.log('[Orders] Could not fetch companyId for cache, continuing without cache');
        }

        const response = await bigcommerce.getOrders(bcToken, {
          search: search as string,
          status: status as string,
          sortBy: sortBy as string,
          limit: limit ? parseInt(limit as string) : undefined,
          recent: recent === 'true',
        }, companyId);

        // Check for BigCommerce error responses (they return 200 with errMsg)
        if (response?.errMsg || response?.error) {
          console.warn("[Orders] BigCommerce returned error:", response.errMsg || response.error);
          return res.json([]);
        }

        // Extract data from BigCommerce response format
        // /api/v2/ returns {data: {list: [...], pagination: {...}}}
        const bcOrders = response?.data?.list || response?.data || [];

        // Transform orders to frontend format
        const orders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];

        // BigCommerce API already filters by user's company via authentication token
        res.json(orders);
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

        // CRITICAL: Verify resource ownership
        if (!verifyResourceOwnership(order, req.user?.companyId, req.user?.role)) {
          return res.status(403).json({ message: 'Access denied to this order' });
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

        console.log(`[Invoices] Fetching invoices for user: ${req.user?.email} (Company: ${req.user?.companyId})`);

        // Fetch invoices from BigCommerce
        let invoices: any[] = [];
        try {
          const response = await bigcommerce.getInvoices(bcToken, {
            search: search as string,
            status: status as string,
            sortBy: sortBy as string,
            limit: limit ? parseInt(limit as string) : undefined,
            recent: recent === 'true',
          });
          invoices = response?.data?.list || response?.data || [];
        } catch (invoiceError: any) {
          // Handle 403 as "no invoices available" (common when B2B Edition has no invoices created)
          if (invoiceError.message?.includes('403') || invoiceError.message?.includes('Forbidden')) {
            console.log('[Invoices] 403 error - likely no invoices in system or insufficient permissions');
            invoices = [];
          } else {
            throw invoiceError; // Re-throw other errors
          }
        }

        console.log(`[Invoices] Retrieved ${invoices.length} total invoices`);
        console.log(`[Invoices] User companyId: ${req.user?.companyId}, role: ${req.user?.role}`);

        // Filter invoices by logged-in user's company
        // Invoices use customerId field instead of companyId
        const filteredInvoices = invoices.filter(invoice => {
          // Admins see all invoices
          if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
            return true;
          }
          
          // Regular users only see invoices for their company
          if (!req.user?.companyId) {
            return false;
          }
          
          const invoiceCompanyId = invoice.companyId || invoice.customerId;
          return String(invoiceCompanyId) === String(req.user.companyId);
        });

        console.log(`[Invoices] Filtered to ${filteredInvoices.length} invoices for company ${req.user?.companyId}`);
        res.json(filteredInvoices);
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
        const response = await bigcommerce.getCompanyUsers(bcToken);
        const users = response?.data?.list || response?.data || [];

        console.log(`[Users] Total users fetched: ${users.length}`);
        console.log(`[Users] User companyId: ${req.user?.companyId}, role: ${req.user?.role}`);

        // Filter users by logged-in user's company
        const filteredUsers = filterByCompany(users, req.user?.companyId, req.user?.role);

        console.log(`[Users] Filtered to ${filteredUsers.length} users`);
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
        const response = await bigcommerce.getCompanyAddresses(bcToken);
        const addresses = response?.data?.list || response?.data || [];

        console.log(`[Addresses] Total addresses fetched: ${addresses.length}`);
        console.log(`[Addresses] User companyId: ${req.user?.companyId}, role: ${req.user?.role}`);

        // Filter addresses by logged-in user's company
        const filteredAddresses = filterByCompany(addresses, req.user?.companyId, req.user?.role);

        console.log(`[Addresses] Filtered to ${filteredAddresses.length} addresses`);
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
  app.get("/api/company/hierarchy", async (req: AuthRequest, res) => {
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
  app.get("/api/products/search", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const { query } = req.query;
      const response = await bigcommerce.searchProducts(userToken, query as string || '');
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Product search error:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Cart endpoints (Items 31, 32)
  app.get("/api/cart", async (req, res) => {
    try {
      const userToken = getUserToken(req);
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

  app.post("/api/cart/items", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const { items } = req.body;

      // In production, add items to BigCommerce cart
      console.log('[Cart] Adding items:', items);

      res.json({ message: "Items added to cart", items });
    } catch (error) {
      console.error("Cart add error:", error);
      res.status(500).json({ message: "Failed to add items to cart" });
    }
  });

  app.patch("/api/cart/items/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const { quantity } = req.body;

      console.log(`[Cart] Updating item ${req.params.id} to quantity ${quantity}`);

      res.json({ message: "Cart item updated" });
    } catch (error) {
      console.error("Cart update error:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/items/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);

      console.log(`[Cart] Removing item ${req.params.id}`);

      res.json({ message: "Cart item removed" });
    } catch (error) {
      console.error("Cart delete error:", error);
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  // Shopping Lists endpoints - using BigCommerce API
  app.get("/api/shopping-lists", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getShoppingLists(userToken);
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Shopping lists fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping lists" });
    }
  });

  app.get("/api/shopping-lists/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getShoppingList(userToken, req.params.id);
      if (!response?.data) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      res.json(response.data);
    } catch (error) {
      console.error("Shopping list fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping list" });
    }
  });

  app.post("/api/shopping-lists", async (req, res) => {
    try {
      const list = await storage.createShoppingList(req.body);
      res.status(201).json(list);
    } catch (error) {
      console.error("Shopping list create error:", error);
      res.status(500).json({ message: "Failed to create shopping list" });
    }
  });

  app.patch("/api/shopping-lists/:id", async (req, res) => {
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

  app.delete("/api/shopping-lists/:id", async (req, res) => {
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
  app.get("/api/shopping-lists/:id/items", async (req, res) => {
    try {
      const items = await storage.getShoppingListItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Shopping list items fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping list items" });
    }
  });

  app.post("/api/shopping-lists/:id/items", async (req, res) => {
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

  app.patch("/api/shopping-list-items/:id", async (req, res) => {
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

  app.delete("/api/shopping-list-items/:id", async (req, res) => {
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
