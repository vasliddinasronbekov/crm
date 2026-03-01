/**
 * Text Chat Modal Component - AI Text Chat Interface for React Native
 *
 * Features:
 * - WebSocket-based real-time chat
 * - Message history with bubbles
 * - Smart suggestions as chips
 * - Typing indicators
 * - Auto-scroll to latest
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTextChatWebSocket } from '../hooks/useTextChatWebSocket';

export interface TextChatModalProps {
  visible: boolean;
  onClose: () => void;
}

const TextChatModal: React.FC<TextChatModalProps> = ({ visible, onClose }) => {
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const textChat = useTextChatWebSocket({
    autoConnect: true,
    onMessage: (message) => {
      console.log('💬 New message:', message);
      // Auto-scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onError: (error) => {
      console.error('❌ Error:', error);
    },
  });

  // Auto-scroll when messages change
  useEffect(() => {
    if (textChat.messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [textChat.messages]);

  const handleSendMessage = () => {
    if (inputText.trim()) {
      textChat.sendMessage(inputText);
      setInputText('');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.connectionIndicator,
                textChat.isConnected
                  ? styles.connectionIndicatorActive
                  : styles.connectionIndicatorInactive,
              ]}
            />
            <Text style={styles.headerTitle}>💬 AI Chat Assistant</Text>
          </View>
          <View style={styles.headerRight}>
            {textChat.conversationId && (
              <TouchableOpacity
                onPress={textChat.clearConversation}
                style={styles.headerButton}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages Container */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {textChat.messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>👋</Text>
              <Text style={styles.emptyStateTitle}>
                Hello! How can I help you today?
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                Ask me about your schedule, payments, grades, or anything else!
              </Text>
            </View>
          )}

          {textChat.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Typing Indicator */}
          {textChat.isTyping && (
            <View style={[styles.messageBubble, styles.aiMessage]}>
              <View style={styles.typingIndicator}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDotDelay1]} />
                <View style={[styles.typingDot, styles.typingDotDelay2]} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Smart Suggestions */}
        {textChat.suggestions.length > 0 && (
          <ScrollView
            horizontal
            style={styles.suggestionsContainer}
            contentContainerStyle={styles.suggestionsContent}
            showsHorizontalScrollIndicator={false}
          >
            <Text style={styles.suggestionsLabel}>💡 Suggestions:</Text>
            {textChat.suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => textChat.sendSuggestion(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            editable={textChat.isConnected}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || !textChat.isConnected) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || !textChat.isConnected}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() && textChat.isConnected ? '#fff' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/**
 * Message Bubble Component
 */
interface MessageBubbleProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    intent?: string;
    confidence?: number;
  };
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          isUser ? styles.userAvatar : styles.aiAvatar,
        ]}
      >
        <Text style={styles.avatarText}>{isUser ? '👤' : '🤖'}</Text>
      </View>

      {/* Message Content */}
      <View style={styles.messageContent}>
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userMessage : styles.aiMessage,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.aiMessageText,
            ]}
          >
            {message.text}
          </Text>
        </View>

        {/* Metadata */}
        <View style={[styles.metadata, isUser && styles.metadataUser]}>
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
          {!isUser && message.intent && (
            <View style={styles.intentBadge}>
              <Text style={styles.intentText}>🎯 {message.intent}</Text>
            </View>
          )}
          {!isUser && message.confidence !== undefined && (
            <Text style={styles.confidence}>
              {Math.round(message.confidence * 100)}%
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#6366F1',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  connectionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectionIndicatorActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  connectionIndicatorInactive: {
    backgroundColor: '#EF4444',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  messageContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  userMessageContainer: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    backgroundColor: '#10B981',
  },
  aiAvatar: {
    backgroundColor: '#6366F1',
  },
  avatarText: {
    fontSize: 18,
  },
  messageContent: {
    flex: 1,
    gap: 4,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: '#10B981',
    alignSelf: 'flex-end',
    borderTopRightRadius: 4,
  },
  aiMessage: {
    backgroundColor: '#E8EAF6',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#1A1A2E',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  metadataUser: {
    flexDirection: 'row-reverse',
    paddingLeft: 0,
    paddingRight: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  intentBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  intentText: {
    fontSize: 10,
    color: '#1E40AF',
    fontWeight: '600',
  },
  confidence: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  typingDotDelay1: {
    opacity: 0.7,
  },
  typingDotDelay2: {
    opacity: 0.4,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
  },
  suggestionsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  suggestionsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  suggestionChip: {
    backgroundColor: '#E8EAF6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  suggestionText: {
    fontSize: 13,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
});

export default TextChatModal;
