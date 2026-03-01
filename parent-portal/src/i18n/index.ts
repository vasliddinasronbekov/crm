/**
 * i18n Configuration
 *
 * Multi-language support for the Parent Portal app
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Translation resources
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import uz from './locales/uz.json';

const LANGUAGE_KEY = 'app_language';

// Get device language
const deviceLanguage = Localization.locale.split('-')[0]; // 'en-US' -> 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      uz: { translation: uz },
    },
    lng: deviceLanguage, // Default to device language
    fallbackLng: 'en',
    compatibilityJSON: 'v3',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

// Load saved language preference
AsyncStorage.getItem(LANGUAGE_KEY).then((savedLanguage) => {
  if (savedLanguage) {
    i18n.changeLanguage(savedLanguage);
  }
});

export const changeLanguage = async (language: string) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  await i18n.changeLanguage(language);
};

export const getCurrentLanguage = () => i18n.language;

export const getAvailableLanguages = () => [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha' },
];

export default i18n;
