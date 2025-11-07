import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Use backend GraphQL proxy instead of calling BigCommerce directly
// This ensures proper token management and security
const httpLink = createHttpLink({
  uri: '/api/graphql',
});

// Authentication link - adds portal JWT token to headers
// Backend proxy will exchange this for the correct BigCommerce token
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('b2b_token');

  return {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  };
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL Error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`,
        extensions
      );

      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED' || message.includes('Unauthorized')) {
        localStorage.removeItem('b2b_token');
        localStorage.removeItem('b2b_user');
        window.location.href = '/login';
      }
    });
  }

  if (networkError) {
    console.error(`[Network Error]: ${networkError.message}`, networkError);
  }
});

// Combine links
const link = ApolloLink.from([errorLink, authLink, httpLink]);

// Create Apollo Client
export const graphqlClient = new ApolloClient({
  link,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Custom cache policies can be added here
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

// Helper to clear cache on logout
export const clearGraphQLCache = () => {
  graphqlClient.clearStore();
};
