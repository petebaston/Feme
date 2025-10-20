import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  total: number;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  total: number;
}

export function MiniCart() {
  const { data: cart } = useQuery<Cart>({
    queryKey: ['/api/cart'],
    staleTime: 60000,
  });

  const itemCount = cart?.items?.length || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <ShoppingCart className="w-5 h-5" />
          {itemCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {itemCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Shopping Cart</h3>
            <Badge variant="outline">{itemCount} items</Badge>
          </div>

          {!cart || itemCount === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500">
              Your cart is empty
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-3 p-2 hover:bg-gray-50 rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        {item.quantity} × £{item.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">
                      £{item.total.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">£{cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>£{cart.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button asChild className="w-full bg-black text-white hover:bg-gray-800">
                  <Link href="/cart">View Cart</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/checkout">Checkout</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
