import { AiModelOutputInvalidError } from './ai-model-output.error';
import { parseValidAiEnrichmentOutput } from './ai-enrichment-output.schema';

describe('parseValidAiEnrichmentOutput', () => {
  const valid = {
    summary: 's',
    riskNarrative: 'r',
    searchTags: ['a'],
    improvedDescription: 'd',
    riskScore: 25,
    moderation: {
      status: 'ALLOW' as const,
      reason: 'ok',
      confidence: 0.5,
    },
  };

  it('accepts a minimal valid payload', () => {
    expect(parseValidAiEnrichmentOutput(valid)).toEqual(valid);
  });

  it('rejects unknown top-level keys (strict schema)', () => {
    expect(() => parseValidAiEnrichmentOutput({ ...valid, extra: 1 })).toThrow(
      AiModelOutputInvalidError,
    );
  });

  it('rejects invalid moderation.status', () => {
    expect(() =>
      parseValidAiEnrichmentOutput({
        ...valid,
        moderation: { ...valid.moderation, status: 'NOPE' },
      }),
    ).toThrow(AiModelOutputInvalidError);
  });

  it('rejects searchTags with empty string entries', () => {
    expect(() =>
      parseValidAiEnrichmentOutput({
        ...valid,
        searchTags: [''],
      }),
    ).toThrow(AiModelOutputInvalidError);
  });
});
