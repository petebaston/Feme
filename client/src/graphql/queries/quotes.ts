import { gql } from '@apollo/client';

// List quotes
export const QUOTES_QUERY = gql`
  query Quotes($first: Int!, $after: String) {
    customer {
      quotes(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
            entityId
            createdAt {
              utc
            }
            updatedAt {
              utc
            }
            status
            grandTotal {
              value
              currencyCode
            }
            lineItems {
              edges {
                node {
                  entityId
                  productName
                  quantity
                  netPrice {
                    value
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Get single quote detail
export const QUOTE_DETAIL_QUERY = gql`
  query QuoteDetail($quoteId: Int!) {
    customer {
      quote(quoteId: $quoteId) {
        entityId
        createdAt {
          utc
        }
        updatedAt {
          utc
        }
        expiresAt {
          utc
        }
        status
        grandTotal {
          value
          currencyCode
        }
        subTotal {
          value
          currencyCode
        }
        taxTotal {
          value
          currencyCode
        }
        shippingTotal {
          value
          currencyCode
        }
        lineItems {
          edges {
            node {
              entityId
              productName
              sku
              quantity
              netPrice {
                value
                currencyCode
              }
              productOptions {
                name
                value
              }
            }
          }
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          stateOrProvince
          postalCode
          country
          phone
        }
        billingAddress {
          firstName
          lastName
          address1
          address2
          city
          stateOrProvince
          postalCode
          country
          phone
          email
        }
        extraFields {
          name
          value
        }
      }
    }
  }
`;

// Types
export interface QuoteMoney {
  value: number;
  currencyCode: string;
}

export interface QuoteLineItem {
  entityId: number;
  productName: string;
  sku?: string;
  quantity: number;
  netPrice: QuoteMoney;
  productOptions?: Array<{
    name: string;
    value: string;
  }>;
}

export interface QuoteAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface Quote {
  entityId: number;
  createdAt: {
    utc: string;
  };
  updatedAt: {
    utc: string;
  };
  expiresAt?: {
    utc: string;
  };
  status: string;
  grandTotal: QuoteMoney;
  subTotal?: QuoteMoney;
  taxTotal?: QuoteMoney;
  shippingTotal?: QuoteMoney;
  lineItems: {
    edges: Array<{
      node: QuoteLineItem;
    }>;
  };
  shippingAddress?: QuoteAddress;
  billingAddress?: QuoteAddress;
  extraFields?: Array<{
    name: string;
    value: string;
  }>;
}

export interface QuotesResponse {
  customer: {
    quotes: {
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
      };
      edges: Array<{
        cursor: string;
        node: Omit<Quote, 'subTotal' | 'taxTotal' | 'shippingTotal' | 'shippingAddress' | 'billingAddress' | 'extraFields'>;
      }>;
    };
  };
}

export interface QuoteDetailResponse {
  customer: {
    quote: Quote;
  };
}

export interface QuotesVariables {
  first: number;
  after?: string;
}

export interface QuoteDetailVariables {
  quoteId: number;
}
