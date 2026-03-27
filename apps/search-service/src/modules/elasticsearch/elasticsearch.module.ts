import { Module } from '@nestjs/common';
import { ElasticsearchBootstrapService } from './elasticsearch.bootstrap.service';
import { elasticsearchClientProvider } from './elasticsearch.client.provider';

@Module({
  providers: [elasticsearchClientProvider, ElasticsearchBootstrapService],
  exports: [elasticsearchClientProvider, ElasticsearchBootstrapService],
})
export class ElasticsearchModule {}
