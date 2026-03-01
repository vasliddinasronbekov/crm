/**
 * Payments API Service - Real money payment system
 * Students pay for courses, groups, and fees using real money
 * This is separate from the coins system
 */

import { apiClient } from './client';

// ============================================================================
// ENDPOINTS
// ============================================================================

const PAYMENTS_ENDPOINTS = {
  // Balance
  BALANCE: '/api/v1/student-profile/accounting/student-balances/',
  BALANCE_SUMMARY: '/api/v1/student-profile/accounting/student-balances/summary/',
  ACCOUNT_TRANSACTIONS: '/api/v1/student-profile/accounting/transactions/',

  // Payments
  PAYMENTS_LIST: '/api/v1/student-profile/payment/',
  PAYMENT_DETAIL: (id: number) => `/api/v1/student-profile/payment/${id}/`,
  PAYMENT_CREATE: '/api/v1/student-profile/payment/create/',
  PAYMENT_RECEIPT: (id: number) => `/api/v1/student-profile/payment/${id}/receipt/`,
  PAYMENT_TYPES: '/api/v1/student-profile/payment-types/',
};

// ============================================================================
// TYPES
// ============================================================================

export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type TransactionType = 'payment' | 'fine' | 'adjustment';

// Student Balance (Course fees, payments, fines)
export interface StudentBalance {
  id: number;
  student: {
    id: number;
    username: string;
    full_name: string;
  };
  group: {
    id: number;
    name: string;
    course: {
      name: string;
    };
    branch?: {
      name: string;
    };
  };
  total_fee: number; // In tiyin (divide by 100 for sum)
  paid_amount: number; // In tiyin
  fine_amount: number; // In tiyin
  balance: number; // Remaining balance (tiyin) - positive = debt, negative = overpaid
  is_fully_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentBalanceResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: StudentBalance[];
}

export interface BalanceSummary {
  total_students: number;
  total_balances: number;
  fully_paid_count: number;
  with_debt_count: number;
  total_debt: number; // In tiyin
  total_debt_sum: number; // In sum
  total_overpayment: number; // In tiyin
  total_overpayment_sum: number; // In sum
  total_fees: number; // In tiyin
  total_fees_sum: number; // In sum
  total_paid: number; // In tiyin
  total_paid_sum: number; // In sum
  total_fines: number; // In tiyin
  total_fines_sum: number; // In sum
}

// Payment
export interface Payment {
  id: number;
  by_user: {
    id: number;
    username: string;
    full_name: string;
  };
  group: {
    id: number;
    name: string;
    branch?: {
      name: string;
    };
  };
  payment_type: {
    id: number;
    name: string;
  };
  amount: number; // In tiyin
  date: string; // YYYY-MM-DD
  status: PaymentStatus;
  created_at: string;
}

export interface PaymentsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Payment[];
}

export interface CreatePaymentRequest {
  group: number;
  payment_type: number;
  amount: number; // In tiyin
}

// Payment Type
export interface PaymentType {
  id: number;
  name: string; // "Naqd pul", "Payme", "Click", etc.
}

export interface PaymentTypesResponse {
  count: number;
  results: PaymentType[];
}

// Account Transaction
export interface AccountTransaction {
  id: number;
  student_balance: number;
  transaction_type: TransactionType;
  amount: number; // In tiyin
  description: string;
  created_at: string;
  created_by: {
    username: string;
    full_name: string;
  };
}

