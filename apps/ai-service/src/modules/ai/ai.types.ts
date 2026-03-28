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
  /** Buyer / transaction risk for this property listing (information quality, deal red flags)—not unrelated risk. */
  riskNarrative: string;
  searchTags: string[];
  improvedDescription: string;
  /** 0 = low buyer-deal risk; 100 = high—real-estate purchase context only. */
  riskScore: number;
  moderation: AiModerationResult;
}
