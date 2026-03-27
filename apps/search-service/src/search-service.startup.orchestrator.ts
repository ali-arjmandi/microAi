import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ElasticsearchBootstrapService } from './modules/elasticsearch/elasticsearch.bootstrap.service';
import { RabbitMqStartupService } from './modules/rabbitmq/rabbitmq.startup.service';

@Injectable()
export class SearchServiceStartupOrchestrator
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(SearchServiceStartupOrchestrator.name);

  constructor(
    private readonly elasticsearchBootstrapService: ElasticsearchBootstrapService,
    private readonly rabbitMqStartupService: RabbitMqStartupService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.elasticsearchBootstrapService.initialize();
    this.logger.log('Elasticsearch startup is ready');
    await this.rabbitMqStartupService.initialize();
    this.logger.log('RabbitMQ startup is ready');
  }
}
