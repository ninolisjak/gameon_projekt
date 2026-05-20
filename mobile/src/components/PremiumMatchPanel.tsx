import React from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Match, proposeGoal, confirmGoal, dismissPendingEvent,
  checkIn, swapTeam, finalizeMatch, requiredConfirmations,
} from '../services/matchService';
import { useColors } from '../context/PremiumContext';
import { makeStyles } from '../styles/PremiumMatchPanelStyles';

type Props = {
  match: Match;
  userId: string;
};

function playerLabel(uid: string, viewerId: string, idx: number): string {
  if (uid === viewerId) return 'Ti';
  return `Igralec ${idx + 1}`;
}

export default function PremiumMatchPanel({ match, userId }: Props) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = React.useState(false);

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

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch (e: any) { Alert.alert('Napaka', e?.message ?? 'Operacija ni uspela.'); }
    finally { setBusy(false); }
  }

  function handleScore(team: 'A' | 'B') {
    withBusy(() => proposeGoal(match.id, team, userId));
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

  function handleFinalize() {
    Alert.alert(
      'Zaključi tekmo',
      `Tekma se bo zaključila z rezultatom ${scoreA} - ${scoreB}. ELO in reputacija bosta posodobljena. Nadaljuješ?`,
      [
        { text: 'Prekliči', style: 'cancel' },
        {
          text: 'Zaključi', style: 'destructive',
          onPress: () => withBusy(async () => {
            const res = await finalizeMatch(match.id, userId);
            const winner = res.result === 'team_a_won' ? 'Ekipa A' : res.result === 'team_b_won' ? 'Ekipa B' : 'Neodločeno';
            Alert.alert('Tekma zaključena', `Zmagovalec: ${winner}`);
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
          <Text style={styles.resultSub}>ELO in reputacija sta posodobljena za prisotne igralce.</Text>
        </View>
        {renderTeams()}
      </View>
    );
  }

  function renderTeams() {
    function renderPlayer(uid: string, idx: number) {
      const attended = match.attended?.includes(uid);
      return (
        <View key={uid} style={styles.teamPlayer}>
          <View style={styles.teamPlayerAvatar}>
            <Ionicons name="person" size={14} color={colors.primaryLight} />
          </View>
          <Text style={styles.teamPlayerName} numberOfLines={1}>{playerLabel(uid, userId, idx)}</Text>
          {attended ? (
            <Text style={styles.teamPlayerAttended}>✓</Text>
          ) : null}
          {isCreator && !finalized && (
            <TouchableOpacity style={styles.teamSwapBtn} onPress={() => handleSwap(uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.teamsRow}>
        <View style={styles.teamCard}>
          <Text style={styles.teamHeader}>Ekipa A · {teamA.length}</Text>
          {teamA.map(renderPlayer)}
          {teamA.length === 0 && <Text style={styles.pendingSubText}>Ni igralcev</Text>}
        </View>
        <View style={styles.teamCard}>
          <Text style={styles.teamHeader}>Ekipa B · {teamB.length}</Text>
          {teamB.map(renderPlayer)}
          {teamB.length === 0 && <Text style={styles.pendingSubText}>Ni igralcev</Text>}
        </View>
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

        {isJoined && (
          <View style={styles.scoreBtnRow}>
            <TouchableOpacity
              style={[styles.scoreBtn, busy && styles.scoreBtnDisabled]}
              onPress={() => handleScore('A')}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.scoreBtnText}>Gol Ekipa A</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scoreBtn, busy && styles.scoreBtnDisabled]}
              onPress={() => handleScore('B')}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.scoreBtnText}>Gol Ekipa B</Text>
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
                  <Text style={styles.pendingText}>Gol za Ekipo {e.team}</Text>
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
              <Text style={styles.finalizeBtnText}>Zaključi tekmo in posodobi ELO</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
