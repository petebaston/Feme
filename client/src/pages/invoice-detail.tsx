import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomFieldsDisplay } from "@/components/b2b/custom-fields-display";

// Helper to extract cost values from BigCommerce costLines structure
const getCostValue = (costLines: any[], description: string): number => {
  if (!Array.isArray(costLines)) return 0;
  const line = costLines.find(l => l.description?.toLowerCase().includes(description.toLowerCase()));
  return line?.amount?.value || 0;
};

// Helper to get total from costLines
const calculateTotal = (costLines: any[]): number => {
  if (!Array.isArray(costLines)) return 0;
  return costLines.reduce((sum, line) => sum + (line.amount?.value || 0), 0);
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: invoice, isLoading, error } = useQuery<any>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id,
    retry: 2,
  });

  // Convert numeric status to string label
  const getStatusLabel = (status: number | string): string => {
    if (typeof status === 'number') {
      const statusMap: Record<number, string> = {
        0: 'unpaid',
        1: 'paid',
        2: 'overdue',
        3: 'refunded',
      };
      return statusMap[status] || 'unpaid';
    }
    return status?.toLowerCase() || 'unpaid';
  };

  const getStatusColor = (status: number | string) => {
    const statusLabel = getStatusLabel(status);
    const colors: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      unpaid: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };
    return colors[statusLabel] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentTermsColor = (terms: string) => {
    if (terms?.includes('1-30')) return 'bg-green-50 text-green-700 border-green-200';
    if (terms?.includes('30-60')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (terms?.includes('60-90')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (terms?.includes('90+')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('b2b_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/invoices/${id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.invoiceNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      });
    } catch (error: any) {
      console.error('PDF download error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to download invoice PDF",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/invoices')}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Button>
        <Card className="border border-gray-200">
          <CardContent className="p-12 text-center">
            <p className="text-red-600 font-medium mb-2">Failed to load invoice</p>
            <p className="text-gray-500 text-sm">
              {error instanceof Error ? error.message : 'Please try again or contact support'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/invoices')}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Button>
        <Card className="border border-gray-200">
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Invoice not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            onClick={() => setLocation('/invoices')}
            className="mb-2 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
          <h1 className="text-2xl md:text-3xl font-semibold text-black" data-testid="invoice-number">
            {invoice.invoiceNumber}
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Invoice Details</p>
        </div>
        <Button
          onClick={handleDownloadPDF}
          className="bg-black text-white hover:bg-gray-800"
          data-testid="button-download-pdf"
        >
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
      </div>

      {/* Invoice Information */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <p className="font-medium" data-testid="customer-name">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(invoice.status)}`} data-testid="status">
                {getStatusLabel(invoice.status)}
              </span>
            </div>
            {invoice.paymentTerms && (
              <div>
                <p className="text-sm text-gray-500">Payment Terms</p>
                <span className={`inline-block text-xs px-2 py-1 rounded-md border font-medium ${getPaymentTermsColor(invoice.paymentTerms)}`} data-testid="payment-terms">
                  {invoice.paymentTerms}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Invoice Date</p>
              <p className="font-medium" data-testid="invoice-date">
                {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium" data-testid="due-date">
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </p>
              </div>
            )}
            {invoice.paidDate && (
              <div>
                <p className="text-sm text-gray-500">Paid Date</p>
                <p className="font-medium text-green-600" data-testid="paid-date">
                  {new Date(invoice.paidDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Amount Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              // Extract cost values from BigCommerce API structure
              const costLines = invoice.details?.header?.costLines || [];
              const subtotal = getCostValue(costLines, 'subtotal');
              const tax = getCostValue(costLines, 'tax');
              const freight = getCostValue(costLines, 'freight');
              const total = calculateTotal(costLines);
              const currencyCode = costLines[0]?.amount?.code || 'GBP';
              const currencySymbol = currencyCode === 'USD' ? '$' : '£';

              return (
                <>
                  {subtotal > 0 && (
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-500">Subtotal</p>
                      <p className="font-medium" data-testid="subtotal">{currencySymbol}{subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-500">Tax</p>
                      <p className="font-medium" data-testid="tax">{currencySymbol}{tax.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {freight > 0 && (
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-500">Freight</p>
                      <p className="font-medium" data-testid="shipping">{currencySymbol}{freight.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  <div className="flex justify-between pt-4 border-t border-gray-200">
                    <p className="text-base font-semibold">Total</p>
                    <p className="text-xl font-bold" data-testid="total">{currencySymbol}{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      {(() => {
        // Try to extract line items from details.products or details.header.products
        const products = invoice.details?.products || invoice.details?.header?.products || invoice.items || [];

        if (products.length === 0) {
          return null; // Don't show section if no products
        }

        // Get currency from the first costLine
        const currencyCode = invoice.details?.header?.costLines?.[0]?.amount?.code || 'GBP';

        return (
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Item</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Qty</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Price</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((item: any, index: number) => {
                      const quantity = item.quantity || item.qty || 1;
                      const price = parseFloat(item.price || item.unitPrice || item.amount?.value || 0);
                      const total = price * quantity;
                      const symbol = currencyCode === 'USD' ? '$' : '£';

                      return (
                        <tr key={index} className="border-b border-gray-100" data-testid={`item-${index}`}>
                          <td className="py-3 px-2 text-sm">{item.name || item.productName || item.description || 'Item'}</td>
                          <td className="py-3 px-2 text-sm text-right">{quantity}</td>
                          <td className="py-3 px-2 text-sm text-right">
                            {symbol}{price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2 text-sm text-right font-medium">
                            {symbol}{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {products.length === 0 && (
                <p className="text-center py-8 text-gray-500 text-sm">
                  No line items available for this invoice
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Custom Fields / ERP Integration Data */}
      {invoice.extraFields && invoice.extraFields.length > 0 && (
        <CustomFieldsDisplay
          extraFields={invoice.extraFields}
          title="Custom Fields (ERP Data)"
          description="Integration data from your ERP system"
          variant="card"
        />
      )}
    </div>
  );
}
