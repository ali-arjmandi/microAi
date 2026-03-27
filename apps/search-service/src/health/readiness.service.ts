import { Inject, Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_CLIENT } from '../modules/elasticsearch/elasticsearch.constants';
import { RabbitMqConnectionService } from '../modules/rabbitmq/rabbitmq.connection.service';

export interface ReadinessDependencyStatus {
  status: 'up' | 'down';
  message?: string;
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  dependencies: {
    rabbitmq: ReadinessDependencyStatus;
    elasticsearch: ReadinessDependencyStatus;
  };
}

@Injectable()
export class ReadinessService {
  constructor(
    private readonly rabbitMqConnectionService: RabbitMqConnectionService,
    @Inject(ELASTICSEARCH_CLIENT) private readonly elasticsearchClient: Client,
  ) {}

  async check(): Promise<ReadinessStatus> {
    const [rabbitmq, elasticsearch] = await Promise.all([
      this.checkRabbitMq(),
      this.checkElasticsearch(),
    ]);

    const isReady = rabbitmq.status === 'up' && elasticsearch.status === 'up';

    return {
      status: isReady ? 'ready' : 'not_ready',
      dependencies: {
        rabbitmq,
        elasticsearch,
      },
    };
  }

  private async checkRabbitMq(): Promise<ReadinessDependencyStatus> {
    try {
      await this.rabbitMqConnectionService.connect();
      this.rabbitMqConnectionService.getChannel();
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkElasticsearch(): Promise<ReadinessDependencyStatus> {
    try {
      await this.elasticsearchClient.ping();
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
