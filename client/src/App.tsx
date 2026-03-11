import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApolloProvider } from "@apollo/client/react";
import { graphqlClient } from "./lib/graphql-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { useEffect, useState, useCallback } from "react";

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
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('b2b_token');

        if (!token) {
          console.log('[Auth] No access token, attempting refresh with cookie...');
          try {
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include',
            });

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              localStorage.setItem('b2b_token', data.accessToken);
              setIsAuthenticated(true);
              console.log('[Auth] Refreshed token successfully from cookie');
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.log('[Auth] Refresh from cookie failed');
          }
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        if (token) {
          try {
            const response = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
              setIsAuthenticated(true);
            } else if (response.status === 401) {
              try {
                const errorData = await response.json();
                if (errorData.reason === 'bigcommerce_token_missing') {
                  console.log('[Auth] BigCommerce token missing, redirecting to login');
                  localStorage.removeItem('b2b_token');
                  localStorage.removeItem('b2b_user');
                  setIsAuthenticated(false);
                  window.location.href = '/login?expired=true';
                  return;
                }
              } catch (e) {}

              console.log('[Auth] Token expired, attempting refresh...');
              const refreshResponse = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include',
              });

              if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                localStorage.setItem('b2b_token', data.accessToken);
                setIsAuthenticated(true);
                console.log('[Auth] Token refreshed successfully');
              } else {
                console.log('[Auth] Refresh failed, redirecting to login');
                localStorage.removeItem('b2b_token');
                localStorage.removeItem('b2b_user');
                setIsAuthenticated(false);
                window.location.href = '/login?expired=true';
              }
            }
          } catch (error) {
            console.error('[Auth] Token validation failed:', error);
            localStorage.removeItem('b2b_token');
            localStorage.removeItem('b2b_user');
            setIsAuthenticated(false);
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

  const handleLogout = useCallback(async () => {
    try {
      const token = localStorage.getItem('b2b_token');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch (_) {}
    localStorage.removeItem('b2b_token');
    localStorage.removeItem('user');
    localStorage.removeItem('b2b_user');
    const logoutImg = new Image();
    logoutImg.src = 'https://feme-limited-sandbox.mybigcommerce.com/login.php?action=logout&t=' + Date.now();
    await new Promise(resolve => setTimeout(resolve, 500));
    window.top
      ? (window.top.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/')
      : (window.location.href = 'https://feme-limited-sandbox.mybigcommerce.com/');
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
      <Header onLogout={handleLogout} />
      <div className="flex">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 md:ml-44 px-4 py-4 md:px-8 md:py-6 pb-20 md:pb-6 bg-white min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)]">
          <Switch>
            <Route path="/" component={Dashboard} />
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
