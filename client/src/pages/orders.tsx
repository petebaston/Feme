import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/b2b/export-button";

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [, setLocation] = useLocation();

  const { data: orders, isLoading, error} = useQuery<any[]>({
    queryKey: ['/api/orders'],
    staleTime: 300000,
    retry: false,
  });

  if (error && (error as any)?.message?.includes('token')) {
    localStorage.removeItem('b2b_token');
    localStorage.removeItem('b2b_user');
    window.location.href = '/login';
  }

  const hasActiveFilters = statusFilter !== "all" || dateFrom || dateTo || amountMin || amountMax;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
  };

  const filteredOrders = orders?.filter((order: any) => {
    const orderDate = order.createdAt ? new Date(order.createdAt) : null;
    const orderDateStr = orderDate
      ? orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const amount = parseFloat(order.money?.value || order.totalIncTax || '0');

    const matchesSearch = !searchTerm ||
      order.id?.toString().includes(searchTerm) ||
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.billingAddress?.first_name + ' ' + order.billingAddress?.last_name)
        .toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.billingAddress?.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      orderDateStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      amount.toFixed(2).includes(searchTerm);

    const matchesStatus = statusFilter === "all" ||
      order.status?.toLowerCase() === statusFilter.toLowerCase();

    const matchesDateFrom = !dateFrom || (orderDate && orderDate >= new Date(dateFrom));
    const matchesDateTo = !dateTo || (orderDate && orderDate <= new Date(dateTo + 'T23:59:59'));

    const matchesAmountMin = !amountMin || amount >= parseFloat(amountMin);
    const matchesAmountMax = !amountMax || amount <= parseFloat(amountMax);

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
  }) || [];

  const uniqueStatuses = Array.from(
    new Set(orders?.map((o: any) => o.status).filter(Boolean) || [])
  ) as string[];

  const getStatusBadgeClass = (status: string) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case 'completed':
        return 'bg-[#C4D600] text-black';
      case 'awaiting payment':
        return 'bg-orange-500 text-white';
      case 'awaiting fulfillment':
        return 'bg-blue-400 text-white';
      case 'partially shipped':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-normal text-black">Company Orders</h1>
        <ExportButton
          endpoint="/api/orders/export/csv"
          label="Export Orders"
          variant="outline"
        />
      </div>

      <div className="space-y-3">
        <div className="flex gap-3 w-full md:w-1/2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by order #, date, amount, name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-gray-100 border-0 focus-visible:ring-0 rounded-none"
              data-testid="input-search-orders"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center w-10 h-10 border hover:bg-gray-50 relative ${
              showFilters ? 'bg-gray-100 border-gray-400' : 'border-gray-300'
            }`}
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-black rounded-full" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-gray-50 border border-gray-200 p-4" data-testid="panel-filters">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order Status</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 text-sm border ${
                      statusFilter === "all"
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    data-testid="button-filter-all"
                  >
                    All Statuses
                  </button>
                  {uniqueStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 text-sm border ${
                        statusFilter === status
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      data-testid={`button-filter-${status.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 rounded-none border-gray-300"
                    data-testid="input-date-from"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 rounded-none border-gray-300"
                    data-testid="input-date-to"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Amount (£)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="h-9 rounded-none border-gray-300"
                    data-testid="input-amount-min"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Amount (£)</label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="h-9 rounded-none border-gray-300"
                    data-testid="input-amount-max"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-gray-600 hover:text-black underline"
                  data-testid="button-clear-filters"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border border-gray-200 bg-white overflow-x-auto relative">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium">
                <div className="flex items-center gap-1">
                  Order
                  <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="font-medium">Placed by</TableHead>
              <TableHead className="font-medium">Company</TableHead>
              <TableHead className="font-medium">PO / Reference</TableHead>
              <TableHead className="font-medium">Grand total</TableHead>
              <TableHead className="font-medium">Order status</TableHead>
              <TableHead className="font-medium">Created on</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order: any) => (
                <TableRow
                  key={order.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setLocation(`/orders/${order.id}`)}
                  data-testid={`row-order-${order.id}`}
                >
                  <TableCell className="font-normal">{order.id}</TableCell>
                  <TableCell className="text-gray-700">
                    <div className="max-w-xs">
                      {order.billingAddress?.first_name && order.billingAddress?.last_name
                        ? `${order.billingAddress.first_name} ${order.billingAddress.last_name}`.trim()
                        : order.customerName || '–'}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700">
                    <div className="max-w-xs">
                      {order.billingAddress?.company || order.companyName || '–'}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {order.poNumber || '–'}
                  </TableCell>
                  <TableCell className="font-normal">
                    {formatCurrency(order.money?.value || order.totalIncTax || '0', order.money)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                      {order.status || 'Completed'}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  No orders found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found</span>
        <div className="flex items-center gap-4">
          <span>Showing {filteredOrders.length} of {orders?.length || 0}</span>
        </div>
      </div>
    </div>
  );
}
