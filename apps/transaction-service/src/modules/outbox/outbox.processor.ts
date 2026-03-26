import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxRepository } from './outbox.repository';

@Injectable()
export class OutboxProcessor
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxProcessor.name);
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private intervalRef?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly configService: ConfigService,
  ) {
    this.pollIntervalMs = this.getNumericConfig(
      'OUTBOX_POLL_INTERVAL_MS',
      2000,
    );
    this.batchSize = this.getNumericConfig('OUTBOX_BATCH_SIZE', 100);
  }

  onApplicationBootstrap(): void {
    this.logger.log(
      `Starting outbox processor (interval=${this.pollIntervalMs}ms, batchSize=${this.batchSize})`,
    );

    this.intervalRef = setInterval(() => {
      void this.processPendingBatch();
    }, this.pollIntervalMs);
    this.intervalRef.unref();

    void this.processPendingBatch();
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = undefined;
    }
  }

  private async processPendingBatch(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const events = await this.outboxRepository.listPending(this.batchSize);
      if (!events.length) {
        return;
      }

      for (const event of events) {
        try {
          await this.outboxPublisher.publish({
            eventType: event.eventType,
            payload: event.payload,
          });
          await this.outboxRepository.markPublished(event.id);
        } catch (error) {
          await this.outboxRepository.markFailed(event.id);
          this.logger.warn(
            `Outbox publish failed for event ${event.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Outbox batch processing failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private getNumericConfig(key: string, fallback: number): number {
    const rawValue = this.configService.get<string | number | undefined>(key);
    const value =
      typeof rawValue === 'number'
        ? rawValue
        : Number.parseInt(rawValue ?? '', 10);

    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
