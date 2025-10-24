import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CompanyOrders() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: orders, isLoading, error } = useQuery<any[]>({
    queryKey: ['/api/company-orders'],
    staleTime: 300000,
    retry: false,
  });
  
  // If we get an auth error, clear token and force re-login
  if (error && (error as any)?.message?.includes('token')) {
    localStorage.removeItem('b2b_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  const filteredOrders = orders?.filter((order: any) => {
    const matchesSearch = !searchTerm ||
      order.id?.toString().includes(searchTerm) ||
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-normal text-black">Company orders</h1>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 bg-gray-100 border-0 focus-visible:ring-0 rounded-none"
          />
        </div>
        <button className="flex items-center justify-center w-10 h-10 border border-gray-300 hover:bg-gray-50">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
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
              <TableHead className="font-medium">Company</TableHead>
              <TableHead className="font-medium">PO / Reference</TableHead>
              <TableHead className="font-medium">Grand total</TableHead>
              <TableHead className="font-medium">Order status</TableHead>
              <TableHead className="font-medium">Placed by</TableHead>
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
                <TableRow key={order.id} className="hover:bg-gray-50">
                  <TableCell className="font-normal">{order.id}</TableCell>
                  <TableCell className="text-gray-700">
                    <div className="max-w-xs">
                      {order.customerName || 'TEST Affro Wholesale Direct Ltd'}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {order.poNumber || '–'}
                  </TableCell>
                  <TableCell className="font-normal">
                    {formatCurrency(order.total, order.money)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                      {order.status || 'Completed'}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {order.placedBy || 'Joe Blogs'}
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, ' ')}
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

      {/* Pagination */}
      <div className="flex items-center justify-end gap-4 text-sm text-gray-600">
        <span>Rows per page: <span className="font-medium">10</span></span>
        <span>1–8 of 8</span>
        <div className="flex gap-2">
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
            ‹
          </button>
          <button className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" disabled>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
