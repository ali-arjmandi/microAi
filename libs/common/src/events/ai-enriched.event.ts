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
  riskScore: number;
  moderation: AiModerationResult;
  model: string;
  promptVersion: string;
}
