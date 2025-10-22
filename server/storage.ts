import { db } from "./db";
import { eq, and, desc, asc, sql, or, like } from "drizzle-orm";
import { 
  users, companies, orders, quotes, invoices, addresses, shoppingLists, shoppingListItems,
  bigcommerceOrdersCache,
  type User, type InsertUser, 
  type Company, 
  type Order, 
  type Quote, 
  type Invoice, 
  type Address, 
  type ShoppingList, type InsertShoppingList, 
  type ShoppingListItem, type InsertShoppingListItem 
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Dashboard
  getDashboardStats(): Promise<any>;

  // Orders
  getOrders(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined>;

  // Quotes
  getQuotes(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  updateQuote(id: string, quote: Partial<Quote>): Promise<Quote | undefined>;

  // Invoices
  getInvoices(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;

  // Company
  getCompany(): Promise<Company>;
  getCompanyUsers(): Promise<User[]>;
  getCompanyAddresses(): Promise<Address[]>;
  getAccessibleCompanies(userId: string): Promise<Company[]>;
  getCompanyHierarchy(companyId: string): Promise<{ parent: Company | null; children: Company[] }>;

  // Addresses
  createAddress(address: Partial<Address>): Promise<Address>;
  updateAddress(id: string, address: Partial<Address>): Promise<Address | undefined>;
  deleteAddress(id: string): Promise<boolean>;
  setDefaultAddress(id: string, type: string): Promise<boolean>;

  // Shopping Lists
  getShoppingLists(): Promise<ShoppingList[]>;
  getShoppingList(id: string): Promise<ShoppingList | undefined>;
  createShoppingList(list: InsertShoppingList): Promise<ShoppingList>;
  updateShoppingList(id: string, list: Partial<ShoppingList>): Promise<ShoppingList | undefined>;
  deleteShoppingList(id: string): Promise<boolean>;

  // Shopping List Items
  getShoppingListItems(listId: string): Promise<ShoppingListItem[]>;
  addShoppingListItem(item: InsertShoppingListItem): Promise<ShoppingListItem>;
  updateShoppingListItem(id: string, item: Partial<ShoppingListItem>): Promise<ShoppingListItem | undefined>;
  deleteShoppingListItem(id: string): Promise<boolean>;

  // BigCommerce Cache
  getCachedOrder(orderId: string, companyId: string): Promise<any | null>;
  setCachedOrders(orders: any[], companyId: string): Promise<void>;

  // BigCommerce Token Storage (for two-token authentication system)
  storeUserToken(userId: string, bcToken: string, companyId?: string): Promise<void>;
  getUserToken(userId: string): Promise<string | null>;
  clearUserToken(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private companyCache: Company | null = null;
  private userTokens = new Map<string, {
    userId: string;
    bcToken: string;
    companyId?: string;
    expiresAt: Date;
  }>();

  constructor() {
    this.initializeDemoData();
  }

  private async initializeDemoData() {
    try {
      const existingCompanies = await db.select().from(companies).limit(1);
      if (existingCompanies.length > 0) {
        return;
      }
      const [parentCompany] = await db.insert(companies).values({
        name: "Demo Company Inc.",
        email: "contact@democompany.com",
        phone: "+1 (555) 123-4567",
        industry: "Technology",
        status: "active",
        tier: "premium",
        taxId: "12-3456789",
        accountManager: "Sarah Johnson",
        creditLimit: "100000.00",
        paymentTerms: "Net 30",
        storeHash: "demo_store_hash",
        channelId: "1",
        parentCompanyId: null,
        hierarchyLevel: 0,
      }).returning();

      const [subsidiary1] = await db.insert(companies).values({
        name: "Demo Subsidiary A",
        email: "contact@subsidiary-a.com",
        phone: "+1 (555) 123-4568",
        industry: "Technology",
        status: "active",
        tier: "standard",
        storeHash: "subsidiary_a_hash",
        channelId: "1",
        parentCompanyId: parentCompany.id,
        hierarchyLevel: 1,
      }).returning();

      const [subsidiary2] = await db.insert(companies).values({
        name: "Demo Subsidiary B",
        email: "contact@subsidiary-b.com",
        phone: "+1 (555) 123-4569",
        industry: "Technology",
        status: "active",
        tier: "standard",
        storeHash: "subsidiary_b_hash",
        channelId: "1",
        parentCompanyId: parentCompany.id,
        hierarchyLevel: 1,
      }).returning();

      const [demoUser] = await db.insert(users).values({
        email: "demo@company.com",
        name: "Demo User",
        password: "demo123",
        role: "admin",
        companyId: parentCompany.id,
        status: "active",
        phoneNumber: "+1 (555) 100-0001",
        jobTitle: "Administrator",
        lastLoginAt: new Date(),
      }).returning();

      await db.insert(users).values([
        {
          email: "john@company.com",
          name: "John Smith",
          password: "password",
          role: "user",
          companyId: parentCompany.id,
          status: "active",
          phoneNumber: "+1 (555) 100-0002",
          jobTitle: "Buyer",
        },
        {
          email: "jane@company.com",
          name: "Jane Doe",
          password: "password",
          role: "manager",
          companyId: parentCompany.id,
          status: "active",
          phoneNumber: "+1 (555) 100-0003",
          jobTitle: "Procurement Manager",
          lastLoginAt: new Date(),
        },
        {
          email: "user@subsidiary-a.com",
          name: "Alice Johnson",
          password: "password",
          role: "user",
          companyId: subsidiary1.id,
          status: "active",
          phoneNumber: "+1 (555) 100-0004",
          jobTitle: "Buyer",
        },
        {
          email: "user@subsidiary-b.com",
          name: "Bob Wilson",
          password: "password",
          role: "user",
          companyId: subsidiary2.id,
          status: "active",
          phoneNumber: "+1 (555) 100-0005",
          jobTitle: "Buyer",
        },
      ]);

      const manager = await db.select().from(users).where(eq(users.email, "jane@company.com")).then(r => r[0]);

      const paymentTermsOptions = ["1-30 days", "30-60 days", "60-90 days", "90+ days", "Net 30", "Net 60"];
      const poStatusOptions = ["approved", "pending", "rejected", null];
      
      for (let i = 1; i <= 8; i++) {
        const hasPO = i % 3 !== 0;
        const poStatus = hasPO ? poStatusOptions[i % poStatusOptions.length] : null;
        await db.insert(orders).values({
          orderNumber: `BC-${1000 + i}`,
          companyId: parentCompany.id,
          userId: demoUser.id,
          status: ["completed", "processing", "pending", "cancelled"][i % 4],
          total: (Math.random() * 10000 + 1000).toFixed(2),
          itemCount: Math.floor(Math.random() * 10) + 1,
          customerName: ["Demo Company Inc.", "Acme Corp", "Global Solutions"][Math.floor(Math.random() * 3)],
          shippingCity: ["New York", "Los Angeles", "Chicago", "Houston"][Math.floor(Math.random() * 4)],
          shippingState: ["NY", "CA", "IL", "TX"][Math.floor(Math.random() * 4)],
          paymentTerms: paymentTermsOptions[i % paymentTermsOptions.length],
          poNumber: hasPO ? `PO-${2024000 + i}` : null,
          poStatus: poStatus as any,
          poApprovedAt: poStatus === 'approved' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
          poApprovedBy: poStatus === 'approved' ? manager?.id : null,
        });
      }

      for (let i = 1; i <= 6; i++) {
        await db.insert(quotes).values({
          quoteNumber: `QT-${2000 + i}`,
          companyId: parentCompany.id,
          userId: demoUser.id,
          title: [
            "Bulk Order Discount Request",
            "Annual Supply Agreement",
            "Custom Product Quote",
            "Volume Pricing Inquiry",
            "Partnership Proposal",
            "Seasonal Order Quote"
          ][i - 1],
          status: ["draft", "pending", "negotiating", "approved", "rejected", "expired"][i % 6],
          total: (Math.random() * 50000 + 5000).toFixed(2),
          itemCount: Math.floor(Math.random() * 20) + 1,
          notes: i % 3 === 0 ? "Requires custom packaging" : null,
          paymentTerms: paymentTermsOptions[i % paymentTermsOptions.length],
          expiresAt: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000),
        });
      }

      const ordersForInvoices = await db.select().from(orders).limit(8);

      for (let i = 1; i <= 10; i++) {
        const subtotal = Math.random() * 8000 + 2000;
        const tax = subtotal * 0.08;
        const total = subtotal + tax;
        const createdDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
        const daysToAdd = i === 1 || i === 2 ? 7 : i === 3 || i === 4 ? 30 : i === 5 || i === 6 ? 60 : 90;
        
        await db.insert(invoices).values({
          invoiceNumber: `INV-${3000 + i}`,
          companyId: parentCompany.id,
          userId: demoUser.id,
          orderId: i <= 8 ? ordersForInvoices[i - 1]?.id : null,
          status: ["paid", "pending", "overdue", "pending"][i % 4],
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          customerName: ["Demo Company Inc.", "Acme Corp", "Global Solutions"][Math.floor(Math.random() * 3)],
          paymentTerms: paymentTermsOptions[i % paymentTermsOptions.length],
          dueDate: new Date(createdDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000),
          paidDate: i % 4 === 0 ? new Date(createdDate.getTime() + (daysToAdd - 2) * 24 * 60 * 60 * 1000) : null,
        });
      }

      await db.insert(addresses).values([
        {
          companyId: parentCompany.id,
          label: "Main Office",
          type: "billing",
          isDefault: true,
          street1: "123 Business Blvd",
          street2: "Suite 100",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        {
          companyId: parentCompany.id,
          label: "Warehouse",
          type: "shipping",
          isDefault: false,
          street1: "456 Industrial Drive",
          street2: "",
          city: "Newark",
          state: "NJ",
          postalCode: "07102",
          country: "US",
        },
      ]);

      console.log("Demo data initialized successfully");
    } catch (error) {
      console.error("Error initializing demo data:", error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getDashboardStats(): Promise<any> {
    const allOrders = await db.select().from(orders);
    const allQuotes = await db.select().from(quotes);
    
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const ordersThisMonth = allOrders.filter(order => 
      order.createdAt && new Date(order.createdAt) >= thisMonth
    ).length;
    
    const monthlySpend = allOrders
      .filter(order => order.createdAt && new Date(order.createdAt) >= thisMonth)
      .reduce((sum, order) => sum + parseFloat(order.total as string), 0);

    return {
      totalOrders: allOrders.length,
      ordersThisMonth,
      pendingQuotes: allQuotes.filter(q => q.status === 'pending').length,
      quotesNeedingAttention: allQuotes.filter(q => q.status && ['pending', 'negotiating'].includes(q.status)).length,
      monthlySpend: Math.round(monthlySpend),
      spendChange: Math.floor(Math.random() * 20) - 10,
      activeCredit: 75000,
    };
  }

  async getOrders(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Order[]> {
    let query = db.select().from(orders);

    const conditions = [];
    
    if (params?.search) {
      const searchTerm = `%${params.search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${orders.orderNumber})`, searchTerm),
          like(sql`LOWER(${orders.customerName})`, searchTerm)
        )
      );
    }

    if (params?.status && params.status !== 'all') {
      conditions.push(eq(orders.status, params.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    switch (params?.sortBy) {
      case 'date_asc':
        query = query.orderBy(asc(orders.createdAt)) as any;
        break;
      case 'total':
        query = query.orderBy(desc(orders.total)) as any;
        break;
      case 'status':
        query = query.orderBy(asc(orders.status)) as any;
        break;
      default:
        query = query.orderBy(desc(orders.createdAt)) as any;
    }

    if (params?.limit) {
      query = query.limit(params.limit) as any;
    }

    return await query;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async getQuotes(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Quote[]> {
    let query = db.select().from(quotes);

    const conditions = [];
    
    if (params?.search) {
      const searchTerm = `%${params.search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${quotes.quoteNumber})`, searchTerm),
          like(sql`LOWER(${quotes.title})`, searchTerm)
        )
      );
    }

    if (params?.status && params.status !== 'all') {
      conditions.push(eq(quotes.status, params.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    switch (params?.sortBy) {
      case 'date_asc':
        query = query.orderBy(asc(quotes.createdAt)) as any;
        break;
      case 'total':
        query = query.orderBy(desc(quotes.total)) as any;
        break;
      case 'status':
        query = query.orderBy(asc(quotes.status)) as any;
        break;
      case 'expiry':
        query = query.orderBy(asc(quotes.expiresAt)) as any;
        break;
      default:
        query = query.orderBy(desc(quotes.createdAt)) as any;
    }

    if (params?.limit) {
      query = query.limit(params.limit) as any;
    }

    return await query;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const result = await db.select().from(quotes).where(eq(quotes.id, id));
    return result[0];
  }

  async updateQuote(id: string, quote: Partial<Quote>): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set({ ...quote, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async getInvoices(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Invoice[]> {
    let query = db.select().from(invoices);

    const conditions = [];
    
    if (params?.search) {
      const searchTerm = `%${params.search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${invoices.invoiceNumber})`, searchTerm),
          like(sql`LOWER(${invoices.customerName})`, searchTerm)
        )
      );
    }

    if (params?.status && params.status !== 'all') {
      conditions.push(eq(invoices.status, params.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    switch (params?.sortBy) {
      case 'date_asc':
        query = query.orderBy(asc(invoices.createdAt)) as any;
        break;
      case 'total':
        query = query.orderBy(desc(invoices.total)) as any;
        break;
      case 'status':
        query = query.orderBy(asc(invoices.status)) as any;
        break;
      case 'due_date':
        query = query.orderBy(asc(invoices.dueDate)) as any;
        break;
      default:
        query = query.orderBy(desc(invoices.createdAt)) as any;
    }

    if (params?.limit) {
      query = query.limit(params.limit) as any;
    }

    return await query;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.id, id));
    return result[0];
  }

  async getCompany(): Promise<Company> {
    if (this.companyCache) {
      return this.companyCache;
    }

    const result = await db.select().from(companies).limit(1);

    if (result.length === 0) {
      const [newCompany] = await db.insert(companies).values({
        name: "Demo Company Inc.",
        email: "contact@democompany.com",
        phone: "+1 (555) 123-4567",
        industry: "Technology",
        status: "active",
        tier: "premium",
        storeHash: "demo_store_hash",
        channelId: "1",
      }).returning();

      this.companyCache = newCompany;
      return newCompany;
    }

    this.companyCache = result[0];
    return result[0];
  }

  async updateCompany(id: string, updateData: Partial<Company>): Promise<Company | undefined> {
    const [updated] = await db.update(companies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    // Clear cache
    if (this.companyCache && this.companyCache.id === id) {
      this.companyCache = null;
    }

    return updated;
  }

  async getCompanyUsers(): Promise<User[]> {
    const company = await this.getCompany();
    return await db.select().from(users).where(eq(users.companyId, company.id));
  }

  async getCompanyAddresses(): Promise<Address[]> {
    const company = await this.getCompany();
    return await db.select().from(addresses).where(eq(addresses.companyId, company.id));
  }

  async getAccessibleCompanies(userId: string): Promise<Company[]> {
    const user = await this.getUser(userId);
    if (!user || !user.companyId) return [];

    const userCompany = await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1);
    if (!userCompany || userCompany.length === 0) return [];

    const company = userCompany[0];
    
    // Get parent company if exists
    const parentCompanyId = company.parentCompanyId || (company.hierarchyLevel === 0 ? company.id : null);
    
    if (parentCompanyId) {
      // User can access parent and all its children
      const accessibleCompanies = await db.select().from(companies).where(
        or(
          eq(companies.id, parentCompanyId),
          eq(companies.parentCompanyId, parentCompanyId)
        )
      );
      return accessibleCompanies;
    }

    // User can only access their own company
    return [company];
  }

  async getCompanyHierarchy(companyId: string): Promise<{ parent: Company | null; children: Company[] }> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return { parent: null, children: [] };

    let parent: Company | null = null;
    if (company.parentCompanyId) {
      const [parentCompany] = await db.select().from(companies).where(eq(companies.id, company.parentCompanyId));
      parent = parentCompany || null;
    }

    const children = await db.select().from(companies).where(eq(companies.parentCompanyId, companyId));

    return { parent, children };
  }

  async createAddress(address: Partial<Address>): Promise<Address> {
    const company = await this.getCompany();
    const [newAddress] = await db.insert(addresses).values({
      companyId: address.companyId || company.id,
      label: address.label || null,
      type: address.type || "shipping",
      isDefault: address.isDefault || false,
      street1: address.street1 || "",
      street2: address.street2 || null,
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "US",
    }).returning();
    return newAddress;
  }

  async updateAddress(id: string, updateData: Partial<Address>): Promise<Address | undefined> {
    const [updated] = await db.update(addresses)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(addresses.id, id))
      .returning();
    return updated;
  }

  async deleteAddress(id: string): Promise<boolean> {
    const result = await db.delete(addresses).where(eq(addresses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async setDefaultAddress(id: string, type: string): Promise<boolean> {
    const address = await db.select().from(addresses).where(eq(addresses.id, id)).then(r => r[0]);
    if (!address) return false;
    
    await db.update(addresses)
      .set({ isDefault: false })
      .where(and(
        eq(addresses.type, type),
        eq(addresses.companyId, address.companyId)
      ));
    
    await db.update(addresses)
      .set({ isDefault: true })
      .where(eq(addresses.id, id));
    
    return true;
  }

  async getShoppingLists(): Promise<ShoppingList[]> {
    return await db.select().from(shoppingLists);
  }

  async getShoppingList(id: string): Promise<ShoppingList | undefined> {
    const result = await db.select().from(shoppingLists).where(eq(shoppingLists.id, id));
    return result[0];
  }

  async createShoppingList(list: InsertShoppingList): Promise<ShoppingList> {
    const [newList] = await db.insert(shoppingLists).values(list).returning();
    return newList;
  }

  async updateShoppingList(id: string, list: Partial<ShoppingList>): Promise<ShoppingList | undefined> {
    const [updated] = await db.update(shoppingLists)
      .set({ ...list, updatedAt: new Date() })
      .where(eq(shoppingLists.id, id))
      .returning();
    return updated;
  }

  async deleteShoppingList(id: string): Promise<boolean> {
    const result = await db.delete(shoppingLists).where(eq(shoppingLists.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getShoppingListItems(listId: string): Promise<ShoppingListItem[]> {
    return await db.select().from(shoppingListItems).where(eq(shoppingListItems.listId, listId));
  }

  async addShoppingListItem(item: InsertShoppingListItem): Promise<ShoppingListItem> {
    const [newItem] = await db.insert(shoppingListItems).values(item).returning();
    return newItem;
  }

  async updateShoppingListItem(id: string, item: Partial<ShoppingListItem>): Promise<ShoppingListItem | undefined> {
    const [updated] = await db.update(shoppingListItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(shoppingListItems.id, id))
      .returning();
    return updated;
  }

  async deleteShoppingListItem(id: string): Promise<boolean> {
    const result = await db.delete(shoppingListItems).where(eq(shoppingListItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // BigCommerce Cache Methods
  async getCachedOrder(orderId: string, companyId: string): Promise<any | null> {
    const result = await db.select()
      .from(bigcommerceOrdersCache)
      .where(and(
        eq(bigcommerceOrdersCache.orderId, orderId),
        eq(bigcommerceOrdersCache.companyId, companyId)
      ))
      .limit(1);
    
    if (result.length === 0) return null;
    
    try {
      return JSON.parse(result[0].orderData);
    } catch (e) {
      console.error('[Cache] Failed to parse cached order:', e);
      return null;
    }
  }

  async setCachedOrders(orders: any[], companyId: string): Promise<void> {
    for (const order of orders) {
      const orderId = String(order.id);
      const orderData = JSON.stringify(order);

      // Upsert: insert or update if exists
      await db.insert(bigcommerceOrdersCache)
        .values({
          orderId,
          companyId,
          orderData,
          lastFetched: new Date(),
        })
        .onConflictDoUpdate({
          target: bigcommerceOrdersCache.orderId,
          set: {
            orderData,
            lastFetched: new Date(),
          }
        });
    }
  }

  // BigCommerce Token Storage Methods
  async storeUserToken(userId: string, bcToken: string, companyId?: string): Promise<void> {
    this.userTokens.set(userId, {
      userId,
      bcToken,
      companyId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours (BigCommerce storefront tokens expire after 1 day)
    });
  }

  async getUserToken(userId: string): Promise<string | null> {
    const tokenData = this.userTokens.get(userId);

    if (!tokenData) {
      return null;
    }

    // Check if expired
    if (new Date() > tokenData.expiresAt) {
      this.userTokens.delete(userId);
      return null;
    }

    return tokenData.bcToken;
  }

  async clearUserToken(userId: string): Promise<void> {
    this.userTokens.delete(userId);
  }
}

export const storage = new DatabaseStorage();
