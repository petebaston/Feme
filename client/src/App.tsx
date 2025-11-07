import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApolloProvider } from "@apollo/client/react";
import { graphqlClient } from "./lib/graphql-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { useEffect, useState } from "react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import MyOrders from "@/pages/my-orders";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Invoices from "@/pages/invoices";
import InvoiceDetail from "@/pages/invoice-detail";
import Addresses from "@/pages/addresses";
import UserManagement from "@/pages/user-management";
import AccountSettings from "@/pages/account-settings";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status and refresh token if needed
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('b2b_token');

        if (token) {
          // Try to verify token is still valid by making a lightweight API call
          try {
            const response = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (response.ok) {
              // Token is still valid
              setIsAuthenticated(true);
            } else if (response.status === 401) {
              // Token expired - try to refresh using remember me cookie
              console.log('[Auth] Token expired, attempting refresh...');
              const refreshResponse = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include', // Include cookies (refreshToken cookie)
              });

              if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                // Update token
                localStorage.setItem('b2b_token', data.accessToken);
                setIsAuthenticated(true);
                console.log('[Auth] Token refreshed successfully');
              } else {
                // Refresh failed - clear token and redirect to login
                console.log('[Auth] Refresh failed, redirecting to login');
                localStorage.removeItem('b2b_token');
                localStorage.removeItem('user');
                setIsAuthenticated(false);
              }
            }
          } catch (error) {
            console.error('[Auth] Token validation failed:', error);
            // If network error, assume token is still good
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route>
          <Login />
        </Route>
      </Switch>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 md:ml-44 px-8 py-6 bg-white min-h-[calc(100vh-4rem)]">
          <Switch>
            <Route path="/" component={MyOrders} />
            <Route path="/my-orders" component={MyOrders} />
            <Route path="/orders/:id" component={OrderDetail} />
            <Route path="/orders" component={Orders} />
            <Route path="/invoices/:id" component={InvoiceDetail} />
            <Route path="/invoices" component={Invoices} />
            <Route path="/addresses" component={Addresses} />
            <Route path="/user-management" component={UserManagement} />
            <Route path="/account-settings" component={AccountSettings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ApolloProvider client={graphqlClient}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;
