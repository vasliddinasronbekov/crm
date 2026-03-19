'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Mic, MicOff, Send, X, Minimize2, Maximize2, Trash2,
  Settings, Layout, Sparkles, Move,
  MessageSquare, Bot, VolumeX, Volume2, Zap, Stars, ThumbsUp, ThumbsDown
} from 'lucide-react'
import { useAI } from '@/lib/hooks/useAI'
import { usePathname } from 'next/navigation'
import toast from '@/lib/toast'
import apiService from '@/lib/api'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  intent?: string
  confidence?: number
  isVoice?: boolean
  context?: string
}

type ViewMode = 'floating' | 'docked-right' | 'docked-left' | 'docked-bottom' | 'fullscreen'
type ChatSize = 'small' | 'medium' | 'large'

interface ChatSettings {
  viewMode: ViewMode
  size: ChatSize
  autoSpeak: boolean
  showContext: boolean
  theme: 'light' | 'dark' | 'auto'
}

export default function EnhancedVoiceChat() {
  const {
    state,
    recordingState,
    startListening,
    stopListening,
    processTextCommand,
    stopSpeaking,
    clearError,
  } = useAI()

  const pathname = usePathname()

  // State
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [textInput, setTextInput] = useState('')
  const [isTextMode, setIsTextMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Settings
  const [settings, setSettings] = useState<ChatSettings>({
    viewMode: 'floating',
    size: 'medium',
    autoSpeak: true,
    showContext: true,
    theme: 'auto',
  })

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Get current page context
  const getPageContext = () => {
    const paths: Record<string, string> = {
      '/dashboard': 'Dashboard Overview',
      '/dashboard/students': 'Students Management',
      '/dashboard/teachers': 'Teachers Management',
      '/dashboard/groups': 'Groups Management',
      '/dashboard/crm': 'CRM & Leads',
      '/dashboard/lms': 'Course Management',
      '/dashboard/finance': 'Finance Control Center',
      '/dashboard/messaging': 'Messaging',
      '/dashboard/analytics': 'Analytics',
      '/dashboard/reports': 'Reports',
      '/dashboard/settings': 'Settings',
      '/dashboard/shop': 'Shop & Rewards',
      '/dashboard/events': 'Events Management',
      '/dashboard/support': 'Support Center',
      '/dashboard/email': 'Email Management',
      '/dashboard/announcements': 'Announcements',
      '/dashboard/leaderboard': 'Leaderboard',
      '/dashboard/certificates': 'Certificates Management',
    }
    return paths[pathname] || 'Dashboard'
  }

  // Auto-scroll
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

  // Handle voice response with context
  useEffect(() => {
    if (state.lastResponse && !state.isProcessing) {
      const aiMessage: Message = {
        id: Date.now().toString() + '-ai',
        type: 'ai',
        content: state.lastResponse,
        timestamp: new Date(),
        intent: state.lastIntent || undefined,
        confidence: state.lastConfidence || undefined,
        context: getPageContext(),
      }
      setMessages((prev) => [...prev, aiMessage])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastResponse, state.isProcessing])

  // Handle voice recording
  const handleVoiceClick = async () => {
    if (state.isListening) {
      const userMessage: Message = {
        id: Date.now().toString() + '-user',
        type: 'user',
        content: 'Recording...',
        timestamp: new Date(),
        isVoice: true,
        context: getPageContext(),
      }
      setMessages((prev) => [...prev, userMessage])

      const result = await stopListening()

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
      await startListening()
    }
  }

  // Handle text submission with context
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return

    const userMessage: Message = {
      id: Date.now().toString() + '-user',
      type: 'user',
      content: textInput,
      timestamp: new Date(),
      isVoice: false,
      context: getPageContext(),
    }
    setMessages((prev) => [...prev, userMessage])

    const inputText = textInput
    setTextInput('')

    try {
      const response = await apiService.sendChatMessage(inputText, messages)
      const aiMessage: Message = {
        id: Date.now().toString() + '-ai',
        type: 'ai',
        content: response.message,
        timestamp: new Date(),
        context: getPageContext(),
      }
      setMessages((prev) => [...prev, aiMessage])

      if (settings.autoSpeak && response.audio) {
        const audioBlob = new Blob([new Uint8Array(response.audio.data)], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Failed to get response from AI.')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTextSubmit()
    }
  }

  const handleClearChat = () => {
    if (confirm('Clear all conversation history?')) {
      setMessages([])
      toast.success('Chat history cleared')
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get container classes based on view mode - Responsive and flexible
  const getContainerClasses = () => {
    const base = 'bg-surface shadow-2xl border border-border/50 transition-all duration-300'

    const sizeClasses = {
      small: 'w-[90vw] sm:w-80 h-[70vh] sm:h-96 max-w-sm max-h-[500px]',
      medium: 'w-[90vw] sm:w-[32rem] h-[75vh] sm:h-[42rem] max-w-2xl max-h-[700px]',
      large: 'w-[95vw] sm:w-[48rem] h-[80vh] sm:h-[56rem] max-w-4xl max-h-[900px]',
    }

    const modeClasses: Record<ViewMode, string> = {
      'floating': `fixed right-4 sm:right-8 bottom-24 sm:bottom-32 z-50 rounded-2xl ${isMinimized ? 'w-[90vw] sm:w-96 h-16' : sizeClasses[settings.size]}`,
      'docked-right': `fixed right-0 top-0 bottom-0 z-40 ${isMinimized ? 'w-16' : 'w-full sm:w-96 md:w-[28rem]'} rounded-l-2xl`,
      'docked-left': `fixed left-0 top-0 bottom-0 z-40 ${isMinimized ? 'w-16' : 'w-full sm:w-96 md:w-[28rem]'} rounded-r-2xl`,
      'docked-bottom': `fixed bottom-0 left-0 right-0 z-40 ${isMinimized ? 'h-16' : 'h-[50vh] sm:h-96 md:h-[32rem]'} rounded-t-2xl`,
      'fullscreen': 'fixed inset-0 z-50 rounded-none',
    }

    return `${base} ${modeClasses[settings.viewMode]} overflow-hidden`
  }

  // Render chat content
  const renderChatContent = () => (
    <>
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 bg-gradient-to-b from-background to-background/50"
      >
        {/* Context Banner */}
        {settings.showContext && (
          <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 to-cyan-500/10 border border-primary/20 rounded-xl px-4 py-3 mb-4 backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Layout className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-secondary">Current Context</p>
                <p className="text-sm font-semibold text-primary">{getPageContext()}</p>
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-3 sm:px-4">
            <div className="relative mb-4 sm:mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-cyan-500/20 rounded-full blur-xl"></div>
              <div className="relative bg-gradient-to-br from-primary/20 via-cyan-500/10 to-primary/5 rounded-2xl p-6 sm:p-8 border border-primary/20">
                <Bot className="h-12 w-12 sm:h-16 sm:w-16 text-primary mx-auto" />
                <Sparkles className="h-4 w-4 sm:h-6 sm:w-6 text-cyan-400 absolute top-2 right-2 animate-pulse" />
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary absolute bottom-2 left-2 animate-bounce" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
              AI Assistant Ready
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary mb-4 sm:mb-6">
              Your intelligent companion for {getPageContext()}
            </p>
            <div className="w-full max-w-sm bg-surface rounded-2xl p-4 sm:p-6 border border-border shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Stars className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Smart Suggestions</p>
              </div>
              <ul className="text-sm text-text-secondary space-y-2">
                <li className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary/5 transition-colors">
                  <span className="text-primary">•</span>
                  <span>&quot;Summarize this page&quot;</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary/5 transition-colors">
                  <span className="text-primary">•</span>
                  <span>&quot;What can I do here?&quot;</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary/5 transition-colors">
                  <span className="text-primary">•</span>
                  <span>&quot;Show relevant data&quot;</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg hover:bg-primary/5 transition-colors">
                  <span className="text-primary">•</span>
                  <span>&quot;Help me with {getPageContext()}&quot;</span>
                </li>
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
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-3 ${
                    message.type === 'user'
                      ? 'bg-gradient-to-br from-primary via-primary/90 to-cyan-500 text-white shadow-lg shadow-primary/20'
                      : 'bg-surface text-text-primary border border-border shadow-md hover:shadow-lg transition-shadow'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {message.type === 'ai' && (
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary/20 to-cyan-500/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    {message.type === 'user' && message.isVoice && (
                      <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Mic className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                        <span className={`text-xs ${message.type === 'user' ? 'text-white/70' : 'text-text-secondary'}`}>
                          {formatTime(message.timestamp)}
                        </span>
                        {message.type === 'ai' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                apiService.logInteraction({
                                  type: 'feedback',
                                  feedback: 'positive',
                                  messageId: message.id,
                                })
                              }
                              className="text-text-secondary hover:text-success"
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                apiService.logInteraction({
                                  type: 'feedback',
                                  feedback: 'negative',
                                  messageId: message.id,
                                })
                              }
                              className="text-text-secondary hover:text-error"
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {message.intent && (
                          <span className={`text-xs px-2 py-1 rounded-lg ${
                            message.type === 'user' ? 'bg-white/20' : 'bg-primary/10 text-primary'
                          }`}>
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
              <div className="flex justify-start animate-in fade-in duration-300">
                <div className="bg-surface rounded-2xl px-5 py-4 border border-border shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary/20 to-cyan-500/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-surface p-3 sm:p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <button
            onClick={() => setIsTextMode(false)}
            className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              !isTextMode
                ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg shadow-primary/20'
                : 'bg-background border border-border text-text-secondary hover:bg-background/80 hover:border-primary/30'
            }`}
          >
            <Mic className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Voice Mode</span>
            <span className="sm:hidden">Voice</span>
          </button>
          <button
            onClick={() => setIsTextMode(true)}
            className={`flex-1 px-3 py-2 sm:px-4 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              isTextMode
                ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg shadow-primary/20'
                : 'bg-background border border-border text-text-secondary hover:bg-background/80 hover:border-primary/30'
            }`}
          >
            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Text Mode</span>
            <span className="sm:hidden">Text</span>
          </button>
        </div>

        {!isTextMode ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleVoiceClick}
              disabled={state.isProcessing}
              className={`flex-1 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-semibold transition-all flex items-center justify-center gap-2 shadow-lg ${
                state.isListening
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white animate-pulse shadow-red-500/30'
                  : 'bg-gradient-to-r from-primary to-cyan-500 text-white hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {state.isListening ? (
                <>
                  <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Stop Recording ({recordingState.recordingTime}s)</span>
                  <span className="sm:hidden">Stop ({recordingState.recordingTime}s)</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Press to Speak</span>
                  <span className="sm:hidden">Speak</span>
                </>
              )}
            </button>
            {state.isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="px-3 py-3 sm:px-5 sm:py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-xl hover:shadow-red-500/30 transition-all hover:scale-105"
                title="Stop speaking"
              >
                <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Ask about ${getPageContext()}...`}
              disabled={state.isProcessing}
              className="flex-1 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 text-sm sm:text-base bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 placeholder:text-text-secondary/50"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || state.isProcessing}
              className="px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
            >
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Floating Chat Button - Completely Redesigned */}
      {!isOpen && (
        <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-50">
          {/* Animated rings for attention */}
          {(state.isListening || state.isProcessing) && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
              <div className="absolute inset-0 rounded-full bg-primary/30 animate-pulse"></div>
            </>
          )}

          {/* Main Button */}
          <button
            onClick={() => setIsOpen(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`relative group transition-all duration-300 ${
              isHovered ? 'scale-110' : 'scale-100'
            }`}
            title="AI Voice Assistant"
          >
            {/* Gradient glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-cyan-500 to-primary rounded-full opacity-75 group-hover:opacity-100 blur-lg transition-opacity"></div>

            {/* Button background with gradient */}
            <div className={`relative flex items-center gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 rounded-full shadow-2xl transition-all duration-300 ${
              state.isListening
                ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse'
                : state.isProcessing
                ? 'bg-gradient-to-r from-primary/80 to-cyan-500/80'
                : 'bg-gradient-to-r from-primary to-cyan-500 hover:from-cyan-500 hover:to-primary'
            }`}>
              {/* Icon with animation */}
              <div className="relative">
                {state.isListening ? (
                  <MicOff className="h-5 w-5 sm:h-6 sm:w-6 text-white animate-pulse" />
                ) : state.isProcessing ? (
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                ) : (
                  <>
                    <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    <Sparkles className="h-3 w-3 text-white absolute -top-1 -right-1 animate-pulse" />
                  </>
                )}
              </div>

              {/* Text label - Hidden on mobile, shows on hover on desktop */}
              <div className={`hidden sm:block overflow-hidden transition-all duration-300 ${
                isHovered ? 'max-w-xs opacity-100' : 'max-w-0 opacity-0'
              }`}>
                <span className="text-white font-semibold whitespace-nowrap text-sm sm:text-base">
                  {state.isListening
                    ? 'Listening...'
                    : state.isProcessing
                    ? 'Processing...'
                    : 'AI Assistant'}
                </span>
              </div>

              {/* Status indicator */}
              {(state.isListening || state.isProcessing) && (
                <div className="absolute -top-1 -right-1">
                  <span className="flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
                  </span>
                </div>
              )}
            </div>
          </button>

          {/* Quick status badge */}
          {messages.length > 0 && !state.isListening && !state.isProcessing && (
            <div className="absolute -top-2 -left-2 bg-gradient-to-r from-primary to-cyan-500 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center shadow-lg border-2 border-background">
              {messages.length}
            </div>
          )}
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={getContainerClasses()}>
          {/* Header - Redesigned */}
          <div className="relative overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-cyan-500 to-primary"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>

            {/* Animated particles */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-cyan-300/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Content */}
            <div className="relative px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  {state.isListening && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                  )}
                  {state.isListening && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg flex items-center gap-1 sm:gap-2">
                    <span className="hidden sm:inline">AI Assistant</span>
                    <span className="sm:hidden">AI</span>
                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 animate-pulse" />
                  </h3>
                  <p className="text-xs text-white/80 font-medium">
                    {state.isListening
                      ? '🎤 Listening...'
                      : state.isProcessing
                      ? '🧠 Thinking...'
                      : state.isSpeaking
                      ? '🔊 Speaking...'
                      : `📍 ${settings.viewMode}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="hover:bg-white/20 rounded-lg sm:rounded-xl p-1.5 sm:p-2 transition-all hover:scale-110 backdrop-blur-sm"
                  title="Settings"
                >
                  <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  onClick={handleClearChat}
                  className="hover:bg-white/20 rounded-lg sm:rounded-xl p-1.5 sm:p-2 transition-all hover:scale-110 backdrop-blur-sm"
                  title="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="hover:bg-white/20 rounded-lg sm:rounded-xl p-1.5 sm:p-2 transition-all hover:scale-110 backdrop-blur-sm"
                  title={isMinimized ? 'Maximize' : 'Minimize'}
                >
                  {isMinimized ? (
                    <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-white/20 rounded-lg sm:rounded-xl p-1.5 sm:p-2 transition-all hover:scale-110 backdrop-blur-sm"
                  title="Close"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Settings Panel - Enhanced */}
          {showSettings && !isMinimized && (
            <div className="border-b border-border bg-gradient-to-r from-background to-background/50 p-5 space-y-4">
              <div>
                <label className="text-xs font-bold mb-3 block text-text-secondary uppercase tracking-wide flex items-center gap-2">
                  <Layout className="h-3 w-3" />
                  View Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['floating', 'docked-right', 'docked-left', 'docked-bottom', 'fullscreen'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSettings({ ...settings, viewMode: mode })}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        settings.viewMode === mode
                          ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg shadow-primary/20'
                          : 'bg-surface border border-border hover:border-primary/50 text-text-secondary hover:bg-primary/5'
                      }`}
                    >
                      {mode.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border">
                <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Show Context
                </label>
                <button
                  onClick={() => setSettings({ ...settings, showContext: !settings.showContext })}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    settings.showContext ? 'bg-gradient-to-r from-primary to-cyan-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    settings.showContext ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Chat Content */}
          {!isMinimized && renderChatContent()}
        </div>
      )}
    </>
  )
}
