import type { Express } from "express";
import { createServer, type Server } from "http";
import { bigcommerce } from "./bigcommerce";
import { authenticate, authorize } from "./middleware/auth";
import { storage } from "./storage";

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

  app.get("/api/company/accessible", authenticate, authorize('switch_companies'), async (req, res) => {
    try {
      // Use authenticated user's ID instead of query parameter
      const userId = req.user!.id;
      const companies = await storage.getAccessibleCompanies(userId);
      res.json(companies);
    } catch (error) {
      console.error("Accessible companies fetch error:", error);
      res.status(500).json({ message: "Failed to fetch accessible companies" });
    }
  });

  app.get("/api/company/hierarchy", authenticate, async (req, res) => {
    try {
      // Use authenticated user's company ID or allow override for admins
      const companyId = (req.query.companyId as string) || req.user!.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "Company ID not found" });
      }
      
      // Verify user has access to this company
      const accessibleCompanies = await storage.getAccessibleCompanies(req.user!.id);
      const hasAccess = accessibleCompanies.some(c => c.id === companyId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this company" });
      }
      
      const hierarchy = await storage.getCompanyHierarchy(companyId);
      res.json(hierarchy);
    } catch (error) {
      console.error("Company hierarchy fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company hierarchy" });
    }
  });

  // User management endpoints
  app.post("/api/users", authenticate, authorize('manage_users'), async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      console.error("User create error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", authenticate, authorize('manage_users'), async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("User update error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", authenticate, authorize('manage_users'), async (req, res) => {
    try {
      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("User delete error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Address management endpoints
  app.post("/api/addresses", authenticate, authorize('manage_addresses'), async (req, res) => {
    try {
      const address = await storage.createAddress(req.body);
      res.status(201).json(address);
    } catch (error) {
      console.error("Address create error:", error);
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.patch("/api/addresses/:id", authenticate, authorize('manage_addresses'), async (req, res) => {
    try {
      const address = await storage.updateAddress(req.params.id, req.body);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }
      res.json(address);
    } catch (error) {
      console.error("Address update error:", error);
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  app.delete("/api/addresses/:id", authenticate, authorize('manage_addresses'), async (req, res) => {
    try {
      const success = await storage.deleteAddress(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Address not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Address delete error:", error);
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  app.patch("/api/addresses/:id/set-default", authenticate, authorize('manage_addresses'), async (req, res) => {
    try {
      const { type } = req.body;
      const success = await storage.setDefaultAddress(req.params.id, type);
      if (!success) {
        return res.status(404).json({ message: "Address not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Set default address error:", error);
      res.status(500).json({ message: "Failed to set default address" });
    }
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

  app.post("/api/shopping-lists", authenticate, authorize('manage_shopping_lists'), async (req, res) => {
    try {
      const list = await storage.createShoppingList(req.body);
      res.status(201).json(list);
    } catch (error) {
      console.error("Shopping list create error:", error);
      res.status(500).json({ message: "Failed to create shopping list" });
    }
  });

  app.patch("/api/shopping-lists/:id", authenticate, authorize('manage_shopping_lists'), async (req, res) => {
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

  app.delete("/api/shopping-lists/:id", authenticate, authorize('manage_shopping_lists'), async (req, res) => {
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

  // Shopping List Items endpoints
  app.get("/api/shopping-lists/:id/items", authenticate, authorize('view_shopping_lists'), async (req, res) => {
    try {
      const items = await storage.getShoppingListItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Shopping list items fetch error:", error);
      res.status(500).json({ message: "Failed to fetch shopping list items" });
    }
  });

  app.post("/api/shopping-lists/:id/items", authenticate, authorize('manage_shopping_lists'), async (req, res) => {
    try {
      const item = await storage.addShoppingListItem({
        ...req.body,
        listId: req.params.id,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Shopping list item add error:", error);
      res.status(500).json({ message: "Failed to add item to shopping list" });
    }
  });

  app.patch("/api/shopping-list-items/:id", authenticate, authorize('manage_shopping_lists'), async (req, res) => {
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

  app.delete("/api/shopping-list-items/:id", authenticate, authorize('manage_shopping_lists'), async (req, res) => {
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
