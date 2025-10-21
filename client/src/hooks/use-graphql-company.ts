import { useQuery } from '@apollo/client';
import {
  CURRENT_USER_QUERY,
  COMPANY_QUERY,
  COMPANY_USERS_QUERY,
  CurrentUserResponse,
  CompanyResponse,
} from '@/graphql/queries/customer';

// Hook to get current user info
export function useCurrentUser() {
  const { data, loading, error, refetch } = useQuery<CurrentUserResponse>(
    CURRENT_USER_QUERY
  );

  const user = data?.customer;
  const company = user?.company;

  return {
    user,
    company,
    loading,
    error,
    refetch,
  };
}

// Hook to get full company details
export function useCompany() {
  const { data, loading, error, refetch } = useQuery<CompanyResponse>(
    COMPANY_QUERY
  );

  const company = data?.customer?.company;
  const addresses = company?.addresses?.edges?.map((edge) => edge.node) || [];

  return {
    company,
    addresses,
    loading,
    error,
    refetch,
  };
}

// Hook to get company users
export function useCompanyUsers() {
  const { data, loading, error, refetch } = useQuery(COMPANY_USERS_QUERY);

  const users = data?.customer?.company?.users?.edges?.map((edge: any) => edge.node) || [];

  return {
    users,
    loading,
    error,
    refetch,
  };
}

// Transform company data for legacy compatibility
export function transformCompanyForLegacy(company: any) {
  if (!company) return null;

  return {
    id: company.entityId,
    companyId: company.entityId,
    name: company.name,
    customerGroupId: company.customerGroupId,
    customFields: company.extraFields || [],
    hasCustomFields: (company.extraFields?.length || 0) > 0,
  };
}
