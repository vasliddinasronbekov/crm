
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

let recording: Audio.Recording | null = null;
let _isRecording = false;

export const nativeAudioRecorder = {
  start: async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission denied');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      _isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  },

  stop: async (): Promise<Blob | null> => {
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const response = await fetch(`data:audio/m4a;base64,${base64}`);
          return await response.blob();
        }
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    }
    _isRecording = false;
    recording = null;
    return null;
  },

  get isRecording() {
    return _isRecording;
  },
};
