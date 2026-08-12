import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { joinMatch, leaveMatch, leaveWaitlist, subscribeMatch, resolveUserNames, Match, DEMO_USERS, requestMatchStart, respondToMatchStart, cancelMatchLowAttendance, acceptInvite, declineInvite } from '../services/matchService';
import { showLocalNotification } from '../services/notificationService';
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
  const [startBusy, setStartBusy] = React.useState(false);
  const [userId, setUserId] = React.useState<string>(auth.currentUser?.uid ?? 'niko');
  const [userNames, setUserNames] = React.useState<Map<string, string>>(new Map());

  const prevStartRequestedRef = React.useRef<boolean | null>(null);
  const prevMatchStartedRef = React.useRef<boolean | null>(null);
  const prevCancelledRef = React.useRef<boolean | null>(null);
  const prevInviteRef = React.useRef<boolean | null>(null);
  const matchRef = React.useRef<Match | null>(null);
  React.useEffect(() => { matchRef.current = match; }, [match]);

  React.useEffect(() => {
    const unsub = subscribeMatch(
      matchId,
      m => { if (m) setMatch(m); setLoading(false); },
      e => { console.error(e); setLoading(false); }
    );
    return unsub;
  }, [matchId]);

  React.useEffect(() => {
    if (!match) return;
    const uids = [...new Set([...(match.players ?? []), ...(match.waitlist ?? [])])];
    if (uids.length === 0) return;
    resolveUserNames(uids).then(setUserNames);
  }, [match?.players?.join(','), match?.waitlist?.join(',')]);

  
  React.useEffect(() => {
    if (!match?.id) return;

    function tryCancel() {
      const cur = matchRef.current;
      if (!cur || cur.status === 'closed' || cur.finalized || cur.matchStarted || cur.cancelReason) return;
      if (cur.filledSpots < cur.totalSpots) cancelMatchLowAttendance(cur.id).catch(() => {});
    }

    const cur = matchRef.current;
    if (!cur?.datetime) return;
    const matchDate = cur.datetime?.toDate ? cur.datetime.toDate() : new Date(cur.datetime);
    if (isNaN(matchDate.getTime())) return;

    const delay = matchDate.getTime() - Date.now();
    if (delay <= 0) { tryCancel(); return; }
    const timer = setTimeout(tryCancel, delay);
    return () => clearTimeout(timer);
  }, [match?.id]);

  React.useEffect(() => {
    if (!match) return;
    const cur = !!match.startRequested;
    const prev = prevStartRequestedRef.current;
    if (prev !== null) {
      if (!prev && cur && match.startConsent?.[userId] === 'pending') {
        showLocalNotification('Začetek tekme', 'Gostitelj predlaga začetek — potrdi v aplikaciji.').catch(() => {});
      } else if (prev && !cur && !match.matchStarted) {
        showLocalNotification('Začetek preklican', 'Ena oseba ni soglašala z začetkom tekme.').catch(() => {});
      }
    }
    prevStartRequestedRef.current = cur;
  }, [match?.startRequested, match?.matchStarted, userId]);

 
  React.useEffect(() => {
    if (!match) return;
    const cur = !!match.matchStarted;
    const prev = prevMatchStartedRef.current;
    if (prev !== null && !prev && cur) {
      showLocalNotification('Tekma se začinja!', 'Vsi so potrdili začetek.').catch(() => {});
    }
    prevMatchStartedRef.current = cur;
  }, [match?.matchStarted]);

  
  React.useEffect(() => {
    if (!match) return;
    const cur = match.status === 'closed' && match.cancelReason === 'low_attendance';
    const prev = prevCancelledRef.current;
    if (prev !== null && !prev && cur && (match.players ?? []).includes(userId)) {
      showLocalNotification('Tekma odpovedana', `Tekma ob ${formatTime(match.datetime)} je bila odpovedana — premalo udeležencev.`).catch(() => {});
    }
    prevCancelledRef.current = cur;
  }, [match?.status, match?.cancelReason, userId]);

  React.useEffect(() => {
    if (!match) return;
    const cur = !!match.pendingInvites?.[userId];
    const prev = prevInviteRef.current;
    if (prev !== null && !prev && cur) {
      const sport = match.sport === 'basketball' ? 'košarko' : 'futsal';
      showLocalNotification('Povabilo na tekmo', `Povabljeni ste k igranju ${sport}! Odpri tekmo za sprejem.`).catch(() => {});
    }
    prevInviteRef.current = cur;
  }, [match?.pendingInvites, userId]);

  async function handleStartMatch() {
    if (!match) return;
    setStartBusy(true);
    try {
      await requestMatchStart(match.id, userId);
      
    } catch (e: any) {
      Alert.alert('Napaka', e.message ?? 'Ni mogoče začeti tekme.');
    } finally {
      setStartBusy(false);
    }
  }

  async function handleConsentResponse(response: 'yes' | 'no') {
    if (!match) return;
    setStartBusy(true);
    try {
      await respondToMatchStart(match.id, userId, response);
      
    } catch (e: any) {
      Alert.alert('Napaka', e.message ?? 'Napaka pri odgovoru.');
    } finally {
      setStartBusy(false);
    }
  }

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

  async function handleAcceptInvite() {
    if (!match) return;
    setBusy(true);
    try {
      await acceptInvite(match.id, userId);
    } catch (e: any) {
      Alert.alert('Napaka', e.message ?? 'Sprejem ni uspel.');
    } finally { setBusy(false); }
  }

  async function handleDeclineInvite() {
    if (!match) return;
    setBusy(true);
    try {
      await declineInvite(match.id, userId);
    } catch (e: any) {
      Alert.alert('Napaka', e.message ?? 'Zavrnitev ni uspela.');
    } finally { setBusy(false); }
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
  const pendingInvite = match.pendingInvites?.[userId] ?? null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            {isJoined ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('MatchChat', {
                  matchId: match.id,
                  matchName: match.location?.name ?? 'Tekma',
                })}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              </TouchableOpacity>
            ) : <View style={{ width: 38 }} />}
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

          {(match.startRequested || match.matchStarted) && (
            <View style={styles.consentCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ionicons
                  name={match.matchStarted ? 'checkmark-circle' : 'radio-button-on'}
                  size={16}
                  color={match.matchStarted ? '#22c55e' : colors.primaryLight}
                />
                <Text style={styles.consentTitle}>
                  {match.matchStarted ? 'Tekma je začeta!' : 'Potrditev začetka'}
                </Text>
              </View>
              {(match.players ?? []).map(uid => {
                const consent = match.startConsent?.[uid] ?? 'pending';
                const name = uid === userId ? 'Ti' : (userNames.get(uid) ?? (uid.length <= 10 ? uid : uid.slice(0, 8)));
                return (
                  <View key={uid} style={styles.consentPlayerRow}>
                    <Text style={styles.consentPlayerName} numberOfLines={1}>{name}</Text>
                    {consent === 'yes' ? (
                      <View style={[styles.consentBadge, { backgroundColor: '#22c55e20', borderColor: '#22c55e50' }]}>
                        <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '800' }}>✓ DA</Text>
                      </View>
                    ) : consent === 'no' ? (
                      <View style={[styles.consentBadge, { backgroundColor: '#ef444420', borderColor: '#ef444450' }]}>
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>✗ NE</Text>
                      </View>
                    ) : (
                      <View style={[styles.consentBadge, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
                        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>Čakanje</Text>
                      </View>
                    )}
                  </View>
                );
              })}
              {match.startRequested && !match.matchStarted && match.startConsent?.[userId] === 'pending' && (
                <View style={styles.consentBtnRow}>
                  <TouchableOpacity
                    style={[styles.consentDaBtn, startBusy && { opacity: 0.6 }]}
                    onPress={() => handleConsentResponse('yes')}
                    disabled={startBusy}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>DA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.consentNeBtn, startBusy && { opacity: 0.6 }]}
                    onPress={() => handleConsentResponse('no')}
                    disabled={startBusy}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={18} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '800' }}>NE</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {pendingInvite && (
            <View style={{
              backgroundColor: '#f59e0b12', borderRadius: 16, padding: 16, marginBottom: 12,
              borderWidth: 1, borderColor: '#f59e0b40',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f59e0b20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="mail-outline" size={18} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>Povabilo na tekmo</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    Povabljeni ste v Ekipo {pendingInvite.team} — sprejmite ali zavrnite.
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={handleAcceptInvite}
                  disabled={busy}
                  activeOpacity={0.85}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 12 }}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>SPREJMI</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeclineInvite}
                  disabled={busy}
                  activeOpacity={0.85}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.bgElevated, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#ef444440' }}
                >
                  <Ionicons name="close" size={16} color="#ef4444" />
                  <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '800' }}>ZAVRNI</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.playersCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={() => navigation.navigate('CostSplit', { matchId: match.id })}
            activeOpacity={0.85}
          >
            <View style={[styles.infoIconBox, { width: 38, height: 38, borderRadius: 12 }]}>
              <Ionicons name="receipt-outline" size={18} color={colors.primaryLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.playersTitle}>Delitev stroška najema</Text>
              {match.rentalCost ? (
                <Text style={styles.infoSub}>
                  {(match.rentalCost / (match.players?.length || 1)).toFixed(2).replace('.', ',')} € / osebo
                  {' · '}
                  {Object.values(match.costSplit ?? {}).filter(s => s === 'paid').length}/{match.players?.length ?? 0} plačalo
                </Text>
              ) : (
                <Text style={styles.infoSub}>Strošek še ni nastavljen</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>

          {match.isPremium ? (
            <PremiumMatchPanel match={match} userId={userId} userNames={userNames} />
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
                <Text style={styles.playerName} numberOfLines={1}>
                  {userNames.get(p) ?? (p.length <= 10 ? p : p.slice(0, 8))}
                </Text>
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
                    <Text style={styles.playerName} numberOfLines={1}>
                      {userNames.get(p) ?? (p.length <= 10 ? p : p.slice(0, 8))}
                    </Text>
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
          match.matchStarted ? (
            <View style={[styles.fullBtn, { flexDirection: 'row', gap: 8, borderColor: '#22c55e40', backgroundColor: '#22c55e10' }]}>
              <Ionicons name="play-circle" size={20} color="#22c55e" />
              <Text style={[styles.fullBtnText, { color: '#22c55e' }]}>Tekma je v teku</Text>
            </View>
          ) : match.startRequested ? (
            match.startConsent?.[userId] === 'pending' ? (
              <View style={[styles.fullBtn, { flexDirection: 'row', gap: 8, borderColor: colors.primaryTint }]}>
                <Ionicons name="arrow-up" size={18} color={colors.primaryLight} />
                <Text style={[styles.fullBtnText, { color: colors.primaryLight }]}>Potrdi začetek zgoraj ↑</Text>
              </View>
            ) : (
              <View style={[styles.fullBtn, { flexDirection: 'row', gap: 8 }]}>
                <ActivityIndicator size="small" color={colors.primaryLight} />
                <Text style={styles.fullBtnText}>Čakam na soglasje ostalih...</Text>
              </View>
            )
          ) : (
            <TouchableOpacity style={styles.startBtn} onPress={handleStartMatch} disabled={startBusy} activeOpacity={0.9}>
              {startBusy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.startBtnText}>Začni tekmo</Text>
                </>
              )}
            </TouchableOpacity>
          )
        ) : pendingInvite ? (
          <View style={[styles.fullBtn, { flexDirection: 'row', gap: 8, borderColor: '#f59e0b40', backgroundColor: '#f59e0b10' }]}>
            <Ionicons name="mail-outline" size={18} color="#f59e0b" />
            <Text style={[styles.fullBtnText, { color: '#f59e0b' }]}>Povabilo čaka — odgovori zgoraj ↑</Text>
          </View>
        ) : isJoined ? (
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.danger} /> : (
              <>
                <Ionicons name="exit-outline" size={20} color={colors.danger} />
                <Text style={styles.leaveBtnText}>Odjavi se</Text>
              </>
            )}
          </TouchableOpacity>
        ) : isWaitlisted ? (
          <TouchableOpacity style={styles.waitlistLeaveBtn} onPress={handleLeaveWaitlist} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.warning} /> : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={colors.warning} />
                <Text style={styles.waitlistLeaveBtnText}>Zapusti čakalno vrsto (#{waitlistPosition})</Text>
              </>
            )}
          </TouchableOpacity>
        ) : isFull ? (
          <TouchableOpacity style={styles.waitlistBtn} onPress={handleJoin} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="hourglass-outline" size={20} color="#fff" />
                <Text style={styles.waitlistBtnText}>Pridruži se čakalni vrsti</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.joinBtnText}>Prijavi se na tekmo</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
