import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';

interface Payment {
  id: number;
  amount: number;
  payment_type: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method?: string;
  created_at: string;
  updated_at: string;
  receipt_url?: string;
  description?: string;
}

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [newPaymentModal, setNewPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('tuition');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const data = await apiService.getPayments();
      setPayments(data.results || data || []);
    } catch (error: any) {
      console.error('Failed to load payments:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load payments.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadPayments();
  };

  const handleCreatePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.createPayment(parseFloat(paymentAmount), paymentType);
      Alert.alert('Success', 'Payment created successfully!');
      setNewPaymentModal(false);
      setPaymentAmount('');
      setPaymentType('tuition');
      loadPayments();
    } catch (error: any) {
      console.error('Failed to create payment:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to create payment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewReceipt = async (payment: Payment) => {
    try {
      const receipt = await apiService.getPaymentReceipt(payment.id);
      Alert.alert('Receipt', JSON.stringify(receipt, null, 2));
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load receipt.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'failed':
        return '#EF4444';
      case 'refunded':
        return '#6366F1';
      default:
        return '#94a3b8';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'pending':
        return '⏳';
      case 'failed':
        return '✗';
      case 'refunded':
        return '↩';
      default:
        return '?';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getTotalPaid = () => {
    return payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const getTotalPending = () => {
    return payments
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#00d4ff"
            colors={['#00d4ff']}
          />
        }
      >
        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <LinearGradient
              colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.05)']}
              style={styles.statGradient}
            >
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                {formatCurrency(getTotalPaid())}
              </Text>
              <Text style={styles.statLabel}>Total Paid</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCard}>
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.05)']}
              style={styles.statGradient}
            >
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {formatCurrency(getTotalPending())}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Payment History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <Text style={styles.totalCount}>{payments.length} payments</Text>
          </View>

          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>No payments found</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <TouchableOpacity
                key={payment.id}
                style={styles.paymentCard}
                onPress={() => {
                  setSelectedPayment(payment);
                  setModalVisible(true);
                }}
              >
                <LinearGradient
                  colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                  style={styles.paymentGradient}
                >
                  <View style={styles.paymentLeft}>
                    <View
                      style={[
                        styles.paymentIcon,
                        { backgroundColor: getStatusColor(payment.status) },
                      ]}
                    >
                      <Text style={styles.paymentIconText}>
                        {getStatusIcon(payment.status)}
                      </Text>
                    </View>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentType}>
                        {payment.payment_type.charAt(0).toUpperCase() +
                          payment.payment_type.slice(1)}
                      </Text>
                      <Text style={styles.paymentDate}>
                        {formatDate(payment.created_at)}
                      </Text>
                      {payment.payment_method && (
                        <Text style={styles.paymentMethod}>
                          {payment.payment_method}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { borderColor: getStatusColor(payment.status) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(payment.status) },
                        ]}
                      >
                        {payment.status.charAt(0).toUpperCase() +
                          payment.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setNewPaymentModal(true)}
      >
        <LinearGradient colors={['#00d4ff', '#0099cc']} style={styles.fabGradient}>
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Payment Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment Details</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedPayment && (
                <ScrollView style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedPayment.amount)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>
                      {selectedPayment.payment_type.charAt(0).toUpperCase() +
                        selectedPayment.payment_type.slice(1)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { borderColor: getStatusColor(selectedPayment.status) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(selectedPayment.status) },
                        ]}
                      >
                        {selectedPayment.status.charAt(0).toUpperCase() +
                          selectedPayment.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {selectedPayment.payment_method && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Method</Text>
                      <Text style={styles.detailValue}>
                        {selectedPayment.payment_method}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedPayment.created_at)}
                    </Text>
                  </View>

                  {selectedPayment.description && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>
                        {selectedPayment.description}
                      </Text>
                    </View>
                  )}

                  {selectedPayment.status === 'completed' && (
                    <TouchableOpacity
                      style={styles.receiptButton}
                      onPress={() => handleViewReceipt(selectedPayment)}
                    >
                      <LinearGradient
                        colors={['#00d4ff', '#0099cc']}
                        style={styles.receiptGradient}
                      >
                        <Text style={styles.receiptText}>View Receipt</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* New Payment Modal */}
      <Modal
        visible={newPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNewPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Payment</Text>
                <TouchableOpacity onPress={() => setNewPaymentModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter amount"
                    placeholderTextColor="#64748b"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Type</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeOption,
                        paymentType === 'tuition' && styles.typeOptionActive,
                      ]}
                      onPress={() => setPaymentType('tuition')}
                    >
                      <Text
                        style={[
                          styles.typeText,
                          paymentType === 'tuition' && styles.typeTextActive,
                        ]}
                      >
                        Tuition
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeOption,
                        paymentType === 'fee' && styles.typeOptionActive,
                      ]}
                      onPress={() => setPaymentType('fee')}
                    >
                      <Text
                        style={[
                          styles.typeText,
                          paymentType === 'fee' && styles.typeTextActive,
                        ]}
                      >
                        Fee
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeOption,
                        paymentType === 'other' && styles.typeOptionActive,
                      ]}
                      onPress={() => setPaymentType('other')}
                    >
                      <Text
                        style={[
                          styles.typeText,
                          paymentType === 'other' && styles.typeTextActive,
                        ]}
                      >
                        Other
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleCreatePayment}
                  disabled={isSubmitting}
                >
                  <LinearGradient
                    colors={['#00d4ff', '#0099cc']}
                    style={styles.submitGradient}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>Create Payment</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  section: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalCount: {
    fontSize: 14,
    color: '#94a3b8',
  },
  paymentCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  paymentGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentIconText: {
    fontSize: 24,
    color: '#fff',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
  },
  paymentMethod: {
    fontSize: 12,
    color: '#00d4ff',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalClose: {
    fontSize: 28,
    color: '#94a3b8',
    fontWeight: '300',
  },
  modalBody: {
    maxHeight: 500,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  receiptButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  receiptGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  receiptText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: '#00d4ff',
  },
  typeText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#00d4ff',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  submitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
