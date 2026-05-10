import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Platform
} from 'react-native';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useNavigation } from '@react-navigation/native';

export default function CreateMatchScreen() {
  const navigation = useNavigation();
  const [sport, setSport] = React.useState<'futsal' | 'basketball'>('futsal');
  const [locationName, setLocationName] = React.useState('');
  const [lat, setLat] = React.useState('46.5547');
  const [lng, setLng] = React.useState('15.6459');
  const [totalSpots, setTotalSpots] = React.useState('10');
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleCreate() {
    if (!locationName || !date || !time) {
      Alert.alert('Napaka', 'Izpolni vsa polja.');
      return;
    }

    const datetime = new Date(`${date}T${time}:00`);
    if (isNaN(datetime.getTime())) {
      Alert.alert('Napaka', 'Neveljavno datum/čas. Uporabi format YYYY-MM-DD in HH:MM.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'matches'), {
        sport,
        location: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          name: locationName,
        },
        datetime: Timestamp.fromDate(datetime),
        totalSpots: parseInt(totalSpots),
        filledSpots: 1,
        status: 'open',
        isPublic: true,
        players: [auth.currentUser?.uid ?? 'anon'],
        createdBy: auth.currentUser?.uid ?? 'anon',
        createdAt: Timestamp.now(),
      });
      Alert.alert('Uspeh', 'Tekma ustvarjena!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e: any) {
      Alert.alert('Napaka', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Šport</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.sportBtn, sport === 'futsal' && styles.sportBtnActive]}
          onPress={() => setSport('futsal')}
        >
          <Text style={sport === 'futsal' ? styles.sportBtnTextActive : styles.sportBtnText}>⚽ Futsal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sportBtn, sport === 'basketball' && styles.sportBtnActive]}
          onPress={() => setSport('basketball')}
        >
          <Text style={sport === 'basketball' ? styles.sportBtnTextActive : styles.sportBtnText}>🏀 Košarka</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Ime lokacije</Text>
      <TextInput
        style={styles.input}
        placeholder="npr. Športni center Tabor"
        value={locationName}
        onChangeText={setLocationName}
      />

      <Text style={styles.label}>Latitude</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={lat}
        onChangeText={setLat}
      />

      <Text style={styles.label}>Longitude</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={lng}
        onChangeText={setLng}
      />

      <Text style={styles.label}>Datum (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-05-15"
        value={date}
        onChangeText={setDate}
      />

      <Text style={styles.label}>Čas (HH:MM)</Text>
      <TextInput
        style={styles.input}
        placeholder="18:00"
        value={time}
        onChangeText={setTime}
      />

      <Text style={styles.label}>Število mest</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={totalSpots}
        onChangeText={setTotalSpots}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Ustvarjam...' : 'Ustvari tekmo'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#fafafa',
  },
  row: { flexDirection: 'row', gap: 12 },
  sportBtn: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, padding: 12, alignItems: 'center',
  },
  sportBtnActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  sportBtnText: { color: '#666', fontSize: 15 },
  sportBtnTextActive: { color: '#1a73e8', fontWeight: '700', fontSize: 15 },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 8,
    padding: 16, alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
