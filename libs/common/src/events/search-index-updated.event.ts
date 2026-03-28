import type { AiModerationResult } from './ai-enriched.event';

export interface SearchIndexUpdatedEnrichmentV1 {
  summary: string;
  riskNarrative: string;
  tags: string[];
  improvedDescription: string;
  moderation: AiModerationResult;
  model: string;
  promptVersion: string;
  riskScore: number;
}

export interface SearchIndexUpdatedEventV1 {
  transactionId: string;
  searchStatus: 'UPDATED';
  sourceEventId: string;
  sourceEventType: string;
  enrichment?: SearchIndexUpdatedEnrichmentV1;
}
