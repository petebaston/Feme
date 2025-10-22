import { useQuery } from '@apollo/client';
import {
  QUOTES_QUERY,
  QUOTE_DETAIL_QUERY,
  QuotesResponse,
  QuoteDetailResponse,
  QuotesVariables,
  QuoteDetailVariables,
} from '@/graphql/queries/quotes';

// Hook to fetch customer quotes list
export function useQuotes(first: number = 20, after?: string) {
  const { data, loading, error, fetchMore, refetch } = useQuery<
    QuotesResponse,
    QuotesVariables
  >(QUOTES_QUERY, {
    variables: { first, after },
    notifyOnNetworkStatusChange: true,
  });

  const quotes = data?.customer?.quotes?.edges?.map((edge) => edge.node) || [];
  const pageInfo = data?.customer?.quotes?.pageInfo;

  const loadMore = async () => {
    if (pageInfo?.hasNextPage && pageInfo?.endCursor) {
      return fetchMore({
        variables: {
          after: pageInfo.endCursor,
        },
      });
    }
  };

  return {
    quotes,
    loading,
    error,
    pageInfo,
    loadMore,
    refetch,
  };
}

// Hook to fetch single quote detail
export function useQuoteDetail(quoteId: number | string) {
  const quoteIdNum = typeof quoteId === 'string' ? parseInt(quoteId, 10) : quoteId;

  const { data, loading, error, refetch } = useQuery<
    QuoteDetailResponse,
    QuoteDetailVariables
  >(QUOTE_DETAIL_QUERY, {
    variables: { quoteId: quoteIdNum },
    skip: !quoteId || isNaN(quoteIdNum),
  });

  const quote = data?.customer?.quote;

  return {
    quote,
    loading,
    error,
    refetch,
  };
}

// Transform quote for legacy compatibility
export function transformQuoteForLegacy(quote: any) {
  if (!quote) return null;

  return {
    id: quote.entityId,
    quoteId: quote.entityId,
    createdAt: quote.createdAt?.utc,
    updatedAt: quote.updatedAt?.utc,
    expiresAt: quote.expiresAt?.utc,
    status: quote.status,
    total: quote.grandTotal?.value,
    currency: quote.grandTotal?.currencyCode || 'USD',
    subtotal: quote.subTotal?.value,
    tax: quote.taxTotal?.value,
    shipping: quote.shippingTotal?.value,
    items: quote.lineItems?.edges?.map((edge: any) => ({
      id: edge.node.entityId,
      name: edge.node.productName,
      sku: edge.node.sku,
      quantity: edge.node.quantity,
      price: edge.node.netPrice?.value,
      options: edge.node.productOptions,
    })) || [],
    shippingAddress: quote.shippingAddress,
    billingAddress: quote.billingAddress,
    // Custom fields
    extraFields: quote.extraFields || [],
    hasCustomFields: (quote.extraFields?.length || 0) > 0,
  };
}
