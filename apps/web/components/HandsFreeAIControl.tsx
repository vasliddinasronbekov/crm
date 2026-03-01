'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Loader2, Volume2, VolumeX, X } from 'lucide-react'
import { api } from '@/lib/api'

type AIState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'

interface ProcessStep {
  name: string
  status: 'pending' | 'active' | 'complete' | 'error'
  message: string
  timestamp: Date
}

interface HandsFreeAIControlProps {
  isOpen: boolean
  onClose: () => void
}

export default function HandsFreeAIControl({ isOpen, onClose }: HandsFreeAIControlProps) {
  const [aiState, setAiState] = useState<AIState>('IDLE')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [isMuted, setIsMuted] = useState(false)

  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([])
  const [currentStep, setCurrentStep] = useState<string>('')

  const conversationId = useRef<string>('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Generate conversation ID
  useEffect(() => {
    if (isOpen && !conversationId.current) {
      conversationId.current = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }, [isOpen])

  // Cleanup
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const addProcessStep = (name: string, message: string, status: ProcessStep['status'] = 'active') => {
    setProcessSteps(prev => [...prev, {
      name,
      status,
      message,
      timestamp: new Date()
    }])
    setCurrentStep(name)
  }

  const updateProcessStep = (name: string, status: ProcessStep['status'], message?: string) => {
    setProcessSteps(prev => prev.map(step =>
      step.name === name
        ? { ...step, status, message: message || step.message }
        : step
    ))
    if (status === 'complete') {
      setCurrentStep('')
    }
  }

  const startVoiceRecording = async () => {
    try {
      setError('')
      setProcessSteps([])
      setTranscript('')
      setResponse('')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      addProcessStep('microphone', 'Microphone activated', 'complete')

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        await processVoiceCommand(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setAiState('LISTENING')
      addProcessStep('listening', 'Listening to your voice...', 'active')
    } catch (err) {
      setError('Microphone access denied')
      addProcessStep('microphone', 'Failed to access microphone', 'error')
      console.error('Microphone error:', err)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      updateProcessStep('listening', 'complete', 'Voice captured successfully')
    }
  }

  const processVoiceCommand = async (audioBlob: Blob) => {
    setAiState('PROCESSING')
    addProcessStep('stt', 'Converting speech to text...', 'active')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice_command.wav')
      formData.append('conversation_id', conversationId.current)

      const result = await api.post('/v1/ai/voice-command/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const data = result.data
      updateProcessStep('stt', 'complete', `Recognized: "${data.transcript || 'No transcript'}"`)

      setTranscript(data.transcript || '')
      addProcessStep('intent', 'Analyzing command intent...', 'active')

      setTimeout(() => {
        updateProcessStep('intent', 'complete', `Intent: ${data.action_type || 'unknown'}`)

        if (data.action_type === 'data_retrieval') {
          addProcessStep('data', 'Retrieving data...', 'active')
          setTimeout(() => {
            updateProcessStep('data', 'complete', 'Data retrieved successfully')
            setResponse(data.response)

            if (!isMuted && data.response) {
              speakResponse(data.response, data.language || 'en')
            } else {
              setAiState('IDLE')
            }
          }, 500)
        } else if (data.action_type === 'navigate') {
          addProcessStep('navigate', `Navigating to ${data.target}`, 'active')
          setResponse(data.response)
          setTimeout(() => {
            updateProcessStep('navigate', 'complete', 'Navigation started')
            window.location.href = data.target
          }, 1000)
        } else {
          setResponse(data.response || 'Command processed')

          if (!isMuted && data.response) {
            speakResponse(data.response, data.language || 'en')
          } else {
            setAiState('IDLE')
          }
        }
      }, 300)

    } catch (err: any) {
      setError(err.response?.data?.detail || 'AI processing failed')
      updateProcessStep('stt', 'error', 'Processing failed')
      setAiState('IDLE')
      console.error('AI command error:', err)
    }
  }

  const speakResponse = async (text: string, language: string = 'en') => {
    setAiState('SPEAKING')
    addProcessStep('tts', 'Generating voice response...', 'active')

    try {
      const result = await api.post('/v1/ai/tts/', {
        text: text,
        language: language
      }, {
        responseType: 'blob'
      })

      updateProcessStep('tts', 'complete', 'Voice generated')

      const audioBlob = new Blob([result.data], { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(audioBlob)

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      addProcessStep('speaking', 'Playing voice response...', 'active')

      audio.onended = () => {
        updateProcessStep('speaking', 'complete', 'Response delivered')
        setAiState('IDLE')
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        updateProcessStep('speaking', 'error', 'Playback failed')
        setAiState('IDLE')
        URL.revokeObjectURL(audioUrl)
      }

      await audio.play()

    } catch (err) {
      console.error('TTS error:', err)
      updateProcessStep('tts', 'error', 'Voice generation failed')
      setAiState('IDLE')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Mute Toggle */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute top-8 right-24 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
      >
        {isMuted ? (
          <VolumeX className="w-6 h-6 text-white" />
        ) : (
          <Volume2 className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Main Content */}
      <div className="h-full flex flex-col items-center justify-center p-8">

        {/* Status Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            AI Hands-Free Control
          </h1>
          <div className="flex items-center justify-center gap-4">
            <div className={`
              w-4 h-4 rounded-full transition-all duration-300
              ${aiState === 'IDLE' ? 'bg-gray-400' : ''}
              ${aiState === 'LISTENING' ? 'bg-blue-500 animate-pulse scale-150' : ''}
              ${aiState === 'PROCESSING' ? 'bg-yellow-500 animate-pulse scale-150' : ''}
              ${aiState === 'SPEAKING' ? 'bg-green-500 animate-pulse scale-150' : ''}
            `} />
            <span className="text-3xl text-white/90 font-medium">
              {aiState === 'IDLE' && 'Ready for command'}
              {aiState === 'LISTENING' && 'Listening...'}
              {aiState === 'PROCESSING' && 'Processing...'}
              {aiState === 'SPEAKING' && 'Speaking...'}
            </span>
          </div>
        </div>

        {/* Main Voice Button */}
        <div className="mb-12">
          <button
            onClick={aiState === 'LISTENING' ? stopVoiceRecording : startVoiceRecording}
            disabled={aiState === 'PROCESSING' || aiState === 'SPEAKING'}
            className={`
              relative w-64 h-64 rounded-full transition-all duration-500
              ${aiState === 'LISTENING'
                ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-2xl shadow-red-500/50 scale-110'
                : 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl shadow-blue-500/50 hover:scale-105'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center
            `}
          >
            {aiState === 'PROCESSING' || aiState === 'SPEAKING' ? (
              <Loader2 className="w-32 h-32 text-white animate-spin" />
            ) : aiState === 'LISTENING' ? (
              <div className="relative">
                <MicOff className="w-32 h-32 text-white" />
                <div className="absolute inset-0 animate-ping">
                  <div className="w-full h-full bg-red-400 rounded-full opacity-75"></div>
                </div>
              </div>
            ) : (
              <Mic className="w-32 h-32 text-white" />
            )}
          </button>

          <p className="text-center text-white/70 text-xl mt-6">
            {aiState === 'LISTENING' ? 'Click to stop recording' : 'Click to speak'}
          </p>
        </div>

        {/* Transcript Display */}
        {transcript && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8 max-w-4xl w-full">
            <p className="text-sm text-white/60 mb-2">You said:</p>
            <p className="text-3xl text-white font-medium">{transcript}</p>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-md rounded-2xl p-8 mb-8 max-w-4xl w-full border border-white/20">
            <p className="text-sm text-white/60 mb-2">AI Response:</p>
            <p className="text-3xl text-white font-medium">{response}</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-md rounded-2xl p-6 mb-8 max-w-4xl w-full border border-red-500/50">
            <p className="text-xl text-red-200">{error}</p>
          </div>
        )}

        {/* Process Steps */}
        {processSteps.length > 0 && (
          <div className="bg-black/30 backdrop-blur-md rounded-2xl p-8 max-w-4xl w-full">
            <h3 className="text-2xl text-white font-semibold mb-6">Processing Steps</h3>
            <div className="space-y-4">
              {processSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {step.status === 'pending' && (
                      <div className="w-6 h-6 rounded-full border-2 border-white/30"></div>
                    )}
                    {step.status === 'active' && (
                      <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
                    )}
                    {step.status === 'complete' && (
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {step.status === 'error' && (
                      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="flex-1">
                    <p className={`text-lg font-medium ${
                      step.status === 'error' ? 'text-red-300' :
                      step.status === 'complete' ? 'text-green-300' :
                      step.status === 'active' ? 'text-yellow-300' :
                      'text-white/50'
                    }`}>
                      {step.message}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="text-sm text-white/40">
                    {step.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
