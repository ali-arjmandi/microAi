export type AiModerationStatus = 'ALLOW' | 'REJECT' | 'REVIEW';

export interface AiModerationResult {
  status: AiModerationStatus;
  reason: string;
  confidence: number;
}

export interface AiEnrichedEventV1 {
  transactionId: string;
  summary: string;
  riskNarrative: string;
  searchTags: string[];
  improvedDescription: string;
  moderation: AiModerationResult;
  model: string;
  promptVersion: string;
}
