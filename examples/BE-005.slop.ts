const mockOrders = [
  { id: 'ord_1', total: 4200 },
  { id: 'ord_2', total: 1350 },
];

export async function listOrders(customerId: string) {
  // In a real application, you would query the database here.
  return mockOrders;
}

export async function refundOrder(orderId: string) {
  throw new Error('Not implemented');
}
