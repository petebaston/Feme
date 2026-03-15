// Test Invoice via GraphQL instead of REST
const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH || 'pyrenapwe2';
const EMAIL = 'afrowholesaledirect@FEME.com';
const PASSWORD = 'Beauty_F3m3!';

async function getToken() {
  const response = await fetch('https://api-b2b.bigcommerce.com/api/io/auth/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeHash: STORE_HASH,
      channelId: 1,
      name: 'test token',
      email: EMAIL,
      password: PASSWORD,
    })
  });
  
  const data = await response.json();
  return data?.data?.token || data?.token;
}

async function testInvoicesGraphQL(token) {
  console.log('\n🧾 Testing Invoices via GraphQL...');
  
  const query = `
    query {
      invoices {
        totalCount
        edges {
          node {
            id
            invoiceNumber
            status
            grandTotal
            dueDate
          }
        }
      }
    }
  `;
  
  const response = await fetch('https://api-b2b.bigcommerce.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Store-Hash': STORE_HASH,
    },
    body: JSON.stringify({ query })
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text);
  
  return response.ok;
}

async function testInvoicesREST(token) {
  console.log('\n🧾 Testing Invoices via REST Storefront API...');
  
  const url = 'https://api-b2b.bigcommerce.com/api/v2/invoices';
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Store-Hash': STORE_HASH,
      'Content-Type': 'application/json',
    }
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text.substring(0, 1000));
  
  return response.ok;
}

async function main() {
  const token = await getToken();
  console.log('Got token:', token.substring(0, 50) + '...');
  
  await testInvoicesGraphQL(token);
  await testInvoicesREST(token);
}

main().catch(console.error);
