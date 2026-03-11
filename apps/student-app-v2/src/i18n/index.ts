/**
 * i18n Configuration
 * Multi-language support for EDUOS Student App App
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations
import en from './locales/en.json';
import ru from './locales/ru.json';
import uz from './locales/uz.json';
import tr from './locales/tr.json';

const LANGUAGE_STORAGE_KEY = '@eduvoice_language';

// Language detector
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        callback(savedLanguage);
      } else {
        // Default to English
        callback('en');
      }
    } catch (error) {
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3' as any, // v3 is required for React Native
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      uz: { translation: uz },
      tr: { translation: tr },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Helper to change language
export const changeLanguage = async (language: string) => {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
};

// Helper to get current language
export const getCurrentLanguage = () => i18n.language;

// Available languages
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'uz', name: 'Uzbek', nativeName: 'O\'zbek' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
];
