import { storage } from './storage';

interface BigCommerceConfig {
  storeHash: string;
  accessToken: string;
  managementToken: string;
  b2bApiUrl: string;
  standardApiUrl: string;
  clientId: string;
  clientSecret: string;
}

export class BigCommerceService {
  private config: BigCommerceConfig;
  private serverToServerToken: string = '';

  constructor() {
    const storeHash = process.env.BIGCOMMERCE_STORE_HASH || process.env.VITE_STORE_HASH || '';
    
    this.config = {
      storeHash,
      accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN || '',
      managementToken: process.env.BIGCOMMERCE_B2B_MANAGEMENT_TOKEN || '',
      b2bApiUrl: 'https://api-b2b.bigcommerce.com',
      standardApiUrl: `https://api.bigcommerce.com/stores/${storeHash}`,
      clientId: process.env.BIGCOMMERCE_CLIENT_ID || '',
      clientSecret: process.env.BIGCOMMERCE_CLIENT_SECRET || '',
    };

    console.log('[BigCommerce] Initialized with:', {
      storeHash: this.config.storeHash,
      b2bApiUrl: this.config.b2bApiUrl,
      standardApiUrl: this.config.standardApiUrl,
      hasAccessToken: !!this.config.accessToken,
      hasManagementToken: !!this.config.managementToken,
      hasClientId: !!this.config.clientId,
    });
  }

  // Generate Server-to-Server Token for Management API
  // Per BigCommerce: As of Sept 2025, use standard BigCommerce OAuth X-Auth-Token for B2B Edition
  private async getServerToServerToken(): Promise<string> {
    // Return cached token if available
    if (this.serverToServerToken) {
      return this.serverToServerToken;
    }

    // Use standard BigCommerce OAuth access token (works for both standard and B2B Edition APIs)
    if (this.config.accessToken) {
      this.serverToServerToken = this.config.accessToken;
      return this.serverToServerToken;
    }

    // Fallback to B2B-specific management token if provided
    if (this.config.managementToken) {
      this.serverToServerToken = this.config.managementToken;
      return this.serverToServerToken;
    }

    console.error('[BigCommerce] No authentication token configured');
    throw new Error('Authentication token not configured');
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

    // CRITICAL: Separate Storefront vs Management API authentication
    // Storefront APIs (orders, quotes, company, shopping lists): USER TOKEN ONLY via Authorization header
    // Management APIs (invoices, payments, admin, company users): MANAGEMENT TOKEN via X-Auth-Token header
    const isManagementEndpoint = endpoint.includes('/api/v3/io/') || 
                                  endpoint.includes('/api/v3/payments') ||
                                  endpoint.includes('/api/v3/super-admin') ||
                                  endpoint.includes('/api/v3/users') ||
                                  endpoint.includes('/api/v2/users') ||
                                  options.requireManagementToken;

    if (isManagementEndpoint) {
      // Management API: requires B2B Server-to-Server Token via X-Auth-Token header
      try {
        const serverToken = await this.getServerToServerToken();
        headers['X-Auth-Token'] = serverToken;
      } catch (error: any) {
        console.error('[BigCommerce] Failed to get server-to-server token:', error.message);
      }
    }

    // Add user token for authenticated requests (works for both Storefront and Management APIs)
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

  // Fetch orders from standard BigCommerce API (fallback)
  private async getStandardBigCommerceOrders(params?: any) {
    const url = `${this.config.standardApiUrl}/v2/orders`;
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.min_id) queryParams.append('min_id', params.min_id.toString());
    if (params?.max_id) queryParams.append('max_id', params.max_id.toString());
    if (params?.status_id) queryParams.append('status_id', params.status_id.toString());
    
    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
    
    console.log(`[BigCommerce Standard API] GET ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
      headers: {
        'X-Auth-Token': this.config.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[BigCommerce Standard API] Error ${response.status}:`, response.statusText);
      throw new Error(`BigCommerce Standard API Error: ${response.status} ${response.statusText}`);
    }
    
    const orders = await response.json();
    console.log(`[BigCommerce Standard API] Retrieved ${orders.length} orders`);
    
