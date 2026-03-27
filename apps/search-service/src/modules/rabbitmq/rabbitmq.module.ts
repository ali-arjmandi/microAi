import { Module } from '@nestjs/common';
import { RabbitMqConnectionService } from './rabbitmq.connection.service';
import { RabbitMqStartupService } from './rabbitmq.startup.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { ElasticsearchEventPublisher } from './publishers/elasticsearch-event.publisher';
import { ElasticsearchConsumer } from './consumers/elasticsearch.consumer';

@Module({
  imports: [ElasticsearchModule],
  providers: [
    RabbitMqConnectionService,
    RabbitMqStartupService,
    ElasticsearchConsumer,
    ElasticsearchEventPublisher,
  ],
  exports: [RabbitMqConnectionService, RabbitMqStartupService],
})
export class RabbitMqModule {}
