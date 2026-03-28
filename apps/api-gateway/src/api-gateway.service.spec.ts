import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { ApiGatewayService } from './api-gateway.service';

describe('ApiGatewayService', () => {
  let service: ApiGatewayService;

  const transactionApi = {
    createTransaction: jest.fn(),
    getTransaction: jest.fn(),
  };

  const searchApi = {
    searchTransactions: jest.fn().mockReturnValue(of({ items: [] })),
  };

  const transactionClient = {
    getService: jest.fn((name: string) => {
      if (name === 'TransactionService') {
        return transactionApi;
      }
      throw new Error(`Unexpected gRPC service: ${name}`);
    }),
  };

  const searchClient = {
    getService: jest.fn((name: string) => {
      if (name === 'SearchService') {
        return searchApi;
      }
      throw new Error(`Unexpected gRPC service: ${name}`);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiGatewayService,
        { provide: 'TRANSACTION_GRPC', useValue: transactionClient },
        { provide: 'SEARCH_GRPC', useValue: searchClient },
      ],
    }).compile();

    service = module.get(ApiGatewayService);
    await module.init();
  });

  it('searchTransactions uses SearchService gRPC client', async () => {
    await service.searchTransactions({ query: 'downtown' });
    expect(searchApi.searchTransactions).toHaveBeenCalledWith({
      query: 'downtown',
    });
  });
});
