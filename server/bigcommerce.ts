import { storage } from './storage';
import { StandardOrder, B2BOrder, BigCommerceAddress, B2BUser, BigCommerceResponse, BigCommerceListResponse } from './types';

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

  private async request<T = any>(endpoint: string, options: any = {}): Promise<T> {
    const url = `${this.config.b2bApiUrl}${endpoint}`;

    const channelId = process.env.VITE_CHANNEL_ID || '1';

    // Per BigCommerce Sept 2025 API authentication update:
    // - X-Auth-Token + X-Store-Hash required for REST Management V3 API (/api/v3/io/*)
    // - Authorization: Bearer required for GraphQL and REST Storefront (/api/v2/*)
    // Reference: https://developer.bigcommerce.com/b2b-edition/docs/authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Store-Hash': this.config.storeHash,  // Required for all B2B API calls
      'X-Channel-Id': channelId,              // Optional but useful for multi-storefront
      ...(options.headers || {}),
    };

    // CRITICAL: Authentication strategy
    // BUYER PORTAL ENDPOINTS: Use storefront user token (company-scoped by BigCommerce)
    // ADMIN/MANAGEMENT ENDPOINTS: Use server-to-server token (store-wide access)
    
    // Explicitly check if this should use storefront token (buyer-facing endpoints)
    const useStorefrontToken = options.useStorefrontToken || false;
    
    if (useStorefrontToken && options.userToken) {
      // BUYER CONTEXT: Use storefront token - BigCommerce automatically scopes by company
      headers['Authorization'] = `Bearer ${options.userToken}`;
      console.log('[BigCommerce] ✓ Using buyer storefront token (auto-scoped by company)');
    } else {
      // ADMIN CONTEXT: Check if this is a management endpoint
      const isManagementEndpoint = endpoint.includes('/api/v3/io/') || 
                                    endpoint.includes('/api/v3/payments') ||
                                    endpoint.includes('/api/v3/super-admin') ||
                                    endpoint.includes('/api/v3/users') ||
                                    endpoint.includes('/api/v2/users') ||
                                    options.requireManagementToken;

      if (isManagementEndpoint) {
        // Management API: requires server-to-server token via X-Auth-Token
        try {
          const serverToken = await this.getServerToServerToken();
          headers['X-Auth-Token'] = serverToken;
          console.log('[BigCommerce] Using management token (store-wide access)');
        } catch (error: any) {
          console.error('[BigCommerce] Failed to get server-to-server token:', error.message);
        }
      } else if (options.userToken) {
        // Storefront API with user token
        headers['Authorization'] = `Bearer ${options.userToken}`;
        console.log('[BigCommerce] Using user token for storefront API');
      }
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
      const ordersRaw = ordersResponse?.data || [];
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
  public async getStandardBigCommerceOrders(params?: any): Promise<{ code: number, message: string, data: { list: B2BOrder[], paginator: any } }> {
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
        list: orders.map((order: any): B2BOrder => ({
          orderId: order.id,
          id: order.id,
          // bcOrderId is not part of B2BOrder but useful for debugging
          // B2BOrder has orderId
          customer_id: order.customer_id,  // CRITICAL: Preserve customer_id for company filtering
          createdAt: new Date(order.date_created).getTime() / 1000,
          updatedAt: new Date(order.date_modified).getTime() / 1000,
          status: this.mapStandardStatus(order.status_id),
          // statusId: order.status_id, // Not in B2BOrder strictly but maybe useful
          money: {
            currency: {
              code: order.currency_code || 'USD',
            },
            value: order.total_inc_tax?.toString() || '0',
          },
          totalIncTax: order.total_inc_tax,
          totalExTax: order.total_ex_tax,
          companyId: undefined, // Standard orders don't have companyId natively
          billingAddress: order.billing_address,
          shippingAddress: Array.isArray(order.shipping_addresses) && order.shipping_addresses.length > 0 
            ? order.shipping_addresses[0] 
            : order.shipping_address || {},
          poNumber: order.staff_notes || '',
          extraFields: [], // Mark as from standard API
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
  async getOrders(userToken: string, params?: any, companyId?: string): Promise<BigCommerceListResponse<B2BOrder>> {
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
    const response = await this.request<any>(`/api/v2/orders${query ? `?${query}` : ''}`, { userToken });
    
    // Log detailed response for debugging
    let b2bOrders: B2BOrder[] = [];
    if (response?.data) {
      const list = response.data.list || response.data || [];
      const total = response.data.paginator?.totalCount || list.length;
      console.log(`[BigCommerce B2B API] Returned ${list.length} orders (total: ${total})`);
      b2bOrders = list;
    }
    
    // ALWAYS fetch from standard API too, because B2B Edition may not have all historical orders
    let standardOrders: B2BOrder[] = [];
    if (this.config.accessToken) {
      console.log('[BigCommerce] Also fetching from standard BigCommerce API...');
      try {
        const standardResponse = await this.getStandardBigCommerceOrders({
          limit: 250, // BigCommerce V2 API max limit is 250
        });
        
        if (standardResponse?.data?.list?.length > 0) {
          standardOrders = standardResponse.data.list;
          console.log(`[BigCommerce] ✅ Retrieved ${standardOrders.length} orders from standard API`);
          
          // CRITICAL: Filter standard orders to only the current company's customer IDs
          if (companyId) {
            const companyCustomerIds = await this.getCompanyCustomerIds(userToken, companyId);
            if (companyCustomerIds.length > 0) {
              const customerIdSet = new Set(companyCustomerIds);
              const beforeFilter = standardOrders.length;
              standardOrders = standardOrders.filter((order) => {
                return order.customer_id && customerIdSet.has(order.customer_id);
              });
              console.log(`[BigCommerce] Filtered standard orders: ${beforeFilter} total → ${standardOrders.length} for company ${companyId}`);
            } else {
              console.warn(`[BigCommerce] No customer IDs found for company ${companyId}, excluding all standard orders`);
              // If we have a companyId but no customers found, it's safer to not return any standard orders
              // rather than potentially leaking others.
              standardOrders = [];
            }
          }
        }
      } catch (fallbackError: any) {
        console.error('[BigCommerce] Standard API fetch failed:', fallbackError.message);
      }
    }
    
    // Merge orders from both APIs, removing duplicates by order ID
    const allOrders: B2BOrder[] = [...b2bOrders];
    const b2bOrderIds = new Set(b2bOrders.map((o) => o.orderId || o.id));
    
    for (const stdOrder of standardOrders) {
      const stdOrderId = stdOrder.orderId || stdOrder.id;
      if (stdOrderId && !b2bOrderIds.has(stdOrderId)) {
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
          
          usersResponse.data.forEach((user: B2BUser) => {
            if (user.email && user.customerId) {
              emailToCustomerId.set(user.email.toLowerCase(), user.customerId);
            }
            if (user.firstName && user.lastName && user.customerId) {
              const nameKey = `${user.firstName.toLowerCase()}|${user.lastName.toLowerCase()}`;
              nameToCustomerId.set(nameKey, user.customerId);
            }
          });
          
          // Enrich B2B orders (match by email OR name)
          allOrders.forEach((order) => {
            if (!order.customer_id && !order.customerId) {
              let customerId: number | undefined;
              
              // Try matching by email first
              if (order.email) {
                customerId = emailToCustomerId.get(order.email.toLowerCase());
              }
              
              // Fall back to matching by firstName + lastName
              if (!customerId && order.firstName && order.lastName) {
                const nameKey = `${order.firstName?.toLowerCase()}|${order.lastName?.toLowerCase()}`;
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
    // Construct new response object to ensure it has correct structure
    const result: BigCommerceListResponse<B2BOrder> = {
        meta: response?.meta || {},
        data: allOrders
        // removed custom paginator structure to match interface or update interface
    }
    
    // Cache orders if we have companyId
    if (companyId && allOrders.length > 0) {
      await storage.setCachedOrders(allOrders, companyId);
      console.log(`[Cache] Stored ${allOrders.length} combined orders for company ${companyId}`);
    }
    
    return result;
  }

  async getOrder(userToken: string, orderId: string, companyId?: string): Promise<{ code: number, data: B2BOrder }> {
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
      const response = await this.request<any>(`/api/v2/orders/${orderId}`, { userToken });
      
      if (response?.data) {
        console.log('[BigCommerce] Direct order fetch successful:', orderId);
        // Fetch line items from standard API
        const products = await this.getOrderProducts(orderId);
        // Cast to B2BOrder because we don't have a specific SingleOrder response type yet and api/v2/orders/:id returns object directly in standard, but here we assume normalized if from requesting
        // Actually request<T> returns data. So response.data is the order.
        const orderData = response.data as B2BOrder;
        
        const orderWithProducts: B2BOrder = { ...orderData, products };
        
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
    const ordersList = ordersResponse.data || [];
    
    const foundOrder = ordersList.find((o) => 
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

    // Per BigCommerce Sept 2025 API authentication update:
    // GraphQL Storefront API uses Authorization: Bearer {storefront_token}
    // X-Store-Hash is required for all B2B API calls
    // Reference: https://developer.bigcommerce.com/b2b-edition/docs/authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Store-Hash': this.config.storeHash,  // Required for all B2B API calls
      'X-Channel-Id': channelId,
    };

    // For GraphQL, prefer user's storefront token for company-scoped queries
    // Falls back to management token for admin-level queries
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    } else if (this.config.managementToken) {
      // Fallback to management token for server-initiated queries
      headers['X-Auth-Token'] = this.config.managementToken;
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
          extraFields: [] as any[],
          extraFieldsError: false as boolean | undefined,
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
          extraFields: [] as any[],
          extraFieldsError: false as boolean | undefined,
        }
      };
    }
  }

  async getCompanyUsers(userToken: string, companyId?: string): Promise<{ data: B2BUser[] }> {
    // Management API v3 endpoint - per official B2B Edition documentation
    // GET /api/v3/io/users - Get All Users (with full pagination support)
    // Uses OAuth X-Auth-Token (same authentication as invoices)
    
    let allUsers: B2BUser[] = [];
    let offset = 0;
    const limit = 100; // Fetch 100 users per request
    let totalCount = 0;
    
    do {
      const queryParams = new URLSearchParams();
      if (companyId) {
        queryParams.append('companyId', companyId);
      }
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', offset.toString());
      
      const query = queryParams.toString();
      const response = await this.request<any>(`/api/v3/io/users?${query}`);
      
      const users: B2BUser[] = response?.data || [];
      allUsers = allUsers.concat(users);
      
      totalCount = response?.meta?.pagination?.totalCount || users.length;
      offset += users.length;
      
      console.log(`[BigCommerce] Fetched ${users.length} users (${offset}/${totalCount} total)${companyId ? ` for company ${companyId}` : ''}`);
      
      // Stop if no more users or we've fetched everything
      if (users.length === 0 || offset >= totalCount) {
        break;
      }
    } while (offset < totalCount);
    
    console.log(`[BigCommerce] Total users fetched: ${allUsers.length}${companyId ? ` for company ${companyId}` : ''}`);
    return { data: allUsers };
  }

  async getCompanyCustomerIds(userToken: string, companyId: string): Promise<number[]> {
    // ENHANCED: Fetch customer IDs from BOTH B2B users AND actual orders
    // This ensures we capture all customers who placed orders for this company,
    // even if they're not registered as B2B users
    console.log(`[BigCommerce] Fetching customer IDs for company ${companyId}`);
    
    const customerIdSet = new Set<number>();
    const validCompanyIdentifiers = new Set<string>();
    
    // Add current company ID as valid identifier
    validCompanyIdentifiers.add(companyId);
    
    // Method 1: Get customer IDs from B2B registered users
    const response = await this.getCompanyUsers(userToken, companyId);
    if (response?.data && Array.isArray(response.data)) {
      response.data
        .map((user: any) => user.customerId)
        .filter((id: any) => id !== undefined && id !== null)
        .forEach((id: number) => customerIdSet.add(id));
      console.log(`[BigCommerce] Found ${customerIdSet.size} customer IDs from B2B users`);
    }
    
    // Method 2: Discover company identifiers and customer IDs from orders
    try {
      const companyDetails = await this.getCompanyDetails(companyId);
      const companyName = companyDetails?.data?.companyName;
      
      if (this.config.accessToken) {
        // Fetch all orders from standard API
        const standardResponse = await this.getStandardBigCommerceOrders({ limit: 250 });
        const allOrders = standardResponse?.data?.list || [];
        
        console.log(`[BigCommerce] Scanning ${allOrders.length} orders to discover company identifiers...`);
        
        // STRATEGY A: If we have B2B users, use them as seed to discover identifiers
        if (customerIdSet.size > 0) {
          // STEP 1: Find company identifiers used by KNOWN company customers
          const knownCustomerOrders = allOrders.filter((order: any) => 
            order.customer_id && customerIdSet.has(order.customer_id)
          );
          
          knownCustomerOrders.forEach((order: any) => {
            const orderCompany = (order.companyName || order.billingAddress?.company || order.billing_address?.company || '').trim();
            if (orderCompany) {
              validCompanyIdentifiers.add(orderCompany);
            }
          });
          
          console.log(`[BigCommerce] Discovered company identifiers from known customers:`, Array.from(validCompanyIdentifiers));
        } 
        // STRATEGY B (FALLBACK): If NO B2B users, discover identifiers by matching company name
        else {
          console.log(`[BigCommerce] No B2B users found, using fallback: matching by company name "${companyName}"`);
          
          // Find orders where billing company name matches
          if (companyName) {
            const companyNameOrders = allOrders.filter((order: any) => {
              const orderCompany = (order.companyName || order.billingAddress?.company || order.billing_address?.company || '').trim();
              return orderCompany && orderCompany.toLowerCase().includes(companyName.toLowerCase());
            });
            
            // Collect all company identifiers from these orders
            companyNameOrders.forEach((order: any) => {
              const orderCompany = (order.companyName || order.billingAddress?.company || order.billing_address?.company || '').trim();
              if (orderCompany) {
                validCompanyIdentifiers.add(orderCompany);
              }
            });
            
            console.log(`[BigCommerce] Fallback discovered ${companyNameOrders.length} orders matching company name`);
            console.log(`[BigCommerce] Fallback discovered company identifiers:`, Array.from(validCompanyIdentifiers));
          }
        }
        
        // STEP 2: Find ALL customers who have orders with these validated company identifiers
        const matchingOrders = allOrders.filter((order: any) => {
          const orderCompany = (order.companyName || order.billingAddress?.company || order.billing_address?.company || '').trim();
          return orderCompany && validCompanyIdentifiers.has(orderCompany);
        });
        
        // Extract unique customer IDs from matching orders
        matchingOrders.forEach((order: any) => {
          if (order.customer_id) {
            customerIdSet.add(order.customer_id);
          }
        });
        
        console.log(`[BigCommerce] Found ${matchingOrders.length} orders matching validated company identifiers`);
        console.log(`[BigCommerce] Total unique customer IDs discovered: ${customerIdSet.size}`);
      }
    } catch (error) {
      console.warn('[BigCommerce] Failed to scan orders for company matching:', error);
    }
    
    const customerIds = Array.from(customerIdSet);
    console.log(`[BigCommerce] Final customer IDs for company ${companyId}:`, customerIds);
    return customerIds;
  }

  async getCompanyCustomerAccountIds(userToken: string, companyId: string): Promise<string[]> {
    // Fetch B2B Customer Accounts for the company from Management API
    // These are different from user customerIds - they represent B2B account entities
    // linked to ERP codes (FEM01, etc.) and used in invoice.customerId fields
    console.log(`[BigCommerce] Fetching customer account IDs for company ${companyId}`);
    const response = await this.request(`/api/v3/io/companies/${companyId}/customers`);
    
    if (!response?.data) {
      console.warn('[BigCommerce] No customer accounts found for company');
      return [];
    }
    
    const customerAccounts = response.data.list || response.data || [];
    const accountIds = customerAccounts
      .map((account: any) => String(account.customerId || account.id))
      .filter((id: string) => id && id !== 'undefined' && id !== 'null');
    
    console.log(`[BigCommerce] Found ${accountIds.length} customer account IDs for company ${companyId}:`, accountIds);
    return accountIds;
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

  // Invoices - MUST use Management Token (buyer tokens return 403 "Invalid token")
  // Primary list endpoint (observed): /api/v3/io/invoice-management/invoice
  // Alternate (some tenants): /api/v3/io/ip/invoices
  // CRITICAL: BigCommerce ignores companyId parameter, so server MUST filter by extraFields.Customer
  async getInvoices(userToken?: string, params?: any) {
    const queryParams = new URLSearchParams();
    
    // Optional search filters (companyId is ignored by BigCommerce)
    if (params?.search) queryParams.append('q', params.search);
    if (params?.status !== undefined && params.status !== 'all') {
      queryParams.append('status', params.status.toString());
    }
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    // Use management token - buyer tokens return 403
    try {
      console.log('[BigCommerce] Fetching invoices with management token (buyer tokens not supported)');
      return await this.request(`/api/v3/io/invoice-management/invoice${query ? `?${query}` : ''}`);
    } catch (err: any) {
      // Fallback to alternate path if 404
      if (String(err?.message || '').includes('404')) {
        return await this.request(`/api/v3/io/ip/invoices${query ? `?${query}` : ''}`);
      }
      throw err;
    }
  }

  async getInvoice(userToken: string | undefined, invoiceId: string) {
    // Individual invoice - uses management token
    console.log('[BigCommerce] Fetching invoice with management token');
    return this.request(`/api/v3/io/ip/invoices/${invoiceId}`);
  }

  async getInvoicePdf(userToken: string | undefined, invoiceId: string) {
    // PDF download - uses management token
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

  // Company Credit - Multiple endpoint investigation
  // 1. Check if company credit feature is enabled
  async getCompanyCreditConfiguration() {
    try {
      console.log('[BigCommerce] Checking if company credit is enabled...');
      return await this.request('/api/v3/payments/company-credit/configuration');
    } catch (error: any) {
      console.log('[BigCommerce] Company credit configuration check failed:', error.message);
      return null;
    }
  }

  // 2. Get company credit (only works if feature is enabled)
  async getCompanyCredit(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching credit info for company ${companyId}`);
      return await this.request(`/api/v3/io/companies/${companyId}/credit`);
    } catch (error: any) {
      console.log(`[BigCommerce] Company credit fetch failed: ${error.message}`);
      return null;
    }
  }

  // 3. Get full company details (includes extraFields which may contain credit limit)
  async getCompanyDetails(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching full company details for ${companyId}`);
      return await this.request(`/api/v3/io/companies/${companyId}`);
    } catch (error: any) {
      console.log(`[BigCommerce] Company details fetch failed: ${error.message}`);
      return null;
    }
  }

  // ============================================
  // EXTRA FIELDS SUPPORT
  // Per BigCommerce B2B API: Extra fields allow custom data
  // for orders, companies, invoices, etc.
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis
  // ============================================

  // Get extra field configurations for orders
  async getOrderExtraFieldConfigs() {
    try {
      console.log('[BigCommerce] Fetching order extra field configurations...');
      return await this.request('/api/v3/io/orders/extra-field-configs');
    } catch (error: any) {
      console.log('[BigCommerce] Order extra field configs fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Get extra field configurations for companies
  async getCompanyExtraFieldConfigs() {
    try {
      console.log('[BigCommerce] Fetching company extra field configurations...');
      return await this.request('/api/v3/io/companies/extra-field-configs');
    } catch (error: any) {
      console.log('[BigCommerce] Company extra field configs fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Get extra field configurations for invoices
  async getInvoiceExtraFieldConfigs() {
    try {
      console.log('[BigCommerce] Fetching invoice extra field configurations...');
      return await this.request('/api/v3/io/invoices/extra-field-configs');
    } catch (error: any) {
      console.log('[BigCommerce] Invoice extra field configs fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Get order with extra fields via B2B REST API
  // Uses /api/v3/io/orders endpoint with showExtra=true parameter
  async getOrderWithExtraFields(userToken: string, orderId: string) {
    try {
      console.log(`[BigCommerce] Fetching order ${orderId} with extra fields via REST API...`);

      // Use the B2B REST API with showExtra=true to get extra fields
      const response = await this.request(`/api/v3/io/orders?bcOrderId=${orderId}&showExtra=true`);

      if (response?.code === 200 && response?.data?.length > 0) {
        const orderData = response.data[0];
        console.log(`[BigCommerce] REST API order fetch successful with ${orderData.extraFields?.length || 0} extra fields`);
        return { code: 200, data: orderData };
      }

      // If no B2B order found, return null (order might be a standard BC order without B2B record)
      console.log(`[BigCommerce] No B2B order record found for bcOrderId ${orderId}`);
      return null;
    } catch (error: any) {
      console.log('[BigCommerce] REST API order with extra fields failed:', error.message);
      return null;
    }
  }

  // Get all B2B orders with extra fields for a company
  // Uses /api/v3/io/orders endpoint with showExtra=true and companyId filter
  async getB2BOrdersWithExtraFields(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching B2B orders with extra fields for company ${companyId}...`);

      // Use the B2B REST API with showExtra=true to get all extra fields
      const response = await this.request(`/api/v3/io/orders?companyId=${companyId}&showExtra=true&limit=250`);

      if (response?.code === 200 && response?.data) {
        const orders = response.data;
        console.log(`[BigCommerce] Retrieved ${orders.length} B2B orders with extra fields for company ${companyId}`);
        return { code: 200, data: orders };
      }

      console.log(`[BigCommerce] No B2B orders found for company ${companyId}`);
      return { code: 200, data: [] };
    } catch (error: any) {
      console.log('[BigCommerce] B2B orders with extra fields fetch failed:', error.message);
      return { code: 500, data: [] };
    }
  }

  // Get company with extra fields
  async getCompanyWithExtraFields(userToken: string) {
    try {
      console.log('[BigCommerce] Fetching company with extra fields via GraphQL...');

      const query = `
        query GetCompanyWithExtraFields {
          company {
            id
            companyName
            companyStatus
            companyEmail
            addressLine1
            addressLine2
            city
            state
            zipCode
            country
            phone
            extraFields {
              fieldName
              fieldValue
            }
          }
        }
      `;

      const result = await this.graphqlRequest(query, {}, userToken);

      if (result?.data?.company) {
        console.log(`[BigCommerce] GraphQL company fetch successful with ${result.data.company.extraFields?.length || 0} extra fields`);
        return { code: 200, data: result.data.company };
      }

      return null;
    } catch (error: any) {
      console.log('[BigCommerce] GraphQL company with extra fields failed:', error.message);
      return null;
    }
  }

  // ============================================
  // COMPANY HIERARCHY SUPPORT
  // Per BigCommerce B2B API: Companies can have parent-subsidiary relationships
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis/rest-management/company
  // ============================================

  // Get company hierarchy (parent and all descendants)
  async getCompanyHierarchy(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching hierarchy for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/hierarchy`);
    } catch (error: any) {
      console.log('[BigCommerce] Company hierarchy fetch failed:', error.message);
      return { data: null };
    }
  }

  // Get company subsidiaries (direct children only)
  async getCompanySubsidiaries(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching subsidiaries for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/subsidiaries`);
    } catch (error: any) {
      console.log('[BigCommerce] Company subsidiaries fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Attach company as subsidiary to parent
  async attachCompanyAsSubsidiary(parentCompanyId: string, childCompanyId: string) {
    try {
      console.log(`[BigCommerce] Attaching company ${childCompanyId} to parent ${parentCompanyId}...`);
      return await this.request(`/api/v3/io/companies/${childCompanyId}/parent`, {
        method: 'PUT',
        body: JSON.stringify({ parentCompanyId }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Attach subsidiary failed:', error.message);
      throw error;
    }
  }

  // Remove company from parent (make it top-level)
  async detachCompanyFromParent(companyId: string) {
    try {
      console.log(`[BigCommerce] Detaching company ${companyId} from parent...`);
      return await this.request(`/api/v3/io/companies/${companyId}/parent`, {
        method: 'DELETE',
      });
    } catch (error: any) {
      console.log('[BigCommerce] Detach subsidiary failed:', error.message);
      throw error;
    }
  }

  // ============================================
  // INVOICE PAYMENT SUPPORT
  // Per BigCommerce B2B API: Record and manage invoice payments
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis/rest-management/invoice-management
  // ============================================

  // Get payments for an invoice
  async getInvoicePayments(invoiceId: string) {
    try {
      console.log(`[BigCommerce] Fetching payments for invoice ${invoiceId}...`);
      return await this.request(`/api/v3/io/invoices/${invoiceId}/payments`);
    } catch (error: any) {
      console.log('[BigCommerce] Invoice payments fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Record a payment for an invoice
  async recordInvoicePayment(invoiceId: string, payment: {
    amount: number;
    paymentMethod: string;
    reference?: string;
    paymentDate?: string;
    notes?: string;
  }) {
    try {
      console.log(`[BigCommerce] Recording payment of ${payment.amount} for invoice ${invoiceId}...`);
      return await this.request(`/api/v3/io/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          reference: payment.reference || '',
          paymentDate: payment.paymentDate || new Date().toISOString(),
          notes: payment.notes || '',
        }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Record payment failed:', error.message);
      throw error;
    }
  }

  // Get all payments (for admin view)
  async getAllPayments(params?: { companyId?: string; status?: string; limit?: number; offset?: number }) {
    try {
      const queryParams = new URLSearchParams();
      if (params?.companyId) queryParams.append('companyId', params.companyId);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const query = queryParams.toString();
      console.log('[BigCommerce] Fetching all payments...');
      return await this.request(`/api/v3/io/payments${query ? `?${query}` : ''}`);
    } catch (error: any) {
      console.log('[BigCommerce] All payments fetch failed:', error.message);
      return { data: [] };
    }
  }

  // ============================================
  // COMPANY ROLES & PERMISSIONS
  // Per BigCommerce B2B API: Manage role-based access control
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis/rest-management/company
  // ============================================

  // Get all company roles
  async getCompanyRoles(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching roles for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/roles`);
    } catch (error: any) {
      console.log('[BigCommerce] Company roles fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Get role details
  async getCompanyRole(companyId: string, roleId: string) {
    try {
      console.log(`[BigCommerce] Fetching role ${roleId} for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/roles/${roleId}`);
    } catch (error: any) {
      console.log('[BigCommerce] Company role fetch failed:', error.message);
      return null;
    }
  }

  // Get all permissions available
  async getCompanyPermissions(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching permissions for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/permissions`);
    } catch (error: any) {
      console.log('[BigCommerce] Company permissions fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Create a new role
  async createCompanyRole(companyId: string, role: { name: string; permissions: string[] }) {
    try {
      console.log(`[BigCommerce] Creating role ${role.name} for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/roles`, {
        method: 'POST',
        body: JSON.stringify(role),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Create role failed:', error.message);
      throw error;
    }
  }

  // Update a role
  async updateCompanyRole(companyId: string, roleId: string, updates: { name?: string; permissions?: string[] }) {
    try {
      console.log(`[BigCommerce] Updating role ${roleId} for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/roles/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Update role failed:', error.message);
      throw error;
    }
  }

  // Delete a role
  async deleteCompanyRole(companyId: string, roleId: string) {
    try {
      console.log(`[BigCommerce] Deleting role ${roleId} for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/roles/${roleId}`, {
        method: 'DELETE',
      });
    } catch (error: any) {
      console.log('[BigCommerce] Delete role failed:', error.message);
      throw error;
    }
  }

  // ============================================
  // PAYMENT TERMS & METHODS
  // Per BigCommerce B2B API: Configure payment options for companies
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis/rest-management/payment
  // ============================================

  // Get all available payment methods
  async getPaymentMethods() {
    try {
      console.log('[BigCommerce] Fetching payment methods...');
      return await this.request('/api/v3/io/payment-methods');
    } catch (error: any) {
      console.log('[BigCommerce] Payment methods fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Get company-specific payment methods
  async getCompanyPaymentMethods(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching payment methods for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/payment-methods`);
    } catch (error: any) {
      console.log('[BigCommerce] Company payment methods fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Update company payment methods
  async updateCompanyPaymentMethods(companyId: string, paymentMethodIds: string[]) {
    try {
      console.log(`[BigCommerce] Updating payment methods for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/payment-methods`, {
        method: 'PUT',
        body: JSON.stringify({ paymentMethodIds }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Update company payment methods failed:', error.message);
      throw error;
    }
  }

  // Get company payment terms
  async getCompanyPaymentTerms(companyId: string) {
    try {
      console.log(`[BigCommerce] Fetching payment terms for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/payment-terms`);
    } catch (error: any) {
      console.log('[BigCommerce] Company payment terms fetch failed:', error.message);
      return { data: null };
    }
  }

  // Update company payment terms
  async updateCompanyPaymentTerms(companyId: string, terms: {
    paymentTerms?: string;
    creditLimit?: number;
    creditHold?: boolean;
  }) {
    try {
      console.log(`[BigCommerce] Updating payment terms for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/payment-terms`, {
        method: 'PUT',
        body: JSON.stringify(terms),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Update payment terms failed:', error.message);
      throw error;
    }
  }

  // ============================================
  // ORDER MANAGEMENT
  // Per BigCommerce B2B API: Order operations including reassignment
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis/rest-management/order
  // ============================================

  // Reassign order to different company
  async reassignOrder(orderId: string, targetCompanyId: string) {
    try {
      console.log(`[BigCommerce] Reassigning order ${orderId} to company ${targetCompanyId}...`);
      return await this.request(`/api/v3/io/orders/${orderId}/reassign`, {
        method: 'PUT',
        body: JSON.stringify({ companyId: targetCompanyId }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Order reassignment failed:', error.message);
      throw error;
    }
  }

  // Bulk assign orders to company
  async bulkAssignOrders(orderIds: string[], companyId: string) {
    try {
      console.log(`[BigCommerce] Bulk assigning ${orderIds.length} orders to company ${companyId}...`);
      return await this.request('/api/v3/io/orders/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          orderIds: orderIds.map(id => parseInt(id)),
        }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Bulk order assignment failed:', error.message);
      throw error;
    }
  }

  // ============================================
  // SUPER ADMIN SUPPORT
  // Per BigCommerce B2B API: Super admin can access multiple companies
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis/rest-management/super-admin
  // ============================================

  // Get super admin's assigned companies
  async getSuperAdminCompanies(superAdminId: string) {
    try {
      console.log(`[BigCommerce] Fetching companies for super admin ${superAdminId}...`);
      return await this.request(`/api/v3/io/super-admin/${superAdminId}/companies`);
    } catch (error: any) {
      console.log('[BigCommerce] Super admin companies fetch failed:', error.message);
      return { data: [] };
    }
  }

  // Begin masquerade as company (for super admins)
  async beginMasquerade(userToken: string, companyId: string) {
    try {
      console.log(`[BigCommerce] Beginning masquerade for company ${companyId}...`);
      return await this.request('/api/v2/super-admin/masquerade', {
        method: 'POST',
        body: JSON.stringify({ companyId }),
        userToken,
      });
    } catch (error: any) {
      console.log('[BigCommerce] Begin masquerade failed:', error.message);
      throw error;
    }
  }

  // End masquerade session
  async endMasquerade(userToken: string) {
    try {
      console.log('[BigCommerce] Ending masquerade session...');
      return await this.request('/api/v2/super-admin/masquerade', {
        method: 'DELETE',
        userToken,
      });
    } catch (error: any) {
      console.log('[BigCommerce] End masquerade failed:', error.message);
      throw error;
    }
  }

  // ============================================
  // RATE LIMITING SUPPORT
  // Per BigCommerce API: Handle rate limiting with proper retry logic
  // ============================================

  private async requestWithRetry(endpoint: string, options: any = {}, maxRetries: number = 3): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.request(endpoint, options);
        return result;
      } catch (error: any) {
        lastError = error;

        // Check for rate limiting (429 status)
        if (error.message?.includes('429')) {
          const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s, 8s
          console.log(`[BigCommerce] Rate limited, waiting ${backoffMs}ms before retry ${attempt + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        // Don't retry other errors
        throw error;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  // ============================================
  // BULK OPERATIONS
  // Per BigCommerce B2B API: Bulk create/update operations
  // Reference: https://developer.bigcommerce.com/b2b-edition/apis/rest-management
  // ============================================

  // Bulk create companies
  async bulkCreateCompanies(companies: any[]) {
    try {
      console.log(`[BigCommerce] Bulk creating ${companies.length} companies...`);
      return await this.request('/api/v3/io/companies/bulk', {
        method: 'POST',
        body: JSON.stringify({ companies }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Bulk create companies failed:', error.message);
      throw error;
    }
  }

  // Bulk create users
  async bulkCreateUsers(companyId: string, users: any[]) {
    try {
      console.log(`[BigCommerce] Bulk creating ${users.length} users for company ${companyId}...`);
      return await this.request(`/api/v3/io/companies/${companyId}/users/bulk`, {
        method: 'POST',
        body: JSON.stringify({ users }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Bulk create users failed:', error.message);
      throw error;
    }
  }

  // Bulk update company statuses
  async bulkUpdateCompanyStatuses(updates: { companyId: string; status: string }[]) {
    try {
      console.log(`[BigCommerce] Bulk updating ${updates.length} company statuses...`);
      return await this.request('/api/v3/io/companies/bulk-status', {
        method: 'PUT',
        body: JSON.stringify({ updates }),
      });
    } catch (error: any) {
      console.log('[BigCommerce] Bulk update company statuses failed:', error.message);
      throw error;
    }
  }
}

export const bigcommerce = new BigCommerceService();
