export interface RabbitMqConfig {
  url: string;
  queue: string;
}

export const rabbitMqConfig = (): RabbitMqConfig => ({
  url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
  queue: process.env.RABBITMQ_QUEUE ?? 'transaction.events',
});
