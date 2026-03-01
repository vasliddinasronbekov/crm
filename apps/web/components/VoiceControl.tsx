'use client'

import { useState, useEffect } from 'react'
import { Mic, MicOff, Volume2, VolumeX, X, Loader } from 'lucide-react'
import { useAI } from '@/lib/hooks/useAI'

export default function VoiceControl() {
  const {
    state,
    recordingState,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    clearError,
  } = useAI()

  const [isOpen, setIsOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  // Show transcript panel when we get a response
  useEffect(() => {
    if (state.lastResponse) {
      setShowTranscript(true)
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowTranscript(false)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [state.lastResponse])

  const handleMicClick = async () => {
    if (state.isListening) {
      await stopListening()
      setIsOpen(false)
    } else {
      setIsOpen(true)
      await startListening()
    }
  }

  const handleCancel = () => {
    cancelListening()
    setIsOpen(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* Floating Voice Button */}
      <button
        onClick={handleMicClick}
        className={`fixed bottom-8 right-8 z-50 p-4 rounded-full shadow-lg transition-all duration-300 ${
          state.isListening
            ? 'bg-error text-white animate-pulse'
            : state.isProcessing
            ? 'bg-primary/50 text-white'
            : 'bg-primary text-background hover:bg-primary/90'
        }`}
        title={state.isListening ? 'Stop listening' : 'Start voice command'}
      >
        {state.isProcessing ? (
          <Loader className="h-6 w-6 animate-spin" />
        ) : state.isListening ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>

      {/* Voice Control Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-8 z-50 w-96 bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-background px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mic className="h-5 w-5" />
              <h3 className="font-semibold">Voice Control</h3>
            </div>
            <button
              onClick={handleCancel}
              className="hover:bg-primary/80 rounded-lg p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Recording State */}
            {state.isListening && (
              <div className="text-center mb-6">
                <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
                  <div className="absolute inset-0 bg-error/20 rounded-full animate-ping"></div>
                  <div className="relative bg-error rounded-full p-6">
                    <Mic className="h-12 w-12 text-white" />
                  </div>
                </div>
                <p className="text-lg font-medium text-text-primary mb-1">
                  Listening...
                </p>
                <p className="text-sm text-text-secondary">
                  {formatTime(recordingState.recordingTime)}
                </p>
              </div>
            )}

            {/* Processing State */}
            {state.isProcessing && (
              <div className="text-center mb-6">
                <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
                  <Loader className="h-12 w-12 text-primary animate-spin" />
                </div>
                <p className="text-lg font-medium text-text-primary mb-1">
                  Processing...
                </p>
                <p className="text-sm text-text-secondary">
                  Analyzing your command
                </p>
              </div>
            )}

            {/* Speaking State */}
            {state.isSpeaking && (
              <div className="text-center mb-6">
                <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
                  <div className="absolute inset-0 bg-success/20 rounded-full animate-pulse"></div>
                  <div className="relative bg-success rounded-full p-6">
                    <Volume2 className="h-12 w-12 text-white" />
                  </div>
                </div>
                <p className="text-lg font-medium text-text-primary mb-1">
                  Speaking...
                </p>
                <button
                  onClick={stopSpeaking}
                  className="mt-2 px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 transition-colors"
                >
                  <VolumeX className="h-4 w-4 inline mr-2" />
                  Stop
                </button>
              </div>
            )}

            {/* Error State */}
            {state.error && (
              <div className="bg-error/10 border border-error rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-error">⚠️</div>
                  <div className="flex-1">
                    <p className="font-medium text-error mb-1">Error</p>
                    <p className="text-sm text-text-secondary">{state.error}</p>
                  </div>
                  <button
                    onClick={clearError}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Instructions */}
            {!state.isListening && !state.isProcessing && !state.isSpeaking && (
              <div className="text-center">
                <div className="bg-background rounded-xl p-4 mb-4">
                  <p className="text-sm text-text-secondary mb-3">
                    Click the microphone button and speak your command
                  </p>
                  <div className="text-left space-y-2">
                    <p className="text-xs text-text-secondary">
                      <strong>Examples:</strong>
                    </p>
                    <ul className="text-xs text-text-secondary space-y-1 ml-4">
                      <li>• &quot;Show my schedule&quot;</li>
                      <li>• &quot;Check my balance&quot;</li>
                      <li>• &quot;List all students&quot;</li>
                      <li>• &quot;Generate report&quot;</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={startListening}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <Mic className="h-5 w-5" />
                  Start Voice Command
                </button>
              </div>
            )}

            {/* Last Response Info */}
            {state.lastIntent && !state.isListening && !state.isProcessing && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-text-secondary space-y-1">
                  <div className="flex justify-between">
                    <span>Intent:</span>
                    <span className="font-medium text-text-primary">
                      {state.lastIntent}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span
                      className={`font-medium ${
                        state.lastConfidence && state.lastConfidence > 0.8
                          ? 'text-success'
                          : state.lastConfidence && state.lastConfidence > 0.6
                          ? 'text-warning'
                          : 'text-error'
                      }`}
                    >
                      {state.lastConfidence
                        ? `${(state.lastConfidence * 100).toFixed(0)}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transcript Notification */}
      {showTranscript && state.lastResponse && !isOpen && (
        <div className="fixed bottom-24 right-8 z-40 w-96 bg-surface rounded-xl shadow-lg border border-border overflow-hidden animate-slide-up">
          <div className="bg-success/10 px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-success">
              Voice Response
            </span>
            <button
              onClick={() => setShowTranscript(false)}
              className="text-text-secondary hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-text-primary">{state.lastResponse}</p>
            {state.lastIntent && (
              <p className="text-xs text-text-secondary mt-2">
                Intent: {state.lastIntent} ({state.lastConfidence ? `${(state.lastConfidence * 100).toFixed(0)}%` : 'N/A'})
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
