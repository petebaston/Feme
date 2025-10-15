interface BigCommerceConfig {
  storeHash: string;
  accessToken: string;
  b2bApiUrl: string;
  clientId: string;
  clientSecret: string;
}

export class BigCommerceService {
  private config: BigCommerceConfig;

  constructor() {
    this.config = {
      storeHash: process.env.BIGCOMMERCE_STORE_HASH || process.env.VITE_STORE_HASH || '',
      accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN || '',
      b2bApiUrl: process.env.VITE_B2B_URL || 'https://api-b2b.bigcommerce.com/api/v3/io',
      clientId: process.env.BIGCOMMERCE_CLIENT_ID || '',
      clientSecret: process.env.BIGCOMMERCE_CLIENT_SECRET || '',
    };

    console.log('[BigCommerce] Initialized with:', {
      storeHash: this.config.storeHash,
      b2bApiUrl: this.config.b2bApiUrl,
      hasAccessToken: !!this.config.accessToken,
      hasClientId: !!this.config.clientId,
    });
  }

  private async request(endpoint: string, options: any = {}) {
    const url = `${this.config.b2bApiUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Auth-Token': this.config.accessToken,
      ...(options.headers || {}),
    };

    // Add user token if provided
    if (options.userToken) {
      headers['Authorization'] = `Bearer ${options.userToken}`;
    }

    console.log(`[BigCommerce] ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const text = await response.text();
      
      if (!response.ok) {
        console.error(`[BigCommerce] Error ${response.status}: ${text}`);
        throw new Error(`BigCommerce API Error: ${response.status} ${response.statusText}`);
      }

      return text ? JSON.parse(text) : null;
    } catch (error: any) {
      console.error('[BigCommerce] Request failed:', error.message);
      throw error;
    }
  }

  // Authentication
  async login(email: string, password: string) {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Dashboard
  async getDashboardStats(userToken: string) {
    return this.request('/dashboard/stats', { userToken });
  }

  // Orders
  async getOrders(userToken: string, params?: any) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.recent) queryParams.append('recent', 'true');

    const query = queryParams.toString();
    return this.request(`/orders${query ? `?${query}` : ''}`, { userToken });
  }

  async getOrder(userToken: string, orderId: string) {
    return this.request(`/orders/${orderId}`, { userToken });
  }

  async updateOrder(userToken: string, orderId: string, data: any) {
    return this.request(`/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      userToken,
    });
  }

  // Quotes
  async getQuotes(userToken: string, params?: any) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.recent) queryParams.append('recent', 'true');

    const query = queryParams.toString();
    return this.request(`/quotes${query ? `?${query}` : ''}`, { userToken });
  }

  async getQuote(userToken: string, quoteId: string) {
    return this.request(`/quotes/${quoteId}`, { userToken });
  }

  async updateQuote(userToken: string, quoteId: string, data: any) {
    return this.request(`/quotes/${quoteId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      userToken,
    });
  }

  // Company
  async getCompany(userToken: string) {
    return this.request('/company', { userToken });
  }

  async getCompanyUsers(userToken: string) {
    return this.request('/company/users', { userToken });
  }

  async getCompanyAddresses(userToken: string) {
    return this.request('/company/addresses', { userToken });
  }

  // Invoices
  async getInvoices(userToken: string, params?: any) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.recent) queryParams.append('recent', 'true');

    const query = queryParams.toString();
    return this.request(`/invoices${query ? `?${query}` : ''}`, { userToken });
  }

  async getInvoice(userToken: string, invoiceId: string) {
    return this.request(`/invoices/${invoiceId}`, { userToken });
  }

  async getInvoicePdf(userToken: string, invoiceId: string) {
    return this.request(`/invoices/${invoiceId}/pdf`, { userToken });
  }

  // Shopping Lists
  async getShoppingLists(userToken: string) {
    return this.request('/shopping-lists', { userToken });
  }

  async getShoppingList(userToken: string, listId: string) {
    return this.request(`/shopping-lists/${listId}`, { userToken });
  }
}

export const bigcommerce = new BigCommerceService();
