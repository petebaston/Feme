# Security Fix Implementation Plan

## Overview

This document outlines the step-by-step plan to fix the critical security vulnerabilities identified in the B2B portal where users can access data from all companies instead of just their own.

---

## Phase 1: Authentication & Authorization Middleware (CRITICAL)

### Step 1.1: Create Company Authorization Middleware

**File**: `server/auth.ts`

**Add new middleware**:
```typescript
// Check if user has access to specific company data
export function requireCompanyAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Admins can access all companies
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next();
  }

  // Regular users must have a companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'No company association found' });
  }

  next();
}

// Verify resource belongs to user's company
export function verifyCompanyOwnership(resourceCompanyId?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Admins can access all resources
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      return next();
    }

    // Verify company match
    if (resourceCompanyId && resourceCompanyId !== req.user.companyId) {
      return res.status(403).json({ message: 'Access denied to this resource' });
    }

    next();
  };
}
```

---

### Step 1.2: Create Data Filtering Helper

**File**: `server/filters.ts` (new file)

```typescript
import type { AuthRequest } from './auth';

export interface FilterOptions {
  companyId?: string;
  userId?: string;
  role?: string;
}

// Filter data array by company
export function filterByCompany<T extends { companyId?: string }>(
  data: T[],
  userCompanyId?: string,
  userRole?: string
): T[] {
  // Admins see all data
  if (userRole === 'admin' || userRole === 'superadmin') {
    return data;
  }

  // Regular users only see their company's data
  if (!userCompanyId) {
    return [];
  }

  return data.filter(item => item.companyId === userCompanyId);
}

// Verify single resource ownership
export function verifyResourceOwnership<T extends { companyId?: string }>(
  resource: T | null,
  userCompanyId?: string,
  userRole?: string
): boolean {
  // Admins can access anything
  if (userRole === 'admin' || userRole === 'superadmin') {
    return true;
  }

  // Resource must exist
  if (!resource) {
    return false;
  }

  // Must have company association
  if (!userCompanyId || !resource.companyId) {
    return false;
  }

  // Company IDs must match
  return resource.companyId === userCompanyId;
}

// Extract filter options from authenticated request
export function getFilterOptions(req: AuthRequest): FilterOptions {
  return {
    companyId: req.user?.companyId,
    userId: req.user?.userId,
    role: req.user?.role,
  };
}
```

---

## Phase 2: Update API Routes (CRITICAL)

### Step 2.1: Update Orders Endpoint

**File**: `server/routes.ts`

**BEFORE** (VULNERABLE):
```typescript
app.get("/api/orders", async (req, res) => {
  const userToken = getUserToken(req);
  const response = await bigcommerce.getOrders(userToken, ...);
  res.json(response?.data?.list || []);
});
```

**AFTER** (SECURE):
```typescript
import { filterByCompany, getFilterOptions } from './filters';

app.get("/api/orders",
  authenticateToken,      // ✅ Verify JWT
  sessionTimeout,         // ✅ Check session
  requireCompanyAccess,   // ✅ Verify company access
  async (req: AuthRequest, res) => {
    try {
      const userToken = getUserToken(req);
      const { search, status, sortBy, limit, recent } = req.query;

      // Get data from BigCommerce
      const response = await bigcommerce.getOrders(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });

      // Extract orders
      const orders = response?.data?.list || response?.data || [];

      // ✅ CRITICAL: Filter by company
      const filteredOrders = filterByCompany(
        orders,
        req.user?.companyId,
        req.user?.role
      );

      // Transform to frontend format
      const transformedOrders = filteredOrders.map(transformOrder);

      res.json(transformedOrders);
    } catch (error) {
      console.error("Orders fetch error:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  }
);
```

---

### Step 2.2: Update Single Order Endpoint

**File**: `server/routes.ts`

```typescript
app.get("/api/orders/:id",
  authenticateToken,
  sessionTimeout,
  requireCompanyAccess,
  async (req: AuthRequest, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getOrder(userToken, req.params.id);
      const order = response?.data;

      // ✅ Verify ownership
      if (!verifyResourceOwnership(order, req.user?.companyId, req.user?.role)) {
        return res.status(403).json({ message: 'Access denied to this order' });
      }

      res.json(transformOrder(order));
    } catch (error) {
      console.error("Order fetch error:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  }
);
```

---

### Step 2.3: Update Invoices Endpoints

**File**: `server/routes.ts`

