import {
  AiProcessingStatus,
  ModerationStatus,
  SearchIndexStatus,
  TransactionState,
} from '../transaction.types';

export class GetTransactionDto {
  transactionId: string;

  title: string;

  description: string;

  propertyAddress: string;

  price: number;

  buyerId: string;

  sellerId: string;

  state: TransactionState;

  aiStatus: AiProcessingStatus;

  searchStatus: SearchIndexStatus;

  moderationStatus: ModerationStatus;

  summary?: string;

  improvedDescription?: string;

  riskNarrative?: string;

  riskScore?: number;

  moderationReason?: string;

  moderationConfidence?: number;

  searchTags?: string[];

  aiModelVersion?: string;

  aiPromptVersion?: string;
}
