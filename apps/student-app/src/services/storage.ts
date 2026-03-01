import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      // Use localStorage on web
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('localStorage.getItem error:', error);
        return null;
      }
    }
    // Use SecureStore on native platforms
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      // Use localStorage on web
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('localStorage.setItem error:', error);
      }
      return;
    }
    // Use SecureStore on native platforms
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      // Use localStorage on web
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('localStorage.removeItem error:', error);
      }
      return;
    }
    // Use SecureStore on native platforms
    await SecureStore.deleteItemAsync(key);
  },
};

export default storage;