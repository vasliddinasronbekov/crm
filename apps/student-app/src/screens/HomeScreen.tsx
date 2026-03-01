import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { StatusBar } from 'expo-status-bar'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Welcome Back! 👋</Text>
        <Text style={styles.subtitle}>Continue your learning journey</Text>

        {/* Featured Courses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Courses</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Introduction to Programming</Text>
            <Text style={styles.cardText}>50% Complete</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed: JavaScript Basics</Text>
            <Text style={styles.cardText}>2 hours ago</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 14,
    color: '#94a3b8',
  },
})
