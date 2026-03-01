// apps/student-app-v2/src/screens/AIScreen.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@eduvoice/mobile-ui';
import { apiClient } from '@eduvoice/mobile-shared';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export const AIScreen = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI learning assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (inputText.trim() === '' || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Call AI chat endpoint
      const response = await apiClient.post('/api/v1/ai/chat/', {
        message: userMessage.text,
      }) as unknown as { response?: string; message?: string };

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response || response.message || 'I apologize, but I could not process that request.',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessageContainer : styles.aiMessageContainer,
      ]}
    >
      {!item.isUser && (
        <View style={styles.aiAvatar}>
          <MaterialCommunityIcons name="robot" size={20} color={theme.colors.white} />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          item.isUser ? styles.userMessageBubble : styles.aiMessageBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            item.isUser ? styles.userMessageText : styles.aiMessageText,
          ]}
        >
          {item.text}
        </Text>
        <Text
          style={[
            styles.messageTime,
            item.isUser ? styles.userMessageTime : styles.aiMessageTime,
          ]}
        >
          {item.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      {item.isUser && (
        <View style={styles.userAvatar}>
          <MaterialCommunityIcons name="account" size={20} color={theme.colors.white} />
        </View>
      )}
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.quickActionsTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setInputText('What are my upcoming assignments?')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="clipboard-text"
            size={20}
            color={theme.colors.primary500}
          />
          <Text style={styles.quickActionText}>Assignments</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setInputText('How am I performing this week?')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="chart-line"
            size={20}
            color={theme.colors.success500}
          />
          <Text style={styles.quickActionText}>Performance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setInputText('Show my study schedule')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="calendar"
            size={20}
            color={theme.colors.warning500}
          />
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setInputText('Help me study for IELTS')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="school"
            size={20}
            color={theme.colors.error500}
          />
          <Text style={styles.quickActionText}>Study Help</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="robot" size={24} color={theme.colors.white} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSubtitle}>
              {isLoading ? 'Typing...' : 'Online'}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        ListHeaderComponent={messages.length === 1 ? renderQuickActions : null}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={theme.colors.gray500}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (inputText.trim() === '' || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={inputText.trim() === '' || isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <MaterialCommunityIcons
                name="send"
                size={24}
                color={theme.colors.white}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  header: {
    backgroundColor: theme.colors.primary500,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary600,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: theme.spacing.md,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.white,
  },
  headerSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.primary100,
    marginTop: theme.spacing.xs / 2,
  },
  messagesList: {
    paddingVertical: theme.spacing.md,
  },
  quickActionsContainer: {
    padding: theme.spacing.lg,
  },
  quickActionsTitle: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    ...theme.shadows.sm,
  },
  quickActionText: {
    ...theme.typography.caption,
    color: theme.colors.gray700,
    fontWeight: '600',
  },
  messageContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.secondary500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  userMessageBubble: {
    backgroundColor: theme.colors.primary500,
    borderBottomRightRadius: theme.borderRadius.xs,
  },
  aiMessageBubble: {
    backgroundColor: theme.colors.white,
    borderBottomLeftRadius: theme.borderRadius.xs,
  },
  messageText: {
    ...theme.typography.body1,
  },
  userMessageText: {
    color: theme.colors.white,
  },
  aiMessageText: {
    color: theme.colors.gray900,
  },
  messageTime: {
    ...theme.typography.caption,
    marginTop: theme.spacing.xs,
  },
  userMessageTime: {
    color: theme.colors.primary100,
    textAlign: 'right',
  },
  aiMessageTime: {
    color: theme.colors.gray500,
  },
  inputContainer: {
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    padding: theme.spacing.md,
    ...theme.shadows.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    ...theme.typography.body1,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    maxHeight: 100,
    color: theme.colors.gray900,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
});
