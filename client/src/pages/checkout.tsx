import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { CheckCircle2, CreditCard, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Checkout() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<'shipping' | 'payment' | 'review'>('shipping');
  const [shippingAddress, setShippingAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('po');
  const [poNumber, setPoNumber] = useState('');

  const { data: cart } = useQuery<any>({
    queryKey: ['/api/cart'],
  });

  const { data: addresses } = useQuery<any[]>({
    queryKey: ['/api/company/addresses'],
  });

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("POST", "/api/orders/place", orderData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Placed!",
        description: `Order ${data.orderNumber} has been placed successfully`,
      });
      setLocation(`/orders/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    },
  });

  const handlePlaceOrder = () => {
    if (!shippingAddress || !billingAddress) {
      toast({
        title: "Missing Information",
        description: "Please select shipping and billing addresses",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === 'po' && !poNumber) {
      toast({
        title: "Missing PO Number",
        description: "Please enter a purchase order number",
        variant: "destructive",
      });
      return;
    }

    placeOrderMutation.mutate({
      shippingAddressId: shippingAddress,
      billingAddressId: billingAddress,
      paymentMethod,
      poNumber: paymentMethod === 'po' ? poNumber : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-black">Checkout</h1>
        <p className="text-gray-600 mt-1">Complete your order</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between max-w-2xl">
        {['shipping', 'payment', 'review'].map((s, idx) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${step === s ? 'text-black' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === s ? 'bg-black text-white' : 'bg-gray-200'
              }`}>
                {idx + 1}
              </div>
              <span className="text-sm font-medium capitalize hidden sm:inline">{s}</span>
            </div>
            {idx < 2 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping Address */}
          {step === 'shipping' && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={shippingAddress} onValueChange={setShippingAddress}>
                  {addresses?.map((address) => (
                    <div key={address.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                      <RadioGroupItem value={address.id} id={`ship-${address.id}`} />
                      <Label htmlFor={`ship-${address.id}`} className="flex-1 cursor-pointer">
                        <div className="font-medium">{address.label}</div>
                        <div className="text-sm text-gray-600">
                          <p>{address.street1}</p>
                          {address.street2 && <p>{address.street2}</p>}
                          <p>{address.city}, {address.state} {address.postalCode}</p>
                        </div>
                      </Label>
                      {address.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                  ))}
                </RadioGroup>
                <Button
                  onClick={() => setStep('payment')}
                  disabled={!shippingAddress}
                  className="w-full bg-black text-white hover:bg-gray-800"
                >
                  Continue to Payment
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Payment Method */}
          {step === 'payment' && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <RadioGroupItem value="po" id="po" />
                    <Label htmlFor="po" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        <div>
                          <div className="font-medium">Purchase Order</div>
                          <div className="text-sm text-gray-600">Pay with company PO</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        <div>
                          <div className="font-medium">Credit Card</div>
                          <div className="text-sm text-gray-600">Pay with credit card</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod === 'po' && (
                  <div className="space-y-2">
                    <Label htmlFor="po-number">Purchase Order Number *</Label>
                    <Input
                      id="po-number"
                      placeholder="PO-2024-001"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep('shipping')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep('review')}
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                  >
                    Continue to Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review & Place Order */}
          {step === 'review' && (
            <Card>
              <CardHeader>
                <CardTitle>Review Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Shipping Address</h3>
                  <div className="text-sm text-gray-600">
                    {addresses?.find(a => a.id === shippingAddress)?.street1}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Payment Method</h3>
                  <div className="text-sm text-gray-600">
                    {paymentMethod === 'po' ? `Purchase Order: ${poNumber}` : 'Credit Card'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep('payment')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={placeOrderMutation.isPending}
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {placeOrderMutation.isPending ? 'Placing Order...' : 'Place Order'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>£{(cart?.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span>FREE</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>£{(cart?.tax || 0).toFixed(2)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>£{(cart?.total || 0).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
