import { TransactionRepository } from './transaction.repository';

describe('TransactionRepository', () => {
  const prismaMock = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  let repository: TransactionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TransactionRepository(prismaMock as any);
  });

  it('persists description when creating a transaction', async () => {
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });

    await repository.create({
      title: 'Condo',
      description: 'Cozy condo with balcony',
      propertyAddress: '123 Main St',
      price: 450000,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    });

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Cozy condo with balcony',
        }),
      }),
    );
  });

  it('searches description alongside title and address', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await repository.search('balcony');

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([
            { title: { contains: 'balcony', mode: 'insensitive' } },
            { description: { contains: 'balcony', mode: 'insensitive' } },
            { propertyAddress: { contains: 'balcony', mode: 'insensitive' } },
          ]),
        },
      }),
    );
  });

  it('persists AI enrichment fields when applying search outcome from ai.enriched', async () => {
    prismaMock.transaction.update.mockResolvedValue({ id: 'tx-ai' });

    const enrichment = {
      summary: 'Sum',
      riskNarrative: 'Risk text',
      improvedDescription: 'Better',
      riskScore: 55,
      tags: ['x', 'y'],
      moderation: {
        status: 'REVIEW' as const,
        reason: 'unsure',
        confidence: 0.4,
      },
      model: 'gpt',
      promptVersion: 'v2',
    };

    await repository.applySearchIndexUpdated(
      'tx-ai',
      'ai.enriched',
      enrichment,
    );

    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-ai' },
        data: expect.objectContaining({
          summary: 'Sum',
          riskNarrative: 'Risk text',
          improvedDescription: 'Better',
          searchTags: ['x', 'y'],
          aiModelVersion: 'gpt',
          aiPromptVersion: 'v2',
          moderationReason: 'unsure',
        }),
      }),
    );
  });
});
