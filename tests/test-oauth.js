// Test OAuth token generation for BigCommerce B2B
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const CLIENT_ID = process.env.BIGCOMMERCE_CLIENT_ID;
const CLIENT_SECRET = process.env.BIGCOMMERCE_CLIENT_SECRET;
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;

console.log('Config:', {
  storeHash: STORE_HASH,
  hasClientId: !!CLIENT_ID,
  hasClientSecret: !!CLIENT_SECRET,
  hasAccessToken: !!ACCESS_TOKEN,
});

async function testOAuthTokenGeneration() {
  console.log('\n🧪 Testing OAuth Token Generation...');
  
  // Try BigCommerce OAuth endpoint
  const url = `https://login.bigcommerce.com/oauth2/token`;
  console.log('URL:', url);
  
  const body = {
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'store_v2_orders store_v2_products'
  };
  
  console.log('Request body:', { ...body, client_secret: '***' });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text.substring(0, 1000));
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ OAuth token generated successfully!');
      return data;
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  return null;
}

async function testB2BOAuthEndpoint() {
  console.log('\n🧪 Testing B2B Edition OAuth endpoint...');
  
  // Try B2B Edition OAuth/auth endpoint
  const url = `https://api-b2b.bigcommerce.com/api/v3/io/auth/token`;
  console.log('URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Store-Hash': STORE_HASH,
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });
    
    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text.substring(0, 1000));
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ B2B OAuth token generated successfully!');
      return data;
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  return null;
}

async function testWithAccessTokenDirectly() {
  console.log('\n🧪 Testing if ACCESS_TOKEN works directly on Companies endpoint...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v3/io/companies';
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
  console.log('Response:', text.substring(0, 500));
  
  return response.ok;
}

async function main() {
  await testWithAccessTokenDirectly();
  await testOAuthTokenGeneration();
  await testB2BOAuthEndpoint();
}

main().catch(console.error);
