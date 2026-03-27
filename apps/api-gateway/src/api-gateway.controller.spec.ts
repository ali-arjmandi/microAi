import { Test, TestingModule } from '@nestjs/testing';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';

describe('ApiGatewayController', () => {
  let apiGatewayController: ApiGatewayController;
  const apiGatewayServiceMock = {
    createTransaction: jest.fn(),
    getTransaction: jest.fn(),
    searchTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ApiGatewayController],
      providers: [{ provide: ApiGatewayService, useValue: apiGatewayServiceMock }],
    }).compile();

    apiGatewayController = app.get<ApiGatewayController>(ApiGatewayController);
  });

  describe('transactions', () => {
    it('should create a transaction', async () => {
      apiGatewayServiceMock.createTransaction.mockResolvedValue({
        transactionId: 'tx-123',
        state: 'INITIATED',
      });

      await expect(
        apiGatewayController.createTransaction({
          title: 'Condo',
          description: 'Condo with skyline views',
          propertyAddress: '123 Main St',
          price: 100000,
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
        }),
      ).resolves.toEqual({
        transactionId: 'tx-123',
        state: 'INITIATED',
      });
    });
  });
});
