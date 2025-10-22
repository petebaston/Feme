#!/usr/bin/env node

const API_BASE = 'http://localhost:5000';
const EMAIL = 'afrowholesaledirect@FEME.com';
const PASSWORD = 'Beauty_F3m3!';

async function testOrdersFlow() {
  console.log('=== Testing Orders Flow ===\n');
  
  // Step 1: Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  
  if (!loginRes.ok) {
    console.error('❌ Login failed:', loginRes.status);
    const error = await loginRes.text();
    console.error('Error:', error);
    process.exit(1);
  }
  
  const loginData = await loginRes.json();
  console.log('✅ Login successful');
  console.log('   User:', loginData.user?.email);
  console.log('   Access Token:', loginData.accessToken ? 'Present' : 'Missing');
  
  const token = loginData.accessToken;
  
  // Step 2: Fetch Orders
  console.log('\n2. Fetching orders...');
  const ordersRes = await fetch(`${API_BASE}/api/orders`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!ordersRes.ok) {
    console.error('❌ Orders fetch failed:', ordersRes.status);
    const error = await ordersRes.text();
    console.error('Error:', error);
    process.exit(1);
  }
  
  const orders = await ordersRes.json();
  console.log('✅ Orders fetched successfully');
  console.log('   Count:', orders.length);
  
  if (orders.length > 0) {
    console.log('\n📦 Sample Order:');
    console.log(JSON.stringify(orders[0], null, 2));
  } else {
    console.log('\n⚠️  No orders returned (empty array)');
  }
  
  // Step 3: Fetch Company Orders
  console.log('\n3. Fetching company orders...');
  const companyOrdersRes = await fetch(`${API_BASE}/api/company-orders`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!companyOrdersRes.ok) {
    console.error('❌ Company orders fetch failed:', companyOrdersRes.status);
    const error = await companyOrdersRes.text();
    console.error('Error:', error);
  } else {
    const companyOrders = await companyOrdersRes.json();
    console.log('✅ Company orders fetched successfully');
    console.log('   Count:', companyOrders.length);
  }
  
  // Step 4: Fetch Invoices (for comparison)
  console.log('\n4. Fetching invoices (for comparison)...');
  const invoicesRes = await fetch(`${API_BASE}/api/invoices`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!invoicesRes.ok) {
    console.error('❌ Invoices fetch failed:', invoicesRes.status);
  } else {
    const invoices = await invoicesRes.json();
    console.log('✅ Invoices fetched successfully');
    console.log('   Count:', invoices.length);
  }
  
  console.log('\n=== Test Complete ===');
}

testOrdersFlow().catch(console.error);
