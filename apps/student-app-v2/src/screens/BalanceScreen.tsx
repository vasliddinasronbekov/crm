// apps/student-app-v2/src/screens/BalanceScreen.tsx
/**
 * Balance Screen - Real money payment system
 * Updated 2025-11-30: Using payments API
 *
 * Features:
 * - Display student's real money balance (course fees, payments, fines)
 * - View payment history
 * - Payment status tracking
 * - Account transactions
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@eduvoice/mobile-ui';
import {
  paymentsApi,
  type StudentBalance,
  type Payment,
  type AccountTransaction,
  formatAmount,
  tiyinToSum,
} from '@eduvoice/mobile-shared';

type TabType = 'balance' | 'payments' | 'transactions';

export const BalanceScreen = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('balance');

  // ===== FETCH STUDENT BALANCE =====
  const {
    data: balanceData,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['student-balance'],
    queryFn: () => paymentsApi.getBalance(),
    retry: 2,
  });

  // ===== FETCH PAYMENT HISTORY =====
  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ['payment-history'],
    queryFn: () => paymentsApi.getPayments(),
    retry: 2,
    enabled: activeTab === 'payments',
  });

  // ===== FETCH ACCOUNT TRANSACTIONS =====
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ['account-transactions'],
    queryFn: () => paymentsApi.getAccountTransactions(),
    retry: 2,
    enabled: activeTab === 'transactions',
  });

  // ===== HANDLE REFRESH =====
  const handleRefresh = () => {
    refetchBalance();
    if (activeTab === 'payments') {
      refetchPayments();
    } else if (activeTab === 'transactions') {
      refetchTransactions();
    }
  };

  const balance = balanceData?.results?.[0];
  const payments = paymentsData?.results || [];
  const transactions = transactionsData?.results || [];

  const isRefreshing =
    balanceLoading ||
    (activeTab === 'payments' ? paymentsLoading : false) ||
    (activeTab === 'transactions' ? transactionsLoading : false);

  // ===== LOADING STATE =====
  if (balanceLoading && !balanceData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('balance.loading') || 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary500}
          />
        }
      >
        {/* ===== BALANCE CARD ===== */}
        {balance ? (
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <View
                style={[
                  styles.balanceIconContainer,
                  {
                    backgroundColor: paymentsApi.hasDebt(balance)
                      ? theme.colors.error50
                      : balance.is_fully_paid
                      ? theme.colors.success50
                      : theme.colors.warning50,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    balance.is_fully_paid
                      ? 'check-circle'
                      : paymentsApi.hasDebt(balance)
                      ? 'alert-circle'
                      : 'cash'
                  }
                  size={40}
                  color={
                    paymentsApi.hasDebt(balance)
                      ? theme.colors.error500
                      : balance.is_fully_paid
                      ? theme.colors.success500
                      : theme.colors.warning500
                  }
                />
              </View>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>
                  {balance.is_fully_paid
                    ? t('balance.fullyPaid') || 'Fully Paid'
                    : paymentsApi.hasDebt(balance)
                    ? t('balance.debt') || 'Debt'
                    : paymentsApi.hasOverpaid(balance)
                    ? t('balance.overpaid') || 'Overpaid'
                    : t('balance.balance') || 'Balance'}
                </Text>
                <Text
                  style={[
                    styles.balanceValue,
                    {
                      color: paymentsApi.hasDebt(balance)
                        ? theme.colors.error500
                        : balance.is_fully_paid
                        ? theme.colors.success500
                        : theme.colors.warning500,
                    },
                  ]}
                >
                  {formatAmount(Math.abs(balance.balance))}
                </Text>
                <Text style={styles.balanceSubtext}>
                  {balance.group.course.name} - {balance.group.name}
                </Text>
              </View>
            </View>

            {/* ===== STATS ROW ===== */}
            <View style={styles.statsContainer}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons
                    name="receipt"
                    size={20}
                    color={theme.colors.info500}
                  />
                  <Text style={styles.statLabel}>{t('balance.totalFee') || 'Total Fee'}</Text>
                  <Text style={styles.statValue}>
                    {tiyinToSum(balance.total_fee).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <MaterialCommunityIcons
                    name="cash-check"
                    size={20}
                    color={theme.colors.success500}
                  />
                  <Text style={styles.statLabel}>{t('balance.paid') || 'Paid'}</Text>
                  <Text style={styles.statValue}>
                    {tiyinToSum(balance.paid_amount).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <MaterialCommunityIcons
                    name="alert"
                    size={20}
                    color={theme.colors.error500}
                  />
                  <Text style={styles.statLabel}>{t('balance.fines') || 'Fines'}</Text>
                  <Text style={styles.statValue}>
                    {tiyinToSum(balance.fine_amount).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.balanceCard}>
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cash" size={60} color={theme.colors.gray400} />
              <Text style={styles.emptyTitle}>
                {t('balance.noBalance') || 'No Balance Info'}
              </Text>
              <Text style={styles.emptyMessage}>
                {t('balance.noBalanceMessage') ||
                  'No payment information available for your account.'}
              </Text>
            </View>
          </View>
        )}

        {/* ===== TABS ===== */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'balance' && styles.tabActive]}
            onPress={() => setActiveTab('balance')}
          >
            <MaterialCommunityIcons
              name="wallet"
              size={20}
              color={activeTab === 'balance' ? theme.colors.primary500 : theme.colors.gray600}
            />
            <Text style={[styles.tabText, activeTab === 'balance' && styles.tabTextActive]}>
              {t('balance.overview') || 'Overview'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
            onPress={() => setActiveTab('payments')}
          >
            <MaterialCommunityIcons
              name="cash-multiple"
              size={20}
              color={activeTab === 'payments' ? theme.colors.primary500 : theme.colors.gray600}
            />
            <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
              {t('balance.payments') || 'Payments'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'transactions' && styles.tabActive]}
            onPress={() => setActiveTab('transactions')}
          >
            <MaterialCommunityIcons
              name="history"
              size={20}
              color={
                activeTab === 'transactions' ? theme.colors.primary500 : theme.colors.gray600
              }
            />
            <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
              {t('balance.transactions') || 'Transactions'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===== CONTENT ===== */}
        {activeTab === 'balance' ? (
          <BalanceTab balance={balance} />
        ) : activeTab === 'payments' ? (
          <PaymentsTab payments={payments} loading={paymentsLoading} />
        ) : (
          <TransactionsTab transactions={transactions} loading={transactionsLoading} />
        )}
      </ScrollView>
    </View>
  );
};

// ============================================================================
// BALANCE TAB COMPONENT
// ============================================================================

interface BalanceTabProps {
  balance?: StudentBalance;
}

const BalanceTab: React.FC<BalanceTabProps> = ({ balance }) => {
  const { t } = useTranslation();

  if (!balance) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="information" size={80} color={theme.colors.gray400} />
        <Text style={styles.emptyTitle}>{t('balance.noData') || 'No Data'}</Text>
        <Text style={styles.emptyMessage}>
          {t('balance.noDataMessage') || 'No balance information available.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.balanceTabContainer}>
      {/* Payment Status Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>{t('balance.paymentStatus') || 'Payment Status'}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('balance.status') || 'Status'}:</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: balance.is_fully_paid
                  ? theme.colors.success100
                  : theme.colors.error100,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: balance.is_fully_paid ? theme.colors.success500 : theme.colors.error500,
                },
              ]}
            >
              {balance.is_fully_paid ? t('balance.paid') || 'Paid' : t('balance.unpaid') || 'Unpaid'}
            </Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('balance.course') || 'Course'}:</Text>
          <Text style={styles.infoValue}>{balance.group.course.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('balance.group') || 'Group'}:</Text>
          <Text style={styles.infoValue}>{balance.group.name}</Text>
        </View>
        {balance.group.branch && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('balance.branch') || 'Branch'}:</Text>
            <Text style={styles.infoValue}>{balance.group.branch.name}</Text>
          </View>
        )}
      </View>

      {/* Payment Details Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>
          {t('balance.paymentDetails') || 'Payment Details'}
        </Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('balance.totalFee') || 'Total Fee'}:</Text>
          <Text style={styles.infoValue}>{formatAmount(balance.total_fee)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('balance.paidAmount') || 'Paid Amount'}:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.success500 }]}>
            {formatAmount(balance.paid_amount)}
          </Text>
        </View>
        {balance.fine_amount > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('balance.fines') || 'Fines'}:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.error500 }]}>
              {formatAmount(balance.fine_amount)}
            </Text>
          </View>
        )}
        <View style={[styles.infoRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>
            {paymentsApi.hasDebt(balance)
              ? t('balance.remaining') || 'Remaining'
              : paymentsApi.hasOverpaid(balance)
              ? t('balance.overpaid') || 'Overpaid'
              : t('balance.balance') || 'Balance'}
            :
          </Text>
          <Text
            style={[
              styles.totalValue,
              {
                color: paymentsApi.hasDebt(balance)
                  ? theme.colors.error500
                  : balance.is_fully_paid
                  ? theme.colors.success500
                  : theme.colors.warning500,
              },
            ]}
          >
            {formatAmount(Math.abs(balance.balance))}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// PAYMENTS TAB COMPONENT
// ============================================================================

interface PaymentsTabProps {
  payments: Payment[];
  loading: boolean;
}

const PaymentsTab: React.FC<PaymentsTabProps> = ({ payments, loading }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
      </View>
    );
  }

  if (payments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="cash-multiple" size={80} color={theme.colors.gray400} />
        <Text style={styles.emptyTitle}>{t('balance.noPayments') || 'No Payments'}</Text>
        <Text style={styles.emptyMessage}>
          {t('balance.noPaymentsMessage') || 'No payment history available.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.paymentsContainer}>
      {payments.map((payment) => (
        <PaymentCard key={payment.id} payment={payment} />
      ))}
    </View>
  );
};

// ============================================================================
// PAYMENT CARD COMPONENT
// ============================================================================

interface PaymentCardProps {
  payment: Payment;
}

const PaymentCard: React.FC<PaymentCardProps> = ({ payment }) => {
  const statusColor = paymentsApi.getPaymentStatusColor(payment.status);
  const statusLabel = paymentsApi.getPaymentStatusLabel(payment.status);

  return (
    <View style={styles.paymentCard}>
      <View style={[styles.paymentIcon, { backgroundColor: statusColor + '20' }]}>
        <MaterialCommunityIcons
          name={payment.status === 'paid' ? 'check' : payment.status === 'pending' ? 'clock' : 'close'}
          size={24}
          color={statusColor}
        />
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentTitle}>{payment.payment_type.name}</Text>
        <Text style={styles.paymentDate}>
          {new Date(payment.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.paymentAmount}>{formatAmount(payment.amount)}</Text>
    </View>
  );
};

// ============================================================================
// TRANSACTIONS TAB COMPONENT
// ============================================================================

interface TransactionsTabProps {
  transactions: AccountTransaction[];
  loading: boolean;
}

const TransactionsTab: React.FC<TransactionsTabProps> = ({ transactions, loading }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="history" size={80} color={theme.colors.gray400} />
        <Text style={styles.emptyTitle}>{t('balance.noTransactions') || 'No Transactions'}</Text>
        <Text style={styles.emptyMessage}>
          {t('balance.noTransactionsMessage') || 'No account transactions available.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.transactionsContainer}>
      {transactions.map((transaction) => (
        <TransactionCard key={transaction.id} transaction={transaction} />
      ))}
    </View>
  );
};

// ============================================================================
// TRANSACTION CARD COMPONENT
// ============================================================================

interface TransactionCardProps {
  transaction: AccountTransaction;
}

const TransactionCard: React.FC<TransactionCardProps> = ({ transaction }) => {
  const typeLabel = paymentsApi.getTransactionTypeLabel(transaction.transaction_type);
  const iconColor =
    transaction.transaction_type === 'payment'
      ? theme.colors.success500
      : transaction.transaction_type === 'fine'
      ? theme.colors.error500
      : theme.colors.info500;

  return (
    <View style={styles.transactionCard}>
      <View style={[styles.transactionIcon, { backgroundColor: iconColor + '20' }]}>
        <MaterialCommunityIcons
          name={
            transaction.transaction_type === 'payment'
              ? 'cash-plus'
              : transaction.transaction_type === 'fine'
              ? 'alert'
              : 'cash-refund'
          }
          size={24}
          color={iconColor}
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionTitle}>{typeLabel}</Text>
        <Text style={styles.transactionDescription}>{transaction.description}</Text>
        <Text style={styles.transactionDate}>
          {new Date(transaction.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text style={[styles.transactionAmount, { color: iconColor }]}>
        {formatAmount(transaction.amount)}
      </Text>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    ...theme.typography.body,
    marginTop: theme.spacing.md,
    color: theme.colors.gray600,
  },
  centerContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },

  // ===== BALANCE CARD =====
  balanceCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: 16,
    ...theme.shadows.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  balanceIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  balanceValue: {
    ...theme.typography.h1,
    fontWeight: '700',
  },
  balanceSubtext: {
    ...theme.typography.body,
    color: theme.colors.gray700,
    marginTop: 4,
  },
  statsContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    paddingTop: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: 4,
    fontSize: 12,
  },
  statValue: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.gray200,
  },

  // ===== TABS =====
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: 12,
    padding: 4,
    ...theme.shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    gap: 4,
  },
  tabActive: {
    backgroundColor: theme.colors.primary50,
  },
  tabText: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    fontWeight: '500',
    fontSize: 11,
  },
  tabTextActive: {
    color: theme.colors.primary500,
    fontWeight: '600',
  },

  // ===== BALANCE TAB =====
  balanceTabContainer: {
    padding: theme.spacing.md,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  infoCardTitle: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  infoLabel: {
    ...theme.typography.body,
    color: theme.colors.gray600,
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  totalRow: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  totalLabel: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  totalValue: {
    ...theme.typography.h3,
    fontWeight: '700',
  },

  // ===== PAYMENTS =====
  paymentsContainer: {
    padding: theme.spacing.md,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentDate: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  paymentAmount: {
    ...theme.typography.h4,
    fontWeight: '700',
  },

  // ===== TRANSACTIONS =====
  transactionsContainer: {
    padding: theme.spacing.md,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionDescription: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: 2,
  },
  transactionDate: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    fontSize: 11,
  },
  transactionAmount: {
    ...theme.typography.h4,
    fontWeight: '700',
  },

  // ===== EMPTY STATE =====
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.md,
    color: theme.colors.gray700,
  },
  emptyMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.sm,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
});
