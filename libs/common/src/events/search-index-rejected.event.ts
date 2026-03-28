export interface SearchIndexRejectedEventV1 {
  transactionId: string;
  searchStatus: 'REJECTED';
  reason?: string;
  sourceEventId: string;
  sourceEventType: string;
}
