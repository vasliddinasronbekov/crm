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

interface Group {
  id: number;
  name: string;
  description?: string;
  course?: {
    id: number;
    title: string;
  };
  students_count?: number;
  created_at?: string;
}

interface GroupMember {
  id: number;
  user: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  joined_at?: string;
}

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await apiService.getGroups();
      setGroups(data.results || data || []);
    } catch (error: any) {
      console.error('Failed to load groups:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load groups.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadGroupDetails = async (group: Group) => {
    setSelectedGroup(group);
    setModalVisible(true);
    setLoadingMembers(true);

    try {
      const [details, members] = await Promise.all([
        apiService.getGroupDetails(group.id),
        apiService.getGroupMembers(group.id),
      ]);

      setSelectedGroup(details);
      setGroupMembers(members.results || members || []);
    } catch (error: any) {
      console.error('Failed to load group details:', error);
      Alert.alert('Error', 'Failed to load group details.');
    } finally {
      setLoadingMembers(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadGroups();
  };

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    if (username) {
      return username.substring(0, 2).toUpperCase();
    }
    return '??';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading groups...</Text>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Groups</Text>
          <Text style={styles.headerSubtitle}>{groups.length} groups</Text>
        </View>

        {/* Groups List */}
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No groups found</Text>
            <Text style={styles.emptySubtext}>
              You haven't been added to any groups yet
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              onPress={() => loadGroupDetails(group)}
            >
              <LinearGradient
                colors={['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']}
                style={styles.groupGradient}
              >
                <View style={styles.groupHeader}>
                  <View style={styles.groupIconContainer}>
                    <LinearGradient
                      colors={['#00d4ff', '#0099cc']}
                      style={styles.groupIcon}
                    >
                      <Text style={styles.groupIconText}>
                        {group.name.substring(0, 2).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    {group.course && (
                      <Text style={styles.groupCourse}>
                        📚 {group.course.title}
                      </Text>
                    )}
                    {group.description && (
                      <Text style={styles.groupDescription} numberOfLines={2}>
                        {group.description}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.groupFooter}>
                  <View style={styles.groupStat}>
                    <Text style={styles.groupStatIcon}>👥</Text>
                    <Text style={styles.groupStatText}>
                      {group.students_count || 0} members
                    </Text>
                  </View>
                  <View style={styles.viewButton}>
                    <Text style={styles.viewButtonText}>View →</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Group Details Modal */}
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
                <Text style={styles.modalTitle}>
                  {selectedGroup?.name || 'Group Details'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {selectedGroup && (
                  <>
                    {/* Group Info */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Information</Text>
                      {selectedGroup.course && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Course</Text>
                          <Text style={styles.detailValue}>
                            {selectedGroup.course.title}
                          </Text>
                        </View>
                      )}
                      {selectedGroup.description && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Description</Text>
                          <Text style={styles.detailValue}>
                            {selectedGroup.description}
                          </Text>
                        </View>
                      )}
                      {selectedGroup.created_at && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Created</Text>
                          <Text style={styles.detailValue}>
                            {formatDate(selectedGroup.created_at)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Members */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>
                        Members ({groupMembers.length})
                      </Text>

                      {loadingMembers ? (
                        <View style={styles.loadingMembers}>
                          <ActivityIndicator size="small" color="#00d4ff" />
                          <Text style={styles.loadingMembersText}>
                            Loading members...
                          </Text>
                        </View>
                      ) : groupMembers.length === 0 ? (
                        <Text style={styles.noMembers}>No members found</Text>
                      ) : (
                        groupMembers.map((member) => (
                          <View key={member.id} style={styles.memberCard}>
                            <LinearGradient
                              colors={[
                                'rgba(0, 212, 255, 0.1)',
                                'rgba(0, 212, 255, 0.05)',
                              ]}
                              style={styles.memberGradient}
                            >
                              <View style={styles.memberAvatar}>
                                <LinearGradient
                                  colors={['#00d4ff', '#0099cc']}
                                  style={styles.memberAvatarGradient}
                                >
                                  <Text style={styles.memberAvatarText}>
                                    {getInitials(
                                      member.user.first_name,
                                      member.user.last_name,
                                      member.user.username
                                    )}
                                  </Text>
                                </LinearGradient>
                              </View>
                              <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>
                                  {member.user.first_name && member.user.last_name
                                    ? `${member.user.first_name} ${member.user.last_name}`
                                    : member.user.username}
                                </Text>
                                {member.user.email && (
                                  <Text style={styles.memberEmail}>
                                    {member.user.email}
                                  </Text>
                                )}
                                {member.joined_at && (
                                  <Text style={styles.memberJoined}>
                                    Joined {formatDate(member.joined_at)}
                                  </Text>
                                )}
                              </View>
                            </LinearGradient>
                          </View>
                        ))
                      )}
                    </View>
                  </>
                )}
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
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  groupCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  groupIconContainer: {
    marginRight: 12,
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  groupCourse: {
    fontSize: 13,
    color: '#00d4ff',
    marginBottom: 6,
  },
  groupDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  groupStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupStatIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  groupStatText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  viewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
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
    flex: 1,
  },
  modalClose: {
    fontSize: 28,
    color: '#94a3b8',
    fontWeight: '300',
  },
  modalBody: {
    maxHeight: 600,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  loadingMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingMembersText: {
    color: '#94a3b8',
    marginLeft: 12,
    fontSize: 14,
  },
  noMembers: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  memberCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  memberGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  memberAvatar: {
    marginRight: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  memberAvatarGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  memberJoined: {
    fontSize: 11,
    color: '#64748b',
  },
});
