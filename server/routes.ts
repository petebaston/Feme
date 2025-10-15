import type { Express } from "express";
import { createServer, type Server } from "http";
import { bigcommerce } from "./bigcommerce";
import { DatabaseStorage } from "./storage";

const storage = new DatabaseStorage();

// Helper to extract user token from request
function getUserToken(req: any): string {
  const authHeader = req.headers.authorization;
  return authHeader?.replace('Bearer ', '') || '';
}

// Transform BigCommerce order to frontend format
function transformOrder(bcOrder: any): any {
  return {
    id: bcOrder.orderId || bcOrder.id,
    bcOrderId: bcOrder.orderId,
    customerName: bcOrder.companyName || bcOrder.customerName,
    status: bcOrder.orderStatus || bcOrder.customOrderStatus || bcOrder.status,
    total: bcOrder.totalIncTax || 0,
    createdAt: bcOrder.createdAt ? new Date(parseInt(bcOrder.createdAt) * 1000).toISOString() : new Date().toISOString(),
    updatedAt: bcOrder.updatedAt ? new Date(parseInt(bcOrder.updatedAt) * 1000).toISOString() : new Date().toISOString(),
    itemCount: bcOrder.items || 0,
    poNumber: bcOrder.poNumber || '',
    referenceNumber: bcOrder.referenceNumber || '',
    companyId: bcOrder.companyId,
    companyName: bcOrder.companyName,
    firstName: bcOrder.firstName,
    lastName: bcOrder.lastName,
    currencyCode: bcOrder.currencyCode,
    money: bcOrder.money,
    shippingAddress: bcOrder.shippingAddress,
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
  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      console.log('[Login] Attempting BigCommerce login for:', email);
      const result = await bigcommerce.login(email, password);
      
      console.log('[Login] BigCommerce login successful');
      res.json(result);
    } catch (error: any) {
      console.error("[Login] BigCommerce login failed:", error.message);
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const stats = await bigcommerce.getDashboardStats(userToken);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Orders endpoints
  app.get("/api/orders", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const { search, status, sortBy, limit, recent } = req.query;
      
      const response = await bigcommerce.getOrders(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });
      
      // Extract data from BigCommerce response format
      // /api/v2/ returns {data: {list: [...], pagination: {...}}}
      const bcOrders = response?.data?.list || response?.data || [];
      
      // Transform orders to frontend format
      const orders = Array.isArray(bcOrders) ? bcOrders.map(transformOrder) : [];
      
      res.json(orders);
    } catch (error) {
      console.error("Orders fetch error:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getOrder(userToken, req.params.id);
      const bcOrder = response?.data;
      if (!bcOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(transformOrder(bcOrder));
    } catch (error) {
      console.error("Order fetch error:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.updateOrder(userToken, req.params.id, req.body);
      res.json(response?.data || null);
    } catch (error) {
      console.error("Order update error:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Quotes endpoints
  app.get("/api/quotes", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const { search, status, sortBy, limit, recent } = req.query;
      
      const response = await bigcommerce.getQuotes(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });
      
      // /api/v2/ returns {data: {list: [...], pagination: {...}}}
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Quotes fetch error:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getQuote(userToken, req.params.id);
      res.json(response?.data || null);
    } catch (error) {
      console.error("Quote fetch error:", error);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.patch("/api/quotes/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.updateQuote(userToken, req.params.id, req.body);
      res.json(response?.data || null);
    } catch (error) {
      console.error("Quote update error:", error);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Invoices endpoints
  app.get("/api/invoices", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const { search, status, sortBy, limit, recent } = req.query;
      
      const response = await bigcommerce.getInvoices(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });
      
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Invoices fetch error:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getInvoice(userToken, req.params.id);
      res.json(response?.data || null);
    } catch (error) {
      console.error("Invoice fetch error:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/:id/pdf", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const pdfData = await bigcommerce.getInvoicePdf(userToken, req.params.id);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${req.params.id}.pdf`);
      res.send(pdfData);
    } catch (error) {
      console.error("Invoice PDF error:", error);
      res.status(500).json({ message: "Failed to generate invoice PDF" });
    }
  });

  // Company endpoints
  app.get("/api/company", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getCompany(userToken);
      res.json(response?.data || {});
    } catch (error) {
      console.error("Company fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.get("/api/company/users", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getCompanyUsers(userToken);
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Company users fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company users" });
    }
  });

  app.get("/api/company/addresses", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getCompanyAddresses(userToken);
      res.json(response?.data?.list || response?.data || []);
    } catch (error) {
      console.error("Company addresses fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company addresses" });
    }
  });

  app.get("/api/company/accessible", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.get("/api/company/hierarchy", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
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
