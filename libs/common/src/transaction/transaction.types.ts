export enum TransactionState {
  INITIATED = 'INITIATED',
}

export interface CreateTransactionPayload {
  title: string;
  propertyAddress: string;
  price: number;
  buyerId: string;
  sellerId: string;
}

export interface TransactionRecord extends CreateTransactionPayload {
  transactionId: string;
  state: TransactionState;
}

export interface SearchTransactionsQuery {
  query?: string;
}
