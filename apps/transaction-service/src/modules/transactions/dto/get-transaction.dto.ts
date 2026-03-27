import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TransactionRecord, TransactionState } from '@app/common';

export class GetTransactionDto implements TransactionRecord {
  @IsString()
  @MinLength(1)
  transactionId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  propertyAddress: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  buyerId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  sellerId: string;

  @IsEnum(TransactionState)
  state: TransactionState;
}
