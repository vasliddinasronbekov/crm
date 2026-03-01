'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Send, Volume2, VolumeX, X, Minimize2, Maximize2, Trash2 } from 'lucide-react'
import { useVoiceControl } from '@/lib/hooks/useVoiceControl'
import toast from '@/lib/toast'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  intent?: string
  confidence?: number
  isVoice?: boolean
}

export default function VoiceChatBox() {
  const {
    state,
    recordingState,
    startListening,
    stopListening,
    processTextCommand,
    stopSpeaking,
    clearError,
  } = useVoiceControl()

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [textInput, setTextInput] = useState('')
  const [isTextMode, setIsTextMode] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new message arrives
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Show toast for errors
  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    }
  }, [state.error])

  // Handle voice response
  useEffect(() => {
    if (state.lastResponse && !state.isProcessing) {
      // Add AI response to chat
      const aiMessage: Message = {
        id: Date.now().toString() + '-ai',
        type: 'ai',
        content: state.lastResponse,
        timestamp: new Date(),
        intent: state.lastIntent || undefined,
        confidence: state.lastConfidence || undefined,
      }
      setMessages((prev) => [...prev, aiMessage])
    }
  }, [state.lastResponse, state.isProcessing])

  // Handle voice recording
  const handleVoiceClick = async () => {
    if (state.isListening) {
      // Stop listening and process
      const userMessage: Message = {
        id: Date.now().toString() + '-user',
        type: 'user',
        content: 'Recording...',
        timestamp: new Date(),
        isVoice: true,
      }
      setMessages((prev) => [...prev, userMessage])

      const result = await stopListening()

      // Update the user message with transcript
      if (result && result.message) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id
              ? { ...msg, content: result.message }
              : msg
          )
        )
      }
    } else {
      // Start listening
      await startListening()
    }
  }

  // Handle text submission
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString() + '-user',
      type: 'user',
      content: textInput,
      timestamp: new Date(),
      isVoice: false,
    }
    setMessages((prev) => [...prev, userMessage])

    // Clear input
    const inputText = textInput
    setTextInput('')

    // Process command
    await processTextCommand(inputText)
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTextSubmit()
    }
  }

  // Clear chat history
  const handleClearChat = () => {
    if (confirm('Clear all conversation history?')) {
      setMessages([])
      toast.success('Chat history cleared')
    }
  }

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-8 right-8 z-50 p-4 rounded-full shadow-lg transition-all duration-300 ${
          state.isListening
            ? 'bg-error text-white animate-pulse'
            : state.isProcessing
            ? 'bg-primary/50 text-white'
            : 'bg-primary text-background hover:bg-primary/90'
        }`}
        title="AI Voice Assistant"
      >
        {state.isListening ? (
          <MicOff className="h-6 w-6 animate-pulse" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed right-8 z-50 bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden transition-all duration-300 ${
            isMinimized
              ? 'bottom-24 w-96 h-16'
              : 'bottom-24 w-[32rem] h-[42rem]'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary/80 text-background px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Mic className="h-5 w-5" />
                {state.isListening && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-error rounded-full animate-ping"></span>
                )}
              </div>
              <div>
                <h3 className="font-semibold">AI Voice Assistant</h3>
                <p className="text-xs opacity-80">
                  {state.isListening
                    ? 'Listening...'
                    : state.isProcessing
                    ? 'Processing...'
                    : state.isSpeaking
                    ? 'Speaking...'
                    : 'Ready to help'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearChat}
                className="hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                title={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-lg p-1.5 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          {!isMinimized && (
            <>
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100%-10rem)] bg-background"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="bg-primary/10 rounded-full p-6 mb-4">
                      <Mic className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                    <p className="text-sm text-text-secondary mb-4">
                      Click the microphone or type a message
                    </p>
                    <div className="text-left bg-surface rounded-xl p-4 max-w-sm">
                      <p className="text-xs font-medium mb-2">Try saying:</p>
                      <ul className="text-xs text-text-secondary space-y-1">
                        <li>• &quot;Show my schedule&quot;</li>
                        <li>• &quot;How many students do I have?&quot;</li>
                        <li>• &quot;Check payment status&quot;</li>
                        <li>• &quot;List all groups&quot;</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.type === 'user'
                              ? 'bg-primary text-background'
                              : 'bg-surface text-text-primary border border-border'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {message.type === 'user' && message.isVoice && (
                              <Mic className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                              <div className="flex items-center justify-between mt-1 gap-2">
                                <span className="text-xs opacity-70">
                                  {formatTime(message.timestamp)}
                                </span>
                                {message.intent && (
                                  <span className="text-xs opacity-70">
                                    {message.intent}
                                    {message.confidence && (
                                      <span className="ml-1">
                                        ({Math.round(message.confidence * 100)}%)
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Typing indicator */}
                    {state.isProcessing && (
                      <div className="flex justify-start">
                        <div className="bg-surface rounded-2xl px-4 py-3 border border-border">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Error Display */}
              {state.error && (
                <div className="px-4 py-2 bg-error/10 border-t border-error/20">
                  <div className="flex items-start gap-2">
                    <span className="text-error text-sm">⚠️</span>
                    <p className="text-xs text-error flex-1">{state.error}</p>
                    <button
                      onClick={clearError}
                      className="text-error hover:text-error/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="border-t border-border bg-surface p-4">
                {/* Mode Toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setIsTextMode(false)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      !isTextMode
                        ? 'bg-primary text-background'
                        : 'bg-background text-text-secondary hover:bg-background/80'
                    }`}
                  >
                    <Mic className="h-4 w-4 inline mr-2" />
                    Voice
                  </button>
                  <button
                    onClick={() => setIsTextMode(true)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isTextMode
                        ? 'bg-primary text-background'
                        : 'bg-background text-text-secondary hover:bg-background/80'
                    }`}
                  >
                    <Send className="h-4 w-4 inline mr-2" />
                    Text
                  </button>
                </div>

                {/* Voice Mode */}
                {!isTextMode && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleVoiceClick}
                      disabled={state.isProcessing}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        state.isListening
                          ? 'bg-error text-white animate-pulse'
                          : 'bg-primary text-background hover:bg-primary/90'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {state.isListening ? (
                        <>
                          <MicOff className="h-5 w-5" />
                          Stop Recording ({recordingState.recordingTime}s)
                        </>
                      ) : (
                        <>
                          <Mic className="h-5 w-5" />
                          Hold to Speak
                        </>
                      )}
                    </button>
                    {state.isSpeaking && (
                      <button
                        onClick={stopSpeaking}
                        className="px-4 py-3 bg-error text-white rounded-xl hover:bg-error/90 transition-colors"
                        title="Stop speaking"
                      >
                        <VolumeX className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Text Mode */}
                {isTextMode && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      disabled={state.isProcessing}
                      className="flex-1 px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                    />
                    <button
                      onClick={handleTextSubmit}
                      disabled={!textInput.trim() || state.isProcessing}
                      className="px-4 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
