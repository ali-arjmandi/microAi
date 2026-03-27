import { Test, TestingModule } from '@nestjs/testing';
import { Client } from '@elastic/elasticsearch';
import { ReadinessService } from './readiness.service';
import { ELASTICSEARCH_CLIENT } from '../modules/elasticsearch/elasticsearch.constants';
import { RabbitMqConnectionService } from '../modules/rabbitmq/rabbitmq.connection.service';

describe('ReadinessService', () => {
  let service: ReadinessService;
  const rabbitMqConnectionServiceMock = {
    connect: jest.fn(),
    getChannel: jest.fn(),
  };
  const elasticsearchClientMock = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        {
          provide: RabbitMqConnectionService,
          useValue: rabbitMqConnectionServiceMock,
        },
        {
          provide: ELASTICSEARCH_CLIENT,
          useValue: elasticsearchClientMock as Partial<Client>,
        },
      ],
    }).compile();

    service = module.get<ReadinessService>(ReadinessService);
  });

  it('returns ready when RabbitMQ and Elasticsearch are up', async () => {
    rabbitMqConnectionServiceMock.connect.mockResolvedValue(undefined);
    rabbitMqConnectionServiceMock.getChannel.mockReturnValue({});
    elasticsearchClientMock.ping.mockResolvedValue(undefined);

    const status = await service.check();

    expect(status).toEqual({
      status: 'ready',
      dependencies: {
        rabbitmq: { status: 'up' },
        elasticsearch: { status: 'up' },
      },
    });
  });

  it('returns not_ready when RabbitMQ check fails', async () => {
    rabbitMqConnectionServiceMock.connect.mockRejectedValue(
      new Error('rabbit down'),
    );
    elasticsearchClientMock.ping.mockResolvedValue(undefined);

    const status = await service.check();

    expect(status.status).toBe('not_ready');
    expect(status.dependencies.rabbitmq.status).toBe('down');
    expect(status.dependencies.rabbitmq.message).toContain('rabbit down');
    expect(status.dependencies.elasticsearch.status).toBe('up');
  });

  it('returns not_ready when Elasticsearch check fails', async () => {
    rabbitMqConnectionServiceMock.connect.mockResolvedValue(undefined);
    rabbitMqConnectionServiceMock.getChannel.mockReturnValue({});
    elasticsearchClientMock.ping.mockRejectedValue(new Error('es down'));

    const status = await service.check();

    expect(status.status).toBe('not_ready');
    expect(status.dependencies.rabbitmq.status).toBe('up');
    expect(status.dependencies.elasticsearch.status).toBe('down');
    expect(status.dependencies.elasticsearch.message).toContain('es down');
  });
});
