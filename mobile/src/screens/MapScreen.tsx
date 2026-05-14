import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigation } from '@react-navigation/native';
import { styles } from '../styles/MapScreenStyles';

type Match = { id: string; sport: string; location: { lat: number; lng: number; name: string }; datetime: any; totalSpots: number; filledSpots: number; status: string; };

const TEST_MATCH: Match = { id: 'test', sport: 'futsal', location: { lat: 46.5547, lng: 15.6459, name: 'Športni center Tabor' }, datetime: null, totalSpots: 10, filledSpots: 3, status: 'open' };

function formatTime(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

function buildMapHtml(matches: Match[]) {
  const allMarkers = [TEST_MATCH, ...matches];
  const markers = allMarkers.map(m => {
    const color = m.sport === 'futsal' ? '#f5c518' : '#1a73e8';
    const icon = m.sport === 'futsal' ? '⚽' : '🏀';
    return `L.marker([${m.location.lat},${m.location.lng}],{icon:L.divIcon({className:'',html:'<div style="background:#131929;border:2px solid ${color};border-radius:20px;padding:4px 8px;color:#fff;font-size:11px;font-weight:700;white-space:nowrap">${icon} ${m.filledSpots}/${m.totalSpots}</div>',iconAnchor:[25,15]})}).addTo(map).on('click',()=>window.ReactNativeWebView.postMessage('${m.id}'));`;
  }).join('\n');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body,html,#map{margin:0;padding:0;width:100%;height:100%;background:#0a0e1a}.leaflet-tile{filter:brightness(0.35) saturate(0.4) hue-rotate(200deg)}.leaflet-control-zoom,.leaflet-control-attribution{display:none}</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([46.5547,15.6459],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
${markers}
</script></body></html>`;
}

export default function MapScreen() {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [selected, setSelected] = React.useState<Match | null>(null);
  const [search, setSearch] = React.useState('');
  const navigation = useNavigation<any>();

  React.useEffect(() => { fetchMatches(); }, []);

  async function fetchMatches() {
    const q = query(collection(db, 'matches'), where('status', '==', 'open'), where('isPublic', '==', true));
    const snap = await getDocs(q);
    setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
  }

  function handleMessage(e: any) {
    const id = e.nativeEvent.data;
    const m = [TEST_MATCH, ...matches].find(x => x.id === id);
    if (m) setSelected(m);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color="#555" style={{ marginHorizontal: 4 }} />
        <TextInput style={styles.searchInput} placeholder="Išči lokacijo..." placeholderTextColor="#555" value={search} onChangeText={setSearch} />
        <Ionicons name="locate-outline" size={16} color="#555" style={{ marginHorizontal: 4 }} />
      </View>

      <View style={styles.mapContainer}>
        <WebView source={{ html: buildMapHtml(matches) }} style={styles.map} onMessage={handleMessage} javaScriptEnabled originWhitelist={['*']} />
        <TouchableOpacity style={styles.locationBtn}>
          <Ionicons name="locate-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {selected && (
        <TouchableOpacity style={styles.card} onPress={() => setSelected(null)} activeOpacity={0.95}>
          <View style={styles.cardHandle} />
          <View style={styles.cardContent}>
            <View style={styles.cardIconBox}>
              <Ionicons name={selected.sport === 'futsal' ? 'football' : 'basketball'} size={28} color="#0a0e1a" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{selected.sport === 'futsal' ? 'Futsal' : 'Košarka'} <Text style={styles.cardVs}>{selected.totalSpots / 2}v{selected.totalSpots / 2}</Text></Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="location-outline" size={12} color="#8896aa" />
                <Text style={styles.cardLocation}>{selected.location.name}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Ionicons name="time-outline" size={12} color="#8896aa" />
                <Text style={styles.cardMetaText}>{formatTime(selected.datetime)}</Text>
                <Ionicons name="people-outline" size={12} color="#8896aa" />
                <Text style={styles.cardMetaText}>{selected.filledSpots}/{selected.totalSpots}</Text>
                <View style={styles.openBadge}><Text style={styles.openBadgeText}>Odprto</Text></View>
              </View>
            </View>
            <TouchableOpacity style={styles.cardArrow}>
              <Ionicons name="chevron-forward" size={22} color="#f5c518" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="football" size={22} color="#f5c518" />
          <Text style={styles.navLabelActive}>Discover</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate('CreateMatch')}>
          <Ionicons name="add" size={30} color="#0a0e1a" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person-outline" size={22} color="#4a5568" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
