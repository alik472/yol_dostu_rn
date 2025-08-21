import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as StoreReview from "expo-store-review";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import "react-native-get-random-values";

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

export default function SettingsScreen() {
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [showAbout, setShowAbout] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [reviewPromptShown, setReviewPromptShown] = useState(false);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const historyData = await AsyncStorage.getItem("chatHistory");
      if (historyData) {
        const history: Chat[] = JSON.parse(historyData);
        // Parse dates back from strings
        const parsedHistory = history.map((chat) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
        setChatHistory(parsedHistory);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const showReviewPrompt = () => {
    Alert.alert("Tətbiqi bəyəndinizmi?", "", [
      {
        text: "Xeyr",
        style: "cancel",
        onPress: () => {
          // Ask for feedback when user says no
          Alert.alert(
            "Rəy bildirin",
            "Tətbiqi necə yaxşılaşdıra bilərik? Rəyinizi yazın:",
            [
              { text: "Ləğv et", style: "cancel" },
              {
                text: "Rəy göndər",
                onPress: async () => {
                  // Mark as declined so we don't show again
                  await AsyncStorage.setItem("reviewDeclined", "true");
                  Alert.alert("Təşəkkürlər", "Rəyiniz üçün təşəkkürlər!");
                },
              },
            ]
          );
        },
      },
      {
        text: "Bəli",
        onPress: async () => {
          try {
            const isAvailable = await StoreReview.isAvailableAsync();
            if (isAvailable) {
              await StoreReview.requestReview();
            } else {
              // Fallback to App Store URL
              const appStoreUrl = "https://apps.apple.com/app/idYOUR_APP_ID"; // Replace with actual App Store URL
              await Linking.openURL(appStoreUrl);
            }
            await AsyncStorage.setItem("reviewPromptShown", "true");
          } catch (error) {
            console.error("Error opening review:", error);
          }
        },
      },
    ]);
  };

  const loadChat = async (chat: Chat) => {
    try {
      // Haptic feedback for loading chat
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Set this chat as active
      await AsyncStorage.setItem("activeChatId", chat.id);

      // Close the modal first
      setShowChatHistory(false);

      // Navigate back to main screen
      router.back();

      // Show success message
      setTimeout(() => {
        Alert.alert("Söhbət yükləndi", "Seçdiyiniz söhbət yükləndi.", [
          { text: "Tamam" },
        ]);
      }, 500);
    } catch (error) {
      console.error("Error loading chat:", error);
      Alert.alert("Xəta", "Söhbət yüklənərkən xəta baş verdi.");
    }
  };

  const deleteChat = (chatId: string) => {
    Alert.alert("Söhbəti sil", "Bu söhbəti silmək istədiyinizə əminsiniz?", [
      { text: "Ləğv et", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            // Remove from storage
            await AsyncStorage.removeItem(`chat_${chatId}`);

            // Update chat history
            const updatedHistory = chatHistory.filter(
              (chat) => chat.id !== chatId
            );
            setChatHistory(updatedHistory);
            await AsyncStorage.setItem(
              "chatHistory",
              JSON.stringify(updatedHistory)
            );

            // If this was the active chat, clear it
            const activeChatId = await AsyncStorage.getItem("activeChatId");
            if (activeChatId === chatId) {
              await AsyncStorage.removeItem("activeChatId");
            }
          } catch (error) {
            console.error("Error deleting chat:", error);
            Alert.alert("Xəta", "Söhbət silinərkən xəta baş verdi.");
          }
        },
      },
    ]);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "Bugün";
    } else if (diffDays === 2) {
      return "Dünən";
    } else if (diffDays <= 7) {
      return `${diffDays - 1} gün əvvəl`;
    } else {
      return date.toLocaleDateString("az-AZ");
    }
  };

  const renderChatItem = (chat: Chat) => {
    const messageCount = chat.messages.filter((m) => m.role === "user").length;

    return (
      <View key={chat.id} style={styles.chatItem}>
        <TouchableOpacity
          style={styles.chatItemContent}
          onPress={() => loadChat(chat)}
        >
          <Text style={styles.chatTitle} numberOfLines={1}>
            {chat.title}
          </Text>
          <Text style={styles.chatSubtitle}>
            {messageCount} mesaj • {formatDate(chat.updatedAt)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteChat(chat.id)}
        >
          <Text style={styles.deleteButtonText}>Sil</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.headerButton}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.backIcon}>←</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <View style={styles.headerButton} />
        </View>

        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.appLogo}
            resizeMode="cover"
          />
          <Text style={styles.appName}>Yol Dostu</Text>
        </View>

        {/* Settings Options */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowChatHistory(true);
            }}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIconContainer}>
                <Text style={styles.settingIcon}>💬</Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Bütün Söhbətlər</Text>
                <Text style={styles.settingSubtext}>
                  {chatHistory.length} söhbət
                </Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAbout(true);
            }}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIconContainer}>
                <Text style={styles.settingIcon}>ℹ️</Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Haqqımızda</Text>
                <Text style={styles.settingSubtext}>Tətbiq məlumatları</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showReviewPrompt();
            }}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIconContainer}>
                <Text style={styles.settingIcon}>⭐</Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingText}>Tətbiqi qiymətləndir</Text>
                <Text style={styles.settingSubtext}>
                  App Store-da rəy yazın
                </Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Version Info */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>Versiya 1.0.0</Text>
        </View>

        {/* Developer Credit */}
        <View style={styles.developerSection}>
          <View style={styles.developerRow}>
            <Text style={styles.developerText}>Bu tətbiq </Text>
            <Image
              source={require("../assets/images/masinaz_logo.png")}
              style={styles.developerLogo}
              resizeMode="contain"
            />
            <Text style={styles.developerText}> tərəfindən hazırlanıb.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Chat History Modal */}
      <Modal
        visible={showChatHistory}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bütün Söhbətlər</Text>
            <TouchableOpacity
              onPress={() => setShowChatHistory(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Bağla</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.chatHistoryList}>
            {chatHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Hələ heç bir söhbət yoxdur
                </Text>
              </View>
            ) : (
              chatHistory.map(renderChatItem)
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAbout}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Haqqımızda</Text>
            <TouchableOpacity
              onPress={() => setShowAbout(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Bağla</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.aboutContent}>
            <View style={styles.aboutSection}>
              <Text style={styles.aboutTitle}>Yol Dostu</Text>
              <Text style={styles.aboutVersion}>Versiya 1.0.0</Text>
            </View>

            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Tətbiq haqqında</Text>
              <Text style={styles.aboutText}>
                Yol Dostu - Azərbaycan Respublikasının Yol Hərəkəti Qaydaları
                üzrə ekspert köməkçi tətbiqidir. Bu tətbiq sizə "Yol Hərəkəti
                Haqqında Qanun", "İnzibati Xətalar Məcəlləsi" və "Nazirlər
                Kabinetinin təsdiqlədiyi Yol Hərəkəti Qaydaları"na əsasən
                məsləhətlər verir.
              </Text>
            </View>

            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Xüsusiyyətlər</Text>
              <Text style={styles.aboutText}>
                • Yol hərəkəti qaydaları haqqında məsləhətlər{"\n"}• Cərimələr
                və bal sistemi izahları{"\n"}• Hüquqi maddə istinadları{"\n"}•
                Praktik tövsiyələr{"\n"}• Söhbət tarixçəsi{"\n"}• Offline söhbət
                saxlanması
              </Text>
            </View>

            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Qeyd</Text>
              <Text style={styles.aboutText}>
                Qanunvericilik dəyişə bilər. Dəqiq və ən son məlumat üçün həmişə
                rəsmi mənbələrə (dyp.gov.az, e-qanun.az) baxmağınızı tövsiyə
                edirik.
              </Text>
            </View>

            <View style={styles.aboutSection}>
              <Text style={styles.aboutSectionTitle}>Əlaqə</Text>
              <Text style={styles.aboutText}>
                Təkliflər və şikayətlər üçün App Store-da rəy yazın və ya
                tətbiqi qiymətləndirin.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  scrollView: {
    flex: 1,
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
  headerSpacer: {
    flex: 1,
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
  backIcon: {
    fontSize: 22,
    color: "#007AFF",
    fontWeight: "600",
  },
  logoSection: {
    backgroundColor: "#fff",
    paddingVertical: 40,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e7",
  },
  appLogo: {
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e5e7",
  },
  appName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1d1d1f",
  },
  section: {
    backgroundColor: "#fff",
    marginTop: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f7",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f2f2f7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingIcon: {
    fontSize: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingText: {
    fontSize: 17,
    color: "#1d1d1f",
    fontWeight: "400",
  },
  settingSubtext: {
    fontSize: 14,
    color: "#86868b",
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: "#c7c7cc",
    fontWeight: "400",
  },

  versionSection: {
    paddingVertical: 20,
    alignItems: "center",
  },
  versionText: {
    fontSize: 14,
    color: "#86868b",
    fontWeight: "400",
  },
  developerSection: {
    paddingVertical: 20,
    paddingBottom: 40,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f2f2f7",
    marginHorizontal: 16,
  },
  developerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  developerLogo: {
    width: 70,
    height: 70,
    marginHorizontal: 4,
  },
  developerText: {
    fontSize: 13,
    color: "#86868b",
    fontWeight: "400",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeButtonText: {
    fontSize: 17,
    color: "#007AFF",
    fontWeight: "600",
  },
  chatHistoryList: {
    flex: 1,
    padding: 16,
  },
  chatItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chatItemContent: {
    flex: 1,
    padding: 16,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  chatSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  deleteButton: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#ff3b30",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  aboutContent: {
    flex: 1,
    padding: 16,
  },
  aboutSection: {
    marginBottom: 24,
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  aboutSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
});
