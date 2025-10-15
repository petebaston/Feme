import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw, Check, X, FileText, ExternalLink, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/currency";

export default function Orders() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const { data: orders, isLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    staleTime: 300000,
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // In production, this would call BigCommerce B2B Edition API to add order items to cart
      // For now, simulate the action
      return new Promise((resolve) => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      toast({
        title: "Items Added to Cart",
        description: "Order items have been added to your cart for reorder",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add items to cart",
        variant: "destructive",
      });
    },
  });

  const poApprovalMutation = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: string; action: 'approve' | 'reject' }) => {
      const user = JSON.parse(localStorage.getItem('b2b_user') || '{}');
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const response = await apiRequest("PATCH", `/api/orders/${orderId}`, { 
        poStatus: newStatus,
        poApprovedAt: action === 'approve' ? new Date().toISOString() : null,
        poApprovedBy: action === 'approve' ? user.id : null,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: variables.action === 'approve' ? "PO Approved" : "PO Rejected",
        description: `Purchase Order has been ${variables.action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update PO status",
        variant: "destructive",
      });
    },
  });

  const filteredOrders = orders?.filter((order: any) => {
    const matchesSearch = !searchTerm || 
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const handleExportCSV = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      toast({
        title: "No Data",
        description: "No orders to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ['Order Number', 'Customer', 'Status', 'Total', 'Date', 'PO Number'];
    const rows = filteredOrders.map((order: any) => [
      order.id,
      order.customerName,
      order.status,
      order.total,
      new Date(order.createdAt).toLocaleDateString(),
      order.poNumber || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredOrders.length} orders to CSV`,
    });
  };

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

  const getPOStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-black">Orders</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Track and manage your order history</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          className="border-gray-300"
          data-testid="button-export-csv"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-gray-600" data-testid={`order-customer-${order.id}`}>{order.customerName}</p>
                        {order.poNumber && (
                          <span className="flex items-center gap-1 text-xs text-gray-500" data-testid={`order-po-number-${order.id}`}>
                            <FileText className="h-3 w-3" />
                            {order.poNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.paymentTerms && (
                        <span className={`text-xs px-2 py-1 rounded-md border font-medium ${getPaymentTermsColor(order.paymentTerms)}`} data-testid={`order-payment-terms-${order.id}`}>
                          {order.paymentTerms}
                        </span>
                      )}
                      {order.poStatus && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPOStatusColor(order.poStatus)}`} data-testid={`order-po-status-${order.id}`}>
                          PO: {order.poStatus}
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
                        <p className="font-semibold text-base" data-testid={`order-total-${order.id}`}>{formatCurrency(order.total, order.money)}</p>
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
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500">Order Date</p>
                        <p className="text-sm font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      {order.poNumber && order.poStatus?.toLowerCase() === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => poApprovalMutation.mutate({ orderId: order.id, action: 'approve' })}
                            disabled={poApprovalMutation.isPending}
                            className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white"
                            data-testid={`button-approve-po-${order.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve PO
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => poApprovalMutation.mutate({ orderId: order.id, action: 'reject' })}
                            disabled={poApprovalMutation.isPending}
                            className="border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                            data-testid={`button-reject-po-${order.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject PO
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-black text-black hover:bg-black hover:text-white"
                        data-testid={`button-view-details-${order.id}`}
                      >
                        <Link href={`/orders/${order.id}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Details
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reorderMutation.mutate(order.id)}
                        disabled={reorderMutation.isPending || order.status?.toLowerCase() === 'cancelled'}
                        className="border-black text-black hover:bg-black hover:text-white"
                        data-testid={`button-reorder-${order.id}`}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${reorderMutation.isPending ? 'animate-spin' : ''}`} />
                        {reorderMutation.isPending ? 'Adding...' : 'Reorder'}
                      </Button>
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
