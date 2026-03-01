import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

// Helper function to format amount (tiyin to sum)
const formatAmount = (tiyin: number): string => {
  const sum = tiyin / 100;
  return `${sum.toLocaleString()} sum`;
};

/**
 * PaymentsScreen - Real Money Payment Management
 *
 * Features:
 * - View student balance (course fees, payments, fines)
 * - Payment history
 * - Create new payment
 * - Payment methods
 * - Payment receipts
 */
export const PaymentsScreen = () => {
  const [activeTab, setActiveTab] = useState<'balance' | 'history'>('balance');

  // Fetch student balance
  const {
    data: balanceData,
    isLoading: balanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['student-balance'],
    queryFn: async () => {
      const response = await apiClient.getBalance();
      return response.data;
    },
  });

  // Fetch payment history
  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const response = await apiClient.getPayments();
      return response.data;
    },
  });

  const balance = balanceData?.results?.[0];
  const payments = paymentsData?.results || [];

  const isRefreshing = balanceLoading || paymentsLoading;

  const handleRefresh = () => {
    refetchBalance();
    refetchPayments();
  };

  const handleCreatePayment = () => {
    if (!balance) {
      Alert.alert('Error', 'No balance information available');
      return;
    }

    if (balance.is_fully_paid) {
      Alert.alert('Info', 'Your account is fully paid!');
      return;
    }

    // Show payment amount prompt
    Alert.prompt(
      'Make Payment',
      `Current balance: ${formatAmount(balance.balance)}\n\nEnter payment amount:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay',
          onPress: async (amount?: string) => {
            if (!amount) return;
            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
              Alert.alert('Error', 'Invalid amount');
              return;
            }

            try {
              // Convert sum to tiyin (multiply by 100)
              const amountInTiyin = Math.round(amountNum * 100);
              await apiClient.createPayment(amountInTiyin);
              Alert.alert('Success', 'Payment created successfully!');
              refetchBalance();
              refetchPayments();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to create payment');
            }
          },
        },
      ],
      'plain-text',
      (balance.balance / 100).toString()
    );
  };

  const renderBalanceTab = () => {
    if (balanceLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading balance...</Text>
        </View>
      );
    }

    if (balanceError || !balance) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.emptyTitle}>No Balance Information</Text>
          <Text style={styles.emptyText}>
            Could not load your balance information
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {/* Balance Card */}
        <View
          style={[
            styles.balanceCard,
            balance.is_fully_paid ? styles.balanceCardPaid : styles.balanceCardUnpaid,
          ]}
        >
          <View style={styles.balanceHeader}>
            <MaterialCommunityIcons
              name={balance.is_fully_paid ? 'check-circle' : 'alert-circle'}
              size={48}
              color={balance.is_fully_paid ? '#10B981' : '#F59E0B'}
            />
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>
                {balance.is_fully_paid ? 'Fully Paid' : 'Balance Due'}
              </Text>
              <Text style={styles.balanceAmount}>
                {formatAmount(balance.balance)}
              </Text>
            </View>
          </View>

          {/* Course Info */}
          <View style={styles.courseInfo}>
            <Text style={styles.courseLabel}>Course</Text>
            <Text style={styles.courseName}>
              {balance.group?.course?.name || 'N/A'} - {balance.group?.name || 'N/A'}
            </Text>
          </View>

          {/* Payment Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Total Fee</Text>
              <Text style={styles.detailValue}>
                {formatAmount(balance.total_fee)}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Paid</Text>
              <Text style={[styles.detailValue, styles.paidValue]}>
                {formatAmount(balance.paid_amount)}
              </Text>
            </View>

            {balance.fine_amount > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Fines</Text>
                <Text style={[styles.detailValue, styles.fineValue]}>
                  {formatAmount(balance.fine_amount)}
                </Text>
              </View>
            )}
          </View>

          {/* Pay Button */}
          {!balance.is_fully_paid && (
            <TouchableOpacity
              style={styles.payButton}
              onPress={handleCreatePayment}
            >
              <MaterialCommunityIcons name="cash" size={24} color="#FFFFFF" />
              <Text style={styles.payButtonText}>Make Payment</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information" size={24} color="#3B82F6" />
          <Text style={styles.infoText}>
            Contact your administrator for any billing questions or payment issues.
          </Text>
        </View>
      </View>
    );
  };

  const renderHistoryTab = () => {
    if (paymentsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      );
    }

    if (payments.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="receipt" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Payments Yet</Text>
          <Text style={styles.emptyText}>
            Your payment history will appear here
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {payments.map((payment: any) => (
          <View key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <View style={styles.paymentLeft}>
                <MaterialCommunityIcons
                  name={
                    payment.status === 'paid'
                      ? 'check-circle'
                      : payment.status === 'pending'
                      ? 'clock-outline'
                      : 'alert-circle'
                  }
                  size={40}
                  color={
                    payment.status === 'paid'
                      ? '#10B981'
                      : payment.status === 'pending'
                      ? '#F59E0B'
                      : '#EF4444'
                  }
                />
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentAmount}>
                    {formatAmount(payment.amount)}
                  </Text>
                  <Text style={styles.paymentMethod}>
                    {payment.payment_type?.name || 'Payment'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  payment.status === 'paid'
                    ? styles.statusPaid
                    : payment.status === 'pending'
                    ? styles.statusPending
                    : styles.statusFailed,
                ]}
              >
                <Text style={styles.statusText}>
                  {(payment.status || 'unknown').toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.paymentDetails}>
              <View style={styles.paymentDetailRow}>
                <Text style={styles.paymentDetailLabel}>Group</Text>
                <Text style={styles.paymentDetailValue}>
                  {payment.group?.name || 'N/A'}
                </Text>
              </View>

              <View style={styles.paymentDetailRow}>
                <Text style={styles.paymentDetailLabel}>Date</Text>
                <Text style={styles.paymentDetailValue}>
                  {new Date(payment.date).toLocaleDateString()}
                </Text>
              </View>

              {payment.created_at && (
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>Time</Text>
                  <Text style={styles.paymentDetailValue}>
                    {new Date(payment.created_at).toLocaleTimeString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payments</Text>
        <Text style={styles.headerSubtitle}>Manage your course payments</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balance' && styles.tabActive]}
          onPress={() => setActiveTab('balance')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'balance' && styles.tabTextActive,
            ]}
          >
            Balance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'history' && styles.tabTextActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {activeTab === 'balance' ? renderBalanceTab() : renderHistoryTab()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabContent: {
    gap: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceCardPaid: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  balanceCardUnpaid: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceInfo: {
    marginLeft: 16,
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  courseInfo: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  courseLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  detailsGrid: {
    gap: 12,
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  paidValue: {
    color: '#10B981',
  },
  fineValue: {
    color: '#EF4444',
  },
  payButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentInfo: {
    marginLeft: 12,
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  paymentDetails: {
    gap: 8,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
});
