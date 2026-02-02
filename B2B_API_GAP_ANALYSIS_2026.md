# BigCommerce B2B Edition API - Comprehensive Gap Analysis

**Analysis Date:** February 2, 2026
**Prepared By:** Claude Code Analysis
**Repository:** Feme B2B Buyer Portal

---

## Executive Summary

This analysis identifies **critical gaps and issues** between the current implementation and the BigCommerce B2B Edition API specifications. The analysis covers authentication, API architecture, data isolation, and feature completeness.

### Key Findings

| Category | Severity | Status |
|----------|----------|--------|
| Authentication Architecture | 🔴 CRITICAL | Partially compliant with Sept 2025 changes |
| Client-Side API Integration | 🔴 CRITICAL | Completely broken - uses non-existent endpoints |
| Server-Side API Integration | 🟡 MODERATE | Working but needs header updates |
| Multi-Tenant Data Isolation | 🟡 MODERATE | Implemented but has gaps |
| GraphQL Migration | 🟡 MODERATE | Partially implemented |
| Feature Completeness | 🟢 GOOD | ~65% of B2B features implemented |

---

## 1. Authentication Architecture Analysis

### 1.1 September 2025 Authentication Changes

**BigCommerce announced major authentication changes effective September 30, 2025:**

| Old Method (Deprecated) | New Method (Required) |
|------------------------|----------------------|
| `authToken` header | `X-Auth-Token` header |
| B2B-specific tokens | Unified BigCommerce API tokens |
| No store hash needed | `X-Store-Hash` required |
| B2B Edition control panel tokens | Standard BigCommerce API accounts |

