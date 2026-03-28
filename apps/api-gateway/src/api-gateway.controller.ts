import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  GetTransactionDto as CommonGetTransactionDto,
  SearchTransactionsResponseDto as CommonSearchTransactionsResponseDto,
  TransactionResponseDto as CommonTransactionResponseDto,
} from '@app/common';
import { ApiGatewayService } from './api-gateway.service';
import { CreateTransactionRequestDto } from './dto/create-transaction-request.dto';
import { CreateTransactionResponseDto } from './dto/create-transaction-response.dto';
import { GetTransactionResponseDto } from './dto/get-transaction-response.dto';
import { SearchTransactionsQueryRequestDto } from './dto/search-transactions-query-request.dto';
import { SearchTransactionsResponseDto } from './dto/search-transactions-response.dto';

@ApiTags('transactions')
@Controller('transactions')
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiCreatedResponse({ type: CreateTransactionResponseDto })
  createTransaction(
    @Body() payload: CreateTransactionRequestDto,
  ): Promise<CreateTransactionResponseDto> {
    return this.apiGatewayService
      .createTransaction(payload)
      .then((data) => this.toCreateTransactionResponse(data));
  }

  @Get('search/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search transactions by title or address' })
  @ApiOkResponse({ type: SearchTransactionsResponseDto })
  searchTransactions(
    @Query() query: SearchTransactionsQueryRequestDto,
  ): Promise<SearchTransactionsResponseDto> {
    return this.apiGatewayService
      .searchTransactions(query)
      .then((data) => this.toSearchTransactionsResponse(data));
  }

  @Get(':transactionId')
  @ApiOperation({ summary: 'Get a transaction by id' })
  @ApiOkResponse({ type: GetTransactionResponseDto })
  getTransaction(
    @Param('transactionId') transactionId: string,
  ): Promise<GetTransactionResponseDto> {
    return this.apiGatewayService
      .getTransaction(transactionId)
      .then((data) => this.toGetTransactionResponse(data));
  }

  private toCreateTransactionResponse(
    data: CommonTransactionResponseDto,
  ): CreateTransactionResponseDto {
    return {
      transactionId: data.transactionId,
      state: data.state,
    };
  }

  private toGetTransactionResponse(
    data: CommonGetTransactionDto,
  ): GetTransactionResponseDto {
    return {
      transactionId: data.transactionId,
      title: data.title,
      description: data.description,
      propertyAddress: data.propertyAddress,
      price: data.price,
      buyerId: data.buyerId,
      sellerId: data.sellerId,
      state: data.state,
      aiStatus: data.aiStatus,
      searchStatus: data.searchStatus,
      moderationStatus: data.moderationStatus,
    };
  }

  private toSearchTransactionsResponse(
    data: CommonSearchTransactionsResponseDto,
  ): SearchTransactionsResponseDto {
    const rows = this.extractSearchTransactionRows(data as unknown);
    return {
      items: rows.map((item) => this.toGetTransactionResponse(item)),
    };
  }

  private extractSearchTransactionRows(
    payload: unknown,
  ): CommonGetTransactionDto[] {
    if (Array.isArray(payload)) {
      return payload as CommonGetTransactionDto[];
    }
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const list = record.items ?? record.itemsList;
      if (Array.isArray(list)) {
        return list as CommonGetTransactionDto[];
      }
    }
    return [];
  }
}
