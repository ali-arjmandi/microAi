import { Client } from '@elastic/elasticsearch';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ELASTICSEARCH_CLIENT } from './elasticsearch.constants';
import { SEARCH_INDEX_NAME_DEFAULT } from './elasticsearch.index.schema';
import { DocumentMapper } from './document.mapper';
import { SearchDocument, SearchDocumentPatch } from './search-document.model';

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    private readonly configService: ConfigService,
  ) {}

  async upsertDocument(patch: SearchDocumentPatch): Promise<void> {
    const indexName = this.getIndexName();
    const { id, doc } = DocumentMapper.toUpsert(patch);

    await this.client.update({
      index: indexName,
      id,
      doc,
      doc_as_upsert: true,
      retry_on_conflict: 3,
    });

    this.logger.debug(
      JSON.stringify({
        msg: 'Upserted search document',
        transactionId: id,
        eventId: patch.eventId,
        eventType: patch.eventType,
      }),
    );
  }

  async getDocument(transactionId: string): Promise<SearchDocument | null> {
    const indexName = this.getIndexName();
    const id = transactionId.trim();
    if (!id) {
      throw new Error('transactionId is required to get search document');
    }

    try {
      const response = await this.client.get<SearchDocument>({
        index: indexName,
        id,
      });
      return response._source ?? null;
    } catch (error) {
      if (this.isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async deleteDocument(transactionId: string): Promise<void> {
    const indexName = this.getIndexName();
    const id = transactionId.trim();
    if (!id) {
      throw new Error('transactionId is required to delete search document');
    }

    try {
      await this.client.delete({
        index: indexName,
        id,
      });
      this.logger.debug(
        JSON.stringify({
          msg: 'Deleted search document',
          transactionId: id,
        }),
      );
    } catch (error) {
      if (this.isNotFound(error)) {
        this.logger.debug(
          `Delete skipped because document was not found transactionId="${id}"`,
        );
        return;
      }
      throw error;
    }
  }

  private getIndexName(): string {
    return (
      this.configService.get<string>('ELASTICSEARCH_INDEX') ??
      SEARCH_INDEX_NAME_DEFAULT
    );
  }

  private isNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const maybeError = error as {
      statusCode?: number;
      meta?: { statusCode?: number };
    };
    return maybeError.statusCode === 404 || maybeError.meta?.statusCode === 404;
  }
}
