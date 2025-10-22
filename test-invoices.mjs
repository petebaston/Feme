#!/usr/bin/env node

const API_BASE = 'http://localhost:5000';
const EMAIL = 'afrowholesaledirect@FEME.com';
const PASSWORD = 'Beauty_F3m3!';

async function testInvoices() {
  console.log('=== Testing Invoices ===\n');
  
  // Step 1: Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  
  const loginData = await loginRes.json();
  console.log('✅ Login successful');
  const token = loginData.accessToken;
  
  // Step 2: Fetch Invoices
  console.log('\n2. Fetching invoices...');
  const invoicesRes = await fetch(`${API_BASE}/api/invoices`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!invoicesRes.ok) {
    console.error('❌ Invoices fetch failed:', invoicesRes.status);
    const error = await invoicesRes.text();
    console.error('Error:', error);
    process.exit(1);
  }
  
  const invoices = await invoicesRes.json();
  console.log('✅ Invoices fetched successfully');
  console.log('   Count:', invoices.length);
  
  if (invoices.length > 0) {
    console.log('\n📄 Invoices List:');
    invoices.forEach((invoice, i) => {
      const costLines = invoice.details?.header?.costLines || [];
      const subtotal = costLines.find(l => l.description === 'Subtotal')?.amount?.value || 0;
      const tax = costLines.find(l => l.description === 'Sales Tax')?.amount?.value || 0;
      const total = parseFloat(subtotal) + parseFloat(tax);
      
      console.log(`\n   Invoice ${i + 1}:`);
      console.log('     Number:', invoice.invoiceNumber);
      console.log('     Customer ID:', invoice.customerId);
      console.log('     Order #:', invoice.orderNumber);
      console.log('     Status:', invoice.status, `(${invoice.status === 0 ? 'Open' : invoice.status === 1 ? 'Paid' : 'Overdue'})`);
      console.log('     Total:', `£${total.toFixed(2)}`);
      console.log('     Due Date:', new Date(invoice.dueDate * 1000).toLocaleDateString());
    });
  } else {
    console.log('\n⚠️  No invoices returned');
  }
  
  console.log('\n=== Test Complete ===');
}

testInvoices().catch(console.error);
