export interface BigCommerceAddress {
  first_name: string;
  last_name: string;
  company: string;
  street_1: string;
  street_2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  country_iso2: string;
  phone: string;
  email: string;
}

export interface BigCommerceProduct {
  name: string;
  sku: string;
  quantity: string | number;
  base_price?: string | number;
  price_ex_tax?: string | number;
  product_id: number;
  variant_id: number;
}

// Order structure returned by standard API (v2/orders)
export interface StandardOrder {
  id: number;
  customer_id: number;
  date_created: string;
  date_modified: string;
  status_id: number;
  subtotal_ex_tax: string;
  subtotal_inc_tax: string;
  total_ex_tax: string;
  total_inc_tax: string;
  initial_currency_code?: string;
  currency_code?: string;
  staff_notes?: string;
  customer_message?: string;
  billing_address: BigCommerceAddress;
  shipping_addresses?: BigCommerceAddress[];
  products?: any[]; // Usually fetched separately
  payment_method?: string;
  status: string; // Often added manually after mapping status_id
}

// Order structure returned by B2B API (api/v2/orders)
// Based on usage in bigcommerce.ts and routes.ts
export interface B2BOrder {
  orderId: number; // or id
  id?: number;
  customerId?: number;
  customer_id?: number; // Added during enrichment
  companyId?: string | number;
  orderStatus?: string;
  customOrderStatus?: string;
  status?: string;
  createdAt?: number; // Often unix timestamp in seconds
  updatedAt?: number;
  totalIncTax?: number | string;
  totalExTax?: number | string;
  currencyCode?: string;
  poNumber?: string;
  referenceNumber?: string;
  billingAddress?: BigCommerceAddress;
  shippingAddress?: BigCommerceAddress;
  firstName?: string;
  lastName?: string;
  email?: string;
  products?: Array<{
    name: string;
    productName?: string;
    sku: string;
    quantity: number;
    base_price?: number;
    price?: number;
    productId: number;
    variantId: number;
  }>;
  money?: {
    currency: {
      code: string;
    };
    value: string;
  };
  extraFields?: any[];
  extraInt1?: number;
  extraInt2?: number;
  extraInt3?: number;
  extraInt4?: number;
  extraInt5?: number;
  extraStr1?: string;
  extraStr2?: string;
  extraStr3?: string;
  extraStr4?: string;
  extraStr5?: string;
  extraText?: string;
}

// Unified frontend order interface
export interface FrontendOrder {
  id: number;
  bcOrderId: number;
  customerName: string;
  status: string;
  total: number;
  totalIncTax: number;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    productId: number;
    variantId: number;
  }>;
  poNumber: string;
  referenceNumber: string;
  customerId?: number;
  companyId?: string | number;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  currencyCode: string;
  money: {
    currency: {
      code: string;
    };
    value: string;
  };
  shippingAddress: BigCommerceAddress | null;
  billingAddress: BigCommerceAddress | null;
  extraFields: any[];
  extraInt1?: number;
  extraInt2?: number;
  extraInt3?: number;
  extraInt4?: number;
  extraInt5?: number;
  extraStr1?: string;
  extraStr2?: string;
  extraStr3?: string;
  extraStr4?: string;
  extraStr5?: string;
  extraText?: string;
}

export interface BigCommerceResponse<T> {
  data: T;
  meta: any;
}

export interface BigCommerceListResponse<T> {
  data: T[]; // or { list: T[], ... } depending on endpoint
  meta: any;
}

export interface B2BUser {
    id: number | string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId: string;
    customerId?: number;
}

