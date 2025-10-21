import { storage } from './storage';

interface BigCommerceConfig {
  storeHash: string;
  accessToken: string;
  managementToken: string;
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
      managementToken: process.env.BIGCOMMERCE_B2B_MANAGEMENT_TOKEN || '',
      b2bApiUrl: 'https://api-b2b.bigcommerce.com',
      clientId: process.env.BIGCOMMERCE_CLIENT_ID || '',
      clientSecret: process.env.BIGCOMMERCE_CLIENT_SECRET || '',
    };

    console.log('[BigCommerce] Initialized with:', {
      storeHash: this.config.storeHash,
      b2bApiUrl: this.config.b2bApiUrl,
      hasAccessToken: !!this.config.accessToken,
      hasManagementToken: !!this.config.managementToken,
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

    // Use Management API token for v3 endpoints, otherwise use access token
    if (endpoint.startsWith('/api/v3/io')) {
      if (this.config.managementToken) {
        headers['authToken'] = this.config.managementToken;
      }
    } else {
      // Always add server access token for v2 endpoints
      if (this.config.accessToken) {
        headers['X-Auth-Token'] = this.config.accessToken;
      }
    }

    // Add user token for authenticated storefront requests
    if (options.userToken) {
      headers['Authorization'] = `Bearer ${options.userToken}`;
    }

    console.log(`[BigCommerce] ${options.method || 'GET'} ${url}`);
    console.log('[BigCommerce] Headers:', JSON.stringify({
      ...headers,
      'X-Auth-Token': headers['X-Auth-Token'] ? '***' : undefined,
      'Authorization': headers['Authorization'] ? '***' : undefined,
    }, null, 2));
    if (options.body) {
      console.log('[BigCommerce] Body:', options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const text = await response.text();
      
      console.log(`[BigCommerce] Response Status: ${response.status} ${response.statusText}`);
      console.log('[BigCommerce] Response Body:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      
      if (!response.ok) {
        console.error(`[BigCommerce] ❌ Error ${response.status}: ${text}`);
        throw new Error(`BigCommerce API Error: ${response.status} ${response.statusText}`);
      }

      const parsed = text ? JSON.parse(text) : null;
      
      // Check for BigCommerce error responses that come with 200 status
      if (parsed && (parsed.errMsg || parsed.error)) {
        console.error('[BigCommerce] ❌ API returned error in 200 response:', JSON.stringify(parsed, null, 2));
      }

      return parsed;
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
    // /api/v2/dashboard/stats doesn't exist - build stats from available data
    try {
      const [ordersResponse, quotesResponse] = await Promise.all([
        this.getOrders(userToken, { limit: 100 }),
        this.getQuotes(userToken, { limit: 100 })
      ]);

      // Ensure we have arrays (handle error responses from BigCommerce)
      const ordersRaw = ordersResponse?.data?.list || ordersResponse?.data || [];
      const quotesRaw = quotesResponse?.data?.list || quotesResponse?.data || [];
      
      const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
      const quotes = Array.isArray(quotesRaw) ? quotesRaw : [];

      return {
        code: 200,
        data: {
          totalOrders: orders.length,
          pendingOrders: orders.filter((o: any) => o.status?.toLowerCase() === 'pending' || o.status?.toLowerCase() === 'processing').length,
          completedOrders: orders.filter((o: any) => o.status?.toLowerCase() === 'completed' || o.status?.toLowerCase() === 'shipped').length,
          totalQuotes: quotes.length,
          openQuotes: quotes.filter((q: any) => q.status?.toLowerCase() === 'open' || q.status?.toLowerCase() === 'pending').length,
          approvedQuotes: quotes.filter((q: any) => q.status?.toLowerCase() === 'approved').length,
        }
      };
    } catch (error) {
      console.error('[BigCommerce] Dashboard stats calculation failed:', error);
      // Return empty stats rather than throwing
      return {
        code: 200,
        data: {
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          totalQuotes: 0,
          openQuotes: 0,
          approvedQuotes: 0,
        }
      };
    }
  }

  // Orders
  async getOrders(userToken: string, params?: any, companyId?: string) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.recent) queryParams.append('recent', 'true');

    const query = queryParams.toString();
    const response = await this.request(`/api/v2/orders${query ? `?${query}` : ''}`, { userToken });
    
    // Cache orders if we have companyId
    if (companyId && response?.data) {
      const ordersList = response.data.list || response.data || [];
      if (ordersList.length > 0) {
        await storage.setCachedOrders(ordersList, companyId);
        console.log(`[Cache] Stored ${ordersList.length} orders for company ${companyId}`);
      }
    }
    
    return response;
  }

  async getOrder(userToken: string, orderId: string, companyId?: string) {
    // Note: B2B Edition GraphQL doesn't support orders - using REST API only
    // GraphQL supports: quotes, invoices, company, shopping lists (not orders)
    
    // CACHE-FIRST: Check database cache first for reliability
    if (companyId) {
      const cachedOrder = await storage.getCachedOrder(orderId, companyId);
      if (cachedOrder) {
        console.log('[Cache] Order found in cache:', orderId);
        return { code: 200, data: cachedOrder };
      }
      console.log('[Cache] Order not in cache, fetching from API:', orderId);
    }
    
    // Try direct order endpoint first
    try {
      console.log('[BigCommerce] Fetching order directly:', orderId);
      const response = await this.request(`/api/v2/orders/${orderId}`, { userToken });
      
      if (response?.data) {
        console.log('[BigCommerce] Direct order fetch successful:', orderId);
        // Cache the order
        if (companyId) {
          await storage.setCachedOrders([response.data], companyId);
        }
        return response;
      }
    } catch (directError: any) {
      console.log('[BigCommerce] Direct order fetch failed, trying list fallback:', directError.message);
    }

    // Fallback: search in orders list (for API compatibility)
    console.log('[BigCommerce] Searching for order in list:', orderId);
    const ordersResponse = await this.getOrders(userToken, { limit: 100 }, companyId);
    const ordersList = ordersResponse?.data?.list || ordersResponse?.data || [];
    
    const foundOrder = ordersList.find((o: any) => 
      String(o.orderId) === String(orderId) || 
      String(o.id) === String(orderId)
    );
    
    if (!foundOrder) {
      throw new Error('Order not found');
    }

    console.log('[BigCommerce] Order found in list:', foundOrder.orderId);
    return { code: 200, data: foundOrder };
  }

  private async graphqlRequest(query: string, variables: any = {}, userToken?: string) {
    const url = `${this.config.b2bApiUrl}/graphql`;
    
    const channelId = process.env.VITE_CHANNEL_ID || '1';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Store-Hash': this.config.storeHash,
      'X-Channel-Id': channelId,
    };

    // Add server access token
    if (this.config.accessToken) {
      headers['X-Auth-Token'] = this.config.accessToken;
    }

    // Add user token for authenticated requests
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
      headers['authToken'] = userToken;
    }

    console.log(`[BigCommerce] GraphQL ${url}`, 'Headers:', Object.keys(headers));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    
    if (!response.ok || result.errors) {
      console.error(`[BigCommerce] GraphQL Error:`, result.errors || response.statusText);
      throw new Error(`GraphQL Error: ${JSON.stringify(result.errors || response.statusText)}`);
    }

    return result;
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

  async createQuote(userToken: string, data: any) {
    return this.request('/api/v2/quotes', {
      method: 'POST',
      body: JSON.stringify(data),
      userToken,
    });
  }

  async convertQuoteToOrder(userToken: string, quoteId: string) {
    return this.request(`/api/v2/quotes/${quoteId}/checkout`, {
      method: 'POST',
      body: JSON.stringify({}),
      userToken,
    });
  }

  // Company - Get current user's company info
  async getCompany(userToken: string) {
    // Company info is embedded in user context for B2B Edition
    // Return a basic structure for now - full company data requires Management API
    console.log('[BigCommerce] Fetching company data...');
    try {
      // Use GraphQL to get basic customer/company info
      const query = `
        query {
          customer {
            entityId
            email
            firstName
            lastName
          }
        }
      `;
      const result = await this.graphqlRequest(query, {}, userToken);
      
      // Return in expected format
      return {
        code: 200,
        data: {
          id: result?.data?.customer?.entityId,
          companyId: result?.data?.customer?.entityId,
          email: result?.data?.customer?.email,
          name: `${result?.data?.customer?.firstName || ''} ${result?.data?.customer?.lastName || ''}`.trim(),
        }
      };
    } catch (error: any) {
      console.error('[BigCommerce] Failed to fetch company:', error.message);
      // Return minimal fallback data instead of throwing
      return {
        code: 200,
        data: {
          id: 'unknown',
          companyId: 'unknown',
          email: '',
          name: 'Company',
        }
      };
    }
  }

  async getCompanyUsers(userToken: string, companyId?: string) {
    // REST Storefront API endpoint
    return this.request('/api/v2/companies/users', { userToken });
  }

  async getCompanyAddresses(userToken: string, companyId?: string) {
    // If we have companyId, use the correct path
    // Otherwise use the user's current company
    const endpoint = companyId 
      ? `/api/v2/companies/${companyId}/addresses`
      : '/api/v2/addresses';
    
    return this.request(endpoint, { userToken });
  }

  // Invoices - Use Management API v3
  async getInvoices(userToken: string, params?: any) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/v3/io/invoices${query ? `?${query}` : ''}`, { userToken });
  }

  async getInvoice(userToken: string, invoiceId: string) {
    return this.request(`/api/v3/io/invoices/${invoiceId}`, { userToken });
  }

  async getInvoicePdf(userToken: string, invoiceId: string) {
    return this.request(`/api/v3/io/invoices/${invoiceId}/pdf`, { userToken });
  }

  // Products
  async searchProducts(userToken: string, query: string) {
    const queryParams = new URLSearchParams();
    if (query) queryParams.append('search', query);
    return this.request(`/api/v2/products?${queryParams.toString()}`, { userToken });
  }

  // Shopping Lists - Use Management API v3 for full CRUD
  async getShoppingLists(userToken: string, params?: any) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/v3/io/shopping-lists${query ? `?${query}` : ''}`, { userToken });
  }

  async getShoppingList(userToken: string, listId: string) {
    return this.request(`/api/v3/io/shopping-lists/${listId}`, { userToken });
  }

  async createShoppingList(userToken: string, data: any) {
    return this.request('/api/v3/io/shopping-lists', {
      method: 'POST',
      body: JSON.stringify(data),
      userToken,
    });
  }

  async updateShoppingList(userToken: string, listId: string, data: any) {
    return this.request(`/api/v3/io/shopping-lists/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      userToken,
    });
  }

  async deleteShoppingList(userToken: string, listId: string) {
    return this.request(`/api/v3/io/shopping-lists/${listId}`, {
      method: 'DELETE',
      userToken,
    });
  }

  async addShoppingListItem(userToken: string, listId: string, item: any) {
    return this.request(`/api/v3/io/shopping-lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
      userToken,
    });
  }

  // Cart - Use BigCommerce standard cart API
  async getCart(userToken: string) {
    // B2B Edition uses standard BigCommerce cart
    // For now, return empty cart structure
    // Full implementation would need BigCommerce store URL and cart session management
    return {
      code: 200,
      data: {
        id: null,
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
      }
    };
  }

  async addCartItem(userToken: string, item: any) {
    // Would integrate with BigCommerce cart API
    // Placeholder for now
    return {
      code: 200,
      data: { success: true }
    };
  }

  async updateCartItem(userToken: string, itemId: string, quantity: number) {
    // Would integrate with BigCommerce cart API
    return {
      code: 200,
      data: { success: true }
    };
  }

  async removeCartItem(userToken: string, itemId: string) {
    // Would integrate with BigCommerce cart API
    return {
      code: 200,
      data: { success: true }
    };
  }
}

export const bigcommerce = new BigCommerceService();
