import { estypes } from '@elastic/elasticsearch';

export const SEARCH_INDEX_NAME_DEFAULT = 'transactions';

export const SEARCH_INDEX_MAPPINGS: Record<string, estypes.MappingProperty> = {
  transactionId: { type: 'keyword' as const },
  eventId: { type: 'keyword' as const },
  eventType: { type: 'keyword' as const },
  buyerId: { type: 'keyword' as const },
  sellerId: { type: 'keyword' as const },
  state: { type: 'keyword' as const },
  transactionState: { type: 'keyword' as const },
  searchStatus: { type: 'keyword' as const },
  aiStatus: { type: 'keyword' as const },
  moderationStatus: { type: 'keyword' as const },
  tags: { type: 'keyword' as const },
  title: {
    type: 'text' as const,
    fields: {
      keyword: { type: 'keyword' as const, ignore_above: 256 },
    },
  },
  description: {
    type: 'text' as const,
    fields: {
      keyword: { type: 'keyword' as const, ignore_above: 256 },
    },
  },
  propertyAddress: {
    type: 'text' as const,
    fields: {
      keyword: { type: 'keyword' as const, ignore_above: 256 },
    },
  },
  summary: {
    type: 'text' as const,
    fields: {
      keyword: { type: 'keyword' as const, ignore_above: 256 },
    },
  },
  improvedDescription: {
    type: 'text' as const,
    fields: {
      keyword: { type: 'keyword' as const, ignore_above: 256 },
    },
  },
  riskNarrative: {
    type: 'text' as const,
    fields: {
      keyword: { type: 'keyword' as const, ignore_above: 256 },
    },
  },
  moderationReason: {
    type: 'text' as const,
    fields: {
      keyword: { type: 'keyword' as const, ignore_above: 256 },
    },
  },
  price: { type: 'scaled_float' as const, scaling_factor: 100 },
  occurredAt: { type: 'date' as const },
  lastBaseEventOccurredAt: { type: 'date' as const },
  lastAiEventOccurredAt: { type: 'date' as const },
  createdAt: { type: 'date' as const },
  updatedAt: { type: 'date' as const },
};
