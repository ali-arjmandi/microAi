import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReadinessService, ReadinessStatus } from './readiness.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly readinessService: ReadinessService) {}

  @Get()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readiness')
  async getReadiness(): Promise<ReadinessStatus> {
    const readiness = await this.readinessService.check();
    if (readiness.status !== 'ready') {
      this.logger.warn(
        JSON.stringify({
          msg: 'Readiness check failed',
          status: readiness.status,
          dependencies: readiness.dependencies,
        }),
      );
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }
}
