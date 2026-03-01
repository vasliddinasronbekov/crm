'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// Supported languages
export type Language = 'en' | 'uz' | 'ru'
export type Theme = 'light' | 'dark' | 'custom'
export type Currency = 'USD' | 'UZS' | 'RUB' | 'EUR'
export const BALANCE_COINS_PER_UNIT = 10000
export const LEGACY_MINOR_PER_UNIT = 100

type CurrencyFormatOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

interface SettingsContextType {
  language: Language
  theme: Theme
  currency: Currency
  setLanguage: (lang: Language) => void
  setTheme: (theme: Theme) => void
  setCurrency: (currency: Currency) => void
  t: (key: string) => string
  currencySymbol: string
  formatCurrency: (amountInUzs: number, options?: CurrencyFormatOptions) => string
  formatCurrencyFromMinor: (amountInMinor: number, options?: CurrencyFormatOptions) => string
  formatCurrencyFromCoins: (amountInCoins: number, options?: CurrencyFormatOptions) => string
  toSelectedCurrency: (amountInUzs: number) => number
  fromSelectedCurrency: (amountInSelectedCurrency: number) => number
  translateText: (text: string) => string
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

// Translation dictionary
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your account and application preferences',
    'settings.profile': 'Profile Information',
    'settings.security': 'Security & Password',
    'settings.preferences': 'Preferences',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.currency': 'Currency',
    'settings.appearance': 'Appearance',
    'settings.language.description': 'Change interface language',
    'settings.theme.description': 'Choose your preferred theme',
    'settings.currency.description': 'Display currency format',

    // Theme options
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.custom': 'Custom',

    // Currency options
    'currency.usd': 'US Dollar (USD)',
    'currency.uzs': 'Uzbek Som (UZS)',
    'currency.rub': 'Russian Ruble (RUB)',
    'currency.eur': 'Euro (EUR)',
  },
  uz: {
    // Common
    'common.save': 'Saqlash',
    'common.cancel': 'Bekor qilish',
    'common.delete': "O'chirish",
    'common.edit': 'Tahrirlash',
    'common.create': 'Yaratish',
    'common.search': 'Qidirish',
    'common.loading': 'Yuklanmoqda...',
    'common.error': 'Xato',
    'common.success': 'Muvaffaqiyat',
    'common.warning': 'Ogohlantirish',

    // Settings
    'settings.title': 'Sozlamalar',
    'settings.subtitle': 'Hisobingiz va ilova sozlamalarini boshqaring',
    'settings.profile': 'Profil Ma\'lumotlari',
    'settings.security': 'Xavfsizlik va Parol',
    'settings.preferences': 'Afzalliklar',
    'settings.language': 'Til',
    'settings.theme': 'Mavzu',
    'settings.currency': 'Valyuta',
    'settings.appearance': 'Ko\'rinish',
    'settings.language.description': 'Interfeys tilini o\'zgartirish',
    'settings.theme.description': 'Afzal ko\'rgan mavzuni tanlang',
    'settings.currency.description': 'Valyuta formatini ko\'rsatish',

    // Theme options
    'theme.light': 'Yorug\'',
    'theme.dark': 'Qorong\'i',
    'theme.custom': 'Maxsus',

    // Currency options
    'currency.usd': 'AQSh Dollari (USD)',
    'currency.uzs': 'O\'zbek So\'mi (UZS)',
    'currency.rub': 'Rossiya Rubli (RUB)',
    'currency.eur': 'Yevro (EUR)',
  },
  ru: {
    // Common
    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.delete': 'Удалить',
    'common.edit': 'Редактировать',
    'common.create': 'Создать',
    'common.search': 'Поиск',
    'common.loading': 'Загрузка...',
    'common.error': 'Ошибка',
    'common.success': 'Успех',
    'common.warning': 'Предупреждение',

    // Settings
    'settings.title': 'Настройки',
    'settings.subtitle': 'Управление учетной записью и настройками приложения',
    'settings.profile': 'Информация профиля',
    'settings.security': 'Безопасность и пароль',
    'settings.preferences': 'Предпочтения',
    'settings.language': 'Язык',
    'settings.theme': 'Тема',
    'settings.currency': 'Валюта',
    'settings.appearance': 'Внешний вид',
    'settings.language.description': 'Изменить язык интерфейса',
    'settings.theme.description': 'Выберите предпочтительную тему',
    'settings.currency.description': 'Формат отображения валюты',

    // Theme options
    'theme.light': 'Светлая',
    'theme.dark': 'Темная',
    'theme.custom': 'Пользовательская',

    // Currency options
    'currency.usd': 'Доллар США (USD)',
    'currency.uzs': 'Узбекский сум (UZS)',
    'currency.rub': 'Российский рубль (RUB)',
    'currency.eur': 'Евро (EUR)',
  },
}

