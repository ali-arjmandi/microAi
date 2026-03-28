import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SearchTransactionsQuery } from '@app/common';
import { TransactionSearchService } from './transaction-search.service';

@Controller()
export class SearchGrpcController {
  constructor(
    private readonly transactionSearchService: TransactionSearchService,
  ) {}

  @GrpcMethod('SearchService', 'SearchTransactions')
  async searchTransactions(query: SearchTransactionsQuery) {
    const items = await this.transactionSearchService.search(query);
    return { items };
  }
}
