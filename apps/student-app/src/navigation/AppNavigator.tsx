import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { useAuth } from '../context/AuthContext'

// Screens
import LoginScreen from '../screens/LoginScreen'
import DashboardScreen from '../screens/DashboardScreen'
import CoursesScreen from '../screens/CoursesScreen'
import AssignmentsScreen from '../screens/AssignmentsScreen'
import QuizzesScreen from '../screens/QuizzesScreen'
import AttendanceScreen from '../screens/AttendanceScreen'
import PaymentsScreen from '../screens/PaymentsScreen'
import GroupsScreen from '../screens/GroupsScreen'
import ShopScreen from '../screens/ShopScreen'
import LeaderboardScreen from '../screens/LeaderboardScreen'
import EventsScreen from '../screens/EventsScreen'
import SupportScreen from '../screens/SupportScreen'
import MessagesScreen from '../screens/MessagesScreen'
import ProfileScreen from '../screens/ProfileScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// Stack Navigator for additional screens accessed from Dashboard
function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0f172a',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Assignments"
        component={AssignmentsScreen}
        options={{ title: 'Assignments' }}
      />
      <Stack.Screen
        name="Quizzes"
        component={QuizzesScreen}
        options={{ title: 'Quizzes' }}
      />
      <Stack.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: 'Attendance' }}
      />
      <Stack.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ title: 'Payments' }}
      />
      <Stack.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ title: 'Groups' }}
      />
      <Stack.Screen
        name="Shop"
        component={ShopScreen}
        options={{ title: 'Shop' }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: 'Leaderboard' }}
      />
      <Stack.Screen
        name="Events"
        component={EventsScreen}
        options={{ title: 'Events' }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ title: 'Support' }}
      />
    </Stack.Navigator>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home'

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline'
          } else if (route.name === 'Courses') {
            iconName = focused ? 'book' : 'book-outline'
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline'
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline'
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: '#00d4ff',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: {
          backgroundColor: '#0f172a',
        },
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Courses" component={CoursesScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
})
