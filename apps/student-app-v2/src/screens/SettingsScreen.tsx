import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { studentAuthApi, useAuthStore, useTheme, useThemeStore } from '@eduvoice/mobile-shared';

import { changeLanguage, LANGUAGES } from '../i18n';
import { GlassCard } from '../components/app/GlassCard';

export const SettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { theme, isDark } = useTheme();
  const { mode, setMode } = useThemeStore();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const handleLogout = async () => {
    Alert.alert(t('auth.logoutConfirmTitle'), t('auth.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await studentAuthApi.logout();
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleLanguageChange = async (languageCode: string) => {
    await changeLanguage(languageCode);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>
            {(user?.full_name || 'S').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.heroTitle}>{t('settings.settings')}</Text>
        <Text style={styles.heroSubtitle}>{user?.full_name || t('settings.studentRole')}</Text>
        <Text style={styles.heroMeta}>{user?.email || 'student@eduvoice.app'}</Text>
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
        <Text style={styles.sectionSubtitle}>{t('settings.themeHint')}</Text>
      </View>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.optionRow}>
          <TouchableOpacity
            style={[styles.optionButton, mode === 'light' && styles.optionButtonActive]}
            onPress={() => setMode('light')}
          >
            <MaterialCommunityIcons
              name="white-balance-sunny"
              size={20}
              color={mode === 'light' ? theme.colors.primary500 : theme.textSecondary}
            />
            <Text style={[styles.optionText, mode === 'light' && styles.optionTextActive]}>
              {t('settings.lightMode')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, mode === 'dark' && styles.optionButtonActive]}
            onPress={() => setMode('dark')}
          >
            <MaterialCommunityIcons
              name="moon-waning-crescent"
              size={20}
              color={mode === 'dark' ? theme.colors.primary500 : theme.textSecondary}
            />
            <Text style={[styles.optionText, mode === 'dark' && styles.optionTextActive]}>
              {t('settings.darkMode')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, mode === 'system' && styles.optionButtonActive]}
            onPress={() => setMode('system')}
          >
            <MaterialCommunityIcons
              name="brightness-auto"
              size={20}
              color={mode === 'system' ? theme.colors.primary500 : theme.textSecondary}
            />
            <Text style={[styles.optionText, mode === 'system' && styles.optionTextActive]}>
              {t('settings.systemDefault')}
            </Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <Text style={styles.sectionSubtitle}>{t('settings.languageHint')}</Text>
      </View>

      <GlassCard style={styles.sectionCard}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={styles.languageRow}
            onPress={() => handleLanguageChange(lang.code)}
          >
            <View>
              <Text style={styles.languageName}>{lang.nativeName}</Text>
              <Text style={styles.languageMeta}>{lang.name}</Text>
            </View>
            {i18n.language === lang.code ? (
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={theme.colors.primary500}
              />
            ) : (
              <MaterialCommunityIcons
                name="circle-outline"
                size={20}
                color={theme.textSecondary}
              />
            )}
          </TouchableOpacity>
        ))}
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>
        <Text style={styles.sectionSubtitle}>{t('settings.account')}</Text>
      </View>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="account-outline"
            size={20}
            color={theme.colors.primary500}
          />
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>{t('settings.profile')}</Text>
            <Text style={styles.infoValue}>{user?.full_name || t('settings.studentRole')}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="email-outline"
            size={20}
            color={theme.colors.primary500}
          />
          <View style={styles.infoCopy}>
            <Text style={styles.infoLabel}>{t('common.email')}</Text>
            <Text style={styles.infoValue}>{user?.email || 'student@eduvoice.app'}</Text>
          </View>
        </View>
      </GlassCard>

      <TouchableOpacity
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        <MaterialCommunityIcons name="logout" size={20} color={theme.colors.white} />
        <Text style={styles.logoutText}>
          {isLoggingOut ? t('auth.loggingIn') : t('settings.signOut')}
        </Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>{t('settings.version', { version: '2.0.0' })}</Text>
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxxl,
      gap: theme.spacing.md,
    },
    heroCard: {
      padding: theme.spacing.lg,
      alignItems: 'center',
    },
    heroAvatar: {
      width: 72,
      height: 72,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.12)',
      marginBottom: theme.spacing.md,
    },
    heroAvatarText: {
      color: theme.colors.primary500,
      fontSize: 28,
      fontWeight: '800',
    },
    heroTitle: {
      color: theme.text,
      fontSize: 26,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      marginTop: theme.spacing.sm,
    },
    heroMeta: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: theme.spacing.xs,
    },
    sectionHeader: {
      marginTop: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    sectionSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    sectionCard: {
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    optionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    optionButton: {
      flex: 1,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)',
    },
    optionButtonActive: {
      borderColor: theme.colors.primary500,
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.08)',
    },
    optionText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    optionTextActive: {
      color: theme.colors.primary500,
    },
    languageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    languageName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    languageMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    infoCopy: {
      flex: 1,
    },
    infoLabel: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    infoValue: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    logoutButton: {
      marginTop: theme.spacing.md,
      borderRadius: 20,
      backgroundColor: theme.colors.error500,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      ...theme.shadows.md,
    },
    logoutButtonDisabled: {
      opacity: 0.7,
    },
    logoutText: {
      color: theme.colors.white,
      fontSize: 15,
      fontWeight: '800',
    },
    versionText: {
      color: theme.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
  });
