import type { Express } from "express";
import { createServer, type Server } from "http";
import { bigcommerce } from "./bigcommerce";

// Helper to extract user token from request
function getUserToken(req: any): string {
  const authHeader = req.headers.authorization;
  return authHeader?.replace('Bearer ', '') || '';
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
      
      const orders = await bigcommerce.getOrders(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });
      
      res.json(orders);
    } catch (error) {
      console.error("Orders fetch error:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const order = await bigcommerce.getOrder(userToken, req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Order fetch error:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const order = await bigcommerce.updateOrder(userToken, req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
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
      
      const quotes = await bigcommerce.getQuotes(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });
      
      res.json(quotes);
    } catch (error) {
      console.error("Quotes fetch error:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const quote = await bigcommerce.getQuote(userToken, req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Quote fetch error:", error);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.patch("/api/quotes/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const quote = await bigcommerce.updateQuote(userToken, req.params.id, req.body);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
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
      
      const invoices = await bigcommerce.getInvoices(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });
      
      res.json(invoices);
    } catch (error) {
      console.error("Invoices fetch error:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const invoice = await bigcommerce.getInvoice(userToken, req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
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
      const company = await bigcommerce.getCompany(userToken);
      res.json(company);
    } catch (error) {
      console.error("Company fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.get("/api/company/users", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const users = await bigcommerce.getCompanyUsers(userToken);
      res.json(users);
    } catch (error) {
      console.error("Company users fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company users" });
    }
  });

  app.get("/api/company/addresses", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const addresses = await bigcommerce.getCompanyAddresses(userToken);
      res.json(addresses);
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

  // Shopping Lists endpoints
  app.get("/api/shopping-lists", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const lists = await bigcommerce.getShoppingLists(userToken);
      res.json(lists);
    } catch (error) {
      console.error("Shopping lists fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping lists" });
    }
  });

  app.get("/api/shopping-lists/:id", async (req, res) => {
    try {
      const userToken = getUserToken(req);
      const list = await bigcommerce.getShoppingList(userToken, req.params.id);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      res.json(list);
    } catch (error) {
      console.error("Shopping list fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping list" });
    }
  });

  app.post("/api/shopping-lists", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.patch("/api/shopping-lists/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.delete("/api/shopping-lists/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  // Shopping List Items endpoints
  app.get("/api/shopping-lists/:id/items", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.post("/api/shopping-lists/:id/items", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.patch("/api/shopping-list-items/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  app.delete("/api/shopping-list-items/:id", async (req, res) => {
    res.status(501).json({ message: "Not implemented - feature not available in BigCommerce API" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
