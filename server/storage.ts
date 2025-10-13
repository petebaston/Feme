import { type User, type InsertUser, type Company, type Order, type Quote, type Invoice, type Address, type ShoppingList, type InsertShoppingList, type ShoppingListItem, type InsertShoppingListItem } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private orders: Map<string, Order> = new Map();
  private quotes: Map<string, Quote> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private company!: Company;
  private addresses: Map<string, Address> = new Map();
  private shoppingLists: Map<string, ShoppingList> = new Map();
  private shoppingListItems: Map<string, ShoppingListItem> = new Map();

  constructor() {
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create demo company
    const companyId = randomUUID();
    this.company = {
      id: companyId,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create demo users
    const demoUser: User = {
      id: randomUUID(),
      email: "demo@company.com",
      name: "Demo User",
      password: "demo123",
      role: "admin",
      companyId,
      status: "active",
      phoneNumber: "+1 (555) 100-0001",
      jobTitle: "Administrator",
      lastLoginAt: new Date() as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.users.set(demoUser.id, demoUser);

    const user2: User = {
      id: randomUUID(),
      email: "john@company.com",
      name: "John Smith",
      password: "password",
      role: "user",
      companyId,
      status: "active",
      phoneNumber: "+1 (555) 100-0002",
      jobTitle: "Buyer",
      lastLoginAt: null,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.users.set(user2.id, user2);

    const user3: User = {
      id: randomUUID(),
      email: "jane@company.com",
      name: "Jane Doe",
      password: "password",
      role: "manager",
      companyId,
      status: "active",
      phoneNumber: "+1 (555) 100-0003",
      jobTitle: "Procurement Manager",
      lastLoginAt: new Date() as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.users.set(user3.id, user3);

    // Create demo orders with payment terms and PO numbers
    const paymentTermsOptions = ["1-30 days", "30-60 days", "60-90 days", "90+ days", "Net 30", "Net 60"];
    const poStatusOptions = ["approved", "pending", "rejected", null];
    for (let i = 1; i <= 8; i++) {
      const orderId = `ORDER_${i.toString().padStart(3, '0')}`;
      const hasPO = i % 3 !== 0; // Some orders have PO, some don't
      const poStatus = hasPO ? poStatusOptions[i % poStatusOptions.length] : null;
      const order: Order = {
        id: orderId,
        orderNumber: `BC-${1000 + i}`,
        companyId,
        userId: demoUser.id,
        status: ["completed", "processing", "pending", "cancelled"][i % 4],
        total: (Math.random() * 10000 + 1000).toFixed(2),
        itemCount: Math.floor(Math.random() * 10) + 1,
        customerName: ["Demo Company Inc.", "Acme Corp", "Global Solutions"][Math.floor(Math.random() * 3)],
        shippingCity: ["New York", "Los Angeles", "Chicago", "Houston"][Math.floor(Math.random() * 4)],
        shippingState: ["NY", "CA", "IL", "TX"][Math.floor(Math.random() * 4)],
        paymentTerms: paymentTermsOptions[i % paymentTermsOptions.length] as any,
        poNumber: hasPO ? `PO-${2024000 + i}` : null,
        poStatus: poStatus as any,
        poApprovedAt: poStatus === 'approved' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) as any : null,
        poApprovedBy: poStatus === 'approved' ? user3.id : null,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) as any,
        updatedAt: new Date() as any,
      };
      this.orders.set(orderId, order);
    }

    // Create demo quotes
    for (let i = 1; i <= 6; i++) {
      const quoteId = `QUOTE_${i.toString().padStart(3, '0')}`;
      const quote: Quote = {
        id: quoteId,
        quoteNumber: `QT-${2000 + i}`,
        companyId,
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
        paymentTerms: paymentTermsOptions[i % paymentTermsOptions.length] as any,
        expiresAt: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000) as any,
        createdAt: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000) as any,
        updatedAt: new Date() as any,
      };
      this.quotes.set(quoteId, quote);
    }

    // Create demo invoices with payment terms
    for (let i = 1; i <= 10; i++) {
      const invoiceId = `INV_${i.toString().padStart(3, '0')}`;
      const subtotal = Math.random() * 8000 + 2000;
      const tax = subtotal * 0.08;
      const total = subtotal + tax;
      const createdDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
      const daysToAdd = i === 1 || i === 2 ? 7 : i === 3 || i === 4 ? 30 : i === 5 || i === 6 ? 60 : 90;
      
      const invoice: Invoice = {
        id: invoiceId,
        invoiceNumber: `INV-${3000 + i}`,
        companyId,
        userId: demoUser.id,
        orderId: i <= 8 ? `ORDER_${i.toString().padStart(3, '0')}` : null,
        status: ["paid", "pending", "overdue", "pending"][i % 4],
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        customerName: ["Demo Company Inc.", "Acme Corp", "Global Solutions"][Math.floor(Math.random() * 3)],
        paymentTerms: paymentTermsOptions[i % paymentTermsOptions.length] as any,
        dueDate: new Date(createdDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000) as any,
        paidDate: i % 4 === 0 ? new Date(createdDate.getTime() + (daysToAdd - 2) * 24 * 60 * 60 * 1000) as any : null,
        createdAt: createdDate as any,
        updatedAt: new Date() as any,
      };
      this.invoices.set(invoiceId, invoice);
    }

    // Create demo addresses
    const address1: Address = {
      id: randomUUID(),
      companyId,
      label: "Main Office",
      type: "billing",
      isDefault: true,
      street1: "123 Business Blvd",
      street2: "Suite 100",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "US",
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.addresses.set(address1.id, address1);

    const address2: Address = {
      id: randomUUID(),
      companyId,
      label: "Warehouse",
      type: "shipping",
      isDefault: false,
      street1: "456 Industrial Drive",
      street2: "",
      city: "Newark",
      state: "NJ",
      postalCode: "07102",
      country: "US",
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.addresses.set(address2.id, address2);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      password: insertUser.password,
      name: insertUser.name || null,
      role: insertUser.role || null,
      companyId: insertUser.companyId || null,
      status: insertUser.status || "active",
      phoneNumber: insertUser.phoneNumber || null,
      jobTitle: insertUser.jobTitle || null,
      lastLoginAt: null,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    
    const updated: User = {
      ...existing,
      ...updateData,
      updatedAt: new Date() as any,
    };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getDashboardStats(): Promise<any> {
    const orders = Array.from(this.orders.values());
    const quotes = Array.from(this.quotes.values());
    
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const ordersThisMonth = orders.filter(order => 
      order.createdAt && new Date(order.createdAt) >= thisMonth
    ).length;
    
    const monthlySpend = orders
      .filter(order => order.createdAt && new Date(order.createdAt) >= thisMonth)
      .reduce((sum, order) => sum + parseFloat(order.total as string), 0);

    return {
      totalOrders: orders.length,
      ordersThisMonth,
      pendingQuotes: quotes.filter(q => q.status === 'pending').length,
      quotesNeedingAttention: quotes.filter(q => q.status && ['pending', 'negotiating'].includes(q.status)).length,
      monthlySpend: Math.round(monthlySpend),
      spendChange: Math.floor(Math.random() * 20) - 10, // Mock change percentage
      activeCredit: 75000,
    };
  }

  async getOrders(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Order[]> {
    let orders = Array.from(this.orders.values());

    if (params?.search) {
      const search = params.search.toLowerCase();
      orders = orders.filter(order => 
        order.orderNumber.toLowerCase().includes(search) ||
        order.customerName?.toLowerCase().includes(search)
      );
    }

    if (params?.status && params.status !== 'all') {
      orders = orders.filter(order => order.status === params.status);
    }

    // Sort orders
    orders.sort((a, b) => {
      switch (params?.sortBy) {
        case 'date_asc':
          return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        case 'total':
          return parseFloat(b.total as string) - parseFloat(a.total as string);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        default: // 'date' - newest first
          return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      }
    });

    if (params?.limit) {
      orders = orders.slice(0, params.limit);
    }

    return orders;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    
    const updated: Order = {
      ...existing,
      ...order,
      updatedAt: new Date() as any,
    };
    this.orders.set(id, updated);
    return updated;
  }

  async getQuotes(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Quote[]> {
    let quotes = Array.from(this.quotes.values());

    if (params?.search) {
      const search = params.search.toLowerCase();
      quotes = quotes.filter(quote => 
        quote.quoteNumber.toLowerCase().includes(search) ||
        quote.title?.toLowerCase().includes(search)
      );
    }

    if (params?.status && params.status !== 'all') {
      quotes = quotes.filter(quote => quote.status === params.status);
    }

    // Sort quotes
    quotes.sort((a, b) => {
      switch (params?.sortBy) {
        case 'date_asc':
          return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        case 'total':
          return parseFloat(b.total as string) - parseFloat(a.total as string);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'expiry':
          const aExpiry = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
          const bExpiry = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
          return aExpiry - bExpiry;
        default: // 'date' - newest first
          return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      }
    });

    if (params?.limit) {
      quotes = quotes.slice(0, params.limit);
    }

    return quotes;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async updateQuote(id: string, quote: Partial<Quote>): Promise<Quote | undefined> {
    const existing = this.quotes.get(id);
    if (!existing) return undefined;
    
    const updated: Quote = {
      ...existing,
      ...quote,
      updatedAt: new Date() as any,
    };
    this.quotes.set(id, updated);
    return updated;
  }

  async getInvoices(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }): Promise<Invoice[]> {
    let invoices = Array.from(this.invoices.values());

    if (params?.search) {
      const search = params.search.toLowerCase();
      invoices = invoices.filter(invoice => 
        invoice.invoiceNumber.toLowerCase().includes(search) ||
        invoice.customerName?.toLowerCase().includes(search)
      );
    }

    if (params?.status && params.status !== 'all') {
      invoices = invoices.filter(invoice => invoice.status === params.status);
    }

    // Sort invoices
    invoices.sort((a, b) => {
      switch (params?.sortBy) {
        case 'date_asc':
          return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        case 'total':
          return parseFloat(b.total as string) - parseFloat(a.total as string);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'due_date':
          const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return aDue - bDue;
        default: // 'date' - newest first
          return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      }
    });

    if (params?.limit) {
      invoices = invoices.slice(0, params.limit);
    }

    return invoices;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async getCompany(): Promise<Company> {
    return this.company;
  }

  async getCompanyUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.companyId === this.company.id);
  }

  async getCompanyAddresses(): Promise<Address[]> {
    return Array.from(this.addresses.values()).filter(address => address.companyId === this.company.id);
  }

  async createAddress(address: Partial<Address>): Promise<Address> {
    const newAddress: Address = {
      id: randomUUID(),
      companyId: address.companyId || this.company.id,
      label: address.label || null,
      type: address.type || "shipping",
      isDefault: address.isDefault || false,
      street1: address.street1 || "",
      street2: address.street2 || null,
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "US",
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.addresses.set(newAddress.id, newAddress);
    return newAddress;
  }

  async updateAddress(id: string, updateData: Partial<Address>): Promise<Address | undefined> {
    const existing = this.addresses.get(id);
    if (!existing) return undefined;
    
    const updated: Address = {
      ...existing,
      ...updateData,
      updatedAt: new Date() as any,
    };
    this.addresses.set(id, updated);
    return updated;
  }

  async deleteAddress(id: string): Promise<boolean> {
    return this.addresses.delete(id);
  }

  async setDefaultAddress(id: string, type: string): Promise<boolean> {
    const address = this.addresses.get(id);
    if (!address) return false;
    
    // Remove default from all addresses of this type
    Array.from(this.addresses.values())
      .filter(a => a.type === type && a.companyId === address.companyId)
      .forEach(a => {
        a.isDefault = false;
        this.addresses.set(a.id, a);
      });
    
    // Set this address as default
    address.isDefault = true;
    this.addresses.set(id, address);
    return true;
  }

  async getShoppingLists(): Promise<ShoppingList[]> {
    return Array.from(this.shoppingLists.values());
  }

  async getShoppingList(id: string): Promise<ShoppingList | undefined> {
    return this.shoppingLists.get(id);
  }

  async createShoppingList(list: InsertShoppingList): Promise<ShoppingList> {
    const newList: ShoppingList = {
      id: randomUUID(),
      name: list.name,
      description: list.description || null,
      companyId: list.companyId,
      userId: list.userId,
      status: list.status || "active",
      isShared: list.isShared || false,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.shoppingLists.set(newList.id, newList);
    return newList;
  }

  async updateShoppingList(id: string, list: Partial<ShoppingList>): Promise<ShoppingList | undefined> {
    const existing = this.shoppingLists.get(id);
    if (!existing) return undefined;
    
    const updated: ShoppingList = {
      ...existing,
      ...list,
      updatedAt: new Date() as any,
    };
    this.shoppingLists.set(id, updated);
    return updated;
  }

  async deleteShoppingList(id: string): Promise<boolean> {
    return this.shoppingLists.delete(id);
  }

  async getShoppingListItems(listId: string): Promise<ShoppingListItem[]> {
    return Array.from(this.shoppingListItems.values()).filter(item => item.listId === listId);
  }

  async addShoppingListItem(item: InsertShoppingListItem): Promise<ShoppingListItem> {
    const newItem: ShoppingListItem = {
      id: randomUUID(),
      listId: item.listId,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku || null,
      quantity: item.quantity || 1,
      price: item.price || null,
      imageUrl: item.imageUrl || null,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };
    this.shoppingListItems.set(newItem.id, newItem);
    return newItem;
  }

  async updateShoppingListItem(id: string, item: Partial<ShoppingListItem>): Promise<ShoppingListItem | undefined> {
    const existing = this.shoppingListItems.get(id);
    if (!existing) return undefined;
    
    const updated: ShoppingListItem = {
      ...existing,
      ...item,
      updatedAt: new Date() as any,
    };
    this.shoppingListItems.set(id, updated);
    return updated;
  }

  async deleteShoppingListItem(id: string): Promise<boolean> {
    return this.shoppingListItems.delete(id);
  }
}

export const storage = new MemStorage();
