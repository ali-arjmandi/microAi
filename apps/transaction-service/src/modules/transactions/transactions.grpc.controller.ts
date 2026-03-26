import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CreateTransactionPayload, SearchTransactionsQuery } from '@app/common';
import { TransactionsService } from './transactions.service';

interface GetTransactionRequest {
  transactionId: string;
}

@Controller()
export class TransactionsGrpcController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @GrpcMethod('TransactionService', 'CreateTransaction')
  createTransaction(payload: CreateTransactionPayload) {
    return this.transactionsService.createTransaction(payload);
  }

  @GrpcMethod('TransactionService', 'GetTransaction')
  getTransaction({ transactionId }: GetTransactionRequest) {
    return this.transactionsService.getTransaction(transactionId);
  }

  @GrpcMethod('TransactionService', 'SearchTransactions')
  async searchTransactions(query: SearchTransactionsQuery) {
    return {
      items: await this.transactionsService.searchTransactions(query),
    };
  }
}
