// Test BigCommerce API direct access
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const MANAGEMENT_TOKEN = process.env.BIGCOMMERCE_B2B_MANAGEMENT_TOKEN;
const B2B_API_URL = 'https://api-b2b.bigcommerce.com';
const CHANNEL_ID = '1';

async function testInvoicesAPI() {
  console.log('\n🧪 Testing BigCommerce Invoices API (v3)...');
  console.log('Store Hash:', STORE_HASH);
  console.log('Has Management Token:', !!MANAGEMENT_TOKEN);
  
  try {
    const url = `${B2B_API_URL}/api/v3/io/invoice-management/invoice`;
    console.log('\n📡 Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'authToken': MANAGEMENT_TOKEN,
        'X-Store-Hash': STORE_HASH,
        'X-Channel-Id': CHANNEL_ID,
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ SUCCESS! Found invoices:', data?.data?.list?.length || 0);
      if (data?.data?.list?.length > 0) {
        console.log('\nFirst invoice:', JSON.stringify(data.data.list[0], null, 2));
      }
      return data;
    } else {
      console.log('\n❌ FAILED');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

async function testOrdersAPI() {
  console.log('\n🧪 Testing BigCommerce Orders API...');
  
  try {
    const url = `${B2B_API_URL}/api/v2/orders`;
    console.log('\n📡 Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': ACCESS_TOKEN,
        'X-Store-Hash': STORE_HASH,
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ SUCCESS! Found orders:', data?.data?.list?.length || data?.data?.length || 0);
      if (data?.data?.list?.length > 0 || data?.data?.length > 0) {
        const orders = data.data.list || data.data;
        console.log('\nFirst order:', JSON.stringify(orders[0], null, 2));
      }
      return data;
    } else {
      console.log('\n❌ FAILED');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

async function main() {
  await testOrdersAPI();
  await testInvoicesAPI();
}

main();
