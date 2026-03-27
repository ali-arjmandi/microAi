import * as Joi from 'joi';
import { AiModelOutputInvalidError } from './ai-model-output.error';
import { AiEnrichmentResult } from './ai.types';

const moderationSchema = Joi.object({
  status: Joi.string().valid('ALLOW', 'REJECT', 'REVIEW').required(),
  reason: Joi.string().required(),
  confidence: Joi.number().min(0).max(1).required(),
}).strict();

export const aiEnrichmentOutputSchema = Joi.object({
  summary: Joi.string().required(),
  riskNarrative: Joi.string().required(),
  searchTags: Joi.array().items(Joi.string().min(1)).required(),
  improvedDescription: Joi.string().required(),
  moderation: moderationSchema.required(),
}).strict();

export function parseValidAiEnrichmentOutput(
  payload: unknown,
): AiEnrichmentResult {
  const { error, value } = aiEnrichmentOutputSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const detail = error.details.map((d) => d.message).join('; ');
    throw new AiModelOutputInvalidError(
      'schema_validation_failed',
      'AI output failed schema validation',
      truncateDetail(detail),
    );
  }

  const v = value as AiEnrichmentResult;
  return {
    summary: v.summary,
    riskNarrative: v.riskNarrative,
    searchTags: v.searchTags,
    improvedDescription: v.improvedDescription,
    moderation: {
      status: v.moderation.status,
      reason: v.moderation.reason,
      confidence: v.moderation.confidence,
    },
  };
}

const MAX_DETAIL_LEN = 2_000;

function truncateDetail(detail: string): string {
  if (detail.length <= MAX_DETAIL_LEN) {
    return detail;
  }
  return `${detail.slice(0, MAX_DETAIL_LEN)}…`;
}
