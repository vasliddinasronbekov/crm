import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { getErrorMessage, useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import {
  getRuntimeAssignmentDetail,
  getRuntimeAssignmentSubmission,
  submitRuntimeAssignment,
} from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type AssignmentRouteProp = RouteProp<AppStackParamList, 'AssignmentDetail'>;

export const AssignmentDetailScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AssignmentRouteProp>();
  const queryClient = useQueryClient();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const { assignmentId } = route.params;

  const [submissionText, setSubmissionText] = useState('');

  const assignmentQuery = useQuery({
    queryKey: ['runtime-assignment', assignmentId],
    queryFn: () => getRuntimeAssignmentDetail(assignmentId),
  });

  const submissionQuery = useQuery({
    queryKey: ['runtime-assignment-submission', assignmentId],
    queryFn: () => getRuntimeAssignmentSubmission(assignmentId),
  });

  const submitMutation = useMutation({
    mutationFn: (text: string) => submitRuntimeAssignment(assignmentId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime-assignment', assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['runtime-assignment-submission', assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['runtime-assignments'] });
      Alert.alert('Submitted', 'Your assignment was submitted successfully.');
      setSubmissionText('');
    },
    onError: (error) => {
      Alert.alert('Submission failed', getErrorMessage(error));
    },
  });

  const openAttachment = async (url?: string | null) => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Open failed', 'The attachment could not be opened.');
    }
  };

  if (assignmentQuery.isLoading || submissionQuery.isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.stateText}>Loading assignment...</Text>
      </View>
    );
  }

  if (!assignmentQuery.data) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={56} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Assignment unavailable</Text>
        <Text style={styles.stateText}>The assignment could not be loaded.</Text>
      </View>
    );
  }

  const assignment = assignmentQuery.data;
  const submission = submissionQuery.data;
  const canSubmit =
    (!submission && assignment.status === 'pending') ||
    (assignment.allowResubmission && submission?.status === 'returned');
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isOverdue = Boolean(dueDate && dueDate.getTime() < Date.now() && !submission);
  const statusColor =
    assignment.status === 'graded'
      ? '#16a34a'
      : assignment.status === 'submitted'
      ? '#2563eb'
      : '#d97706';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={[styles.heroIcon, { backgroundColor: `${statusColor}18` }]}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={28} color={statusColor} />
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{assignment.status}</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{assignment.title}</Text>
        <Text style={styles.heroSubtitle}>
          {assignment.moduleTitle || assignment.assignmentType || 'Assignment'}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="calendar-clock-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>
              {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'No due date'}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="star-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{assignment.maxPoints} pts</Text>
          </View>
        </View>
      </GlassCard>

      {(assignment.description || assignment.instructions) && (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Task Brief</Text>
          {assignment.description ? <Text style={styles.sectionBody}>{assignment.description}</Text> : null}
          {assignment.instructions ? <Text style={styles.sectionBody}>{assignment.instructions}</Text> : null}
        </GlassCard>
      )}

      {assignment.attachment ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reference Attachment</Text>
          <TouchableOpacity style={styles.linkButton} onPress={() => openAttachment(assignment.attachment)}>
            <MaterialCommunityIcons name="paperclip" size={18} color="#2563eb" />
            <Text style={styles.linkText}>Open attachment</Text>
          </TouchableOpacity>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Submission Status</Text>
        <Text style={styles.sectionBody}>
          {submission
            ? `Submitted on ${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '—'}`
            : isOverdue
            ? 'This assignment is overdue.'
            : 'No submission recorded yet.'}
        </Text>
        {submission?.feedback ? <Text style={styles.feedbackText}>Feedback: {submission.feedback}</Text> : null}
        {typeof submission?.pointsEarned === 'number' ? (
          <Text style={styles.gradeText}>Score: {submission.pointsEarned} / {assignment.maxPoints}</Text>
        ) : null}
      </GlassCard>

      {submission?.textContent ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Your Submission</Text>
          <Text style={styles.sectionBody}>{submission.textContent}</Text>
        </GlassCard>
      ) : null}

      {canSubmit ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Submit Assignment</Text>
          <TextInput
            style={styles.textInput}
            multiline
            value={submissionText}
            onChangeText={setSubmissionText}
            placeholder="Write your response here..."
            placeholderTextColor={theme.textSecondary}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.submitButton, (!submissionText.trim() || submitMutation.isPending) && styles.buttonDisabled]}
            onPress={() => submitMutation.mutate(submissionText)}
            disabled={!submissionText.trim() || submitMutation.isPending}
          >
            <Text style={styles.submitButtonText}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit Response'}
            </Text>
            <MaterialCommunityIcons name="send-outline" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </GlassCard>
      ) : null}

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Back to Assignments</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    contentContainer: {
      padding: 20,
      gap: 14,
      paddingBottom: 40,
    },
    stateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      padding: 24,
    },
    stateTitle: {
      ...theme.typography.h3,
      color: theme.text,
      marginTop: 12,
    },
    stateText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    heroCard: {
      padding: 20,
      borderRadius: 28,
      gap: 12,
    },
    heroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    statusText: {
      ...theme.typography.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    heroTitle: {
      ...theme.typography.h2,
      color: theme.text,
    },
    heroSubtitle: {
      ...theme.typography.body,
      color: theme.textSecondary,
    },
    metaRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.64)',
    },
    metaText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
    },
    sectionCard: {
      padding: 18,
      borderRadius: 24,
      gap: 10,
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.text,
    },
    sectionBody: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    feedbackText: {
      ...theme.typography.body,
      color: '#2563eb',
    },
    gradeText: {
      ...theme.typography.body,
      color: '#16a34a',
      fontWeight: '700',
    },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: 'rgba(37,99,235,0.12)',
    },
    linkText: {
      ...theme.typography.button,
      color: '#2563eb',
    },
    textInput: {
      ...theme.typography.body,
      minHeight: 180,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.78)',
      color: theme.text,
      textAlignVertical: 'top',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: '#0f766e',
    },
    submitButtonText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    backButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.76)',
    },
    backButtonText: {
      ...theme.typography.button,
      color: theme.text,
    },
  });
