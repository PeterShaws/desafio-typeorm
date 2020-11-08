import csvParse from 'csv-parse';
import fs from 'fs';
import { Any, getRepository, Repository } from 'typeorm';
import AppError from '../errors/AppError';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import CreateTransactionService from './CreateTransactionService';

interface TransactionData {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  private categoriesRepository: Repository<Category>;

  private createTransactionService: CreateTransactionService;

  constructor() {
    this.categoriesRepository = getRepository(Category);
    this.createTransactionService = new CreateTransactionService();
  }

  async execute(file: Express.Multer.File): Promise<Transaction[]> {
    if (file) {
      if (file.mimetype !== 'text/csv') {
        await fs.promises.unlink(file.path);
        throw new AppError('Invalid file type.');
      }

      const data = await this.loadCSV(file.path);
      await this.saveCategories(data);
      const transactions = await this.saveTransactions(data);
      await fs.promises.unlink(file.path);

      return transactions;
    }
    throw new AppError('Missing file.');
  }

  private async saveCategories(data: TransactionData[]): Promise<void> {
    // deduplicate category titles
    const titles = data
      .map(row => row.category)
      .sort()
      .filter((e, i, a) => !i || e !== a[i - 1]);

    // look up the titles in the repository...
    const foundCategories = await this.categoriesRepository.find({
      title: Any(titles),
    });
    // ...then filter out those that already exist
    const newTitles = titles.filter(
      title =>
        !foundCategories.some(foundCategory => foundCategory.title === title),
    );

    // create the new categories...
    const newCategories$ = newTitles.map(title => {
      const newCategory = this.categoriesRepository.create({ title });
      return this.categoriesRepository.save(newCategory);
    });
    // ...then save them in parallel
    await Promise.all(newCategories$);
  }

  private async saveTransactions(
    data: TransactionData[],
  ): Promise<Transaction[]> {
    try {
      const transactions$: Promise<Transaction>[] = [];
      data.forEach(row => {
        const transaction$ = this.createTransactionService.execute(row, true);
        transactions$.push(transaction$);
      });
      return await Promise.all(transactions$);
    } catch (err) {
      throw new AppError('Can’t load CSV file', 500);
    }
  }

  private async loadCSV(csvFilePath: string): Promise<TransactionData[]> {
    const readCSVStream = fs.createReadStream(csvFilePath);
    const parseStream = csvParse({ fromLine: 2, ltrim: true, rtrim: true });
    const parseCSV = readCSVStream.pipe(parseStream);

    const data: TransactionData[] = [];
    parseCSV.on('data', (row: string[]) => {
      const [title, type, value, category] = row;
      return data.push({
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
