import { useState, useCallback, useRef } from 'react'
import apiService from '../api'
import { useVoiceRecorder } from './useVoiceRecorder'

export interface VoiceControlState {
  isListening: boolean
  isProcessing: boolean
  isSpeaking: boolean
  lastTranscript: string | null
  lastIntent: string | null
  lastResponse: string | null
  lastConfidence: number | null
  error: string | null
}

export interface VoiceControlResult {
  intent: string
  confidence: number
  message: string
  data?: any
}

export const useVoiceControl = () => {
  const [state, setState] = useState<VoiceControlState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    lastTranscript: null,
    lastIntent: null,
    lastResponse: null,
    lastConfidence: null,
    error: null,
  })

  const recorder = useVoiceRecorder()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Start listening
  const startListening = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null, isListening: true }))
      await recorder.startRecording()
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: error.message || 'Failed to start recording',
      }))
    }
  }, [recorder])

  // Stop listening and process command
  const stopListening = useCallback(async (): Promise<VoiceControlResult | null> => {
    try {
      setState((prev) => ({ ...prev, isListening: false, isProcessing: true }))

      // Stop recording and get audio blob
      const audioBlob = await recorder.stopRecording()

      if (!audioBlob) {
        throw new Error('No audio recorded')
      }

      // Process voice command through backend
      const result = await apiService.processVoiceCommand(audioBlob)

      // Update state with results
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        lastTranscript: result.message,
        lastIntent: result.intent,
        lastResponse: result.message,
        lastConfidence: result.confidence,
        error: null,
      }))

      // Play audio response if available
      if (result.audio) {
        await playAudioResponse(result.audio)
      }

      return {
        intent: result.intent,
        confidence: result.confidence,
        message: result.message,
        data: result.data,
      }
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isListening: false,
        isProcessing: false,
        error: error.message || 'Failed to process voice command',
      }))
      return null
    }
  }, [recorder])

  // Cancel listening
  const cancelListening = useCallback(() => {
    recorder.cancelRecording()
    setState((prev) => ({
      ...prev,
      isListening: false,
      isProcessing: false,
      error: null,
    }))
  }, [recorder])

  // Play audio response
  const playAudioResponse = useCallback(async (audioBlob: Blob) => {
    try {
      setState((prev) => ({ ...prev, isSpeaking: true }))

      // Create audio URL
      const audioUrl = URL.createObjectURL(audioBlob)

      // Create or reuse audio element
      if (!audioRef.current) {
        audioRef.current = new Audio()
      }

      const audio = audioRef.current
      audio.src = audioUrl

      // Play audio
      await audio.play()

      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
      })

      setState((prev) => ({ ...prev, isSpeaking: false }))
    } catch (error) {
      console.error('Failed to play audio response:', error)
      setState((prev) => ({ ...prev, isSpeaking: false }))
    }
  }, [])

  // Speak text (TTS only)
  const speak = useCallback(async (text: string, language: string = 'uz') => {
    try {
      setState((prev) => ({ ...prev, isSpeaking: true, error: null }))

      const audioBlob = await apiService.textToSpeech(text, language)
      await playAudioResponse(audioBlob)
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isSpeaking: false,
        error: error.message || 'Failed to generate speech',
      }))
    }
  }, [playAudioResponse])

  // Process text command (without voice input)
  const processTextCommand = useCallback(
    async (text: string): Promise<VoiceControlResult | null> => {
      try {
        setState((prev) => ({ ...prev, isProcessing: true, error: null }))

        const result = await apiService.processIntent(text)

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          lastTranscript: text,
          lastIntent: result.nlu?.intent || 'unknown',
          lastResponse: result.result?.message || text,
          lastConfidence: result.nlu?.confidence || 0,
          error: null,
        }))

        // Play audio response if available
        if (result.result?.message) {
          const audioBlob = await apiService.textToSpeech(result.result.message)
          await playAudioResponse(audioBlob)
        }

        return {
          intent: result.nlu?.intent || 'unknown',
          confidence: result.nlu?.confidence || 0,
          message: result.result?.message || text,
          data: result.result?.data,
        }
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: error.message || 'Failed to process text command',
        }))
        return null
      }
    },
    [playAudioResponse]
  )

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setState((prev) => ({ ...prev, isSpeaking: false }))
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    state,
    recordingState: recorder.state,
    startListening,
    stopListening,
    cancelListening,
    speak,
    stopSpeaking,
    processTextCommand,
    clearError,
  }
}
