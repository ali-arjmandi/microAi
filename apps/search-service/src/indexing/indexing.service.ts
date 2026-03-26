import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  upsertDocument(document: unknown): void {
    this.logger.debug(`Upserting search document: ${JSON.stringify(document)}`);
  }

  deleteDocument(id: string): void {
    this.logger.debug(`Deleting search document id=${id}`);
  }
}
