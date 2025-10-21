# B2B Portal API Issues Report

## Executive Summary

The current B2B portal implementation has **significant deviations** from BigCommerce's official B2B Edition API specifications. This report documents all mismatches, their impacts, and recommended fixes.

---

## Critical Issues Found

### 1. Wrong API Base Pattern

**Current Implementation:**
```typescript
// client/src/lib/b2b-client.ts (Lines 44-47)
async login(email: string, password: string) {
  return this.request('/api/v3/login', {  // ❌ WRONG - endpoint doesn't exist
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
```

**Official BigCommerce Pattern:**
- **Storefront Operations**: Use GraphQL at `https://api-b2b.bigcommerce.com/graphql`
- **Management Operations**: Use REST at `https://api-b2b.bigcommerce.com/api/v3/io/`
- **Legacy Storefront**: Use REST at `https://api-b2b.bigcommerce.com/api/v2/`

**Impact:** All client-side API calls in `b2b-client.ts` will fail because the endpoints don't exist.

---

### 2. Custom Endpoints That Don't Exist

The following endpoints in `client/src/lib/b2b-client.ts` **do not exist** in BigCommerce's B2B Edition API:

| Line | Current Endpoint | Status | Should Use Instead |
|------|-----------------|--------|-------------------|
| 44 | `/api/v3/login` | ❌ INVALID | GraphQL `login` mutation OR `/api/io/auth/customers` |
| 51 | `/api/v3/logout` | ❌ INVALID | GraphQL `logout` mutation |
| 58 | `/api/v3/dashboard/stats` | ❌ INVALID | Calculate from GraphQL queries |
| 71 | `/api/v3/orders` | ❌ INVALID | GraphQL `customer.orders` query OR `/api/v2/orders` |
| 75 | `/api/v3/orders/:id` | ❌ INVALID | GraphQL `order(orderId:)` query OR `/api/v2/orders/:id` |
| 88 | `/api/v3/quotes` | ❌ INVALID | GraphQL or `/api/v2/quotes` |
| 97 | `/api/v3/company` | ❌ INVALID | GraphQL `customer.company` |
| 101 | `/api/v3/company/users` | ❌ INVALID | GraphQL or `/api/v2/users` |
| 105 | `/api/v3/company/addresses` | ❌ INVALID | GraphQL or `/api/v2/addresses` |
| 118 | `/api/v3/invoices` | ❌ INVALID | `/api/v3/io/invoice-management/invoice` |

---

### 3. Incorrect Authentication Headers

**Current Implementation:**
```typescript
// client/src/lib/b2b-client.ts (Lines 19-24)
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Store-Hash': this.storeHash,      // ❌ Not used by B2B API
  'X-Channel-Id': this.channelId,      // ❌ Not used by B2B API
};
```

**Server Implementation:**
```typescript
// server/bigcommerce.ts (Lines 39-56)
headers['X-Store-Hash'] = this.config.storeHash;    // ❌ Wrong
headers['X-Channel-Id'] = channelId;                // ❌ Wrong
headers['authToken'] = this.config.managementToken; // ⚠️ Partially correct
headers['X-Auth-Token'] = this.config.accessToken;  // ⚠️ For v2 only
```

**Official BigCommerce Headers:**

For **GraphQL Storefront API**:
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${customerToken}`,  // ✅ User's storefront token
  'Accept': 'application/json'
}
```

For **Management API v3** (`/api/v3/io/*`):
```typescript
{
  'Content-Type': 'application/json',
  'authToken': process.env.BIGCOMMERCE_B2B_MANAGEMENT_TOKEN,  // ✅ Server token
  'Accept': 'application/json'
}
```

For **Storefront REST API v2**:
```typescript
{
  'Authorization': `Bearer ${customerToken}`,  // ✅ User's storefront token
}
```

**Note:** `X-Store-Hash` and `X-Channel-Id` are used in standard BigCommerce Store API, NOT in B2B Edition APIs.

