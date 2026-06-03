import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StatusBar, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../config/firebase';
import {
  fetchActiveVenues, fetchVenueSchedule, fetchReservationsForDate,
  createReservation, Venue, ScheduleSlot, Reservation,
} from '../services/reservationService';
import {
  fetchWeatherForDateTime, weatherDescription, WeatherData,
} from '../services/weatherService';
import { exportToIcal } from '../services/icalService';

const WEEKDAY_LABELS = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];

function getNextDateForWeekday(weekday: number): Date {
  const result = new Date();
  const diff = (weekday - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' });
}

function buildStartDate(date: Date, timeHHMM: string): Date {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function buildEndDate(date: Date, timeHHMM: string): Date {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

type Step = 'venues' | 'slots' | 'confirm';

export default function BookVenueScreen() {
  const navigation = useNavigation<any>();
  const userId = auth.currentUser?.uid ?? '';

  const [step, setStep] = React.useState<Step>('venues');
  const [search, setSearch] = React.useState('');
  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = React.useState<Venue | null>(null);
  const [schedule, setSchedule] = React.useState<ScheduleSlot[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [selectedSlot, setSelectedSlot] = React.useState<ScheduleSlot | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [weather, setWeather] = React.useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [booking, setBooking] = React.useState(false);
  const [booked, setBooked] = React.useState(false);
  const [reservationId, setReservationId] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadVenues();
  }, []);

  async function loadVenues() {
    setLoading(true);
    try {
      setVenues(await fetchActiveVenues());
    } catch (e: any) {
      Alert.alert('Napaka', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectVenue(venue: Venue) {
    setSelectedVenue(venue);
    setLoading(true);
    try {
      setSchedule(await fetchVenueSchedule(venue.id));
       /*zakomentiraj zgornjo metodo setSchedule(await fetchVenueSchedule(venue.id));*//*
      const [slots, ...dateReservations] = await Promise.all([
        fetchVenueSchedule(venue.id),
        // Pre-fetch reservations for all weekdays in the schedule
      ]);
      setSchedule(slots);
      // Fetch reservations for each unique weekday in the schedule
      const weekdays = [...new Set(slots.map(s => s.weekday))];
      const allReservations: Reservation[] = [];
      await Promise.all(
        weekdays.map(async wd => {
          const date = getNextDateForWeekday(wd);
          const res = await fetchReservationsForDate(venue.id, date);
          allReservations.push(...res);
        })
      );
      setReservations(allReservations);*/
      setStep('slots');
    } catch (e: any) {
      Alert.alert('Napaka', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectSlot(slot: ScheduleSlot) {
    const date = getNextDateForWeekday(slot.weekday);
    setSelectedSlot(slot);
    setSelectedDate(date);
    setWeather(null);
    setLoading(true);
    try {
      const existing = await fetchReservationsForDate(slot.venueId, date);
      setReservations(existing);
      setStep('confirm');
      
      if (selectedVenue) {
        setWeatherLoading(true);
        const hour = parseInt(slot.startHHMM.split(':')[0]);
        const w = await fetchWeatherForDateTime(
          selectedVenue.location.lat,
          selectedVenue.location.lng,
          date,
          hour,
        );
        setWeather(w);
        setWeatherLoading(false);
      }
    } catch (e: any) {
      Alert.alert('Napaka', e.message);
    } finally {
      setLoading(false);
    }
  }

  const isSlotTaken = (slot: ScheduleSlot): boolean => {
    return reservations.some(r => r.startHHMM === slot.startHHMM);
  };

  /* ko to odkomentiraš zakomentiraj metodo nad tem z istim imenom
  const isSlotTaken = (slot: ScheduleSlot): boolean => {
    const slotDate = getNextDateForWeekday(slot.weekday);
    const slotDateStr = slotDate.toDateString();
    return reservations.some(r => {
      const rd = r.date?.toDate ? r.date.toDate() : new Date(r.date as any);
      return r.startHHMM === slot.startHHMM && rd.toDateString() === slotDateStr;
    });
  };
  */ 

  async function confirmBooking() {
    if (!selectedVenue || !selectedSlot || !selectedDate) return;
    setBooking(true);
    try {
      const id = await createReservation({
        venueId: selectedVenue.id,
        ownerId: selectedVenue.ownerId,
        bookedBy: userId,
        date: selectedDate,
        startHHMM: selectedSlot.startHHMM,
        endHHMM: selectedSlot.endHHMM,
        price: selectedSlot.pricePerSlot,
      });
      setReservationId(id);
      setBooked(true);
    } catch (e: any) {
      Alert.alert('Napaka', e.message);
    } finally {
      setBooking(false);
    }
  }

  async function handleExportIcal() {
    if (!selectedVenue || !selectedSlot || !selectedDate) return;
    try {
      const startDate = buildStartDate(selectedDate, selectedSlot.startHHMM);
      const endDate = buildEndDate(selectedDate, selectedSlot.endHHMM);
      await exportToIcal({
        title: `GameOn – ${selectedVenue.name}`,
        description: `Rezervacija igrišča: ${selectedVenue.name}\nCena: ${selectedSlot.pricePerSlot} €`,
        location: selectedVenue.location.address ?? selectedVenue.location.name,
        startDate,
        endDate,
      });
    } catch (e: any) {
      Alert.alert('Napaka', e.message);
    }
  }

  const filteredVenues = venues.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.location.address ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const bg = '#0a0e1a';
  const card = '#131929';
  const border = '#2a3550';
  const primary = '#f5c518';
  const textMain = '#fff';
  const textMuted = '#8896aa';

  // ── Booked success screen ────────────────────────────────────────────────
  if (booked && selectedVenue && selectedSlot && selectedDate) {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <StatusBar barStyle="light-content" backgroundColor={bg} />
        <ScrollView contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#22c55e22', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
          </View>
          <Text style={{ color: textMain, fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>Rezervacija potrjena!</Text>
          <Text style={{ color: textMuted, fontSize: 15, textAlign: 'center', marginBottom: 32 }}>
            {selectedVenue.name}{'\n'}{formatDate(selectedDate)}{'\n'}{selectedSlot.startHHMM} – {selectedSlot.endHHMM}
          </Text>

          {weather && (() => {
            const { emoji, label } = weatherDescription(weather.weatherCode);
            return (
              <View style={{ backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: border, padding: 16, marginBottom: 24, alignItems: 'center', width: '100%' }}>
                <Text style={{ color: textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>VREMENSKA NAPOVED OB TERMINU</Text>
                <Text style={{ fontSize: 36 }}>{emoji}</Text>
                <Text style={{ color: textMain, fontSize: 16, fontWeight: '700', marginTop: 4 }}>{weather.temperature}°C · {label}</Text>
                <Text style={{ color: textMuted, fontSize: 12, marginTop: 4 }}>💨 {weather.windSpeed} km/h · 🌧 {weather.precipitation} mm</Text>
              </View>
            );
          })()}

          <TouchableOpacity
            style={{ backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: border, padding: 16, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}
            onPress={handleExportIcal}
          >
            <Ionicons name="calendar-outline" size={20} color={primary} />
            <Text style={{ color: primary, fontWeight: '700', fontSize: 15 }}>Dodaj v koledar (.ics)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: primary, borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#0a0e1a', fontWeight: '800', fontSize: 15 }}>Nazaj na začetek</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
          <TouchableOpacity onPress={() => step === 'venues' ? navigation.goBack() : setStep(step === 'confirm' ? 'slots' : 'venues')}>
          {/* ko to odkomentiraš zakomentiraj celoten zgornji element TouchableOpacity 
          <TouchableOpacity onPress={() => {
            if (step === 'venues') { navigation.goBack(); }
            else if (step === 'confirm') { setStep('slots'); }
            else if (step === 'slots') { setStep('venues'); setSelectedVenue(null); setSchedule([]); setReservations([]); }
          }}>*/}
            <Ionicons name="arrow-back" size={24} color={textMain} />
          </TouchableOpacity>
          <Text style={{ color: textMain, fontSize: 20, fontWeight: '800', flex: 1 }}>
            {step === 'venues' ? 'Rezerviraj igrišče' : step === 'slots' ? selectedVenue?.name : 'Potrdi rezervacijo'}
          </Text>
        </View>
      </SafeAreaView>


      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
        {(['venues', 'slots', 'confirm'] as Step[]).map((s, i) => (
          <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: step === s || (i < ['venues', 'slots', 'confirm'].indexOf(step)) ? primary : border }} />
        ))}
      </View>

      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      )}


      {!loading && step === 'venues' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: card, borderRadius: 10, borderWidth: 1, borderColor: border, paddingHorizontal: 12, marginBottom: 16 }}>
            <Ionicons name="search-outline" size={16} color={textMuted} />
            <TextInput
              style={{ flex: 1, color: textMain, fontSize: 14, padding: 12 }}
              placeholder="Išči igrišče..."
              placeholderTextColor={textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {filteredVenues.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="location-outline" size={40} color={textMuted} />
              <Text style={{ color: textMuted, marginTop: 12 }}>Ni igrišč za prikaz</Text>
            </View>
          )}

          {filteredVenues.map(v => (
            <TouchableOpacity
              key={v.id}
              style={{ backgroundColor: card, borderRadius: 14, borderWidth: 1, borderColor: border, padding: 16, marginBottom: 12 }}
              onPress={() => selectVenue(v)}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textMain, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>{v.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location-outline" size={12} color={textMuted} />
                    <Text style={{ color: textMuted, fontSize: 12 }}>{v.location.address ?? v.location.name}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: primary + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>
                    {v.sport === 'both' ? '⚽ 🏀' : v.sport === 'futsal' ? '⚽ Futsal' : '🏀 Košarka'}
                  </Text>
                </View>
              </View>
              {v.description && (
                <Text style={{ color: textMuted, fontSize: 12, marginTop: 8 }} numberOfLines={2}>{v.description}</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 }}>
                <Text style={{ color: primary, fontSize: 13, fontWeight: '700' }}>Prikaži termine →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* STEP 2: Schedule slots */}
      {!loading && step === 'slots' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={{ color: textMuted, fontSize: 13, marginBottom: 16 }}>
            Izberi termin za naslednjo razpoložljivo uro:
          </Text>

          {schedule.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="calendar-outline" size={40} color={textMuted} />
              <Text style={{ color: textMuted, marginTop: 12 }}>Ni razpoložljivih terminov</Text>
            </View>
          )}

          {WEEKDAY_LABELS.map((dayLabel, weekday) => {
            const daySlots = schedule.filter(s => s.weekday === weekday);
            if (daySlots.length === 0) return null;
            const nextDate = getNextDateForWeekday(weekday);

            return (
              <View key={weekday} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text style={{ color: textMain, fontSize: 15, fontWeight: '700' }}>{dayLabel}</Text>
                  <Text style={{ color: textMuted, fontSize: 12 }}>{nextDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}</Text>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {daySlots.map(slot => {
                    const taken = isSlotTaken(slot);
                    return (
                      <TouchableOpacity
                        key={slot.id}
                        onPress={() => !taken && selectSlot(slot)}
                        disabled={taken}
                        style={{
                          backgroundColor: taken ? border + '55' : card,
                          borderWidth: 1,
                          borderColor: taken ? border : primary + '55',
                          borderRadius: 10,
                          padding: 12,
                          minWidth: 100,
                          opacity: taken ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ color: taken ? textMuted : textMain, fontWeight: '700', fontSize: 14 }}>
                          {slot.startHHMM} – {slot.endHHMM}
                        </Text>
                        <Text style={{ color: taken ? textMuted : primary, fontSize: 12, marginTop: 4 }}>
                          {taken ? 'Zasedeno' : `${slot.pricePerSlot} €`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* STEP 3: Confirm */}
      {!loading && step === 'confirm' && selectedVenue && selectedSlot && selectedDate && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ backgroundColor: card, borderRadius: 16, borderWidth: 1, borderColor: border, padding: 24, marginBottom: 16 }}>
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 16 }}>POVZETEK REZERVACIJE</Text>

            {[
              { icon: 'location-outline', label: 'Igrišče', value: selectedVenue.name },
              { icon: 'navigate-outline', label: 'Naslov', value: selectedVenue.location.address ?? selectedVenue.location.name },
              { icon: 'calendar-outline', label: 'Datum', value: formatDate(selectedDate) },
              { icon: 'time-outline', label: 'Čas', value: `${selectedSlot.startHHMM} – ${selectedSlot.endHHMM}` },
              { icon: 'cash-outline', label: 'Cena', value: `${selectedSlot.pricePerSlot} €` },
            ].map(({ icon, label, value }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: border }}>
                <Ionicons name={icon as any} size={18} color={textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textMuted, fontSize: 11 }}>{label}</Text>
                  <Text style={{ color: textMain, fontSize: 14, fontWeight: '600' }}>{value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Weather - pod */}
          <View style={{ backgroundColor: card, borderRadius: 12, borderWidth: 1, borderColor: border, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 }}>VREMENSKA NAPOVED OB TERMINU</Text>
            {weatherLoading && <ActivityIndicator color={primary} />}
            {!weatherLoading && weather && (() => {
              const { emoji, label } = weatherDescription(weather.weatherCode);
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Text style={{ fontSize: 36 }}>{emoji}</Text>
                  <View>
                    <Text style={{ color: textMain, fontSize: 18, fontWeight: '700' }}>{weather.temperature}°C · {label}</Text>
                    <Text style={{ color: textMuted, fontSize: 12, marginTop: 4 }}>💨 {weather.windSpeed} km/h · 🌧 {weather.precipitation} mm</Text>
                  </View>
                </View>
              );
            })()}
            {!weatherLoading && !weather && (
              <Text style={{ color: textMuted, fontSize: 13 }}>Napoved ni na voljo</Text>
            )}
          </View>

          <View style={{ backgroundColor: primary + '11', borderRadius: 12, borderWidth: 1, borderColor: primary + '33', padding: 14, marginBottom: 24, flexDirection: 'row', gap: 10 }}>
            <Ionicons name="information-circle-outline" size={18} color={primary} />
            <Text style={{ color: primary, fontSize: 12, flex: 1 }}>
              Rezervacija bo takoj potrjena. Plačilo se uredi neposredno z lastnikom igrišča.
            </Text>
          </View>

          <TouchableOpacity
            style={{ backgroundColor: primary, borderRadius: 12, padding: 16, alignItems: 'center', opacity: booking ? 0.7 : 1 }}
            onPress={confirmBooking}
            disabled={booking}
          >
            {booking
              ? <ActivityIndicator color="#0a0e1a" />
              : <Text style={{ color: '#0a0e1a', fontSize: 16, fontWeight: '800' }}>Potrdi rezervacijo</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
