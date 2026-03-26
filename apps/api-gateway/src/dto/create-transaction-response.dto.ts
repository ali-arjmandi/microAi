import { ApiProperty } from '@nestjs/swagger';
import { TransactionState } from '@app/common';

export class CreateTransactionResponseDto {
  @ApiProperty({ example: 'tx-1709250000000' })
  transactionId: string;

  @ApiProperty({ enum: TransactionState, example: TransactionState.INITIATED })
  state: TransactionState;
}
