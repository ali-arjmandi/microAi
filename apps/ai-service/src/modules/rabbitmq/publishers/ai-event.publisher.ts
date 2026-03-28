import { AiEnrichedEvent, AiRejectedEventV1, EventEnvelope } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqConnectionService } from '../rabbitmq.connection.service';
import {
  buildVersionedName,
  getAiEventsExchange,
  normalizeRoutingKey,
} from '../rabbitmq.config';

@Injectable()
export class AiEventPublisher {
  private readonly logger = new Logger(AiEventPublisher.name);

  constructor(
    private readonly connectionService: RabbitMqConnectionService,
    private readonly configService: ConfigService,
  ) {}

  async publishEnriched(
    envelope: EventEnvelope<AiEnrichedEvent>,
  ): Promise<void> {
    await this.publish(envelope);
  }

  async publishRejected(
    envelope: EventEnvelope<AiRejectedEventV1>,
  ): Promise<void> {
    await this.publish(envelope);
  }

  private async publish(envelope: EventEnvelope<unknown>): Promise<void> {
    const version = this.configService.get<string>('RABBITMQ_VERSION');
    const exchange = buildVersionedName(getAiEventsExchange(), version);
    if (!exchange) {
      this.logger.warn(
        `Skipping publish for event "${envelope.eventType}" because ai exchange is not configured`,
      );
      return;
    }

    const routingKey = normalizeRoutingKey(envelope.eventType);
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
        msg: 'Published ai event',
        exchange,
        routingKey,
        eventId: envelope.eventId,
        eventType: envelope.eventType,
      }),
    );
  }
}
