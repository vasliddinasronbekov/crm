/**
 * Voice Chat Hook - Real-time WebSocket Voice Interaction
 *
 * Features:
 * - WebSocket connection management
 * - Audio recording and streaming
 * - Real-time transcription
 * - AI response handling
 * - Audio playback
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceChatMessage {
  type: 'transcript' | 'response' | 'error' | 'connected' | 'typing';
  text?: string;
  language?: string;
  confidence?: number;
  intent?: string;
  data?: any;
  metadata?: any;
}

export interface VoiceChatSettings {
  autoTts: boolean;
  voiceFeedback: boolean;
  language?: string;
}

export interface UseVoiceChatOptions {
  wsUrl?: string;
  autoConnect?: boolean;
  onTranscript?: (text: string, language: string) => void;
  onResponse?: (text: string, intent?: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceChat(options: UseVoiceChatOptions = {}) {
  const {
    wsUrl = `ws://${window.location.hostname}:8008/ws/ai/voice/`,
    autoConnect = false,
    onTranscript,
    onResponse,
    onError,
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [intent, setIntent] = useState<string | undefined>();
  const [confidence, setConfidence] = useState(0);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [settings, setSettings] = useState<VoiceChatSettings>({
    autoTts: true,
    voiceFeedback: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ Voice chat connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const message: VoiceChatMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              setConversationId(message.data?.conversation_id);
              if (message.data?.settings) {
                setSettings(message.data.settings);
              }
              break;

            case 'transcript':
              const transcriptText = message.text || '';
              setTranscript(transcriptText);
              setIsProcessing(true);
              onTranscript?.(transcriptText, message.language || 'uz');
              break;

            case 'response':
              const responseText = message.text || '';
              setResponse(responseText);
              setIntent(message.intent);
              setConfidence(message.confidence || 0);
              setIsProcessing(false);
              onResponse?.(responseText, message.intent);
              break;

            case 'error':
              console.error('Voice chat error:', message.text);
              setIsProcessing(false);
              onError?.(message.text || 'Unknown error');
              break;

            case 'typing':
              setIsProcessing(message.data?.is_typing || false);
              break;
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      } else {
        // Binary data (audio response)
        playAudioBlob(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      onError?.('WebSocket connection error');
    };

    ws.onclose = () => {
      console.log('Voice chat disconnected');
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, [wsUrl, onTranscript, onResponse, onError]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Set up audio context for visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start visualization
      updateAudioLevel();

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN && event.data.size > 0) {
          // Send audio chunk to server
          wsRef.current.send(event.data);
        }
      };

      mediaRecorder.start(100); // Send chunks every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Send start recording command
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'start_recording',
          })
        );
      }

      console.log('🎤 Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      onError?.('Failed to access microphone');
    }
  }, [onError]);

  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);

    // Send stop recording command
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'stop_recording',
        })
      );
    }

    console.log('🛑 Recording stopped');
  }, []);

  /**
   * Update audio level visualization
   */
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(average / 255); // Normalize to 0-1

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  /**
   * Play audio blob
   */
  const playAudioBlob = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
    };

    audio.play().catch((error) => {
      console.error('Failed to play audio:', error);
    });
  }, []);

  /**
   * Send text message (instead of voice)
   */
  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'process_text',
          text: text,
        })
      );
      setTranscript(text);
      setIsProcessing(true);
    }
  }, []);

  /**
   * Set language
   */
  const setLanguage = useCallback((language: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'set_language',
          language: language,
        })
      );
    }
  }, []);

  /**
   * Toggle TTS
   */
  const toggleTts = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'toggle_tts',
        })
      );
    }
  }, []);

  /**
   * Clear conversation
   */
  const clearConversation = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clear_conversation',
        })
      );
    }
    setTranscript('');
    setResponse('');
    setIntent(undefined);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    // State
    isConnected,
    isRecording,
    transcript,
    response,
    intent,
    confidence,
    conversationId,
    settings,
    isProcessing,
    audioLevel,

    // Actions
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
    setLanguage,
    toggleTts,
    clearConversation,
  };
}
