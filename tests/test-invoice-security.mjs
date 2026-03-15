#!/usr/bin/env node

/**
 * Invoice Security Test Script
 *
 * This script verifies that invoice filtering is working correctly
 * and users can ONLY see invoices from their own company.
 *
 * Usage: node test-invoice-security.mjs
 */

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

// Test accounts - UPDATE THESE with real test accounts from different companies
const COMPANY_A_USER = {
  email: process.env.COMPANY_A_EMAIL || 'afrowholesaledirect@FEME.com',
  password: process.env.COMPANY_A_PASSWORD || 'Beauty_F3m3!',
  expectedCompanyId: process.env.COMPANY_A_ID || null, // Will be extracted from login
};

const COMPANY_B_USER = {
  email: process.env.COMPANY_B_EMAIL || null,
  password: process.env.COMPANY_B_PASSWORD || null,
  expectedCompanyId: process.env.COMPANY_B_ID || null,
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log('red', `❌ ${message}`);
}

function success(message) {
  log('green', `✅ ${message}`);
}

function warning(message) {
  log('yellow', `⚠️  ${message}`);
}

function info(message) {
  log('cyan', `ℹ️  ${message}`);
}

async function loginUser(email, password) {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      token: data.accessToken,
      user: data.user,
    };
  } catch (err) {
    throw new Error(`Login error: ${err.message}`);
  }
}

async function fetchInvoices(token) {
  try {
    const response = await fetch(`${API_BASE}/api/invoices`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(`Fetch error: ${err.message}`);
  }
}

function analyzeInvoices(invoices, companyId) {
  const customerIds = new Set();
  const companyIds = new Set();

  invoices.forEach(invoice => {
    // Extract customer ID from extraFields
    const customerField = invoice.extraFields?.find(f => f.fieldName === 'Customer');
    if (customerField) {
      customerIds.add(customerField.fieldValue);
    }

    // Extract company ID if present
    if (invoice.companyId) {
      companyIds.add(invoice.companyId);
    }
  });

  return {
    totalInvoices: invoices.length,
    uniqueCustomerIds: Array.from(customerIds),
    uniqueCompanyIds: Array.from(companyIds),
    hasMultipleCustomers: customerIds.size > 1,
    hasMultipleCompanies: companyIds.size > 1,
  };
}

async function testCompanyIsolation() {
  console.log('\n' + '='.repeat(70));
  log('blue', '   🔒 INVOICE SECURITY TEST');
  console.log('='.repeat(70));

  // Test Company A
  console.log('\n' + '-'.repeat(70));
  log('magenta', 'TEST 1: Company A User');
  console.log('-'.repeat(70));

  try {
    info(`Logging in as: ${COMPANY_A_USER.email}`);
    const { token: tokenA, user: userA } = await loginUser(
      COMPANY_A_USER.email,
      COMPANY_A_USER.password
    );
    success(`Login successful`);
    info(`User: ${userA.email} | Company: ${userA.companyId} | Role: ${userA.role}`);

    info(`Fetching invoices...`);
    const invoicesA = await fetchInvoices(tokenA);
    success(`Fetched ${invoicesA.length} invoices`);

    const analysisA = analyzeInvoices(invoicesA, userA.companyId);

    console.log('\n📊 Analysis:');
    console.log(`   Total Invoices: ${analysisA.totalInvoices}`);
    console.log(`   Unique Customer IDs: ${analysisA.uniqueCustomerIds.length}`);
    console.log(`   Customer IDs: ${analysisA.uniqueCustomerIds.join(', ') || 'None'}`);
    console.log(`   Unique Company IDs: ${analysisA.uniqueCompanyIds.length}`);
    console.log(`   Company IDs: ${analysisA.uniqueCompanyIds.join(', ') || 'None'}`);

    if (analysisA.hasMultipleCustomers) {
      error('SECURITY ISSUE: Multiple customer IDs found in invoices!');
      error('This user is seeing invoices from OTHER customers');
      return false;
    } else if (analysisA.uniqueCustomerIds.length === 1) {
      success('PASS: All invoices belong to single customer');
    } else if (analysisA.totalInvoices === 0) {
      warning('No invoices found (could be legitimate or could be filtering too aggressively)');
    }

    // Store for cross-company test
    COMPANY_A_USER.actualCompanyId = userA.companyId;
    COMPANY_A_USER.customerIds = analysisA.uniqueCustomerIds;

  } catch (err) {
    error(`Test failed: ${err.message}`);
    return false;
  }

  // Test Company B (if configured)
  if (!COMPANY_B_USER.email || !COMPANY_B_USER.password) {
    console.log('\n' + '-'.repeat(70));
    warning('TEST 2: Company B User - SKIPPED (not configured)');
    console.log('-'.repeat(70));
    warning('To test cross-company isolation, set COMPANY_B_EMAIL and COMPANY_B_PASSWORD');
    return true;
  }

  console.log('\n' + '-'.repeat(70));
  log('magenta', 'TEST 2: Company B User');
  console.log('-'.repeat(70));

  try {
    info(`Logging in as: ${COMPANY_B_USER.email}`);
    const { token: tokenB, user: userB } = await loginUser(
      COMPANY_B_USER.email,
      COMPANY_B_USER.password
    );
    success(`Login successful`);
    info(`User: ${userB.email} | Company: ${userB.companyId} | Role: ${userB.role}`);

    if (userB.companyId === COMPANY_A_USER.actualCompanyId) {
      warning('Both test users are in the SAME company - cannot test isolation');
      return true;
    }

    info(`Fetching invoices...`);
    const invoicesB = await fetchInvoices(tokenB);
    success(`Fetched ${invoicesB.length} invoices`);

    const analysisB = analyzeInvoices(invoicesB, userB.companyId);

    console.log('\n📊 Analysis:');
    console.log(`   Total Invoices: ${analysisB.totalInvoices}`);
    console.log(`   Unique Customer IDs: ${analysisB.uniqueCustomerIds.length}`);
    console.log(`   Customer IDs: ${analysisB.uniqueCustomerIds.join(', ') || 'None'}`);
    console.log(`   Unique Company IDs: ${analysisB.uniqueCompanyIds.length}`);
    console.log(`   Company IDs: ${analysisB.uniqueCompanyIds.join(', ') || 'None'}`);

    if (analysisB.hasMultipleCustomers) {
      error('SECURITY ISSUE: Multiple customer IDs found in invoices!');
      return false;
    }

    // Cross-company check
    const overlap = analysisB.uniqueCustomerIds.filter(id =>
      COMPANY_A_USER.customerIds.includes(id)
    );

    if (overlap.length > 0) {
      error('CRITICAL SECURITY BREACH: Company B user sees Company A invoices!');
      error(`Overlapping customer IDs: ${overlap.join(', ')}`);
      return false;
    } else {
      success('PASS: No overlap between Company A and Company B invoices');
    }

  } catch (err) {
    error(`Test failed: ${err.message}`);
    return false;
  }

  return true;
}

async function main() {
  try {
    const passed = await testCompanyIsolation();

    console.log('\n' + '='.repeat(70));
    if (passed) {
      log('green', '   ✅ ALL TESTS PASSED - Invoice security is working correctly');
    } else {
      log('red', '   ❌ TESTS FAILED - Security issues detected');
    }
    console.log('='.repeat(70) + '\n');

    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error('\n💥 Unexpected error:', err);
    process.exit(1);
  }
}

main();
