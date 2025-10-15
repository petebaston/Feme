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
      b2bApiUrl: 'https://api-b2b.bigcommerce.com',
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
    
    const channelId = process.env.VITE_CHANNEL_ID || '1';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Store-Hash': this.config.storeHash,
      'X-Channel-Id': channelId,
      ...(options.headers || {}),
    };

    // Always add server access token
    if (this.config.accessToken) {
      headers['X-Auth-Token'] = this.config.accessToken;
    }

    // Add user token for authenticated requests
    if (options.userToken) {
      headers['Authorization'] = `Bearer ${options.userToken}`;
    }

    console.log(`[BigCommerce] ${options.method || 'GET'} ${url}`, 'Headers:', Object.keys(headers));

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
    const channelId = parseInt(process.env.VITE_CHANNEL_ID || '1');
    
    const response = await this.request('/api/io/auth/customers', {
      method: 'POST',
      body: JSON.stringify({
        storeHash: this.config.storeHash,
        channelId,
        name: 'buyer portal token',
        email,
        password,
      }),
    });

    // Extract token from response (format: {code: 200, data: {token: "..."}, meta: {message: "SUCCESS"}})
    if (response && response.data && response.data.token) {
      return {
        token: response.data.token,
        user: {
          email,
          name: email.split('@')[0], // Basic fallback
        }
      };
    }

    throw new Error(response?.meta?.message || 'Login failed - no token returned');
  }

  // Dashboard
  async getDashboardStats(userToken: string) {
    return this.request('/api/v2/dashboard/stats', { userToken });
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
    return this.request(`/api/v2/orders${query ? `?${query}` : ''}`, { userToken });
  }

  async getOrder(userToken: string, orderId: string) {
    return this.request(`/api/v2/orders/${orderId}`, { userToken });
  }

  async updateOrder(userToken: string, orderId: string, data: any) {
    return this.request(`/api/v2/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      userToken
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
    return this.request(`/api/v2/quotes${query ? `?${query}` : ''}`, { userToken });
  }

  async getQuote(userToken: string, quoteId: string) {
    return this.request(`/api/v2/quotes/${quoteId}`, { userToken });
  }

  async updateQuote(userToken: string, quoteId: string, data: any) {
    return this.request(`/api/v2/quotes/${quoteId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      userToken,
    });
  }

  // Company
  async getCompany(userToken: string) {
    return this.request('/api/v2/company', { userToken });
  }

  async getCompanyUsers(userToken: string) {
    return this.request('/api/v2/company/users', { userToken });
  }

  async getCompanyAddresses(userToken: string) {
    return this.request('/api/v2/company/addresses', { userToken });
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
    return this.request(`/api/v2/invoices${query ? `?${query}` : ''}`, { userToken });
  }

  async getInvoice(userToken: string, invoiceId: string) {
    return this.request(`/api/v2/invoices/${invoiceId}`, { userToken });
  }

  async getInvoicePdf(userToken: string, invoiceId: string) {
    return this.request(`/api/v2/invoices/${invoiceId}/pdf`, { userToken });
  }

  // Shopping Lists
  async getShoppingLists(userToken: string) {
    return this.request('/api/v2/shopping-lists', { userToken });
  }

  async getShoppingList(userToken: string, listId: string) {
    return this.request(`/api/v2/shopping-lists/${listId}`, { userToken });
  }
}

export const bigcommerce = new BigCommerceService();
