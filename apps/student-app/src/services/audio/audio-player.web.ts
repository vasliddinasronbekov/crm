
export const webAudioPlayer = {
  play: async (blob: Blob) => {
    try {
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  },
};