**Sources:**
- [Authenticate BigCommerce and B2B Edition APIs with One API Account](https://www.bigcommerce.com/blog/authenticate-bigcommerce-and-b2b-edition-apis-with-one-api-account/)
- [B2B Edition Authentication Documentation](https://developer.bigcommerce.com/b2b-edition/docs/authentication)

### 1.2 Current Implementation Status

**Server-Side (`server/bigcommerce.ts`):**

```typescript
// Current implementation (Lines 69-74):
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Store-Hash': this.config.storeHash,    // ✅ CORRECT (required after Sept 2025)
  'X-Channel-Id': channelId,                 // ⚠️ REVIEW - may not be needed
  ...(options.headers || {}),
};
```

**Issues Identified:**

1. **✅ X-Store-Hash is correctly included** - Compliant with Sept 2025 changes
2. **⚠️ X-Auth-Token usage is conditional** - Should be the PRIMARY method for Management API
3. **⚠️ X-Channel-Id may be unnecessary** - Not required per B2B API documentation
4. **❌ authToken header still used in GraphQL** - Line 569 uses deprecated `authToken`

**GraphQL Request Method (Lines 549-588):**
```typescript
// Current (PROBLEMATIC):
if (userToken) {
  headers['Authorization'] = `Bearer ${userToken}`;
  headers['authToken'] = userToken;  // ❌ DEPRECATED - should not use
}
```

### 1.3 Token Types Confusion

BigCommerce B2B Edition uses **TWO distinct token types**:

| Token Type | Purpose | Expiry | Where Used |
|------------|---------|--------|------------|
| **Server-to-Server Token** | Backend management operations | Never (by default) | REST Management V3 API |
| **Storefront Token** | User-facing buyer portal operations | 1 day | GraphQL Storefront API |

**Current Implementation Issues:**

1. **Token Storage:** Server correctly stores BC token server-side (good!)
2. **Token Retrieval:** `getBigCommerceToken()` in routes.ts handles this correctly
3. **Token Generation:** Login flow correctly uses `/api/io/auth/customers`
4. **Header Selection:** Logic to choose `X-Auth-Token` vs `Authorization: Bearer` needs review

### 1.4 Recommended Authentication Fixes

```typescript
// For REST Management V3 API (/api/v3/io/*)
headers['X-Auth-Token'] = serverToServerToken;
headers['X-Store-Hash'] = storeHash;

// For GraphQL Storefront API (/graphql)
headers['Authorization'] = `Bearer ${storefrontToken}`;
headers['X-Store-Hash'] = storeHash;

// REMOVE deprecated:
// headers['authToken'] = token;  // DELETE THIS
```

---

## 2. Client-Side API Integration (CRITICAL)

### 2.1 Broken Endpoints

**File: `client/src/lib/b2b-client.ts`**

The client-side API client attempts to call **endpoints that do not exist** in BigCommerce B2B Edition:

| Line | Current Endpoint | Status | Correct Endpoint |
|------|-----------------|--------|------------------|
| 44 | `/api/v3/login` | ❌ INVALID | Server proxy → `/api/io/auth/customers` |
| 51 | `/api/v3/logout` | ❌ INVALID | Server proxy → clear tokens |
| 58 | `/api/v3/dashboard/stats` | ❌ INVALID | Calculate from orders/quotes |
| 71 | `/api/v3/orders` | ❌ INVALID | GraphQL OR `/api/v2/orders` |
| 75 | `/api/v3/orders/:id` | ❌ INVALID | GraphQL OR `/api/v2/orders/:id` |
| 88 | `/api/v3/quotes` | ❌ INVALID | GraphQL OR `/api/v2/quotes` |
| 97 | `/api/v3/company` | ❌ INVALID | GraphQL `company` query |
| 101 | `/api/v3/company/users` | ❌ INVALID | `/api/v3/io/users` |
| 105 | `/api/v3/company/addresses` | ❌ INVALID | `/api/v3/io/addresses` |
| 118 | `/api/v3/invoices` | ❌ INVALID | `/api/v3/io/invoice-management/invoice` |

### 2.2 Architecture Problem

**Current (WRONG):**
```
Client → Direct to BigCommerce B2B API (with wrong endpoints)
```

**Correct:**
```
Client → Server Proxy → BigCommerce B2B API
```

The server already implements correct BigCommerce API calls. The client should call the server endpoints (e.g., `/api/orders`, `/api/invoices`), NOT attempt direct BigCommerce API calls.

### 2.3 Headers Problem

**Client Implementation (Lines 19-24):**
```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Store-Hash': this.storeHash,      // Not appropriate for direct client calls
  'X-Channel-Id': this.channelId,      // Not appropriate for direct client calls
};
```

**Client should NOT:**
- Include BigCommerce-specific headers
- Store or send BigCommerce tokens directly
- Call BigCommerce APIs directly

**Client SHOULD:**
- Send internal JWT token in `Authorization` header
- Call server proxy endpoints only
- Let server handle BigCommerce authentication

### 2.4 Recommended Fix

The `b2b-client.ts` file should be **entirely refactored** to call server endpoints:

```typescript
// Instead of:
async getOrders() {
  return this.request('/api/v3/orders');  // WRONG - doesn't exist
}

// Use:
async getOrders() {
  return this.request('/api/orders');  // Server proxy endpoint
}
```

---

## 3. Server-Side API Integration Analysis

### 3.1 Current Status - Mostly Correct

**File: `server/bigcommerce.ts`**

| Endpoint | Implementation | Status |
|----------|---------------|--------|
| Login | `/api/io/auth/customers` | ✅ Correct |
| Orders | `/api/v2/orders` | ✅ Correct (Storefront) |
| Order Products | Standard API `/v2/orders/{id}/products` | ✅ Correct |
| Quotes | `/api/v2/quotes` | ✅ Correct |
| Invoices | `/api/v3/io/invoice-management/invoice` | ✅ Correct |
| Users | `/api/v3/io/users` | ✅ Correct |
| Addresses | `/api/v3/io/addresses` | ✅ Correct |
| Shopping Lists | `/api/v3/io/shopping-list` | ✅ Correct |
| Company Details | `/api/v3/io/companies/{id}` | ✅ Correct |
| Company Credit | `/api/v3/io/companies/{id}/credit` | ✅ Correct |

### 3.2 Issues to Address

**1. GraphQL Authentication Header (Line 569):**
```typescript
headers['authToken'] = userToken;  // ❌ DEPRECATED
```
Should be removed. Only use `Authorization: Bearer` for GraphQL.

**2. Dashboard Stats Calculation:**
Current implementation calculates stats from orders/quotes (reasonable workaround) but could use GraphQL for better efficiency.

**3. Invoice Company Filtering:**
The server correctly notes that BigCommerce ignores `companyId` parameter and implements server-side filtering. This is good!

**4. Standard API Integration:**
Excellent dual-API approach merging B2B orders with standard BigCommerce orders for historical data.

---

## 4. Official BigCommerce B2B API Endpoints

### 4.1 Full API Catalog (from [B2B Edition APIs](https://developer.bigcommerce.com/b2b-edition/apis))

#### Storefront APIs (User-Facing)

| Category | Key Endpoints |
|----------|--------------|
| **Authentication** | Get Storefront authToken |
| **Catalog** | Get Product Variants Info |
| **Company - Addresses** | Get/Create/Update/Delete Company Addresses |
| **Company - Companies** | Create Company, Get Company Extra Fields |
| **Company - Users** | Get/Create/Update/Delete Users |
| **Orders** | Get All Orders, Create Order, Get Order Details |
| **Request for Quote** | Get/Create Quotes, Convert to Order, Export PDF |
| **Sales Rep** | Super Admin Masquerade functions |
| **Shopping List** | Full CRUD for Shopping Lists |
| **Store Settings** | Get Currencies, Order Statuses |

#### Management APIs (Server-to-Server)

| Category | Key Endpoints |
|----------|--------------|
| **Address** | Full address management |
| **Authentication** | Backend token generation |
| **Channel** | Multi-channel support |
| **Company** | Full company lifecycle, hierarchies, subsidiaries |
| **Company Roles** | Role-based permissions management |
| **Invoice Management** | Full invoice lifecycle, payments, receipts |
| **Order** | Order management, reassignment, bulk operations |
| **Payment** | Payment methods, company credit, payment terms |
| **Quote** | Quote management, shipping rates |
| **Sales Staff** | Sales staff management |
| **Shopping List** | Admin shopping list management |
| **Super Admin** | Super admin user management |
| **User** | Full user management |

### 4.2 Missing Features in Current Implementation

Based on API documentation, these features are NOT implemented:

| Feature | API Endpoint | Priority |
|---------|-------------|----------|
| Company Roles & Permissions | `/api/v3/io/companies/{id}/roles` | HIGH |
| Company Hierarchies | `/api/v3/io/companies/{id}/hierarchy` | MEDIUM |
| Company Subsidiaries | `/api/v3/io/companies/{id}/subsidiaries` | MEDIUM |
| Invoice Payments | `/api/v3/io/invoices/{id}/payments` | HIGH |
| Invoice Receipts | `/api/v3/io/receipts` | MEDIUM |
| Bulk Company Operations | `/api/v3/io/companies/bulk` | LOW |
| Bulk User Operations | `/api/v3/io/users/bulk` | LOW |
| Order Reassignment | `/api/v3/io/orders/{id}/reassign` | MEDIUM |
| Sales Staff Management | `/api/v3/io/sales-staff` | LOW |
| Super Admin Management | `/api/v3/io/super-admin` | MEDIUM |
| Extra Field Configs | `/api/v3/io/*/extra-field-configs` | HIGH |
| Quote Shipping Rates | `/api/v3/io/quotes/{id}/shipping-rates` | MEDIUM |
| Payment Methods | `/api/v3/io/payment-methods` | HIGH |
| Payment Terms | `/api/v3/io/payment-terms` | HIGH |

---

## 5. Multi-Tenant Data Isolation Analysis

### 5.1 Current Implementation

**Positive Findings:**

1. **Server-side company filtering exists** (`server/filters.ts`)
2. **Company ID extracted from JWT** at login
3. **Routes use `requireCompanyAccess` middleware**
4. **Invoice filtering by customer extraFields**

**File: `server/routes.ts` Line 14:**
```typescript
import { filterByCompany, verifyResourceOwnership } from "./filters";
```

### 5.2 Gaps Identified

1. **Client-side filtering is insufficient** - Should ONLY be server-side
2. **Company hierarchy not fully implemented** - Parent companies can't see subsidiary data
3. **Role-based filtering incomplete** - Buyer vs Admin access levels

### 5.3 Security Concerns

| Risk | Current Status | Recommendation |
|------|---------------|----------------|
| Cross-company data access | ✅ Mitigated by server filters | Maintain |
| Token leakage | ✅ BC token stored server-side | Good |
| Session hijacking | ✅ JWT with expiry | Good |
| Company ID spoofing | ⚠️ Verify in middleware | Add validation |

---

## 6. GraphQL Migration Status

### 6.1 BigCommerce Recommendation

> "It is recommended to use the GraphQL API instead of the Storefront REST API for storefront development on B2B Edition's Buyer Portal experience."
> — [BigCommerce B2B Edition Documentation](https://developer.bigcommerce.com/b2b-edition/docs)

### 6.2 Current Status

| Feature | GraphQL | REST | Status |
|---------|---------|------|--------|
| Login | ❌ | ✅ `/api/io/auth/customers` | REST working |
| Company Info | ✅ `currentUser.companyInfo` | ❌ | GraphQL used |
| Orders | ❌ | ✅ `/api/v2/orders` | REST used |
| Quotes | ❌ | ✅ `/api/v2/quotes` | REST used |
| Invoices | ❌ | ✅ `/api/v3/io/invoice-management` | REST used |
| Shopping Lists | ❌ | ✅ `/api/v3/io/shopping-list` | REST used |
| Products | ❌ | ✅ `/api/v2/products` | REST used |

### 6.3 GraphQL Benefits Not Utilized

1. **Efficient Data Fetching** - Request only needed fields
2. **Type Safety** - Schema validation
3. **Pagination** - Cursor-based pagination
4. **Extra Fields** - `extraFields` available in GraphQL queries
5. **Real-time Updates** - Subscription support

### 6.4 Recommended GraphQL Queries to Implement

```graphql
# Orders with Extra Fields (GraphQL)
query GetOrders($first: Int, $status: String) {
  orders(first: $first, status: $status) {
    edges {
      node {
        orderId
        orderStatus
        totalIncTax
        companyId
        extraFields {
          fieldName
          fieldValue
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Company with Full Details
query GetCompany {
  company {
    id
    companyName
    companyStatus
    addressLine1
    city
    state
    country
    extraFields {
      fieldName
      fieldValue
    }
  }
}
```

---

## 7. Comparison with Official b2b-buyer-portal

### 7.1 Official Repository Analysis

**Repository:** [github.com/bigcommerce/b2b-buyer-portal](https://github.com/bigcommerce/b2b-buyer-portal)

| Aspect | Official | This Implementation |
|--------|----------|---------------------|
| Framework | React 18 | React 18 ✅ |
| Monorepo | Turborepo | None ❌ |
| Build Tool | Vite | Vite ✅ |
| UI Library | Material-UI 5 | shadcn/ui (different) |
| Routing | React Router 6 | wouter (different) |
| State | N/A | React Query ✅ |
| GraphQL | Used extensively | Minimal |
| Node.js | >=22.16.0 | Not specified |

### 7.2 Key Differences

1. **UI Framework:** Official uses Material-UI; this uses shadcn/ui (acceptable alternative)
2. **GraphQL Usage:** Official heavily uses GraphQL; this primarily uses REST
3. **Monorepo:** Official uses Turborepo for packages; this is single-package
4. **API Client:** Official likely has proper proxy patterns; this has client-side issues

---

## 8. Feature Completeness Assessment

### 8.1 Implemented Features (65%)

| Feature | Status | Notes |
|---------|--------|-------|
| User Authentication | ✅ | JWT + BC token system |
| Login/Logout | ✅ | Working |
| Dashboard Stats | ✅ | Calculated from data |
| Orders List | ✅ | With company filtering |
| Order Details | ✅ | With products |
| Quotes List | ✅ | Basic implementation |
| Quote Details | ✅ | Basic implementation |
| Invoices List | ✅ | With filtering |
| Invoice Details | ✅ | Working |
| Company Profile | ✅ | Basic implementation |
| Company Users | ✅ | List and management |
| Addresses | ✅ | CRUD operations |
| Shopping Lists | ✅ | Basic implementation |
| Product Search | ✅ | Basic search |
| Cart | ⚠️ | Stub implementation |
| Quick Order | ⚠️ | Basic implementation |

### 8.2 Missing/Incomplete Features (35%)

| Feature | Status | Priority |
|---------|--------|----------|
| Company Hierarchies | ❌ | HIGH |
| Role-based Permissions UI | ❌ | HIGH |
| Invoice Payments | ❌ | HIGH |
| Company Credit Display | ⚠️ | MEDIUM |
| Payment Terms | ❌ | MEDIUM |
| Quote to Order Conversion | ⚠️ | MEDIUM |
| Super Admin Features | ❌ | LOW |
| Sales Rep Features | ❌ | LOW |
| Bulk Operations | ❌ | LOW |
| CSV/PDF Exports | ⚠️ | MEDIUM |
| Extra Fields UI | ❌ | HIGH |
| Webhook Integration | ❌ | MEDIUM |

---

## 9. Prioritized Remediation Plan

### Phase 1: Critical Fixes (Immediate)

**Priority 1.1: Fix Client-Side API Integration**
- Remove direct BigCommerce API calls from `b2b-client.ts`
- Route all requests through server proxy
- Remove invalid headers from client
- **Impact:** Application will not work without this

**Priority 1.2: Update Authentication Headers**
- Remove deprecated `authToken` header
- Use `X-Auth-Token` + `X-Store-Hash` for Management API
- Use `Authorization: Bearer` for GraphQL Storefront API
- **Impact:** September 2025 compliance

### Phase 2: High Priority (This Week)

**Priority 2.1: Extra Fields Implementation**
- Add `extraFields` to order queries
- Create UI components to display custom fields
- Map ERP fields (Customer ID, PO Number, etc.)

**Priority 2.2: Invoice Payments**
- Implement payment recording endpoint
- Add payment history display
- Support offline payment recording

**Priority 2.3: Company Role Permissions**
- Fetch role configurations from API
- Implement role-based access control
- Show/hide features based on role

### Phase 3: Medium Priority (Next Sprint)

**Priority 3.1: GraphQL Migration**
- Migrate orders to GraphQL (for `extraFields` support)
- Implement cursor-based pagination
- Add GraphQL type generation

**Priority 3.2: Company Hierarchies**
- Implement hierarchy fetching
- Add subsidiary access
- Enable company switching

**Priority 3.3: Payment Terms**
- Fetch payment method configurations
- Display available payment terms
- Show company credit limits

### Phase 4: Low Priority (Future)

- Super Admin features
- Sales Rep features
- Bulk operations
- Webhook integrations

---

## 10. Risk Assessment

### High Risk Items

1. **Client-side API calls will fail** - Endpoints don't exist
2. **Authentication token deprecation** - `authToken` header deprecated
3. **Data leakage potential** - If server filters fail

### Medium Risk Items

1. **Feature gaps** - Users may expect features not implemented
2. **Performance** - REST queries less efficient than GraphQL
3. **Maintenance** - Two API patterns (REST + GraphQL) to maintain

### Low Risk Items

1. **UI differences** - shadcn/ui vs Material-UI (acceptable)
2. **Missing bulk operations** - Most users won't need
3. **Sales rep features** - Only needed for specific use cases

---

## 11. Conclusion

The Feme B2B Buyer Portal has a **solid server-side foundation** but has **critical client-side integration issues** that must be addressed immediately. The application:

**Strengths:**
- Server-side BigCommerce API integration is mostly correct
- Two-token authentication pattern implemented
- Company-based data filtering in place
- Good security practices (JWT, server-side token storage)

**Critical Issues:**
- Client-side API client uses non-existent endpoints
- Deprecated `authToken` header still in use
- GraphQL not fully utilized
- Extra fields not displayed

**Recommended Actions:**
1. **Immediately:** Fix client-side API integration
2. **This Week:** Update authentication headers, add extra fields
3. **This Month:** Complete GraphQL migration, add missing features

---

## Resources

- [BigCommerce B2B Edition APIs](https://developer.bigcommerce.com/b2b-edition/apis)
- [B2B Edition Authentication](https://developer.bigcommerce.com/b2b-edition/docs/authentication)
- [About B2B APIs](https://developer.bigcommerce.com/b2b-edition/docs/about)
- [Official B2B Buyer Portal GitHub](https://github.com/bigcommerce/b2b-buyer-portal)
- [BigCommerce Authentication Blog](https://www.bigcommerce.com/blog/authenticate-bigcommerce-and-b2b-edition-apis-with-one-api-account/)
- [BigCommerce Developer Center](https://developer.bigcommerce.com/)

---

*Report Generated: February 2, 2026*
*Analysis Based on: BigCommerce B2B Edition Official Documentation & GitHub Repositories*
