export interface SearchIndexUpdatedEventV1 {
  transactionId: string;
  searchStatus: 'UPDATED';
  sourceEventId: string;
  sourceEventType: string;
}
