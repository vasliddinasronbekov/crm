// ==========================================
// MOBILE STORAGE ADAPTER
// Uses Expo SecureStore for React Native
// ==========================================

import type { StorageAdapter } from './auth-storage'

// This will be imported only in React Native apps
let SecureStore: any

// Try to import SecureStore if available (React Native environment)
try {
  SecureStore = require('expo-secure-store')
} catch (error) {
  // Not in React Native environment, will fallback to AsyncStorage
}

export class MobileSecureStorage implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      if (SecureStore) {
        return await SecureStore.getItemAsync(key)
      }
      // Fallback to AsyncStorage if SecureStore not available
      const AsyncStorage = require('@react-native-async-storage/async-storage').default
      return await AsyncStorage.getItem(key)
    } catch (error) {
      console.error('Failed to get item from storage:', error)
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (SecureStore) {
        await SecureStore.setItemAsync(key, value)
      } else {
        // Fallback to AsyncStorage if SecureStore not available
        const AsyncStorage = require('@react-native-async-storage/async-storage').default
        await AsyncStorage.setItem(key, value)
      }
    } catch (error) {
      console.error('Failed to set item in storage:', error)
      throw error
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (SecureStore) {
        await SecureStore.deleteItemAsync(key)
      } else {
        // Fallback to AsyncStorage if SecureStore not available
        const AsyncStorage = require('@react-native-async-storage/async-storage').default
        await AsyncStorage.removeItem(key)
      }
    } catch (error) {
      console.error('Failed to remove item from storage:', error)
      throw error
    }
  }
}
