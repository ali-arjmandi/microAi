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

  it('strips empty searchTags entries so validation passes', () => {
    const out = parseValidAiEnrichmentOutput({
      ...valid,
      searchTags: [''],
    });
    expect(out.searchTags).toEqual([]);
  });

  it('fills empty moderation.reason for ALLOW with approved', () => {
    const out = parseValidAiEnrichmentOutput({
      ...valid,
      moderation: { status: 'ALLOW', reason: '', confidence: 0.9 },
    });
    expect(out.moderation.reason).toBe('approved');
  });

  it('fills empty moderation.reason for REJECT with rejected', () => {
    const out = parseValidAiEnrichmentOutput({
      ...valid,
      moderation: { status: 'REJECT', reason: '', confidence: 0.9 },
    });
    expect(out.moderation.reason).toBe('rejected');
  });

  it('trims moderation.reason whitespace', () => {
    const out = parseValidAiEnrichmentOutput({
      ...valid,
      moderation: { status: 'ALLOW', reason: '  ok  ', confidence: 0.9 },
    });
    expect(out.moderation.reason).toBe('ok');
  });

  it('fills empty summary, riskNarrative, improvedDescription for REJECT so Joi passes', () => {
    const out = parseValidAiEnrichmentOutput({
      summary: '',
      riskNarrative: '   ',
      improvedDescription: '',
      searchTags: [],
      riskScore: 40,
      moderation: {
        status: 'REJECT',
        reason: 'inappropriate_sexual_content',
        confidence: 0.95,
      },
    });
    expect(out.summary).toBe('Listing not published.');
    expect(out.riskNarrative).toContain('Not assessed');
    expect(out.improvedDescription).toContain('withheld');
    expect(out.moderation.reason).toBe('inappropriate_sexual_content');
  });

  it('defaults invalid riskScore when REJECT', () => {
    const out = parseValidAiEnrichmentOutput({
      ...valid,
      moderation: { status: 'REJECT', reason: 'x', confidence: 0.9 },
      riskScore: Number.NaN,
      summary: 's',
      riskNarrative: 'r',
      improvedDescription: 'd',
    });
    expect(out.riskScore).toBe(0);
  });

  it('strips empty strings from searchTags', () => {
    const out = parseValidAiEnrichmentOutput({
      ...valid,
      searchTags: ['', '  ok  ', ''],
    });
    expect(out.searchTags).toEqual(['ok']);
  });
});
