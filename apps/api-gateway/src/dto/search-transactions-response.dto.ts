import { ApiProperty } from '@nestjs/swagger';
import { GetTransactionResponseDto } from './get-transaction-response.dto';

export class SearchTransactionsResponseDto {
  @ApiProperty({ type: [GetTransactionResponseDto] })
  items: GetTransactionResponseDto[];
}