type NonEnglishLanguage = Exclude<Language, 'en'>

// Phrase-level translations to cover common dashboard labels globally.
const phraseTranslations: Record<NonEnglishLanguage, Record<string, string>> = {
  uz: {
    Dashboard: 'Boshqaruv paneli',
    Finance: 'Moliya',
    Analytics: 'Analitika',
    Students: 'O\'quvchilar',
    Teachers: 'O\'qituvchilar',
    'Group Management': 'Guruh boshqaruvi',
    'Schedule Board': 'Jadval doskasi',
    CRM: 'CRM',
    LMS: 'LMS',
    Tasks: 'Vazifalar',
    'HR & Salary': 'HR va maosh',
    Shop: 'Do\'kon',
    Events: 'Tadbirlar',
    Support: 'Yordam',
    Email: 'Email',
    Announcements: 'E\'lonlar',
    Expenses: 'Xarajatlar',
    Leaderboard: 'Reyting',
    Payments: 'To\'lovlar',
    Certificates: 'Sertifikatlar',
    Accounting: 'Buxgalteriya',
    Reports: 'Hisobotlar',
    Messaging: 'Xabarlar',
    Settings: 'Sozlamalar',
    Logout: 'Chiqish',
    User: 'Foydalanuvchi',
    Superuser: 'Super foydalanuvchi',
    Administrator: 'Administrator',
    Teacher: 'O\'qituvchi',
    Staff: 'Xodim',
    'Staff Member': 'Xodim',
    'Good Morning': 'Xayrli tong',
    'Good Afternoon': 'Xayrli kun',
    'Good Evening': 'Xayrli kech',
    'Platform Status': 'Platforma holati',
    'All Systems Operational': 'Barcha tizimlar ishlayapti',
    'Total Students': 'Jami o\'quvchilar',
    'Teaching Staff': 'O\'qituvchilar tarkibi',
    'Active Groups': 'Faol guruhlar',
    'Pending Tasks': 'Kutilayotgan vazifalar',
    'Quick Access': 'Tezkor kirish',
    'Click any card to navigate': 'O\'tish uchun istalgan kartani bosing',
    'System Status': 'Tizim holati',
    'Platform Overview': 'Platforma ko\'rinishi',
    'Student Engagement': 'O\'quvchi faolligi',
    'Payment Success Rate': 'To\'lov muvaffaqiyati',
    'Group Activity': 'Guruh faolligi',
    'Lead Conversion': 'Lid konversiyasi',
  },
  ru: {
    Dashboard: 'Панель',
    Finance: 'Финансы',
    Analytics: 'Аналитика',
    Students: 'Студенты',
    Teachers: 'Преподаватели',
    'Group Management': 'Управление группами',
    'Schedule Board': 'Расписание',
    CRM: 'CRM',
    LMS: 'LMS',
    Tasks: 'Задачи',
    'HR & Salary': 'HR и зарплата',
    Shop: 'Магазин',
    Events: 'События',
    Support: 'Поддержка',
    Email: 'Email',
    Announcements: 'Объявления',
    Expenses: 'Расходы',
    Leaderboard: 'Рейтинг',
    Payments: 'Платежи',
    Certificates: 'Сертификаты',
    Accounting: 'Бухгалтерия',
    Reports: 'Отчеты',
    Messaging: 'Сообщения',
    Settings: 'Настройки',
    Logout: 'Выйти',
    User: 'Пользователь',
    Superuser: 'Суперпользователь',
    Administrator: 'Администратор',
    Teacher: 'Преподаватель',
    Staff: 'Сотрудник',
    'Staff Member': 'Сотрудник',
    'Good Morning': 'Доброе утро',
    'Good Afternoon': 'Добрый день',
    'Good Evening': 'Добрый вечер',
    'Platform Status': 'Статус платформы',
    'All Systems Operational': 'Все системы работают',
    'Total Students': 'Всего студентов',
    'Teaching Staff': 'Преподаватели',
    'Active Groups': 'Активные группы',
    'Pending Tasks': 'Ожидающие задачи',
    'Quick Access': 'Быстрый доступ',
    'Click any card to navigate': 'Нажмите на карточку для перехода',
    'System Status': 'Состояние системы',
    'Platform Overview': 'Обзор платформы',
    'Student Engagement': 'Вовлеченность студентов',
    'Payment Success Rate': 'Успешность платежей',
    'Group Activity': 'Активность групп',
    'Lead Conversion': 'Конверсия лидов',
  },
}

