import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isError?: boolean;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

const API_BASE_URL = "https://background-xmocz.ondigitalocean.app";
const API_TOKEN = "yol8xkj9p0qwertyuiopasdfghjklzxc";

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  // Reload chat when screen comes back into focus (e.g., from settings)
  useFocusEffect(
    useCallback(() => {
      const reloadActiveChat = async () => {
        try {
          const activeChatId = await AsyncStorage.getItem("activeChatId");
          if (activeChatId && activeChatId !== currentChatId) {
            const chatData = await AsyncStorage.getItem(`chat_${activeChatId}`);
            if (chatData) {
              const chat: Chat = JSON.parse(chatData);
              // Ensure timestamps are Date objects
              const messagesWithDates = chat.messages.map((msg) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              }));
              setMessages(messagesWithDates);
              setCurrentChatId(activeChatId);
            }
          }
        } catch (error) {
          console.error("Error reloading active chat:", error);
        }
      };

      reloadActiveChat();
    }, [currentChatId])
  );

  // Review prompt is now only in settings.tsx

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const initializeChat = async () => {
    try {
      // Check if there's an active chat
      const activeChatId = await AsyncStorage.getItem("activeChatId");
      if (activeChatId) {
        const chatData = await AsyncStorage.getItem(`chat_${activeChatId}`);
        if (chatData) {
          const chat: Chat = JSON.parse(chatData);
          // Ensure timestamps are Date objects
          const messagesWithDates = chat.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(messagesWithDates);
          setCurrentChatId(activeChatId);
          return;
        }
      }

      // Create new chat with welcome message
      await createNewChat();
    } catch (error) {
      console.error("Error initializing chat:", error);
      await createNewChat();
    }
  };

  const createNewChat = async () => {
    const chatId = uuidv4();
    const welcomeMessage: Message = {
      id: uuidv4(),
      role: "assistant",
      content:
        "Salam! Mən Yol Dostu botuyam. Azərbaycan Respublikasının yol hərəkəti qaydaları, cərimələr və digər yol məsələləri haqqında suallarınızı cavablandıra bilərəm. Sualınızı yazın!",
      timestamp: new Date(),
    };

    const newChat: Chat = {
      id: chatId,
      title: "Yeni söhbət",
      messages: [welcomeMessage],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setMessages([welcomeMessage]);
    setCurrentChatId(chatId);

    // Save to storage
    await AsyncStorage.setItem(`chat_${chatId}`, JSON.stringify(newChat));
    await AsyncStorage.setItem("activeChatId", chatId);
    await addChatToHistory(newChat);
  };

  const addChatToHistory = async (chat: Chat) => {
    try {
      const existingChats = await AsyncStorage.getItem("chatHistory");
      const chatHistory: Chat[] = existingChats
        ? JSON.parse(existingChats)
        : [];

      // Check if chat already exists
      const existingIndex = chatHistory.findIndex((c) => c.id === chat.id);
      if (existingIndex >= 0) {
        chatHistory[existingIndex] = chat;
      } else {
        chatHistory.unshift(chat); // Add to beginning
      }

      // Keep only last 50 chats
      const limitedHistory = chatHistory.slice(0, 50);
      await AsyncStorage.setItem("chatHistory", JSON.stringify(limitedHistory));
    } catch (error) {
      console.error("Error saving chat to history:", error);
    }
  };

  const sendMessage = async (messageText: string, isRetry: boolean = false) => {
    console.log("sendMessage called with:", messageText);
    if (!messageText.trim() || isLoading) {
      console.log("Message blocked - empty text or loading");
      return;
    }

    // Haptic feedback for send action
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: messageText.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    if (!isRetry) {
      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
    }

    setIsLoading(true);

    try {
      // Prepare conversation history (last 6 messages for context)
      const conversationHistory = messages.slice(-6).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch(`${API_BASE_URL}/yoldostu/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText.trim(),
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === "success" && data.data?.response) {
        const assistantMessage: Message = {
          id: uuidv4(),
          role: "assistant",
          content: data.data.response,
          timestamp: new Date(),
        };

        const updatedMessages = isRetry
          ? [...messages.slice(0, -1), assistantMessage] // Replace error message
          : [...messages, userMessage, assistantMessage];

        setMessages(updatedMessages);
        setRetryCount(0);

        // Save updated chat
        if (currentChatId) {
          await saveChatToStorage(updatedMessages);
        }
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error sending message:", error);

      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content:
          "Üzr istəyirəm, hal-hazırda cavab verə bilmirəm. Zəhmət olmasa bir az sonra yenidən cəhd edin.",
        timestamp: new Date(),
        isError: true,
      };

      if (isRetry) {
        setMessages((prev) => [...prev.slice(0, -1), errorMessage]);
      } else {
        setMessages((prev) => [...prev, userMessage, errorMessage]);
      }

      setRetryCount((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const saveChatToStorage = async (updatedMessages: Message[]) => {
    if (!currentChatId) return;

    try {
      const chatData = await AsyncStorage.getItem(`chat_${currentChatId}`);
      if (chatData) {
        const chat: Chat = JSON.parse(chatData);

        // Update title based on first user message
        const firstUserMessage = updatedMessages.find((m) => m.role === "user");
        if (firstUserMessage && chat.title === "Yeni söhbət") {
          chat.title =
            firstUserMessage.content.slice(0, 30) +
            (firstUserMessage.content.length > 30 ? "..." : "");
        }

        chat.messages = updatedMessages;
        chat.updatedAt = new Date();

        await AsyncStorage.setItem(
          `chat_${currentChatId}`,
          JSON.stringify(chat)
        );
        await addChatToHistory(chat);
      }
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  };

  const retryLastMessage = () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage && !isLoading) {
      sendMessage(lastUserMessage.content, true);
    }
  };

  const startNewChat = async () => {
    // Haptic feedback for new chat action
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "Yeni Söhbət",
      "Yeni söhbət başlatmaq istədiyinizə əminsiniz?",
      [
        { text: "Ləğv et", style: "cancel" },
        {
          text: "Bəli",
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await createNewChat();
          },
        },
      ]
    );
  };

  const handleReportChat = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReportMenu(false);
    setShowReportModal(true);
  };

  const confirmReportChat = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowReportModal(false);

    // Show success notification
    setShowSuccessNotification(true);

    // Hide notification after 3 seconds
    setTimeout(() => {
      setShowSuccessNotification(false);
    }, 3000);
  };

  const cancelReport = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReportModal(false);
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === "user";
    const isError = message.isError;

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            isError && styles.errorBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.assistantText,
              isError && styles.errorText,
            ]}
          >
            {message.content}
          </Text>

          {isError && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retryLastMessage}
              disabled={isLoading}
            >
              <Text style={styles.retryButtonText}>
                {isLoading ? "Göndərilir..." : "Yenidən cəhd et"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString("az-AZ", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/settings");
            }}
            style={styles.headerButton}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="settings-outline" size={22} color="#007AFF" />
            </View>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Yol Dostu</Text>
          </View>
          <View style={styles.headerButtonsContainer}>
            <TouchableOpacity
              onPress={startNewChat}
              style={styles.headerButton}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="add" size={24} color="#007AFF" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowReportMenu(!showReportMenu);
              }}
              style={styles.headerButton}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color="#007AFF"
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropdown Menu - positioned absolutely */}
        {showReportMenu && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReportChat}
            >
              <Ionicons name="warning" size={18} color="#d32f2f" />
              <Text style={styles.menuItemText}>Söhbəti şikayət et</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message, index) => renderMessage(message, index))}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>
                {retryCount > 0
                  ? `Yenidən cəhd edilir... (${retryCount + 1}/3)`
                  : "Cavab hazırlanır..."}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Sualınızı yazın..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
          >
            <Text
              style={[
                styles.sendButtonText,
                (!inputText.trim() || isLoading) &&
                  styles.sendButtonTextDisabled,
              ]}
            >
              Göndər
            </Text>
          </TouchableOpacity>
        </View>

        {/* Report Confirmation Modal */}
        <Modal
          visible={showReportModal}
          transparent={true}
          animationType="fade"
          onRequestClose={cancelReport}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Söhbəti şikayət et</Text>
              <Text style={styles.modalMessage}>
                Bu söhbəti şikayət etmək istədiyinizə əminsiniz?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelReport}
                >
                  <Text style={styles.cancelButtonText}>Ləğv et</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmReportChat}
                >
                  <Text style={styles.confirmButtonText}>Şikayət et</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Success Notification */}
        {showSuccessNotification && (
          <View style={styles.successNotification}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.successText}>Şikayətiniz göndərildi</Text>
          </View>
        )}

        {/* Overlay to close menu when clicking outside */}
        {showReportMenu && (
          <TouchableOpacity
            style={styles.menuOverlay}
            onPress={() => setShowReportMenu(false)}
            activeOpacity={1}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  appIcon: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1d1d1f",
  },
  headerButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f2f2f7",
    justifyContent: "center",
    alignItems: "center",
  },

  messagesContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: "flex-end",
  },
  assistantMessage: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  errorBubble: {
    backgroundColor: "#ffebee",
    borderColor: "#f44336",
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: "#fff",
  },
  assistantText: {
    color: "#333",
  },
  errorText: {
    color: "#d32f2f",
  },
  timestamp: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f44336",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#666",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
    backgroundColor: "#f9f9f9",
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sendButtonTextDisabled: {
    color: "#999",
  },
  headerButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  dropdownMenu: {
    position: "absolute",
    top: 80,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    minWidth: 180,
    zIndex: 9999,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: "#d32f2f",
    marginLeft: 8,
    fontWeight: "500",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    minWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1d1d1f",
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#d32f2f",
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  successNotification: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#4caf50",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },

  successText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginLeft: 8,
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
});
