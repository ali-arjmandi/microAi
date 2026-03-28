import { Client } from '@elastic/elasticsearch';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchTransactionsQuery, TransactionRecord } from '@app/common';
import { ELASTICSEARCH_CLIENT } from '../elasticsearch/elasticsearch.constants';
import { SEARCH_INDEX_NAME_DEFAULT } from '../elasticsearch/elasticsearch.index.schema';
import { SearchDocument } from '../elasticsearch/search-document.model';
import { searchDocumentToTransactionRecord } from './search-document-to-transaction.mapper';

const TEXT_SEARCH_FIELDS = [
  'title',
  'description',
  'propertyAddress',
  'summary',
  'improvedDescription',
  'riskNarrative',
] as const;

@Injectable()
export class TransactionSearchService {
  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    private readonly configService: ConfigService,
  ) {}

  async search(query: SearchTransactionsQuery): Promise<TransactionRecord[]> {
    const indexName =
      this.configService.get<string>('ELASTICSEARCH_INDEX') ??
      SEARCH_INDEX_NAME_DEFAULT;
    const maxSize = this.configService.get<number>('SEARCH_MAX_RESULTS') ?? 100;
    const trimmed = query.query?.trim() ?? '';

    const response = await this.client.search<SearchDocument>({
      index: indexName,
      size: maxSize,
      query: trimmed
        ? {
            multi_match: {
              query: trimmed,
              fields: [...TEXT_SEARCH_FIELDS],
              type: 'best_fields',
              operator: 'or',
            },
          }
        : { match_all: {} },
      sort: [{ createdAt: { order: 'desc' } }],
    });

    const hits = response.hits?.hits ?? [];
    return hits
      .map((h) => h._source)
      .filter((src): src is SearchDocument => Boolean(src?.transactionId))
      .map((src) => searchDocumentToTransactionRecord(src));
  }
}
