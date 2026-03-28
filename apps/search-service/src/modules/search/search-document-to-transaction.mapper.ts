import {
  AiProcessingStatus,
  ModerationStatus,
  SearchIndexStatus,
  TransactionRecord,
  TransactionState,
} from '@app/common';
import { SearchDocument } from '../elasticsearch/search-document.model';

function mapSearchIndexStatus(
  raw: string | undefined,
  doc: SearchDocument,
): SearchIndexStatus {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'FAILED') {
    return SearchIndexStatus.FAILED;
  }
  if (upper === 'PENDING_BASE' || !upper) {
    return SearchIndexStatus.PENDING;
  }
  if (upper === 'READY') {
    const enriched =
      Boolean(doc.summary?.trim()) && Boolean(doc.improvedDescription?.trim());
    return enriched
      ? SearchIndexStatus.INDEXED_ENRICHED
      : SearchIndexStatus.INDEXED_BASE;
  }
  return SearchIndexStatus.PENDING;
}

function mapTransactionState(raw: string | undefined): TransactionState {
  const upper = raw?.trim().toUpperCase();
  if (!upper) {
    return TransactionState.INITIATED;
  }
  const allowed = new Set(Object.values(TransactionState));
  if (allowed.has(upper as TransactionState)) {
    return upper as TransactionState;
  }
  return TransactionState.INITIATED;
}

function mapAiStatus(raw: string | undefined): AiProcessingStatus {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'COMPLETED') {
    return AiProcessingStatus.COMPLETED;
  }
  if (upper === 'FAILED') {
    return AiProcessingStatus.FAILED;
  }
  if (upper === 'PROCESSING') {
    return AiProcessingStatus.PROCESSING;
  }
  return AiProcessingStatus.PENDING;
}

function mapModerationStatus(raw: string | undefined): ModerationStatus {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'ALLOW') {
    return ModerationStatus.ALLOW;
  }
  if (upper === 'REVIEW') {
    return ModerationStatus.REVIEW;
  }
  if (upper === 'REJECT') {
    return ModerationStatus.REJECT;
  }
  return ModerationStatus.PENDING;
}

export function searchDocumentToTransactionRecord(
  doc: SearchDocument,
): TransactionRecord {
  const stateRaw = doc.state ?? doc.transactionState;
  const record: TransactionRecord = {
    transactionId: doc.transactionId?.trim() ?? '',
    title: doc.title?.trim() ?? '',
    description: doc.description?.trim() ?? '',
    propertyAddress: doc.propertyAddress?.trim() ?? '',
    price:
      typeof doc.price === 'number' && !Number.isNaN(doc.price) ? doc.price : 0,
    buyerId: doc.buyerId?.trim() ?? '',
    sellerId: doc.sellerId?.trim() ?? '',
    state: mapTransactionState(stateRaw),
    aiStatus: mapAiStatus(doc.aiStatus),
    searchStatus: mapSearchIndexStatus(doc.searchStatus, doc),
    moderationStatus: mapModerationStatus(doc.moderationStatus),
  };

  if (doc.summary?.trim()) {
    record.summary = doc.summary.trim();
  }
  if (doc.improvedDescription?.trim()) {
    record.improvedDescription = doc.improvedDescription.trim();
  }
  if (doc.riskNarrative?.trim()) {
    record.riskNarrative = doc.riskNarrative.trim();
  }
  if (doc.moderationReason?.trim()) {
    record.moderationReason = doc.moderationReason.trim();
  }
  if (Array.isArray(doc.tags) && doc.tags.length > 0) {
    record.searchTags = doc.tags.filter(
      (t): t is string => typeof t === 'string' && t.trim().length > 0,
    );
  }

  return record;
}
