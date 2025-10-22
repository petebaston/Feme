// Test CORRECT invoice endpoint from Management API
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const MANAGEMENT_TOKEN = process.env.BIGCOMMERCE_B2B_MANAGEMENT_TOKEN;

async function testInvoicesManagementAPI() {
  console.log('\n🧾 Testing CORRECT Invoice Management API endpoint...');
  
  // Try list endpoint first
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/ip/invoices';
  console.log('URL:', url);
  console.log('Using X-Auth-Token (ACCESS_TOKEN)');
  
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
    const invoicesList = data?.data?.list || data?.data || [];
    console.log('\n✅ INVOICES SUCCESS! Found', invoicesList.length, 'invoices');
    
    if (invoicesList.length > 0) {
      console.log('\nFirst invoice:');
      console.log(JSON.stringify(invoicesList[0], null, 2).substring(0, 800));
    }
    return data;
  }
  
  return null;
}

async function testWithManagementToken() {
  console.log('\n🧾 Testing with MANAGEMENT_TOKEN...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/ip/invoices';
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
  console.log('Response:', text);
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ SUCCESS with Management Token!');
    return data;
  }
  
  return null;
}

async function main() {
  console.log('Config:', {
    storeHash: STORE_HASH,
    hasAccessToken: !!ACCESS_TOKEN,
    hasManagementToken: !!MANAGEMENT_TOKEN
  });
  
  const result1 = await testInvoicesManagementAPI();
  const result2 = await testWithManagementToken();
  
  console.log('\n========================================');
  console.log('RESULTS');
  console.log('========================================');
  console.log('With ACCESS_TOKEN:', result1 ? '✅ WORKS' : '❌ FAILED');
  console.log('With MANAGEMENT_TOKEN:', result2 ? '✅ WORKS' : '❌ FAILED');
}

main().catch(console.error);
