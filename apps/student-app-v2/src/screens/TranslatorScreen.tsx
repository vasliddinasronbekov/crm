// apps/student-app-v2/src/screens/TranslatorScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@eduvoice/mobile-ui';

export const TranslatorScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Translator</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  title: {
    ...theme.typography.h2,
  },
});
