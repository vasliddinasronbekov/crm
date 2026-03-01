import { useState, useRef, useCallback } from 'react'

export interface VoiceRecorderState {
  isRecording: boolean
  isPaused: boolean
  recordingTime: number
  audioBlob: Blob | null
}

export interface VoiceRecorderControls {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void
}

export const useVoiceRecorder = () => {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioBlob: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<any | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      // Start recording
      mediaRecorder.start(100) // Collect data every 100ms

      // Start timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }))
      }, 1000)

      setState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        audioBlob: null,
      })
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw new Error('Microphone access denied or not available')
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null)
        return
      }

      mediaRecorder.onstop = () => {
        // Create audio blob
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        setState({
          isRecording: false,
          isPaused: false,
          recordingTime: 0,
          audioBlob,
        })

        resolve(audioBlob)
      }

      mediaRecorder.stop()
    })
  }, [])

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause()
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setState((prev) => ({ ...prev, isPaused: true }))
    }
  }, [])

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current

    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume()
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          recordingTime: prev.recordingTime + 1,
        }))
      }, 1000)
      setState((prev) => ({ ...prev, isPaused: false }))
    }
  }, [])

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    chunksRef.current = []
    mediaRecorderRef.current = null

    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioBlob: null,
    })
  }, [])

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  }
}
