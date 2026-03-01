// apps/parent-app-v2/App.tsx

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { blueTheme } from '@eduvoice/mobile-ui';

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello from Parent App v2!</Text>
      <StatusBar style="auto" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: blueTheme.colors.primary100, // Use blue theme
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...blueTheme.typography.h2,
    color: blueTheme.colors.primary900,
  },
});

export default App;