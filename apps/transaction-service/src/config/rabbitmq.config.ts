export interface RabbitMqConfig {
  readonly url: string;
  readonly outboxExchange: string;
}

export const rabbitMqConfig = (): RabbitMqConfig => ({
  url: process.env.RABBITMQ_URL ?? '',
  outboxExchange: process.env.OUTBOX_EXCHANGE ?? 'transaction.events',
});
