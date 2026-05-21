import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { joinMatch, leaveMatch, leaveWaitlist, subscribeMatch, Match, DEMO_USERS } from '../services/matchService';
import { makeStyles } from '../styles/MatchDetailsScreenStyles';
import { useColors, usePremium } from '../context/PremiumContext';
import PremiumMatchPanel from '../components/PremiumMatchPanel';

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatTime(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

export default function MatchDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { matchId, initial } = route.params as { matchId: string; initial?: Match };
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { isPremium: userIsPremium } = usePremium();

  const [match, setMatch] = React.useState<Match | null>(initial ?? null);
  const [loading, setLoading] = React.useState(!initial);
  const [busy, setBusy] = React.useState(false);
  const [userId, setUserId] = React.useState<string>(auth.currentUser?.uid ?? 'niko');

  React.useEffect(() => {
    const unsub = subscribeMatch(
      matchId,
      m => { if (m) setMatch(m); setLoading(false); },
      e => { console.error(e); setLoading(false); }
    );
    return unsub;
  }, [matchId]);

  const waitlist = match?.waitlist ?? [];
  const isJoined = !!match?.players?.includes(userId);
  const isWaitlisted = waitlist.includes(userId);
  const waitlistPosition = isWaitlisted ? waitlist.indexOf(userId) + 1 : 0;
  const isCreator = match?.createdBy === userId;
  const isFull = !!match && match.filledSpots >= match.totalSpots;
  const progress = match ? Math.min(match.filledSpots / match.totalSpots, 1) : 0;
  const sportLabel = match?.sport === 'basketball' ? 'Košarka' : 'Futsal';
  const sportIcon = match?.sport === 'basketball' ? 'basketball' : 'football';

  async function handleJoin() {
    if (!match) return;
    if (matchId === 'test') { Alert.alert('Demo', 'Demo tekma — prijava ni možna.'); return; }
    if (match?.isPremium && !userIsPremium) {
      Alert.alert('Samo za Premium', 'Premium tekme so na voljo samo Premium uporabnikom. Kupi Premium v profilu za 5 €.');
      return;
    }
    setBusy(true);
    try {
      const result = await joinMatch(matchId, userId, { userIsPremium });
      if (result.status === 'waitlisted') {
        Alert.alert('Čakalna vrsta', `Tekma je polna. Dodan si na čakalno vrsto, pozicija #${result.position}.`);
      }
    } catch (e: any) {
      Alert.alert('Napaka', e.message ?? 'Prijava ni uspela.');
    } finally { setBusy(false); }
  }

  async function handleLeave() {
    if (!match) return;
    if (matchId === 'test') { Alert.alert('Demo', 'Demo tekma — odjava ni možna.'); return; }
    const promotionMsg = waitlist.length > 0
      ? '\n\nPrvi igralec iz čakalne vrste bo samodejno prevzel tvoje mesto.'
      : '';
    Alert.alert('Odjava', `Si prepričan, da se želiš odjaviti?${promotionMsg}`, [
      { text: 'Prekliči', style: 'cancel' },
      {
        text: 'Odjava', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaveMatch(matchId, userId);
          } catch (e: any) {
            Alert.alert('Napaka', e.message ?? 'Odjava ni uspela.');
          } finally { setBusy(false); }
        },
      },
    ]);
  }

  async function handleLeaveWaitlist() {
    if (!match || matchId === 'test') return;
    setBusy(true);
    try {
      await leaveWaitlist(matchId, userId);
    } catch (e: any) {
      Alert.alert('Napaka', e.message ?? 'Odstranitev ni uspela.');
    } finally { setBusy(false); }
  }

  if (loading || !match) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const emptySlots = Math.max(0, match.totalSpots - (match.players?.length ?? match.filledSpots));
  const waitlistCount = waitlist.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: isFull ? '#ef4444' : '#22c55e' }]} />
              <Text style={styles.statusText}>{isFull ? 'POLNO' : 'ODPRTO'}</Text>
            </View>
          </View>

          <View style={styles.heroContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sportEyebrow}>{sportLabel} · {Math.floor(match.totalSpots / 2)}v{Math.floor(match.totalSpots / 2)}</Text>
              {match.isPremium && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Ionicons name="star" size={10} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>PREMIUM</Text>
                </View>
              )}
            </View>
            <Text style={styles.sportTitle}>Pick-up game</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.locationText} numberOfLines={2}>{match.location.name}</Text>
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          <View style={styles.userSwitcherCard}>
            <Text style={styles.userSwitcherLabel}>Demo · izberi identiteto</Text>
            <View style={styles.userSwitcherRow}>
              {auth.currentUser && (
                <TouchableOpacity
                  key="me"
                  style={[styles.userPill, userId === auth.currentUser.uid && styles.userPillActive]}
                  onPress={() => setUserId(auth.currentUser!.uid)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.userPillText, userId === auth.currentUser.uid && styles.userPillTextActive]}>Jaz</Text>
                </TouchableOpacity>
              )}
              {DEMO_USERS.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.userPill, userId === u && styles.userPillActive]}
                  onPress={() => setUserId(u)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.userPillText, userId === u && styles.userPillTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primaryLight} />
                </View>
                <Text style={styles.infoLabel}>Datum</Text>
              </View>
              <Text style={styles.infoValue}>{formatDate(match.datetime)}</Text>
              <Text style={styles.infoSub}>{formatTime(match.datetime)}</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIconRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name={sportIcon} size={16} color={colors.primaryLight} />
                </View>
                <Text style={styles.infoLabel}>Šport</Text>
              </View>
              <Text style={styles.infoValue}>{sportLabel}</Text>
              <Text style={styles.infoSub}>Javna tekma</Text>
            </View>
          </View>

          {match.isPremium ? (
            <PremiumMatchPanel match={match} userId={userId} />
          ) : (
          <View style={styles.playersCard}>
            <View style={styles.playersHeader}>
              <Text style={styles.playersTitle}>Igralci</Text>
              <Text style={styles.playersCount}>{match.filledSpots} / {match.totalSpots}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>

            {(match.players ?? []).map((p, idx) => (
              <View key={p + idx} style={styles.playerRow}>
                <View style={styles.playerAvatar}>
                  <Ionicons name="person" size={18} color={colors.primaryLight} />
                </View>
                <Text style={styles.playerName} numberOfLines={1}>{p}</Text>
                {p === userId && (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>TI</Text>
                  </View>
                )}
                {match.createdBy === p && (
                  <View style={styles.playerBadge}>
                    <Text style={styles.playerBadgeText}>HOST</Text>
                  </View>
                )}
              </View>
            ))}

            {Array.from({ length: emptySlots }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.emptySlot}>
                <View style={styles.emptyAvatar}>
                  <Ionicons name="add" size={16} color={colors.textFaint} />
                </View>
                <Text style={styles.emptyText}>Prosto mesto</Text>
              </View>
            ))}

            {waitlistCount > 0 && (
              <View style={styles.waitlistDivider}>
                <View style={styles.waitlistHeader}>
                  <Text style={styles.waitlistTitle}>Čakalna vrsta</Text>
                  <Text style={styles.waitlistCount}>{waitlistCount} {waitlistCount === 1 ? 'oseba' : 'oseb'}</Text>
                </View>
                {waitlist.map((p, idx) => (
                  <View key={`wl-${p}-${idx}`} style={styles.waitlistRow}>
                    <View style={styles.waitlistAvatar}>
                      <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
                    </View>
                    <Text style={styles.playerName} numberOfLines={1}>{p}</Text>
                    {p === userId && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>TI</Text>
                      </View>
                    )}
                    <View style={styles.waitlistPositionBadge}>
                      <Text style={styles.waitlistPositionText}>#{idx + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        {match.finalized ? (
          <View style={styles.fullBtn}>
            <Text style={styles.fullBtnText}>Tekma končana</Text>
          </View>
        ) : isCreator ? (
          <View style={styles.fullBtn}>
            <Text style={styles.fullBtnText}>Ti si ustvarjalec tekme</Text>
          </View>
        ) : isJoined ? (
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.danger} /> : (<><Ionicons name="exit-outline" size={20} color={colors.danger} /><Text style={styles.leaveBtnText}>Odjavi se</Text></>)}
          </TouchableOpacity>
        ) : isWaitlisted ? (
          <TouchableOpacity style={styles.waitlistLeaveBtn} onPress={handleLeaveWaitlist} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.warning} /> : (<><Ionicons name="close-circle-outline" size={20} color={colors.warning} /><Text style={styles.waitlistLeaveBtnText}>Zapusti čakalno vrsto (#{waitlistPosition})</Text></>)}
          </TouchableOpacity>
        ) : isFull ? (
          <TouchableOpacity style={styles.waitlistBtn} onPress={handleJoin} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (<><Ionicons name="hourglass-outline" size={20} color="#fff" /><Text style={styles.waitlistBtnText}>Pridruži se čakalni vrsti</Text></>)}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (<><Ionicons name="checkmark-circle" size={22} color="#fff" /><Text style={styles.joinBtnText}>Prijavi se na tekmo</Text></>)}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  //test
}
