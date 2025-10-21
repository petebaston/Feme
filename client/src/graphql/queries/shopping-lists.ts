import { gql } from '@apollo/client';

// Get all shopping lists
export const SHOPPING_LISTS_QUERY = gql`
  query ShoppingLists {
    customer {
      wishlists {
        edges {
          node {
            entityId
            name
            isPublic
            items {
              edges {
                node {
                  entityId
                  product {
                    entityId
                    name
                    prices {
                      price {
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
    }
  }
`;

// Get single shopping list detail
export const SHOPPING_LIST_DETAIL_QUERY = gql`
  query ShoppingListDetail($entityId: Int!) {
    customer {
      wishlist(entityId: $entityId) {
        entityId
        name
        isPublic
        items {
          edges {
            node {
              entityId
              product {
                entityId
                name
                sku
                path
                prices {
                  price {
                    value
                    currencyCode
                  }
                }
                defaultImage {
                  url(width: 300)
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Types
export interface ShoppingListProduct {
  entityId: number;
  name: string;
  sku?: string;
  path?: string;
  prices?: {
    price: {
      value: number;
      currencyCode: string;
    };
  };
  defaultImage?: {
    url: string;
    altText: string;
  };
}

export interface ShoppingListItem {
  entityId: number;
  product: ShoppingListProduct;
}

export interface ShoppingList {
  entityId: number;
  name: string;
  isPublic: boolean;
  items: {
    edges: Array<{
      node: ShoppingListItem;
    }>;
  };
}

export interface ShoppingListsResponse {
  customer: {
    wishlists: {
      edges: Array<{
        node: ShoppingList;
      }>;
    };
  };
}

export interface ShoppingListDetailResponse {
  customer: {
    wishlist: ShoppingList;
  };
}

export interface ShoppingListDetailVariables {
  entityId: number;
}
