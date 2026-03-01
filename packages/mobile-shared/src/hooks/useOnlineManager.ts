/**
 * Online Manager Hook
 * Handles network state changes for React Query
 */

import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

export const useOnlineManager = () => {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Update React Query's online manager based on network state
      onlineManager.setOnline(!!state.isConnected);
    });

    return () => unsubscribe();
  }, []);
};
