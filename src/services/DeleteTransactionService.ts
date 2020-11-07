import { getCustomRepository } from 'typeorm';
import { validate } from 'uuid';
import AppError from '../errors/AppError';
import TransactionsRepository from '../repositories/TransactionsRepository';

class DeleteTransactionService {
  public async execute(id: string): Promise<void> {
    if (!validate(id)) {
      throw new AppError('Invalid ID.');
    }
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const foundTransaction = await transactionsRepository.findOne(id);
    if (!foundTransaction) {
      throw new AppError('No such ID.', 404);
    }
    await transactionsRepository.remove(foundTransaction);
  }
}

export default DeleteTransactionService;
