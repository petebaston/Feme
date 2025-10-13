import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  password: text("password").notNull(),
  role: text("role").default("user"),
  companyId: varchar("company_id"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  industry: text("industry"),
  status: text("status").default("active"),
  tier: text("tier").default("standard"),
  taxId: text("tax_id"),
  accountManager: text("account_manager"),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
  paymentTerms: text("payment_terms").default("Net 30"),
  storeHash: text("store_hash").notNull(),
  channelId: text("channel_id").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull(),
  companyId: varchar("company_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").default("pending"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  itemCount: integer("item_count"),
  customerName: text("customer_name"),
  shippingCity: text("shipping_city"),
  shippingState: text("shipping_state"),
  paymentTerms: text("payment_terms"),
  poNumber: text("po_number"),
  poStatus: text("po_status"),
  poApprovedAt: timestamp("po_approved_at"),
  poApprovedBy: varchar("po_approved_by"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: text("quote_number").notNull(),
  companyId: varchar("company_id").notNull(),
  userId: varchar("user_id").notNull(),
  title: text("title"),
  status: text("status").default("draft"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  itemCount: integer("item_count"),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull(),
  companyId: varchar("company_id").notNull(),
  userId: varchar("user_id").notNull(),
  orderId: varchar("order_id"),
  status: text("status").default("pending"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  customerName: text("customer_name"),
  paymentTerms: text("payment_terms"),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull(),
  label: text("label"),
  type: text("type").default("shipping"),
  isDefault: boolean("is_default").default(false),
  street1: text("street1").notNull(),
  street2: text("street2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").default("US"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const shoppingLists = pgTable("shopping_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  companyId: varchar("company_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").default("active"),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const shoppingListItems = pgTable("shopping_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  quantity: integer("quantity").default(1),
  price: decimal("price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressSchema = createInsertSchema(addresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShoppingListSchema = createInsertSchema(shoppingLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShoppingListItemSchema = createInsertSchema(shoppingListItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;

export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type ShoppingList = typeof shoppingLists.$inferSelect;

export type InsertShoppingListItem = z.infer<typeof insertShoppingListItemSchema>;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
