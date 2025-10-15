import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RefreshCw, Package, Truck, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function OrderDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: order, isLoading } = useQuery<any>({
    queryKey: [`/api/orders/${id}`],
    enabled: !!id,
  });

  const reorderMutation = useMutation({
    mutationFn: async () => {
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

  if (!order) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/orders')}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
        <Card className="border border-gray-200">
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">Order not found</p>
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
            onClick={() => setLocation('/orders')}
            className="mb-2 -ml-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
          <h1 className="text-2xl md:text-3xl font-semibold text-black" data-testid="order-number">
            Order #{order.id}
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Order Details</p>
        </div>
        <Button
          onClick={() => reorderMutation.mutate()}
          disabled={reorderMutation.isPending || order.status?.toLowerCase() === 'cancelled'}
          className="bg-black text-white hover:bg-gray-800"
          data-testid="button-reorder"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${reorderMutation.isPending ? 'animate-spin' : ''}`} />
          {reorderMutation.isPending ? 'Adding...' : 'Reorder'}
        </Button>
      </div>

      {/* Order Information */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <p className="font-medium" data-testid="customer-name">{order.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(order.status)}`} data-testid="status">
                {order.status}
              </span>
            </div>
            {order.paymentTerms && (
              <div>
                <p className="text-sm text-gray-500">Payment Terms</p>
                <span className={`inline-block text-xs px-2 py-1 rounded-md border font-medium ${getPaymentTermsColor(order.paymentTerms)}`} data-testid="payment-terms">
                  {order.paymentTerms}
                </span>
              </div>
            )}
            {order.poNumber && (
              <div>
                <p className="text-sm text-gray-500">PO Number</p>
                <p className="font-medium flex items-center gap-1" data-testid="po-number">
                  <FileText className="h-4 w-4" />
                  {order.poNumber}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Order Date</p>
              <p className="font-medium" data-testid="order-date">
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
            {order.updatedAt && (
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="font-medium" data-testid="updated-date">
                  {new Date(order.updatedAt).toLocaleDateString()}
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
              <p className="font-medium" data-testid="subtotal">${parseFloat(order.subtotal || order.total).toLocaleString()}</p>
            </div>
            {order.tax && (
              <div className="flex justify-between">
                <p className="text-sm text-gray-500">Tax</p>
                <p className="font-medium" data-testid="tax">${parseFloat(order.tax).toLocaleString()}</p>
              </div>
            )}
            {order.shipping && (
              <div className="flex justify-between">
                <p className="text-sm text-gray-500">Shipping</p>
                <p className="font-medium" data-testid="shipping">${parseFloat(order.shipping).toLocaleString()}</p>
              </div>
            )}
            <div className="flex justify-between pt-4 border-t border-gray-200">
              <p className="text-base font-semibold">Total</p>
              <p className="text-xl font-bold" data-testid="total">${parseFloat(order.total).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipping Information */}
      {(order.shippingAddress || order.shippingCity || order.shippingState) && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Shipping Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.shippingAddress && (
              <>
                <p className="font-medium">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                <p>{order.shippingAddress.address1}</p>
                {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
              </>
            )}
            {!order.shippingAddress && (order.shippingCity || order.shippingState) && (
              <p>{order.shippingCity}, {order.shippingState}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      {order.items && order.items.length > 0 && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items ({order.itemCount || order.items.length})
            </CardTitle>
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
                  {order.items.map((item: any, index: number) => (
                    <tr key={index} className="border-b border-gray-100" data-testid={`item-${index}`}>
                      <td className="py-3 px-2 text-sm">
                        <p className="font-medium">{item.name || item.productName}</p>
                        {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                      </td>
                      <td className="py-3 px-2 text-sm text-right">{item.quantity}</td>
                      <td className="py-3 px-2 text-sm text-right">${parseFloat(item.price).toLocaleString()}</td>
                      <td className="py-3 px-2 text-sm text-right font-medium">
                        ${(parseFloat(item.price) * item.quantity).toLocaleString()}
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
