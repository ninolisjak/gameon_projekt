import React from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Match, UserDoc, checkIn, swapTeam, submitMatchScore,
  fetchInvitablePlayers, invitePlayerToMatch, regenerateTeams,
  resolveUserProfiles, suggestMissingPosition, PlayerPosition,
} from '../services/matchService';
import { syncBadges } from '../services/badgeService';
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

const POSITION_LABEL: Record<PlayerPosition, string> = {
  goalkeeper: 'Vratar',
  defender: 'Branilec',
  midfielder: 'Vezist',
  forward: 'Napadalec',
  guard: 'Guard',
  center: 'Center',
};

const POSITION_SHORT: Record<PlayerPosition, string> = {
  goalkeeper: 'GK',
  defender: 'DEF',
  midfielder: 'MID',
  forward: 'FWD',
  guard: 'G',
  center: 'C',
};

export default function PremiumMatchPanel({ match, userId, userNames }: Props) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = React.useState(false);
  const [inviteTeam, setInviteTeam] = React.useState<'A' | 'B' | null>(null);
  const [invitablePlayers, setInvitablePlayers] = React.useState<UserDoc[]>([]);
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [invitingId, setInvitingId] = React.useState<string | null>(null);
  const [profiles, setProfiles] = React.useState<Map<string, { elo: number; reputation: number; position?: PlayerPosition }>>(new Map());
  const [targetPosition, setTargetPosition] = React.useState<PlayerPosition | undefined>(undefined);

  React.useEffect(() => {
    const uids = [...(match.teamA ?? []), ...(match.teamB ?? []), ...(match.players ?? [])];
    const unique = [...new Set(uids)];
    if (unique.length === 0) return;
    resolveUserProfiles(unique).then(setProfiles);
  }, [match.teamA?.join(','), match.teamB?.join(','), match.players?.join(',')]);

  const isCreator = match.createdBy === userId;
  const isJoined = !!match.players?.includes(userId);
  const hasCheckedIn = !!match.attended?.includes(userId);
  const teamA = match.teamA ?? [];
  const teamB = match.teamB ?? [];
  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;
  const finalized = !!match.finalized;

  const phase = match.scorePhase ?? 'none';
  const captains = [match.captainA, match.captainB].filter(Boolean) as string[];
  const isCaptain = captains.includes(userId);
  const submissions = match.scoreSubmissions ?? {};
  const mySubmission = submissions[userId];
  const canSubmitScore =
    !finalized &&
    ((phase === 'awaiting_captains' && isCaptain) || (phase === 'awaiting_all' && isJoined));

  const [draftA, setDraftA] = React.useState(0);
  const [draftB, setDraftB] = React.useState(0);

  React.useEffect(() => {
    if (!mySubmission) return;
    setDraftA(mySubmission.scoreA);
    setDraftB(mySubmission.scoreB);
  }, [mySubmission?.scoreA, mySubmission?.scoreB]);

  const badgesSynced = React.useRef(false);
  React.useEffect(() => {
    if (!finalized || badgesSynced.current || !isJoined) return;
    badgesSynced.current = true;
    syncBadges(userId).catch(() => {});
  }, [finalized, isJoined, userId]);

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch (e: any) { Alert.alert('Napaka', e?.message ?? 'Operacija ni uspela.'); }
    finally { setBusy(false); }
  }

  function handleSubmitScore() {
    Alert.alert(
      phase === 'awaiting_captains' ? 'Končaj tekmo' : 'Oddaj rezultat',
      `Oddajaš rezultat ${draftA} - ${draftB}. Rezultata po oddaji ni več mogoče spremeniti. Nadaljuješ?`,
      [
        { text: 'Prekliči', style: 'cancel' },
        {
          text: 'Oddaj',
          onPress: () => withBusy(async () => {
            const res = await submitMatchScore(match.id, draftA, draftB);
            if (res.status === 'resolved') {
              const winner =
                res.result === 'team_a_won' ? 'Ekipa A' :
                res.result === 'team_b_won' ? 'Ekipa B' : 'Neodločeno';
              Alert.alert('Tekma zaključena', `Zmagovalec: ${winner}\n\nELO in reputacija sta razdeljena vsem prisotnim igralcem.`);
            } else if (res.status === 'disputed') {
              Alert.alert(
                'Rezultata se ne ujemata',
                'Kapetana sta vnesla različen rezultat. Rezultat zdaj vnesejo vsi igralci — velja večina.',
              );
            } else if (res.status === 'waiting_other_captain') {
              Alert.alert('Rezultat oddan', 'Čakamo še na drugega kapetana.');
            } else {
              Alert.alert('Rezultat oddan', 'Čakamo še na ostale igralce.');
            }
          }),
        },
      ]
    );
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
    if (inviteTeam === team) { setInviteTeam(null); setTargetPosition(undefined); return; }
    setInviteTeam(team);
    setInviteLoading(true);
    try {
      const teamPlayers = (team === 'A' ? match.teamA : match.teamB) ?? [];
      const teamTargetSize = Math.floor(match.totalSpots / 2);
      const teamProfiles = teamPlayers.map(uid => ({ uid, position: profiles.get(uid)?.position }));
      const missing = suggestMissingPosition(match.sport, teamProfiles, teamTargetSize);
      setTargetPosition(missing);

      const pendingIds = Object.keys(match.pendingInvites ?? {});
      const excluded = [...(match.players ?? []), ...(match.waitlist ?? []), ...pendingIds];
      const players = await fetchInvitablePlayers(200, 20, excluded, {
        desiredPosition: missing,
        sport: match.sport,
      });
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
          <Text style={styles.resultSub}>
            {match.scoreDisputed
              ? 'Kapetana se nista strinjala — veljal je rezultat večine igralcev.'
              : 'Rezultat sta potrdila oba kapetana.'}
          </Text>
          <Text style={styles.resultSub}>ELO razdeljen glede na zmago/poraz. Reputacija za prisotnost.</Text>
        </View>
        {renderTeams()}
      </View>
    );
  }

  function renderTeams() {
    function renderPlayer(uid: string, _idx: number) {
      const attended = match.attended?.includes(uid);
      const isPlayerCaptain = captains.includes(uid);
      const prof = profiles.get(uid);
      return (
        <View key={uid} style={styles.teamPlayer}>
          <View style={styles.teamPlayerAvatar}>
            <Ionicons name="person" size={14} color={colors.primaryLight} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.teamPlayerName} numberOfLines={1}>{resolveName(uid, userId, userNames)}</Text>
              {isPlayerCaptain && (
                <View style={styles.captainBadge}>
                  <Text style={styles.captainBadgeText}>K</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {prof && (
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>
                  ELO {prof.elo}
                </Text>
              )}
              {prof?.position && (
                <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.primary + '20' }}>
                  <Text style={{ color: colors.primaryLight, fontSize: 9, fontWeight: '800' }}>
                    {POSITION_SHORT[prof.position]}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {attended ? <Text style={styles.teamPlayerAttended}>✓</Text> : null}
          {isCreator && !finalized && !match.matchStarted && (
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
      const pendingForTeam = Object.entries(match.pendingInvites ?? {})
        .filter(([, inv]) => inv.team === team);
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
          {pendingForTeam.map(([uid]) => (
            <View key={`pending-${uid}`} style={[styles.teamPlayer, { opacity: 0.6 }]}>
              <View style={[styles.teamPlayerAvatar, { backgroundColor: '#f59e0b18' }]}>
                <Ionicons name="hourglass-outline" size={14} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.teamPlayerName, { color: '#f59e0b' }]} numberOfLines={1}>
                  {resolveName(uid, userId, userNames)}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>Na čakanju…</Text>
              </View>
            </View>
          ))}
          {players.length === 0 && pendingForTeam.length === 0 && <Text style={styles.pendingSubText}>Ni igralcev</Text>}
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
            {targetPosition && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                padding: 10, borderRadius: 10, marginBottom: 10,
                backgroundColor: colors.primary + '15',
                borderWidth: 1, borderColor: colors.primary + '40',
              }}>
                <Ionicons name="search" size={14} color={colors.primaryLight} />
                <Text style={{ color: colors.primaryLight, fontSize: 12, fontWeight: '700', flex: 1 }}>
                  Iščem: {POSITION_LABEL[targetPosition]} (manjka v ekipi)
                </Text>
              </View>
            )}
            {inviteLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : invitablePlayers.length === 0 ? (
              <Text style={styles.inviteEmpty}>Ni ustreznih igralcev (ELO &gt; 200, reputacija &gt; 20)</Text>
            ) : (
              invitablePlayers.slice(0, 8).map(u => {
                const name = u.displayName || (u.email ? u.email.split('@')[0] : u.uid.slice(0, 8));
                const isInviting = invitingId === u.uid;
                const matchesPos = targetPosition && u.position === targetPosition;
                return (
                  <View key={u.uid} style={[
                    styles.invitePlayerRow,
                    matchesPos && { borderWidth: 1, borderColor: colors.primary + '60', backgroundColor: colors.primary + '08' },
                  ]}>
                    <View style={styles.invitePlayerAvatar}>
                      <Ionicons name="person" size={14} color={colors.primaryLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.invitePlayerName} numberOfLines={1}>{name}</Text>
                        {matchesPos && (
                          <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.primary }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>USTREZNA POZ</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.invitePlayerStats}>
                        ELO {u.elo} · Rep {u.reputation}{u.position ? ` · ${POSITION_LABEL[u.position]}` : ' · Brez pozicije'}
                      </Text>
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

  function renderStepperSide(label: string, value: number, setValue: (v: number) => void) {
    const step = (delta: number) => setValue(Math.max(0, Math.min(99, value + delta)));
    return (
      <View style={styles.stepperCol}>
        <Text style={styles.stepperTeamLabel}>{label}</Text>
        <View style={styles.stepperControls}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => step(-1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{value}</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => step(1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderScorePanel() {
    if (!match.matchStarted) return null;

    if (phase === 'none') {
      return (
        <View style={styles.statusCard}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textMuted} />
          <Text style={styles.statusText}>Določanje kapetanov …</Text>
        </View>
      );
    }

    const eligibleIds = phase === 'awaiting_captains'
      ? captains
      : [...new Set([...(match.players ?? []), ...captains])].filter(id => id.length > 10);
    const submittedCount = eligibleIds.filter(id => submissions[id]).length;
    const captainNames = captains.map(c => resolveName(c, userId, userNames)).join(' in ');
    const disputed = phase === 'awaiting_all';
    const canEdit = canSubmitScore && (!mySubmission || disputed);

    return (
      <View style={[styles.scorePanel, disputed && styles.scorePanelDisputed]}>
        <View style={styles.scorePanelHeader}>
          <Ionicons
            name={disputed ? 'alert-circle' : 'flag'}
            size={15}
            color={disputed ? colors.warning : colors.primaryLight}
          />
          <Text style={[styles.scorePanelTitle, disputed && { color: colors.warning }]}>
            {disputed ? 'Rezultat določajo vsi igralci' : 'Kapetana vneseta rezultat'}
          </Text>
        </View>

        <Text style={styles.scorePanelSub}>
          {disputed
            ? `Kapetana (${captainNames}) sta vnesla različen rezultat. Velja rezultat večine igralcev.`
            : `Končni rezultat vneseta kapetana (${captainNames}). Če se ujemata, se tekma takoj zaključi in ELO se razdeli.`}
        </Text>

        {mySubmission && (
          <View style={styles.submittedRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.submittedText}>
              Tvoj rezultat: {mySubmission.scoreA} - {mySubmission.scoreB}
            </Text>
          </View>
        )}

        {canEdit ? (
          <>
            <View style={styles.stepperRow}>
              {renderStepperSide('Ekipa A', draftA, setDraftA)}
              <Text style={styles.scoreSeparator}>:</Text>
              {renderStepperSide('Ekipa B', draftB, setDraftB)}
            </View>
            <TouchableOpacity
              style={styles.submitScoreBtn}
              onPress={handleSubmitScore}
              disabled={busy}
              activeOpacity={0.9}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name={mySubmission ? 'create' : 'flag'} size={18} color="#fff" />
                  <Text style={styles.submitScoreBtnText}>
                    {mySubmission
                      ? 'Popravi rezultat'
                      : phase === 'awaiting_captains'
                        ? 'Končaj tekmo in oddaj rezultat'
                        : 'Oddaj rezultat'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : !mySubmission ? (
          <Text style={styles.scorePanelWaiting}>
            {disputed ? 'Čakamo na rezultate igralcev.' : 'Rezultat lahko vneseta samo kapetana.'}
          </Text>
        ) : null}

        <Text style={styles.scorePanelProgress}>
          Oddanih rezultatov: {submittedCount} / {eligibleIds.length}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 18 }}>
      {renderScorePanel()}

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

      {renderTeams()}
    </View>
  );
}
