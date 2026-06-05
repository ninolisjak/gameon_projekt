import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar, Switch, Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { createMatch, createPrivateMatch } from '../services/matchService';
import { makeStyles } from '../styles/CreateMatchScreenStyles';
import { useColors, usePremium } from '../context/PremiumContext';

export default function CreateMatchScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { isPremium: userIsPremium } = usePremium();
  const [sport, setSport] = React.useState<'futsal' | 'basketball'>('futsal');
  const [isPremiumMatch, setIsPremiumMatch] = React.useState(false);
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [locationName, setLocationName] = React.useState('');
  const [lat, setLat] = React.useState(46.5547);
  const [lng, setLng] = React.useState(15.6459);
  const [totalSpots, setTotalSpots] = React.useState(10);
  const [datetime, setDatetime] = React.useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [showMapPicker, setShowMapPicker] = React.useState(false);
  const [pendingLat, setPendingLat] = React.useState(46.5547);
  const [pendingLng, setPendingLng] = React.useState(15.6459);
  const [loading, setLoading] = React.useState(false);
  const webViewRef = React.useRef<WebView>(null);

  function changeSpots(delta: number) {
    setTotalSpots(prev => Math.max(2, Math.min(30, prev + delta)));
  }

  function formatDateLabel(d: Date): string {
    return d.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function formatTimeLabel(d: Date): string {
    return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  }

  async function openMapPicker() {
    setPendingLat(lat);
    setPendingLng(lng);
    setShowMapPicker(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        setPendingLat(pos.coords.latitude);
        setPendingLng(pos.coords.longitude);
      }
    } catch {}
  }

  function confirmMapPick() {
    setLat(pendingLat);
    setLng(pendingLng);
    setShowMapPicker(false);
  }

  function onDateChange(_e: any, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) {
      const next = new Date(datetime);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDatetime(next);
    }
  }

  function onTimeChange(_e: any, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) {
      const next = new Date(datetime);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setDatetime(next);
    }
  }

  const mapHtml = React.useMemo(() => `
<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0a0a0a;}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const initLat = ${pendingLat};
  const initLng = ${pendingLng};
  const map = L.map('map').setView([initLat, initLng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OSM'
  }).addTo(map);
  let marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
  function post(lat, lng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat, lng }));
  }
  marker.on('dragend', e => { const p = e.target.getLatLng(); post(p.lat, p.lng); });
  map.on('click', e => { marker.setLatLng(e.latlng); post(e.latlng.lat, e.latlng.lng); });
  window.recenter = function(lat, lng) {
    map.setView([lat, lng], 15);
    marker.setLatLng([lat, lng]);
  };
</script>
</body></html>`, [showMapPicker]);

  React.useEffect(() => {
    if (showMapPicker && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.recenter && window.recenter(${pendingLat}, ${pendingLng}); true;`);
    }
  }, [pendingLat, pendingLng]);

  async function handleCreate() {
    if (!locationName.trim()) {
      Alert.alert('Manjkajo podatki', 'Vnesi ime lokacije.');
      return;
    }
    if (datetime.getTime() < Date.now()) {
      Alert.alert('Napačen čas', 'Datum/čas tekme mora biti v prihodnosti.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        sport,
        lat,
        lng,
        locationName: locationName.trim(),
        datetime,
        totalSpots,
        createdBy: auth.currentUser?.uid ?? 'anon'
      };

      if (isPrivate) {
        const { inviteCode } = await createPrivateMatch(payload);
        Alert.alert(
          'Zasebna tekma ustvarjena!', 
          `Koda za povabilo: ${inviteCode}\n\nDeli jo s soigralci — le oni bodo videli tekmo.`, 
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        await createMatch({ ...payload, isPremium: isPremiumMatch && userIsPremium, isRecurring });
        Alert.alert(
          'Tekma ustvarjena!', 
          'Javna tekma je bila uspešno objavljena na seznamu.', 
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Napaka', 
        error.message || 'Prišlo je do napake pri ustvarjanju tekme.'
      );
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
              <TouchableOpacity
                onPress={openMapPicker}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 14, borderRadius: 12,
                  backgroundColor: colors.bgElevated,
                  borderWidth: 1, borderColor: colors.border,
                }}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: colors.primary + '20',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="map" size={18} color={colors.primaryLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Izberi na zemljevidu</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Kdaj</Text>
            <View style={styles.card}>
              <View style={styles.grid2}>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>Datum</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.85}
                    style={styles.inputWithIcon}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                    <Text style={[styles.inputFlex, { color: colors.text, paddingVertical: 12 }]}>
                      {formatDateLabel(datetime)}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>Čas</Text>
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.85}
                    style={styles.inputWithIcon}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                    <Text style={[styles.inputFlex, { color: colors.text, paddingVertical: 12 }]}>
                      {formatTimeLabel(datetime)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={datetime}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={datetime}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
              />
            )}
          </View>

          <View>
            <Text style={styles.sectionLabel}>Vidnost</Text>
            <TouchableOpacity onPress={() => setIsPrivate(v => !v)} activeOpacity={0.85} style={[styles.premiumCard, isPrivate && { borderColor: colors.primary }]}>
              <View style={[styles.premiumIconBox, { backgroundColor: isPrivate ? colors.primary + '33' : undefined }]}>
                <Ionicons name={isPrivate ? 'lock-closed' : 'earth'} size={22} color={isPrivate ? colors.primary : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitleText}>{isPrivate ? 'Zasebna tekma' : 'Javna tekma'}</Text>
                <Text style={styles.premiumSubText}>{isPrivate ? 'Vidna samo povabljenim — deli kodo za dostop' : 'Vidna vsem na zemljevidu'}</Text>
              </View>
              <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </TouchableOpacity>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Ponavljanje</Text>
            <TouchableOpacity onPress={() => setIsRecurring(v => !v)} activeOpacity={0.85} style={[styles.premiumCard, isRecurring && { borderColor: '#22c55e' }]}>
              <View style={[styles.premiumIconBox, { backgroundColor: isRecurring ? '#22c55e33' : undefined }]}>
                <Ionicons name="repeat" size={22} color={isRecurring ? '#22c55e' : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitleText}>{isRecurring ? 'Ponavljajoča tekma' : 'Enkratna tekma'}</Text>
                <Text style={styles.premiumSubText}>{isRecurring ? 'Prikazana zeleno na zemljevidu — redna terminska tekma' : 'Navadna enkratna tekma'}</Text>
              </View>
              <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ false: colors.border, true: '#22c55e' }} thumbColor="#fff" />
            </TouchableOpacity>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Tip tekme</Text>
            <TouchableOpacity
              style={[styles.premiumCard, !userIsPremium && styles.premiumCardLocked]}
              activeOpacity={userIsPremium ? 0.8 : 1}
              onPress={() => {
                if (!userIsPremium) {
                  Alert.alert('Samo za Premium', 'Premium tekme lahko ustvarijo samo Premium uporabniki. Kupi Premium v profilu za 5 €.');
                  return;
                }
                setIsPremiumMatch(v => !v);
              }}
            >
              <View style={styles.premiumIconBox}>
                <Ionicons name={userIsPremium ? 'star' : 'lock-closed'} size={22} color={colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitleText}>Premium tekma</Text>
                <Text style={styles.premiumSubText}>
                  {userIsPremium
                    ? 'V živo točkovanje s potrditvami, ELO in reputacija se spreminjajo'
                    : 'Na voljo samo Premium uporabnikom (5 €)'}
                </Text>
              </View>
              <Switch
                value={isPremiumMatch && userIsPremium}
                onValueChange={v => { if (userIsPremium) setIsPremiumMatch(v); }}
                disabled={!userIsPremium}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </TouchableOpacity>
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

      <Modal visible={showMapPicker} animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            padding: 12, gap: 12,
            backgroundColor: colors.primary,
          }}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Izberi lokacijo</Text>
              <Text style={{ color: '#ffffffcc', fontSize: 11 }}>Tapni na zemljevid ali povleci marker</Text>
            </View>
          </View>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            onMessage={e => {
              try {
                const { lat: la, lng: ln } = JSON.parse(e.nativeEvent.data);
                if (typeof la === 'number' && typeof ln === 'number') {
                  setPendingLat(la);
                  setPendingLng(ln);
                }
              } catch {}
            }}
            style={{ flex: 1 }}
          />
          <View style={{
            padding: 16, gap: 8,
            backgroundColor: colors.bgElevated,
            borderTopWidth: 1, borderTopColor: colors.border,
          }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Izbrano: <Text style={{ color: colors.text, fontWeight: '700' }}>{pendingLat.toFixed(5)}, {pendingLng.toFixed(5)}</Text>
            </Text>
            <TouchableOpacity
              onPress={confirmMapPick}
              activeOpacity={0.9}
              style={{
                flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
                paddingVertical: 14, borderRadius: 12,
                backgroundColor: colors.primary,
              }}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Potrdi lokacijo</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
