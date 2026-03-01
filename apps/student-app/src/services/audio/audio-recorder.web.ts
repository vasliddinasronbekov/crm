
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let _isRecording = false;

export const webAudioRecorder = {
  start: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      mediaRecorder.start();
      _isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  },

  stop: async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (mediaRecorder) {
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          audioChunks = [];
          _isRecording = false;
          mediaRecorder = null;
          resolve(audioBlob);
        };
        mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });
  },

  get isRecording() {
    return _isRecording;
  },
};
