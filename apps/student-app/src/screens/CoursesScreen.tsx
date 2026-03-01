import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';

// Types
interface Course {
  id: number;
  title: string;
  description: string;
  instructor?: string;
  level?: string;
  duration?: number;
  lessons_count?: number;
  is_enrolled?: boolean;
  progress?: number;
}

interface CourseModule {
  id: number;
  title: string;
  description: string;
  order: number;
  lessons_count?: number;
  is_completed?: boolean;
}

export default function CoursesScreen({ navigation }: any) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseModules, setCourseModules] = useState<CourseModule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingModules, setLoadingModules] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Load courses from backend
  const loadCourses = async () => {
    try {
      const response = await apiService.getCourses();
      const coursesData = response.results || response || [];
      // Ensure we always set an array
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    } catch (error: any) {
      console.error('Error loading courses:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load courses. Please try again.'
      );
      // Ensure courses is an empty array on error
      setCourses([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load course details and modules
  const loadCourseDetails = async (course: Course) => {
    setSelectedCourse(course);
    setModalVisible(true);
    setLoadingModules(true);

    try {
      const [details, modules] = await Promise.all([
        apiService.getCourseDetails(course.id),
        apiService.getCourseModules(course.id),
      ]);

      setSelectedCourse({ ...course, ...details });
      setCourseModules(modules.results || modules || []);
    } catch (error: any) {
      console.error('Error loading course details:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load course details.'
      );
    } finally {
      setLoadingModules(false);
    }
  };

  // Enroll in course
  const handleEnroll = async (courseId: number) => {
    setActionLoading(true);

    try {
      await apiService.enrollCourse(courseId);
      Alert.alert('Success', 'Successfully enrolled in course!');

      // Update local state
      setCourses((prevCourses) =>
        prevCourses.map((c) =>
          c.id === courseId ? { ...c, is_enrolled: true, progress: 0 } : c
        )
      );

      if (selectedCourse?.id === courseId) {
        setSelectedCourse((prev) => prev ? { ...prev, is_enrolled: true, progress: 0 } : null);
      }

      setModalVisible(false);
    } catch (error: any) {
      console.error('Error enrolling in course:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to enroll in course. Please try again.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Unenroll from course
  const handleUnenroll = async (courseId: number) => {
    Alert.alert(
      'Confirm Unenroll',
      'Are you sure you want to unenroll from this course? Your progress will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unenroll',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);

            try {
              await apiService.unenrollCourse(courseId);
              Alert.alert('Success', 'Successfully unenrolled from course.');

              // Update local state
              setCourses((prevCourses) =>
                prevCourses.map((c) =>
                  c.id === courseId ? { ...c, is_enrolled: false } : c
                )
              );

              if (selectedCourse?.id === courseId) {
                setSelectedCourse((prev) => prev ? { ...prev, is_enrolled: false } : null);
              }

              setModalVisible(false);
            } catch (error: any) {
              console.error('Error unenrolling from course:', error);
              Alert.alert(
                'Error',
                error?.response?.data?.message || 'Failed to unenroll from course.'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    loadCourses();
  }, []);

  // Pull to refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    loadCourses();
  };

  // Render course card
  const renderCourse = ({ item }: { item: Course }) => (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={() => loadCourseDetails(item)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.courseGradient}
      >
        <View style={styles.courseHeader}>
          <Text style={styles.courseTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.is_enrolled && (
            <View style={styles.enrolledBadge}>
              <Text style={styles.enrolledText}>Enrolled</Text>
            </View>
          )}
        </View>

        {item.description && (
          <Text style={styles.courseDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.courseMetaRow}>
          {item.instructor && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Instructor:</Text>
              <Text style={styles.metaValue}>{item.instructor}</Text>
            </View>
          )}
          {item.level && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Level:</Text>
              <Text style={styles.metaValue}>{item.level}</Text>
            </View>
          )}
        </View>

        {item.is_enrolled && typeof item.progress === 'number' && (
          <>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${item.progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{item.progress}% Complete</Text>
          </>
        )}

        <View style={styles.lessonsRow}>
          <Text style={styles.lessonsText}>
            {item.lessons_count || 0} Lessons
          </Text>
          {item.duration && (
            <Text style={styles.durationText}>{item.duration} hours</Text>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  // Render module item
  const renderModule = ({ item }: { item: CourseModule }) => (
    <View style={styles.moduleCard}>
      <View style={styles.moduleHeader}>
        <View style={styles.moduleNumberContainer}>
          <Text style={styles.moduleNumber}>{item.order}</Text>
        </View>
        <View style={styles.moduleContent}>
          <Text style={styles.moduleTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.moduleDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <Text style={styles.moduleLessons}>
            {item.lessons_count || 0} lessons
          </Text>
        </View>
        {item.is_completed && (
          <View style={styles.completedIcon}>
            <Text style={styles.completedText}>✓</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading courses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Courses</Text>
        <Text style={styles.subtitle}>
          {courses.filter((c) => c.is_enrolled).length} enrolled • {courses.length} total
        </Text>
      </View>

      {courses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No courses available</Text>
          <Text style={styles.emptySubtext}>Check back later for new courses</Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#00d4ff"
              colors={['#00d4ff']}
            />
          }
        />
      )}

      {/* Course Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Course Details</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedCourse && (
              <>
                <View style={styles.detailsCard}>
                  <Text style={styles.detailsTitle}>{selectedCourse.title}</Text>

                  {selectedCourse.description && (
                    <Text style={styles.detailsDescription}>
                      {selectedCourse.description}
                    </Text>
                  )}

                  <View style={styles.detailsMetaGrid}>
                    {selectedCourse.instructor && (
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Instructor</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedCourse.instructor}
                        </Text>
                      </View>
                    )}
                    {selectedCourse.level && (
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Level</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedCourse.level}
                        </Text>
                      </View>
                    )}
                    {selectedCourse.duration && (
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Duration</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedCourse.duration} hours
                        </Text>
                      </View>
                    )}
                    {selectedCourse.lessons_count !== undefined && (
                      <View style={styles.detailsMetaItem}>
                        <Text style={styles.detailsMetaLabel}>Lessons</Text>
                        <Text style={styles.detailsMetaValue}>
                          {selectedCourse.lessons_count}
                        </Text>
                      </View>
                    )}
                  </View>

                  {selectedCourse.is_enrolled && typeof selectedCourse.progress === 'number' && (
                    <View style={styles.detailsProgressContainer}>
                      <Text style={styles.detailsProgressLabel}>Your Progress</Text>
                      <View style={styles.detailsProgressBar}>
                        <View
                          style={[
                            styles.detailsProgressFill,
                            { width: `${selectedCourse.progress}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.detailsProgressText}>
                        {selectedCourse.progress}% Complete
                      </Text>
                    </View>
                  )}
                </View>

                {/* Course Modules */}
                <View style={styles.modulesSection}>
                  <Text style={styles.modulesSectionTitle}>Course Modules</Text>

                  {loadingModules ? (
                    <View style={styles.modulesLoading}>
                      <ActivityIndicator size="small" color="#00d4ff" />
                      <Text style={styles.modulesLoadingText}>Loading modules...</Text>
                    </View>
                  ) : courseModules.length === 0 ? (
                    <Text style={styles.noModulesText}>No modules available yet</Text>
                  ) : (
                    <FlatList
                      data={courseModules}
                      renderItem={renderModule}
                      keyExtractor={(item) => item.id.toString()}
                      scrollEnabled={false}
                    />
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {selectedCourse.is_enrolled ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.continueButton]}
                        onPress={() => {
                          setModalVisible(false);
                          navigation.navigate('Lessons', { courseId: selectedCourse.id });
                        }}
                      >
                        <LinearGradient
                          colors={['#00d4ff', '#0099cc']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.gradientButton}
                        >
                          <Text style={styles.actionButtonText}>Continue Learning</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.unenrollButton]}
                        onPress={() => handleUnenroll(selectedCourse.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator size="small" color="#ff4444" />
                        ) : (
                          <Text style={styles.unenrollButtonText}>Unenroll</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.enrollButton]}
                      onPress={() => handleEnroll(selectedCourse.id)}
                      disabled={actionLoading}
                    >
                      <LinearGradient
                        colors={['#00d4ff', '#0099cc']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                      >
                        {actionLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.actionButtonText}>Enroll Now</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </ScrollView>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  list: {
    padding: 20,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  courseCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  courseGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 16,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  enrolledBadge: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  enrolledText: {
    color: '#00d4ff',
    fontSize: 11,
    fontWeight: '600',
  },
  courseDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 20,
  },
  courseMetaRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    marginRight: 16,
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748b',
    marginRight: 4,
  },
  metaValue: {
    fontSize: 12,
    color: '#00d4ff',
    fontWeight: '600',
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00d4ff',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  lessonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lessonsText: {
    fontSize: 13,
    color: '#00d4ff',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  detailsDescription: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 20,
  },
  detailsMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detailsMetaItem: {
    width: '50%',
    marginBottom: 12,
  },
  detailsMetaLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  detailsMetaValue: {
    fontSize: 16,
    color: '#00d4ff',
    fontWeight: '600',
  },
  detailsProgressContainer: {
    marginTop: 8,
  },
  detailsProgressLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  detailsProgressBar: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  detailsProgressFill: {
    height: '100%',
    backgroundColor: '#00d4ff',
    borderRadius: 4,
  },
  detailsProgressText: {
    fontSize: 12,
    color: '#00d4ff',
    fontWeight: '600',
  },
  modulesSection: {
    marginBottom: 100,
  },
  modulesSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  modulesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  modulesLoadingText: {
    color: '#94a3b8',
    marginLeft: 12,
    fontSize: 14,
  },
  noModulesText: {
    color: '#64748b',
    fontSize: 14,
    fontStyle: 'italic',
    padding: 20,
    textAlign: 'center',
  },
  moduleCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  moduleNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  moduleNumber: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  moduleContent: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  moduleDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    lineHeight: 18,
  },
  moduleLessons: {
    fontSize: 12,
    color: '#64748b',
  },
  completedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  completedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  enrollButton: {
    marginBottom: 0,
  },
  continueButton: {
    marginBottom: 12,
  },
  unenrollButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ff4444',
    padding: 16,
    alignItems: 'center',
    marginBottom: 0,
  },
  unenrollButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  gradientButton: {
    padding: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
