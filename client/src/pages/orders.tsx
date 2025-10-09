import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const { data: orders, isLoading } = useQuery<any[]>({
    queryKey: ['/api/orders', { search: searchTerm, status: statusFilter, sortBy }],
    staleTime: 300000,
  });

  const filteredOrders = orders?.filter((order: any) => {
    const matchesSearch = !searchTerm || 
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
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
        <h1 className="text-2xl md:text-3xl font-semibold text-black">Orders</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">Track and manage your order history</p>
      </div>

      {/* Filters */}
      <Card className="border border-gray-200">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-gray-300 focus:border-black focus:ring-black"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11 border-gray-300" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40 h-11 border-gray-300" data-testid="select-sort">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest First</SelectItem>
                <SelectItem value="date_asc">Oldest First</SelectItem>
                <SelectItem value="total">Amount</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-3 md:space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-4 md:p-6">
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order: any) => (
            <Card key={order.id} className="border border-gray-200 hover:border-gray-300 transition-colors" data-testid={`order-card-${order.id}`}>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg truncate" data-testid={`order-number-${order.id}`}>{order.orderNumber}</h3>
                      <p className="text-sm text-gray-600 mt-0.5" data-testid={`order-customer-${order.id}`}>{order.customerName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.paymentTerms && (
                        <span className={`text-xs px-2 py-1 rounded-md border font-medium ${getPaymentTermsColor(order.paymentTerms)}`} data-testid={`order-payment-terms-${order.id}`}>
                          {order.paymentTerms}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(order.status)}`} data-testid={`order-status-${order.id}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Total</p>
                        <p className="font-semibold text-base" data-testid={`order-total-${order.id}`}>${parseFloat(order.total).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Items</p>
                        <p className="font-medium">{order.itemCount}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-gray-500 text-xs">Location</p>
                        <p className="font-medium">{order.shippingCity}, {order.shippingState}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Order Date</p>
                      <p className="text-sm font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border border-gray-200">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No orders found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
