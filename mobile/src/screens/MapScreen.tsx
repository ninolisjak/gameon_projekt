import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigation, useFocusEffect, DrawerActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeStyles } from '../styles/MapScreenStyles';
import { useColors } from '../context/PremiumContext';

type Match = {
  id: string;
  sport: 'futsal' | 'basketball';
  location: { lat: number; lng: number; name: string };
  datetime: any;
  totalSpots: number;
  filledSpots: number;
  status: string;
  players?: string[];
  createdBy?: string;
};

const TEST_MATCH: Match = {
  id: 'test',
  sport: 'futsal',
  location: { lat: 46.5547, lng: 15.6459, name: 'Športni center Tabor' },
  datetime: null,
  totalSpots: 10,
  filledSpots: 3,
  status: 'open',
  players: ['demo1', 'demo2', 'demo3'],
  createdBy: 'demo1',
};

function formatTime(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

function buildMapHtml(matches: Match[], accentColor: string) {
  const allMarkers = [TEST_MATCH, ...matches];
  const markers = allMarkers.map(m => {
    const isFutsal = m.sport === 'futsal';
    const icon = isFutsal ? '⚽' : '🏀';
    const full = m.filledSpots >= m.totalSpots;
    const accent = full ? '#ef4444' : accentColor;
    const glow = full ? 'rgba(239,68,68,0.45)' : 'rgba(0,0,0,0.45)';
    const html = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="
          background:linear-gradient(180deg,#1a2540 0%,#131929 100%);
          border:2px solid ${accent};
          border-radius:14px;
          padding:6px 10px 6px 8px;
          display:flex;align-items:center;gap:6px;
          color:#fff;font-size:12px;font-weight:700;
          font-family:-apple-system,Roboto,sans-serif;
          box-shadow:0 4px 14px ${glow}, 0 2px 4px rgba(0,0,0,0.4);
          white-space:nowrap;
        ">
          <span style="font-size:14px;line-height:1;">${icon}</span>
          <span style="letter-spacing:0.3px;">${m.filledSpots}/${m.totalSpots}</span>
        </div>
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid ${accent};
          margin-top:-1px;
          filter:drop-shadow(0 2px 2px rgba(0,0,0,0.3));
        "></div>
      </div>`;
    return `L.marker([${m.location.lat},${m.location.lng}],{icon:L.divIcon({className:'gameon-marker',html:${JSON.stringify(html)},iconSize:[60,40],iconAnchor:[30,40]})}).addTo(map).on('click',()=>window.ReactNativeWebView.postMessage('${m.id}'));`;
  }).join('\n');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body,html,#map{margin:0;padding:0;width:100%;height:100%;background:#0a0e1a}
  .leaflet-tile{filter:brightness(0.55) saturate(0.5) hue-rotate(190deg) contrast(0.95)}
  .leaflet-control-zoom,.leaflet-control-attribution{display:none}
  .gameon-marker{background:transparent !important;border:none !important;}
</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([46.5547,15.6459],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
${markers}
</script></body></html>`;
}

export default function MapScreen() {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [selected, setSelected] = React.useState<Match | null>(null);
  const [search, setSearch] = React.useState('');
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  useFocusEffect(
    React.useCallback(() => {
      const q = query(collection(db, 'matches'), where('status', '==', 'open'), where('isPublic', '==', true));
      const unsub = onSnapshot(q, snap => {
        setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
      }, err => console.error('Map snapshot error', err));
      return unsub;
    }, [])
  );

  function handleMessage(e: any) {
    const id = e.nativeEvent.data;
    const m = [TEST_MATCH, ...matches].find(x => x.id === id);
    if (m) setSelected(m);
  }

  function openDetails(m: Match) {
    navigation.navigate('MatchDetails', { matchId: m.id, initial: m });
  }

  const mapHtml = React.useMemo(() => buildMapHtml(matches, colors.primary), [matches, colors.primary]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent={false} />

      {/* Map fills the entire screen */}
      <WebView
        source={{ html: mapHtml }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled
        originWhitelist={['*']}
      />

      {/* Navbar floats on top — map shows through rounded corners */}
      <SafeAreaView edges={['top']} style={styles.bannerWrap} pointerEvents="box-none">
        <View style={styles.banner}>
          <View style={styles.bannerTopRow}>
            <View style={styles.brand}>
              <View style={styles.brandLogoBox}>
                <Ionicons name="football" size={22} color="#fff" />
              </View>
              <Text style={styles.brandText}>GameOn</Text>
            </View>
            <View style={styles.bannerRightRow}>
              <TouchableOpacity style={styles.bannerIconBtn}>
                <Ionicons name="notifications-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bannerIconBtn}
                onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              >
                <Ionicons name="menu" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchPill}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.85)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Išči lokacijo..."
              placeholderTextColor="rgba(255,255,255,0.65)"
              value={search}
              onChangeText={setSearch}
            />
            <Ionicons name="options-outline" size={18} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
      </SafeAreaView>

      {/* Locate button */}
      <TouchableOpacity style={styles.locationBtn}>
        <Ionicons name="locate-outline" size={20} color={colors.primaryLight} />
      </TouchableOpacity>

      {/* Match card — only visible after tapping a marker */}
      {selected && (
        <TouchableOpacity
          style={styles.card}
          onPress={() => openDetails(selected)}
          activeOpacity={0.9}
        >
          <View style={styles.cardHandle} />
          <TouchableOpacity
            style={styles.cardCloseBtn}
            onPress={() => setSelected(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.cardContent}>
            <View style={styles.cardIconBox}>
              <Ionicons
                name={selected.sport === 'futsal' ? 'football' : 'basketball'}
                size={30}
                color="#fff"
              />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>
                {selected.sport === 'futsal' ? 'Futsal' : 'Košarka'}{' '}
                <Text style={styles.cardVs}>{Math.floor(selected.totalSpots / 2)}v{Math.floor(selected.totalSpots / 2)}</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text style={styles.cardLocation} numberOfLines={1}>{selected.location.name}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={styles.cardMetaText}>{formatTime(selected.datetime)}</Text>
                <Ionicons name="people-outline" size={12} color={colors.textMuted} style={{ marginLeft: 6 }} />
                <Text style={styles.cardMetaText}>{selected.filledSpots}/{selected.totalSpots}</Text>
                <View style={styles.openBadge}>
                  <Text style={styles.openBadgeText}>ODPRTO</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardArrow}>
              <Ionicons name="chevron-forward" size={20} color={colors.primaryLight} />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Bottom nav floats at the bottom */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <View style={styles.navIconWrap}>
            <Ionicons name="compass" size={24} color={colors.primary} />
          </View>
          <Text style={styles.navLabelActive}>Discover</Text>
        </TouchableOpacity>

        <View style={styles.fabWrap}>
          <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate('CreateMatch')} activeOpacity={0.85}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.navIconWrap}>
            <Ionicons name="person-outline" size={24} color={colors.textFaint} />
          </View>
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
