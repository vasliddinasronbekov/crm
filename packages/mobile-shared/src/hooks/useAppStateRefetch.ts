/**
 * App State Refetch Hook
 * Handles background refetching when app becomes active
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { focusManager } from '@tanstack/react-query';

export const useAppStateRefetch = () => {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      // Update React Query's focus manager based on app state
      focusManager.setFocused(status === 'active');
    });

    return () => subscription.remove();
  }, []);
};
