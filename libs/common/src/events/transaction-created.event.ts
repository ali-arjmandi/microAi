export interface TransactionCreatedEvent {
  transactionId: string;
  title: string;
  propertyAddress: string;
  price: number;
  buyerId: string;
  sellerId: string;
  state: string;
}
