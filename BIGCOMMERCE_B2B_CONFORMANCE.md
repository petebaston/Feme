# BigCommerce B2B Edition API Conformance Checklist

## Executive Summary

This document outlines the **complete** requirements for 100% conformance with BigCommerce B2B Edition API patterns and best practices based on official documentation at https://developer.bigcommerce.com/b2b-edition/apis.

**Status**: Our current implementation has **CRITICAL gaps** in conformance that must be addressed.

---

## 📋 Table of Contents

1. [Authentication Architecture](#authentication-architecture)
2. [API Architecture](#api-architecture)
3. [Multi-Tenant Data Isolation](#multi-tenant-data-isolation)
4. [GraphQL Storefront API](#graphql-storefront-api)
5. [REST Management V3 API](#rest-management-v3-api)
6. [Current Implementation Gaps](#current-implementation-gaps)
7. [Conformance Checklist](#conformance-checklist)
8. [Implementation Priorities](#implementation-priorities)

---

## Authentication Architecture

### ✅ Official BigCommerce Pattern

BigCommerce B2B Edition uses **TWO distinct authentication mechanisms**:

#### 1. Server-to-Server Tokens (Backend/Management API)

**Purpose**: Authenticate server-side requests to REST Management V3 API

**Token Characteristics**:
- Long-lived (do not expire by default)
- Created via BigCommerce Control Panel (Settings > Store-level API accounts)
- Requires B2B Edition scope set to "modify"
- Pre-configured with all API scopes

**Required Headers**:
```
X-Auth-Token: {server_token}
X-Store-Hash: {store_hash}
```

**Critical**: "An X-Auth-Token used without an X-Store-Hash or with a mismatched hash will return server errors."

**Base URL**: `https://api-b2b.bigcommerce.com/api/v3/io/`

**Use Cases**:
- Company management (create, update, delete companies)
- User provisioning
- Order reassignment
- Invoice generation
- Super admin operations
- All backend/admin operations

**Backend Token Generation Endpoint**:
```
POST /api/v3/io/auth/backend
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "storeHash": "abc123",
  "endAt": 1735689600  // Optional Unix timestamp for expiration
}
```

---

#### 2. Storefront Tokens (User-Facing API)

**Purpose**: Authenticate user-specific requests to GraphQL Storefront API

**Token Characteristics**:
- Short-lived (expire after **1 day**)
- User-specific (tied to company user)
- Bearer token format
- Permissions based on user role
- Must be refreshed daily

**Required Header**:
```
Authorization: Bearer {storefront_token}
```

**Base URL**: `https://api-b2b.bigcommerce.com/graphql`

**Use Cases**:
- Fetch user's orders
- View user's quotes
- Access user's invoices
- Company account information (for user's company only)
- Shopping lists
- All buyer portal operations

---

### Token Generation Methods (Storefront)

BigCommerce provides **FOUR methods** to obtain storefront tokens:

#### Method 1: GraphQL Login Mutation (RECOMMENDED)

```graphql
mutation CustomerLogin($storeHash: String!, $email: String!, $password: String!) {
  login(storeHash: $storeHash, email: $email, password: $password) {
    result {
      token              # Storefront authToken for B2B API
      storefrontLoginToken  # JWT for BigCommerce session sync
      user {
        id
        bcId
        firstName
        lastName
        email
      }
    }
  }
}
```

**Returns**:
- `token`: Use for B2B GraphQL API requests (expires in 1 day)
- `storefrontLoginToken`: JWT for syncing with BigCommerce customer sessions
- `user`: User details including company association

---

#### Method 2: GraphQL Authorization Mutation

For existing BigCommerce sessions:

```graphql
mutation Authorization($bcToken: String!) {
  authorization(bcToken: $bcToken) {
    result {
      token  # Storefront authToken
    }
  }
}
```

**Variables**:
- `bcToken`: JWT from BigCommerce Current Customer API (`/customer/current.jwt`)
- Must use `app_client_id=dl7c39mdpul6hyc489yk0vzxl6jesyx`

---

#### Method 3: REST API - Credentials

```
POST /api/io/auth/storefront
Content-Type: application/json

{
  "email": "buyer@company.com",
  "password": "password",
  "channelId": 1,
  "beginAt": 1735603200,  // Optional: Unix timestamp
  "endAt": 1735689600     // Optional: Unix timestamp
}
```

---

#### Method 4: REST API - Customer ID

```
POST /api/io/auth/storefront
Content-Type: application/json

{
  "customerId": 123,
  "channelId": 1
}
```

Requires Customer Access Token (CAT) from BigCommerce GraphQL login.

---

#### Method 5: REST API - JWT Exchange

```
GET /api/io/auth/storefront?jwtToken={jwt}&channelId=1
```

Exchange existing BigCommerce JWT for B2B storefront token.

---

### ❌ Current Implementation Issues

Our code has **CRITICAL authentication problems**:

1. **❌ Mixing Token Types**: We store BigCommerce storefront token in localStorage and send it to backend
2. **❌ No Token Storage**: Server doesn't store user tokens in database/memory
3. **❌ No Token Refresh**: No mechanism to refresh expired tokens
4. **❌ Wrong Headers**: Using `Authorization` for backend calls instead of `X-Auth-Token`
5. **❌ No Company Context**: Not extracting/storing company ID from tokens
6. **❌ Token Confusion**: Backend extracts token from header without knowing which type it is

**Current Flow** (WRONG):
```
1. User logs in → Gets BigCommerce token
2. Frontend stores token → localStorage
3. Frontend sends token in Authorization header
4. Backend extracts token → Passes directly to BigCommerce
5. No validation, no company filtering
```

**Correct Flow** (per BigCommerce docs):
```
1. User logs in → GraphQL login mutation
2. Server receives: authToken + storefrontLoginToken + user data
3. Server stores: authToken mapped to userId/companyId in database
4. Server sends to frontend: Only JWT with userId/companyId/role
5. Frontend stores: Our JWT (not BigCommerce token)
6. Frontend sends: Our JWT in Authorization header
7. Backend validates: Our JWT → Extracts userId
8. Backend retrieves: Stored BigCommerce token for userId
9. Backend uses: BigCommerce token for API calls
10. Backend filters: All responses by user's companyId
```

---

## API Architecture

### Official BigCommerce Structure

BigCommerce B2B Edition has **THREE distinct API types**:

#### 1. GraphQL Storefront API (RECOMMENDED for Buyer Portals)

**Base URL**: `https://api-b2b.bigcommerce.com/graphql`

**Authentication**: Storefront tokens (1-day expiry)

**Purpose**: User-facing buyer portal operations

**Available Resources**:
- Company account information (user's company)
- Orders (user's orders or company orders based on permissions)
- Quotes (sales quotes)
- Invoices (user's invoices)
- Shopping lists
- Sales rep functionality
- Store configuration

**Why GraphQL is Recommended**:
- Purpose-built for storefront/buyer portal experiences
- Efficient data fetching (request only what you need)
- Type-safe schema
- Better performance for complex queries
- Future-proof (BigCommerce's strategic direction)

---

#### 2. REST Management V3 API (Server-to-Server)

**Base URL**: `https://api-b2b.bigcommerce.com/api/v3/io/`

**Authentication**: Server-to-server tokens

**Purpose**: Backend administrative operations

**Available Resources**:
- **Addresses**: Manage company and user addresses
- **Authentication**: Generate tokens
- **Companies**: Full company lifecycle management
  - Create, update, delete companies
  - Manage company hierarchies
  - Bulk operations
  - Custom field configurations
- **Invoices**: Generate and manage invoices
- **Orders**: Reassign orders to companies, bulk operations
- **Payment Terms**: Configure payment terms
- **Quotes**: Admin-side quote management
- **Super Admin**: Manage super admin users
- **Users**: User provisioning and management
  - Create, update, delete users
  - Role assignment
  - Email validation

**Key Endpoints** (Examples):

```
Companies:
GET    /api/v3/io/companies                    # List all companies
POST   /api/v3/io/companies                    # Create company
GET    /api/v3/io/companies/{companyId}        # Get company
PUT    /api/v3/io/companies/{companyId}        # Update company
DELETE /api/v3/io/companies/{companyId}        # Delete company
GET    /api/v3/io/companies/{companyId}/hierarchy  # Get hierarchy
GET    /api/v3/io/companies/{companyId}/subsidiaries  # Get subsidiaries

Users:
GET    /api/v3/io/companies/{companyId}/users  # List company users
POST   /api/v3/io/companies/{companyId}/users  # Create user
GET    /api/v3/io/users/{userId}               # Get user
PUT    /api/v3/io/users/{userId}               # Update user
DELETE /api/v3/io/users/{userId}               # Delete user

Orders:
GET    /api/v3/io/orders                       # List all orders
GET    /api/v3/io/orders/{orderId}             # Get order
POST   /api/v3/io/orders                       # Create order
POST   /api/v3/io/orders/bulk-assign           # Bulk assign orders to companies

Invoices:
GET    /api/v3/io/invoices                     # List invoices
POST   /api/v3/io/invoices                     # Create invoice
GET    /api/v3/io/invoices/{invoiceId}         # Get invoice
PUT    /api/v3/io/invoices/{invoiceId}         # Update invoice
```

---

#### 3. REST Storefront API (LEGACY)

**Base URL**: `https://api-b2b.bigcommerce.com/api/v2/`

**Status**: Legacy support, migrate to GraphQL recommended

**Purpose**: Alternative to GraphQL for storefront operations

**Note**: Documentation states GraphQL is preferred for new integrations.

---

### ❌ Current Implementation Issues

1. **❌ Using Wrong API Types**: Mixing storefront and management APIs incorrectly
2. **❌ Not Using GraphQL**: Should use GraphQL for buyer portal, we're using REST
3. **❌ Wrong Base URLs**: Hardcoding endpoints incorrectly
4. **❌ No API Versioning**: Not following v3 vs v2 guidance

---

## Multi-Tenant Data Isolation

### ✅ Official BigCommerce Pattern

BigCommerce B2B Edition enforces multi-tenancy through **company-based data partitioning**:

#### Company Context in All Operations

**Every user** belongs to a company:
- User creation requires `companyId`
- Storefront tokens include company context
- All data is scoped to company

**Company Hierarchy Support**:
- Parent-subsidiary relationships
- Data visibility based on hierarchy
- Admin users can see subsidiary data

#### Data Filtering Requirements

**Orders**:
- Users see only their company's orders
- Admin users can see subsidiary orders
- Super admins see all orders

**Invoices**:
- Scoped to company
- Users with invoice permissions see company invoices

**Quotes**:
- Scoped to company
- Sales reps can see assigned company quotes

**Shopping Lists**:
- User-specific or company-shared
- Always company-scoped

#### Permission-Based Access

**Roles determine access**:
- Buyer: Own orders/quotes
- Admin: Company-wide data
- Super Admin: Cross-company access
- Sales Rep: Assigned companies

**GraphQL automatically filters** by:
- User's company ID (from storefront token)
- User's role/permissions
- Company hierarchy relationships

**REST Management API** allows:
- Filtering by `companyId` parameter
- Bulk operations with company constraints
- Cross-company operations for super admins

---

### ❌ Current Implementation Issues

1. **❌ No Company Filtering**: We don't filter data by company ID
2. **❌ No Company Context**: Not extracting company from tokens
3. **❌ Server-Side Filtering Missing**: Relying on BigCommerce to filter (wrong!)
4. **❌ No Role-Based Access**: Not checking user roles/permissions
5. **❌ No Hierarchy Support**: Not handling parent-subsidiary relationships

---

## GraphQL Storefront API

### ✅ Required Implementation

For buyer portal experiences, BigCommerce **explicitly recommends** using GraphQL Storefront API.

### Authentication

```javascript
const headers = {
  'Authorization': `Bearer ${storefrontToken}`,
  'Content-Type': 'application/json'
};
```

### Key Queries & Mutations

#### Authentication

```graphql
# Login
mutation CustomerLogin($storeHash: String!, $email: String!, $password: String!) {
  login(storeHash: $storeHash, email: $email, password: $password) {
    result {
      token
      storefrontLoginToken
      user {
        id
        bcId
        email
        firstName
        lastName
        role
        companyId  # CRITICAL for multi-tenant filtering
      }
    }
  }
}

# Authorization (existing session)
mutation Authorization($bcToken: String!) {
  authorization(bcToken: $bcToken) {
    result {
      token
    }
  }
}
```

---

#### Company Queries

```graphql
# Get current user's company
query GetCompany {
  company {
    id
    companyName
    companyStatus
    companyEmail
    # ... other fields
  }
}

# Get company users (admin only)
query GetCompanyUsers {
  companyUsers {
    edges {
      node {
        id
        email
        firstName
        lastName
        role
      }
    }
  }
}
```

---

#### Order Queries

```graphql
# Get all orders (filtered by user's company automatically)
query GetAllOrders($first: Int, $status: String) {
  orders(first: $first, status: $status) {
    edges {
      node {
        id
        orderId
        orderStatus
        totalIncTax
        createdAt
        companyId    # Verify it matches user's company
        companyName
        customerName
        poNumber
        items {
          productId
          quantity
          price
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Get single order
query GetOrder($orderId: Int!) {
  order(orderId: $orderId) {
    id
    orderId
    orderStatus
    totalIncTax
    companyId
    # ... full order details
  }
}
```

---

#### Quote Queries

```graphql
# Get user's quotes
query GetQuotes($first: Int) {
  quotes(first: $first) {
    edges {
      node {
        id
        quoteNumber
        status
        totalPrice
        createdAt
        expiresAt
        companyId
      }
    }
  }
}

# Get single quote
query GetQuote($quoteId: Int!) {
  quote(quoteId: $quoteId) {
    id
    quoteNumber
    status
    totalPrice
    items {
      productId
      quantity
      price
    }
  }
}
```

---

#### Invoice Queries

```graphql
# Get invoices
query GetInvoices($first: Int) {
  invoices(first: $first) {
    edges {
      node {
        id
        invoiceNumber
        status
        totalDue
        dueDate
        createdAt
        companyId
      }
    }
  }
}

# Get single invoice
query GetInvoice($invoiceId: Int!) {
  invoice(invoiceId: $invoiceId) {
    id
    invoiceNumber
    status
    totalDue
    amountPaid
    dueDate
    items {
      description
      quantity
      unitPrice
      total
    }
  }
}
```

---

#### Shopping List Queries

```graphql
# Get shopping lists
query GetShoppingLists {
  shoppingLists {
    edges {
      node {
        id
        name
        description
        items {
          productId
          quantity
        }
      }
    }
  }
}
```

---

### ❌ Current Implementation Issues

1. **❌ Not Using GraphQL**: We're using REST APIs instead
2. **❌ No Pagination**: Not handling cursor-based pagination
3. **❌ Missing Queries**: Not using all available queries
4. **❌ No Type Safety**: Not leveraging GraphQL schemas
5. **❌ Inefficient Fetching**: Over-fetching or under-fetching data

---

## REST Management V3 API

### ✅ Required Implementation for Backend Operations

Use REST Management V3 for all **server-side administrative** operations.

### Authentication

```javascript
const headers = {
  'X-Auth-Token': process.env.BIGCOMMERCE_ACCESS_TOKEN,
  'X-Store-Hash': process.env.BIGCOMMERCE_STORE_HASH,
  'Content-Type': 'application/json'
};
```

### Company Management Endpoints

```javascript
// List all companies
GET https://api-b2b.bigcommerce.com/api/v3/io/companies
Headers: X-Auth-Token, X-Store-Hash
Query params: ?companyStatus=active&limit=50&offset=0

// Create company
POST https://api-b2b.bigcommerce.com/api/v3/io/companies
Headers: X-Auth-Token, X-Store-Hash
Body: {
  "companyName": "Acme Corp",
  "companyEmail": "admin@acme.com",
  "companyStatus": "active",
  "addressLine1": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "zipCode": "94102",
  "country": "US"
}

// Get company hierarchy
GET https://api-b2b.bigcommerce.com/api/v3/io/companies/{companyId}/hierarchy
Headers: X-Auth-Token, X-Store-Hash

// Get company subsidiaries
GET https://api-b2b.bigcommerce.com/api/v3/io/companies/{companyId}/subsidiaries
Headers: X-Auth-Token, X-Store-Hash
```

---

### User Management Endpoints

```javascript
// List company users
GET https://api-b2b.bigcommerce.com/api/v3/io/companies/{companyId}/users
Headers: X-Auth-Token, X-Store-Hash

// Create user
POST https://api-b2b.bigcommerce.com/api/v3/io/companies/{companyId}/users
Headers: X-Auth-Token, X-Store-Hash
Body: {
  "email": "user@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "buyer",  // or "admin"
  "password": "SecurePassword123!"
}

// Update user
PUT https://api-b2b.bigcommerce.com/api/v3/io/users/{userId}
Headers: X-Auth-Token, X-Store-Hash
Body: {
  "firstName": "Jane",
  "role": "admin"
}

// Delete user
DELETE https://api-b2b.bigcommerce.com/api/v3/io/users/{userId}
Headers: X-Auth-Token, X-Store-Hash
```

---

### Order Management Endpoints

```javascript
// List orders (admin view, all companies)
GET https://api-b2b.bigcommerce.com/api/v3/io/orders
Headers: X-Auth-Token, X-Store-Hash
Query params: ?companyId=123&limit=50

// Get order
GET https://api-b2b.bigcommerce.com/api/v3/io/orders/{orderId}
Headers: X-Auth-Token, X-Store-Hash

// Create order
POST https://api-b2b.bigcommerce.com/api/v3/io/orders
Headers: X-Auth-Token, X-Store-Hash
Body: { /* order details */ }

// Bulk assign orders to company
POST https://api-b2b.bigcommerce.com/api/v3/io/orders/bulk-assign
Headers: X-Auth-Token, X-Store-Hash
Body: {
  "companyId": 123,
  "orderIds": [456, 789, 1011]
}

// Reassign order
PUT https://api-b2b.bigcommerce.com/api/v3/io/orders/{orderId}/reassign
Headers: X-Auth-Token, X-Store-Hash
Body: {
  "companyId": 456
}
```

---

### Invoice Management Endpoints

```javascript
// List invoices
GET https://api-b2b.bigcommerce.com/api/v3/io/invoices
Headers: X-Auth-Token, X-Store-Hash
Query params: ?companyId=123&status=open

// Create invoice
POST https://api-b2b.bigcommerce.com/api/v3/io/invoices
Headers: X-Auth-Token, X-Store-Hash
Body: {
  "companyId": 123,
  "orderId": 456,
  "dueDate": "2025-12-31",
  "items": [/* invoice items */]
}

// Update invoice
PUT https://api-b2b.bigcommerce.com/api/v3/io/invoices/{invoiceId}
Headers: X-Auth-Token, X-Store-Hash

// Record payment
POST https://api-b2b.bigcommerce.com/api/v3/io/invoices/{invoiceId}/payments
Headers: X-Auth-Token, X-Store-Hash
Body: {
  "amount": 100.00,
  "paymentMethod": "check",
  "reference": "CHK-12345"
}
```

---

### Extra Fields Configuration

```javascript
// Get company extra field configs
GET https://api-b2b.bigcommerce.com/api/v3/io/companies/extra-field-configs
Headers: X-Auth-Token, X-Store-Hash

// Get order extra field configs
GET https://api-b2b.bigcommerce.com/api/v3/io/orders/extra-field-configs
Headers: X-Auth-Token, X-Store-Hash

// Get invoice extra field configs
GET https://api-b2b.bigcommerce.com/api/v3/io/invoices/extra-field-configs
Headers: X-Auth-Token, X-Store-Hash
```

---

## Current Implementation Gaps

### 🔴 CRITICAL Gaps

1. **Authentication Architecture**
   - ❌ Not following BigCommerce token separation pattern
   - ❌ Storing wrong token type
   - ❌ No server-side token storage
   - ❌ No token refresh mechanism
   - ❌ Wrong authentication headers

2. **Multi-Tenant Isolation**
   - ❌ No company-based data filtering
   - ❌ No server-side filtering implementation
   - ❌ Users can see all companies' data
   - ❌ No role-based access control
   - ❌ No company hierarchy support

3. **API Usage**
   - ❌ Not using GraphQL for storefront (should be primary)
   - ❌ Using legacy REST Storefront API
   - ❌ Not using REST Management V3 for backend operations
   - ❌ Incorrect base URLs in some places

### 🟠 HIGH Priority Gaps

4. **Data Filtering**
   - ❌ No filtering by companyId on server
   - ❌ Relying on client-side filtering (insecure)
   - ❌ No resource ownership verification

5. **Error Handling**
   - ❌ Not handling token expiration (1-day expiry)
   - ❌ No automatic token refresh
   - ❌ Poor error messages for auth failures

6. **Rate Limiting**
   - ❌ Not checking rate limit headers
   - ❌ No retry logic with backoff
   - ❌ Not tracking X-Requests-Remaining

### 🟡 MEDIUM Priority Gaps

7. **GraphQL Implementation**
   - ❌ No GraphQL client setup
   - ❌ Not using pagination (cursor-based)
   - ❌ Not leveraging GraphQL schema
   - ❌ Missing type definitions

8. **Extra Fields**
   - ✅ Have custom fields (good!)
   - ❌ Not using BigCommerce extra field configs
   - ❌ No validation against configured fields

9. **Company Management**
   - ❌ No company hierarchy handling
   - ❌ No parent-subsidiary logic
   - ❌ Missing company admin features

---

## Conformance Checklist

### Authentication ✓

- [ ] **Implement Two-Token System**
  - [ ] Server-to-server tokens for backend operations
  - [ ] Storefront tokens for user-facing operations
  - [ ] Store tokens server-side (database/Redis)
  - [ ] Map user JWT to BigCommerce storefront token
  - [ ] Use correct headers for each API type

- [ ] **Token Management**
  - [ ] Implement token refresh (before 1-day expiry)
  - [ ] Handle token expiration gracefully
  - [ ] Invalidate tokens on logout
  - [ ] Store token creation/expiration timestamps

- [ ] **Login Flow**
  - [ ] Use GraphQL login mutation
  - [ ] Store returned authToken server-side
  - [ ] Store storefrontLoginToken for session sync
  - [ ] Extract and store companyId from user data
  - [ ] Generate internal JWT with userId/companyId/role
  - [ ] Return only internal JWT to frontend

### API Architecture ✓

- [ ] **GraphQL Storefront API (PRIMARY)**
  - [ ] Set up GraphQL client (Apollo or similar)
  - [ ] Use `https://api-b2b.bigcommerce.com/graphql` base URL
  - [ ] Implement all required queries (orders, invoices, quotes, company)
  - [ ] Use cursor-based pagination
  - [ ] Handle GraphQL errors properly
  - [ ] Generate TypeScript types from schema

- [ ] **REST Management V3 API (Backend)**
  - [ ] Use `https://api-b2b.bigcommerce.com/api/v3/io/` base URL
  - [ ] Use X-Auth-Token and X-Store-Hash headers
  - [ ] Implement company management endpoints
  - [ ] Implement user management endpoints
  - [ ] Implement order reassignment endpoints
  - [ ] Implement invoice management endpoints

- [ ] **Remove Legacy REST Storefront**
  - [ ] Migrate all storefront calls to GraphQL
  - [ ] Remove `/api/v2/` endpoints
  - [ ] Update all frontend API calls

### Multi-Tenant Data Isolation ✓

- [ ] **Server-Side Filtering**
  - [ ] Extract companyId from JWT on every request
  - [ ] Filter all data by companyId before returning
  - [ ] Verify resource ownership (order.companyId === user.companyId)
  - [ ] Implement role-based access (admin vs buyer)
  - [ ] Handle company hierarchy (parent can see subsidiary data)

- [ ] **Authorization Middleware**
  - [ ] Create requireCompanyAccess middleware
  - [ ] Create verifyResourceOwnership helper
  - [ ] Create filterByCompany helper
  - [ ] Apply middleware to all protected routes
  - [ ] Test cross-company access prevention

### Company Management ✓

- [ ] **Company Hierarchy**
  - [ ] Fetch company hierarchy from API
  - [ ] Store hierarchy relationships
  - [ ] Implement parent-subsidiary data access
  - [ ] Handle subsidiary company switching

- [ ] **Company Admin Features**
  - [ ] Company user management (create, update, delete)
  - [ ] Company settings management
  - [ ] Address management
  - [ ] View company-wide data

### Orders ✓

- [ ] **GraphQL Queries**
  - [ ] Implement GetAllOrders query
  - [ ] Implement GetOrder query
  - [ ] Use pagination for order lists
  - [ ] Filter by status, date range, etc.
  - [ ] Verify companyId matches user's company

- [ ] **Order Details**
  - [ ] Fetch full order details
  - [ ] Display order items with images
  - [ ] Show order status history
  - [ ] Display custom/extra fields

- [ ] **Order Operations**
  - [ ] Reorder functionality
  - [ ] Order tracking
  - [ ] Export orders to CSV (with company filtering)

### Quotes ✓

- [ ] **GraphQL Queries**
  - [ ] Implement GetQuotes query
  - [ ] Implement GetQuote query
  - [ ] Filter quotes by company
  - [ ] Handle quote expiration

- [ ] **Quote Operations**
  - [ ] Request quote
  - [ ] View quote details
  - [ ] Convert quote to order
  - [ ] Quote messaging
  - [ ] Generate quote checkout URL

### Invoices ✓

- [ ] **GraphQL Queries**
  - [ ] Implement GetInvoices query
  - [ ] Implement GetInvoice query
  - [ ] Filter by status (open, paid, overdue)
  - [ ] Calculate totals (open, overdue)

- [ ] **Invoice Operations**
  - [ ] View invoice details
  - [ ] Record payments
  - [ ] Export invoices to PDF
  - [ ] Email invoices
  - [ ] Payment history

### Users ✓

- [ ] **User Management (Admin)**
  - [ ] List company users
  - [ ] Create new users
  - [ ] Update user details
  - [ ] Delete users
  - [ ] Assign roles
  - [ ] Verify company association

### Addresses ✓

- [ ] **Address Management**
  - [ ] List addresses (company + user)
  - [ ] Create addresses
  - [ ] Update addresses
  - [ ] Delete addresses
  - [ ] Set default shipping/billing

### Extra Fields ✓

- [ ] **Field Configuration**
  - [ ] Fetch extra field configs from API
  - [ ] Validate against configured fields
  - [ ] Display configured fields only
  - [ ] Support all field types (string, int, text, etc.)

### Error Handling ✓

- [ ] **GraphQL Errors**
  - [ ] Handle network errors
  - [ ] Handle GraphQL errors
  - [ ] Display user-friendly messages
  - [ ] Log errors for debugging

- [ ] **REST Errors**
  - [ ] Handle HTTP status codes
  - [ ] Parse error responses
  - [ ] Handle rate limiting (429)
  - [ ] Retry with exponential backoff

### Rate Limiting ✓

- [ ] **Monitor Headers**
  - [ ] Track X-Requests-Allocated
  - [ ] Track X-Requests-Remaining
  - [ ] Track X-Request-Window-Resets-After
  - [ ] Implement backoff when approaching limit

### Testing ✓

- [ ] **Security Tests**
  - [ ] Test cross-company data access (should fail)
  - [ ] Test without authentication (should fail)
  - [ ] Test with expired token (should refresh)
  - [ ] Test role-based access

- [ ] **Integration Tests**
  - [ ] Test all GraphQL queries
  - [ ] Test all REST Management endpoints
  - [ ] Test pagination
  - [ ] Test error scenarios

---

## Implementation Priorities

### Phase 1: CRITICAL (Fix Immediately)

**Priority 1.1: Authentication Overhaul**
- [ ] Implement two-token system
- [ ] Store tokens server-side
- [ ] Update login flow (GraphQL mutation)
- [ ] Create internal JWT system
- [ ] Update all API calls

**Priority 1.2: Multi-Tenant Security**
- [ ] Add company filtering middleware
- [ ] Filter all data by companyId
- [ ] Verify resource ownership
- [ ] Test cross-company access prevention

**Estimated Time**: 3-4 days

---

### Phase 2: HIGH (Next Week)

**Priority 2.1: GraphQL Migration**
- [ ] Set up GraphQL client
- [ ] Migrate orders to GraphQL
- [ ] Migrate invoices to GraphQL
- [ ] Migrate quotes to GraphQL
- [ ] Implement pagination

**Priority 2.2: REST Management V3**
- [ ] Implement company management
- [ ] Implement user management
- [ ] Update headers and base URLs

**Estimated Time**: 5-7 days

---

### Phase 3: MEDIUM (Following Week)

**Priority 3.1: Advanced Features**
- [ ] Company hierarchy support
- [ ] Extra fields configuration
- [ ] Rate limiting handling
- [ ] Error handling improvements

**Priority 3.2: Testing & QA**
- [ ] Write security tests
- [ ] Write integration tests
- [ ] Manual testing
- [ ] Performance testing

**Estimated Time**: 3-5 days

---

### Phase 4: POLISH (Final Week)

**Priority 4.1: Documentation**
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Deployment guide

**Priority 4.2: Monitoring**
- [ ] Logging improvements
- [ ] Error tracking
- [ ] Performance monitoring

**Estimated Time**: 2-3 days

---

## Success Criteria

✅ **100% Conformance Achieved When**:

1. Using GraphQL Storefront API for all buyer portal operations
2. Using REST Management V3 for all backend operations
3. Following two-token authentication pattern exactly
4. All data filtered by company ID on server
5. No cross-company data leaks possible
6. Token refresh working automatically
7. Rate limiting handled properly
8. All error scenarios covered
9. Security tests passing
10. Performance acceptable
11. Documentation complete

---

## Resources

- **Main API Docs**: https://developer.bigcommerce.com/b2b-edition/apis
- **Authentication**: https://developer.bigcommerce.com/b2b-edition/docs/authentication
- **About APIs**: https://developer.bigcommerce.com/b2b-edition/docs/about
- **GraphQL Playground**: Access via B2B Edition control panel
- **REST API Reference**: Individual endpoint documentation pages

---

**Document Created**: October 22, 2025
**Status**: Ready for Implementation
**Total Estimated Time**: 15-20 days for full conformance
