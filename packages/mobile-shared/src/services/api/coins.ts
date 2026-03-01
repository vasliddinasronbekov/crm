/**
 * Coins API Service - Virtual currency system
 * Students earn coins by completing tasks, attending classes, etc.
 * Coins can be spent in the shop to purchase products
 */

import { apiClient } from './client';

// ============================================================================
// ENDPOINTS
// ============================================================================

const COINS_ENDPOINTS = {
  TRANSACTIONS: '/api/v1/student-profile/student-coins/',
  TRANSACTION_DETAIL: (id: number) => `/api/v1/student-profile/student-coins/${id}/`,
};

// ============================================================================
// TYPES
// ============================================================================

export interface CoinTransaction {
  id: number;
  student: number; // User ID
  coin: number; // Positive = earned, Negative = spent
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface CoinTransactionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CoinTransaction[];
}

export interface CreateCoinTransactionRequest {
  student: number;
  coin: number;
  reason: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export const coinsApi = {
  /**
   * Get all coin transactions for the authenticated student
   * @param date - Optional date filter (YYYY-MM-DD)
   */
  getTransactions: async (date?: string): Promise<CoinTransactionsResponse> => {
    const params = date ? { date } : {};
    const response = await apiClient.get<CoinTransactionsResponse>(
      COINS_ENDPOINTS.TRANSACTIONS,
      { params }
    );
    return response;
  },

  /**
   * Get a single coin transaction by ID
   */
  getTransaction: async (id: number): Promise<CoinTransaction> => {
    const response = await apiClient.get<CoinTransaction>(
      COINS_ENDPOINTS.TRANSACTION_DETAIL(id)
    );
    return response;
  },

  /**
   * Calculate total coins from transactions
   * Sum all coin values to get current balance
   */
  calculateTotalCoins: (transactions: CoinTransaction[]): number => {
    return transactions.reduce((total, transaction) => total + transaction.coin, 0);
  },

  /**
   * Get coin balance (fetches transactions and calculates total)
   */
  getBalance: async (): Promise<number> => {
    const response = await coinsApi.getTransactions();
    return coinsApi.calculateTotalCoins(response.results);
  },

  /**
   * Create a new coin transaction (Admin/Teacher only)
   * Students cannot manually create coin transactions
   */
  createTransaction: async (
    data: CreateCoinTransactionRequest
  ): Promise<CoinTransaction> => {
    const response = await apiClient.post<CoinTransaction>(
      COINS_ENDPOINTS.TRANSACTIONS,
      data
    );
    return response;
  },

  /**
   * Update a coin transaction (Admin/Teacher only)
   */
  updateTransaction: async (
    id: number,
    data: Partial<CreateCoinTransactionRequest>
  ): Promise<CoinTransaction> => {
    const response = await apiClient.put<CoinTransaction>(
      COINS_ENDPOINTS.TRANSACTION_DETAIL(id),
      data
    );
    return response;
  },

  /**
   * Delete a coin transaction (Admin/Teacher only)
   */
  deleteTransaction: async (id: number): Promise<void> => {
    await apiClient.delete(COINS_ENDPOINTS.TRANSACTION_DETAIL(id));
  },

  /**
   * Get transactions grouped by type (earned vs spent)
   */
  getGroupedTransactions: (
    transactions: CoinTransaction[]
  ): { earned: CoinTransaction[]; spent: CoinTransaction[] } => {
    return {
      earned: transactions.filter((t) => t.coin > 0),
      spent: transactions.filter((t) => t.coin < 0),
    };
  },

  /**
   * Get transaction statistics
   */
  getStatistics: (transactions: CoinTransaction[]) => {
    const grouped = coinsApi.getGroupedTransactions(transactions);
    const totalEarned = grouped.earned.reduce((sum, t) => sum + t.coin, 0);
    const totalSpent = Math.abs(grouped.spent.reduce((sum, t) => sum + t.coin, 0));

    return {
      total: coinsApi.calculateTotalCoins(transactions),
      totalEarned,
      totalSpent,
      earnedCount: grouped.earned.length,
      spentCount: grouped.spent.length,
    };
  },
};
