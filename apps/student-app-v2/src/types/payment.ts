/**
 * Payment System Type Definitions
 */

// ============================================================================
// PAYMENTS
// ============================================================================

export interface Payment {
  id: number;
  student: number;
  student_name: string;

  // Payment details
  amount: number;
  currency: string;
  payment_type: PaymentType;
  payment_method: PaymentMethodType;
  payment_status: PaymentStatusType;

  // Reference
  reference_number: string;
  invoice_number?: string;
  receipt_number?: string;

  // Purpose
  payment_for: PaymentPurpose;
  description?: string;
  course?: number;
  course_name?: string;
  exam?: number;
  exam_name?: string;

  // Dates
  payment_date: string;
  due_date?: string;
  created_at: string;

  // Additional info
  notes?: string;
  receipt_url?: string;
  processed_by?: number;
  processed_by_name?: string;
}

export type PaymentType = 'tuition' | 'exam_fee' | 'course_fee' | 'book' | 'other';

export type PaymentMethodType =
  | 'cash'
  | 'bank_transfer'
  | 'credit_card'
  | 'debit_card'
  | 'online'
  | 'mobile_payment'
  | 'check';

export type PaymentStatusType = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export type PaymentPurpose =
  | 'tuition'
  | 'course_enrollment'
  | 'exam_registration'
  | 'book_purchase'
  | 'material_fee'
  | 'late_fee'
  | 'other';

export interface PaymentReceipt {
  id: number;
  payment: number;
  receipt_number: string;
  receipt_date: string;
  student_name: string;
  student_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethodType;
  payment_for: string;
  issued_by: string;
  notes?: string;
  receipt_url: string;
  created_at: string;
}

export interface PaymentHistory {
  payments: Payment[];
  total_paid: number;
  total_pending: number;
  total_refunded: number;
  currency: string;
  payment_count: number;
}

export interface PaymentPlan {
  id: number;
  student: number;
  total_amount: number;
  currency: string;
  installments_count: number;
  installments_paid: number;
  installments: Installment[];
  status: 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Installment {
  id: number;
  payment_plan: number;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  payment_id?: number;
}

export interface PaymentReminder {
  id: number;
  student: number;
  amount: number;
  due_date: string;
  payment_type: PaymentType;
  reminder_sent: boolean;
  sent_at?: string;
  status: 'pending' | 'sent' | 'dismissed';
}

// ============================================================================
// INVOICES
// ============================================================================

export interface Invoice {
  id: number;
  invoice_number: string;
  student: number;
  student_name: string;
  student_email: string;

  // Invoice details
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;

  // Line items
  items: InvoiceItem[];
  subtotal: number;
  tax?: number;
  tax_rate?: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
  total: number;
  amount_paid: number;
  amount_due: number;
  currency: string;

  // Payment info
  payment?: number;
  paid_at?: string;

  // Additional
  notes?: string;
  terms?: string;
  invoice_url?: string;

  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type?: string;
}

// ============================================================================
// FINANCIAL ACCOUNT
// ============================================================================

export interface StudentAccount {
  student: number;
  student_name: string;

  // Balances
  balance: number; // Current balance (negative = owes money)
  total_charges: number;
  total_payments: number;
  total_credits: number;

  // Status
  account_status: AccountStatus;
  is_current: boolean; // No overdue payments
  is_on_hold: boolean; // Account frozen due to non-payment

  // Details
  currency: string;
  credit_limit?: number;
  overdue_amount: number;
  next_payment_due?: string;
  next_payment_amount?: number;

  // Transactions
  recent_transactions: AccountTransaction[];

  updated_at: string;
}

export type AccountStatus = 'active' | 'hold' | 'closed' | 'suspended';

export interface AccountTransaction {
  id: number;
  student: number;
  transaction_date: string;
  transaction_type: AccountTransactionType;
  amount: number;
  balance_after: number;
  description: string;
  reference_number?: string;
  created_at: string;
}

export type AccountTransactionType = 'charge' | 'payment' | 'credit' | 'adjustment' | 'refund';

export interface AccountStatement {
  student: number;
  student_name: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_charges: number;
  total_payments: number;
  total_credits: number;
  transactions: AccountTransaction[];
  currency: string;
  generated_at: string;
  statement_url?: string;
}

// ============================================================================
// REFUNDS
// ============================================================================

export interface Refund {
  id: number;
  payment: number;
  payment_reference: string;
  student: number;
  student_name: string;
  amount: number;
  currency: string;
  reason: string;
  refund_method: PaymentMethodType;
  status: RefundStatus;
  requested_at: string;
  processed_at?: string;
  processed_by?: number;
  notes?: string;
}

export type RefundStatus = 'requested' | 'approved' | 'processing' | 'completed' | 'rejected';

// ============================================================================
// PAYMENT STATISTICS
// ============================================================================

export interface PaymentStatistics {
  student: number;

  // Summary
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  current_balance: number;
  currency: string;

  // Counts
  payment_count: number;
  on_time_payments: number;
  late_payments: number;
  pending_invoices: number;
  overdue_invoices: number;

  // Trends
  payments_this_month: number;
  payments_this_year: number;
  average_payment_amount: number;

  // Payment history
  payment_history_months: MonthlyPayment[];
  recent_payments: Payment[];
}

export interface MonthlyPayment {
  month: string; // YYYY-MM
  amount: number;
  payment_count: number;
}
