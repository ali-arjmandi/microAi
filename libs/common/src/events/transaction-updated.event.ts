export interface TransactionUpdatedEvent {
  transactionId: string;
  title?: string;
  propertyAddress?: string;
  price?: number;
  buyerId?: string;
  sellerId?: string;
  state?: string;
}
