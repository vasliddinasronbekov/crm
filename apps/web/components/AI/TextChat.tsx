/**
 * Text Chat Component - Redesigned 2025
 *
 * Modern, flexible, responsive text chat interface
 * - Tailwind CSS for styling
 * - Fully responsive (mobile-first)
 * - Inner scroll for messages
 * - Adaptive layouts
 * - Glass morphism design
 */
'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Send, Mic, Trash2, Loader2, Sparkles, MessageSquare,
  Bot, User, Wifi, WifiOff, Zap, Lightbulb
} from 'lucide-react'
import { useTextChat, ChatMessage } from '@/hooks/useTextChat'

export interface TextChatProps {
  showSuggestions?: boolean
  enableVoiceInput?: boolean
  placeholder?: string
  className?: string
}

export function TextChat({
  showSuggestions = true,
  enableVoiceInput = true,
  placeholder = 'Type your message...',
  className = '',
}: TextChatProps) {
  const [inputText, setInputText] = useState('')
  const [showVoiceMode, setShowVoiceMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const textChat = useTextChat()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [textChat.messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSendMessage = () => {
    if (inputText.trim()) {
      textChat.sendMessage(inputText)
      setInputText('')
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className={`flex flex-col h-full max-h-screen ${className}`}>
      {/* Container with glass morphism */}
      <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-gradient-to-br from-surface/95 via-surface to-surface/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/50 overflow-hidden">

        {/* Header */}
        <div className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5"></div>

          {/* Animated particles */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1.2s' }}></div>
          </div>

          {/* Header content */}
          <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Connection status indicator */}
              <div className="relative">
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-all ${
                  textChat.isConnected
                    ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30'
                    : 'bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30'
                }`}>
                  {textChat.isConnected ? (
                    <Wifi className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                  )}
                </div>
                {textChat.isConnected && (
                  <>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></span>
                  </>
                )}
              </div>

              {/* Title */}
              <div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
                  AI Chat Assistant
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-pulse" />
                </h2>
                <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                  {textChat.isConnected ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      Online
                    </span>
                  ) : (
                    'Offline'
                  )}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {textChat.conversationId && (
                <button
                  onClick={textChat.clearConversation}
                  className="p-2 sm:p-2.5 rounded-xl bg-background/50 hover:bg-background border border-border/50 hover:border-error/50 transition-all hover:scale-105"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-text-secondary hover:text-error transition-colors" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area - With inner scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-background/50 to-background/30 scroll-smooth">
          {/* Empty state */}
          {textChat.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-primary/10 via-purple-500/5 to-primary/5 rounded-3xl p-8 sm:p-12 border border-primary/20">
                  <Bot className="h-16 w-16 sm:h-20 sm:w-20 text-primary mx-auto" />
                  <Sparkles className="h-6 w-6 text-purple-400 absolute top-2 right-2 animate-pulse" />
                  <Zap className="h-5 w-5 text-primary absolute bottom-2 left-2 animate-bounce" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Hello! How can I help you today?
              </h3>
              <p className="text-sm sm:text-base text-text-secondary mb-6 max-w-md">
                Ask me about your schedule, payments, grades, or anything else!
              </p>
              <div className="flex flex-wrap gap-2 justify-center text-xs sm:text-sm text-text-secondary">
                <span className="px-3 py-1.5 bg-surface rounded-lg border border-border">📊 Analytics</span>
                <span className="px-3 py-1.5 bg-surface rounded-lg border border-border">💬 Chat</span>
                <span className="px-3 py-1.5 bg-surface rounded-lg border border-border">🎯 Smart AI</span>
              </div>
            </div>
          )}

          {/* Messages */}
          {textChat.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
            />
          ))}

          {/* Typing Indicator */}
          {textChat.isTyping && (
            <div className="flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="bg-surface rounded-2xl rounded-tl-sm px-4 py-3 sm:px-5 sm:py-4 border border-border/50 shadow-md">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Smart Suggestions */}
        {showSuggestions && textChat.suggestions.length > 0 && (
          <div className="border-t border-border/50 bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-primary" />
              <p className="text-xs sm:text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Suggestions
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {textChat.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => textChat.sendSuggestion(suggestion)}
                  className="px-3 py-2 text-xs sm:text-sm bg-surface border border-border hover:border-primary/50 rounded-xl transition-all hover:scale-105 hover:bg-primary/5 text-text-secondary hover:text-primary font-medium"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border/50 bg-gradient-to-r from-surface/95 to-surface/90 backdrop-blur-sm p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={!textChat.isConnected}
              className="flex-1 px-4 py-3 sm:py-4 text-sm sm:text-base bg-background border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50 placeholder:text-text-secondary/50"
            />

            {enableVoiceInput && (
              <button
                onClick={() => setShowVoiceMode(!showVoiceMode)}
                className={`p-3 sm:p-4 rounded-2xl transition-all hover:scale-105 shadow-lg ${
                  showVoiceMode
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                    : 'bg-surface border border-border hover:border-primary/50 text-text-secondary hover:text-primary'
                }`}
                title="Voice input"
              >
                <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}

            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || !textChat.isConnected}
              className={`p-3 sm:p-4 rounded-2xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                inputText.trim() && textChat.isConnected
                  ? 'bg-gradient-to-r from-primary to-purple-500 text-white hover:scale-105 hover:shadow-xl hover:shadow-primary/30'
                  : 'bg-surface border border-border text-text-secondary'
              }`}
            >
              <Send className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <p className="text-center text-xs text-text-secondary mt-3">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Message Bubble Component - Redesigned
 */
function MessageBubble({
  message,
}: {
  message: ChatMessage
}) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isUser
          ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30'
          : 'bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20'
      }`}>
        {isUser ? (
          <User className={`h-5 w-5 text-emerald-500`} />
        ) : (
          <Bot className={`h-5 w-5 text-primary`} />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] sm:max-w-[80%] ${
        isUser ? 'items-end' : 'items-start'
      }`}>
        {/* Message Bubble */}
        <div className={`rounded-2xl px-4 py-3 sm:px-5 sm:py-4 shadow-md ${
          isUser
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-tr-sm'
            : 'bg-surface border border-border/50 text-text-primary rounded-tl-sm'
        }`}>
          <p className="text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap">
            {message.text}
          </p>
        </div>

        {/* Metadata */}
        <div className={`flex items-center gap-2 mt-2 px-2 flex-wrap ${
          isUser ? 'justify-end' : 'justify-start'
        }`}>
          <span className="text-xs text-text-secondary">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {!isUser && message.intent && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-primary/10 to-purple-500/10 text-primary border border-primary/20 rounded-md">
              🎯 {message.intent}
            </span>
          )}

          {!isUser && message.confidence !== undefined && (
            <span className="text-xs text-text-secondary">
              {Math.round(message.confidence * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TextChat
