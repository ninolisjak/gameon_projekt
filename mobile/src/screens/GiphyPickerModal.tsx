import React from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  FlatList, Image, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../context/PremiumContext';

const GIPHY_KEY = 'c8NbxVB7oIJLksPxFj5GnSmvXfBky5qr';
const GRID_SIZE = 3;
const ITEM_SIZE = 110;

type GifItem = {
  id: string;
  url: string;
  preview: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
};

export default function GiphyPickerModal({ visible, onClose, onSelect }: Props) {
  const colors = useColors();
  const [query, setQuery] = React.useState('');
  const [gifs, setGifs] = React.useState<GifItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!visible) { setQuery(''); setGifs([]); return; }
    fetchGifs('trending', '');
  }, [visible]);

  async function fetchGifs(type: 'search' | 'trending', q: string) {
    setLoading(true);
    try {
      const endpoint = type === 'trending'
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=30&rating=g`
        : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=30&rating=g`;
      const res = await fetch(endpoint);
      const json = await res.json();
      setGifs(json.data.map((g: any) => ({
        id: g.id,
        url: g.images.fixed_height.url,
        preview: g.images.fixed_height_still.url,
      })));
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(text: string) {
    setQuery(text);
    if (text.trim().length === 0) {
      fetchGifs('trending', '');
    } else if (text.trim().length >= 2) {
      fetchGifs('search', text.trim());
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12,
              paddingHorizontal: 12, height: 38,
            }}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
              <TextInput
                value={query}
                onChangeText={handleSearch}
                placeholder="Išči GIF-e…"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={{ flex: 1, color: '#fff', fontSize: 14 }}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textAlign: 'right', marginTop: 6 }}>
            Powered by GIPHY
          </Text>
        </SafeAreaView>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={gifs}
            numColumns={GRID_SIZE}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 2 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onSelect(item.url); onClose(); }}
                activeOpacity={0.7}
                style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: 2 }}
              >
                <Image
                  source={{ uri: item.preview }}
                  style={{ width: '100%', height: '100%', borderRadius: 8, backgroundColor: colors.bgElevated }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
