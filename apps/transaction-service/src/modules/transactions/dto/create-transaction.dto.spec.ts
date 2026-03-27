import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

describe('CreateTransactionDto', () => {
  it('fails validation when description is missing', () => {
    const dto = plainToInstance(CreateTransactionDto, {
      title: 'Condo',
      propertyAddress: '123 Main St',
      price: 200000,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    });

    const errors = validateSync(dto);
    const descriptionError = errors.find(
      (error) => error.property === 'description',
    );

    expect(descriptionError).toBeDefined();
  });
});
