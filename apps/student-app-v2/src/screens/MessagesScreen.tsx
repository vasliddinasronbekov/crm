// apps/student-app-v2/src/screens/MessagesScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { theme } from '@eduvoice/mobile-ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const MessagesScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.comingSoonContainer}>
        <MaterialCommunityIcons
          name="message-text-outline"
          size={80}
          color={theme.colors.primary500}
        />
        <Text style={styles.comingSoonTitle}>Messaging Feature</Text>
        <Text style={styles.comingSoonSubtitle}>Coming Soon!</Text>
        <Text style={styles.comingSoonMessage}>
          Chat with your teachers and classmates will be available in a future update.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  comingSoonTitle: {
    ...theme.typography.h1,
    marginTop: theme.spacing.lg,
    color: theme.colors.gray900,
  },
  comingSoonSubtitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.xs,
    color: theme.colors.primary500,
  },
  comingSoonMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.md,
    color: theme.colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
  },
});
