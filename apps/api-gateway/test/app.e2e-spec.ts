import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiGatewayController } from './../src/api-gateway.controller';
import { ApiGatewayService } from './../src/api-gateway.service';

describe('ApiGatewayController (e2e)', () => {
  let app: INestApplication;
  const apiGatewayServiceMock = {
    createTransaction: jest.fn().mockResolvedValue({
      transactionId: 'tx-123',
      state: 'INITIATED',
    }),
    getTransaction: jest.fn(),
    searchTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiGatewayController],
      providers: [{ provide: ApiGatewayService, useValue: apiGatewayServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    const swaggerConfig = new DocumentBuilder().setTitle('Test').setVersion('1.0').build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
    await app.init();
  });

  it('/docs (GET)', () => {
    return request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('/transactions (POST)', () => {
    return request(app.getHttpServer())
      .post('/transactions')
      .send({
        title: 'Condo',
        propertyAddress: '123 Main St',
        price: 100000,
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
      })
      .expect(201)
      .expect({ transactionId: 'tx-123', state: 'INITIATED' });
  });
});
