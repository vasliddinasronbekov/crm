
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnifiedChat, UnifiedChatMode, ChatMessage } from '../hooks/useUnifiedChat';
import { useNavigation } from '@react-navigation/native';

export interface EnhancedVoiceControlProps {
  initialMode?: UnifiedChatMode;
}

const EnhancedVoiceControl: React.FC<EnhancedVoiceControlProps> = ({
  initialMode = 'voice',
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [chatMode, setChatMode] = useState<UnifiedChatMode>(initialMode);
  const [textInput, setTextInput] = useState('');
  const navigation = useNavigation();

  const chat = useUnifiedChat({
    mode: chatMode,
    autoConnect: true,
    onMessage: (message) => {
      if (message.role === 'assistant') {
        handleNavigationIntent(message.intent);
      }
    },
  });

  useEffect(() => {
    if (chat.isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [chat.isRecording]);

  const handleNavigationIntent = (intent?: string) => {
    if (!intent) return;
    const intentMap: Record<string, string> = {
      'check_schedule': 'Schedule',
      'check_balance': 'Payments',
      'view_courses': 'Courses',
    };
    const screen = intentMap[intent];
    if (screen) {
      setIsModalVisible(false);
      navigation.navigate(screen as any);
    }
  };

  const handleMicPress = () => {
    chat.isRecording ? chat.stopRecording() : chat.startRecording();
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      chat.sendMessage(textInput.trim());
      setTextInput('');
    }
  };

  const handleClose = () => {
    if (chat.isRecording) chat.stopRecording();
    setIsModalVisible(false);
  };

  const toggleChatMode = () => {
    setChatMode((prev) => (prev === 'voice' ? 'text' : 'voice'));
  };

  return (
    <>
      <TouchableOpacity style={styles.floatingButton} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="chatbubble-ellipses-outline" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Header
              isConnected={chat.isConnected}
              chatMode={chatMode}
              onClose={handleClose}
              onToggleMode={toggleChatMode}
            />
            <ScrollView style={styles.content}>
              {chatMode === 'voice' ? (
                <VoiceUI chat={chat} pulseAnim={pulseAnim} />
              ) : (
                <TextUI messages={chat.messages} />
              )}
            </ScrollView>
            <InputArea
              chatMode={chatMode}
              isRecording={chat.isRecording}
              textInput={textInput}
              setTextInput={setTextInput}
              onMicPress={handleMicPress}
              onSendText={handleSendText}
              pulseAnim={pulseAnim}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// Helper Components
const Header = ({ isConnected, chatMode, onClose, onToggleMode }) => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <View style={[styles.connectionIndicator, isConnected ? styles.connectionIndicatorActive : {}]} />
      <Text style={styles.headerTitle}>{chatMode === 'voice' ? 'Voice Assistant' : 'Text Assistant'}</Text>
    </View>
    <View style={styles.headerRight}>
      <TouchableOpacity onPress={onToggleMode} style={styles.headerButton}>
        <Ionicons name={chatMode === 'voice' ? 'chatbubbles-outline' : 'mic-outline'} size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} style={styles.headerButton}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  </View>
);

const VoiceUI = ({ chat, pulseAnim }) => (
  <View style={styles.voiceUIContainer}>
    {chat.isProcessing && <ActivityIndicator size="large" color="#6366F1" />}
    {chat.transcript && <Text style={styles.transcript}>"{chat.transcript}"</Text>}
    {chat.messages.slice(-1).map(msg => msg.role === 'assistant' && (
      <Text key={msg.id} style={styles.responseText}>{msg.text}</Text>
    ))}
  </View>
);

const TextUI = ({ messages }) => (
  <ScrollView style={styles.messageList}>
    {messages.map((msg) => (
      <View key={msg.id} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
        <Text style={msg.role === 'user' ? styles.userMessageText : styles.assistantMessageText}>{msg.text}</Text>
      </View>
    ))}
  </ScrollView>
);

const InputArea = ({ chatMode, isRecording, textInput, setTextInput, onMicPress, onSendText, pulseAnim }) => (
  <View style={styles.inputArea}>
    {chatMode === 'voice' ? (
      <TouchableOpacity onPress={onMicPress} style={[styles.micButton, isRecording && styles.micButtonActive]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Ionicons name="mic" size={32} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    ) : (
      <View style={styles.textInputContainer}>
        <TextInput
          style={styles.textInput}
          value={textInput}
          onChangeText={setTextInput}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={styles.sendButton} onPress={onSendText}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  floatingButton: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#6366F1', padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerButton: { padding: 4 },
  connectionIndicator: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444' },
  connectionIndicatorActive: { backgroundColor: '#10B981' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  voiceUIContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  transcript: { fontSize: 18, color: '#6B7280', fontStyle: 'italic', marginBottom: 16 },
  responseText: { fontSize: 20, color: '#111827', fontWeight: '600', textAlign: 'center' },
  messageList: { flex: 1 },
  messageBubble: { padding: 12, borderRadius: 18, marginVertical: 4, maxWidth: '80%' },
  userBubble: { backgroundColor: '#6366F1', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#E5E7EB', alignSelf: 'flex-start' },
  userMessageText: { fontSize: 16, color: '#fff' },
  assistantMessageText: { fontSize: 16, color: '#1F2937' },
  inputArea: { borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 16 },
  micButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  micButtonActive: { backgroundColor: '#EF4444' },
  textInputContainer: { flexDirection: 'row', alignItems: 'center' },
  textInput: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: '#F3F4F6', marginRight: 12 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
});

export default EnhancedVoiceControl;

