export const rabbitmqStructureConfig = {
  apps: {
    transactionService: {
      exchange: 'transaction.events',
      queue: 'transaction-service.queue',
      publishRoutingKeys: [
        'transaction.created',
        'transaction.updated',
        'transaction.deleted',
      ],
      subscribeRoutingKeys: ['search.index.updated', 'search.index.rejected'],
    },
    searchService: {
      exchange: 'search.events',
      queue: 'search-service.queue',
      publishRoutingKeys: ['search.index.updated', 'search.index.rejected'],
      subscribeRoutingKeys: [
        'transaction.created',
        'transaction.updated',
        'transaction.deleted',
        'ai.enriched',
        'ai.rejected',
      ],
    },
  },
} as const;
