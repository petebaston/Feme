import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

interface QuoteCardProps {
  quote: {
    id: string;
    title?: string;
    status: string;
    total: number;
    createdAt: string;
    expiresAt?: string;
    itemCount?: number;
    notes?: string;
  };
}

export default function QuoteCard({ quote }: QuoteCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'negotiating': return 'outline';
      case 'rejected': return 'destructive';
      case 'expired': return 'destructive';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'negotiating': return 'text-blue-600';
      case 'rejected': return 'text-red-600';
      case 'expired': return 'text-red-600';
      case 'draft': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const isExpiringSoon = quote.expiresAt && new Date(quote.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const isExpired = quote.expiresAt && new Date(quote.expiresAt) < new Date();

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`quote-card-${quote.id}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">
                Quote #{quote.id}
              </h3>
              <Badge variant={getStatusVariant(quote.status)} data-testid={`quote-status-${quote.id}`}>
                {quote.status}
              </Badge>
              
              {isExpiringSoon && !isExpired && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Expiring Soon
                </Badge>
              )}
              
              {isExpired && (
                <Badge variant="destructive">
                  Expired
                </Badge>
              )}
            </div>
            
            {quote.title && (
              <p className="text-base mb-2">{quote.title}</p>
            )}
            
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Created {new Date(quote.createdAt).toLocaleDateString()}</span>
                {quote.itemCount && (
                  <span>{quote.itemCount} item{quote.itemCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              
              {quote.expiresAt && (
                <p>
                  Expires {new Date(quote.expiresAt).toLocaleDateString()}
                </p>
              )}
              
              {quote.notes && (
                <p className="text-xs">Notes: {quote.notes}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold" data-testid={`quote-total-${quote.id}`}>
                ${quote.total.toLocaleString()}
              </p>
              <p className={`text-sm ${getStatusColor(quote.status)}`}>
                {quote.status}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild data-testid={`quote-view-${quote.id}`}>
                <Link href={`/quotes/${quote.id}`}>View Details</Link>
              </Button>
              
              {quote.status.toLowerCase() === 'approved' && (
                <Button size="sm" data-testid={`quote-convert-${quote.id}`}>
                  Convert to Order
                </Button>
              )}
              
              {quote.status.toLowerCase() === 'draft' && (
                <Button variant="outline" size="sm" data-testid={`quote-edit-${quote.id}`}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
