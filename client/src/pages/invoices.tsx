import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

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

  // Calculate open and overdue totals
  const calculateTotals = () => {
    let openTotal = 0;
    let overdueTotal = 0;

    filteredInvoices.forEach((invoice: any) => {
      // Parse total from costLines if available
      const costLines = invoice.details?.header?.costLines || [];
      const subtotalLine = costLines.find((line: any) => line.description === 'Subtotal');
      const taxLine = costLines.find((line: any) => line.description === 'Sales Tax');
      const amount = (parseFloat(subtotalLine?.amount?.value || 0) + parseFloat(taxLine?.amount?.value || 0));

      // Status is a number: 0 = open, 1 = paid, 2 = overdue (example mapping)
      const status = invoice.status;

      if (status !== 1) { // Not paid
        openTotal += amount;
      }

      if (status === 2) { // Overdue
        overdueTotal += amount;
      }
    });

    return { openTotal, overdueTotal };
  };

  const { openTotal, overdueTotal } = calculateTotals();

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
      case 0: return 'Open';
      case 1: return 'Paid';
      case 2: return 'Overdue';
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

  return (
    <div className="space-y-6">
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

      {/* Summary Bar */}
      <div className="flex items-center justify-between">
        <div className="text-base">
          <span className="text-gray-700">Open: </span>
          <span className="font-semibold text-black">{formatCurrency(openTotal)}</span>
          <span className="mx-2">|</span>
          <span className="text-gray-700">Overdue: </span>
          <span className="font-semibold text-red-600">{formatCurrency(overdueTotal)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 bg-white overflow-x-auto">
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
                  <TableRow key={invoice.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={() => toggleSelect(invoice.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <button className="hover:bg-gray-100 p-1 rounded">
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </TableCell>
                    <TableCell className="font-normal">{invoice.invoiceNumber || invoice.id}</TableCell>
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
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
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
