import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  GetTransactionDto,
  SearchTransactionsResponseDto,
  TransactionResponseDto,
} from '@app/common';
import { ApiGatewayService } from './api-gateway.service';
import { CreateTransactionRequestDto } from './dto/create-transaction-request.dto';
import { SearchTransactionsQueryRequestDto } from './dto/search-transactions-query-request.dto';

@ApiTags('transactions')
@Controller('transactions')
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  createTransaction(@Body() payload: CreateTransactionRequestDto): Promise<TransactionResponseDto> {
    return this.apiGatewayService.createTransaction(payload);
  }

  @Get('search/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search transactions by title or address' })
  @ApiOkResponse({ type: SearchTransactionsResponseDto })
  searchTransactions(
    @Query() query: SearchTransactionsQueryRequestDto,
  ): Promise<SearchTransactionsResponseDto> {
    return this.apiGatewayService.searchTransactions(query);
  }

  @Get(':transactionId')
  @ApiOperation({ summary: 'Get a transaction by id' })
  @ApiOkResponse({ type: GetTransactionDto })
  getTransaction(@Param('transactionId') transactionId: string): Promise<GetTransactionDto> {
    return this.apiGatewayService.getTransaction(transactionId);
  }
}
