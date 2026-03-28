import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AiClientService } from './ai-client.service';

describe('AiClientService', () => {
  const validModelJson = {
    summary: 's',
    riskNarrative: 'r',
    searchTags: ['tag'],
    improvedDescription: 'd',
    riskScore: 10,
    moderation: {
      status: 'ALLOW' as const,
      reason: 'approved',
      confidence: 0.9,
    },
  };

  let service: AiClientService;
  let fetchSpy: jest.SpyInstance;

  async function createModule(config: Record<string, string | number>) {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AiClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => config[key]),
          },
        },
      ],
    }).compile();

    return moduleRef.get(AiClientService);
  }

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('retries OpenRouter fetch on transient failure then returns parsed enrichment', async () => {
    service = await createModule({
      OPENROUTER_API_KEY: 'key',
      AI_MAX_RETRIES: 1,
      AI_TIMEOUT_MS: 5000,
    });

    const successPayload = {
      choices: [
        {
          message: {
            content: JSON.stringify(validModelJson),
          },
        },
      ],
    };

    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'upstream unavailable',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => successPayload,
      } as Response);

    const out = await service.generateEnrichment({
      title: 'House',
      description: 'Nice',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(out.summary).toBe('s');
    expect(out.moderation.status).toBe('ALLOW');
  });

  it('throws after exhausting OpenRouter retries', async () => {
    service = await createModule({
      OPENROUTER_API_KEY: 'key',
      AI_MAX_RETRIES: 1,
      AI_TIMEOUT_MS: 5000,
    });

    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    } as Response);

    await expect(
      service.generateEnrichment({ title: 'x' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
