import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVoiceControl } from '../hooks/useVoiceControl';

const VoiceControl = () => {
  const {
    state,
    recordingState,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    clearError,
  } = useVoiceControl();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for recording state
  useEffect(() => {
    if (state.isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state.isListening]);

  const handleMicPress = async () => {
    if (state.isListening) {
      await stopListening();
      setIsModalVisible(false);
    } else {
      setIsModalVisible(true);
      await startListening();
    }
  };

  const handleCancel = async () => {
    await cancelListening();
    setIsModalVisible(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Floating Voice Button */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          state.isListening && styles.floatingButtonActive,
        ]}
        onPress={handleMicPress}
        activeOpacity={0.8}
      >
        <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
          <Ionicons
            name={state.isListening ? 'mic-off' : 'mic'}
            size={28}
            color="#fff"
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Voice Control Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.headerTitle}>Voice Control</Text>
              </View>
              <TouchableOpacity onPress={handleCancel}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Listening State */}
              {state.isListening && (
                <View style={styles.stateContainer}>
                  <Animated.View
                    style={[
                      styles.recordingIndicator,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <Ionicons name="mic" size={48} color="#fff" />
                  </Animated.View>
                  <Text style={styles.stateTitle}>Listening...</Text>
                  <Text style={styles.stateSubtitle}>
                    {formatTime(recordingState.recordingTime)}
                  </Text>
                </View>
              )}

              {/* Processing State */}
              {state.isProcessing && (
                <View style={styles.stateContainer}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={[styles.stateTitle, { color: '#374151' }]}>
                    Processing...
                  </Text>
                  <Text style={styles.stateSubtitle}>
                    Analyzing your command
                  </Text>
                </View>
              )}

              {/* Speaking State */}
              {state.isSpeaking && (
                <View style={styles.stateContainer}>
                  <View style={styles.speakingIndicator}>
                    <Ionicons name="volume-high" size={48} color="#fff" />
                  </View>
                  <Text style={[styles.stateTitle, { color: '#374151' }]}>
                    Speaking...
                  </Text>
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={stopSpeaking}
                  >
                    <Ionicons name="volume-mute" size={16} color="#fff" />
                    <Text style={styles.stopButtonText}>Stop</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Error State */}
              {state.error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorTitle}>Error</Text>
                  <Text style={styles.errorMessage}>{state.error}</Text>
                  <TouchableOpacity
                    style={styles.errorButton}
                    onPress={clearError}
                  >
                    <Text style={styles.errorButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Instructions */}
              {!state.isListening &&
                !state.isProcessing &&
                !state.isSpeaking &&
                !state.error && (
                  <View style={styles.instructions}>
                    <Text style={styles.instructionsText}>
                      Click the microphone button and speak your command
                    </Text>
                    <View style={styles.examples}>
                      <Text style={styles.examplesTitle}>Examples:</Text>
                      <Text style={styles.exampleItem}>
                        • "Show my schedule"
                      </Text>
                      <Text style={styles.exampleItem}>
                        • "Check my balance"
                      </Text>
                      <Text style={styles.exampleItem}>
                        • "What are my courses?"
                      </Text>
                      <Text style={styles.exampleItem}>
                        • "View my progress"
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={startListening}
                    >
                      <Ionicons name="mic" size={20} color="#fff" />
                      <Text style={styles.startButtonText}>
                        Start Voice Command
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              {/* Last Response Info */}
              {state.lastIntent &&
                !state.isListening &&
                !state.isProcessing && (
                  <View style={styles.resultInfo}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Intent:</Text>
                      <Text style={styles.resultValue}>{state.lastIntent}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Confidence:</Text>
                      <Text
                        style={[
                          styles.resultValue,
                          state.lastConfidence && state.lastConfidence > 0.8
                            ? styles.resultValueHigh
                            : state.lastConfidence && state.lastConfidence > 0.6
                            ? styles.resultValueMedium
                            : styles.resultValueLow,
                        ]}
                      >
                        {state.lastConfidence
                          ? `${(state.lastConfidence * 100).toFixed(0)}%`
                          : 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingButtonActive: {
    backgroundColor: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#6366F1',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 24,
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  recordingIndicator: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  speakingIndicator: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  stateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructions: {
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  examples: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  examplesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  exampleItem: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  resultValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  resultValueHigh: {
    color: '#10B981',
  },
  resultValueMedium: {
    color: '#F59E0B',
  },
  resultValueLow: {
    color: '#EF4444',
  },
});

export default VoiceControl;
