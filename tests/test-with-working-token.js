// Test with the ACCESS_TOKEN that works for Companies
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;

async function testInvoices() {
  console.log('\n🧪 Testing Invoices with ACCESS_TOKEN...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/invoice-management/invoice';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': ACCESS_TOKEN,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text);
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS! Invoices data:', JSON.stringify(data, null, 2));
    return data;
  }
  return null;
}

async function testOrders() {
  console.log('\n🧪 Testing Orders (B2B) with ACCESS_TOKEN...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v2/orders';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': ACCESS_TOKEN,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text);
  
  if (response.ok && !text.includes('Invalid token')) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS! Orders data:', JSON.stringify(data, null, 2).substring(0, 1000));
    return data;
  }
  return null;
}

async function testStandardOrders() {
  console.log('\n🧪 Testing Standard BigCommerce Orders with ACCESS_TOKEN...');
  
  const url = `https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders`;
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': ACCESS_TOKEN,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS! Found', Array.isArray(data) ? data.length : '?', 'orders');
    if (Array.isArray(data) && data.length > 0) {
      console.log('First order:', JSON.stringify(data[0], null, 2).substring(0, 500));
    }
    return data;
  }
  return null;
}

async function main() {
  console.log('Testing with ACCESS_TOKEN...\n');
  
  const invoices = await testInvoices();
  const orders = await testOrders();
  const standardOrders = await testStandardOrders();
  
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('Invoices:', invoices ? '✅ WORKS' : '❌ FAILED');
  console.log('B2B Orders:', orders ? '✅ WORKS' : '❌ FAILED');
  console.log('Standard Orders:', standardOrders ? '✅ WORKS' : '❌ FAILED');
}

main().catch(console.error);
