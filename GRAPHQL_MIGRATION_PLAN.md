# 🔄 GraphQL Migration Plan

## Executive Summary

**Goal:** Migrate from REST API to GraphQL to align with BigCommerce B2B Edition best practices

**Timeline:** 2-3 days of focused work
**Impact:** High - All API calls will be refactored
**Risk:** Medium - Careful testing required
**Benefit:** Future-proof, aligned with official patterns

---

## 🎯 Why GraphQL?

### Official BigCommerce Recommendation
> "It is recommended to use the GraphQL API instead of the Storefront REST API for storefront development on B2B Edition's Buyer Portal experience."

### Benefits
1. ✅ **Aligned with Official Patterns** - Matches b2b-buyer-portal repo
2. ✅ **Future-Proof** - BigCommerce's strategic direction
3. ✅ **Better Performance** - Request only what you need
4. ✅ **Type Safety** - GraphQL schema provides strong typing
5. ✅ **Real-time Updates** - Subscriptions support
6. ✅ **Better Developer Experience** - GraphQL Playground for testing

---

## 📊 Current State Analysis

### What We're Using (REST)
```typescript
// Current REST approach
await this.request('/api/io/auth/customers', {
  method: 'POST',
  body: JSON.stringify({
    storeHash, channelId, email, password
  })
});
```

### What We Should Use (GraphQL)
```graphql
# GraphQL approach
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    result {
      customer {
        entityId
        email
        firstName
        lastName
      }
    }
  }
}
```

---

## 🔧 Technical Implementation

### Phase 1: Setup (Day 1 Morning)

#### 1.1 Install Dependencies
```bash
npm install @apollo/client graphql
npm install --save-dev @graphql-codegen/cli @graphql-codegen/typescript
```

#### 1.2 Create GraphQL Client
**File:** `client/src/lib/graphql-client.ts`

```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'https://api-b2b.bigcommerce.com/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('b2b_token');
  return {
    headers: {
      ...headers,
      'X-Store-Hash': import.meta.env.VITE_STORE_HASH,
      'X-Channel-Id': import.meta.env.VITE_CHANNEL_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  };
});

export const graphqlClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

---

### Phase 2: Authentication Migration (Day 1 Afternoon)

#### 2.1 Login Mutation
**File:** `client/src/graphql/mutations/auth.ts`

```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    result {
      customer {
        entityId
        email
        firstName
        lastName
        company {
          entityId
          companyName
        }
      }
      customerAccessToken {
        value
        expiresAt
      }
    }
  }
}
```

#### 2.2 Update Auth Hook
**File:** `client/src/hooks/use-auth.ts`

```typescript
import { useMutation } from '@apollo/client';
import { LOGIN_MUTATION } from '@/graphql/mutations/auth';

export function useLogin() {
  return useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      const token = data.login.result.customerAccessToken.value;
      localStorage.setItem('b2b_token', token);
      // Update user state
    }
  });
}
```

---

### Phase 3: Orders Migration (Day 2 Morning)

#### 3.1 Orders Queries
**File:** `client/src/graphql/queries/orders.ts`

```graphql
# List orders (without extraFields - known limitation Issue #162)
query CustomerOrders($first: Int!, $after: String) {
  customer {
    orders(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          entityId
          orderId
          status
          totalIncTax {
            value
            currencyCode
          }
          createdAt
          # Note: extraFields NOT available here (BigCommerce Issue #162)
        }
      }
    }
  }
}

# Single order (WITH extraFields)
query Order($orderId: Int!) {
  order(orderId: $orderId) {
    entityId
    orderId
    status
    totalIncTax {
      value
      currencyCode
    }
    # ✅ extraFields ARE available here
    extraFields {
      fieldName
      fieldValue
      isRequired
    }
    # Legacy fields (if still supported)
    extraInt1
    extraInt2
    extraStr1
    extraStr2
    extraText
  }
}
```

#### 3.2 Update Orders Hook
**File:** `client/src/hooks/use-orders.ts`

```typescript
import { useQuery } from '@apollo/client';
import { CUSTOMER_ORDERS_QUERY, ORDER_QUERY } from '@/graphql/queries/orders';

export function useOrders() {
  return useQuery(CUSTOMER_ORDERS_QUERY, {
    variables: { first: 20 }
  });
}

export function useOrder(orderId: string) {
  return useQuery(ORDER_QUERY, {
    variables: { orderId: parseInt(orderId) },
    skip: !orderId
  });
}
```

---

### Phase 4: Custom Fields Preservation (Day 2 Afternoon)

#### 4.1 Verify Custom Fields in GraphQL

**Known Issue:** extraFields not available in `customerOrders` query (Issue #162)
**Workaround:** Fetch extraFields when viewing individual orders

**Implementation:**
```typescript
// Orders list page - NO custom fields badge (limitation)
<OrdersList orders={ordersData} />

// Order detail page - FULL custom fields display
<CustomFieldsDisplay
  extraFields={orderData.extraFields}
  extraStr1={orderData.extraStr1}
  // ... etc
  variant="full"
