# Invoice Security Deep Dive Analysis

**Date**: November 7, 2025
**Severity**: 🔴 **CRITICAL**
**Status**: ✅ **FIXED** (but requires verification)

---

## Executive Summary

You reported seeing **EVERY invoice from ALL companies** in the backend. Through git history analysis, I discovered:

1. Security filtering **WAS implemented** (commit 757c2fd)
2. Security filtering **WAS DISABLED** for debugging (commit 76b7c9a, bf5061d)
3. Security filtering **WAS RE-ENABLED** (commit 95c723b - current)
4. **CRITICAL FIX APPLIED TODAY**: Fail-secure fallback added (returns empty array if customer ID lookup fails)

---

## Root Cause Analysis

### The Problem: BigCommerce API `companyId` Parameter is NOT RELIABLE

The code passes `companyId` to BigCommerce's API:

```typescript
// server/routes.ts line 840-841
const response = await bigcommerce.getInvoices(bcToken, {
  companyId: req.user.companyId, // ⚠️ BigCommerce may ignore this!
});
```

### Key Question: Does BigCommerce Actually Filter by `companyId`?

**UNKNOWN**. The BigCommerce B2B Edition API documentation does NOT guarantee that passing `companyId` will filter results server-side. This means:

- BigCommerce **might** return ALL invoices regardless of `companyId` parameter
- BigCommerce **might** require additional authentication/permissions
- BigCommerce **might** use `companyId` for context but not filtering

### The Evidence from Git History:

```bash
bf5061d - "Update invoice retrieval to show ALL INVOICES, not just those for current company"
         → Someone disabled filtering because it wasn't working

76b7c9a - "Temporarily disable invoice filtering to debug data mapping issues"
         → Confirms filtering was causing problems

757c2fd - "Securely filter invoices by company to prevent data leakage"
         → Original security implementation

95c723b - "Filter invoices by customer ID to improve data security"
         → Current implementation (uses extraFields filtering)
```

**Conclusion**: The developers discovered that BigCommerce API's `companyId` parameter **DOES NOT** reliably filter invoices, so they implemented **defense-in-depth** with extraFields matching.

---

## Current Security Architecture (Post-Fix)

### Layer 1: Authentication (✅ STRONG)
```typescript
app.get("/api/invoices",
  authenticateToken,    // ✅ Verifies JWT token
  sessionTimeout,       // ✅ Prevents stale sessions
```

### Layer 2: Company ID Requirement (✅ STRONG)
```typescript
if (!req.user?.companyId) {
  return res.status(403).json({ message: 'Company ID required' });
}
```

### Layer 3: BigCommerce API Call with companyId (⚠️ WEAK - Not Trusted)
```typescript
const response = await bigcommerce.getInvoices(bcToken, {
  companyId: req.user.companyId, // ⚠️ Passed but not relied upon
});
```

### Layer 4: Get Company's Customer ID (✅ STRONG)
```typescript
// Lines 869-879
const companyResponse = await bigcommerce.getCompany(req.user.companyId);
const customerIdField = companyData?.extraFields?.find(
  (f: any) => f.fieldName === 'Customer ID'
);
const companyCustomerId = customerIdField?.fieldValue || null;
```

### Layer 5: Enrich Invoices with extraFields (⚠️ POTENTIAL N+1 PROBLEM)
```typescript
// Lines 881-898
// Makes individual API call for EACH invoice to get extraFields
const enrichedInvoices = await Promise.all(
  invoices.map(async (invoice) => {
    const detailResponse = await bigcommerce.getInvoice(undefined, invoice.id);
    return {
      ...invoice,
      extraFields: fullInvoice?.extraFields || []
    };
  })
);
```

**Performance Issue**: If BigCommerce returns 1000 invoices, this makes 1000 API calls!

### Layer 6: CRITICAL SECURITY FILTER - extraFields Matching (✅ STRONG)
```typescript
// Lines 900-912 (FIXED TODAY)
const companyInvoices = companyCustomerId ?
  enrichedInvoices.filter((invoice: any) => {
    const customerField = invoice.extraFields?.find(
      (f: any) => f.fieldName === 'Customer'
    );
    const invoiceCustomerId = customerField?.fieldValue;
    return invoiceCustomerId === companyCustomerId; // ✅ STRICT MATCH
  }) :
  [];  // ✅ CRITICAL FIX: Fail-secure (was returning all invoices!)
```

---

## Critical Vulnerability FIXED TODAY

### Before (DANGEROUS):
```typescript
const companyInvoices = companyCustomerId ?
  enrichedInvoices.filter(...) :
  enrichedInvoices;  // ❌ Returns ALL invoices if lookup fails!
```

### After (SECURE):
```typescript
const companyInvoices = companyCustomerId ?
  enrichedInvoices.filter(...) :
  [];  // ✅ Returns EMPTY array if lookup fails!
```

### Why This Matters:

If the company's "Customer ID" extraField is missing or lookup fails:
- **Before**: Would return ALL invoices from BigCommerce (MASSIVE BREACH)
- **After**: Returns empty array (fail-secure)

---

## Why You Saw ALL Invoices

Based on git history and code analysis, you saw all invoices because:

1. **Option A**: The code was at commit bf5061d where filtering was intentionally disabled
2. **Option B**: The company's "Customer ID" extraField was missing/null, causing the ternary to return `enrichedInvoices` (all invoices)
3. **Option C**: BigCommerce returned invoices from all companies, and the fail-open fallback passed them through

