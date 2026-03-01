/**
 * Biometric Authentication Service
 *
 * Handles Face ID / Touch ID authentication
 */

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

/**
 * Check if device supports biometric authentication
 */
export async function isBiometricSupported(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Get available biometric types (Face ID, Touch ID, etc.)
 */
export async function getBiometricType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID';
  } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris Recognition';
  }

  return 'Biometric';
}

/**
 * Authenticate with biometrics
 */
export async function authenticateWithBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: result.error || 'Authentication failed',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Authentication error',
    };
  }
}

/**
 * Check if biometric authentication is enabled by user
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return enabled === 'true';
}

/**
 * Enable biometric authentication
 */
export async function enableBiometric(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
}

/**
 * Disable biometric authentication
 */
export async function disableBiometric(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
}

/**
 * Prompt user to enable biometric authentication
 */
export async function promptEnableBiometric(): Promise<boolean> {
  const supported = await isBiometricSupported();
  if (!supported) return false;

  const result = await authenticateWithBiometrics();
  if (result.success) {
    await enableBiometric();
    return true;
  }

  return false;
}
