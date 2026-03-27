export type AiModerationStatus = 'ALLOW' | 'REJECT' | 'REVIEW';

export interface AiModerationResult {
  status: AiModerationStatus;
  reason: string;
  confidence: number;
}

export interface AiEnrichedEvent {
  transactionId: string;
  summary: string;
  riskNarrative: string;
  tags: string[];
  improvedDescription: string;
  moderation: AiModerationResult;
  model: string;
  promptVersion: string;
}
