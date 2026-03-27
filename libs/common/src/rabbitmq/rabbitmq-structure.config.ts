export const rabbitmqStructureConfig = {
  apps: {
    transactionService: {
      queue: 'transaction-service.queue',
      exchange: {
        name: 'transaction.events',
        type: 'topic',
        durable: true,
        bind: {
          'transaction.created': ['search-service.queue', 'ai-service.queue'],
          'transaction.updated': ['search-service.queue', 'ai-service.queue'],
          'transaction.deleted': ['search-service.queue'],
        },
      },
    },
    aiService: {
      queue: 'ai-service.queue',
      exchange: {
        name: 'ai.events',
        type: 'topic',
        durable: true,
        bind: {
          'ai.enriched': ['search-service.queue'],
          'ai.rejected': ['search-service.queue'],
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
          'search.index.updated': ['transaction-service.queue'],
          'search.index.rejected': ['transaction-service.queue'],
        },
      },
    },
  },
} as const;
