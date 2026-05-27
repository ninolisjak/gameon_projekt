import React from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Match, UserDoc, proposeGoal, confirmGoal, dismissPendingEvent,
  checkIn, swapTeam, finalizeMatch, requiredConfirmations,
  fetchInvitablePlayers, invitePlayerToMatch, regenerateTeams,
} from '../services/matchService';
import { useColors } from '../context/PremiumContext';
import { makeStyles } from '../styles/PremiumMatchPanelStyles';

type Props = {
  match: Match;
  userId: string;
  userNames?: Map<string, string>;
};

function resolveName(uid: string, viewerId: string, userNames?: Map<string, string>): string {
  if (uid === viewerId) return 'Ti';
  const resolved = userNames?.get(uid);
  if (resolved) return resolved;
  if (uid.length <= 10) return uid;
  return uid.slice(0, 8);
}

export default function PremiumMatchPanel({ match, userId, userNames }: Props) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = React.useState(false);
  const [inviteTeam, setInviteTeam] = React.useState<'A' | 'B' | null>(null);
  const [invitablePlayers, setInvitablePlayers] = React.useState<UserDoc[]>([]);
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [invitingId, setInvitingId] = React.useState<string | null>(null);

  const isCreator = match.createdBy === userId;
  const isJoined = !!match.players?.includes(userId);
  const hasCheckedIn = !!match.attended?.includes(userId);
  const teamA = match.teamA ?? [];
  const teamB = match.teamB ?? [];
  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;
  const pending = match.pendingEvents ?? [];
  const finalized = !!match.finalized;
  const threshold = requiredConfirmations(match.totalSpots);
  const onTeam = teamA.includes(userId) || teamB.includes(userId);

  const goalsByPlayer = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of (match.events ?? [])) {
      if (e.scorerId) map[e.scorerId] = (map[e.scorerId] ?? 0) + 1;
    }
    return map;
  }, [match.events]);

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch (e: any) { Alert.alert('Napaka', e?.message ?? 'Operacija ni uspela.'); }
    finally { setBusy(false); }
  }

  function handleScore() {
    withBusy(() => proposeGoal(match.id, userId, userId));
  }

  function handleConfirm(eventId: string) {
    withBusy(() => confirmGoal(match.id, eventId, userId));
  }

  function handleDismiss(eventId: string) {
    withBusy(() => dismissPendingEvent(match.id, eventId, userId));
  }

  function handleCheckIn() {
    withBusy(() => checkIn(match.id, userId));
  }

  function handleSwap(playerId: string) {
    withBusy(() => swapTeam(match.id, playerId, userId));
  }

  function handleRegenerateTeams() {
    Alert.alert(
      'Izravnaj ekipi',
      'Sistem bo na novo razporedil igralce glede na ELO, statistiko in pozicijo. Ali nadaljuješ?',
      [
        { text: 'Prekliči', style: 'cancel' },
        {
          text: 'Izravnaj',
          onPress: () => withBusy(async () => {
            await regenerateTeams(match.id, userId);
          }),
        },
      ]
    );
  }

  function balanceColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  }

  async function handleOpenInvite(team: 'A' | 'B') {
    if (inviteTeam === team) { setInviteTeam(null); return; }
    setInviteTeam(team);
    setInviteLoading(true);
    try {
      const excluded = [...(match.players ?? []), ...(match.waitlist ?? [])];
      const players = await fetchInvitablePlayers(200, 20, excluded);
      setInvitablePlayers(players);
    } catch {
      setInvitablePlayers([]);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleInvite(uid: string) {
    if (!inviteTeam) return;
    setInvitingId(uid);
    try {
      await invitePlayerToMatch(match.id, uid, inviteTeam);
      setInviteTeam(null);
      setInvitablePlayers([]);
    } catch (e: any) {
      Alert.alert('Napaka', e?.message ?? 'Povabilo ni uspelo.');
    } finally {
      setInvitingId(null);
    }
  }

  function handleFinalize() {
    Alert.alert(
      'Končaj tekmo',
      `Tekma se bo končala z rezultatom ${scoreA} - ${scoreB}. ELO in reputacija bosta posodobljena za vse prisotne igralce. Nadaljuješ?`,
      [
        { text: 'Prekliči', style: 'cancel' },
        {
          text: 'Končaj tekmo', style: 'destructive',
          onPress: () => withBusy(async () => {
            const res = await finalizeMatch(match.id, userId);
            const winner = res.result === 'team_a_won' ? 'Ekipa A' : res.result === 'team_b_won' ? 'Ekipa B' : 'Neodločeno';
            const lines = res.perPlayer
              .map(p => {
                const sign = p.dElo >= 0 ? '+' : '';
                const goalNote = p.goals > 0 ? ` (${p.goals}⚽)` : '';
                return `${resolveName(p.uid, userId, userNames)}: ${sign}${p.dElo} ELO${goalNote}, ${p.dRep >= 0 ? '+' : ''}${p.dRep} rep`;
              })
              .join('\n');
            Alert.alert(`Zmagovalec: ${winner}`, lines || 'Ni sprememb.');
          }),
        },
      ]
    );
  }

  if (finalized) {
    const winnerLabel =
      match.result === 'team_a_won' ? 'Zmaga Ekipe A' :
      match.result === 'team_b_won' ? 'Zmaga Ekipe B' :
      'Neodločeno';
    return (
      <View style={{ gap: 18 }}>
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>Končni rezultat</Text>
          <Text style={{ color: colors.text, fontSize: 56, fontWeight: '900', letterSpacing: -2 }}>{scoreA} - {scoreB}</Text>
          <Text style={styles.resultTitle}>{winnerLabel}</Text>
          <Text style={styles.resultSub}>ELO razdeljen glede na zmago/poraz in dosežene gole (⚽). Reputacija za prisotnost.</Text>
        </View>
        {renderTeams()}
      </View>
    );
  }

  function renderTeams() {
    function renderPlayer(uid: string, _idx: number) {
      const attended = match.attended?.includes(uid);
      const goals = goalsByPlayer[uid] ?? 0;
      return (
        <View key={uid} style={styles.teamPlayer}>
          <View style={styles.teamPlayerAvatar}>
            <Ionicons name="person" size={14} color={colors.primaryLight} />
          </View>
          <Text style={styles.teamPlayerName} numberOfLines={1}>{resolveName(uid, userId, userNames)}</Text>
          {goals > 0 && <Text style={styles.teamPlayerGoals}>⚽ {goals}</Text>}
          {attended ? <Text style={styles.teamPlayerAttended}>✓</Text> : null}
          {isCreator && !finalized && (
            <TouchableOpacity style={styles.teamSwapBtn} onPress={() => handleSwap(uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    function renderTeamCard(team: 'A' | 'B') {
      const players = team === 'A' ? teamA : teamB;
      const isOpen = inviteTeam === team;
      return (
        <View key={team} style={styles.teamCard}>
          <View style={styles.teamHeaderRow}>
            <Text style={styles.teamHeader}>Ekipa {team} · {players.length}</Text>
            {isCreator && !finalized && (
              <TouchableOpacity
                style={[styles.teamInviteBtn, isOpen && styles.teamInviteBtnActive]}
                onPress={() => handleOpenInvite(team)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name={isOpen ? 'close' : 'add'} size={14} color={isOpen ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {players.map(renderPlayer)}
          {players.length === 0 && <Text style={styles.pendingSubText}>Ni igralcev</Text>}
        </View>
      );
    }

    const balanceScore = match.balanceScore;
    const balanceMeta = match.balanceMeta;
    const showBalance = match.teamsBalanced && balanceScore !== undefined && balanceMeta;
    const canRegen = isCreator && !finalized && !match.matchStarted && (match.players?.length ?? 0) >= 2;

    return (
      <View style={{ gap: 12 }}>
        {showBalance && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            padding: 12, borderRadius: 12,
            backgroundColor: colors.bgElevated,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: balanceColor(balanceScore!) + '20',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: balanceColor(balanceScore!),
            }}>
              <Text style={{ color: balanceColor(balanceScore!), fontWeight: '900', fontSize: 14 }}>{balanceScore}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>Uravnoteženost ekip</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                ELO A: {balanceMeta!.avgEloA} · ELO B: {balanceMeta!.avgEloB} · Razlika: {balanceMeta!.eloDiff}
              </Text>
            </View>
            {canRegen && (
              <TouchableOpacity
                onPress={handleRegenerateTeams}
                disabled={busy}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>IZRAVNAJ</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!showBalance && canRegen && (match.players?.length ?? 0) >= 2 && (
          <TouchableOpacity
            onPress={handleRegenerateTeams}
            disabled={busy}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: 10, borderRadius: 10,
              backgroundColor: colors.bgElevated,
              borderWidth: 1, borderColor: colors.primaryTint ?? colors.border,
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="git-network" size={16} color={colors.primaryLight} />
            <Text style={{ color: colors.primaryLight, fontSize: 13, fontWeight: '800' }}>Avtomatsko izravnaj ekipi</Text>
          </TouchableOpacity>
        )}
        <View style={styles.teamsRow}>
          {renderTeamCard('A')}
          {renderTeamCard('B')}
        </View>

        {inviteTeam !== null && (
          <View style={styles.invitePanel}>
            <Text style={styles.invitePanelTitle}>Povabi v Ekipo {inviteTeam}</Text>
            {inviteLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : invitablePlayers.length === 0 ? (
              <Text style={styles.inviteEmpty}>Ni ustreznih igralcev (ELO &gt; 200, reputacija &gt; 20)</Text>
            ) : (
              invitablePlayers.map(u => {
                const name = u.displayName || (u.email ? u.email.split('@')[0] : u.uid.slice(0, 8));
                const isInviting = invitingId === u.uid;
                return (
                  <View key={u.uid} style={styles.invitePlayerRow}>
                    <View style={styles.invitePlayerAvatar}>
                      <Ionicons name="person" size={14} color={colors.primaryLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invitePlayerName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.invitePlayerStats}>ELO {u.elo} · Rep {u.reputation}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.inviteBtn, isInviting && { opacity: 0.5 }]}
                      onPress={() => handleInvite(u.uid)}
                      disabled={invitingId !== null}
                      activeOpacity={0.85}
                    >
                      {isInviting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.inviteBtnText}>POVABI</Text>}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 18 }}>
      <View style={styles.scoreboard}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreTeamLabel}>Ekipa A</Text>
            <Text style={styles.scoreValue}>{scoreA}</Text>
          </View>
          <Text style={styles.scoreSeparator}>:</Text>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreTeamLabel}>Ekipa B</Text>
            <Text style={styles.scoreValue}>{scoreB}</Text>
          </View>
        </View>

        {isJoined && onTeam && !finalized && (
          <View style={styles.scoreBtnRow}>
            <TouchableOpacity
              style={[styles.scoreBtn, busy && styles.scoreBtnDisabled]}
              onPress={handleScore}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Ionicons name="football" size={18} color="#fff" />
              <Text style={styles.scoreBtnText}>
                Zadel sem gol (Ekipa {teamA.includes(userId) ? 'A' : 'B'})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isJoined && (
        <View style={styles.checkInBar}>
          <View style={styles.checkInIcon}>
            <Ionicons name={hasCheckedIn ? 'checkmark-circle' : 'location-outline'} size={20} color={colors.primaryLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkInTitle}>{hasCheckedIn ? 'Prisoten' : 'Prijava prisotnosti'}</Text>
            <Text style={styles.checkInSub}>{hasCheckedIn ? 'Štel boš kot prisoten za reputacijo.' : 'Označi se kot prisoten na tekmi.'}</Text>
          </View>
          {!hasCheckedIn && (
            <TouchableOpacity style={styles.checkInBtn} onPress={handleCheckIn} disabled={busy} activeOpacity={0.85}>
              <Text style={styles.checkInBtnText}>SEM TUKAJ</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {pending.length > 0 && (
        <View style={styles.pendingCard}>
          <View style={styles.pendingHeader}>
            <Ionicons name="hourglass-outline" size={14} color={colors.warning} />
            <Text style={styles.pendingTitle}>Čaka potrditve · potrebnih {threshold}</Text>
          </View>
          {pending.map((e, idx) => {
            const alreadyConfirmed = e.confirmedBy.includes(userId);
            const canConfirm = isJoined && !alreadyConfirmed;
            return (
              <View key={e.id} style={[styles.pendingItem, idx === 0 && styles.pendingItemFirst]}>
                <View style={styles.pendingDot}>
                  <Text style={{ color: colors.primaryLight, fontWeight: '900' }}>{e.team}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingText}>Gol · {resolveName(e.scorerId, userId, userNames)} (Ekipa {e.team})</Text>
                  <Text style={styles.pendingSubText}>{e.confirmedBy.length} / {threshold} potrditev</Text>
                </View>
                <TouchableOpacity
                  style={[styles.pendingConfirmBtn, !canConfirm && styles.pendingConfirmBtnDisabled]}
                  onPress={() => handleConfirm(e.id)}
                  disabled={!canConfirm || busy}
                  activeOpacity={0.85}
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                      <Text style={styles.pendingConfirmBtnText}>{alreadyConfirmed ? 'POTRJENO' : 'POTRDI'}</Text>
                    </>
                  )}
                </TouchableOpacity>
                {isCreator && (
                  <TouchableOpacity style={styles.pendingDismissBtn} onPress={() => handleDismiss(e.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {renderTeams()}

      {isCreator && (
        <TouchableOpacity style={styles.finalizeBtn} onPress={handleFinalize} disabled={busy} activeOpacity={0.9}>
          {busy ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="flag" size={18} color="#fff" />
              <Text style={styles.finalizeBtnText}>Končaj tekmo in razdeli ELO</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
