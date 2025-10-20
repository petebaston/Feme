// Best Practice: In-memory cache with TTL and proper invalidation

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class Cache {
  private store: Map<string, CacheEntry<any>>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
    this.store = new Map();
    this.defaultTTL = defaultTTL;

    // Best Practice: Periodic cleanup of expired entries
    setInterval(() => this.cleanup(), 60 * 1000); // Every minute
  }

  // Best Practice: Generic get with type safety
  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Best Practice: Generic set with optional TTL
  set<T>(key: string, data: T, ttl?: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  // Best Practice: Pattern-based invalidation
  invalidate(pattern: string | RegExp): void {
    const keys = Array.from(this.store.keys());

    if (typeof pattern === 'string') {
      // Exact match or prefix
      keys.forEach(key => {
        if (key === pattern || key.startsWith(pattern)) {
          this.store.delete(key);
        }
      });
    } else {
      // Regex match
      keys.forEach(key => {
        if (pattern.test(key)) {
          this.store.delete(key);
        }
      });
    }
  }

  // Best Practice: Clear all cache
  clear(): void {
    this.store.clear();
  }

  // Best Practice: Get cache statistics
  getStats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }

  // Best Practice: Remove expired entries
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.store.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.store.delete(key));
  }

  // Best Practice: Memoization wrapper
  async memoize<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }
}

// Best Practice: Export singleton instance
export const cache = new Cache();

// Best Practice: Cache key builders for consistency
export const cacheKeys = {
  user: (id: string) => `user:${id}`,
  users: (companyId: string) => `users:company:${companyId}`,
  company: (id: string) => `company:${id}`,
  orders: (userId: string) => `orders:user:${userId}`,
  order: (id: string) => `order:${id}`,
  addresses: (companyId: string) => `addresses:company:${companyId}`,
  cart: (userId: string) => `cart:user:${userId}`,
  products: (params: string) => `products:${params}`,
};
