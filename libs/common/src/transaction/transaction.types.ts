export enum TransactionState {
  INITIATED = 'INITIATED',
  AI_PROCESSING = 'AI_PROCESSING',
  REJECTED_MODERATION = 'REJECTED_MODERATION',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum AiProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SearchIndexStatus {
  PENDING = 'PENDING',
  INDEXED_BASE = 'INDEXED_BASE',
  INDEXED_ENRICHED = 'INDEXED_ENRICHED',
  FAILED = 'FAILED',
}

export enum ModerationStatus {
  PENDING = 'PENDING',
  ALLOW = 'ALLOW',
  REVIEW = 'REVIEW',
  REJECT = 'REJECT',
}

export interface CreateTransactionPayload {
  title: string;
  description: string;
  propertyAddress: string;
  price: number;
  buyerId: string;
  sellerId: string;
}

export interface TransactionRecord extends CreateTransactionPayload {
  transactionId: string;
  state: TransactionState;
  aiStatus: AiProcessingStatus;
  searchStatus: SearchIndexStatus;
  moderationStatus: ModerationStatus;
}

export interface SearchTransactionsQuery {
  query?: string;
}
