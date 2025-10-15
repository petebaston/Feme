import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function InvoiceDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: invoice, isLoading } = useQuery<any>({
    queryKey: [`/api/invoices/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch invoice');
      }
      return response.json();
    },
    enabled: !!id,
  });

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

  const handleDownloadPDF = async () => {
    try {
      // Get auth token
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
        throw new Error('Failed to download PDF');
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download invoice PDF. This feature may not be available in sandbox mode.",
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
                {invoice.status}
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
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">Subtotal</p>
              <p className="font-medium" data-testid="subtotal">£{parseFloat(invoice.subtotal).toLocaleString()}</p>
            </div>
            {invoice.tax && (
              <div className="flex justify-between">
                <p className="text-sm text-gray-500">Tax</p>
                <p className="font-medium" data-testid="tax">£{parseFloat(invoice.tax).toLocaleString()}</p>
              </div>
            )}
            {invoice.shipping && (
              <div className="flex justify-between">
                <p className="text-sm text-gray-500">Shipping</p>
                <p className="font-medium" data-testid="shipping">£{parseFloat(invoice.shipping).toLocaleString()}</p>
              </div>
            )}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              <p className="text-base font-semibold">Total</p>
              <p className="text-xl font-bold" data-testid="total">£{parseFloat(invoice.total).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      {invoice.items && invoice.items.length > 0 && (
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
                  {invoice.items.map((item: any, index: number) => (
                    <tr key={index} className="border-b border-gray-100" data-testid={`item-${index}`}>
                      <td className="py-3 px-2 text-sm">{item.name || item.productName}</td>
                      <td className="py-3 px-2 text-sm text-right">{item.quantity}</td>
                      <td className="py-3 px-2 text-sm text-right">£{parseFloat(item.price).toLocaleString()}</td>
                      <td className="py-3 px-2 text-sm text-right font-medium">
                        £{(parseFloat(item.price) * item.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
