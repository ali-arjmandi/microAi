import { Module } from '@nestjs/common';
import { ElasticsearchBootstrapService } from './elasticsearch.bootstrap.service';
import { elasticsearchClientProvider } from './elasticsearch.client.provider';
import { IndexingService } from './elasticsearch.indexing.service';

@Module({
  providers: [
    elasticsearchClientProvider,
    ElasticsearchBootstrapService,
    IndexingService,
  ],
  exports: [
    elasticsearchClientProvider,
    ElasticsearchBootstrapService,
    IndexingService,
  ],
})
export class ElasticsearchModule {}
