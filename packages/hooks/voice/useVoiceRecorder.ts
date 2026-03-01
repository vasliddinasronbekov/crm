import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioUri: string | null;
}

export const useVoiceRecorder = () => {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioUri: null,
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      // Request audio recording permission
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Audio recording permission not granted');
      }

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;

      // Start timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }));
      }, 1000);

      setState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        audioUri: null,
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Microphone access denied or not available');
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) {
      return null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recordingRef.current.getURI();

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setState({
        isRecording: false,
        isPaused: false,
        recordingTime: 0,
        audioUri: uri,
      });

      recordingRef.current = null;

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  };

  const pauseRecording = async () => {
    if (recordingRef.current && state.isRecording) {
      try {
        await recordingRef.current.pauseAsync();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setState((prev) => ({ ...prev, isPaused: true }));
      } catch (error) {
        console.error('Failed to pause recording:', error);
      }
    }
  };

  const resumeRecording = async () => {
    if (recordingRef.current && state.isPaused) {
      try {
        await recordingRef.current.startAsync();
        timerRef.current = setInterval(() => {
          setState((prev) => ({
            ...prev,
            recordingTime: prev.recordingTime + 1,
          }));
        }, 1000);
        setState((prev) => ({ ...prev, isPaused: false }));
      } catch (error) {
        console.error('Failed to resume recording:', error);
      }
    }
  };

  const cancelRecording = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      } catch (error) {
        console.error('Failed to cancel recording:', error);
      }

      recordingRef.current = null;
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioUri: null,
    });
  };

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  };
};
