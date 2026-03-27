import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, ConfirmChannel, connect as amqpConnect } from 'amqplib';

@Injectable()
export class RabbitMqConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;

  constructor(private readonly configService: ConfigService) {}

  async connect(): Promise<void> {
    if (this.connection && this.channel) {
      return;
    }

    const url = this.configService.get<string>('RABBITMQ_URL');
    if (!url) {
      throw new Error('RABBITMQ_URL is not configured');
    }

    this.connection = await amqpConnect(url);
    this.channel = await this.connection.createConfirmChannel();
    this.logger.log(
      JSON.stringify({
        msg: 'RabbitMQ connection established',
      }),
    );
  }

  getChannel(): ConfirmChannel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    return this.channel;
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log(
      JSON.stringify({
        msg: 'RabbitMQ connection closed',
      }),
    );
  }
}
