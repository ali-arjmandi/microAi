export interface ListingEnrichmentInput {
  title?: string;
  description?: string;
  propertyAddress?: string;
  price?: number;
  state?: string;
}

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
  riskScore: number;
  moderation: AiModerationResult;
}