**List all invoices**:
```typescript
app.get("/api/invoices",
  authenticateToken,
  sessionTimeout,
  requireCompanyAccess,
  async (req: AuthRequest, res) => {
    try {
      const userToken = getUserToken(req);
      const { search, status, sortBy, limit, recent } = req.query;

      const response = await bigcommerce.getInvoices(userToken, {
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        recent: recent === 'true',
      });

      const invoices = response?.data?.list || response?.data || [];

      // ✅ Filter by company
      const filteredInvoices = filterByCompany(
        invoices,
        req.user?.companyId,
        req.user?.role
      );

      res.json(filteredInvoices);
    } catch (error) {
      console.error("Invoices fetch error:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  }
);
```

**Single invoice**:
```typescript
app.get("/api/invoices/:id",
  authenticateToken,
  sessionTimeout,
  requireCompanyAccess,
  async (req: AuthRequest, res) => {
    try {
      const userToken = getUserToken(req);
      const response = await bigcommerce.getInvoice(userToken, req.params.id);
      const invoice = response?.data;

      // ✅ Verify ownership
      if (!verifyResourceOwnership(invoice, req.user?.companyId, req.user?.role)) {
        return res.status(403).json({ message: 'Access denied to this invoice' });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Invoice fetch error:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  }
);
```

---

### Step 2.4: Update All Other Data Endpoints

Apply the same pattern to:
- ✅ `/api/quotes` - Quotes list and detail
- ✅ `/api/shopping-lists` - Shopping lists
- ✅ `/api/addresses` - Address list and detail
- ✅ `/api/dashboard/stats` - Dashboard statistics
- ✅ `/api/products` - Product catalog (if company-specific)
- ✅ `/api/company` - Company information
- ✅ `/api/users` - User management (admin only)

**Pattern to follow**:
```typescript
app.get("/api/{resource}",
  authenticateToken,      // Always verify JWT
  sessionTimeout,         // Always check session
  requireCompanyAccess,   // Always verify company
  async (req: AuthRequest, res) => {
    // 1. Fetch data
    const data = await fetch...();

    // 2. Filter by company
    const filtered = filterByCompany(data, req.user?.companyId, req.user?.role);

    // 3. Return filtered data
    res.json(filtered);
  }
);
```

---

## Phase 3: Update BigCommerce Service (HIGH)

### Step 3.1: Store User Tokens Server-Side

**File**: `server/storage.ts`

**Add token storage**:
```typescript
// Store BigCommerce user tokens
private userTokens = new Map<string, {
  userId: string;
  bcToken: string;
  companyId?: string;
  expiresAt: Date;
}>();

async storeUserToken(userId: string, bcToken: string, companyId?: string) {
  this.userTokens.set(userId, {
    userId,
    bcToken,
    companyId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });
}

async getUserToken(userId: string): Promise<string | null> {
  const tokenData = this.userTokens.get(userId);

  if (!tokenData) {
    return null;
  }

  // Check if expired
  if (new Date() > tokenData.expiresAt) {
    this.userTokens.delete(userId);
    return null;
  }

  return tokenData.bcToken;
}

async clearUserToken(userId: string) {
  this.userTokens.delete(userId);
}
```

---

### Step 3.2: Update Login Flow

**File**: `server/routes.ts`

**Update login endpoint**:
```typescript
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Login to BigCommerce
    const result = await bigcommerce.login(email, password);

    // Get/create user
    let user = await storage.getUserByEmail(email);
    if (!user) {
      user = await storage.createUser({
        email,
        password: await bcrypt.hash(password, 10),
        name: email.split('@')[0],
        role: 'buyer',
      });
    }

    // ✅ Store BigCommerce token server-side
    await storage.storeUserToken(user.id, result.token, user.companyId);

    // Generate JWT with company ID
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      companyId: user.companyId || undefined,
      role: user.role || 'buyer',
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Track session
    trackSession(user.id, accessToken);

    // Return only JWT to frontend
    res.json({
      accessToken,
      refreshToken: rememberMe ? undefined : refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
      // ❌ Don't send BigCommerce token to frontend anymore
    });
  } catch (error: any) {
    console.error("[Login] Login failed:", error.message);
    res.status(401).json({ message: "Invalid credentials" });
  }
});
```

---

### Step 3.3: Update getUserToken Helper

**File**: `server/routes.ts`

**BEFORE**:
```typescript
function getUserToken(req: any): string {
  const authHeader = req.headers.authorization;
  return authHeader?.replace('Bearer ', '') || '';
}
```

