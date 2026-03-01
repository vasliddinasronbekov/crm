import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, StyleSheet, Text as RNText } from 'react-native';
import { colors } from '../theme';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import StudentsScreen from '../screens/StudentsScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import TasksScreen from '../screens/TasksScreen';
import GradesScreen from '../screens/GradesScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SalaryScreen from '../screens/SalaryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QuizzesScreen from '../screens/QuizzesScreen';
import CreateQuizScreen from '../screens/CreateQuizScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for authenticated users
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏠</Text>,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Students"
        component={StudentsScreen}
        options={{
          title: 'Students',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👨‍🎓</Text>,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          title: 'Groups',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👥</Text>,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📋</Text>,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👤</Text>,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          // Auth screens
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          // Main app screens
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GroupDetail"
              component={GroupDetailScreen}
              options={{
                title: 'Group Details',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="Attendance"
              component={AttendanceScreen}
              options={{
                title: 'Attendance',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="Grades"
              component={GradesScreen}
              options={{
                title: 'Grades',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="Schedule"
              component={ScheduleScreen}
              options={{
                title: 'Schedule',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Salary"
              component={SalaryScreen}
              options={{
                title: 'Salary',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Settings',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="Quizzes"
              component={QuizzesScreen}
              options={{
                title: 'Quizzes',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="CreateQuiz"
              component={CreateQuizScreen}
              options={{
                title: 'Create Quiz',
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
                headerShown: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
  },
});

// Helper component for tab bar icons
function Text({ children, style }: any) {
  return <RNText style={style}>{children}</RNText>;
}
