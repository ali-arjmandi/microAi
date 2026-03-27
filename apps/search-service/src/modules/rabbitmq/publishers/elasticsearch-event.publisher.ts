import { EventEnvelope } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConnectionService } from '../rabbitmq.connection.service';
import {
  buildVersionedName,
  getSearchEventsExchange,
  normalizeRoutingKey,
} from '../rabbitmq.config';

@Injectable()
export class ElasticsearchEventPublisher {
  private readonly logger = new Logger(ElasticsearchEventPublisher.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
  ) {}

  async publish(payload: unknown): Promise<void> {
    const envelope = this.getEnvelope(payload);
    const version = this.configService.get<string>('RABBITMQ_VERSION');
    const exchange = buildVersionedName(getSearchEventsExchange(), version);
    if (!exchange) {
      this.logger.warn(
        `Skipping publish for event "${envelope.eventType}" because search exchange is not configured`,
      );
      return;
    }

    const routingKey = normalizeRoutingKey(envelope.eventType, version);
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

    this.logger.log(
      JSON.stringify({
        msg: 'Published search event',
        exchange,
        routingKey,
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      }),
    );
  }

  private getEnvelope(payload: unknown): EventEnvelope<unknown> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Search event payload must be an event envelope object');
    }

    const maybeEnvelope = payload as Partial<EventEnvelope<unknown>>;
    if (
      typeof maybeEnvelope.eventId !== 'string' ||
      typeof maybeEnvelope.eventType !== 'string'
    ) {
      throw new Error(
        'Search event payload is missing required envelope fields: eventId/eventType',
      );
    }

    return maybeEnvelope as EventEnvelope<unknown>;
  }
}
