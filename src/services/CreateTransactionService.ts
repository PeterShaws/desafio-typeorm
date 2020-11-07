import { getCustomRepository, getRepository, Repository } from 'typeorm';
import AppError from '../errors/AppError';
import Category from '../models/Category';

import Transaction from '../models/Transaction';
import TransactionsRepository, {
  Balance,
} from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  private transactionsRepository: TransactionsRepository;

  private categoriesRepository: Repository<Category>;

  constructor() {
    this.transactionsRepository = getCustomRepository(TransactionsRepository);
    this.categoriesRepository = getRepository(Category);
  }

  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const validationError = await this.validateRequest({
      title,
      value,
      type,
      category,
    });
    if (!validationError) {
      const transactionCategory = await this.getCategory({ category });
      const transaction = this.transactionsRepository.create({
        title,
        value,
        type,
        category_id: transactionCategory.id,
      });
      await this.transactionsRepository.save(transaction);
      transaction.category = transactionCategory;
      return transaction;
    }
    throw validationError;
  }

  private async validateRequest({
    title,
    value,
    type,
    category,
  }: Request): Promise<AppError | null> {
    let balance: Balance;
    switch (true) {
      case !this.assertAttributes({ title, value, type, category }):
        return new AppError('Insufficient information.');
      case !title:
        return new AppError('Invalid title.');
      case !category:
        return new AppError('Invalid category.');
      case !['income', 'outcome'].includes(type):
        return new AppError('Invalid transaction type');
      case Number.isNaN(+value) || +value <= 0:
        return new AppError('Invalid value');
      case type === 'outcome':
        balance = await this.transactionsRepository.getBalance();
        if (value > balance.total) {
          return new AppError('Excessive outcome', 409);
        }
        break;
      default:
    }
    return null;
  }

  private assertAttributes(request: Request): boolean {
    let allPresent = true;
    const attributes = Object.keys(request) as (keyof Request)[];
    for (let i = 0; i < attributes.length; i += 1) {
      if (
        request[attributes[i]] === undefined ||
        request[attributes[i]] === null
      ) {
        allPresent = false;
        break;
      }
    }
    return allPresent;
  }

  private async getCategory({
    category: title,
  }: Pick<Request, 'category'>): Promise<Category> {
    const foundCategory = await this.categoriesRepository.findOne({
      where: { title },
    });
    if (foundCategory) {
      return foundCategory;
    }
    const category = this.categoriesRepository.create({ title });
    await this.categoriesRepository.save(category);
    return category;
  }
}

export default CreateTransactionService;
