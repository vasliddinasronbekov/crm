/**
 * Login Screen
 *
 * Allows parents to authenticate with their email and password
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  isBiometricSupported,
  isBiometricEnabled,
  authenticateWithBiometrics,
  getBiometricType,
} from '../services/biometric';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const supported = await isBiometricSupported();
    const enabled = await isBiometricEnabled();

    if (supported && enabled) {
      setBiometricAvailable(true);
      const type = await getBiometricType();
      setBiometricType(type);

      // Auto-trigger biometric on mount if credentials are saved
      const savedEmail = await AsyncStorage.getItem('saved_email');
      if (savedEmail) {
        handleBiometricLogin();
      }
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await authenticateWithBiometrics();

      if (result.success) {
        // Retrieve saved credentials
        const savedEmail = await AsyncStorage.getItem('saved_email');
        const savedPassword = await AsyncStorage.getItem('saved_password');

        if (savedEmail && savedPassword) {
          setLoading(true);
          await login(savedEmail, savedPassword);
        } else {
          Alert.alert('Error', 'No saved credentials found');
        }
      } else {
        Alert.alert('Authentication Failed', result.error || 'Please try again');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Biometric authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);

      // Save credentials for biometric login (encrypted storage would be better in production)
      const supported = await isBiometricSupported();
      if (supported) {
        await AsyncStorage.setItem('saved_email', email);
        await AsyncStorage.setItem('saved_password', password);
      }

      // Navigation will happen automatically via AuthContext state change
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Parent Portal</Text>
          <Text style={styles.subtitle}>Welcome back! Track your child's progress</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="parent@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          {biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Text style={styles.biometricIcon}>
                {biometricType === 'Face ID' ? '👤' : '👆'}
              </Text>
              <Text style={styles.biometricText}>
                Login with {biometricType}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity>
            <Text style={styles.signupLink}>Contact school admin</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  biometricIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  biometricText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 8,
  },
  signupLink: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
});
