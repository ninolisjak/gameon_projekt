import React from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigation } from '@react-navigation/native';
import { styles, darkMapStyle } from '../styles/MapScreenStyles';

type Match = {
  id: string;
  sport: string;
  location: { lat: number; lng: number; name: string };
  datetime: any;
  totalSpots: number;
  filledSpots: number;
  status: string;
};

function formatTime(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

export default function MapScreen() {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [selected, setSelected] = React.useState<Match | null>(null);
  const [search, setSearch] = React.useState('');
  const navigation = useNavigation<any>();

  React.useEffect(() => { fetchMatches(); }, []);

  async function fetchMatches() {
    const q = query(
      collection(db, 'matches'),
      where('status', '==', 'open'),
      where('isPublic', '==', true)
    );
    const snap = await getDocs(q);
    setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      {/* iskanje */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color="#555" style={{ marginHorizontal: 4 }} />
        <TextInput style={styles.searchInput} placeholder="Išči lokacijo..." placeholderTextColor="#555" value={search} onChangeText={setSearch} autoFocus={false} showSoftInputOnFocus={false} />
        <Ionicons name="locate-outline" size={16} color="#555" style={{ marginHorizontal: 4 }} />
      </View>

      {/* Mapa */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: 46.5547,
            longitude: 15.6459,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {matches.map(m => (
            <Marker key={m.id} coordinate={{ latitude: m.location.lat, longitude: m.location.lng }} onPress={() => setSelected(m)} >
              <View style={[styles.markerContainer, selected?.id === m.id && styles.markerSelected]}>
                <Ionicons
                  name={m.sport === 'futsal' ? 'football-outline' : 'basketball-outline'}
                  size={18}
                  color={selected?.id === m.id ? '#f5c518' : '#fff'}
                />
                <Text style={styles.markerCount}>{m.filledSpots}/{m.totalSpots}</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        <TouchableOpacity style={styles.locationBtn}>
          <Ionicons name="locate-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Spodnji card  */}
      {selected && (
        <TouchableOpacity style={styles.card} onPress={() => setSelected(null)} activeOpacity={0.95} >
          <View style={styles.cardHandle} />
          <View style={styles.cardContent}>
            <View style={styles.cardIconBox}>
              <Ionicons name={selected.sport === 'futsal' ? 'football' : 'basketball'} size={28} color="#0a0e1a" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>
                {selected.sport === 'futsal' ? 'Futsal' : 'Košarka'}{' '}
                <Text style={styles.cardVs}>{selected.totalSpots / 2}v{selected.totalSpots / 2}</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="location-outline" size={12} color="#8896aa" />
                <Text style={styles.cardLocation}>{selected.location.name}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Ionicons name="time-outline" size={12} color="#8896aa" />
                <Text style={styles.cardMetaText}>{formatTime(selected.datetime)}</Text>
                <Ionicons name="people-outline" size={12} color="#8896aa" />
                <Text style={styles.cardMetaText}>{selected.filledSpots}/{selected.totalSpots}</Text>
                <View style={styles.openBadge}>
                  <Text style={styles.openBadgeText}>Odprto</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.cardArrow}>
              <Ionicons name="chevron-forward" size={22} color="#f5c518" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Spodnja navigacija*/}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="football" size={22} color="#f5c518" />
          <Text style={styles.navLabelActive}>Discover</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => navigation.navigate('CreateMatch')}
        >
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
