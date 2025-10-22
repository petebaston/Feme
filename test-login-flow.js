// Test complete login flow with user credentials
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const EMAIL = 'afrowholesaledirect@FEME.com';
const PASSWORD = 'Beauty_F3m3!';

async function testLogin() {
  console.log('\n🔐 Step 1: Testing BigCommerce Login...');
  console.log('Email:', EMAIL);
  
  const url = 'https://api-b2b.bigcommerce.com/api/io/auth/customers';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      storeHash: STORE_HASH,
      channelId: 1,
      name: 'test token',
      email: EMAIL,
      password: PASSWORD,
    })
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 500));
  
  if (response.ok) {
    const data = JSON.parse(text);
    console.log('\n✅ LOGIN SUCCESS!');
    
    if (data?.data?.token) {
      console.log('Token received:', data.data.token.substring(0, 50) + '...');
      return data.data.token;
    } else if (data?.token) {
      console.log('Token received:', data.token.substring(0, 50) + '...');
      return data.token;
    }
  } else {
    console.log('\n❌ LOGIN FAILED');
  }
  
  return null;
}

async function testOrdersWithToken(token) {
  console.log('\n📦 Step 2: Testing Orders with User Token...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v2/orders';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok) {
    const data = JSON.parse(text);
    const ordersList = data?.data?.list || data?.data || [];
    console.log('\n✅ ORDERS SUCCESS! Found', ordersList.length, 'orders');
    
    if (ordersList.length > 0) {
      console.log('\nFirst order sample:');
      console.log(JSON.stringify(ordersList[0], null, 2).substring(0, 500));
    }
    return data;
  } else {
    console.log('\n❌ ORDERS FAILED');
  }
  
  return null;
}

async function testInvoicesWithToken(token) {
  console.log('\n🧾 Step 3: Testing Invoices with User Token...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/invoice-management/invoice';
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'authToken': token,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  if (response.ok) {
    const data = JSON.parse(text);
    const invoicesList = data?.data?.list || [];
    console.log('\n✅ INVOICES SUCCESS! Found', invoicesList.length, 'invoices');
    
    if (invoicesList.length > 0) {
      console.log('\nFirst invoice sample:');
      console.log(JSON.stringify(invoicesList[0], null, 2).substring(0, 500));
    }
    return data;
  } else {
    console.log('\n❌ INVOICES FAILED');
  }
  
  return null;
}

async function main() {
  console.log('========================================');
  console.log('TESTING COMPLETE LOGIN FLOW');
  console.log('========================================');
  
  const token = await testLogin();
  
  if (!token) {
    console.log('\n❌ Cannot proceed - login failed');
    return;
  }
  
  const orders = await testOrdersWithToken(token);
  const invoices = await testInvoicesWithToken(token);
  
  console.log('\n========================================');
  console.log('FINAL RESULTS');
  console.log('========================================');
  console.log('Login:', token ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Orders:', orders ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Invoices:', invoices ? '✅ SUCCESS' : '❌ FAILED');
  
  if (token && (orders || invoices)) {
    console.log('\n✅✅✅ PROOF: User login + token = Data flows! ✅✅✅');
  }
}

main().catch(console.error);
