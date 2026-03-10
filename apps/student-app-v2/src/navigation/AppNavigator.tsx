import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuthStore, useTheme } from '@eduvoice/mobile-shared';

import { AIScreen } from '../screens/AIScreen';
import { ArticlesScreen } from '../screens/ArticlesScreen';
import { AssignmentDetailScreen } from '../screens/AssignmentDetailScreen';
import { AssignmentReviewScreen } from '../screens/AssignmentReviewScreen';
import { AssignmentsScreen } from '../screens/AssignmentsScreen';
import { BooksScreen } from '../screens/BooksScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { CoinsScreen } from '../screens/CoinsScreen';
import { CourseDetailScreen } from '../screens/CourseDetailScreen';
import { CoursesScreen } from '../screens/CoursesScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { ExamsHubScreen } from '../screens/ExamsHubScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { IELTSListeningScreen } from '../screens/IELTSListeningScreen';
import { IELTSPrepScreen } from '../screens/IELTSPrepScreen';
import { IELTSReadingScreen } from '../screens/IELTSReadingScreen';
import { IELTSResultsScreen } from '../screens/IELTSResultsScreen';
import { IELTSSpeakingScreen } from '../screens/IELTSSpeakingScreen';
import { IELTSWritingScreen } from '../screens/IELTSWritingScreen';
import { LearnHubScreen } from '../screens/LearnHubScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { LessonViewerScreen } from '../screens/LessonViewerScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { QuizAttemptReviewScreen } from '../screens/QuizAttemptReviewScreen';
import { QuizPlayerScreen } from '../screens/QuizPlayerScreen';
import { QuizzesScreen } from '../screens/QuizzesScreen';
import { RankingScreen } from '../screens/RankingScreen';
import { SATExamScreen } from '../screens/SATExamScreen';
import { SATPrepScreen } from '../screens/SATPrepScreen';
import { SATResultsScreen } from '../screens/SATResultsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TranslatorScreen } from '../screens/TranslatorScreen';
import { VideosScreen } from '../screens/VideosScreen';
import type { AppStackParamList, AuthStackParamList, TabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const getTabIcon = (
  routeName: keyof TabParamList
): keyof typeof MaterialCommunityIcons.glyphMap => {
  switch (routeName) {
    case 'Home':
      return 'view-dashboard-outline';
    case 'Learn':
      return 'book-education-outline';
    case 'Exams':
      return 'clipboard-text-clock-outline';
    case 'AI':
      return 'robot-outline';
    case 'Settings':
      return 'cog-outline';
  }
};

const TabNavigator = () => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary500,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={getTabIcon(route.name)}
            color={color}
            size={size}
          />
        ),
        sceneStyle: {
          backgroundColor: theme.background,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('navigation.home') }}
      />
      <Tab.Screen
        name="Learn"
        component={LearnHubScreen}
        options={{ title: t('navigation.learn') }}
      />
      <Tab.Screen
        name="Exams"
        component={ExamsHubScreen}
        options={{ title: t('navigation.exams') }}
      />
      <Tab.Screen
        name="AI"
        component={AIScreen}
        options={{ title: t('navigation.ai') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('navigation.settings') }}
      />
    </Tab.Navigator>
  );
};

const LoadingScreen = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary500} />
    </View>
  );
};

