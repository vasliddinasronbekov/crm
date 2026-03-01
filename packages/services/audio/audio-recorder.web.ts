
export const webAudioRecorder = {
    start: () => {},
    stop: (): Promise<Blob | null> => {
        return Promise.resolve(null);
    },
    isRecording: false,
};
