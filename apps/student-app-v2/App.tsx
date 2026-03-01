import React from 'react';
import { StatusBar } from 'expo-status-bar';

import {
  useAppStateRefetch,
  useOnlineManager,
  useTheme,
} from '@eduvoice/mobile-shared';

import './src/i18n';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppProviders } from './src/providers/AppProviders';

export type {
  AppStackParamList,
  AuthStackParamList,
  TabParamList,
} from './src/navigation/types';

const RuntimeShell = () => {
  const { isDark } = useTheme();

  useAppStateRefetch();
  useOnlineManager();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
};

const App = () => {
  return (
    <AppProviders>
      <RuntimeShell />
    </AppProviders>
  );
};

export default App;
