import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  const txMock = {};
  const prismaMock = {
    $transaction: jest.fn(),
  };
  const transactionRepositoryMock = {
    create: jest.fn(),
    search: jest.fn(),
    findById: jest.fn(),
  };
  const outboxRepositoryMock = {
    enqueueTransactionCreated: jest.fn(),
  };

  let service: TransactionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(txMock),
    );
    service = new TransactionsService(
      prismaMock as any,
      transactionRepositoryMock as any,
      outboxRepositoryMock as any,
    );
  });

  it('emits transaction.created payload with description', async () => {
    transactionRepositoryMock.create.mockResolvedValue({
      id: 'tx-1',
      title: 'Condo',
      description: 'Two-bedroom condo near downtown',
      propertyAddress: '123 Main St',
      price: 300000,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      state: 'INITIATED',
    });

    await service.createTransaction({
      title: 'Condo',
      description: 'Two-bedroom condo near downtown',
      propertyAddress: '123 Main St',
      price: 300000,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    });

    expect(outboxRepositoryMock.enqueueTransactionCreated).toHaveBeenCalledWith(
      'tx-1',
      expect.objectContaining({
        eventType: 'transaction.created',
        payload: expect.objectContaining({
          transactionId: 'tx-1',
          description: 'Two-bedroom condo near downtown',
        }),
      }),
      txMock,
    );
  });
});
