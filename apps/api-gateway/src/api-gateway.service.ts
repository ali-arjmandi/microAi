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
  createTransaction(payload: CreateTransactionPayload): Observable<TransactionResponseDto>;
  getTransaction(payload: { transactionId: string }): Observable<GetTransactionDto>;
  searchTransactions(payload: SearchTransactionsQuery): Observable<SearchTransactionsResponseDto>;
}

@Injectable()
export class ApiGatewayService implements OnModuleInit {
  private transactionGrpcService: TransactionGrpcService;

  constructor(@Inject('TRANSACTION_GRPC') private readonly transactionClient: ClientGrpc) {}

  onModuleInit(): void {
    this.transactionGrpcService =
      this.transactionClient.getService<TransactionGrpcService>('TransactionService');
  }

  createTransaction(payload: CreateTransactionPayload): Promise<TransactionResponseDto> {
    return lastValueFrom(this.transactionGrpcService.createTransaction(payload));
  }

  getTransaction(transactionId: string): Promise<GetTransactionDto> {
    return lastValueFrom(this.transactionGrpcService.getTransaction({ transactionId }));
  }

  searchTransactions(query: SearchTransactionsQuery): Promise<SearchTransactionsResponseDto> {
    return lastValueFrom(this.transactionGrpcService.searchTransactions(query));
  }
}
