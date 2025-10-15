import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ShoppingBag, DollarSign, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");

  const { data: allOrders, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    staleTime: 300000,
  });

  const { data: allQuotes, isLoading: quotesLoading } = useQuery<any[]>({
    queryKey: ['/api/quotes'],
    staleTime: 300000,
  });

  const { data: allInvoices, isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
    staleTime: 300000,
  });

  const isLoading = ordersLoading || quotesLoading || invoicesLoading;

  // Filter data by time range
  const filterByTimeRange = (items: any[], dateField: string = 'createdAt') => {
    if (!items) return [];
    const now = new Date();
    const daysAgo = parseInt(timeRange);
    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    return items.filter(item => {
      const itemDate = new Date(item[dateField] || item.orderDate || item.createdDate);
      return itemDate >= cutoffDate;
    });
  };

  const orders = filterByTimeRange(allOrders || []);
  const quotes = filterByTimeRange(allQuotes || []);
  const invoices = filterByTimeRange(allInvoices || []);

  // Calculate analytics using correct field names
  const totalSpent = orders?.reduce((sum, order) => {
    // Try different possible field names for total
    const total = parseFloat(order.total) || 
                  parseFloat(order.grandTotal) || 
                  parseFloat(order.money?.totalIncTax) || 
                  0;
    return sum + total;
  }, 0) || 0;

  const totalOrders = orders?.length || 0;
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

  const completedOrders = orders?.filter(o => o.status === 'Completed' || o.status === 'Shipped')?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'Pending' || o.status === 'Processing')?.length || 0;

  const activeQuotes = quotes?.filter(q => q.status === 'open' || q.status === 'pending')?.length || 0;
  const totalQuotes = quotes?.length || 0;

  const unpaidInvoices = invoices?.filter(i => i.status === 'unpaid' || i.status === 'open')?.length || 0;
  const totalInvoices = invoices?.length || 0;

  // Monthly spending trend
  const monthlySpending = orders?.reduce((acc: Record<string, number>, order) => {
    const date = new Date(order.createdAt || order.orderDate || order.createdDate);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const total = parseFloat(order.total) || 
                  parseFloat(order.grandTotal) || 
                  parseFloat(order.money?.totalIncTax) || 
                  0;
    acc[monthYear] = (acc[monthYear] || 0) + total;
    return acc;
  }, {}) || {};

  const sortedMonths = Object.keys(monthlySpending).sort();
  const last6Months = sortedMonths.slice(-6);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-black">Analytics</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Track spending and order patterns</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Spent</span>
                  <DollarSign className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-black" data-testid="metric-total-spent">
                  {formatCurrency(totalSpent)}
                </div>
                <p className="text-xs text-gray-500 mt-1">{totalOrders} orders</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Avg Order Value</span>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-black" data-testid="metric-avg-order">
                  {formatCurrency(avgOrderValue)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Per order average</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Orders</span>
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-black" data-testid="metric-total-orders">
                  {totalOrders}
                </div>
                <p className="text-xs text-gray-500 mt-1">{completedOrders} completed, {pendingOrders} pending</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Active Quotes</span>
                  <Calendar className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-black" data-testid="metric-active-quotes">
                  {activeQuotes}
                </div>
                <p className="text-xs text-gray-500 mt-1">{totalQuotes} total quotes</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Spending Trend */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Monthly Spending Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="space-y-4">
              {last6Months.length > 0 ? (
                last6Months.map(month => {
                  const amount = monthlySpending[month];
                  const maxAmount = Math.max(...Object.values(monthlySpending));
                  const percentage = (amount / maxAmount) * 100;
                  const [year, monthNum] = month.split('-');
                  const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                  return (
                    <div key={month} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">{monthName}</span>
                        <span className="text-black font-semibold">{formatCurrency(amount)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-black h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-gray-500 py-8">No order data available</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200">
                  <span className="text-sm font-medium text-gray-900">Completed</span>
                  <span className="text-lg font-bold text-green-700">{completedOrders}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded border border-yellow-200">
                  <span className="text-sm font-medium text-gray-900">Pending</span>
                  <span className="text-lg font-bold text-yellow-700">{pendingOrders}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">{totalOrders}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200">
                  <span className="text-sm font-medium text-gray-900">Unpaid Invoices</span>
                  <span className="text-lg font-bold text-red-700">{unpaidInvoices}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
                  <span className="text-sm font-medium text-gray-900">Active Quotes</span>
                  <span className="text-lg font-bold text-blue-700">{activeQuotes}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Total Invoices</span>
                  <span className="text-lg font-bold text-gray-900">{totalInvoices}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
