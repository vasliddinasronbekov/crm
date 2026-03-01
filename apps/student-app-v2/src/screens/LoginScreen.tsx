// apps/student-app-v2/src/screens/LoginScreen.tsx

import React from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, TextInput, theme } from '@eduvoice/mobile-ui';
import { studentAuthApi, getErrorMessage } from '@eduvoice/mobile-shared';

export const LoginScreen = () => {
  const { t } = useTranslation();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert(t('common.error'), t('auth.enterUsernameAndPassword'));
      return;
    }

    setIsLoading(true);
    try {
      // studentAuthApi.login uses /api/v1/student-profile/login/ endpoint
      // Automatically updates authStore with tokens and user
      await studentAuthApi.login({ username, password });
      // Navigation to the main app stack will happen automatically
      // because isAuthenticated changes in the authStore
    } catch (error: any) {
      console.error('Login failed:', error);
      const errorMessage = getErrorMessage(error);
      Alert.alert(t('auth.loginFailed'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
      <Text style={styles.subtitle}>{t('auth.signInToAccount')}</Text>

      <View style={styles.form}>
        <TextInput
          placeholder={t('common.username')}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          editable={!isLoading}
        />
        <TextInput
          placeholder={t('common.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.passwordInput}
          editable={!isLoading}
        />
        <Button
          title={isLoading ? t('auth.loggingIn') : t('common.login')}
          onPress={handleLogin}
          disabled={isLoading}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
  },
  title: {
    ...theme.typography.h1,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body,
    textAlign: 'center',
    color: theme.colors.gray600,
    marginBottom: theme.spacing.xl,
  },
  form: {
    width: '100%',
  },
  passwordInput: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
});
