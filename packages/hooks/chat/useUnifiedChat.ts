import { useState, useRef, useCallback, useEffect } from 'react';
import { API_URL } from '@/packages/config/api';
import apiService from '@/packages/services/api';
import { nativeAudioPlayer } from '@/packages/services/audio/audio-player.native';
import { nativeAudioRecorder } from '@/packages/services/audio/audio-recorder.native';
import { webAudioPlayer } from '@/packages/services/audio/audio-player.web';
import { webAudioRecorder } from '@/packages/services/audio/audio-recorder.web';
import { Platform } from 'react-native';

// Unified Chat Message Type
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  intent?: string;
  confidence?: number;
  data?: any;
  suggestions?: string[];
}

// Platform-specific modules
const audioPlayer = Platform.OS === 'web' ? webAudioPlayer : nativeAudioPlayer;
const audioRecorder = Platform.OS === 'web' ? webAudioRecorder : nativeAudioRecorder;

export type UnifiedChatMode = 'voice' | 'text';

export interface UseUnifiedChatOptions {
  mode?: UnifiedChatMode;
  autoConnect?: boolean;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
}

export function useUnifiedChat(options: UseUnifiedChatOptions = {}) {
  const {
    mode = 'text',
    autoConnect = false,
    onMessage,
    onError,
  } = options;

  // Common State
  const [isConnected, setIsConnected] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const wsRef = useRef<WebSocket | null>(null);

  // Text-specific State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Voice-specific State
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState({
    autoTts: true,
    language: 'uz',
  });

  const getWebSocketUrl = useCallback(async () => {
    const token = await apiService.getAccessToken();
    const baseUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const path = mode === 'voice' ? '/ws/ai/voice/' : '/ws/ai/chat/';
    return `${baseUrl}${path}?token=${token}`;
  }, [mode]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const url = await getWebSocketUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          handleTextMessage(data);
        } else {
          audioPlayer.play(event.data);
        }
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      onError?.('Failed to connect to chat');
    }
  }, [getWebSocketUrl, onError]);

  const handleTextMessage = (data: any) => {
    switch (data.type) {
      case 'connected':
        setConversationId(data.conversation_id);
        if (data.settings) setSettings(data.settings);
        break;

      case 'transcript':
        setTranscript(data.text || '');
        setIsProcessing(true);
        break;

      case 'response': // Voice mode response
      case 'message': // Text mode response
        const newMessage: ChatMessage = {
          id: `${Date.now()}`,
          role: data.role || 'assistant',
          text: data.text,
          timestamp: new Date(),
          intent: data.intent,
          confidence: data.confidence,
          data: data.data,
          suggestions: data.suggestions,
        };
        setMessages((prev) => [...prev, newMessage]);
        if (data.type === 'response') {
          setTranscript('');
          setIsProcessing(false);
        }
        if (data.suggestions) setSuggestions(data.suggestions);
        onMessage?.(newMessage);
        break;

      case 'typing':
        setIsTyping(data.is_typing);
        break;

      case 'error':
        console.error('Chat error:', data.message);
        onError?.(data.message);
        setIsProcessing(false);
        break;
    }
  };

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    onMessage?.(userMessage);

    wsRef.current?.send(JSON.stringify({ type: 'message', text: text.trim() }));
  }, [onMessage]);

  const startRecording = useCallback(async () => {
    try {
      await audioRecorder.start();
      wsRef.current?.send(JSON.stringify({ type: 'start_recording' }));
    } catch (error) {
      onError?.('Failed to start recording');
    }
  }, [onError]);

  const stopRecording = useCallback(async () => {
    try {
      const audioBlob = await audioRecorder.stop();
      if (audioBlob) {
        wsRef.current?.send(audioBlob);
      }
      wsRef.current?.send(JSON.stringify({ type: 'stop_recording' }));
    } catch (error) {
      onError?.('Failed to stop recording');
    }
  }, [onError]);
  
  const clearConversation = useCallback(() => {
    setMessages([]);
    setSuggestions([]);
    setTranscript('');
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    conversationId,
    // Text
    messages,
    isTyping,
    suggestions,
    sendMessage,
    sendSuggestion: sendMessage,
    clearConversation,
    // Voice
    isRecording: audioRecorder.isRecording,
    isProcessing,
    transcript,
    settings,
    startRecording,
    stopRecording,
    // Common
    connect,
    disconnect,
  };
}