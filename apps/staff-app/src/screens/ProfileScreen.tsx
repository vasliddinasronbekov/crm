import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const menuItems = [
    { icon: '👥', title: 'My Groups', screen: 'Groups' },
    { icon: '✅', title: 'Attendance', screen: 'Attendance' },
    { icon: '📊', title: 'Grades', screen: 'Grades' },
    { icon: '📋', title: 'My Tasks', screen: 'Tasks' },
    { icon: '💰', title: 'Salary', screen: 'Salary' },
    { icon: '📅', title: 'Schedule', screen: 'Schedule' },
    { icon: '🧪', title: 'Quizzes', screen: 'Quizzes' },
    { icon: '⚙️', title: 'Settings', screen: 'Settings' },
  ];

  // Add admin items if user is admin
  if (isAdmin) {
    menuItems.push(
      { icon: '📈', title: 'Analytics', screen: 'Analytics' },
      { icon: '🎯', title: 'CRM', screen: 'CRM' }
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.photo ? (
            <Image source={{ uri: user.photo }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>
          {user?.first_name && user?.last_name
            ? `${user.first_name} ${user.last_name}`
            : user?.username}
        </Text>

        {user?.phone && <Text style={styles.phone}>📱 {user.phone}</Text>}
        {user?.email && <Text style={styles.email}>✉️ {user.email}</Text>}

        <View style={styles.rolesContainer}>
          {user?.is_teacher && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Teacher</Text>
            </View>
          )}
          {user?.is_staff && (
            <View style={[styles.roleBadge, styles.roleBadgeAdmin]}>
              <Text style={styles.roleBadgeText}>Administrator</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              index === menuItems.length - 1 && styles.menuItemLast,
            ]}
            onPress={() => {
              if (item.screen) {
                navigation.navigate(item.screen);
              }
            }}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>Version 1.0.0 • EDU Admin</Text>
    </ScrollView>
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
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryAlpha20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  phone: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  rolesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  roleBadge: {
    backgroundColor: colors.badge.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roleBadgeAdmin: {
    backgroundColor: colors.badge.warning,
    borderColor: colors.warning,
  },
  roleBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  editButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  menuContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 18,
  },
  menuTitle: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 24,
    color: colors.textMuted,
  },
  logoutButton: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 16,
    marginBottom: 32,
  },
});
