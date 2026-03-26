import { Module } from '@nestjs/common';
import { SearchServiceController } from './search-service.controller';
import { SearchServiceService } from './search-service.service';
import { HealthController } from './health/health.controller';
import { TransactionEventsConsumer } from './consumers/transaction-events.consumer';
import { IndexingService } from './indexing/indexing.service';
import { mapTransactionEventToSearchDocument } from './indexing/document.mapper';

@Module({
  imports: [],
  controllers: [SearchServiceController, HealthController],
  providers: [
    SearchServiceService,
    TransactionEventsConsumer,
    IndexingService,
    {
      provide: 'SEARCH_DOCUMENT_MAPPER',
      useValue: mapTransactionEventToSearchDocument,
    },
  ],
})
export class SearchServiceModule {}
