'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Loader2, Volume2, VolumeX, X, Send } from 'lucide-react'
import { api } from '@/lib/api'

type AIState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'

interface UnifiedAIAssistantProps {
  isOpen: boolean
  onClose: () => void
}

export default function UnifiedAIAssistant({ isOpen, onClose }: UnifiedAIAssistantProps) {
  const [aiState, setAiState] = useState<AIState>('IDLE')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<Array<{
    role: 'user' | 'assistant'
    text: string
    timestamp: Date
  }>>([])

  const [textInput, setTextInput] = useState('')
  const conversationId = useRef<string>('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Generate conversation ID on mount
  useEffect(() => {
    if (isOpen && !conversationId.current) {
      conversationId.current = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }, [isOpen])

  // Cleanup on unmount
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

  const startVoiceRecording = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

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

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setAiState('LISTENING')
    } catch (err) {
      setError('Microphone access denied')
      console.error('Microphone error:', err)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const processVoiceCommand = async (audioBlob: Blob) => {
    setAiState('PROCESSING')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice_command.wav')
      formData.append('conversation_id', conversationId.current)

      const result = await api.post('/api/v1/ai/voice-command/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const data = result.data

      // Add to conversation history
      if (data.response) {
        setConversationHistory(prev => [
          ...prev,
          {
            role: 'user',
            text: data.transcript || transcript,
            timestamp: new Date()
          },
          {
            role: 'assistant',
            text: data.response,
            timestamp: new Date()
          }
        ])
      }

      setResponse(data.response || 'No response')

      // Handle navigation
      if (data.action_type === 'navigate' && data.target) {
        setTimeout(() => {
          window.location.href = data.target
        }, 1000)
      }

      // Speak response if TTS available and not muted
      if (data.response && !isMuted) {
        await speakResponse(data.response, data.language || 'en')
      } else {
        setAiState('IDLE')
      }

    } catch (err: any) {
      setError(err.response?.data?.detail || 'AI processing failed')
      setAiState('IDLE')
      console.error('AI command error:', err)
    }
  }

  const processTextCommand = async (text: string) => {
    if (!text.trim()) return

    setAiState('PROCESSING')
    setTranscript(text)
    setTextInput('')

    try {
      const result = await api.post('/api/v1/ai/voice-command/', {
        text: text,
        conversation_id: conversationId.current
      })

      const data = result.data

      // Add to conversation history
      setConversationHistory(prev => [
        ...prev,
        {
          role: 'user',
          text: text,
          timestamp: new Date()
        },
        {
          role: 'assistant',
          text: data.response,
          timestamp: new Date()
        }
      ])

      setResponse(data.response || 'No response')

      // Handle navigation
      if (data.action_type === 'navigate' && data.target) {
        setTimeout(() => {
          window.location.href = data.target
        }, 1000)
      }

      // Speak response if not muted
      if (data.response && !isMuted) {
        await speakResponse(data.response, data.language || 'en')
      } else {
        setAiState('IDLE')
      }

    } catch (err: any) {
      setError(err.response?.data?.detail || 'AI processing failed')
      setAiState('IDLE')
      console.error('AI command error:', err)
    }
  }

  const speakResponse = async (text: string, language: string = 'en') => {
    setAiState('SPEAKING')

    try {
      const result = await api.post('/api/v1/ai/tts/', {
        text: text,
        language: language
      }, {
        responseType: 'blob'
      })

      const audioBlob = new Blob([result.data], { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(audioBlob)

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setAiState('IDLE')
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        setAiState('IDLE')
        URL.revokeObjectURL(audioUrl)
      }

      await audio.play()

    } catch (err) {
      console.error('TTS error:', err)
      setAiState('IDLE')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      processTextCommand(textInput)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop with blur effect (Block 4.2) */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm bg-black/30 transition-all duration-300"
        onClick={onClose}
      />

      {/* AI Assistant Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`
                w-3 h-3 rounded-full transition-all duration-300
                ${aiState === 'IDLE' ? 'bg-gray-500' : ''}
                ${aiState === 'LISTENING' ? 'bg-blue-500 animate-pulse' : ''}
                ${aiState === 'PROCESSING' ? 'bg-yellow-500 animate-pulse' : ''}
                ${aiState === 'SPEAKING' ? 'bg-green-500 animate-pulse' : ''}
              `} />
              <h2 className="text-xl font-bold text-text-primary">
                AI Assistant
              </h2>
              <span className="text-sm text-text-secondary">
                {aiState === 'IDLE' && 'Ready'}
                {aiState === 'LISTENING' && 'Listening...'}
                {aiState === 'PROCESSING' && 'Processing...'}
                {aiState === 'SPEAKING' && 'Speaking...'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Mute Toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-text-secondary" />
                ) : (
                  <Volume2 className="w-5 h-5 text-text-secondary" />
                )}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          </div>

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {conversationHistory.length === 0 && (
              <div className="text-center text-text-secondary py-8">
                <p className="text-lg font-medium mb-2">How can I help you?</p>
                <p className="text-sm">
                  Try: "What is student balance?", "Go to students page", or "How many seats in room 101?"
                </p>
              </div>
            )}

            {conversationHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-[80%] rounded-2xl px-4 py-3
                  ${msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-surface-elevated text-text-primary border border-border'
                  }
                `}>
                  <p className="text-sm">{msg.text}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-border">
            <div className="flex items-center gap-3">
              {/* Voice Input Button */}
              <button
                onClick={aiState === 'LISTENING' ? stopVoiceRecording : startVoiceRecording}
                disabled={aiState === 'PROCESSING' || aiState === 'SPEAKING'}
                className={`
                  p-4 rounded-full transition-all duration-300
                  ${aiState === 'LISTENING'
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-primary hover:bg-primary-hover'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {aiState === 'PROCESSING' || aiState === 'SPEAKING' ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : aiState === 'LISTENING' ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your command or question..."
                disabled={aiState === 'PROCESSING' || aiState === 'SPEAKING'}
                className="flex-1 px-4 py-3 bg-surface-elevated border border-border rounded-lg
                         text-text-primary placeholder-text-secondary
                         focus:outline-none focus:ring-2 focus:ring-primary
                         disabled:opacity-50"
              />

              {/* Send Button */}
              <button
                onClick={() => processTextCommand(textInput)}
                disabled={!textInput.trim() || aiState === 'PROCESSING' || aiState === 'SPEAKING'}
                className="p-3 bg-primary hover:bg-primary-hover rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              {['Go to students', 'Show my schedule', 'Check payments', 'Open analytics'].map((quick) => (
                <button
                  key={quick}
                  onClick={() => processTextCommand(quick)}
                  disabled={aiState === 'PROCESSING' || aiState === 'SPEAKING'}
                  className="px-3 py-1.5 text-xs bg-surface-elevated hover:bg-surface-hover
                           border border-border rounded-lg text-text-secondary
                           transition-colors disabled:opacity-50"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
