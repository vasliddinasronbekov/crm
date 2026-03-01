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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';

interface Event {
  id: number;
  title: string;
  description?: string;
  time: string;
  location?: string;
  event_type?: string;
  capacity?: number;
  registered_count?: number;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await apiService.getEvents();
      setEvents(data.results || data || []);
    } catch (error: any) {
      console.error('Failed to load events:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load events.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadEvents();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventTypeIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'lecture':
        return '📚';
      case 'exam':
        return '📝';
      case 'workshop':
        return '🛠️';
      case 'seminar':
        return '🎓';
      case 'meeting':
        return '👥';
      case 'competition':
        return '🏆';
      default:
        return '📅';
    }
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const isPast = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  const upcomingEvents = events.filter((e) => isUpcoming(e.time));
  const pastEvents = events.filter((e) => isPast(e.time));

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
        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {upcomingEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => {
                  setSelectedEvent(event);
                  setModalVisible(true);
                }}
              >
                <LinearGradient
                  colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                  style={styles.eventGradient}
                >
                  <View style={styles.eventDate}>
                    <LinearGradient
                      colors={['#00d4ff', '#0099cc']}
                      style={styles.eventDateGradient}
                    >
                      <Text style={styles.eventDay}>
                        {new Date(event.time).getDate()}
                      </Text>
                      <Text style={styles.eventMonth}>
                        {new Date(event.time).toLocaleDateString('en-US', {
                          month: 'short',
                        })}
                      </Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventIcon}>
                        {getEventTypeIcon(event.event_type)}
                      </Text>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                    </View>
                    <Text style={styles.eventTime}>{formatTime(event.time)}</Text>
                    {event.location && (
                      <Text style={styles.eventLocation}>📍 {event.location}</Text>
                    )}
                    {event.capacity && event.registered_count !== undefined && (
                      <Text style={styles.eventCapacity}>
                        {event.registered_count}/{event.capacity} registered
                      </Text>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Past Events</Text>
            {pastEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => {
                  setSelectedEvent(event);
                  setModalVisible(true);
                }}
              >
                <LinearGradient
                  colors={['rgba(100, 116, 139, 0.1)', 'rgba(100, 116, 139, 0.05)']}
                  style={styles.eventGradient}
                >
                  <View style={styles.eventDate}>
                    <LinearGradient
                      colors={['#64748b', '#475569']}
                      style={styles.eventDateGradient}
                    >
                      <Text style={styles.eventDay}>
                        {new Date(event.time).getDate()}
                      </Text>
                      <Text style={styles.eventMonth}>
                        {new Date(event.time).toLocaleDateString('en-US', {
                          month: 'short',
                        })}
                      </Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventIcon}>
                        {getEventTypeIcon(event.event_type)}
                      </Text>
                      <Text style={[styles.eventTitle, { color: '#94a3b8' }]}>
                        {event.title}
                      </Text>
                    </View>
                    <Text style={[styles.eventTime, { color: '#64748b' }]}>
                      {formatTime(event.time)}
                    </Text>
                    {event.location && (
                      <Text style={[styles.eventLocation, { color: '#64748b' }]}>
                        📍 {event.location}
                      </Text>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No events scheduled</Text>
          </View>
        )}
      </ScrollView>

      {/* Event Details Modal */}
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
                <Text style={styles.modalTitle}>Event Details</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedEvent && (
                <ScrollView style={styles.modalBody}>
                  <View style={styles.modalEventIcon}>
                    <Text style={styles.modalEventIconText}>
                      {getEventTypeIcon(selectedEvent.event_type)}
                    </Text>
                  </View>

                  <Text style={styles.modalEventTitle}>{selectedEvent.title}</Text>

                  <View style={styles.modalDetails}>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>📅 Date</Text>
                      <Text style={styles.modalDetailValue}>
                        {formatDate(selectedEvent.time)}
                      </Text>
                    </View>

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>🕐 Time</Text>
                      <Text style={styles.modalDetailValue}>
                        {formatTime(selectedEvent.time)}
                      </Text>
                    </View>

                    {selectedEvent.location && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>📍 Location</Text>
                        <Text style={styles.modalDetailValue}>
                          {selectedEvent.location}
                        </Text>
                      </View>
                    )}

                    {selectedEvent.event_type && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>🏷️ Type</Text>
                        <Text style={styles.modalDetailValue}>
                          {selectedEvent.event_type.charAt(0).toUpperCase() +
                            selectedEvent.event_type.slice(1)}
                        </Text>
                      </View>
                    )}

                    {selectedEvent.capacity && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>👥 Capacity</Text>
                        <Text style={styles.modalDetailValue}>
                          {selectedEvent.registered_count || 0}/
                          {selectedEvent.capacity}
                        </Text>
                      </View>
                    )}
                  </View>

                  {selectedEvent.description && (
                    <View style={styles.descriptionContainer}>
                      <Text style={styles.descriptionLabel}>Description</Text>
                      <Text style={styles.descriptionText}>
                        {selectedEvent.description}
                      </Text>
                    </View>
                  )}

                  {isUpcoming(selectedEvent.time) && (
                    <View style={styles.statusBanner}>
                      <LinearGradient
                        colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                        style={styles.statusBannerGradient}
                      >
                        <Text style={styles.statusBannerText}>
                          ✓ Upcoming Event
                        </Text>
                      </LinearGradient>
                    </View>
                  )}
                </ScrollView>
              )}
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
    paddingBottom: 40,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  eventCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  eventGradient: {
    flexDirection: 'row',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  eventDate: {
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventDateGradient: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  eventDay: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  eventMonth: {
    fontSize: 11,
    color: '#fff',
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  eventTime: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  eventCapacity: {
    fontSize: 11,
    color: '#00d4ff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
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
  modalEventIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalEventIconText: {
    fontSize: 40,
  },
  modalEventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalDetails: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalDetailRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalDetailLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
  },
  modalDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  statusBanner: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusBannerGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
});
