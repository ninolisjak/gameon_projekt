import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { createMatch } from '../services/matchService';
import { styles } from '../styles/CreateMatchScreenStyles';
import { colors } from '../styles/theme';

export default function CreateMatchScreen() {
  const navigation = useNavigation<any>();
  const [sport, setSport] = React.useState<'futsal' | 'basketball'>('futsal');
  const [locationName, setLocationName] = React.useState('');
  const [lat, setLat] = React.useState('46.5547');
  const [lng, setLng] = React.useState('15.6459');
  const [totalSpots, setTotalSpots] = React.useState(10);
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  function changeSpots(delta: number) {
    setTotalSpots(prev => Math.max(2, Math.min(30, prev + delta)));
  }

  async function handleCreate() {
    if (!locationName.trim() || !date || !time) {
      Alert.alert('Manjkajo podatki', 'Izpolni lokacijo, datum in čas.');
      return;
    }
    const datetime = new Date(`${date}T${time}:00`);
    if (isNaN(datetime.getTime())) {
      Alert.alert('Napačen format', 'Datum: YYYY-MM-DD, Čas: HH:MM.');
      return;
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      Alert.alert('Napačne koordinate', 'Latitude in longitude morata biti številki.');
      return;
    }
    setLoading(true);
    try {
      await createMatch({
        sport, lat: latNum, lng: lngNum, locationName: locationName.trim(),
        datetime, totalSpots,
        createdBy: auth.currentUser?.uid ?? 'anon',
      });
      Alert.alert('Uspeh', 'Tekma ustvarjena!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Napaka', e.message ?? 'Ustvarjanje ni uspelo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SafeAreaView edges={['top']} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroEyebrow}>Ustvari tekmo</Text>
          <Text style={styles.heroTitle}>Nova javna tekma</Text>
          <Text style={styles.heroSub}>Povabi igralce iz tvoje okolice</Text>
        </SafeAreaView>

        <View style={styles.body}>
          <View>
            <Text style={styles.sectionLabel}>Šport</Text>
            <View style={styles.sportRow}>
              <TouchableOpacity
                style={[styles.sportTile, sport === 'futsal' && styles.sportTileActive]}
                onPress={() => setSport('futsal')}
                activeOpacity={0.85}
              >
                <Ionicons name="football" size={28} color={sport === 'futsal' ? colors.primaryLight : colors.textMuted} />
                <Text style={sport === 'futsal' ? styles.sportTileTextActive : styles.sportTileText}>Futsal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sportTile, sport === 'basketball' && styles.sportTileActive]}
                onPress={() => setSport('basketball')}
                activeOpacity={0.85}
              >
                <Ionicons name="basketball" size={28} color={sport === 'basketball' ? colors.primaryLight : colors.textMuted} />
                <Text style={sport === 'basketball' ? styles.sportTileTextActive : styles.sportTileText}>Košarka</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Lokacija</Text>
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Ime lokacije</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="location-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="npr. Športni center Tabor"
                    placeholderTextColor={colors.textFaint}
                    value={locationName}
                    onChangeText={setLocationName}
                  />
                </View>
              </View>
              <View style={styles.grid2}>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textFaint}
                    value={lat}
                    onChangeText={setLat}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textFaint}
                    value={lng}
                    onChangeText={setLng}
                  />
                </View>
              </View>
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Kdaj</Text>
            <View style={styles.card}>
              <View style={styles.grid2}>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>Datum</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="2026-05-15"
                      placeholderTextColor={colors.textFaint}
                      value={date}
                      onChangeText={setDate}
                    />
                  </View>
                </View>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>Čas</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="18:00"
                      placeholderTextColor={colors.textFaint}
                      value={time}
                      onChangeText={setTime}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Število mest</Text>
            <View style={styles.card}>
              <View style={styles.spotsRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, totalSpots <= 2 && styles.stepperBtnDisabled]}
                  onPress={() => changeSpots(-2)}
                  disabled={totalSpots <= 2}
                >
                  <Ionicons name="remove" size={22} color={colors.primaryLight} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.spotsValue}>{totalSpots}</Text>
                  <Text style={styles.spotsHint}>{Math.floor(totalSpots / 2)}v{Math.floor(totalSpots / 2)} format</Text>
                </View>
                <TouchableOpacity
                  style={[styles.stepperBtn, totalSpots >= 30 && styles.stepperBtnDisabled]}
                  onPress={() => changeSpots(2)}
                  disabled={totalSpots >= 30}
                >
                  <Ionicons name="add" size={22} color={colors.primaryLight} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitBtnText}>Ustvari tekmo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
