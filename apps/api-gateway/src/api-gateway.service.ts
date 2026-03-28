import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, Observable } from 'rxjs';
import {
  CreateTransactionPayload,
  GetTransactionDto,
  SearchTransactionsQuery,
  SearchTransactionsResponseDto,
  TransactionResponseDto,
} from '@app/common';

interface TransactionGrpcService {
  createTransaction(
    payload: CreateTransactionPayload,
  ): Observable<TransactionResponseDto>;
  getTransaction(payload: {
    transactionId: string;
  }): Observable<GetTransactionDto>;
}

interface SearchGrpcService {
  searchTransactions(
    payload: SearchTransactionsQuery,
  ): Observable<SearchTransactionsResponseDto>;
}

@Injectable()
export class ApiGatewayService implements OnModuleInit {
  private transactionGrpcService: TransactionGrpcService;
  private searchGrpcService: SearchGrpcService;

  constructor(
    @Inject('TRANSACTION_GRPC') private readonly transactionClient: ClientGrpc,
    @Inject('SEARCH_GRPC') private readonly searchClient: ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.transactionGrpcService =
      this.transactionClient.getService<TransactionGrpcService>(
        'TransactionService',
      );
    this.searchGrpcService =
      this.searchClient.getService<SearchGrpcService>('SearchService');
  }

  createTransaction(
    payload: CreateTransactionPayload,
  ): Promise<TransactionResponseDto> {
    return lastValueFrom(
      this.transactionGrpcService.createTransaction(payload),
    );
  }

  getTransaction(transactionId: string): Promise<GetTransactionDto> {
    return lastValueFrom(
      this.transactionGrpcService.getTransaction({ transactionId }),
    );
  }

  searchTransactions(
    query: SearchTransactionsQuery,
  ): Promise<SearchTransactionsResponseDto> {
    return lastValueFrom(this.searchGrpcService.searchTransactions(query));
  }
}
