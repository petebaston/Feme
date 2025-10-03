import { config } from './config';

export class B2BClient {
  private baseUrl: string;
  private storeHash: string;
  private channelId: string;
  private token: string | null;

  constructor() {
    this.baseUrl = config.b2bApiUrl;
    this.storeHash = config.storeHash;
    this.channelId = config.channelId;
    this.token = localStorage.getItem('b2b_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Store-Hash': this.storeHash,
      'X-Channel-Id': this.channelId,
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`B2B API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Authentication
  async login(email: string, password: string) {
    return this.request('/api/v3/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/api/v3/logout', {
      method: 'POST',
    });
  }

  // Dashboard Stats
  async getDashboardStats() {
    return this.request('/api/v3/dashboard/stats');
  }

  // Orders
  async getOrders(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.recent) queryParams.append('recent', 'true');

    const query = queryParams.toString();
    return this.request(`/api/v3/orders${query ? `?${query}` : ''}`);
  }

  async getOrder(orderId: string) {
    return this.request(`/api/v3/orders/${orderId}`);
  }

  // Quotes
  async getQuotes(params?: { search?: string; status?: string; sortBy?: string; limit?: number; recent?: boolean }) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.recent) queryParams.append('recent', 'true');

    const query = queryParams.toString();
    return this.request(`/api/v3/quotes${query ? `?${query}` : ''}`);
  }

  async getQuote(quoteId: string) {
    return this.request(`/api/v3/quotes/${quoteId}`);
  }

  // Company
  async getCompany() {
    return this.request('/api/v3/company');
  }

  async getCompanyUsers() {
    return this.request('/api/v3/company/users');
  }

  async getCompanyAddresses() {
    return this.request('/api/v3/company/addresses');
  }
}

export const b2bClient = new B2BClient();
