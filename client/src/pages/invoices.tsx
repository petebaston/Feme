import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, Download, ExternalLink } from "lucide-react";
import { b2bClient } from "@/lib/b2b-client";

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const { data: invoices, isLoading } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
    staleTime: 300000,
  });

  const filteredInvoices = invoices?.filter((invoice: any) => {
    const matchesSearch = !searchTerm || 
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
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

  const calculatePaymentTermTotals = () => {
    if (!invoices) return { total: 0, days1_30: 0, days30_60: 0, days60_90: 0, days90Plus: 0, net30: 0, net60: 0 };

    const totals = {
      total: 0,
      days1_30: 0,
      days30_60: 0,
      days60_90: 0,
      days90Plus: 0,
      net30: 0,
      net60: 0,
    };

    invoices.forEach((invoice: any) => {
      const amount = parseFloat(invoice.total) || 0;
      if (invoice.status !== 'paid' && invoice.status !== 'cancelled') {
        totals.total += amount;
        
        if (invoice.paymentTerms?.includes('1-30')) totals.days1_30 += amount;
        else if (invoice.paymentTerms?.includes('30-60')) totals.days30_60 += amount;
        else if (invoice.paymentTerms?.includes('60-90')) totals.days60_90 += amount;
        else if (invoice.paymentTerms?.includes('90+')) totals.days90Plus += amount;
        else if (invoice.paymentTerms?.includes('Net 30')) totals.net30 += amount;
        else if (invoice.paymentTerms?.includes('Net 60')) totals.net60 += amount;
      }
    });

    return totals;
  };

  const paymentTermTotals = calculatePaymentTermTotals();

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-black">Invoices</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">Track and manage your invoices with custom payment terms</p>
      </div>

      {/* Custom Fields - Payment Term Totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="border border-black bg-black">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm text-gray-400 mb-1">Total Owed</p>
            <p className="text-xl md:text-2xl font-bold text-white" data-testid="total-owed">${paymentTermTotals.total.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border border-green-200 bg-green-50">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm text-green-700 mb-1">1-30 Days</p>
            <p className="text-xl md:text-2xl font-bold text-green-800" data-testid="total-1-30-days">${paymentTermTotals.days1_30.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm text-blue-700 mb-1">30-60 Days</p>
            <p className="text-xl md:text-2xl font-bold text-blue-800" data-testid="total-30-60-days">${paymentTermTotals.days30_60.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border border-orange-200 bg-orange-50">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm text-orange-700 mb-1">60-90 Days</p>
            <p className="text-xl md:text-2xl font-bold text-orange-800" data-testid="total-60-90-days">${paymentTermTotals.days60_90.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border border-red-200 bg-red-50">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm text-red-700 mb-1">90+ Days</p>
            <p className="text-xl md:text-2xl font-bold text-red-800" data-testid="total-90-plus-days">${paymentTermTotals.days90Plus.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-gray-50">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm text-gray-700 mb-1">Net 30</p>
            <p className="text-xl md:text-2xl font-bold text-gray-800" data-testid="total-net-30">${paymentTermTotals.net30.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-gray-50">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm text-gray-700 mb-1">Net 60</p>
            <p className="text-xl md:text-2xl font-bold text-gray-800" data-testid="total-net-60">${paymentTermTotals.net60.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-gray-200">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
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
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
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
                <SelectItem value="due_date">Due Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <div className="space-y-3 md:space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-4 md:p-6">
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))
        ) : filteredInvoices.length > 0 ? (
          filteredInvoices.map((invoice: any) => (
            <Card key={invoice.id} className="border border-gray-200 hover:border-gray-300 transition-colors" data-testid={`invoice-card-${invoice.id}`}>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg truncate" data-testid={`invoice-number-${invoice.id}`}>{invoice.invoiceNumber}</h3>
                      <p className="text-sm text-gray-600 mt-0.5" data-testid={`invoice-customer-${invoice.id}`}>{invoice.customerName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {invoice.paymentTerms && (
                        <span className={`text-xs px-2 py-1 rounded-md border font-medium ${getPaymentTermsColor(invoice.paymentTerms)}`} data-testid={`invoice-payment-terms-${invoice.id}`}>
                          {invoice.paymentTerms}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(invoice.status)}`} data-testid={`invoice-status-${invoice.id}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Total</p>
                        <p className="font-semibold text-base" data-testid={`invoice-total-${invoice.id}`}>${parseFloat(invoice.total).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Subtotal</p>
                        <p className="font-medium">${parseFloat(invoice.subtotal).toLocaleString()}</p>
                      </div>
                      {invoice.tax && (
                        <div className="hidden sm:block">
                          <p className="text-gray-500 text-xs">Tax</p>
                          <p className="font-medium">${parseFloat(invoice.tax).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Due Date</p>
                      <p className="text-sm font-medium">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>

                  {/* Invoice Date and Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      <span>Invoice Date: {new Date(invoice.createdAt).toLocaleDateString()}</span>
                      {invoice.paidDate && (
                        <span className="text-green-600 ml-3">Paid: {new Date(invoice.paidDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => window.open(b2bClient.getInvoiceDetailUrl(invoice.id), '_blank')}
                        data-testid={`button-view-invoice-${invoice.id}`}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => window.open(b2bClient.getInvoicePdfUrl(invoice.id), '_blank')}
                        data-testid={`button-download-pdf-${invoice.id}`}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download PDF
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
              <p className="text-gray-500">No invoices found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
