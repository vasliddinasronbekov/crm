import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getErrorMessage, studentAuthApi, useTheme } from '@eduvoice/mobile-shared';

export const LoginScreen = () => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = async () => {
    const normalizedUsername = username.trim();
    const normalizedPassword = password;

    if (normalizedUsername.length === 0 || normalizedPassword.length === 0) {
      Alert.alert(t('common.error'), t('auth.enterUsernameAndPassword'));
      return;
    }

    setIsLoading(true);
    try {
      await studentAuthApi.login({
        username: normalizedUsername,
        password: normalizedPassword,
      });
    } catch (error: any) {
      console.error('Login failed:', error);
      const errorMessage = getErrorMessage(error);
      Alert.alert(t('auth.loginFailed'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.bgBlobTop} pointerEvents="none" />
      <View style={styles.bgBlobBottom} pointerEvents="none" />

      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="school-outline" size={30} color={theme.colors.primary500} />
          </View>
          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('auth.signInToAccount')}</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>{t('common.username')}</Text>
            <TextInput
              placeholder={t('common.username')}
              placeholderTextColor={theme.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              editable={!isLoading}
              style={styles.input}
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>{t('common.password')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                placeholder={t('common.password')}
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                editable={!isLoading}
                style={styles.passwordInput}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.passwordToggle}
                disabled={isLoading}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => {
              void handleLogin();
            }}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && !isLoading ? styles.loginButtonPressed : null,
              isLoading ? styles.loginButtonDisabled : null,
            ]}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? t('auth.loggingIn') : t('common.login')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.helper}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={16}
            color={theme.colors.primary500}
          />
          <Text style={styles.helperText}>Student workspace access</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    bgBlobTop: {
      position: 'absolute',
      top: -120,
      right: -90,
      width: 280,
      height: 280,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(191,219,254,0.75)',
    },
    bgBlobBottom: {
      position: 'absolute',
      bottom: -110,
      left: -100,
      width: 260,
      height: 260,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(22,163,74,0.12)' : 'rgba(220,252,231,0.76)',
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xxl,
    },
    hero: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    heroIcon: {
      width: 68,
      height: 68,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(219,234,254,0.9)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(147,197,253,0.35)' : 'rgba(147,197,253,0.55)',
      marginBottom: theme.spacing.md,
    },
    title: {
      color: theme.text,
      fontSize: 32,
      fontWeight: '800',
      textAlign: 'center',
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
    },
    formCard: {
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.94)',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.28)',
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      ...theme.shadows.lg,
    },
    inputBlock: {
      gap: theme.spacing.sm,
    },
    inputLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 2,
    },
    input: {
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(2,6,23,0.36)' : 'rgba(248,250,252,0.85)',
      color: theme.text,
      paddingHorizontal: 14,
      fontSize: 15,
      fontWeight: '500',
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: isDark ? 'rgba(2,6,23,0.36)' : 'rgba(248,250,252,0.85)',
      paddingRight: 8,
    },
    passwordInput: {
      flex: 1,
      color: theme.text,
      paddingHorizontal: 14,
      fontSize: 15,
      fontWeight: '500',
    },
    passwordToggle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginButton: {
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
      backgroundColor: theme.colors.primary500,
      ...theme.shadows.md,
    },
    loginButtonPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.995 }],
    },
    loginButtonDisabled: {
      opacity: 0.72,
    },
    loginButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    helper: {
      marginTop: theme.spacing.lg,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(30,41,59,0.62)' : 'rgba(255,255,255,0.74)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.24)',
    },
    helperText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
  });