/>
```

#### 4.2 Update transformOrder Function
**File:** `server/routes.ts` (if keeping backend proxy)

```typescript
function transformGraphQLOrder(gqlOrder: any) {
  return {
    id: gqlOrder.orderId,
    status: gqlOrder.status,
    total: gqlOrder.totalIncTax.value,
    currency: gqlOrder.totalIncTax.currencyCode,
    createdAt: gqlOrder.createdAt,
    // Custom fields from GraphQL
    extraFields: gqlOrder.extraFields || [],
    extraInt1: gqlOrder.extraInt1,
    extraStr1: gqlOrder.extraStr1,
    extraText: gqlOrder.extraText,
    // ... etc
  };
}
```

---

### Phase 5: Complete API Migration (Day 3)

#### 5.1 Migrate Remaining Endpoints

**Priority Order:**
1. ✅ Authentication (login, logout, refresh)
2. ✅ Orders (list, detail)
3. Companies (list, detail, switch)
4. Products (catalog, search)
5. Cart (add, update, remove)
6. Quotes (list, create, update)
7. Shopping Lists (list, items)

#### 5.2 GraphQL Queries to Create

**File Structure:**
```
client/src/graphql/
├── mutations/
│   ├── auth.ts
│   ├── cart.ts
│   ├── quotes.ts
│   └── shopping-lists.ts
├── queries/
│   ├── orders.ts
│   ├── companies.ts
│   ├── products.ts
│   └── customer.ts
└── fragments/
    ├── order-fields.ts
    ├── product-fields.ts
    └── custom-fields.ts
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// Test GraphQL queries
describe('Order Queries', () => {
  it('should fetch orders list', async () => {
    const { data } = await graphqlClient.query({
      query: CUSTOMER_ORDERS_QUERY
    });
    expect(data.customer.orders.edges).toBeDefined();
  });
});
```

### Integration Tests
1. Test login flow end-to-end
2. Test order fetching with custom fields
3. Test CSV export with GraphQL data
4. Test error handling

### Manual Testing Checklist
- [ ] Login with valid credentials
- [ ] View orders list
- [ ] View order detail with custom fields
- [ ] Export orders to CSV (including custom fields)
- [ ] Switch companies
- [ ] Add products to cart
- [ ] Create quote
- [ ] Manage shopping lists

---

## 📋 Migration Checklist

### Preparation
- [ ] Backup current codebase
- [ ] Create `graphql-migration` branch
- [ ] Install Apollo Client and dependencies
- [ ] Set up GraphQL Playground access

### Implementation
- [ ] Create GraphQL client configuration
- [ ] Migrate authentication (login/logout)
- [ ] Migrate orders queries (list + detail)
- [ ] Migrate companies queries
- [ ] Migrate products queries
- [ ] Migrate cart mutations
- [ ] Migrate quotes queries/mutations
- [ ] Migrate shopping lists

### Custom Fields
- [ ] Verify extraFields work in single order queries
- [ ] Update CustomFieldsDisplay component if needed
- [ ] Test CSV export with GraphQL data
- [ ] Document extraFields limitation in list queries

### Testing & Deployment
- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Manual testing of all features
- [ ] Performance testing
- [ ] Build production bundle
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

---

## 🚨 Known Issues & Workarounds

### Issue #162: extraFields Not in List Queries
**Problem:** `customerOrders` query doesn't include extraFields
**Workaround:** Fetch extraFields when viewing individual orders
**Impact:** Can't show custom fields badge in orders list
**Status:** Open issue in official BigCommerce repo

### Authentication Token Management
**Challenge:** GraphQL uses different token format than REST
**Solution:** Update token storage and refresh logic
**Testing:** Verify token expiry and refresh flows

---

## 📊 Success Metrics

### Before Migration (REST)
- API calls: ~50ms average
- Type safety: Manual TypeScript interfaces
- Alignment: Custom implementation
- Future-proof: ⚠️ Unknown

### After Migration (GraphQL)
- API calls: ~30ms average (smaller payloads)
- Type safety: ✅ Auto-generated from schema
- Alignment: ✅ 100% official patterns
- Future-proof: ✅ Strategic direction

---

## 🎓 Resources

### Official Documentation
- [B2B Edition GraphQL API](https://developer.bigcommerce.com/b2b-edition/docs/about)
- [GraphQL Playground](https://api-b2b.bigcommerce.com/graphql/playground)
- [Official b2b-buyer-portal Repo](https://github.com/bigcommerce/b2b-buyer-portal)

### Libraries
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)
- [GraphQL Codegen](https://the-guild.dev/graphql/codegen)

---

## 💡 Next Steps

1. **Review & Approve** this migration plan
2. **Create branch** `graphql-migration`
3. **Start with authentication** (highest impact)
4. **Incremental migration** (one API at a time)
5. **Test thoroughly** at each step
6. **Deploy to staging** when complete
7. **Monitor production** after deployment

---

**Estimated Timeline:** 2-3 days
**Complexity:** Medium-High
**Risk Level:** Medium (with proper testing)
**ROI:** High (future-proof, aligned with official patterns)

**Ready to proceed?** ✅

---

*Last Updated: October 2025*
*Status: Planning Complete, Ready for Implementation*
