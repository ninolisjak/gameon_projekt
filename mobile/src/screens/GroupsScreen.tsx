import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, StatusBar, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../config/firebase';
import { createRecurringGroup, joinGroupByInviteCode, rsvpSlot, subscribeGroups, getSlotsForGroup, RecurringGroup, RecurringSlot, RSVP, joinMatchByInviteCode } from '../services/matchService';
import { useColors } from '../context/PremiumContext';

const WEEKDAYS = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
const RSVP_LABELS: Record<RSVP, string> = { coming: 'Pridem', not_coming: 'Ne pridem', maybe: 'Morda' };
const RSVP_COLORS: Record<RSVP, string> = { coming: '#22c55e', not_coming: '#ef4444', maybe: '#f59e0b' };
const RSVP_ICONS: Record<RSVP, any> = { coming: 'checkmark-circle', not_coming: 'close-circle', maybe: 'help-circle' };

export default function GroupsScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const userId = auth.currentUser?.uid ?? '';

  const [groups, setGroups] = React.useState<RecurringGroup[]>([]);
  const [slots, setSlots] = React.useState<Record<string, RecurringSlot[]>>({});
  const [showCreate, setShowCreate] = React.useState(false);
  const [showJoin, setShowJoin] = React.useState(false);
  const [joinMode, setJoinMode] = React.useState<'group' | 'match'>('group');
  const [joinCode, setJoinCode] = React.useState('');
  const [joining, setJoining] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  // Create form state
  const [name, setName] = React.useState('');
  const [sport, setSport] = React.useState<'futsal' | 'basketball'>('futsal');
  const [locationName, setLocationName] = React.useState('');
  const [lat, setLat] = React.useState('46.5547');
  const [lng, setLng] = React.useState('15.6459');
  const [totalSpots, setTotalSpots] = React.useState(10);
  const [weekday, setWeekday] = React.useState(5); // Pet
  const [timeHHMM, setTimeHHMM] = React.useState('18:00');
  const [minQuorum, setMinQuorum] = React.useState(6);
  const [creating, setCreating] = React.useState(false);

