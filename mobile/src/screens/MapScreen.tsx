import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StatusBar, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { subscribeMatches } from '../services/matchService';
import { useNavigation, useFocusEffect, DrawerActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../styles/MapScreenStyles';
import { colors } from '../styles/theme';

type Match = {
  id: string;
  sport: 'futsal' | 'basketball';
  location: { lat: number; lng: number; name: string };
  datetime: any;
  totalSpots: number;
  filledSpots: number;
  status: string;
  players?: string[];
  waitlist?: string[];
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
  waitlist: [],
  createdBy: 'demo1',
};

const RADIUS_OPTIONS: (number | null)[] = [1, 2, 5, 10, null];
const MAP_CENTER_DEFAULT = { lat: 46.5547, lng: 15.6459 };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function distanceLabel(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const d = haversineKm(lat1, lng1, lat2, lng2);
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
}

function formatTime(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

function buildMapHtml(
  visibleMatches: Match[],
  center: { lat: number; lng: number },
  radiusKm: number | null,
) {
  const markers = visibleMatches.map(m => {
    const isFutsal = m.sport === 'futsal';
    const icon = isFutsal ? '⚽' : '🏀';
    const full = m.filledSpots >= m.totalSpots;
    const accent = full ? '#ef4444' : '#3b82f6';
    const glow = full ? 'rgba(239,68,68,0.45)' : 'rgba(59,130,246,0.55)';
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

  const circleJs = radiusKm !== null ? `
    L.circle([${center.lat},${center.lng}],{
      radius:${radiusKm * 1000},
      color:'#3b82f6',fillColor:'#3b82f6',
      fillOpacity:0.07,weight:2,dashArray:'8,5'
    }).addTo(map);
    L.circleMarker([${center.lat},${center.lng}],{
      radius:5,color:'#3b82f6',fillColor:'#60a5fa',fillOpacity:1,weight:2
    }).addTo(map);
  ` : '';

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
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${center.lat},${center.lng}],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
${markers}
${circleJs}
</script></body></html>`;
}

export default function MapScreen() {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [selected, setSelected] = React.useState<Match | null>(null);
  const [search, setSearch] = React.useState('');
  const [radius, setRadius] = React.useState<number | null>(null);
  const [mapCenter, setMapCenter] = React.useState(MAP_CENTER_DEFAULT);
  const webViewRef = React.useRef<WebView>(null);
  const navigation = useNavigation<any>();

  useFocusEffect(
    React.useCallback(() => subscribeMatches(setMatches), [])
  );

  const visibleMatches = React.useMemo(() => {
    const all = [TEST_MATCH, ...matches];
    return radius === null
      ? all
      : all.filter(m => haversineKm(mapCenter.lat, mapCenter.lng, m.location.lat, m.location.lng) <= radius);
  }, [matches, mapCenter, radius]);

  React.useEffect(() => {
    if (selected && radius !== null) {
      const dist = haversineKm(mapCenter.lat, mapCenter.lng, selected.location.lat, selected.location.lng);
      if (dist > radius) setSelected(null);
    }
  }, [radius, mapCenter]);

  const mapHtml = React.useMemo(
    () => buildMapHtml(visibleMatches, mapCenter, radius),
    [visibleMatches, mapCenter, radius],
  );

  function handleLocate() {
    webViewRef.current?.injectJavaScript(`
      navigator.geolocation.getCurrentPosition(
        function(p){window.ReactNativeWebView.postMessage(JSON.stringify({type:'loc',lat:p.coords.latitude,lng:p.coords.longitude}));},
        function(){},
        {enableHighAccuracy:true,timeout:8000}
      );true;
    `);
  }

  function handleMessage(e: any) {
    const data = e.nativeEvent.data;
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'loc') { setMapCenter({ lat: msg.lat, lng: msg.lng }); return; }
    } catch {}
    const m = visibleMatches.find(x => x.id === data);
    if (m) setSelected(m);
  }

  function openDetails(m: Match) {
    navigation.navigate('MatchDetails', { matchId: m.id, initial: m });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent={false} />

      {/* Map fills the entire screen */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled
        geolocationEnabled
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

          <View style={styles.radiusRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusScroll}>
              {RADIUS_OPTIONS.map(r => (
                <TouchableOpacity
                  key={String(r)}
                  style={[styles.radiusPill, radius === r && styles.radiusPillActive]}
                  onPress={() => setRadius(r)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.radiusPillText, radius === r && styles.radiusPillTextActive]}>
                    {r === null ? 'Vse' : `${r} km`}
                  </Text>
                </TouchableOpacity>
              ))}
              {radius !== null && (
                <Text style={styles.radiusCount}>
                  {visibleMatches.length} {visibleMatches.length === 1 ? 'tekma' : 'tekem'}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>

      {/* Locate button */}
      <TouchableOpacity style={styles.locationBtn} onPress={handleLocate}>
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
                <Ionicons name="navigate-outline" size={12} color={colors.textMuted} style={{ marginLeft: 6 }} />
                <Text style={styles.cardMetaText}>
                  {distanceLabel(mapCenter.lat, mapCenter.lng, selected.location.lat, selected.location.lng)}
                </Text>
                {selected.filledSpots >= selected.totalSpots ? (
                  <View style={styles.fullBadge}>
                    <Text style={styles.fullBadgeText}>POLNO</Text>
                  </View>
                ) : (
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>ODPRTO</Text>
                  </View>
                )}
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

        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <View style={styles.navIconWrap}>
            <Ionicons name="person-outline" size={24} color={colors.textFaint} />
          </View>
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
