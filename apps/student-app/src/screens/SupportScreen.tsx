import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';

export default function SupportScreen() {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [faqVisible, setFaqVisible] = useState(false);

  const categories = [
    { id: 'technical', label: 'Technical Issue', icon: '🔧' },
    { id: 'academic', label: 'Academic Question', icon: '📚' },
    { id: 'account', label: 'Account Issue', icon: '👤' },
    { id: 'payment', label: 'Payment Issue', icon: '💳' },
    { id: 'other', label: 'Other', icon: '💬' },
  ];

  const faqs = [
    {
      question: 'How do I submit an assignment?',
      answer:
        'Go to the Assignments screen, select an assignment, and click the Submit button. You can add text content and attach files.',
    },
    {
      question: 'How do I check my attendance?',
      answer:
        'Navigate to the Attendance screen from the Dashboard to view your attendance records and statistics.',
    },
    {
      question: 'How do I earn coins?',
      answer:
        'Earn coins by completing assignments, quizzes, maintaining good attendance, and participating in class activities.',
    },
    {
      question: 'How can I make a payment?',
      answer:
        'Go to the Payments screen and click the + button to create a new payment. Select the payment type and enter the amount.',
    },
    {
      question: 'How do I view my courses?',
      answer:
        'Tap on the Courses tab in the bottom navigation to see all your enrolled courses and available courses.',
    },
  ];

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.createTicket(reason, message);
      Alert.alert('Success', 'Support ticket created successfully!');
      setReason('');
      setMessage('');
      setSelectedCategory(null);
    } catch (error: any) {
      console.error('Failed to create ticket:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to create support ticket.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <LinearGradient
          colors={['rgba(0, 212, 255, 0.2)', 'rgba(0, 212, 255, 0.05)']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Need Help?</Text>
          <Text style={styles.headerSubtitle}>
            We're here to assist you with any questions or issues
          </Text>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => setFaqVisible(true)}
            >
              <LinearGradient
                colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                style={styles.quickActionGradient}
              >
                <Text style={styles.quickActionIcon}>❓</Text>
                <Text style={styles.quickActionLabel}>FAQ</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <LinearGradient
                colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                style={styles.quickActionGradient}
              >
                <Text style={styles.quickActionIcon}>📞</Text>
                <Text style={styles.quickActionLabel}>Call Us</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <LinearGradient
                colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                style={styles.quickActionGradient}
              >
                <Text style={styles.quickActionIcon}>✉️</Text>
                <Text style={styles.quickActionLabel}>Email</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Create Ticket Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create Support Ticket</Text>

          {/* Category Selection */}
          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.categoriesContainer}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === category.id &&
                      styles.categoryLabelActive,
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Subject */}
          <Text style={styles.inputLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief description of the issue"
            placeholderTextColor="#64748b"
            value={reason}
            onChangeText={setReason}
          />

          {/* Message */}
          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide details about your issue or question"
            placeholderTextColor="#64748b"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <LinearGradient
              colors={['#00d4ff', '#0099cc']}
              style={styles.submitGradient}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit Ticket</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.contactCard}>
            <LinearGradient
              colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
              style={styles.contactGradient}
            >
              <View style={styles.contactItem}>
                <Text style={styles.contactIcon}>📧</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Email</Text>
                  <Text style={styles.contactValue}>support@example.com</Text>
                </View>
              </View>

              <View style={styles.contactItem}>
                <Text style={styles.contactIcon}>📞</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Phone</Text>
                  <Text style={styles.contactValue}>+1 (555) 123-4567</Text>
                </View>
              </View>

              <View style={styles.contactItem}>
                <Text style={styles.contactIcon}>🕐</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Support Hours</Text>
                  <Text style={styles.contactValue}>Mon-Fri, 9AM-5PM</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>

      {/* FAQ Modal */}
      <Modal
        visible={faqVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFaqVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Frequently Asked Questions</Text>
                <TouchableOpacity onPress={() => setFaqVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {faqs.map((faq, index) => (
                  <View key={index} style={styles.faqItem}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                ))}
              </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 212, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickActionGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: '#00d4ff',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: '#00d4ff',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#fff',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
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
  contactCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  contactGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 16,
    width: 32,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  modalClose: {
    fontSize: 28,
    color: '#94a3b8',
    fontWeight: '300',
  },
  modalBody: {
    maxHeight: 500,
  },
  faqItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00d4ff',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
});