    // Transform to B2B Edition format
    return {
      code: 200,
      message: 'SUCCESS',
      data: {
        list: orders.map((order: any) => ({
          orderId: order.id,
          id: order.id,
          bcOrderId: order.id,
          customer_id: order.customer_id,  // CRITICAL: Preserve customer_id for company filtering
          createdAt: new Date(order.date_created).getTime() / 1000,
          updatedAt: new Date(order.date_modified).getTime() / 1000,
          status: this.mapStandardStatus(order.status_id),
          statusId: order.status_id,
          money: {
            currency: {
              code: order.currency_code || 'USD',
            },
            value: order.total_inc_tax?.toString() || '0',
          },
          totalIncTax: order.total_inc_tax,
          totalExTax: order.total_ex_tax,
          customerName: `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim(),
          companyName: order.billing_address?.company || '',
          billingAddress: order.billing_address,
          shippingAddress: Array.isArray(order.shipping_addresses) && order.shipping_addresses.length > 0 
            ? order.shipping_addresses[0] 
            : order.shipping_address || {},
          poNumber: order.staff_notes || '',
          source: 'standard_api', // Mark as from standard API
        })),
        paginator: {
          totalCount: orders.length,
          offset: 0,
          limit: orders.length,
        },
      },
    };
  }
  
  private mapStandardStatus(statusId: number): string {
    const statusMap: Record<number, string> = {
      0: 'Incomplete',
      1: 'Pending',
      2: 'Shipped',
      3: 'Partially Shipped',
      4: 'Refunded',
      5: 'Cancelled',
      6: 'Declined',
      7: 'Awaiting Payment',
      8: 'Awaiting Pickup',
      9: 'Awaiting Shipment',
      10: 'Completed',
      11: 'Awaiting Fulfillment',
      12: 'Manual Verification Required',
      13: 'Disputed',
      14: 'Partially Refunded',
    };
    return statusMap[statusId] || 'Unknown';
  }

  // Orders
  async getOrders(userToken: string, params?: any, companyId?: string) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.recent) queryParams.append('recent', 'true');
    
    // Add pagination defaults to ensure we get all orders
    if (!queryParams.has('limit')) queryParams.append('limit', '250');
    queryParams.append('offset', '0');

    const query = queryParams.toString();
    console.log('[BigCommerce] Fetching orders with query:', query);
    const response = await this.request(`/api/v2/orders${query ? `?${query}` : ''}`, { userToken });
    
    // Log detailed response for debugging
    let b2bOrders: any[] = [];
    if (response?.data) {
      const list = response.data.list || response.data || [];
      const total = response.data.paginator?.totalCount || list.length;
      console.log(`[BigCommerce B2B API] Returned ${list.length} orders (total: ${total})`);
      b2bOrders = list;
    }
    
    // ALWAYS fetch from standard API too, because B2B Edition may not have all historical orders
    let standardOrders: any[] = [];
    if (this.config.accessToken) {
      console.log('[BigCommerce] Also fetching from standard BigCommerce API...');
      try {
        const standardResponse = await this.getStandardBigCommerceOrders({
          limit: 250, // BigCommerce V2 API max limit is 250
        });
        
        if (standardResponse?.data?.list?.length > 0) {
          standardOrders = standardResponse.data.list;
          console.log(`[BigCommerce] ✅ Retrieved ${standardOrders.length} orders from standard API`);
        }
      } catch (fallbackError: any) {
        console.error('[BigCommerce] Standard API fetch failed:', fallbackError.message);
      }
    }
    
    // Merge orders from both APIs, removing duplicates by order ID
    const allOrders = [...b2bOrders];
    const b2bOrderIds = new Set(b2bOrders.map((o: any) => o.orderId || o.id));
    
    for (const stdOrder of standardOrders) {
      const stdOrderId = stdOrder.orderId || stdOrder.id;
      if (!b2bOrderIds.has(stdOrderId)) {
        allOrders.push(stdOrder);
      }
    }
    
    console.log(`[BigCommerce] Combined total: ${allOrders.length} orders (${b2bOrders.length} B2B + ${allOrders.length - b2bOrders.length} standard)`);
    
    // CRITICAL: Enrich B2B orders with customerId by matching against company users
    // B2B API orders don't include customer_id, so we need to add it for filtering
    if (companyId && b2bOrders.length > 0) {
      try {
        const usersResponse = await this.getCompanyUsers(userToken, companyId);
        if (usersResponse?.data && Array.isArray(usersResponse.data)) {
          console.log(`[BigCommerce] Enriching ${b2bOrders.length} B2B orders with customer IDs...`);
          
          // Create lookup maps: email -> customerId AND (firstName+lastName) -> customerId
          const emailToCustomerId = new Map<string, number>();
          const nameToCustomerId = new Map<string, number>();
          
          usersResponse.data.forEach((user: any) => {
            if (user.email && user.customerId) {
              emailToCustomerId.set(user.email.toLowerCase(), user.customerId);
            }
            if (user.firstName && user.lastName && user.customerId) {
              const nameKey = `${user.firstName.toLowerCase()}|${user.lastName.toLowerCase()}`;
              nameToCustomerId.set(nameKey, user.customerId);
            }
          });
          
          // Enrich B2B orders (match by email OR name)
          allOrders.forEach((order: any) => {
            if (!order.customer_id && !order.customerId) {
              let customerId: number | undefined;
              
              // Try matching by email first
              if (order.email) {
                customerId = emailToCustomerId.get(order.email.toLowerCase());
              }
              
              // Fall back to matching by firstName + lastName
              if (!customerId && order.firstName && order.lastName) {
                const nameKey = `${order.firstName.toLowerCase()}|${order.lastName.toLowerCase()}`;
                customerId = nameToCustomerId.get(nameKey);
              }
              
              if (customerId) {
                order.customer_id = customerId;
                console.log(`[BigCommerce] Matched order ${order.orderId} (${order.firstName} ${order.lastName}) to customer ${customerId}`);
              }
            }
          });
        }
      } catch (enrichError: any) {
        console.warn('[BigCommerce] Failed to enrich B2B orders with customer IDs:', enrichError.message);
      }
    }
    
    // Update response with combined orders
    if (response?.data) {
      response.data.list = allOrders;
      if (response.data.paginator) {
        response.data.paginator.totalCount = allOrders.length;
      }
    }
    
    // Cache orders if we have companyId
    if (companyId && allOrders.length > 0) {
      await storage.setCachedOrders(allOrders, companyId);
      console.log(`[Cache] Stored ${allOrders.length} combined orders for company ${companyId}`);
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
        // Fetch line items from standard API
        const products = await this.getOrderProducts(orderId);
        return { code: 200, data: { ...cachedOrder, products } };
      }
      console.log('[Cache] Order not in cache, fetching from API:', orderId);
    }
    
    // Try direct order endpoint first
    try {
      console.log('[BigCommerce] Fetching order directly:', orderId);
      const response = await this.request(`/api/v2/orders/${orderId}`, { userToken });
      
      if (response?.data) {
        console.log('[BigCommerce] Direct order fetch successful:', orderId);
        // Fetch line items from standard API
        const products = await this.getOrderProducts(orderId);
        const orderWithProducts = { ...response.data, products };
        
        // Cache the order
        if (companyId) {
          await storage.setCachedOrders([orderWithProducts], companyId);
        }
        return { code: 200, data: orderWithProducts };
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

    console.log('[BigCommerce] Order found in list:', foundOrder.orderId || foundOrder.id);
    // Fetch line items from standard API
    const products = await this.getOrderProducts(orderId);
    return { code: 200, data: { ...foundOrder, products } };
  }

  async getOrderProducts(orderId: string) {
    // Fetch order products from standard BigCommerce V2 API
    // This endpoint requires OAuth token, not B2B token
    if (!this.config.accessToken) {
      console.log('[BigCommerce] No access token, cannot fetch order products');
      return [];
    }

    try {
      const url = `${this.config.standardApiUrl}/v2/orders/${orderId}/products`;
      console.log('[BigCommerce] GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Auth-Token': this.config.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`[BigCommerce] Products fetch failed with status ${response.status}`);
        return [];
      }

      const products = await response.json();
      console.log(`[BigCommerce] Fetched ${products?.length || 0} products for order ${orderId}`);
      return products || [];
    } catch (error: any) {
      console.error('[BigCommerce] Error fetching order products:', error.message);
      return [];
    }
  }

  private async graphqlRequest(query: string, variables: any = {}, userToken?: string) {
    const url = `${this.config.b2bApiUrl}/graphql`;
    
    const channelId = process.env.VITE_CHANNEL_ID || '1';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Store-Hash': this.config.storeHash,
      'X-Channel-Id': channelId,
    };

    // CRITICAL: GraphQL authentication for B2B Edition
    // Use management token for GraphQL queries (required for B2B Edition)
    if (this.config.managementToken) {
      headers['X-Auth-Token'] = this.config.managementToken;
    }

    // Add user token for authenticated requests (filters to user's company context)
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
      // Per API spec, use currentUser instead of customer
      // UserType uses 'id' not 'entityId'
      const query = `
        query {
          currentUser {
            id
            email
            firstName
            lastName
            companyInfo {
              companyId
              companyName
            }
          }
        }
      `;
      const result = await this.graphqlRequest(query, {}, userToken);
      
      console.log('[BigCommerce] GraphQL Response:', JSON.stringify(result, null, 2));
      
      // Return in expected format
      const currentUser = result?.data?.currentUser;
      const actualCompanyId = currentUser?.companyInfo?.companyId || currentUser?.id;
      
      console.log('[BigCommerce] Company data:', {
        userId: currentUser?.id,
        companyId: actualCompanyId,
        companyName: currentUser?.companyInfo?.companyName,
        fullUser: currentUser,
      });
      
      return {
        code: 200,
        data: {
          id: actualCompanyId,
          companyId: actualCompanyId,
          email: currentUser?.email,
          name: currentUser?.companyInfo?.companyName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
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
    // Management API v3 endpoint - per official B2B Edition documentation
    // GET /api/v3/io/users - Get All Users
    // Uses OAuth X-Auth-Token (same authentication as invoices)
    const queryParams = new URLSearchParams();
    if (companyId) {
      queryParams.append('companyId', companyId);
    }
    const query = queryParams.toString();
    return this.request(`/api/v3/io/users${query ? `?${query}` : ''}`);
  }

  async getCompanyCustomerIds(userToken: string, companyId: string): Promise<number[]> {
    // Fetch all users for the company and extract their BigCommerce customer IDs
    // These customer IDs are used to filter standard BigCommerce API orders
    console.log(`[BigCommerce] Fetching customer IDs for company ${companyId}`);
    const response = await this.getCompanyUsers(userToken, companyId);
    
    if (!response?.data || !Array.isArray(response.data)) {
      console.warn('[BigCommerce] No users found for company');
      return [];
    }
    
    const customerIds = response.data
      .map((user: any) => user.customerId)
      .filter((id: any) => id !== undefined && id !== null);
    
    console.log(`[BigCommerce] Found ${customerIds.length} customer IDs for company ${companyId}:`, customerIds);
    return customerIds;
  }

  async getCompanyAddresses(userToken: string, companyId?: string) {
    // Management API v3 endpoint - per official B2B Edition documentation  
    // GET /api/v3/io/addresses - Get All Addresses
    // Uses OAuth X-Auth-Token (same authentication as invoices)
    const queryParams = new URLSearchParams();
    if (companyId) {
      queryParams.append('companyId', companyId);
    }
    const query = queryParams.toString();
    return this.request(`/api/v3/io/addresses${query ? `?${query}` : ''}`);
  }

  // Invoices - Use Management API v3 with server OAuth Token
  // Correct endpoint: /api/v3/io/ip/invoices (per official B2B Edition API docs)
  // SECURITY BEST PRACTICE: Always filter by customerId (Company ID) at API level
  async getInvoices(userToken?: string, params?: any) {
    const queryParams = new URLSearchParams();
    
    // CRITICAL: Filter by customerId (B2B Edition Company ID) for security
    // This ensures users only see invoices for their company
    if (params?.customerId) {
      queryParams.append('customerId', params.customerId);
    }
    
    // Additional filters per BigCommerce API docs
    if (params?.search) queryParams.append('q', params.search); // Use 'q' for search
    if (params?.status !== undefined && params.status !== 'all') {
      queryParams.append('status', params.status.toString());
    }
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    // Uses OAuth X-Auth-Token via request method (v3/io/ip endpoints)
    return this.request(`/api/v3/io/ip/invoices${query ? `?${query}` : ''}`);
  }

  async getInvoice(userToken: string | undefined, invoiceId: string) {
    // Uses B2B Management Token for Management API
    return this.request(`/api/v3/io/ip/invoices/${invoiceId}`);
  }

  async getInvoicePdf(userToken: string | undefined, invoiceId: string) {
    // Correct endpoint per BigCommerce documentation
    return this.request(`/api/v3/io/ip/invoices/${invoiceId}/download-pdf`);
  }

  // Products
  async searchProducts(userToken: string, query: string) {
    const queryParams = new URLSearchParams();
    if (query) queryParams.append('search', query);
    return this.request(`/api/v2/products?${queryParams.toString()}`, { userToken });
  }

  // Shopping Lists - Use Management API v3 per official spec
  // Base path: /api/v3/io/shopping-list (singular, not plural)
  async getShoppingLists(userToken: string, params?: any) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/v3/io/shopping-list${query ? `?${query}` : ''}`, { userToken });
  }

  async getShoppingList(userToken: string, listId: string) {
    return this.request(`/api/v3/io/shopping-list/${listId}`, { userToken });
  }

  async createShoppingList(userToken: string, data: any) {
    return this.request('/api/v3/io/shopping-list', {
      method: 'POST',
      body: JSON.stringify(data),
      userToken,
    });
  }

  async updateShoppingList(userToken: string, listId: string, data: any) {
    return this.request(`/api/v3/io/shopping-list/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      userToken,
    });
  }

  async deleteShoppingList(userToken: string, listId: string) {
    return this.request(`/api/v3/io/shopping-list/${listId}`, {
      method: 'DELETE',
      userToken,
    });
  }

  async addShoppingListItem(userToken: string, listId: string, item: any) {
    return this.request(`/api/v3/io/shopping-list/${listId}/items`, {
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
