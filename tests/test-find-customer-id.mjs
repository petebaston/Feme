#!/usr/bin/env node

const API_BASE = 'http://localhost:5000';
const EMAIL = 'afrowholesaledirect@FEME.com';
const PASSWORD = 'Beauty_F3m3!';

async function findCustomerId() {
  console.log('=== Finding Customer ID ===\n');
  
  // Step 1: Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('✅ Login successful\n');
  
  // Step 2: Fetch Orders
  console.log('2. Fetching orders...');
  const ordersRes = await fetch(`${API_BASE}/api/orders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const orders = await ordersRes.json();
  console.log('✅ Got', orders.length, 'orders\n');
  
  if (orders.length > 0) {
    console.log('Order #116 details:');
    const order = orders[0];
    console.log(JSON.stringify(order, null, 2));
  }
}

findCustomerId().catch(console.error);
