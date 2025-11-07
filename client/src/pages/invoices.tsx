import { useState, Fragment, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, SlidersHorizontal, ChevronRight, ChevronDown, MoreVertical, FileDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Invoices() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [pdfBlobUrls, setPdfBlobUrls] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: invoices, isLoading, error: invoicesError } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
    staleTime: 300000,
    retry: 2,
  });

  const { data: companyCredit, isLoading: isCreditLoading, error: creditError } = useQuery<any>({
    queryKey: ['/api/company/credit'],
    staleTime: 300000,
    retry: 2,
  });

  // Get consistent currency code from invoices or company credit
  const getCurrencyCode = (): string => {
    if (companyCredit?.creditCurrency) return companyCredit.creditCurrency;
    if (invoices?.[0]?.openBalance?.code) return invoices[0].openBalance.code;
    return 'GBP'; // Default fallback
  };

  // Calculate actual status based on openBalance and dueDate
  // This matches the logic used in the BigCommerce API and provides consistent status across the app
  const calculateInvoiceStatus = (invoice: any): 'Paid' | 'Overdue' | 'Unpaid' => {
    // First check if there's an explicit status field (numeric or string)
    if (invoice.status !== undefined) {
      // Handle numeric status codes from BigCommerce
      if (typeof invoice.status === 'number') {
        const statusMap: Record<number, 'Paid' | 'Overdue' | 'Unpaid'> = {
          0: 'Unpaid',
          1: 'Paid',
          2: 'Overdue',
        };
        if (invoice.status in statusMap) {
          return statusMap[invoice.status];
        }
      }
      // Handle string status
      if (typeof invoice.status === 'string') {
        const normalized = invoice.status.toLowerCase();
        if (normalized === 'paid') return 'Paid';
        if (normalized === 'overdue') return 'Overdue';
        if (normalized === 'unpaid') return 'Unpaid';
      }
    }

    // Fallback: Calculate from openBalance and dueDate
    const openBalance = parseFloat(invoice.openBalance?.value || 0);

    // If balance is 0, it's paid
    if (openBalance === 0) {
      return 'Paid';
    }

    // If there's a balance, check if it's overdue
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate * 1000) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    if (dueDate) {
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        return 'Overdue';
      }
    }

    return 'Unpaid';
  };

  const filteredInvoices = invoices?.filter((invoice: any) => {
    const matchesSearch = !searchTerm ||
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName?.toLowerCase().includes(searchTerm.toLowerCase());

    const invoiceStatus = calculateInvoiceStatus(invoice);
    const matchesStatus = statusFilter === "all" || invoiceStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  }) || [];

  // Pagination calculations
  const totalInvoices = filteredInvoices.length;
  const totalPages = Math.ceil(totalInvoices / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Calculate aged invoice totals and status summaries
  const calculateTotals = () => {
    let aged1to30 = 0;
    let aged31to60 = 0;
    let aged61to90 = 0;
    let aged90plus = 0;
    let totalOpen = 0;
    let totalOverdue = 0;
    const today = new Date();

    filteredInvoices.forEach((invoice: any) => {
      const openBalance = parseFloat(invoice.openBalance?.value || 0);
      
      // Skip paid invoices (openBalance = 0)
      if (openBalance === 0) return;

      // Add to total open
      totalOpen += openBalance;

      // Calculate days overdue from due date
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate * 1000) : null;
      if (!dueDate) return;

      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // If overdue, add to overdue total
      if (daysOverdue > 0) {
        totalOverdue += openBalance;
      }

      // Categorize into aging buckets
      if (daysOverdue >= 1 && daysOverdue <= 30) {
        aged1to30 += openBalance;
      } else if (daysOverdue >= 31 && daysOverdue <= 60) {
        aged31to60 += openBalance;
      } else if (daysOverdue >= 61 && daysOverdue <= 90) {
        aged61to90 += openBalance;
      } else if (daysOverdue > 90) {
        aged90plus += openBalance;
      }
    });

    return { aged1to30, aged31to60, aged61to90, aged90plus, totalOpen, totalOverdue };
  };

  const { aged1to30, aged31to60, aged61to90, aged90plus, totalOpen, totalOverdue } = calculateTotals();

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Overdue':
        return 'bg-red-600 text-white';
      case 'Paid':
        return 'bg-[#C4D600] text-black';
      case 'Unpaid':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === paginatedInvoices.length && paginatedInvoices.length > 0) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(paginatedInvoices.map((inv: any) => inv.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter((invId) => invId !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };

  const handleExport = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      alert('No invoices to export');
      return;
    }

    const currencyCode = getCurrencyCode();

    // Prepare CSV data
    const headers = [
      'Invoice Number',
      'Company',
      'Order Number',
      'Sales Order',
      'Invoice Date',
      'Due Date',
      'Invoice Total',
      'Amount Due',
      'Status'
    ];

    const rows = filteredInvoices.map((invoice: any) => {
      const costLines = invoice.details?.header?.costLines || [];
      const subtotalLine = costLines.find((line: any) => line.description === 'Subtotal');
      const taxLine = costLines.find((line: any) => line.description === 'Sales Tax');
      const total = parseFloat(subtotalLine?.amount?.value || 0) + parseFloat(taxLine?.amount?.value || 0);

      const orderDate = invoice.details?.header?.orderDate;
      const invoiceDate = orderDate ? new Date(orderDate * 1000).toLocaleDateString('en-GB') : '-';
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate * 1000).toLocaleDateString('en-GB') : '-';

      const actualStatus = calculateInvoiceStatus(invoice);
      const companyName = invoice.customerName || 'Customer';

      const extraFields = invoice.extraFields || [];
      const ourRefField = extraFields.find((field: any) => field.fieldName === 'Our Ref');
      const salesOrder = ourRefField?.fieldValue || invoice.orderNumber || '-';

      const openBalance = parseFloat(invoice.openBalance?.value || 0);

      return [
        invoice.invoiceNumber || invoice.id,
        companyName,
        invoice.orderNumber || '-',
        salesOrder,
        invoiceDate,
        dueDate,
        formatCurrency(total, currencyCode),
        formatCurrency(openBalance, currencyCode),
        actualStatus
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadPdfBlob = async (invoiceId: string) => {
    if (pdfBlobUrls[invoiceId]) return; // Already loaded

    try {
      const token = localStorage.getItem('b2b_token') || localStorage.getItem('token');
      console.log('[PDF] Fetching PDF for invoice:', invoiceId);
      
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('[PDF] Response status:', response.status);
      console.log('[PDF] Content-Type:', response.headers.get('Content-Type'));

      if (!response.ok) {
        const text = await response.text();
        console.error('[PDF] Error response:', text);
        throw new Error(`Failed to load PDF: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log('[PDF] Received', arrayBuffer.byteLength, 'bytes');
      
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      console.log('[PDF] Created blob URL:', blobUrl);
      
      setPdfBlobUrls(prev => ({ ...prev, [invoiceId]: blobUrl }));
    } catch (error) {
      console.error('[PDF] Error loading PDF:', error);
      setPdfBlobUrls(prev => ({ ...prev, [invoiceId]: 'ERROR' }));
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-normal text-black">
          Invoices
        </h1>
      </div>

      {/* Error Messages */}
      {invoicesError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm font-medium">Failed to load invoices</p>
          <p className="text-red-600 text-sm mt-1">
            {invoicesError instanceof Error ? invoicesError.message : 'Please try refreshing the page'}
          </p>
        </div>
      )}
      {creditError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800 text-sm font-medium">Failed to load company credit information</p>
          <p className="text-yellow-600 text-sm mt-1">Some features may be limited</p>
        </div>
      )}

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="flex gap-3 w-1/2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-gray-100 border-0 focus-visible:ring-0 rounded-none"
              data-testid="input-search-invoices"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center w-10 h-10 border border-gray-300 hover:bg-gray-50 ${showFilters ? 'bg-gray-100' : ''}`}
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 border border-gray-200 p-4" data-testid="panel-filters">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Status
                </label>
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
                    All Invoices
                  </button>
                  <button
                    onClick={() => setStatusFilter("paid")}
                    className={`px-3 py-1.5 text-sm border ${
                      statusFilter === "paid"
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    data-testid="button-filter-paid"
                  >
                    Paid
                  </button>
                  <button
                    onClick={() => setStatusFilter("overdue")}
                    className={`px-3 py-1.5 text-sm border ${
                      statusFilter === "overdue"
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    data-testid="button-filter-overdue"
                  >
                    Overdue
                  </button>
                  <button
                    onClick={() => setStatusFilter("unpaid")}
                    className={`px-3 py-1.5 text-sm border ${
                      statusFilter === "unpaid"
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    data-testid="button-filter-unpaid"
                  >
                    Unpaid
                  </button>
                </div>
              </div>
              
              {statusFilter !== "all" && (
                <button
                  onClick={() => setStatusFilter("all")}
                  className="text-sm text-gray-600 hover:text-black underline"
                  data-testid="button-clear-filters"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Credit Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Credit Limit */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">CREDIT LIMIT</div>
              {isCreditLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <div className="text-3xl font-normal text-black">
                  {formatCurrency(companyCredit?.creditLimit || 0, getCurrencyCode())}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Available Credit */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">AVAILABLE</div>
              {isCreditLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <div className="text-3xl font-normal text-green-600">
                  {formatCurrency(Math.max(0, (companyCredit?.creditLimit || 0) - totalOpen), getCurrencyCode())}
                </div>
              )}
            </div>
            <div className="w-3 h-3 bg-green-500"></div>
          </div>
        </div>

        {/* Open Balance */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">OPEN</div>
              {isLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <div className="text-3xl font-normal text-black">
                  {formatCurrency(totalOpen, getCurrencyCode())}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">OVERDUE</div>
              {isLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <div className="text-3xl font-normal text-red-600">
                  {formatCurrency(totalOverdue, getCurrencyCode())}
                </div>
              )}
            </div>
            <div className="w-3 h-3 bg-red-500"></div>
          </div>
        </div>
      </div>

      {/* Aged Invoices */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 1-30 Days */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">1-30 DAYS</div>
              <div className="text-3xl font-normal text-black">{formatCurrency(aged1to30, getCurrencyCode())}</div>
            </div>
            <div className="w-3 h-3 bg-green-500"></div>
          </div>
        </div>

        {/* 31-60 Days */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">31-60 DAYS</div>
              <div className="text-3xl font-normal text-orange-600">{formatCurrency(aged31to60, getCurrencyCode())}</div>
            </div>
            <div className="w-3 h-3 bg-orange-500"></div>
          </div>
        </div>

        {/* 61-90 Days */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">61-90 DAYS</div>
              <div className="text-3xl font-normal text-red-600">{formatCurrency(aged61to90, getCurrencyCode())}</div>
            </div>
            <div className="w-3 h-3 bg-red-500"></div>
          </div>
        </div>

        {/* 90+ Days */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">90+ DAYS</div>
              <div className="text-3xl font-normal text-red-700">{formatCurrency(aged90plus, getCurrencyCode())}</div>
            </div>
            <div className="w-3 h-3 bg-red-700"></div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedInvoices.length === paginatedInvoices.length && paginatedInvoices.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead className="font-medium">
                <div className="flex items-center gap-1">
                  Invoices
                  <ChevronDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="font-medium">Company</TableHead>
              <TableHead className="font-medium">Order Number</TableHead>
              <TableHead className="font-medium">Sales Order</TableHead>
              <TableHead className="font-medium">Invoice date</TableHead>
              <TableHead className="font-medium">Due date</TableHead>
              <TableHead className="font-medium">Invoice total</TableHead>
              <TableHead className="font-medium">Amount due</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={13}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedInvoices.length > 0 ? (
              paginatedInvoices.map((invoice: any) => {
                // Calculate total from costLines
                const costLines = invoice.details?.header?.costLines || [];
                const subtotalLine = costLines.find((line: any) => line.description === 'Subtotal');
                const taxLine = costLines.find((line: any) => line.description === 'Sales Tax');
                const total = parseFloat(subtotalLine?.amount?.value || 0) + parseFloat(taxLine?.amount?.value || 0);
                
                // Parse dates safely
                const orderDate = invoice.details?.header?.orderDate;
                const invoiceDate = orderDate ? new Date(orderDate * 1000) : null;
                const dueDate = invoice.dueDate ? new Date(invoice.dueDate * 1000) : null;
                
                // Calculate actual status
                const actualStatus = calculateInvoiceStatus(invoice);
                
                // Get company name from customerName field
                const companyName = invoice.customerName || 'Customer';
                
                // Get Sales Order number from "Our Ref" custom field in extraFields
                // The backend now enriches invoices with extraFields from the detail endpoint
                const extraFields = invoice.extraFields || [];
                const ourRefField = extraFields.find((field: any) => 
                  field.fieldName === 'Our Ref'
                );
                
                // Use "Our Ref" if available, fallback to orderNumber
                const salesOrder = ourRefField?.fieldValue || invoice.orderNumber || '-';
                
                // Get open balance
                const openBalance = parseFloat(invoice.openBalance?.value || 0);

                return (
                  <Fragment key={invoice.id}>
                  <TableRow 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={(e) => {
                      // Don't navigate if clicking on checkbox, expand button, or action menu
                      const target = e.target as HTMLElement;
                      if (
                        target.closest('input[type="checkbox"]') ||
                        target.closest('button') ||
                        target.closest('[role="menuitem"]')
                      ) {
                        return;
                      }
                      setLocation(`/invoices/${invoice.id}`);
                    }}
                    data-testid={`row-invoice-${invoice.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={() => toggleSelect(invoice.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => {
                          const newExpandedId = expandedInvoiceId === invoice.id ? null : invoice.id;
                          setExpandedInvoiceId(newExpandedId);
                          if (newExpandedId) {
                            loadPdfBlob(newExpandedId);
                          }
                        }}
                        className="hover:bg-gray-100 p-1 rounded transition-transform"
                        data-testid={`button-expand-${invoice.id}`}
                      >
                        {expandedInvoiceId === invoice.id ? (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-normal">
                      <button 
                        onClick={() => setLocation(`/invoices/${invoice.id}`)}
                        className="hover:underline text-left"
                      >
                        {invoice.invoiceNumber || invoice.id}
                      </button>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      <div className="max-w-xs">
                        {companyName}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{invoice.orderNumber || '-'}</TableCell>
                    <TableCell className="text-gray-700">{salesOrder}</TableCell>
                    <TableCell className="text-gray-700">
                      {invoiceDate ? invoiceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </TableCell>
                    <TableCell className={actualStatus === 'Overdue' ? 'text-red-600' : 'text-gray-700'}>
                      {dueDate ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </TableCell>
                    <TableCell className="font-normal">{formatCurrency(total, getCurrencyCode())}</TableCell>
                    <TableCell className="font-normal">{formatCurrency(openBalance, getCurrencyCode())}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium ${getStatusBadgeClass(actualStatus)}`}>
                        {actualStatus}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="hover:bg-gray-100 p-1.5 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/invoices/${invoice.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {/* Expandable PDF Preview */}
                  {expandedInvoiceId === invoice.id && (
                    <TableRow>
                      <TableCell colSpan={13} className="bg-gray-50 p-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Invoice Preview</h3>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                const token = localStorage.getItem('b2b_token') || localStorage.getItem('token');
                                const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `invoice-${invoice.invoiceNumber || invoice.id}.pdf`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="border-gray-300"
                              data-testid={`button-download-pdf-${invoice.id}`}
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              Download PDF
                            </Button>
                          </div>
                          <div className="border border-gray-300 bg-white" style={{ height: '600px' }}>
                            {pdfBlobUrls[invoice.id] === 'ERROR' ? (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-red-600">Failed to load PDF. Check console for details.</p>
                              </div>
                            ) : pdfBlobUrls[invoice.id] ? (
                              <iframe
                                src={pdfBlobUrls[invoice.id]}
                                className="w-full h-full"
                                title={`Invoice ${invoice.invoiceNumber} PDF`}
                                data-testid={`iframe-pdf-${invoice.id}`}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500">Loading PDF...</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-gray-500">
                  No invoices found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleExport}
          className="border-gray-300"
          disabled={filteredInvoices.length === 0}
        >
          <FileDown className="w-4 h-4 mr-2" />
          EXPORT FILTERED AS CSV
        </Button>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <span>
            {totalInvoices === 0 ? '0–0 of 0' : `${startIndex + 1}–${Math.min(endIndex, totalInvoices)} of ${totalInvoices}`}
          </span>
          <div className="flex gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              ‹
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === totalPages || totalInvoices === 0}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