React.useEffect(() => {
    return subscribeGroups(userId, async (gs) => {
      setGroups(gs);
      const newSlots: Record<string, RecurringSlot[]> = {};
      
      // getSlotsForGroup je zdaj asinhrona funkcija (Firebase), zato jo moramo počakati
      await Promise.all(
        gs.map(async (g) => {
          newSlots[g.id] = await getSlotsForGroup(g.id);
        })
      );
      
      setSlots(newSlots);
    });
  }, [userId]);

  async function handleCreate() {
    if (!name.trim() || !locationName.trim() || !timeHHMM) { Alert.alert('Manjkajo podatki'); return; }
    setCreating(true);
    try {
      const { inviteCode } = await createRecurringGroup({
        name: name.trim(), sport, lat: parseFloat(lat), lng: parseFloat(lng),
        locationName: locationName.trim(), totalSpots, weekday, timeHHMM,
        minQuorum, createdBy: userId,
      });
      setShowCreate(false);
      Alert.alert('Skupina ustvarjena!', `Koda za povabilo: ${inviteCode}\n\nDeli jo s soigralci.`);
    } catch (e: any) { Alert.alert('Napaka', e.message); }
    finally { setCreating(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      if (joinMode === 'group') {
        await joinGroupByInviteCode(joinCode.trim(), userId);
        Alert.alert('Uspeh', 'Pridružil si se skupini!');
      } else {
        const { matchId } = await joinMatchByInviteCode(joinCode.trim(), userId);
        Alert.alert('Uspeh', 'Pridružil si se zasebni tekmi!');
        navigation.navigate('MatchDetails', { matchId });
      }
      setShowJoin(false); setJoinCode('');
    } catch (e: any) { Alert.alert('Napaka', e.message); }
    finally { setJoining(false); }
  }

  async function handleRSVP(slotId: string, rsvp: RSVP) {
    try { await rsvpSlot(slotId, userId, rsvp); setSlots(prev => ({ ...prev })); }
    catch (e: any) { Alert.alert('Napaka', e.message); }
  }

  function shareInvite(code: string, groupName: string) {
    Share.share({ message: `Pridruži se naši skupini "${groupName}" na GameOn!\nKoda: ${code}` });
  }

  function formatDate(d: any): string {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + dt.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  }

  const bg = colors.bg ?? '#0a0e1a';
  const card = colors.bgCard ?? '#131929';
  const border = colors.border ?? '#2a3550';
  const primary = colors.primary ?? '#f5c518';
  const textMain = colors.text ?? '#fff';
  const textMuted = colors.textMuted ?? '#8896aa';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: textMain, fontSize: 22, fontWeight: '800' }}>Moje skupine</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setShowJoin(true)} style={{ backgroundColor: card, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: border }}>
              <Ionicons name="enter-outline" size={20} color={primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: primary, borderRadius: 8, padding: 8 }}>
              <Ionicons name="add" size={20} color="#0a0e1a" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {groups.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
            <Ionicons name="people-outline" size={48} color={textMuted} />
            <Text style={{ color: textMuted, fontSize: 16 }}>Nimaš še nobene skupine</Text>
            <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: '#0a0e1a', fontWeight: '700' }}>Ustvari skupino</Text>
            </TouchableOpacity>
          </View>
        )}

        {groups.map(g => {
          const isExpanded = expanded === g.id;
          const groupSlots = slots[g.id] ?? [];
          const nextSlot = groupSlots.find(s => s.status === 'pending');
          const myRsvp = nextSlot?.rsvps[userId];

          return (
            <View key={g.id} style={{ backgroundColor: card, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
              <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : g.id)} activeOpacity={0.85} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={g.sport === 'futsal' ? 'football' : 'basketball'} size={22} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textMain, fontSize: 16, fontWeight: '700' }}>{g.name}</Text>
                    <Text style={{ color: textMuted, fontSize: 12, marginTop: 2 }}>{WEEKDAYS[g.weekday]} · {g.timeHHMM} · {g.members.length} članov</Text>
                  </View>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={textMuted} />
                </View>

                {nextSlot && (
                  <View style={{ marginTop: 12, backgroundColor: bg, borderRadius: 10, padding: 12 }}>
                    <Text style={{ color: textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>NASLEDNJI TERMIN</Text>
                    <Text style={{ color: textMain, fontSize: 13, marginBottom: 10 }}>{formatDate(nextSlot.datetime)}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['coming', 'maybe', 'not_coming'] as RSVP[]).map(r => (
                        <TouchableOpacity key={r} onPress={() => handleRSVP(nextSlot.id, r)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, paddingVertical: 8, backgroundColor: myRsvp === r ? RSVP_COLORS[r] + '33' : card, borderWidth: 1, borderColor: myRsvp === r ? RSVP_COLORS[r] : border }}>
                          <Ionicons name={RSVP_ICONS[r]} size={14} color={myRsvp === r ? RSVP_COLORS[r] : textMuted} />
                          <Text style={{ color: myRsvp === r ? RSVP_COLORS[r] : textMuted, fontSize: 11, fontWeight: '600' }}>{RSVP_LABELS[r]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {(() => {
                      const coming = Object.values(nextSlot.rsvps).filter(r => r === 'coming').length;
                      return <Text style={{ color: textMuted, fontSize: 11, marginTop: 8 }}>{coming}/{g.minQuorum} potrebnih za potrditev · {g.members.length} vabljenih</Text>;
                    })()}
                    {nextSlot.status === 'confirmed' && <View style={{ marginTop: 8, backgroundColor: '#22c55e22', borderRadius: 6, padding: 6, alignItems: 'center' }}><Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 12 }}>TERMIN POTRJEN ✓</Text></View>}
                    {nextSlot.status === 'cancelled' && <View style={{ marginTop: 8, backgroundColor: '#ef444422', borderRadius: 6, padding: 6, alignItems: 'center' }}><Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>TERMIN ODPOVEDAN ✗</Text></View>}
                  </View>
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => shareInvite(g.inviteCode, g.name)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: primary + '22', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: primary + '55' }}>
                      <Ionicons name="share-outline" size={16} color={primary} />
                      <Text style={{ color: primary, fontWeight: '700', fontSize: 13 }}>Deli povabilo ({g.inviteCode})</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: textMuted, fontSize: 12 }}>Člani: {g.members.join(', ')}</Text>
                  <Text style={{ color: textMuted, fontSize: 12 }}>Kvorum: {g.minQuorum} od {g.members.length}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Modal: Join group */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <Text style={{ color: textMain, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Pridruži se z invitom</Text>
            <View style={{ flexDirection: 'row', backgroundColor: bg, borderRadius: 10, padding: 4, marginBottom: 16, gap: 4 }}>
              {(['group', 'match'] as const).map(m => (
                <TouchableOpacity key={m} onPress={() => setJoinMode(m)} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: joinMode === m ? primary : 'transparent', alignItems: 'center' }}>
                  <Text style={{ color: joinMode === m ? '#0a0e1a' : textMuted, fontWeight: '700', fontSize: 13 }}>{m === 'group' ? 'Skupina' : 'Tekma'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: 8 }}>{joinMode === 'group' ? 'Vnesi kodo skupine' : 'Vnesi kodo zasebne tekme'}</Text>
            <TextInput style={{ backgroundColor: bg, borderRadius: 10, borderWidth: 1, borderColor: border, color: textMain, padding: 14, fontSize: 18, letterSpacing: 4, textAlign: 'center', marginBottom: 16 }} placeholder="XXXXXX" placeholderTextColor={textMuted} value={joinCode} onChangeText={t => setJoinCode(t.toUpperCase())} autoCapitalize="characters" maxLength={6} />
            <TouchableOpacity onPress={handleJoin} disabled={joining} style={{ backgroundColor: primary, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8 }}>
              {joining ? <ActivityIndicator color="#0a0e1a" /> : <Text style={{ color: '#0a0e1a', fontWeight: '800', fontSize: 15 }}>Pridruži se</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowJoin(false)} style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ color: textMuted }}>Prekliči</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Create group */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <ScrollView style={{ backgroundColor: card, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: textMain, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Nova skupina</Text>

            {[['Ime skupine', name, setName, 'npr. Sredno ekipa'], ['Lokacija', locationName, setLocationName, 'npr. Sportni center'], ['Latitude', lat, setLat, '46.5547'], ['Longitude', lng, setLng, '15.6459'], ['Čas (HH:MM)', timeHHMM, setTimeHHMM, '18:00']].map(([label, value, setter, ph]) => (
              <View key={label as string} style={{ marginBottom: 12 }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{label as string}</Text>
                <TextInput style={{ backgroundColor: bg, borderRadius: 8, borderWidth: 1, borderColor: border, color: textMain, padding: 12 }} placeholder={ph as string} placeholderTextColor={textMuted} value={value as string} onChangeText={setter as any} />
              </View>
            ))}

            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Dan v tednu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {WEEKDAYS.map((d, i) => (
                  <TouchableOpacity key={i} onPress={() => setWeekday(i)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: weekday === i ? primary : bg, borderWidth: 1, borderColor: weekday === i ? primary : border }}>
                    <Text style={{ color: weekday === i ? '#0a0e1a' : textMuted, fontWeight: '700' }}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Mesta</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => setTotalSpots(v => Math.max(2, v - 2))} style={{ backgroundColor: bg, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: border }}><Ionicons name="remove" size={16} color={primary} /></TouchableOpacity>
                  <Text style={{ color: textMain, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>{totalSpots}</Text>
                  <TouchableOpacity onPress={() => setTotalSpots(v => Math.min(30, v + 2))} style={{ backgroundColor: bg, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: border }}><Ionicons name="add" size={16} color={primary} /></TouchableOpacity>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Min. kvorum</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => setMinQuorum(v => Math.max(2, v - 1))} style={{ backgroundColor: bg, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: border }}><Ionicons name="remove" size={16} color={primary} /></TouchableOpacity>
                  <Text style={{ color: textMain, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>{minQuorum}</Text>
                  <TouchableOpacity onPress={() => setMinQuorum(v => Math.min(totalSpots, v + 1))} style={{ backgroundColor: bg, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: border }}><Ionicons name="add" size={16} color={primary} /></TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={handleCreate} disabled={creating} style={{ backgroundColor: primary, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
              {creating ? <ActivityIndicator color="#0a0e1a" /> : <Text style={{ color: '#0a0e1a', fontWeight: '800', fontSize: 15 }}>Ustvari skupino</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ color: textMuted }}>Prekliči</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
