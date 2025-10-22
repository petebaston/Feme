# Master TODO List - B2B Portal Complete Overhaul

## Overview

This document consolidates ALL work items from:
1. Security breach cleanup
2. Multi-tenant security vulnerabilities
3. BigCommerce B2B Edition API conformance
4. Design redesign (completed)

---

## 🔴 IMMEDIATE ACTIONS (TODAY)

### 1. Rotate Compromised Credentials

**Priority**: CRITICAL
**Time**: 1-2 hours
**Reference**: `SECURITY_BREACH_RESPONSE.md`

- [ ] **PostgreSQL (Neon)**: https://console.neon.tech/
  - Reset password for `neondb_owner`
  - Update `DATABASE_URL` in new `.env` file (locally only!)

- [ ] **BigCommerce API**:
  - Log into BigCommerce admin
  - Go to Advanced Settings > API Accounts
  - Delete compromised API account
  - Create new API account with B2B Edition scope
  - Update credentials in `.env`

- [ ] **Session Secret**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
  ```
  - Update `SESSION_SECRET` in `.env`

- [ ] **B2B JWT Token**:
  - Regenerate in BigCommerce B2B settings
  - Update `BIGCOMMERCE_B2B_MANAGEMENT_TOKEN` in `.env`

- [ ] **Create New .env File**:
  - Copy from `.env.example`
  - Fill in rotated credentials
  - NEVER commit this file

---

## 🔴 PHASE 1: CRITICAL SECURITY FIXES (Week 1)

### 1.1 Authentication Architecture Overhaul

**Priority**: CRITICAL
**Time**: 3-4 days
**Reference**: `BIGCOMMERCE_B2B_CONFORMANCE.md` + `SECURITY_FIX_PLAN.md`

**Current State**: ❌ Broken
- Mixing token types
- No server-side token storage
- Wrong authentication pattern

**Target State**: ✅ BigCommerce Compliant
- Two-token system (storefront + server-to-server)
- Tokens stored server-side
- Internal JWT for frontend

#### Tasks:

- [ ] **Server-Side Token Storage** (Day 1)
  - [ ] Update `server/storage.ts`:
    - Add `userTokens` Map for BigCommerce tokens
    - Add `storeUserToken(userId, bcToken, companyId)` method
    - Add `getUserToken(userId)` method
    - Add `clearUserToken(userId)` method
  - [ ] Test token storage/retrieval

- [ ] **GraphQL Login Implementation** (Day 1-2)
  - [ ] Install GraphQL client: `npm install @apollo/client graphql`
  - [ ] Create `server/graphql-client.ts`:
    ```typescript
    import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

    const client = new ApolloClient({
      link: new HttpLink({
        uri: 'https://api-b2b.bigcommerce.com/graphql',
      }),
      cache: new InMemoryCache(),
    });
    ```
  - [ ] Update `server/routes.ts` login endpoint:
    - Use GraphQL `login` mutation
    - Store returned `authToken` server-side
    - Extract `companyId` from user data
    - Generate internal JWT with `userId`, `companyId`, `role`
    - Return only internal JWT to frontend
  - [ ] Test login flow

- [ ] **Token Retrieval Helper** (Day 2)
  - [ ] Update `server/routes.ts`:
    - Replace `getUserToken()` with `getBigCommerceToken(req)`
    - Retrieve stored token from database using `req.user.userId`
    - Throw error if token not found/expired
  - [ ] Test token retrieval

- [ ] **Frontend Updates** (Day 2-3)
  - [ ] Update `client/src/lib/b2b-client.ts`:
    - Store only our JWT (not BigCommerce token)
    - Use JWT in all API calls
    - Handle 401 (logout and redirect)
    - Handle 403 (show access denied message)
  - [ ] Update login page to handle new response format
  - [ ] Remove BigCommerce token from localStorage
  - [ ] Test frontend API calls

- [ ] **Token Refresh** (Day 3)
  - [ ] Create token refresh endpoint
  - [ ] Check token expiration (1-day)
  - [ ] Auto-refresh before expiry
  - [ ] Handle refresh failures

- [ ] **Testing** (Day 3-4)
  - [ ] Test login with valid credentials
  - [ ] Test login with invalid credentials
  - [ ] Test token expiration
  - [ ] Test token refresh
  - [ ] Test logout

---

### 1.2 Multi-Tenant Data Isolation

**Priority**: CRITICAL
**Time**: 2-3 days
**Reference**: `SECURITY_AUDIT.md` + `SECURITY_FIX_PLAN.md`

**Current State**: ❌ Users can see ALL companies' data
**Target State**: ✅ Users see only their company's data

#### Tasks:

- [ ] **Create Authorization Middleware** (Day 1)
  - [ ] Update `server/auth.ts`:
    ```typescript
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
    ```
  - [ ] Test middleware

- [ ] **Create Data Filtering Helpers** (Day 1)
  - [ ] Create `server/filters.ts`:
    ```typescript
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
      if (!userCompanyId) return [];

      return data.filter(item => item.companyId === userCompanyId);
    }

    export function verifyResourceOwnership<T extends { companyId?: string }>(
      resource: T | null,
      userCompanyId?: string,
      userRole?: string
    ): boolean {
      if (userRole === 'admin' || userRole === 'superadmin') return true;
      if (!resource || !userCompanyId || !resource.companyId) return false;
      return resource.companyId === userCompanyId;
    }
    ```
  - [ ] Test filtering functions

- [ ] **Update Orders Endpoint** (Day 2)
  - [ ] Add middleware: `authenticateToken, sessionTimeout, requireCompanyAccess`
  - [ ] Filter orders by `companyId`:
    ```typescript
    const orders = await bigcommerce.getOrders(...);
    const filtered = filterByCompany(orders, req.user?.companyId, req.user?.role);
    ```
  - [ ] Test: User A cannot see User B's orders

- [ ] **Update Single Order Endpoint** (Day 2)
  - [ ] Add middleware
  - [ ] Verify ownership:
    ```typescript
    if (!verifyResourceOwnership(order, req.user?.companyId, req.user?.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    ```
  - [ ] Test: User A cannot access User B's order by ID

- [ ] **Update Invoices Endpoints** (Day 2)
  - [ ] Add middleware to list endpoint
  - [ ] Filter by companyId
  - [ ] Add middleware to detail endpoint
  - [ ] Verify ownership
  - [ ] Test cross-company access prevention

- [ ] **Update All Other Endpoints** (Day 3)
  - [ ] Quotes: Add middleware + filtering
  - [ ] Shopping Lists: Add middleware + filtering
  - [ ] Addresses: Add middleware + filtering
  - [ ] Dashboard stats: Filter by company
  - [ ] Company info: Verify user's company only
  - [ ] Users: Admin only + company filtering

- [ ] **Security Testing** (Day 3)
  - [ ] Create User A (Company X)
  - [ ] Create User B (Company Y)
  - [ ] Test: User A cannot see User B's data
  - [ ] Test: User A cannot access User B's resources by ID
  - [ ] Test: Admin can see all data
  - [ ] Document test results

---

## 🟠 PHASE 2: BIGCOMMERCE API CONFORMANCE (Week 2-3)

### 2.1 GraphQL Storefront API Migration

**Priority**: HIGH
**Time**: 5-7 days
**Reference**: `BIGCOMMERCE_B2B_CONFORMANCE.md`

**Current State**: Using legacy REST Storefront API
**Target State**: Using GraphQL Storefront API (BigCommerce recommended)

#### Tasks:

- [ ] **Setup GraphQL Client** (Day 1)
  - [ ] Install dependencies: `npm install @apollo/client graphql`
  - [ ] Create `client/src/lib/graphql-client.ts`
  - [ ] Configure Apollo Client
  - [ ] Add authentication link for bearer tokens
  - [ ] Test connection to `https://api-b2b.bigcommerce.com/graphql`

- [ ] **Generate TypeScript Types** (Day 1)
  - [ ] Install: `npm install -D @graphql-codegen/cli @graphql-codegen/typescript`
  - [ ] Configure codegen
  - [ ] Generate types from GraphQL schema
  - [ ] Add to build process

- [ ] **Implement Authentication Queries** (Day 2)
  - [ ] Create `client/src/graphql/mutations/auth.ts`:
    - `CustomerLogin` mutation
    - `Authorization` mutation
  - [ ] Update login page to use GraphQL
  - [ ] Test login flow

- [ ] **Implement Order Queries** (Day 3-4)
  - [ ] Create `client/src/graphql/queries/orders.ts`:
    - `GetAllOrders` query with pagination
    - `GetOrder` query
  - [ ] Update orders page to use GraphQL
  - [ ] Implement cursor-based pagination
  - [ ] Test order fetching

- [ ] **Implement Invoice Queries** (Day 4-5)
  - [ ] Create `client/src/graphql/queries/invoices.ts`:
    - `GetInvoices` query
    - `GetInvoice` query
  - [ ] Update invoices page to use GraphQL
  - [ ] Test invoice fetching

- [ ] **Implement Quote Queries** (Day 5-6)
  - [ ] Create `client/src/graphql/queries/quotes.ts`:
    - `GetQuotes` query
    - `GetQuote` query
  - [ ] Update quotes page to use GraphQL
  - [ ] Test quote fetching

- [ ] **Implement Company Queries** (Day 6)
  - [ ] Create `client/src/graphql/queries/company.ts`:
    - `GetCompany` query
    - `GetCompanyUsers` query
  - [ ] Update company page to use GraphQL
  - [ ] Test company data fetching

- [ ] **Implement Shopping List Queries** (Day 7)
  - [ ] Create `client/src/graphql/queries/shopping-lists.ts`
  - [ ] Update shopping lists page to use GraphQL
  - [ ] Test shopping list operations

- [ ] **Remove Legacy REST Calls** (Day 7)
  - [ ] Remove all calls to `/api/v2/`
  - [ ] Update `server/bigcommerce.ts` to use GraphQL where appropriate
  - [ ] Test all pages still work

---

### 2.2 REST Management V3 Implementation

**Priority**: HIGH
**Time**: 3-4 days
**Reference**: `BIGCOMMERCE_B2B_CONFORMANCE.md`

**Current State**: Inconsistent API usage
**Target State**: Proper REST Management V3 for backend operations

#### Tasks:

- [ ] **Update Authentication Headers** (Day 1)
  - [ ] Update `server/bigcommerce.ts`:
    - Use `X-Auth-Token` header (not `Authorization`)
    - Use `X-Store-Hash` header
    - Use correct base URL: `https://api-b2b.bigcommerce.com/api/v3/io/`
  - [ ] Test server-to-server authentication

- [ ] **Implement Company Management** (Day 2)
  - [ ] Create `server/endpoints/companies.ts`:
    - `GET /api/v3/io/companies` - List companies
    - `POST /api/v3/io/companies` - Create company
    - `GET /api/v3/io/companies/{id}` - Get company
    - `PUT /api/v3/io/companies/{id}` - Update company
    - `DELETE /api/v3/io/companies/{id}` - Delete company
    - `GET /api/v3/io/companies/{id}/hierarchy` - Get hierarchy
  - [ ] Add to server routes
  - [ ] Test company operations

- [ ] **Implement User Management** (Day 2-3)
  - [ ] Create `server/endpoints/users.ts`:
    - `GET /api/v3/io/companies/{companyId}/users` - List users
    - `POST /api/v3/io/companies/{companyId}/users` - Create user
    - `GET /api/v3/io/users/{userId}` - Get user
    - `PUT /api/v3/io/users/{userId}` - Update user
    - `DELETE /api/v3/io/users/{userId}` - Delete user
  - [ ] Add to server routes
  - [ ] Test user operations

- [ ] **Implement Order Management** (Day 3)
  - [ ] Update `server/endpoints/orders.ts`:
    - Use Management V3 endpoints
    - Add bulk assignment endpoint
    - Add reassignment endpoint
  - [ ] Test order operations

- [ ] **Implement Invoice Management** (Day 4)
  - [ ] Create `server/endpoints/invoices.ts`:
    - Management V3 invoice endpoints
    - Payment recording
    - PDF generation
  - [ ] Test invoice operations

- [ ] **Update Frontend API Calls** (Day 4)
  - [ ] Update all admin pages to use new endpoints
  - [ ] Test admin functionality

---

## 🟡 PHASE 3: ADVANCED FEATURES (Week 4)

### 3.1 Company Hierarchy Support

**Priority**: MEDIUM
**Time**: 2-3 days

#### Tasks:

- [ ] **Fetch Hierarchy Data** (Day 1)
  - [ ] Call hierarchy API endpoints
  - [ ] Store hierarchy in context/state
  - [ ] Build hierarchy tree structure

- [ ] **Company Switcher** (Day 2)
  - [ ] Create company switcher component
  - [ ] Allow switching between parent/subsidiaries
  - [ ] Update data filtering based on hierarchy

- [ ] **Parent-Subsidiary Access** (Day 2-3)
  - [ ] Parent admins can see subsidiary data
  - [ ] Implement cascade filtering
  - [ ] Test hierarchy permissions

---

### 3.2 Extra Fields Configuration

**Priority**: MEDIUM
**Time**: 1-2 days

#### Tasks:

- [ ] **Fetch Field Configs** (Day 1)
  - [ ] Call extra field config endpoints
  - [ ] Store configurations
  - [ ] Validate against configs

- [ ] **Dynamic Form Generation** (Day 2)
  - [ ] Generate forms from configs
  - [ ] Validate field values
  - [ ] Save extra field data

---

### 3.3 Rate Limiting & Error Handling

**Priority**: MEDIUM
**Time**: 2 days

#### Tasks:

- [ ] **Rate Limit Monitoring** (Day 1)
  - [ ] Track `X-Requests-Remaining` header
  - [ ] Track `X-Request-Window-Resets-After` header
  - [ ] Warn when approaching limit
  - [ ] Implement backoff strategy

- [ ] **Comprehensive Error Handling** (Day 2)
  - [ ] Handle all HTTP status codes
  - [ ] Handle GraphQL errors
  - [ ] User-friendly error messages
  - [ ] Retry logic with exponential backoff

---

## 🟢 PHASE 4: TESTING & POLISH (Week 5)

### 4.1 Security Testing

**Priority**: HIGH
**Time**: 2-3 days

#### Tasks:

- [ ] **Multi-Tenant Tests**
  - [ ] Test cross-company access (should fail)
  - [ ] Test resource ownership
  - [ ] Test role-based access
  - [ ] Test company hierarchy access

- [ ] **Authentication Tests**
  - [ ] Test without token (401)
  - [ ] Test with invalid token (403)
  - [ ] Test with expired token (refresh)
  - [ ] Test logout

- [ ] **Authorization Tests**
  - [ ] Test admin access
  - [ ] Test buyer access
  - [ ] Test super admin access

---

### 4.2 Integration Testing

**Priority**: MEDIUM
**Time**: 2 days

#### Tasks:

- [ ] **GraphQL Tests**
  - [ ] Test all queries
  - [ ] Test pagination
  - [ ] Test error scenarios

- [ ] **REST Management Tests**
  - [ ] Test all endpoints
  - [ ] Test CRUD operations
  - [ ] Test bulk operations

- [ ] **End-to-End Tests**
  - [ ] Test complete user flows
  - [ ] Test admin workflows
  - [ ] Test error recovery

---

### 4.3 Documentation

**Priority**: MEDIUM
**Time**: 1-2 days

#### Tasks:

- [ ] **API Documentation**
  - [ ] Document all endpoints
  - [ ] Document authentication
  - [ ] Document error codes

- [ ] **Architecture Documentation**
  - [ ] Create architecture diagrams
  - [ ] Document data flow
  - [ ] Document security model

- [ ] **Deployment Guide**
  - [ ] Step-by-step deployment
  - [ ] Environment variables
  - [ ] Troubleshooting guide

---

### 4.4 Monitoring & Logging

**Priority**: LOW
**Time**: 1 day

#### Tasks:

- [ ] **Logging Improvements**
  - [ ] Structure logs with context
  - [ ] Add request IDs
  - [ ] Log security events

- [ ] **Error Tracking**
  - [ ] Set up error tracking service
  - [ ] Alert on critical errors
  - [ ] Dashboard for monitoring

- [ ] **Performance Monitoring**
  - [ ] Track API response times
  - [ ] Monitor database queries
  - [ ] Set up alerts

---

## 📊 Progress Tracking

### Overall Status

- **Design Redesign**: ✅ 100% Complete
- **Security Breach Cleanup**: ⚠️ Pending credential rotation
- **Multi-Tenant Security**: ❌ 0% Complete (critical)
- **BigCommerce Conformance**: ❌ 10% Complete
- **Testing**: ❌ 0% Complete

### Time Estimates

- **Phase 1 (CRITICAL)**: 5-7 days
- **Phase 2 (HIGH)**: 8-11 days
- **Phase 3 (MEDIUM)**: 5-7 days
- **Phase 4 (POLISH)**: 5-6 days

**Total**: 23-31 days (4-6 weeks)

---

## 📖 Reference Documents

1. **SECURITY_BREACH_RESPONSE.md** - Credential rotation guide
2. **SECURITY_AUDIT.md** - Multi-tenant vulnerabilities
3. **SECURITY_FIX_PLAN.md** - Security implementation plan
4. **BIGCOMMERCE_B2B_CONFORMANCE.md** - API conformance guide
5. **DESIGN_SYSTEM.md** - Design specifications
6. **REDESIGN_SUMMARY.md** - Design implementation details
7. **README_SECURITY_AND_REDESIGN.md** - Overview document
8. **MASTER_TODO_LIST.md** - This document

---

## 🎯 Success Criteria

✅ **Project Complete When**:

1. All credentials rotated and secure
2. Multi-tenant security implemented and tested
3. 100% BigCommerce API conformance achieved
4. GraphQL Storefront API in use for all buyer portal operations
5. REST Management V3 properly implemented for backend
6. All security tests passing
7. All integration tests passing
8. Documentation complete
9. Monitoring and logging in place
10. Client approval received

---

**Document Created**: October 22, 2025
**Status**: Ready for Implementation
**Total Effort**: 4-6 weeks
**Priority**: CRITICAL
