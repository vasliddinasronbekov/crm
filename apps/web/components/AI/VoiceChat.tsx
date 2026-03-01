/**
 * Voice Chat Component - Redesigned 2025
 *
 * Modern, flexible, responsive voice interaction UI
 * - Tailwind CSS for styling
 * - Fully responsive (mobile-first)
 * - Inner scroll for messages
 * - Adaptive layouts
 * - Glass morphism design
 */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Mic, MicOff, Settings, Trash2, Volume2, VolumeX,
  Wifi, WifiOff, Loader2, Sparkles, Zap, MessageCircle,
  Languages, SlidersHorizontal
} from 'lucide-react'
import { useVoiceChat } from '@/hooks/useVoiceChat'
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation'

export interface VoiceChatProps {
  mode?: 'push-to-talk' | 'continuous'
  showWaveform?: boolean
  showTranscript?: boolean
  enableNavigation?: boolean
  className?: string
}

export function VoiceChat({
  mode = 'push-to-talk',
  showWaveform = true,
  showTranscript = true,
  enableNavigation = true,
  className = '',
}: VoiceChatProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('uz')
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const voiceChat = useVoiceChat({
    autoConnect: true,
    onTranscript: (text, language) => {
      console.log('📝 Transcript:', text, language)
    },
    onResponse: (text, intent) => {
      console.log('🤖 Response:', text, intent)
    },
    onError: (error) => {
      console.error('❌ Error:', error)
    },
  })

  const voiceNav = useVoiceNavigation({
    onNavigate: (result) => {
      console.log('🧭 Navigation:', result)
    },
  })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [voiceChat.transcript, voiceChat.response])

  // Handle language change
  useEffect(() => {
    if (voiceChat.isConnected) {
      voiceChat.setLanguage(selectedLanguage)
    }
  }, [selectedLanguage, voiceChat.isConnected])

  // Handle voice navigation
  useEffect(() => {
    if (enableNavigation && voiceChat.transcript) {
      voiceNav.executeCommand(voiceChat.transcript)
    }
  }, [voiceChat.transcript, enableNavigation])

  const languages = [
    { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ]

  return (
    <div className={`flex flex-col h-full max-h-screen ${className}`}>
      {/* Container with glass morphism */}
      <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-gradient-to-br from-surface/95 via-surface to-surface/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/50 overflow-hidden">

        {/* Header */}
        <div className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-cyan-500/20 to-primary/20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5"></div>

          {/* Animated particles */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-1/3 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          {/* Header content */}
          <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Connection status indicator */}
              <div className="relative">
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-all ${
                  voiceChat.isConnected
                    ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30'
                    : 'bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30'
                }`}>
                  {voiceChat.isConnected ? (
                    <Wifi className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                  )}
                </div>
                {voiceChat.isConnected && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
                )}
                {voiceChat.isConnected && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></span>
                )}
              </div>

              {/* Title */}
              <div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent flex items-center gap-2">
                  Voice Assistant
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-pulse" />
                </h2>
                <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
                  {voiceChat.isConnected ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      Connected
                    </span>
                  ) : (
                    'Disconnected'
                  )}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 sm:p-2.5 rounded-xl bg-background/50 hover:bg-background border border-border/50 hover:border-primary/50 transition-all hover:scale-105"
                title="Settings"
              >
                <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-text-secondary hover:text-primary transition-colors" />
              </button>
              <button
                onClick={voiceChat.clearConversation}
                className="p-2 sm:p-2.5 rounded-xl bg-background/50 hover:bg-background border border-border/50 hover:border-error/50 transition-all hover:scale-105"
                title="Clear conversation"
              >
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-text-secondary hover:text-error transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-b border-border/50 bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm">
            <div className="px-4 sm:px-6 py-4 space-y-4">
              {/* Language selector */}
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                  <Languages className="h-4 w-4" />
                  Language / Til / Язык
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setSelectedLanguage(lang.code)}
                      className={`px-3 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                        selectedLanguage === lang.code
                          ? 'bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg shadow-primary/20'
                          : 'bg-surface border border-border hover:border-primary/50 text-text-secondary hover:bg-primary/5'
                      }`}
                    >
                      <span className="text-lg sm:text-xl mb-1 block">{lang.flag}</span>
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto TTS toggle */}
              <div className="flex items-center justify-between p-3 sm:p-4 bg-surface rounded-xl border border-border/50">
                <label className="text-xs sm:text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  Auto TTS
                </label>
                <button
                  onClick={() => voiceChat.toggleTts()}
                  className={`relative w-11 h-6 sm:w-12 sm:h-7 rounded-full transition-all ${
                    voiceChat.settings.autoTts ? 'bg-gradient-to-r from-primary to-cyan-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full shadow-md transition-transform ${
                    voiceChat.settings.autoTts ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area - With inner scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-background/50 to-background/30 scroll-smooth">
          {/* Empty state */}
          {!voiceChat.transcript && !voiceChat.response && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-cyan-500/20 rounded-full blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-primary/10 via-cyan-500/5 to-primary/5 rounded-3xl p-8 sm:p-12 border border-primary/20">
                  <Mic className="h-16 w-16 sm:h-20 sm:w-20 text-primary mx-auto" />
                  <Zap className="h-6 w-6 text-cyan-400 absolute top-2 right-2 animate-pulse" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
                Ready to Listen
              </h3>
              <p className="text-sm sm:text-base text-text-secondary mb-6 max-w-md">
                {mode === 'push-to-talk'
                  ? 'Press and hold the microphone button to speak'
                  : 'Click the microphone to start recording'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center text-xs sm:text-sm text-text-secondary">
                <span className="px-3 py-1.5 bg-surface rounded-lg border border-border">🎙️ Voice commands</span>
                <span className="px-3 py-1.5 bg-surface rounded-lg border border-border">🧭 Navigation</span>
                <span className="px-3 py-1.5 bg-surface rounded-lg border border-border">🌍 Multi-language</span>
              </div>
            </div>
          )}

          {/* Waveform visualization */}
          {showWaveform && voiceChat.isRecording && (
            <div className="bg-gradient-to-r from-surface via-surface/50 to-surface rounded-2xl p-6 sm:p-8 border border-primary/20 shadow-lg">
              <Waveform level={voiceChat.audioLevel} />
              <div className="flex items-center justify-center gap-2 mt-4 text-emerald-500 font-semibold text-sm sm:text-base">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Recording...
              </div>
            </div>
          )}

          {/* User transcript */}
          {showTranscript && voiceChat.transcript && (
            <div className="animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 bg-gradient-to-br from-primary/5 to-cyan-500/5 rounded-2xl rounded-tl-sm p-4 sm:p-5 border border-primary/10 shadow-sm">
                  <p className="text-xs font-semibold text-primary/70 uppercase tracking-wide mb-2">You said</p>
                  <p className="text-sm sm:text-base text-text-primary leading-relaxed break-words">
                    &quot;{voiceChat.transcript}&quot;
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Response */}
          {voiceChat.response && (
            <div className="animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                </div>
                <div className="flex-1 bg-gradient-to-br from-surface to-surface/50 rounded-2xl rounded-tl-sm p-4 sm:p-5 border border-border/50 shadow-md">
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-cyan-500/70 uppercase tracking-wide">AI Response</p>
                    {voiceChat.intent && (
                      <span className="px-2 py-1 text-xs font-semibold bg-gradient-to-r from-primary/10 to-cyan-500/10 text-primary border border-primary/20 rounded-lg">
                        🎯 {voiceChat.intent} ({Math.round(voiceChat.confidence * 100)}%)
                      </span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-text-primary leading-relaxed break-words whitespace-pre-wrap">
                    {voiceChat.response}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Processing indicator */}
          {voiceChat.isProcessing && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <span className="text-sm text-text-secondary font-medium">Processing your request...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Control Area */}
        <div className="border-t border-border/50 bg-gradient-to-r from-surface/95 to-surface/90 backdrop-blur-sm p-4 sm:p-6">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            {/* Main microphone button */}
            <button
              onClick={
                voiceChat.isRecording
                  ? voiceChat.stopRecording
                  : voiceChat.startRecording
              }
              onMouseDown={(e) => {
                if (mode === 'push-to-talk' && !voiceChat.isRecording) {
                  voiceChat.startRecording()
                }
              }}
              onMouseUp={(e) => {
                if (mode === 'push-to-talk' && voiceChat.isRecording) {
                  voiceChat.stopRecording()
                }
              }}
              onTouchStart={(e) => {
                if (mode === 'push-to-talk' && !voiceChat.isRecording) {
                  voiceChat.startRecording()
                }
              }}
              onTouchEnd={(e) => {
                if (mode === 'push-to-talk' && voiceChat.isRecording) {
                  voiceChat.stopRecording()
                }
              }}
              disabled={!voiceChat.isConnected}
              className={`group relative transition-all duration-300 ${
                voiceChat.isConnected ? 'hover:scale-105' : 'opacity-50 cursor-not-allowed'
              }`}
              title={mode === 'push-to-talk' ? 'Hold to speak' : 'Click to record'}
            >
              {/* Glow effect */}
              <div className={`absolute -inset-2 rounded-full blur-xl transition-opacity ${
                voiceChat.isRecording
                  ? 'bg-gradient-to-r from-red-500 to-red-600 opacity-75 animate-pulse'
                  : 'bg-gradient-to-r from-primary to-cyan-500 opacity-0 group-hover:opacity-50'
              }`}></div>

              {/* Button */}
              <div className={`relative h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                voiceChat.isRecording
                  ? 'bg-gradient-to-br from-red-500 to-red-600 animate-pulse'
                  : 'bg-gradient-to-br from-primary via-primary to-cyan-500 hover:from-cyan-500 hover:to-primary'
              }`}>
                {voiceChat.isRecording ? (
                  <MicOff className="h-7 w-7 sm:h-9 sm:w-9 text-white" />
                ) : (
                  <Mic className="h-7 w-7 sm:h-9 sm:w-9 text-white" />
                )}
              </div>

              {/* Recording indicator */}
              {voiceChat.isRecording && (
                <div className="absolute -top-1 -right-1">
                  <span className="flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
                  </span>
                </div>
              )}
            </button>

            {/* Mute/Speaker button */}
            {voiceChat.settings.autoTts && (
              <button
                onClick={() => voiceChat.toggleTts()}
                className="p-3 sm:p-4 rounded-full bg-surface border border-border hover:border-primary/50 transition-all hover:scale-105 shadow-lg"
                title="Toggle speaker"
              >
                <Volume2 className="h-5 w-5 sm:h-6 sm:w-6 text-text-secondary hover:text-primary transition-colors" />
              </button>
            )}
          </div>

          {/* Hint text */}
          <p className="text-center text-xs sm:text-sm text-text-secondary mt-4">
            {mode === 'push-to-talk'
              ? 'Hold the button and speak, then release'
              : voiceChat.isRecording
              ? 'Click again to stop recording'
              : 'Click the microphone to start'}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Waveform Visualization Component - Redesigned
 */
function Waveform({ level }: { level: number }) {
  const bars = 24
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const baseHeight = 0.2 + level * 0.8
    const wave = Math.sin((i / bars) * Math.PI * 4) * 0.3
    const random = Math.random() * 0.1
    return Math.max(0.15, Math.min(1, baseHeight + wave + random))
  })

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5 h-20 sm:h-24">
      {barHeights.map((height, i) => (
        <div
          key={i}
          className="w-1 sm:w-1.5 bg-gradient-to-t from-primary via-cyan-500 to-primary rounded-full transition-all duration-150"
          style={{
            height: `${height * 100}%`,
            opacity: 0.6 + height * 0.4,
          }}
        />
      ))}
    </div>
  )
}

export default VoiceChat
