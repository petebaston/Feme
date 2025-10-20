import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Check, X, ShoppingBag } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

export default function Quotes() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [quoteTitle, setQuoteTitle] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");

  const { data: quotesRaw, isLoading } = useQuery<any>({
    queryKey: ['/api/quotes'],
    staleTime: 300000,
  });
  
  // Ensure quotes is always an array (handle error responses)
  const quotes = Array.isArray(quotesRaw) ? quotesRaw : [];

  const approvalMutation = useMutation({
    mutationFn: async ({ quoteId, action }: { quoteId: string; action: 'approve' | 'reject' }) => {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const response = await apiRequest("PATCH", `/api/quotes/${quoteId}`, { status: newStatus });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      toast({
        title: variables.action === 'approve' ? "Quote Approved" : "Quote Rejected",
        description: `Quote has been ${variables.action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quote status",
        variant: "destructive",
      });
    },
  });

  const convertToOrderMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiRequest("POST", `/api/quotes/${quoteId}/convert-to-order`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "Quote Converted",
        description: "Quote has been converted to an order successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to convert quote to order",
        variant: "destructive",
      });
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: { title: string; notes: string }) => {
      // Get user and company info from localStorage
      const userDataStr = localStorage.getItem('b2b_user');
      if (!userDataStr) {
        throw new Error('User data not available');
      }
      const userData = JSON.parse(userDataStr);
      
      const response = await apiRequest("POST", "/api/quotes", {
        title: data.title,
        notes: data.notes,
        status: 'open',
        companyId: userData.companyId,
        bcCustomerId: userData.bcCustomerId || userData.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setIsCreateDialogOpen(false);
      setQuoteTitle("");
      setQuoteNotes("");
      toast({
        title: "Quote Created",
        description: "Your quote request has been created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    },
  });

  const filteredQuotes = quotes?.filter((quote: any) => {
    const matchesSearch = !searchTerm || 
      quote.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      negotiating: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
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

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-black">Quotes</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Review and manage your quote requests</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-black text-white hover:bg-gray-800"
              data-testid="button-create-quote"
            >
              Request Quote
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request a Quote</DialogTitle>
              <DialogDescription>
                Submit a quote request for custom pricing or large orders
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="quote-title">Quote Title *</Label>
                <Input
                  id="quote-title"
                  placeholder="e.g., Bulk Order - Product XYZ"
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                  data-testid="input-quote-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-notes">Additional Notes</Label>
                <Textarea
                  id="quote-notes"
                  placeholder="Provide details about your quote request..."
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  rows={4}
                  data-testid="input-quote-notes"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-quote"
              >
                Cancel
              </Button>
              <Button
                onClick={() => createQuoteMutation.mutate({ title: quoteTitle, notes: quoteNotes })}
                disabled={!quoteTitle || createQuoteMutation.isPending}
                className="bg-black text-white hover:bg-gray-800"
                data-testid="button-submit-quote"
              >
                {createQuoteMutation.isPending ? 'Creating...' : 'Submit Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border border-gray-200">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-gray-300 focus:border-black focus:ring-black"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-11 border-gray-300" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="negotiating">Negotiating</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40 h-11 border-gray-300" data-testid="select-sort">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest First</SelectItem>
                <SelectItem value="date_asc">Oldest First</SelectItem>
                <SelectItem value="total">Amount</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="expiry">Expiry Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quotes List */}
      <div className="space-y-3 md:space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border border-gray-200">
              <CardContent className="p-4 md:p-6">
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))
        ) : filteredQuotes.length > 0 ? (
          filteredQuotes.map((quote: any) => (
            <Card key={quote.id} className="border border-gray-200 hover:border-gray-300 transition-colors" data-testid={`quote-card-${quote.id}`}>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg truncate" data-testid={`quote-number-${quote.id}`}>{quote.quoteNumber}</h3>
                      <p className="text-sm text-gray-600 mt-0.5 truncate" data-testid={`quote-title-${quote.id}`}>{quote.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {quote.paymentTerms && (
                        <span className={`text-xs px-2 py-1 rounded-md border font-medium ${getPaymentTermsColor(quote.paymentTerms)}`} data-testid={`quote-payment-terms-${quote.id}`}>
                          {quote.paymentTerms}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(quote.status)}`} data-testid={`quote-status-${quote.id}`}>
                        {quote.status}
                      </span>
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Total</p>
                        <p className="font-semibold text-base" data-testid={`quote-total-${quote.id}`}>{formatCurrency(quote.total, quote.money)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Items</p>
                        <p className="font-medium">{quote.itemCount}</p>
                      </div>
                      {quote.expiresAt && (
                        <div className="hidden sm:block">
                          <p className="text-gray-500 text-xs">Expires</p>
                          <p className="font-medium text-sm">{new Date(quote.expiresAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500">Created</p>
                        <p className="text-sm font-medium">{new Date(quote.createdAt).toLocaleDateString()}</p>
                      </div>
                      {quote.status?.toLowerCase() === 'approved' && (
                        <Button
                          size="sm"
                          onClick={() => convertToOrderMutation.mutate(quote.id)}
                          disabled={convertToOrderMutation.isPending}
                          className="bg-black text-white hover:bg-gray-800"
                          data-testid={`button-convert-${quote.id}`}
                        >
                          <ShoppingBag className="h-4 w-4 mr-1" />
                          Convert to Order
                        </Button>
                      )}
                      {quote.status?.toLowerCase() === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => approvalMutation.mutate({ quoteId: quote.id, action: 'approve' })}
                            disabled={approvalMutation.isPending}
                            className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white"
                            data-testid={`button-approve-${quote.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => approvalMutation.mutate({ quoteId: quote.id, action: 'reject' })}
                            disabled={approvalMutation.isPending}
                            className="border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                            data-testid={`button-reject-${quote.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {quote.notes && (
                    <div className="pt-2">
                      <p className="text-xs text-gray-500">Note: <span className="text-gray-700">{quote.notes}</span></p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border border-gray-200">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No quotes found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