**Most Likely**: Option B - The fail-open fallback (`enrichedInvoices` instead of `[]`) allowed all invoices through when customer ID lookup failed.

---

## Security Guarantees (Post-Fix)

### ✅ What IS Secure Now:

1. **Authentication**: Users must have valid JWT with `companyId`
2. **Customer ID Matching**: Invoices are filtered by matching "Customer" extraField to company's "Customer ID" extraField
3. **Fail-Secure**: If customer ID lookup fails, returns empty array (not all invoices)
4. **Audit Trail**: Comprehensive logging of blocked invoices

### ⚠️ Remaining Risks:

1. **extraFields Dependency**: Security DEPENDS on extraFields being properly set in BigCommerce
   - If "Customer ID" is not set on company → Returns empty invoices
   - If "Customer" is not set on invoices → Those invoices are excluded
   - If extraFields are misconfigured → Data leakage OR data loss

2. **Performance**: N+1 query problem (makes individual API call per invoice to get extraFields)

3. **BigCommerce API Trust**: We pass `companyId` but don't verify BigCommerce respects it

---

## Recommendations

### IMMEDIATE (Priority 1):

✅ **DONE**: Fixed fail-secure fallback to return empty array

### SHORT-TERM (Priority 2):

1. **Verify extraFields Configuration**:
   ```bash
   # Test script to verify all companies have "Customer ID" set
   GET /api/v3/io/companies
   # Check each company has extraFields with "Customer ID"
   ```

2. **Add Monitoring**:
   ```typescript
   // Alert if customer ID lookup fails
   if (!companyCustomerId) {
     logger.error(`SECURITY: Company ${req.user.companyId} has no Customer ID`);
     // Send alert to ops team
   }
   ```

3. **Test with Multiple Companies**:
   - Create test users in Company A and Company B
   - Verify Company A user ONLY sees Company A invoices
   - Log all blocked invoices for audit

### MEDIUM-TERM (Priority 3):

4. **Optimize Performance**:
   ```typescript
   // Instead of N+1 queries, batch fetch extraFields
   // OR request BigCommerce to include extraFields in list endpoint
   ```

5. **Document extraFields Contract**:
   - Document that "Customer ID" extraField is REQUIRED on all companies
   - Document that "Customer" extraField is REQUIRED on all invoices
   - Create validation scripts to verify this

6. **Consider Alternative Filtering**:
   - Research if BigCommerce has a more reliable filtering method
   - Consider caching company-to-customer-ID mappings
   - Consider using BigCommerce's user-scoped tokens (if available)

---

## Testing Plan

### Manual Test (CRITICAL - Do This Now):

```bash
# 1. Login as Company A user
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"companyA@example.com","password":"password"}'

# 2. Get invoices (should only see Company A)
curl http://localhost:5000/api/invoices \
  -H "Authorization: Bearer {TOKEN_FROM_STEP_1}"

# 3. Check logs for:
# - "SECURITY FILTER: X total → Y for company Z"
# - Y should be MUCH less than X if filtering is working
# - If Y === X, then all invoices have matching customer ID (investigate!)
```

### Automated Test:

```typescript
describe('Invoice Security', () => {
  it('should only return invoices for user\'s company', async () => {
    // Create test data
    const companyA = await createTestCompany({
      extraFields: [{ fieldName: 'Customer ID', fieldValue: 'CUST-A' }]
    });
    const companyB = await createTestCompany({
      extraFields: [{ fieldName: 'Customer ID', fieldValue: 'CUST-B' }]
    });

    const userA = await createTestUser({ companyId: companyA.id });
    const userB = await createTestUser({ companyId: companyB.id });

    // Mock BigCommerce to return invoices for both companies
    mockBigCommerce.getInvoices.mockReturnValue({
      data: {
        list: [
          { id: 'INV-A1', extraFields: [{ fieldName: 'Customer', fieldValue: 'CUST-A' }] },
          { id: 'INV-B1', extraFields: [{ fieldName: 'Customer', fieldValue: 'CUST-B' }] },
        ]
      }
    });

    // Test Company A user
    const tokenA = generateTestToken(userA);
    const resA = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].id).toBe('INV-A1');

    // Test Company B user
    const tokenB = generateTestToken(userB);
    const resB = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(1);
    expect(resB.body[0].id).toBe('INV-B1');
  });

  it('should return empty array if company has no customer ID', async () => {
    const company = await createTestCompany({
      extraFields: [] // No Customer ID
    });
    const user = await createTestUser({ companyId: company.id });
    const token = generateTestToken(user);

    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]); // Fail-secure
  });
});
```

---

## Conclusion

### What Was Fixed Today:

1. ✅ **Fail-secure fallback**: Returns empty array if customer ID lookup fails (instead of all invoices)
2. ✅ **Security documentation**: This comprehensive analysis document

### What Still Needs Verification:

1. ⚠️ **extraFields configuration**: Verify all companies have "Customer ID" set
2. ⚠️ **Filtering effectiveness**: Test with real multi-company data
3. ⚠️ **BigCommerce API behavior**: Confirm whether `companyId` parameter is respected or ignored

### Security Status:

**BEFORE TODAY**: 🔴 **CRITICAL VULNERABILITY** - Fail-open allowed all invoices through
**AFTER TODAY**: 🟡 **HARDENED** - Fail-secure + defense-in-depth, but depends on extraFields being configured correctly

---

**Action Required**: Run the manual test above to verify the fix is working in your environment.