// Word-level fallback for text not yet moved to translation keys.
const wordTranslations: Record<NonEnglishLanguage, Record<string, string>> = {
  uz: {
    loading: 'yuklanmoqda',
    save: 'saqlash',
    cancel: 'bekor qilish',
    delete: 'o\'chirish',
    edit: 'tahrirlash',
    create: 'yaratish',
    search: 'qidirish',
    language: 'til',
    theme: 'mavzu',
    currency: 'valyuta',
    settings: 'sozlamalar',
    dashboard: 'boshqaruv paneli',
    student: 'o\'quvchi',
    students: 'o\'quvchilar',
    teacher: 'o\'qituvchi',
    teachers: 'o\'qituvchilar',
    group: 'guruh',
    groups: 'guruhlar',
    payment: 'to\'lov',
    payments: 'to\'lovlar',
    finance: 'moliya',
    analytics: 'analitika',
    reports: 'hisobotlar',
    messaging: 'xabarlar',
    support: 'yordam',
    expenses: 'xarajatlar',
    profile: 'profil',
    security: 'xavfsizlik',
    password: 'parol',
    total: 'jami',
    active: 'faol',
    pending: 'kutilayotgan',
    status: 'holat',
    system: 'tizim',
    overview: 'ko\'rinish',
    quick: 'tezkor',
    access: 'kirish',
    online: 'onlayn',
    connected: 'ulangan',
    healthy: 'sog\'lom',
    recent: 'so\'nggi',
    no: 'yo\'q',
    records: 'yozuvlar',
    record: 'yozuv',
    average: 'o\'rtacha',
    score: 'ball',
    balance: 'balans',
    paid: 'to\'langan',
    unpaid: 'to\'lanmagan',
    amount: 'miqdor',
    date: 'sana',
    course: 'kurs',
    branch: 'filial',
  },
  ru: {
    loading: 'загрузка',
    save: 'сохранить',
    cancel: 'отмена',
    delete: 'удалить',
    edit: 'редактировать',
    create: 'создать',
    search: 'поиск',
    language: 'язык',
    theme: 'тема',
    currency: 'валюта',
    settings: 'настройки',
    dashboard: 'панель',
    student: 'студент',
    students: 'студенты',
    teacher: 'преподаватель',
    teachers: 'преподаватели',
    group: 'группа',
    groups: 'группы',
    payment: 'платеж',
    payments: 'платежи',
    finance: 'финансы',
    analytics: 'аналитика',
    reports: 'отчеты',
    messaging: 'сообщения',
    support: 'поддержка',
    expenses: 'расходы',
    profile: 'профиль',
    security: 'безопасность',
    password: 'пароль',
    total: 'всего',
    active: 'активные',
    pending: 'ожидающие',
    status: 'статус',
    system: 'система',
    overview: 'обзор',
    quick: 'быстрый',
    access: 'доступ',
    online: 'онлайн',
    connected: 'подключено',
    healthy: 'нормально',
    recent: 'последние',
    no: 'нет',
    records: 'записей',
    record: 'запись',
    average: 'средний',
    score: 'балл',
    balance: 'баланс',
    paid: 'оплачено',
    unpaid: 'не оплачено',
    amount: 'сумма',
    date: 'дата',
    course: 'курс',
    branch: 'филиал',
  },
}

