import { useQuery } from '@apollo/client';
import {
  CUSTOMER_ORDERS_QUERY,
  ORDER_DETAIL_QUERY,
  CustomerOrdersResponse,
  OrderDetailResponse,
  OrdersVariables,
  OrderDetailVariables,
} from '@/graphql/queries/orders';

// Hook to fetch customer orders list
export function useOrders(first: number = 20, after?: string) {
  const { data, loading, error, fetchMore, refetch } = useQuery<
    CustomerOrdersResponse,
    OrdersVariables
  >(CUSTOMER_ORDERS_QUERY, {
    variables: { first, after },
    notifyOnNetworkStatusChange: true,
  });

  const orders = data?.customer?.orders?.edges?.map((edge) => edge.node) || [];
  const pageInfo = data?.customer?.orders?.pageInfo;

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
    orders,
    loading,
    error,
    pageInfo,
    loadMore,
    refetch,
  };
}

// Hook to fetch single order detail with custom fields
export function useOrderDetail(orderId: number | string) {
  const orderIdNum = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;

  const { data, loading, error, refetch } = useQuery<
    OrderDetailResponse,
    OrderDetailVariables
  >(ORDER_DETAIL_QUERY, {
    variables: { orderId: orderIdNum },
    skip: !orderId || isNaN(orderIdNum),
  });

  const order = data?.customer?.order;

  return {
    order,
    loading,
    error,
    refetch,
  };
}

// Transform order for legacy compatibility (if needed)
export function transformOrderForLegacy(order: any) {
  if (!order) return null;

  return {
    id: order.entityId,
    orderId: order.entityId,
    date: order.orderedAt?.utc,
    status: order.status?.value || order.status?.label,
    statusLabel: order.status?.label,
    total: order.totalIncTax?.value,
    currency: order.totalIncTax?.currencyCode || 'USD',
    subtotal: order.subTotal?.value,
    tax: order.taxTotal?.value,
    shipping: order.shippingCostTotal?.value,
    items: order.consignments?.shipping?.edges?.flatMap((edge: any) =>
      edge.node.lineItems?.edges?.map((itemEdge: any) => ({
        id: itemEdge.node.entityId,
        name: itemEdge.node.productName,
        quantity: itemEdge.node.quantity,
        price: itemEdge.node.subTotalListPrice?.value,
      })) || []
    ) || [],
    shippingAddress: order.consignments?.shipping?.edges?.[0]?.node?.shippingAddress,
    billingAddress: order.billingAddress,
    // Custom fields from GraphQL
    extraFields: order.extraFields || [],
    hasCustomFields: (order.extraFields?.length || 0) > 0,
  };
}