---

### 4. Missing GraphQL Implementation

**Current State:**
- A GraphQL migration plan exists (`GRAPHQL_MIGRATION_PLAN.md`)
- Server has a `graphqlRequest()` method (server/bigcommerce.ts:249)
- Client has NO GraphQL implementation at all
- All client calls use non-existent REST endpoints

**Official Recommendation:**
> "It is recommended to use the GraphQL API instead of the Storefront REST API for storefront development on B2B Edition's Buyer Portal experience."

**What Should Be Using GraphQL:**
- ✅ Authentication (login/logout)
- ✅ Customer/Company data
- ✅ Orders (with `extraFields` support)
- ✅ Quotes
- ✅ Shopping Lists
- ✅ Products/Catalog
- ✅ Cart operations

---

### 5. Custom Fields Not Implemented in UI

**Server Implementation:**
```typescript
// server/bigcommerce.ts:346-356
const query = `
  query {
    currentUser {
      id
      email
      firstName
      lastName
    }
  }
`;
```

**Missing Fields:**
- ❌ No `extraFields` queried for orders
- ❌ No `customFields` queried for companies
- ❌ No UI components to display custom fields
- ❌ No CSV export includes custom fields

**GraphQL Support Available:**
```graphql
# Available in BigCommerce B2B GraphQL API
query Order($orderId: Int!) {
  order(orderId: $orderId) {
    extraFields {
      fieldName
      fieldValue
      isRequired
    }
  }
}
```