const applyLetterCase = (source: string, target: string): string => {
  if (source === source.toUpperCase()) {
    return target.toUpperCase()
  }
  if (source[0] === source[0].toUpperCase()) {
    return `${target.charAt(0).toUpperCase()}${target.slice(1)}`
  }
  return target
}

// Currency symbols
const currencySymbols: Record<Currency, string> = {
  USD: '$',
  UZS: 'so\'m',
  RUB: '₽',
  EUR: '€',
}

// Approximate conversion rate from UZS to selected currency.
const currencyRatesFromUzs: Record<Currency, number> = {
  UZS: 1,
  USD: 1 / 12600,
  EUR: 1 / 13700,
  RUB: 1 / 140,
}

const localeByLanguage: Record<Language, string> = {
  en: 'en-US',
  uz: 'uz-UZ',
  ru: 'ru-RU',
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('uz')
  const [theme, setThemeState] = useState<Theme>('dark')
  const [currency, setCurrencyState] = useState<Currency>('UZS')

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('app_language') as Language
      const savedTheme = localStorage.getItem('app_theme') as Theme
      const savedCurrency = localStorage.getItem('app_currency') as Currency

      if (savedLanguage && ['en', 'uz', 'ru'].includes(savedLanguage)) {
        setLanguageState(savedLanguage)
        document.documentElement.lang = savedLanguage
      } else {
        document.documentElement.lang = 'uz'
      }
      if (savedTheme && ['light', 'dark', 'custom'].includes(savedTheme)) {
        setThemeState(savedTheme)
        applyTheme(savedTheme)
      } else {
        // Apply default dark theme on first load
        applyTheme('dark')
      }
      if (savedCurrency && ['USD', 'UZS', 'RUB', 'EUR'].includes(savedCurrency)) {
        setCurrencyState(savedCurrency)
      }
    }
  }, [])

  const applyTheme = (newTheme: Theme) => {
    if (typeof window === 'undefined') return

    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove('light-theme', 'dark-theme', 'custom-theme')

    if (newTheme === 'dark') {
      root.classList.add('dark-theme')
      root.style.setProperty('--background', '17 24 39') // gray-900
      root.style.setProperty('--foreground', '243 244 246') // gray-100
      root.style.setProperty('--surface', '31 41 55') // gray-800
      root.style.setProperty('--primary', '99 102 241') // indigo-500
      root.style.setProperty('--border', '55 65 81') // gray-700
      root.style.setProperty('--text-primary', '243 244 246') // gray-100
      root.style.setProperty('--text-secondary', '156 163 175') // gray-400
    } else if (newTheme === 'custom') {
      root.classList.add('custom-theme')
      // Custom theme with purple accents
      root.style.setProperty('--background', '15 23 42') // slate-900
      root.style.setProperty('--foreground', '248 250 252') // slate-50
      root.style.setProperty('--surface', '30 41 59') // slate-800
      root.style.setProperty('--primary', '168 85 247') // purple-500
      root.style.setProperty('--border', '51 65 85') // slate-700
      root.style.setProperty('--text-primary', '248 250 252') // slate-50
      root.style.setProperty('--text-secondary', '148 163 184') // slate-400
    } else {
      root.classList.add('light-theme')
      // Reset to light theme (default)
      root.style.setProperty('--background', '249 250 251') // gray-50
      root.style.setProperty('--foreground', '17 24 39') // gray-900
      root.style.setProperty('--surface', '255 255 255') // white
      root.style.setProperty('--primary', '99 102 241') // indigo-500
      root.style.setProperty('--border', '229 231 235') // gray-200
      root.style.setProperty('--text-primary', '17 24 39') // gray-900
      root.style.setProperty('--text-secondary', '107 114 128') // gray-500
    }
  }

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('app_language', lang)
    document.documentElement.lang = lang
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('app_theme', newTheme)
    applyTheme(newTheme)
  }

  const setCurrency = (curr: Currency) => {
    setCurrencyState(curr)
    localStorage.setItem('app_currency', curr)
  }

  // Translation function
  const t = useCallback((key: string): string => {
    return translations[language]?.[key] || key
  }, [language])

  // Global text translator for legacy pages that still use hardcoded labels.
  const translateText = useCallback((text: string): string => {
    if (language === 'en' || !text) return text

    const phraseMap = phraseTranslations[language]
    const wordMap = wordTranslations[language]
    const leadingWhitespace = text.match(/^\s*/)?.[0] ?? ''
    const trailingWhitespace = text.match(/\s*$/)?.[0] ?? ''
    const coreText = text.trim()
    if (!coreText) return text

    const directMatch = phraseMap[coreText]
    if (directMatch) {
      return `${leadingWhitespace}${directMatch}${trailingWhitespace}`
    }

    const translatedCore = coreText.replace(/[A-Za-z][A-Za-z'-]*/g, (word) => {
      const mapped = wordMap[word.toLowerCase()]
      if (!mapped) return word
      return applyLetterCase(word, mapped)
    })

    return `${leadingWhitespace}${translatedCore}${trailingWhitespace}`
  }, [language])

  const toSelectedCurrency = (amountInUzs: number): number => {
    const rate = currencyRatesFromUzs[currency] || 1
    return amountInUzs * rate
  }

  const fromSelectedCurrency = (amountInSelectedCurrency: number): number => {
    const rate = currencyRatesFromUzs[currency] || 1
    if (rate === 0) return amountInSelectedCurrency
    return amountInSelectedCurrency / rate
  }

  // Currency formatting function (input expected in UZS).
  const formatCurrency = (amountInUzs: number, options?: CurrencyFormatOptions): string => {
    const symbol = currencySymbols[currency]
    const locale = localeByLanguage[language] || 'en-US'
    const converted = toSelectedCurrency(amountInUzs)
    const minFractionDigits = options?.minimumFractionDigits ?? 2
    const maxFractionDigits = options?.maximumFractionDigits ?? 2
    const sign = converted < 0 ? '-' : ''
    const absoluteAmount = Math.abs(converted)
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    }).format(absoluteAmount)

    if (currency === 'UZS') {
      return `${sign}${formatted} ${symbol}`
    }
    return `${sign}${symbol}${formatted}`
  }

  const formatCurrencyFromMinor = (amountInMinor: number, options?: CurrencyFormatOptions): string => {
    return formatCurrency(amountInMinor / LEGACY_MINOR_PER_UNIT, options)
  }

  const formatCurrencyFromCoins = (amountInCoins: number, options?: CurrencyFormatOptions): string => {
    return formatCurrency(amountInCoins / BALANCE_COINS_PER_UNIT, options)
  }

  return (
    <SettingsContext.Provider
      value={{
        language,
        theme,
        currency,
        setLanguage,
        setTheme,
        setCurrency,
        t,
        currencySymbol: currencySymbols[currency],
        formatCurrency,
        formatCurrencyFromMinor,
        formatCurrencyFromCoins,
        toSelectedCurrency,
        fromSelectedCurrency,
        translateText,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
