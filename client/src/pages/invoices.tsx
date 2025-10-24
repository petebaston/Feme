import { useState, Fragment } from "react";
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
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [pdfBlobUrls, setPdfBlobUrls] = useState<Record<string, string>>({});

  const { data: invoices, isLoading } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
    staleTime: 300000,
  });

  const filteredInvoices = invoices?.filter((invoice: any) => {
    const matchesSearch = !searchTerm ||
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  // Calculate aged invoice totals
  const calculateTotals = () => {
    let aged1to30 = 0;
    let aged30to60 = 0;
    let aged60to90 = 0;
    const today = new Date();

    filteredInvoices.forEach((invoice: any) => {
      // Only calculate for unpaid invoices
      if (invoice.status === 1) return; // Skip paid invoices

      // Parse total from costLines
      const costLines = invoice.details?.header?.costLines || [];
      const subtotalLine = costLines.find((line: any) => line.description === 'Subtotal');
      const taxLine = costLines.find((line: any) => line.description === 'Sales Tax');
      const amount = (parseFloat(subtotalLine?.amount?.value || 0) + parseFloat(taxLine?.amount?.value || 0));

      // Calculate days overdue from due date
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate * 1000) : null;
      if (!dueDate) return;

      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Categorize into aging buckets
      if (daysOverdue >= 1 && daysOverdue <= 30) {
        aged1to30 += amount;
      } else if (daysOverdue > 30 && daysOverdue <= 60) {
        aged30to60 += amount;
      } else if (daysOverdue > 60 && daysOverdue <= 90) {
        aged60to90 += amount;
      }
    });

    return { aged1to30, aged30to60, aged60to90 };
  };

  const { aged1to30, aged30to60, aged60to90 } = calculateTotals();

  const getStatusBadgeClass = (status: number) => {
    // Status is numeric: 0 = open/pending, 1 = paid, 2 = overdue
    switch (status) {
      case 2:
        return 'bg-red-600 text-white';
      case 1:
        return 'bg-[#C4D600] text-black';
      case 0:
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0: return 'Unpaid';
      case 1: return 'Paid';
      case 2: return 'Overdue';
      case 3: return 'Refunded';
      default: return 'Unknown';
    }
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map((inv: any) => inv.id));
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
    // Export logic here
    console.log("Exporting invoices...");
  };

  const loadPdfBlob = async (invoiceId: string) => {
    if (pdfBlobUrls[invoiceId]) return; // Already loaded

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load PDF');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setPdfBlobUrls(prev => ({ ...prev, [invoiceId]: blobUrl }));
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-normal text-white bg-[#6366F1] px-4 py-1 inline-block">
          Invoices
        </h1>
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

      {/* Summary Bar - Aged Invoices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1-30 Days */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">1-30 DAYS</div>
              <div className="text-3xl font-normal text-black">{formatCurrency(aged1to30)}</div>
            </div>
            <div className="w-3 h-3 bg-green-500"></div>
          </div>
        </div>

        {/* 30-60 Days */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">30-60 DAYS</div>
              <div className="text-3xl font-normal text-orange-600">{formatCurrency(aged30to60)}</div>
            </div>
            <div className="w-3 h-3 bg-orange-500"></div>
          </div>
        </div>

        {/* 60-90 Days */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">60-90 DAYS</div>
              <div className="text-3xl font-normal text-red-600">{formatCurrency(aged60to90)}</div>
            </div>
            <div className="w-3 h-3 bg-red-500"></div>
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
                  checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
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
              <TableHead className="font-medium">Order</TableHead>
              <TableHead className="font-medium">Invoice date</TableHead>
              <TableHead className="font-medium">Due date</TableHead>
              <TableHead className="font-medium">Invoice total</TableHead>
              <TableHead className="font-medium">Amount due</TableHead>
              <TableHead className="font-medium">Amount to pay</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={12}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice: any) => {
                // Calculate total from costLines
                const costLines = invoice.details?.header?.costLines || [];
                const subtotalLine = costLines.find((line: any) => line.description === 'Subtotal');
                const taxLine = costLines.find((line: any) => line.description === 'Sales Tax');
                const total = parseFloat(subtotalLine?.amount?.value || 0) + parseFloat(taxLine?.amount?.value || 0);
                
                // Parse dates safely
                const orderDate = invoice.details?.header?.orderDate;
                const invoiceDate = orderDate ? new Date(orderDate * 1000) : null;
                const dueDate = invoice.dueDate ? new Date(invoice.dueDate * 1000) : null;
                const isOverdue = invoice.status === 2;
                
                // Get company name from billing address
                const companyName = invoice.details?.header?.billingAddress?.firstName || 
                                  invoice.details?.header?.billingAddress?.lastName || 
                                  'Customer';

                return (
                  <Fragment key={invoice.id}>
                  <TableRow className="hover:bg-gray-50">
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
                    <TableCell className="text-gray-700">
                      {invoiceDate ? invoiceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </TableCell>
                    <TableCell className={isOverdue ? 'text-red-600' : 'text-gray-700'}>
                      {dueDate ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </TableCell>
                    <TableCell className="font-normal">{formatCurrency(total)}</TableCell>
                    <TableCell className="font-normal">{formatCurrency(total)}</TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        defaultValue={formatCurrency(total)}
                        className="h-8 w-24 bg-gray-100 border-0 text-center text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium ${getStatusBadgeClass(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
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
                      <TableCell colSpan={12} className="bg-gray-50 p-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Invoice Preview</h3>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                const token = localStorage.getItem('token');
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
                            {pdfBlobUrls[invoice.id] ? (
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
                <TableCell colSpan={12} className="text-center py-12 text-gray-500">
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
        <Button variant="outline" onClick={handleExport} className="border-gray-300">
          <FileDown className="w-4 h-4 mr-2" />
          EXPORT FILTERED AS CSV
        </Button>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Rows per page: <span className="font-medium">10</span></span>
          <span>1–3 of 3</span>
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
    </div>
  );
}
