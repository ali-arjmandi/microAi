import { Type } from 'class-transformer';
import {
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CreateTransactionPayload } from '@app/common';

export class CreateTransactionDto implements CreateTransactionPayload {
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

  @Type(() => Number)
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
}