**Known Limitation:** `extraFields` NOT available in `customer.orders` list query (BigCommerce Issue #162), only in single `order(orderId:)` query.

---

### 6. Server-Side API Partially Correct

The server implementation (`server/bigcommerce.ts`) is **closer** to correct but still has issues:

**What's Working:**
- ✅ Login endpoint: `/api/io/auth/customers` (line 107) - **CORRECT**
- ✅ Orders: `/api/v2/orders` (line 186) - **CORRECT**
- ✅ Quotes: `/api/v2/quotes` (line 307) - **CORRECT**
- ✅ Invoices: `/api/v3/io/invoice-management/invoice` (line 406) - **CORRECT**
- ✅ Shopping Lists: `/api/v3/io/shopping-list` (line 432) - **CORRECT**

**What's Wrong:**
- ❌ Headers still using `X-Store-Hash` and `X-Channel-Id` (lines 41-42)
- ❌ Mixed authentication approach (lines 47-56)
- ⚠️ GraphQL implementation exists but uses wrong headers (lines 254-258)

---

## Styling Issues

### Current State
The portal appears to be using a custom UI implementation rather than BigCommerce-native components.

### Recommended Approach
According to the official [b2b-buyer-portal](https://github.com/bigcommerce/b2b-buyer-portal) repository:
- Uses **Material-UI 5** for components
- Uses **Tailwind CSS** for styling (you have this configured)
- Follows BigCommerce design system patterns

**Action Items:**
1. Review current component styling against official buyer portal
2. Ensure consistent design system usage
3. Check if Tailwind config matches official patterns

---

## Environment Variables Analysis

**Your Current .ENV:**
```env
VITE_B2B_URL="https://api-b2b.bigcommerce.com/api/v3/io"  # ❌ TOO SPECIFIC
BIGCOMMERCE_B2B_MANAGEMENT_TOKEN="eyJhbG..."              # ✅ CORRECT
BIGCOMMERCE_STORE_HASH="pyrenapwe2"                      # ✅ CORRECT
```

**Should Be:**
```env
VITE_B2B_URL="https://api-b2b.bigcommerce.com"  # ✅ Base URL only
# OR separate endpoints:
VITE_B2B_REST_URL="https://api-b2b.bigcommerce.com"
VITE_B2B_GRAPHQL_URL="https://api-b2b.bigcommerce.com/graphql"
```

**Reason:** The base URL should not include `/api/v3/io` because different APIs use different paths:
- GraphQL: `/graphql`
- Management API: `/api/v3/io/*`
- Storefront REST: `/api/v2/*`

---

## Migration Path Recommendations

### Option 1: Full GraphQL Migration (Recommended)
**Timeline:** 2-3 days
**Complexity:** Medium-High
**Benefits:**
- ✅ Future-proof
- ✅ Aligned with official patterns
- ✅ Better performance
- ✅ Type safety with codegen

**Steps:**
1. Install Apollo Client dependencies
2. Migrate authentication to GraphQL
3. Migrate orders/quotes to GraphQL
4. Implement custom fields display
5. Apply official styling patterns

### Option 2: Quick Fix (Hybrid Approach)
**Timeline:** 4-6 hours
**Complexity:** Low-Medium
**Benefits:**
- ✅ Gets portal working immediately
- ⚠️ Still uses REST (not future-proof)

**Steps:**
1. Fix client endpoints to match server (`/api/v2/*` for storefront)
2. Remove invalid headers (`X-Store-Hash`, `X-Channel-Id`)
3. Use server as proxy for all API calls
4. Add custom fields display (using REST API)

---

## Immediate Action Items

### High Priority (Breaks Functionality)
1. ❌ **Fix client API endpoints** - Nothing works without this
2. ❌ **Remove invalid headers** - Causing authentication failures
3. ❌ **Align client with server** - Client should call server, not B2B API directly

### Medium Priority (Missing Features)
4. ⚠️ **Implement custom fields display** - User requirement
5. ⚠️ **Fix authentication flow** - Use proper token management
6. ⚠️ **Add proper error handling** - Current errors are confusing

### Low Priority (Best Practices)
7. 💡 **Migrate to GraphQL** - Future-proof solution
8. 💡 **Apply official styling** - Better UX
9. 💡 **Add comprehensive testing** - Prevent regressions

---

## Testing with Your Credentials

With your provided environment variables, here's what should work:

**✅ Server-Side (Correct):**
```bash
# These endpoints should work from your server:
POST https://api-b2b.bigcommerce.com/api/io/auth/customers
GET  https://api-b2b.bigcommerce.com/api/v2/orders
GET  https://api-b2b.bigcommerce.com/api/v3/io/invoice-management/invoice
```

**❌ Client-Side (Broken):**
```bash
# These endpoints DON'T EXIST and will fail:
POST https://api-b2b.bigcommerce.com/api/v3/io/api/v3/login  # WRONG
GET  https://api-b2b.bigcommerce.com/api/v3/io/api/v3/orders # WRONG
```

**Note:** Client is appending `/api/v3/*` to base URL that already includes `/api/v3/io`, creating invalid paths.

---

## Recommended Next Steps

### Quickest Path to Working Portal (Hybrid)
1. **Update client to proxy through server** (1 hour)
   - Change all `b2b-client.ts` calls to hit `/api/*` on your server
   - Let server handle B2B API calls with correct endpoints/headers

2. **Fix authentication** (1 hour)
   - Server login is correct, update client to use it
   - Store token properly in localStorage

3. **Display custom fields** (2 hours)
   - Query `extraFields` from orders API
   - Create UI components to display them

### Best Long-Term Solution (GraphQL)
1. **Follow `GRAPHQL_MIGRATION_PLAN.md`** (2-3 days)
   - Already documented and ready to implement
   - Aligns with official BigCommerce recommendations

---

## Summary

**Current State:** ❌ Portal is using non-existent API endpoints with wrong headers

**Impact:** 🔴 Critical - Most functionality is broken

**Root Cause:** Implementation deviated from official BigCommerce B2B Edition API specifications

**Solution:** Choose between quick hybrid fix (hours) or proper GraphQL migration (days)

---

*Report Generated: October 21, 2025*
*Based on: BigCommerce B2B Edition Official Documentation*
