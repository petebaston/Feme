import { gql } from '@apollo/client';

// List customer orders
// NOTE: extraFields NOT available in list query (BigCommerce limitation - Issue #162)
export const CUSTOMER_ORDERS_QUERY = gql`
  query CustomerOrders($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after) {
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
            orderedAt {
              utc
            }
            status {
              label
              value
            }
            subTotal {
              value
              currencyCode
            }
            totalIncTax {
              value
              currencyCode
            }
            consignments {
              shipping {
                edges {
                  node {
                    lineItems {
                      edges {
                        node {
                          entityId
                          productName
                          quantity
                        }
                      }
                    }
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

// Get single order with ALL details including extraFields
export const ORDER_DETAIL_QUERY = gql`
  query OrderDetail($orderId: Int!) {
    customer {
      order(orderId: $orderId) {
        entityId
        orderedAt {
          utc
        }
        status {
          label
          value
        }
        subTotal {
          value
          currencyCode
        }
        totalIncTax {
          value
          currencyCode
        }
        taxTotal {
          value
          currencyCode
        }
        shippingCostTotal {
          value
          currencyCode
        }
        consignments {
          shipping {
            edges {
              node {
                lineItems {
                  edges {
                    node {
                      entityId
                      productName
                      quantity
                      subTotalListPrice {
                        value
                        currencyCode
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
              }
            }
          }
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
        # Custom fields - ONLY available in single order query
        extraFields {
          name
          value
        }
      }
    }
  }
`;

// Types
export interface OrderMoney {
  value: number;
  currencyCode: string;
}

export interface OrderStatus {
  label: string;
  value: string;
}

export interface OrderLineItem {
  entityId: number;
  productName: string;
  quantity: number;
  subTotalListPrice?: OrderMoney;
}

export interface OrderAddress {
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

export interface ExtraField {
  name: string;
  value: string;
}

export interface Order {
  entityId: number;
  orderedAt: {
    utc: string;
  };
  status: OrderStatus;
  subTotal: OrderMoney;
  totalIncTax: OrderMoney;
  taxTotal?: OrderMoney;
  shippingCostTotal?: OrderMoney;
  consignments?: {
    shipping: {
      edges: Array<{
        node: {
          lineItems: {
            edges: Array<{
              node: OrderLineItem;
            }>;
          };
          shippingAddress?: OrderAddress;
        };
      }>;
    };
  };
  billingAddress?: OrderAddress;
  extraFields?: ExtraField[];
}

export interface CustomerOrdersResponse {
  customer: {
    orders: {
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
      };
      edges: Array<{
        cursor: string;
        node: Omit<Order, 'extraFields'>;
      }>;
    };
  };
}

export interface OrderDetailResponse {
  customer: {
    order: Order;
  };
}

export interface OrdersVariables {
  first: number;
  after?: string;
}

export interface OrderDetailVariables {
  orderId: number;
}
