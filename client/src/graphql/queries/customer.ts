import { gql } from '@apollo/client';

// Get current user information
export const CURRENT_USER_QUERY = gql`
  query CurrentUser {
    customer {
      entityId
      email
      firstName
      lastName
      company {
        entityId
        name
        customerGroupId
        extraFields {
          fieldName
          fieldValue
        }
      }
      customerGroupId
    }
  }
`;

// Get company information with full details
export const COMPANY_QUERY = gql`
  query Company {
    customer {
      company {
        entityId
        name
        customerGroupId
        extraFields {
          fieldName
          fieldValue
        }
        addresses {
          edges {
            node {
              entityId
              firstName
              lastName
              address1
              address2
              city
              stateOrProvince
              postalCode
              country
              countryCode
              phone
            }
          }
        }
      }
    }
  }
`;

// Get company users
export const COMPANY_USERS_QUERY = gql`
  query CompanyUsers {
    customer {
      company {
        users {
          edges {
            node {
              entityId
              email
              firstName
              lastName
              role
            }
          }
        }
      }
    }
  }
`;

// Types
export interface CurrentUserResponse {
  customer: {
    entityId: number;
    email: string;
    firstName: string;
    lastName: string;
    company: {
      entityId: number;
      name: string;
      customerGroupId: number;
      extraFields: Array<{
        fieldName: string;
        fieldValue: string;
      }>;
    };
    customerGroupId: number;
  };
}

export interface CompanyAddress {
  entityId: number;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
  countryCode: string;
  phone?: string;
}

export interface CompanyResponse {
  customer: {
    company: {
      entityId: number;
      name: string;
      customerGroupId: number;
      extraFields: Array<{
        fieldName: string;
        fieldValue: string;
      }>;
      addresses: {
        edges: Array<{
          node: CompanyAddress;
        }>;
      };
    };
  };
}
