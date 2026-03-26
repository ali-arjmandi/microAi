import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { SearchTransactionsQuery } from '@app/common';

export class SearchTransactionsQueryRequestDto implements SearchTransactionsQuery {
  @ApiPropertyOptional({ description: 'Search on title or address' })
  @IsOptional()
  @IsString()
  query?: string;
}
