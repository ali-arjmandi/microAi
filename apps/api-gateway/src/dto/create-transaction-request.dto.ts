import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';
import { CreateTransactionPayload } from '@app/common';

export class CreateTransactionRequestDto implements CreateTransactionPayload {
  @ApiProperty({ example: 'Condo Sale - Downtown' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'Bright 2-bedroom condo near downtown amenities.' })
  @IsString()
  @MinLength(3)
  description: string;

  @ApiProperty({ example: '123 Main St, Austin, TX' })
  @IsString()
  @MinLength(5)
  propertyAddress: string;

  @ApiProperty({ example: 450000 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: 'user-buyer-001' })
  @IsString()
  @MinLength(3)
  buyerId: string;

  @ApiProperty({ example: 'user-seller-001' })
  @IsString()
  @MinLength(3)
  sellerId: string;
}
