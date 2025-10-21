import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { DollarSign, Package, FileText, Clock } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/stats'],
    staleTime: 300000,
  });

  const { data: recentOrdersRaw, isLoading: ordersLoading } = useQuery<any>({
    queryKey: ['/api/orders', { limit: 5, recent: true }],
    staleTime: 300000,
  });
  
  // Ensure recentOrders is always an array (handle error responses)
  const recentOrders = Array.isArray(recentOrdersRaw) ? recentOrdersRaw : [];

  const { data: recentQuotesRaw, isLoading: quotesLoading } = useQuery<any>({
    queryKey: ['/api/quotes', { limit: 5, recent: true }],
    staleTime: 300000,
  });
  
  // Ensure recentQuotes is always an array (handle error responses)
  const recentQuotes = Array.isArray(recentQuotesRaw) ? recentQuotesRaw : [];

  const user = JSON.parse(localStorage.getItem('b2b_user') || '{}');

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
      draft: 'bg-gray-100 text-gray-800',
      negotiating: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentTermsColor = (terms: string) => {
    if (terms?.includes('1-30')) return 'bg-green-50 text-green-700 border-green-200';
    if (terms?.includes('30-60')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (terms?.includes('60-90')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (terms?.includes('90+')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-black">Welcome back, {user.name || 'User'}</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">Here's what's happening with your business</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {statsLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-3xl font-semibold text-black" data-testid="stat-total-orders">{stats?.totalOrders || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{stats?.ordersThisMonth || 0} this month</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {statsLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">Monthly Spend</p>
                  <DollarSign className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-3xl font-semibold text-black" data-testid="stat-monthly-spend">£{stats?.monthlySpend?.toLocaleString() || 0}</p>
                <p className="text-xs text-green-600 mt-1">↑ {stats?.spendChange || 0}% vs last month</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {statsLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">Pending Quotes</p>
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-3xl font-semibold text-black" data-testid="stat-pending-quotes">{stats?.pendingQuotes || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{stats?.quotesNeedingAttention || 0} need attention</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {statsLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">Active Credit</p>
                  <Clock className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-3xl font-semibold text-black" data-testid="stat-active-credit">£{stats?.activeCredit?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Available credit</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders & Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Recent Orders */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders?.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors" data-testid={`order-${order.id}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{order.orderNumber}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{order.customerName}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.paymentTerms && (
                          <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getPaymentTermsColor(order.paymentTerms)}`}>
                            {order.paymentTerms}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-semibold">£{parseFloat(order.total).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(recentOrders?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Button variant="outline" size="sm" asChild className="w-full border-2 border-black text-black hover:bg-black hover:text-white" data-testid="button-view-all-orders">
                  <Link href="/orders">View All Orders</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Quotes */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {quotesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuotes?.slice(0, 5).map((quote: any) => (
                  <div key={quote.id} className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors" data-testid={`quote-${quote.id}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{quote.quoteNumber}</p>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">{quote.title}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {quote.paymentTerms && (
                          <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getPaymentTermsColor(quote.paymentTerms)}`}>
                            {quote.paymentTerms}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(quote.status)}`}>
                          {quote.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-semibold">£{parseFloat(quote.total).toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{new Date(quote.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(recentQuotes?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Button variant="outline" size="sm" asChild className="w-full border-2 border-black text-black hover:bg-black hover:text-white" data-testid="button-view-all-quotes">
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
