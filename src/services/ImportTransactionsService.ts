import csvParse from 'csv-parse';
import fs from 'fs';
import { Any, getCustomRepository, getRepository, Repository } from 'typeorm';
import AppError from '../errors/AppError';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface TransactionData {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  private categoriesRepository: Repository<Category>;

  private transactionsRepository: TransactionsRepository;

  constructor() {
    this.categoriesRepository = getRepository(Category);
    this.transactionsRepository = getCustomRepository(TransactionsRepository);
  }

  async execute(file: Express.Multer.File): Promise<Transaction[]> {
    if (file) {
      if (!['text/csv', 'application/vnd.ms-excel'].includes(file.mimetype)) {
        await fs.promises.unlink(file.path);
        throw new AppError('Invalid file type.');
      }

      try {
        const data = await this.loadCSV(file.path);
        const categories = await this.saveCategories(data);
        const transactions = await this.saveTransactions(data, categories);
        await fs.promises.unlink(file.path);
        return transactions;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        } else {
          throw new AppError(error.message, 500);
        }
      }
    }
    throw new AppError('Missing file.');
  }

  private async saveCategories(data: TransactionData[]): Promise<Category[]> {
    try {
      const titles = data
        .map(row => row.category)
        .filter((title, index, _titles) => _titles.indexOf(title) === index);
      const foundCategories = await this.categoriesRepository.find({
        title: Any(titles),
      });
      const newTitles = titles.filter(
        title =>
          !foundCategories.some(foundCategory => foundCategory.title === title),
      );

      const newCategories = this.categoriesRepository.create(
        newTitles.map(title => ({ title })),
      );
      await this.categoriesRepository.save(newCategories);
      return [...foundCategories, ...newCategories];
    } catch (error) {
      throw new AppError(error.message, 500);
    }
  }

  private async saveTransactions(
    data: TransactionData[],
    categories: Category[],
  ): Promise<Transaction[]> {
    try {
      const transactions = this.transactionsRepository.create(
        data.map(transaction => ({
          ...transaction,
          category: categories.find(
            category => category.title === transaction.category,
          ),
        })),
      );
      await this.transactionsRepository.save(transactions);
      return transactions;
    } catch (error) {
      throw new AppError(error.message, 500);
    }
  }

  private async loadCSV(csvFilePath: string): Promise<TransactionData[]> {
    const readCSVStream = fs.createReadStream(csvFilePath);
    const parseStream = csvParse({ fromLine: 2, ltrim: true, rtrim: true });
    const parseCSV = readCSVStream.pipe(parseStream);

    const data: TransactionData[] = [];
    parseCSV.on('data', (row: string[]) => {
      const [title, type, value, category] = row;
      if (!title || !type || !value || !category) {
        return;
      }
      data.push({
        title,
        type: type as 'income' | 'outcome',
        value: +value,
        category,
      });
    });
    await new Promise(resolve => parseCSV.on('end', resolve));
    return data;
  }
}

export default ImportTransactionsService;
