
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const soundRef = { current: null as Audio.Sound | null };

export const nativeAudioPlayer = {
  play: async (blob: Blob) => {
    try {
      // Clean up previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        // Save to temp file
        const tempUri = `${FileSystem.cacheDirectory}tts_response.mp3`;
        await FileSystem.writeAsStringAsync(tempUri, base64.split(',')[1], {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Play audio
        const { sound } = await Audio.Sound.createAsync({ uri: tempUri });
        soundRef.current = sound;

        await sound.playAsync();

        // Clean up after playback
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
            FileSystem.deleteAsync(tempUri, { idempotent: true });
          }
        });
      };
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  },
};
