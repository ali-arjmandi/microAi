import { TransactionState } from '../transaction.types';

export class TransactionResponseDto {
  transactionId: string;

  state: TransactionState;
}
