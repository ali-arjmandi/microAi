import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEnvelope } from '@app/common';
import { RabbitMqConnectionService } from '../rabbitmq.connection.service';
import {
  buildVersionedName,
  getTransactionOutboxExchange,
  normalizeRoutingKey,
} from '../rabbitmq.config';

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
  ) {}

  async publish(event: { eventType: string; payload: unknown }): Promise<void> {
    const version = this.configService.get<string>('RABBITMQ_VERSION');
    const routingKey = this.mapRoutingKey(event.eventType);
    const envelope = this.getEnvelope(event.payload);
    const exchangeBase = getTransactionOutboxExchange();
    const exchange = buildVersionedName(exchangeBase, version);
    if (!exchange) {
      this.logger.warn(
        `Skipping publish for event "${envelope.eventType}" because transaction exchange is not configured`,
      );
      return;
    }

    const channel = this.connectionService.getChannel();
    const content = Buffer.from(JSON.stringify(envelope));

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        exchange,
        routingKey,
        content,
        {
          persistent: true,
          contentType: 'application/json',
          type: envelope.eventType,
          messageId: envelope.eventId,
          correlationId: envelope.eventId,
          timestamp: Date.now(),
          headers: {
            eventId: envelope.eventId,
            eventType: envelope.eventType,
          },
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );
    });
  }

  private mapRoutingKey(eventType: string): string {
    return normalizeRoutingKey(eventType);
  }

  private getEnvelope(payload: unknown): EventEnvelope<unknown> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Outbox payload must be an event envelope object');
    }

    const maybeEnvelope = payload as Partial<EventEnvelope<unknown>>;
    if (
      typeof maybeEnvelope.eventId !== 'string' ||
      typeof maybeEnvelope.eventType !== 'string'
    ) {
      throw new Error(
        'Outbox payload is missing required envelope fields: eventId/eventType',
      );
    }

    return maybeEnvelope as EventEnvelope<unknown>;
  }
}
