import React from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../config/firebase';
import {
  subscribeChatMessages, sendTextMessage,
  sendGifMessage, sendImageMessage, ChatMessage,
} from '../services/chatService';
import GiphyPickerModal from './GiphyPickerModal';
import { useColors } from '../context/PremiumContext';

function formatTime(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

export default function MatchChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { matchId, matchName } = route.params as { matchId: string; matchName: string };
  const colors = useColors();
  const userId = auth.currentUser?.uid ?? '';
  const userName = auth.currentUser?.displayName ?? 'Uporabnik';

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [showGiphy, setShowGiphy] = React.useState(false);
  const listRef = React.useRef<FlatList>(null);

  React.useEffect(() => {
    return subscribeChatMessages(matchId, setMessages);
  }, [matchId]);

  React.useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function handleSendText() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await sendTextMessage(matchId, userId, userName, trimmed);
    } catch {
      Alert.alert('Napaka', 'Sporočila ni bilo mogoče poslati.');
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ni dostopa', 'Dovoli dostop do fotografij v nastavitvah.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingImage(true);
    try {
      await sendImageMessage(matchId, userId, userName, result.assets[0].uri);
    } catch {
      Alert.alert('Napaka', 'Slike ni bilo mogoče poslati.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleGifSelect(gifUrl: string) {
    try {
      await sendGifMessage(matchId, userId, userName, gifUrl);
    } catch {
      Alert.alert('Napaka', 'GIF-a ni bilo mogoče poslati.');
    }
  }

  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
    const isMe = item.senderId === userId;
    const prevMsg = messages[index - 1];
    const showName = !isMe && (!prevMsg || prevMsg.senderId !== item.senderId);

    return (
      <View style={{
        alignItems: isMe ? 'flex-end' : 'flex-start',
        marginBottom: 4,
        paddingHorizontal: 12,
      }}>
        {showName && (
          <Text style={{ color: colors.textFaint, fontSize: 11, marginBottom: 3, marginLeft: 4 }}>
            {item.senderName}
          </Text>
        )}
        <View style={{
          maxWidth: '78%',
          backgroundColor: isMe ? colors.primary : colors.bgElevated,
          borderRadius: 18,
          borderBottomRightRadius: isMe ? 4 : 18,
          borderBottomLeftRadius: isMe ? 18 : 4,
          overflow: 'hidden',
          borderWidth: isMe ? 0 : 1,
          borderColor: colors.borderSubtle,
        }}>
          {item.type === 'text' && (
            <Text style={{
              color: isMe ? '#fff' : colors.text,
              fontSize: 15, paddingHorizontal: 14, paddingVertical: 10,
            }}>
              {item.text}
            </Text>
          )}
          {(item.type === 'image' || item.type === 'gif') && item.mediaUrl && (
            <Image
              source={{ uri: item.mediaUrl }}
              style={{ width: 220, height: 160 }}
              resizeMode="cover"
            />
          )}
        </View>
        <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 2, marginHorizontal: 4 }}>
          {formatTime(item.createdAt)}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <SafeAreaView edges={['top']} style={{
        backgroundColor: colors.primary,
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Live Chat
            </Text>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 1 }} numberOfLines={1}>
              {matchName}
            </Text>
          </View>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 }}>
              <Ionicons name="chatbubbles-outline" size={44} color={colors.textFaint} />
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Še ni sporočil. Začni pogovor!</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: 8,
          paddingHorizontal: 12, paddingVertical: 10,
          backgroundColor: colors.bgElevated,
          borderTopWidth: 1, borderTopColor: colors.borderSubtle,
        }}>
          {/* GIF button */}
          <TouchableOpacity
            onPress={() => setShowGiphy(true)}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '900' }}>GIF</Text>
          </TouchableOpacity>

          {/* Image button */}
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={uploadingImage}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {uploadingImage
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="image-outline" size={20} color={colors.primary} />}
          </TouchableOpacity>

          {/* Text input */}
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'flex-end',
            backgroundColor: colors.bg, borderRadius: 20,
            borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: 14, paddingVertical: 8, minHeight: 38,
          }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Sporočilo…"
              placeholderTextColor={colors.textFaint}
              multiline
              style={{ flex: 1, color: colors.text, fontSize: 15, maxHeight: 100 }}
              onSubmitEditing={handleSendText}
            />
          </View>

          {/* Send button */}
          <TouchableOpacity
            onPress={handleSendText}
            disabled={!text.trim() || sending}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: text.trim() ? colors.primary : colors.borderSubtle,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bgElevated }} />
      </KeyboardAvoidingView>

      <GiphyPickerModal
        visible={showGiphy}
        onClose={() => setShowGiphy(false)}
        onSelect={handleGifSelect}
      />
    </View>
  );
}
