/**
 * Expo App Configuration
 * Student App V2 - Complete Backend Integration
 */

module.exports = {
  expo: {
    name: "EduVoice Student",
    slug: "student-app-v2",
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#4F46E5"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.eduvoice.student",
      buildNumber: "1.0.0"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#4F46E5"
      },
      package: "com.eduvoice.student",
      versionCode: 1,
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      // ===== API CONFIGURATION =====
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.106:8008",
      wsUrl: process.env.EXPO_PUBLIC_WS_URL || "ws://192.168.0.106:8008",
      apiTimeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || "30000"),

      // ===== FEATURE FLAGS =====
      enableGamification: process.env.EXPO_PUBLIC_ENABLE_GAMIFICATION !== "false",
      enableSocial: process.env.EXPO_PUBLIC_ENABLE_SOCIAL !== "false",
      enableAIVoice: process.env.EXPO_PUBLIC_ENABLE_AI_VOICE !== "false",
      enableChat: process.env.EXPO_PUBLIC_ENABLE_CHAT !== "false",
      enableShop: process.env.EXPO_PUBLIC_ENABLE_SHOP !== "false",
      enableOffline: process.env.EXPO_PUBLIC_ENABLE_OFFLINE !== "false",

      // ===== EXTERNAL SERVICES =====
      mixpanelToken: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      oneSignalAppId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,

      // ===== APP CONFIGURATION =====
      defaultLanguage: process.env.EXPO_PUBLIC_DEFAULT_LANGUAGE || "en",
      environment: process.env.EXPO_PUBLIC_ENV || "development",
      debug: process.env.EXPO_PUBLIC_DEBUG === "true",

      // ===== MEDIA CONFIGURATION =====
      maxFileSize: parseInt(process.env.EXPO_PUBLIC_MAX_FILE_SIZE || "10"),
      allowedFileTypes: process.env.EXPO_PUBLIC_ALLOWED_FILE_TYPES || "pdf,doc,docx,txt,jpg,jpeg,png",

      // ===== CACHE CONFIGURATION =====
      cacheDuration: parseInt(process.env.EXPO_PUBLIC_CACHE_DURATION || "300000"),

      // ===== WEBSOCKET CONFIGURATION =====
      wsReconnectAttempts: parseInt(process.env.EXPO_PUBLIC_WS_RECONNECT_ATTEMPTS || "5"),
      wsReconnectDelay: parseInt(process.env.EXPO_PUBLIC_WS_RECONNECT_DELAY || "3000"),
    }
  }
}
