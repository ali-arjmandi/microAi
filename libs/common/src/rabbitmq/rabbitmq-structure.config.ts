export const rabbitmqStructureConfig = {
  apps: {
    transactionService: {
      exchange: 'transaction.events',
      queues: [],
    },
  },
} as const;
