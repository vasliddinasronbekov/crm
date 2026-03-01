/**
 * Voice Navigation Hook - Hands-free App Control
 *
 * Features:
 * - Voice command processing
 * - Navigation execution
 * - Available commands list
 */
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export interface NavigationResult {
  action_type: 'navigate' | 'execute' | 'search' | 'unknown';
  target: string;
  params?: Record<string, any>;
  message: string;
  confirmation_required?: boolean;
}

export interface UseVoiceNavigationOptions {
  apiUrl?: string;
  onNavigate?: (result: NavigationResult) => void;
  onError?: (error: string) => void;
}

export function useVoiceNavigation(options: UseVoiceNavigationOptions = {}) {
  const {
    apiUrl = `/api/ai/voice-navigation/`,
    onNavigate,
    onError,
  } = options;

  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | undefined>();
  const [lastResult, setLastResult] = useState<NavigationResult | undefined>();

  /**
   * Execute voice navigation command
   */
  const executeCommand = useCallback(
    async (command: string): Promise<NavigationResult | null> => {
      if (!command.trim()) return null;

      setIsProcessing(true);
      setLastCommand(command);

      try {
        const response = await axios.post<NavigationResult>(apiUrl, {
          command: command.trim(),
        });

        const result = response.data;
        setLastResult(result);

        // Execute navigation
        if (result.action_type === 'navigate') {
          router.push(`/${result.target}`);
        } else if (result.action_type === 'execute') {
          executeAction(result.target);
        } else if (result.action_type === 'search') {
          router.push(`/search?q=${encodeURIComponent(result.params?.query || '')}`);
        }

        onNavigate?.(result);
        return result;
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail || 'Voice navigation failed';
        console.error('Voice navigation error:', errorMessage);
        onError?.(errorMessage);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [apiUrl, router, onNavigate, onError]
  );

  /**
   * Execute action (logout, refresh, etc.)
   */
  const executeAction = useCallback((action: string) => {
    switch (action) {
      case 'navigate_back':
        router.back();
        break;

      case 'refresh_page':
        window.location.reload();
        break;

      case 'logout':
        // Trigger logout
        window.location.href = '/logout';
        break;

      default:
        console.warn('Unknown action:', action);
    }
  }, [router]);

  /**
   * Get available voice commands
   */
  const getAvailableCommands = useCallback(
    async (language: string = 'en'): Promise<string[]> => {
      try {
        const response = await axios.get<{ commands: string[] }>(
          `/api/ai/voice-commands/`,
          {
            params: { language },
          }
        );

        return response.data.commands;
      } catch (error) {
        console.error('Failed to get commands:', error);
        return [];
      }
    },
    []
  );

  return {
    // State
    isProcessing,
    lastCommand,
    lastResult,

    // Actions
    executeCommand,
    getAvailableCommands,
  };
}
