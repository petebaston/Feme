import { gql } from '@apollo/client';

// Login mutation - BigCommerce B2B Edition GraphQL
export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      result {
        customer {
          entityId
          email
          firstName
          lastName
          company {
            entityId
            name
          }
        }
        customerAccessToken {
          value
          expiresAt
        }
      }
    }
  }
`;

// Logout mutation
export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout {
      result
    }
  }
`;

// Types for TypeScript
export interface LoginVariables {
  email: string;
  password: string;
}

export interface LoginResponse {
  login: {
    result: {
      customer: {
        entityId: number;
        email: string;
        firstName: string;
        lastName: string;
        company: {
          entityId: number;
          name: string;
        };
      };
      customerAccessToken: {
        value: string;
        expiresAt: string;
      };
    };
  };
}

export interface LogoutResponse {
  logout: {
    result: string;
  };
}