**AFTER**:
```typescript
async function getBigCommerceToken(req: AuthRequest): Promise<string | null> {
  if (!req.user) {
    return null;
  }

  // Retrieve stored BigCommerce token
  const bcToken = await storage.getUserToken(req.user.userId);

  if (!bcToken) {
    throw new Error('BigCommerce token not found for user');
  }

  return bcToken;
}
```

---

## Phase 4: Update Frontend (MEDIUM)

### Step 4.1: Remove BigCommerce Token from Frontend

**File**: `client/src/lib/b2b-client.ts`

**Update to only use JWT**:
```typescript
// Store only JWT access token
export function setAuthToken(token: string) {
  localStorage.setItem('b2b_token', token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem('b2b_token');
}

// All API calls use JWT
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expired - logout
    logout();
    window.location.href = '/login';
  }

  if (response.status === 403) {
    throw new Error('Access denied');
  }

  return response;
}
```

---

## Phase 5: Testing & Validation (CRITICAL)

### Test Plan

#### Test 1: Multi-Tenant Isolation

```bash
# Setup
1. Create User A (company: CompanyX)
2. Create User B (company: CompanyY)
3. Create orders for both companies

# Test
1. Login as User A
2. GET /api/orders
3. Verify: Only CompanyX orders returned
4. Try: GET /api/orders/{CompanyY_order_id}
5. Expect: 403 Forbidden

# Repeat for User B
```

#### Test 2: Authentication Required

```bash
# Test without token
curl http://localhost:5000/api/orders
# Expect: 401 Unauthorized

# Test with invalid token
curl -H "Authorization: Bearer invalid_token" http://localhost:5000/api/orders
# Expect: 403 Forbidden
```

#### Test 3: Admin Access

```bash
# Setup
1. Create Admin user
2. Login as Admin
3. GET /api/orders
4. Verify: All companies' orders returned
```

#### Test 4: Resource Ownership

```bash
# Test accessing specific resource
1. Login as User A (CompanyX)
2. GET /api/orders/{CompanyY_order_id}
3. Expect: 403 Forbidden

4. GET /api/orders/{CompanyX_order_id}
5. Expect: 200 OK with order data
```

---

## Phase 6: Deployment (HIGH)

### Deployment Steps

1. **Code Review**
   - Peer review all security changes
   - Security team review

2. **Staging Deployment**
   - Deploy to staging environment
   - Run full test suite
   - Manual security testing
   - Penetration testing

3. **Database Migration**
   - Ensure all users have companyId set
   - Update any missing company associations

4. **Production Deployment**
   - Deploy during low-traffic window
   - Monitor error logs
   - Verify no 403 errors for legitimate users
   - Monitor API response times

5. **Post-Deployment Validation**
   - Test with real user accounts
   - Verify multi-tenant isolation
   - Check admin access works
   - Monitor for 24 hours

---

## Implementation Checklist

### Critical (Do First)
- [ ] Create `requireCompanyAccess` middleware
- [ ] Create `filters.ts` with filtering functions
- [ ] Update `/api/orders` endpoint
- [ ] Update `/api/invoices` endpoint
- [ ] Test multi-tenant isolation

### High Priority
- [ ] Update all remaining data endpoints
- [ ] Implement server-side token storage
- [ ] Update login flow
- [ ] Update frontend API client
- [ ] Add resource ownership checks

### Medium Priority
- [ ] Add role-based access control
- [ ] Implement audit logging
- [ ] Add rate limiting
- [ ] Update documentation

### Testing
- [ ] Write unit tests for middleware
- [ ] Write integration tests for endpoints
- [ ] Manual testing with multiple companies
- [ ] Security penetration testing
- [ ] Load testing

---

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate**: Revert to previous version
2. **Short-term**: Fix specific issues
3. **Long-term**: Address root cause

**Rollback Command**:
```bash
git revert <commit-hash>
git push origin main
# Redeploy previous version
```

---

## Success Criteria

✅ Security fixes are complete when:

1. All data endpoints require authentication
2. All data is filtered by company ID
3. Users cannot access other companies' data
4. Admins can access all data
5. All tests pass
6. No security vulnerabilities remain
7. Performance is acceptable

---

**Plan Created**: October 22, 2025
**Priority**: CRITICAL
**Estimated Effort**: 2-3 days
**Risk Level**: High (requires careful testing)
