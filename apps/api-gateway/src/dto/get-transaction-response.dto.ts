import { ApiProperty } from '@nestjs/swagger';
import { TransactionState } from '@app/common';

export class GetTransactionResponseDto {
  @ApiProperty({ example: 'tx-1709250000000' })
  transactionId: string;

  @ApiProperty({ example: 'Condo Sale - Downtown' })
  title: string;

  @ApiProperty({ example: '123 Main St, Austin, TX' })
  propertyAddress: string;

  @ApiProperty({ example: 450000 })
  price: number;

  @ApiProperty({ example: 'user-buyer-001' })
  buyerId: string;

  @ApiProperty({ example: 'user-seller-001' })
  sellerId: string;

  @ApiProperty({ enum: TransactionState, example: TransactionState.INITIATED })
  state: TransactionState;
}