export const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const navigationTheme = useMemo<NavigationTheme>(
    () => ({
      dark: isDark,
      colors: {
        primary: theme.colors.primary500,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
        notification: theme.colors.primary500,
      },
      fonts: {
        regular: {
          fontFamily: 'System',
          fontWeight: '400',
        },
        medium: {
          fontFamily: 'System',
          fontWeight: '500',
        },
        bold: {
          fontFamily: 'System',
          fontWeight: '700',
        },
        heavy: {
          fontFamily: 'System',
          fontWeight: '800',
        },
      },
    }),
    [isDark, theme]
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated ? (
        <AppStack.Navigator
          screenOptions={{
            headerTintColor: theme.text,
            headerStyle: {
              backgroundColor: theme.surface,
            },
            headerShadowVisible: false,
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        >
          <AppStack.Screen
            name="Main"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <AppStack.Screen name="Events" component={EventsScreen} options={{ title: t('widgets.events') }} />
          <AppStack.Screen name="Coins" component={CoinsScreen} options={{ title: t('widgets.coins') }} />
          <AppStack.Screen name="Payments" component={PaymentsScreen} options={{ title: t('home.paymentsAction') }} />
          <AppStack.Screen name="Library" component={LibraryScreen} options={{ title: t('widgets.library') }} />
          <AppStack.Screen name="Translator" component={TranslatorScreen} options={{ title: t('widgets.translator') }} />
          <AppStack.Screen name="Books" component={BooksScreen} options={{ title: t('widgets.books') }} />
          <AppStack.Screen name="Courses" component={CoursesScreen} options={{ title: t('widgets.courses') }} />
          <AppStack.Screen name="Videos" component={VideosScreen} options={{ title: t('widgets.videos') }} />
          <AppStack.Screen name="Articles" component={ArticlesScreen} options={{ title: t('widgets.articles') }} />
          <AppStack.Screen name="Quizzes" component={QuizzesScreen} options={{ title: t('widgets.quizzes') }} />
          <AppStack.Screen name="QuizPlayer" component={QuizPlayerScreen} options={{ headerShown: false }} />
          <AppStack.Screen
            name="QuizAttemptReview"
            component={QuizAttemptReviewScreen}
            options={{ title: 'Attempt Review' }}
          />
          <AppStack.Screen name="Assignments" component={AssignmentsScreen} options={{ title: t('assignments.assignments') }} />
          <AppStack.Screen
            name="AssignmentReview"
            component={AssignmentReviewScreen}
            options={{ title: 'Submission Review' }}
          />
          <AppStack.Screen name="Messages" component={MessagesScreen} options={{ title: t('messages.messages') }} />
          <AppStack.Screen name="Groups" component={GroupsScreen} options={{ title: t('navigation.groups') }} />
          <AppStack.Screen name="Ranking" component={RankingScreen} options={{ title: t('navigation.ranking') }} />
          <AppStack.Screen
            name="AssignmentDetail"
            component={AssignmentDetailScreen}
            options={{ title: t('assignments.assignmentDetails') }}
          />
          <AppStack.Screen
            name="CourseDetail"
            component={CourseDetailScreen}
            options={{ title: t('courses.courseDetails') }}
          />
          <AppStack.Screen name="LessonViewer" component={LessonViewerScreen} options={{ title: t('courses.lesson') }} />
          <AppStack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ title: t('messages.messages') }}
          />
          <AppStack.Screen name="IELTSPrep" component={IELTSPrepScreen} options={{ title: t('exams.ieltsTitle') }} />
          <AppStack.Screen name="IELTSReading" component={IELTSReadingScreen} options={{ headerShown: false }} />
          <AppStack.Screen name="IELTSListening" component={IELTSListeningScreen} options={{ headerShown: false }} />
          <AppStack.Screen name="IELTSWriting" component={IELTSWritingScreen} options={{ headerShown: false }} />
          <AppStack.Screen name="IELTSSpeaking" component={IELTSSpeakingScreen} options={{ headerShown: false }} />
          <AppStack.Screen name="IELTSResults" component={IELTSResultsScreen} options={{ title: t('exams.resultsTitles.ielts') }} />
          <AppStack.Screen name="SATPrep" component={SATPrepScreen} options={{ title: t('exams.satFullMock') }} />
          <AppStack.Screen name="SATExam" component={SATExamScreen} options={{ headerShown: false }} />
          <AppStack.Screen name="SATResults" component={SATResultsScreen} options={{ title: t('exams.resultsTitles.sat') }} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    tabBar: {
      height: 76,
      paddingTop: 8,
      paddingBottom: 10,
      backgroundColor: isDark ? 'rgba(26,26,26,0.96)' : 'rgba(255,255,255,0.92)',
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(229,231,235,0.72)',
      ...theme.shadows.lg,
    },
    tabBarItem: {
      paddingVertical: 4,
    },
    tabBarLabel: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
