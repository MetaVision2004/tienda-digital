export const orderStatuses = ["pending", "paid", "delivered", "cancelled", "refunded"] as const;

export type OrderStatus = (typeof orderStatuses)[number];

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

function isOrderStatus(status: string): status is OrderStatus {
  return (orderStatuses as readonly string[]).includes(status);
}

export function canTransitionOrderStatus(current: string, next: string) {
  if (!isOrderStatus(current) || !isOrderStatus(next)) return false;
  return current === next || transitions[current].includes(next);
}

export function getOrderStatusOptions(current: string): OrderStatus[] {
  if (!isOrderStatus(current)) return [];
  return [current, ...transitions[current]];
}