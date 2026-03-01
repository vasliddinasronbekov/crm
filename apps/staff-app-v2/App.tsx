// apps/staff-app-v2/App.tsx

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { greenTheme } from '@eduvoice/mobile-ui';

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello from Staff App v2!</Text>
      <StatusBar style="auto" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: greenTheme.colors.primary100, // Use green theme
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...greenTheme.typography.h2,
    color: greenTheme.colors.primary900,
  },
});

export default App;