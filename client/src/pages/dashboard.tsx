import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/stats'],
    staleTime: 300000, // 5 minutes
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ['/api/orders', { limit: 5, recent: true }],
    staleTime: 300000,
  });

  const { data: recentQuotes, isLoading: quotesLoading } = useQuery<any[]>({
    queryKey: ['/api/quotes', { limit: 5, recent: true }],
    staleTime: 300000,
  });

  const user = JSON.parse(localStorage.getItem('b2b_user') || '{}');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back, {user.name || 'User'}!</h1>
          <p className="text-muted-foreground">Here's what's happening with your account today.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild data-testid="button-new-order">
            <Link href="/orders/new">New Order</Link>
          </Button>
          <Button variant="outline" asChild data-testid="button-request-quote">
            <Link href="/quotes/new">Request Quote</Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-orders">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalOrders || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              +{stats?.ordersThisMonth || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-quotes">
              {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.pendingQuotes || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.quotesNeedingAttention || 0} need attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-monthly-spend">
              {statsLoading ? <Skeleton className="h-8 w-20" /> : `$${stats?.monthlySpend?.toLocaleString() || '0'}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.spendChange > 0 ? '+' : ''}{stats?.spendChange || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Credit</CardTitle>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-credit">
              {statsLoading ? <Skeleton className="h-8 w-20" /> : `$${stats?.activeCredit?.toLocaleString() || '0'}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Available credit line
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Your latest order activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ordersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))
              ) : recentOrders?.length ? (
                recentOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between" data-testid={`order-item-${order.id}`}>
                    <div>
                      <p className="text-sm font-medium">Order #{order.id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                      <p className="text-sm font-medium">${order.total?.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No recent orders</p>
                  <Button variant="outline" size="sm" asChild className="mt-2">
                    <Link href="/orders/new">Place Your First Order</Link>
                  </Button>
                </div>
              )}
            </div>
            
            {(recentOrders?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" asChild className="w-full" data-testid="button-view-all-orders">
                  <Link href="/orders">View All Orders</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Quotes</CardTitle>
            <CardDescription>Your latest quote requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quotesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))
              ) : recentQuotes?.length ? (
                recentQuotes.map((quote: any) => (
                  <div key={quote.id} className="flex items-center justify-between" data-testid={`quote-item-${quote.id}`}>
                    <div>
                      <p className="text-sm font-medium">Quote #{quote.id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={quote.status === 'approved' ? 'default' : quote.status === 'pending' ? 'secondary' : 'outline'}>
                        {quote.status}
                      </Badge>
                      <p className="text-sm font-medium">${quote.total?.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No recent quotes</p>
                  <Button variant="outline" size="sm" asChild className="mt-2">
                    <Link href="/quotes/new">Request Your First Quote</Link>
                  </Button>
                </div>
              )}
            </div>
            
            {(recentQuotes?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" asChild className="w-full" data-testid="button-view-all-quotes">
                  <Link href="/quotes">View All Quotes</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
