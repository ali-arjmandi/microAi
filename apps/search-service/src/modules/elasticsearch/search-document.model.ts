export interface SearchDocument {
  transactionId: string;
  eventId?: string;
  eventType?: string;
  buyerId?: string;
  sellerId?: string;
  state?: string;
  transactionState?: string;
  searchStatus?: string;
  aiStatus?: string;
  moderationStatus?: string;
  tags?: string[];
  title?: string;
  description?: string;
  propertyAddress?: string;
  summary?: string;
  improvedDescription?: string;
  riskNarrative?: string;
  moderationReason?: string;
  price?: number;
  occurredAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SearchDocumentPatch = Partial<SearchDocument> &
  Pick<SearchDocument, 'transactionId'>;
