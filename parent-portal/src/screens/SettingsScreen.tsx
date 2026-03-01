/**
 * Settings Screen
 *
 * App settings including theme, biometric, notifications
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  isBiometricSupported,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  getBiometricType,
  authenticateWithBiometrics,
} from '../services/biometric';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const { user, logout } = useAuth();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const supported = await isBiometricSupported();
    setBiometricAvailable(supported);

    if (supported) {
      const enabled = await isBiometricEnabled();
      setBiometricEnabled(enabled);

      const type = await getBiometricType();
      setBiometricType(type);
    }
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Enable biometric
      const result = await authenticateWithBiometrics();
      if (result.success) {
        await enableBiometric();
        setBiometricEnabled(true);
        Alert.alert('Success', `${biometricType} enabled successfully`);
      } else {
        Alert.alert('Failed', `Could not enable ${biometricType}`);
      }
    } else {
      // Disable biometric
      await disableBiometric();
      setBiometricEnabled(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: theme.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Info */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Account</Text>
          <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
            <Text style={[styles.value, { color: theme.text }]}>
              {user?.first_name} {user?.last_name}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
            <Text style={[styles.value, { color: theme.text }]}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Role</Text>
            <Text style={[styles.value, { color: theme.text }]}>{user?.role}</Text>
          </View>
        </View>

        {/* Theme Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>

          <TouchableOpacity
            style={[styles.row, { borderBottomColor: theme.border }]}
            onPress={() => handleThemeModeChange('light')}
          >
            <Text style={[styles.rowLabel, { color: theme.text }]}>Light Mode</Text>
            {themeMode === 'light' && (
              <Text style={{ color: theme.primary, fontSize: 18 }}>✓</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, { borderBottomColor: theme.border }]}
            onPress={() => handleThemeModeChange('dark')}
          >
            <Text style={[styles.rowLabel, { color: theme.text }]}>Dark Mode</Text>
            {themeMode === 'dark' && (
              <Text style={{ color: theme.primary, fontSize: 18 }}>✓</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => handleThemeModeChange('system')}
          >
            <Text style={[styles.rowLabel, { color: theme.text }]}>System Default</Text>
            {themeMode === 'system' && (
              <Text style={{ color: theme.primary, fontSize: 18 }}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security Settings */}
        {biometricAvailable && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Security</Text>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>
                  {biometricType}
                </Text>
                <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
                  Use {biometricType} to unlock the app
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: theme.borderLight, true: theme.primaryLight }}
                thumbColor={biometricEnabled ? theme.primary : theme.textTertiary}
              />
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={[styles.row, styles.logoutRow]}
            onPress={() => {
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', style: 'destructive', onPress: logout },
                ]
              );
            }}
          >
            <Text style={[styles.rowLabel, { color: theme.error }]}>Logout</Text>
            <Text style={{ color: theme.error, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: theme.textTertiary }]}>
            Parent Portal v1.0.0
          </Text>
          <Text style={[styles.appInfoText, { color: theme.textTertiary }]}>
            EduVoice Platform
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  logoutRow: {
    borderBottomWidth: 0,
  },
  appInfo: {
    alignItems: 'center',
    padding: 32,
  },
  appInfoText: {
    fontSize: 12,
    marginTop: 4,
  },
});
