import * as Joi from 'joi';
import { AiModelOutputInvalidError } from './ai-model-output.error';
import { AiEnrichmentResult } from './ai.types';

const moderationSchema = Joi.object({
  status: Joi.string().valid('ALLOW', 'REJECT', 'REVIEW').required(),
  reason: Joi.string().trim().min(1).required(),
  confidence: Joi.number().min(0).max(1).required(),
}).strict();

export const aiEnrichmentOutputSchema = Joi.object({
  summary: Joi.string().trim().min(1).required(),
  riskNarrative: Joi.string().trim().min(1).required(),
  searchTags: Joi.array().items(Joi.string().min(1)).required(),
  improvedDescription: Joi.string().trim().min(1).required(),
  riskScore: Joi.number().min(0).max(100).required(),
  moderation: moderationSchema.required(),
}).strict();

function defaultReasonForModerationStatus(
  status: string,
): 'approved' | 'needs_review' | 'rejected' | 'unspecified' {
  const u = status.trim().toUpperCase();
  if (u === 'ALLOW') {
    return 'approved';
  }
  if (u === 'REVIEW') {
    return 'needs_review';
  }
  if (u === 'REJECT') {
    return 'rejected';
  }
  return 'unspecified';
}

function moderationStatusUpper(root: Record<string, unknown>): string {
  const mod = root.moderation;
  if (!mod || typeof mod !== 'object') {
    return '';
  }
  const s = (mod as Record<string, unknown>).status;
  return typeof s === 'string' ? s.trim().toUpperCase() : '';
}

function summaryFallback(status: string): string {
  if (status === 'REJECT') {
    return 'Listing not published.';
  }
  if (status === 'REVIEW') {
    return 'Listing under review.';
  }
  return 'No summary provided.';
}

function riskNarrativeFallback(status: string): string {
  if (status === 'REJECT' || status === 'REVIEW') {
    return 'Not assessed: listing rejected or under review before property risk analysis.';
  }
  return 'Insufficient detail to assess property transaction risk.';
}

function improvedDescriptionFallback(status: string): string {
  if (status === 'REJECT') {
    return 'Description withheld; listing did not meet publication guidelines.';
  }
  if (status === 'REVIEW') {
    return 'Description pending review.';
  }
  return 'No description provided.';
}

function normalizeTopLevelEnrichmentFields(
  root: Record<string, unknown>,
): void {
  const status = moderationStatusUpper(root);

  const fillText = (key: string, fallback: string) => {
    const v = root[key];
    const t = typeof v === 'string' ? v.trim() : '';
    root[key] = t || fallback;
  };

  fillText('summary', summaryFallback(status));
  fillText('riskNarrative', riskNarrativeFallback(status));
  fillText('improvedDescription', improvedDescriptionFallback(status));

  const rawTags = root.searchTags;
  if (!Array.isArray(rawTags)) {
    root.searchTags = [];
  } else {
    root.searchTags = rawTags
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim());
  }

  const rs = root.riskScore;
  if (typeof rs !== 'number' || Number.isNaN(rs)) {
    root.riskScore = status === 'REJECT' || status === 'REVIEW' ? 0 : 50;
  } else {
    root.riskScore = Math.min(100, Math.max(0, rs));
  }
}

/** Coerces model output so Joi passes: non-empty moderation.reason and enrichment strings. */
export function normalizeEnrichmentPayloadBeforeValidation(
  payload: unknown,
): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const root = { ...(payload as Record<string, unknown>) };
  const modRaw = root.moderation;
  if (!modRaw || typeof modRaw !== 'object') {
    return payload;
  }
  const mod = { ...(modRaw as Record<string, unknown>) };
  const statusStr = typeof mod.status === 'string' ? mod.status : '';
  const rawReason = mod.reason;
  const trimmed = typeof rawReason === 'string' ? rawReason.trim() : '';
  if (!trimmed) {
    mod.reason = defaultReasonForModerationStatus(statusStr);
  } else {
    mod.reason = trimmed;
  }
  root.moderation = mod;
  normalizeTopLevelEnrichmentFields(root);
  return root;
}

export function parseValidAiEnrichmentOutput(
  payload: unknown,
): AiEnrichmentResult {
  const normalized = normalizeEnrichmentPayloadBeforeValidation(payload);
  const { error, value } = aiEnrichmentOutputSchema.validate(normalized, {
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
    riskScore: v.riskScore,
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
