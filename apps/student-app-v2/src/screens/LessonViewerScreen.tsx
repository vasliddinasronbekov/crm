import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';

import { lessonService, useTheme } from '@eduvoice/mobile-shared';

import { GlassCard } from '../components/app/GlassCard';
import { formatDuration, getLessonDurationSeconds, normalizeLessonType, stripHtml } from '../lib/lms';
import { loadLessonRuntimeState, saveLessonRuntimeState } from '../lib/lmsRuntime';
import type { AppStackParamList } from '../navigation/types';

type LessonViewerRoute = RouteProp<AppStackParamList, 'LessonViewer'>;

type LocalLessonState = {
  bookmarked: boolean;
  notes: string;
  lastPositionSeconds: number;
  lastOpenedAt?: string;
};

const defaultState: LocalLessonState = {
  bookmarked: false,
  notes: '',
  lastPositionSeconds: 0,
};

export const LessonViewerScreen = () => {
  const route = useRoute<LessonViewerRoute>();
  const queryClient = useQueryClient();
  const videoRef = useRef<any>(null);
  const { lessonId, initialType } = route.params;
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [localState, setLocalState] = useState<LocalLessonState>(defaultState);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const lessonQuery = useQuery({
    queryKey: ['lesson-viewer', lessonId],
    queryFn: () => lessonService.getLessonDetail(lessonId),
  });

  const lessonType = normalizeLessonType(lessonQuery.data?.lesson_type || initialType);
  useEffect(() => {
    let active = true;

    const loadState = async () => {
      try {
        const saved = await loadLessonRuntimeState(lessonId);
        if (!active) {
          return;
        }
        setLocalState({ ...defaultState, ...saved });
      } catch (error) {
        console.error('Failed to load lesson runtime state:', error);
      } finally {
        if (active) {
          setStorageLoaded(true);
        }
      }
    };

    void loadState();

    return () => {
      active = false;
    };
  }, [lessonId]);

  useEffect(() => {
    if (!storageLoaded || !lessonQuery.data) {
      return;
    }

    void saveLessonRuntimeState(
      lessonId,
      {
        ...localState,
        lastOpenedAt: new Date().toISOString(),
        completion: lessonQuery.data.student_progress?.completion_percentage || 0,
      },
      lessonQuery.data
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['learn-hub-runtime'] });
    });
  }, [lessonId, lessonQuery.data, localState, queryClient, storageLoaded]);

  useEffect(() => {
    if (!lessonQuery.data?.video_url || !localState.lastPositionSeconds || !videoRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      videoRef.current?.setPositionAsync(localState.lastPositionSeconds * 1000).catch(() => undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [lessonQuery.data?.video_url, localState.lastPositionSeconds]);

  const completeMutation = useMutation({
    mutationFn: () => lessonService.markLessonComplete(lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-viewer', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['lesson-collection'] });
      queryClient.invalidateQueries({ queryKey: ['learn-hub-runtime'] });
      Alert.alert('Lesson updated', 'This lesson is now marked as completed.');
    },
    onError: () => {
      Alert.alert('Update failed', 'The lesson could not be marked complete right now.');
    },
  });

  const accentColor =
    lessonType === 'video'
      ? '#dc2626'
      : lessonType === 'book'
      ? '#16a34a'
      : '#7c3aed';

  const notePreview = localState.notes.trim().length > 0 ? localState.notes.trim() : 'Add your own notes, reminders, or summary here.';

  const toggleBookmark = () => {
    setLocalState((current) => ({ ...current, bookmarked: !current.bookmarked }));
  };

  const openUrl = async (url?: string) => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Link failed', 'This resource could not be opened on the device.');
    }
  };

  if (lessonQuery.isLoading || !storageLoaded) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text style={styles.stateText}>Loading lesson...</Text>
      </View>
    );
  }

  if (!lessonQuery.data) {
    return (
      <View style={styles.stateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={56} color={theme.colors.error500} />
        <Text style={styles.stateTitle}>Lesson unavailable</Text>
        <Text style={styles.stateText}>The lesson could not be loaded from the current API response.</Text>
      </View>
    );
  }

  const lesson = lessonQuery.data;
  const cleanedContent = stripHtml(lesson.content || lesson.description);
  const completion = lesson.student_progress?.completion_percentage || 0;
  const resources = lesson.resources || [];
  const attachments = lesson.attachments || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIcon, { backgroundColor: `${accentColor}22` }]}>
            <MaterialCommunityIcons
              name={
                lessonType === 'video'
                  ? 'play-box-multiple-outline'
                  : lessonType === 'book'
                  ? 'book-open-page-variant-outline'
                  : 'text-box-multiple-outline'
              }
              size={28}
              color={accentColor}
            />
          </View>
          <TouchableOpacity onPress={toggleBookmark} style={styles.iconButton} activeOpacity={0.8}>
            <MaterialCommunityIcons
              name={localState.bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={localState.bookmarked ? accentColor : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.lessonTitle}>{lesson.title}</Text>
        <Text style={styles.lessonSubtitle}>{lesson.module_title || lesson.module_name || `Module ${lesson.module}`}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: `${accentColor}20` }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{lessonType}</Text>
          </View>
          {lesson.is_free_preview && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>free preview</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatDuration(getLessonDurationSeconds(lesson))}</Text>
          </View>
          {!!lesson.total_pages && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lesson.total_pages} pages</Text>
            </View>
          )}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completion}%` as const, backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.progressLabel}>{completion}% completed</Text>
      </GlassCard>

      {lessonType === 'video' && lesson.video_url ? (
        <GlassCard style={styles.mediaCard}>
          <Text style={styles.sectionTitle}>Video lesson</Text>
          <Video
            ref={videoRef}
            source={{ uri: lesson.video_url }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={(status: any) => {
              if (!status?.isLoaded) {
                return;
              }

              const seconds = Math.floor((status.positionMillis || 0) / 1000);
              if (Math.abs(seconds - localState.lastPositionSeconds) >= 5) {
                setLocalState((current) => ({ ...current, lastPositionSeconds: seconds }));
              }

              if (status.didJustFinish) {
                completeMutation.mutate();
              }
            }}
          />
          {localState.lastPositionSeconds > 0 && (
            <Text style={styles.helperText}>Resume point saved at {formatDuration(localState.lastPositionSeconds)}.</Text>
          )}
        </GlassCard>
      ) : null}

      <GlassCard style={styles.contentCard}>
        <Text style={styles.sectionTitle}>Lesson content</Text>
        <Text style={styles.bodyText}>{cleanedContent || 'Detailed lesson content is not available yet. Use the notes area below to capture your own summary.'}</Text>
      </GlassCard>

      <GlassCard style={styles.notesCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <MaterialCommunityIcons name="note-edit-outline" size={18} color={theme.textSecondary} />
        </View>
        <TextInput
          style={styles.notesInput}
          multiline
          placeholder="Write your takeaway, answer structure, formulas, or reminders..."
          placeholderTextColor={theme.textMuted}
          value={localState.notes}
          onChangeText={(notes) => setLocalState((current) => ({ ...current, notes }))}
          textAlignVertical="top"
        />
        <Text style={styles.helperText}>{notePreview}</Text>
      </GlassCard>

      {(resources.length > 0 || attachments.length > 0) && (
        <GlassCard style={styles.resourceCard}>
          <Text style={styles.sectionTitle}>Resources</Text>
          {resources.map((resource) => (
            <TouchableOpacity
              key={`resource-${resource.id}`}
              style={styles.resourceItem}
              onPress={() => {
                void openUrl(resource.url);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.resourceMeta}>
                <MaterialCommunityIcons name="link-variant" size={18} color={accentColor} />
                <View style={styles.resourceTextWrap}>
                  <Text style={styles.resourceTitle}>{resource.title}</Text>
                  {resource.description ? <Text style={styles.resourceSubtitle}>{resource.description}</Text> : null}
                </View>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
          {attachments.map((attachment) => (
            <TouchableOpacity
              key={`attachment-${attachment.id}`}
              style={styles.resourceItem}
              onPress={() => {
                void openUrl(attachment.file_url);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.resourceMeta}>
                <MaterialCommunityIcons name="paperclip" size={18} color={accentColor} />
                <View style={styles.resourceTextWrap}>
                  <Text style={styles.resourceTitle}>{attachment.file_name}</Text>
                  <Text style={styles.resourceSubtitle}>{attachment.file_type}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="download-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </GlassCard>
      )}

      <TouchableOpacity
        style={[styles.completeButton, completeMutation.isPending && styles.completeButtonDisabled]}
        onPress={() => completeMutation.mutate()}
        activeOpacity={0.85}
        disabled={completeMutation.isPending}
      >
        <MaterialCommunityIcons name="check-circle-outline" size={20} color="#ffffff" />
        <Text style={styles.completeButtonText}>
          {completeMutation.isPending ? 'Saving...' : 'Mark as complete'}
        </Text>
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
      paddingBottom: 48,
      gap: 14,
    },
    stateContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 24,
      backgroundColor: theme.background,
    },
    stateTitle: {
      ...theme.typography.h3,
      color: theme.text,
    },
    stateText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    heroCard: {
      padding: 18,
      borderRadius: 28,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    heroIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.68)',
    },
    lessonTitle: {
      ...theme.typography.h2,
      color: theme.text,
    },
    lessonSubtitle: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    badge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
    },
    badgeText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    progressTrack: {
      marginTop: 16,
      height: 7,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    progressLabel: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 8,
      fontWeight: '700',
    },
    mediaCard: {
      padding: 16,
      borderRadius: 24,
    },
    contentCard: {
      padding: 18,
      borderRadius: 24,
    },
    notesCard: {
      padding: 18,
      borderRadius: 24,
    },
    resourceCard: {
      padding: 18,
      borderRadius: 24,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.text,
      marginBottom: 12,
    },
    bodyText: {
      ...theme.typography.body,
      color: theme.textSecondary,
      lineHeight: 24,
    },
    video: {
      width: '100%',
      height: 220,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
    notesInput: {
      minHeight: 120,
      borderRadius: 18,
      padding: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.58)',
      color: theme.text,
      ...theme.typography.body,
    },
    helperText: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 10,
      lineHeight: 18,
    },
    resourceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    resourceMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      paddingRight: 10,
    },
    resourceTextWrap: {
      flex: 1,
    },
    resourceTitle: {
      ...theme.typography.body,
      color: theme.text,
      fontWeight: '600',
    },
    resourceSubtitle: {
      ...theme.typography.caption,
      color: theme.textSecondary,
      marginTop: 3,
    },
    completeButton: {
      minHeight: 54,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
      backgroundColor: theme.colors.primary500,
      ...theme.shadows.lg,
    },
    completeButtonDisabled: {
      opacity: 0.65,
    },
    completeButtonText: {
      ...theme.typography.button,
      color: '#ffffff',
    },
  });
