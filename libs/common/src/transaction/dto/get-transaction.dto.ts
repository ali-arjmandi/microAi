import { TransactionState } from '../transaction.types';

export class GetTransactionDto {
  transactionId: string;

  title: string;

  description: string;

  propertyAddress: string;

  price: number;

  buyerId: string;

  sellerId: string;

  state: TransactionState;
}
