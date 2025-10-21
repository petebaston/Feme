import { useMutation } from '@apollo/client';
import { useLocation } from 'wouter';
import {
  LOGIN_MUTATION,
  LOGOUT_MUTATION,
  LoginVariables,
  LoginResponse,
  LogoutResponse
} from '@/graphql/mutations/auth';
import { clearGraphQLCache } from '@/lib/graphql-client';

export function useLogin() {
  const [, setLocation] = useLocation();

  const [loginMutation, { data, loading, error }] = useMutation<LoginResponse, LoginVariables>(
    LOGIN_MUTATION,
    {
      onCompleted: (data) => {
        if (data.login.result.customerAccessToken) {
          const token = data.login.result.customerAccessToken.value;
          const customer = data.login.result.customer;

          // Store token
          localStorage.setItem('b2b_token', token);

          // Store user info
          localStorage.setItem('user', JSON.stringify({
            id: customer.entityId,
            email: customer.email,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            firstName: customer.firstName,
            lastName: customer.lastName,
            companyId: customer.company?.entityId,
            companyName: customer.company?.name,
          }));

          // Navigate to dashboard
          setLocation('/dashboard');
        }
      },
      onError: (error) => {
        console.error('Login error:', error);
        localStorage.removeItem('b2b_token');
        localStorage.removeItem('user');
      }
    }
  );

  const login = async (email: string, password: string) => {
    try {
      await loginMutation({
        variables: { email, password }
      });
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  };

  return {
    login,
    loading,
    error,
    data
  };
}

export function useLogout() {
  const [, setLocation] = useLocation();

  const [logoutMutation, { loading, error }] = useMutation<LogoutResponse>(
    LOGOUT_MUTATION,
    {
      onCompleted: () => {
        // Clear local storage
        localStorage.removeItem('b2b_token');
        localStorage.removeItem('user');

        // Clear GraphQL cache
        clearGraphQLCache();

        // Navigate to login
        setLocation('/login');
      },
      onError: (error) => {
        console.error('Logout error:', error);
        // Even on error, clear local data
        localStorage.removeItem('b2b_token');
        localStorage.removeItem('user');
        clearGraphQLCache();
        setLocation('/login');
      }
    }
  );

  const logout = async () => {
    try {
      await logoutMutation();
    } catch (err) {
      console.error('Logout failed:', err);
      // Continue with local cleanup even if API fails
    }
  };

  return {
    logout,
    loading,
    error
  };
}
