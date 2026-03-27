export const rabbitmqStructureConfig = {
  apps: {
    transactionService: {
      queue: 'transaction-service.queue',
      exchange: {
        name: 'transaction.events',
        type: 'topic',
        durable: true,
        bind: {
          'transaction.created': 'search-service.queue',
          'transaction.updated': 'search-service.queue',
          'transaction.deleted': 'search-service.queue',
        },
      },
    },
    searchService: {
      queue: 'search-service.queue',
      exchange: {
        name: 'search.events',
        type: 'topic',
        durable: true,
        bind: {
          'search.index.updated': 'transaction-service.queue',
          'search.index.rejected': 'transaction-service.queue',
        },
      },
    },
  },
} as const;
