import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors } from '../theme';

interface SalaryRecord {
  month: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  total: number;
  status: 'paid' | 'pending' | 'processing';
  paidDate?: string;
}

const salaryData: SalaryRecord[] = [
  {
    month: 'January 2025',
    baseSalary: 8000000,
    bonus: 1500000,
    deductions: 500000,
    total: 9000000,
    status: 'pending',
  },
  {
    month: 'December 2024',
    baseSalary: 8000000,
    bonus: 2000000,
    deductions: 500000,
    total: 9500000,
    status: 'paid',
    paidDate: '2025-01-05',
  },
  {
    month: 'November 2024',
    baseSalary: 8000000,
    bonus: 1000000,
    deductions: 500000,
    total: 8500000,
    status: 'paid',
    paidDate: '2024-12-05',
  },
  {
    month: 'October 2024',
    baseSalary: 8000000,
    bonus: 1200000,
    deductions: 500000,
    total: 8700000,
    status: 'paid',
    paidDate: '2024-11-05',
  },
];

export default function SalaryScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const currentSalary = salaryData[0];
  const totalEarned = salaryData
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + s.total, 0);

  const formatCurrency = (amount: number) => {
    return '$' + new Intl.NumberFormat('en-US').format(amount / 12500); // Convert UZS to USD approx
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'processing':
        return colors.primary;
      default:
        return colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      default:
        return status;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Salary</Text>
        <Text style={styles.headerSubtitle}>Monthly payment information</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Month Card */}
        <View style={styles.currentSalaryCard}>
          <View style={styles.currentSalaryHeader}>
            <View>
              <Text style={styles.currentMonth}>{currentSalary.month}</Text>
              <Text style={styles.currentStatus}>
                {getStatusText(currentSalary.status)}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(currentSalary.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: getStatusColor(currentSalary.status) },
                ]}
              >
                {getStatusText(currentSalary.status)}
              </Text>
            </View>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Payment</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(currentSalary.total)}
            </Text>
          </View>

          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Base Salary</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(currentSalary.baseSalary)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Bonus</Text>
              <Text style={[styles.breakdownValue, styles.bonusText]}>
                +{formatCurrency(currentSalary.bonus)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Deductions</Text>
              <Text style={[styles.breakdownValue, styles.deductionText]}>
                -{formatCurrency(currentSalary.deductions)}
              </Text>
            </View>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(8000000)}</Text>
            <Text style={styles.statLabel}>Base Salary</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(totalEarned)}</Text>
            <Text style={styles.statLabel}>Yearly Income</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {formatCurrency(totalEarned / salaryData.filter((s) => s.status === 'paid').length)}
            </Text>
            <Text style={styles.statLabel}>Average Monthly</Text>
          </View>
        </View>

        {/* Salary History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>

          {salaryData.map((record, index) => (
            <View key={index} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.historyMonth}>{record.month}</Text>
                  {record.paidDate && (
                    <Text style={styles.historyDate}>
                      Paid: {new Date(record.paidDate).toLocaleDateString('en-US')}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.historyStatusBadge,
                    { backgroundColor: getStatusColor(record.status) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.historyStatusText,
                      { color: getStatusColor(record.status) },
                    ]}
                  >
                    {getStatusText(record.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.historyAmount}>
                <Text style={styles.historyAmountLabel}>Total:</Text>
                <Text style={styles.historyAmountValue}>
                  {formatCurrency(record.total)}
                </Text>
              </View>

              <View style={styles.historyDetails}>
                <Text style={styles.historyDetailText}>
                  Base: {formatCurrency(record.baseSalary)}
                </Text>
                <Text style={styles.historyDetailText}>•</Text>
                <Text style={[styles.historyDetailText, styles.bonusText]}>
                  Bonus: +{formatCurrency(record.bonus)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Info Footer */}
        <View style={styles.infoFooter}>
          <Text style={styles.infoText}>
            💡 Salary is paid on the 5th of each month
          </Text>
          <Text style={styles.infoText}>
            📊 Bonuses are calculated based on work performance
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  currentSalaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentSalaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  currentMonth: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  currentStatus: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountContainer: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bonusText: {
    color: colors.success,
  },
  deductionText: {
    color: colors.error,
  },
  statsGrid: {
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyMonth: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  historyAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyAmountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  historyAmountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  historyDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  historyDetailText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoFooter: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
});
