export interface AiModerationResult {
  status: 'ALLOW' | 'REJECT' | 'REVIEW';
  reason: string;
  confidence: number;
}

export interface AiEnrichmentResult {
  summary: string;
  riskNarrative: string;
  searchTags: string[];
  improvedDescription: string;
  moderation: AiModerationResult;
}
