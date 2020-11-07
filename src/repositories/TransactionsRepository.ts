import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

type TransactionType = 'income' | 'outcome';

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find();
    const income = this.getTotalForType(transactions, 'income');
    const outcome = this.getTotalForType(transactions, 'outcome');
    const total = income - outcome;
    return { income, outcome, total };
  }

  private getTotalForType(
    transactions: Transaction[],
    type: TransactionType,
  ): number {
    return transactions
      .filter(transaction => transaction.type === type)
      .map(transaction => transaction.value)
      .reduce((total, value) => total + value, 0);
  }
}

export default TransactionsRepository;
