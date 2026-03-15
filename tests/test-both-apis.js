// Test BOTH BigCommerce APIs to find which works for orders/invoices
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const MANAGEMENT_TOKEN = process.env.BIGCOMMERCE_B2B_MANAGEMENT_TOKEN;

console.log('Config:', {
  storeHash: STORE_HASH,
  hasAccessToken: !!ACCESS_TOKEN,
  hasManagementToken: !!MANAGEMENT_TOKEN
});

// Test 1: Standard BigCommerce Orders API (server-to-server)
async function testStandardBigCommerceOrders() {
  console.log('\n========================================');
  console.log('TEST 1: Standard BigCommerce Orders V2 API');
  console.log('========================================');
  
  const url = `https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders`;
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS! Found', Array.isArray(data) ? data.length : '?', 'orders');
    if (Array.isArray(data) && data.length > 0) {
      console.log('\nFirst order sample:', JSON.stringify(data[0], null, 2).substring(0, 500));
    }
    return data;
  }
  return null;
}

// Test 2: B2B Edition Orders API (might need user token)
async function testB2BEditionOrders() {
  console.log('\n========================================');
  console.log('TEST 2: B2B Edition Orders API');
  console.log('========================================');
  
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
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok && text && !text.includes('Invalid token')) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS!');
    return data;
  }
  return null;
}

// Test 3: B2B Edition Invoices (v3 Management API)
async function testB2BInvoices() {
  console.log('\n========================================');
  console.log('TEST 3: B2B Edition Invoice Management API');
  console.log('========================================');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/invoice-management/invoice';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'authToken': MANAGEMENT_TOKEN,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS! Found', data?.data?.list?.length || 0, 'invoices');
    if (data?.data?.list?.length > 0) {
      console.log('\nFirst invoice sample:', JSON.stringify(data.data.list[0], null, 2).substring(0, 500));
    }
    return data;
  }
  return null;
}

async function main() {
  const orders1 = await testStandardBigCommerceOrders();
  const orders2 = await testB2BEditionOrders();
  const invoices = await testB2BInvoices();
  
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('Standard BigCommerce Orders API:', orders1 ? '✅ WORKS' : '❌ FAILED');
  console.log('B2B Edition Orders API:', orders2 ? '✅ WORKS' : '❌ FAILED');
  console.log('B2B Edition Invoices API:', invoices ? '✅ WORKS' : '❌ FAILED');
}

main().catch(console.error);
