import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReadinessService } from './readiness.service';

describe('HealthController', () => {
  let controller: HealthController;
  const readinessServiceMock = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ReadinessService,
          useValue: readinessServiceMock,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns liveness ok response', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('returns readiness payload when dependencies are healthy', async () => {
    readinessServiceMock.check.mockResolvedValue({
      status: 'ready',
      dependencies: {
        rabbitmq: { status: 'up' },
        elasticsearch: { status: 'up' },
      },
    });

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ready',
      dependencies: {
        rabbitmq: { status: 'up' },
        elasticsearch: { status: 'up' },
      },
    });
  });

  it('throws 503 when readiness is not healthy', async () => {
    readinessServiceMock.check.mockResolvedValue({
      status: 'not_ready',
      dependencies: {
        rabbitmq: { status: 'down', message: 'unreachable' },
        elasticsearch: { status: 'up' },
      },
    });

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
