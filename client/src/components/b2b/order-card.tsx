import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

interface OrderCardProps {
  order: {
    id: string;
    customerName?: string;
    status: string;
    total: number;
    createdAt: string;
    itemCount?: number;
    shippingAddress?: {
      city: string;
      state: string;
    };
  };
}

export default function OrderCard({ order }: OrderCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'pending': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-green-600';
      case 'processing': return 'text-blue-600';
      case 'pending': return 'text-yellow-600';
      case 'cancelled': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`order-card-${order.id}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">
                Order #{order.id}
              </h3>
              <Badge variant={getStatusVariant(order.status)} data-testid={`order-status-${order.id}`}>
                {order.status}
              </Badge>
            </div>
            
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Placed {new Date(order.createdAt).toLocaleDateString()}</span>
                {order.itemCount && (
                  <span>{order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              
              {order.customerName && (
                <p>Customer: {order.customerName}</p>
              )}
              
              {order.shippingAddress && (
                <p>Ship to: {order.shippingAddress.city}, {order.shippingAddress.state}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold" data-testid={`order-total-${order.id}`}>
                £{order.total.toLocaleString()}
              </p>
              <p className={`text-sm ${getStatusColor(order.status)}`}>
                {order.status}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild data-testid={`order-view-${order.id}`}>
                <Link href={`/orders/${order.id}`}>View Details</Link>
              </Button>
              
              {order.status.toLowerCase() === 'completed' && (
                <Button variant="outline" size="sm" data-testid={`order-reorder-${order.id}`}>
                  Reorder
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
