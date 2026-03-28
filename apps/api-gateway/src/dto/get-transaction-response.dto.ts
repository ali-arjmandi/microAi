import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AiProcessingStatus,
  ModerationStatus,
  SearchIndexStatus,
  TransactionState,
} from '@app/common';

export class GetTransactionResponseDto {
  @ApiProperty({ example: 'tx-1709250000000' })
  transactionId: string;

  @ApiProperty({ example: 'Condo Sale - Downtown' })
  title: string;

  @ApiProperty({ example: 'Bright 2-bedroom condo near downtown amenities.' })
  description: string;

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

  @ApiProperty({
    enum: AiProcessingStatus,
    example: AiProcessingStatus.PENDING,
  })
  aiStatus: AiProcessingStatus;

  @ApiProperty({ enum: SearchIndexStatus, example: SearchIndexStatus.PENDING })
  searchStatus: SearchIndexStatus;

  @ApiProperty({
    enum: ModerationStatus,
    example: ModerationStatus.PENDING,
  })
  moderationStatus: ModerationStatus;

  @ApiPropertyOptional({
    description: 'AI listing summary (after enrichment)',
    example: 'Sunny 2-bedroom condo near transit',
  })
  summary?: string;

  @ApiPropertyOptional({
    description: 'AI-rewritten listing description',
  })
  improvedDescription?: string;

  @ApiPropertyOptional({
    description: 'Buyer/deal risk narrative from AI (property context)',
  })
  riskNarrative?: string;

  @ApiPropertyOptional({
    description: 'Buyer/deal risk score 0–100 from AI',
    example: 35,
  })
  riskScore?: number;

  @ApiPropertyOptional({
    description: 'Moderation reason code from AI pipeline',
    example: 'approved',
  })
  moderationReason?: string;

  @ApiPropertyOptional({
    description: 'AI moderation confidence 0–1',
    example: 0.92,
  })
  moderationConfidence?: number;

  @ApiPropertyOptional({
    description: 'Lowercase search tags from AI enrichment',
    type: [String],
    example: ['austin', 'condo', 'downtown'],
  })
  searchTags?: string[];

  @ApiPropertyOptional({
    description: 'Model identifier used for enrichment',
    example: 'openrouter/free',
  })
  aiModelVersion?: string;

  @ApiPropertyOptional({
    description: 'Prompt/schema version used for enrichment',
    example: 'v1',
  })
  aiPromptVersion?: string;
}
