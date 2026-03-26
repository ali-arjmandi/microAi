import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TransactionEventsConsumer {
  private readonly logger = new Logger(TransactionEventsConsumer.name);

  handleMessage(payload: unknown): void {
    this.logger.debug(
      `Received transaction event payload: ${JSON.stringify(payload)}`,
    );
  }
}