export interface AccountTransactionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AccountTransaction[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert tiyin to sum (divide by 100)
 */
export const tiyinToSum = (tiyin: number): number => {
  return tiyin / 100;
};

/**
 * Convert sum to tiyin (multiply by 100)
 */
export const sumToTiyin = (sum: number): number => {
  return Math.round(sum * 100);
};

/**
 * Format amount with currency
 */
export const formatAmount = (tiyin: number, currency = 'UZS'): string => {
  const sum = tiyinToSum(tiyin);
  return `${sum.toLocaleString()} ${currency}`;
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

export const paymentsApi = {
  // ===== BALANCE =====

  /**
   * Get student's balance information
   * @param studentId - Optional student ID filter
   * @param groupId - Optional group ID filter
   * @param status - Optional status filter: 'fully_paid', 'has_debt', 'overpaid'
   */
  getBalance: async (params?: {
    student?: number;
    group?: number;
    status?: 'fully_paid' | 'has_debt' | 'overpaid';
  }): Promise<StudentBalanceResponse> => {
    const response = await apiClient.get<StudentBalanceResponse>(
      PAYMENTS_ENDPOINTS.BALANCE,
      { params }
    );
    return response;
  },

  /**
   * Get balance summary statistics
   */
  getBalanceSummary: async (): Promise<BalanceSummary> => {
    const response = await apiClient.get<BalanceSummary>(
      PAYMENTS_ENDPOINTS.BALANCE_SUMMARY
    );
    return response;
  },

  /**
   * Get account transactions (payments, fines, adjustments)
   */
  getAccountTransactions: async (): Promise<AccountTransactionsResponse> => {
    const response = await apiClient.get<AccountTransactionsResponse>(
      PAYMENTS_ENDPOINTS.ACCOUNT_TRANSACTIONS
    );
    return response;
  },

  // ===== PAYMENTS =====

  /**
   * Get payment history
   * @param date - Optional date filter (YYYY-MM-DD)
   */
  getPayments: async (date?: string): Promise<PaymentsResponse> => {
    const params = date ? { date } : {};
    const response = await apiClient.get<PaymentsResponse>(
      PAYMENTS_ENDPOINTS.PAYMENTS_LIST,
      { params }
    );
    return response;
  },

  /**
   * Get a single payment by ID
   */
  getPayment: async (id: number): Promise<Payment> => {
    const response = await apiClient.get<Payment>(
      PAYMENTS_ENDPOINTS.PAYMENT_DETAIL(id)
    );
    return response;
  },

  /**
   * Create a new payment
   */
  createPayment: async (data: CreatePaymentRequest): Promise<any> => {
    const response = await apiClient.post(PAYMENTS_ENDPOINTS.PAYMENT_CREATE, data);
    return response;
  },

  /**
   * Get payment receipt
   */
  getPaymentReceipt: async (paymentId: number): Promise<any> => {
    const response = await apiClient.get(
      PAYMENTS_ENDPOINTS.PAYMENT_RECEIPT(paymentId)
    );
    return response;
  },

  /**
   * Get available payment types/methods
   */
  getPaymentTypes: async (): Promise<PaymentTypesResponse> => {
    const response = await apiClient.get<PaymentTypesResponse>(
      PAYMENTS_ENDPOINTS.PAYMENT_TYPES
    );
    return response;
  },

  // ===== HELPER FUNCTIONS =====

  /**
   * Calculate total debt from balances
   */
  getTotalDebt: (balances: StudentBalance[]): number => {
    return balances.reduce((total, b) => (b.balance > 0 ? total + b.balance : total), 0);
  },

  /**
   * Calculate total paid from payments
   */
  getTotalPaid: (payments: Payment[]): number => {
    return payments
      .filter((p) => p.status === 'paid')
      .reduce((total, p) => total + p.amount, 0);
  },

  /**
   * Get pending payments
   */
  getPendingPayments: (payments: Payment[]): Payment[] => {
    return payments.filter((p) => p.status === 'pending');
  },

  /**
   * Get successful payments
   */
  getSuccessfulPayments: (payments: Payment[]): Payment[] => {
    return payments.filter((p) => p.status === 'paid');
  },

  /**
   * Get failed payments
   */
  getFailedPayments: (payments: Payment[]): Payment[] => {
    return payments.filter((p) => p.status === 'failed');
  },

  /**
   * Check if student has debt
   */
  hasDebt: (balance: StudentBalance): boolean => {
    return !balance.is_fully_paid && balance.balance > 0;
  },

  /**
   * Check if student has overpaid
   */
  hasOverpaid: (balance: StudentBalance): boolean => {
    return balance.balance < 0;
  },

  /**
   * Get payment status color for UI
   */
  getPaymentStatusColor: (status: PaymentStatus): string => {
    switch (status) {
      case 'paid':
        return '#10b981'; // green
      case 'pending':
        return '#f59e0b'; // yellow
      case 'failed':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  },

  /**
   * Get payment status label
   */
  getPaymentStatusLabel: (status: PaymentStatus): string => {
    switch (status) {
      case 'paid':
        return "To'langan";
      case 'pending':
        return 'Kutilmoqda';
      case 'failed':
        return 'Xatolik';
      default:
        return status;
    }
  },

  /**
   * Get transaction type label
   */
  getTransactionTypeLabel: (type: TransactionType): string => {
    switch (type) {
      case 'payment':
        return "To'lov";
      case 'fine':
        return 'Jarima';
      case 'adjustment':
        return 'Tuzatish';
      default:
        return type;
    }
  },
};
