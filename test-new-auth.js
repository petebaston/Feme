// Test NEW authentication approach (X-Auth-Token for everything)
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const MANAGEMENT_TOKEN = process.env.BIGCOMMERCE_B2B_MANAGEMENT_TOKEN;

async function testInvoicesNewAuth() {
  console.log('\n🧪 Testing Invoices with NEW X-Auth-Token (Management Token)...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/invoice-management/invoice';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': MANAGEMENT_TOKEN,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS! Found', data?.data?.list?.length || data?.list?.length || 0, 'invoices');
    return data;
  }
  return null;
}

async function testOrdersNewAuth() {
  console.log('\n🧪 Testing Orders with NEW X-Auth-Token (Management Token)...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v2/orders';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': MANAGEMENT_TOKEN,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok && !text.includes('Invalid token')) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS!');
    return data;
  }
  return null;
}

async function testCompanyEndpoint() {
  console.log('\n🧪 Testing Company endpoint (should work with Management Token)...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/companies';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': MANAGEMENT_TOKEN,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS!');
    return data;
  }
  return null;
}

async function main() {
  console.log('Testing with Management Token:', MANAGEMENT_TOKEN ? 'exists' : 'MISSING');
  console.log('Store Hash:', STORE_HASH);
  
  await testCompanyEndpoint();
  await testInvoicesNewAuth();
  await testOrdersNewAuth();
}

main().catch(console.error);
