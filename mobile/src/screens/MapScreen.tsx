import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigation } from '@react-navigation/native';

type Match = {
  id: string;
  sport: string;
  location: { lat: number; lng: number; name: string };
  datetime: any;
  totalSpots: number;
  filledSpots: number;
  status: string;
};

export default function MapScreen() {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [selected, setSelected] = React.useState<Match | null>(null);
  const navigation = useNavigation<any>();

  React.useEffect(() => {
    fetchMatches();
  }, []);

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
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 46.5547,
          longitude: 15.6459,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {matches.map(m => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.location.lat, longitude: m.location.lng }}
            title={m.sport === 'futsal' ? '⚽ Futsal' : '🏀 Košarka'}
            description={`${m.filledSpots}/${m.totalSpots} igralcev`}
            onPress={() => setSelected(m)}
          />
        ))}
      </MapView>

      {selected && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selected.sport === 'futsal' ? '⚽ Futsal' : '🏀 Košarka'}</Text>
          <Text style={styles.cardText}>{selected.location.name}</Text>
          <Text style={styles.cardText}>{selected.filledSpots}/{selected.totalSpots} igralcev</Text>
          <TouchableOpacity style={styles.cardClose} onPress={() => setSelected(null)}>
            <Text style={{ color: '#666' }}>Zapri</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateMatch')}
      >
        <Text style={styles.fabText}>+ Nova tekma</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    backgroundColor: '#1a73e8', borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 12,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    elevation: 6,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  cardText: { fontSize: 14, color: '#444', marginBottom: 2 },
  cardClose: { marginTop: 8, alignSelf: 'flex-end' },
});