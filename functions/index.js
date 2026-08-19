const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const { validatePaymentRequest } = require('./paymentValidation');
const { statsFromUser, mergeUnlockedBadges } = require('./badges');
const {
  validateReservationRequest, findScheduleSlot, findConflict,
} = require('./reservations');

admin.initializeApp();

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const stripe = new Stripe(process.env.STRIPE_SECRET);

const SUCCESS_BASE = 'https://gameon-app.invalid/payment-success';
const CANCEL_URL   = 'https://gameon-app.invalid/payment-cancel';

function requireValidPayment(data, context) {
  const authUid = context && context.auth ? context.auth.uid : null;
  const res = validatePaymentRequest(data, authUid);
  if (!res.ok) throw new functions.https.HttpsError(res.code, res.message);
  return res.value;
}

exports.createCheckoutSession = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const p = requireValidPayment(data, context);

    const successUrl = `${SUCCESS_BASE}`
      + `?type=${p.entityType}`
      + `&id=${encodeURIComponent(p.entityId)}`
      + `&userId=${encodeURIComponent(p.userId)}`
      + '&session_id={CHECKOUT_SESSION_ID}';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: p.description || 'Najem igrišča — GameOn' },
          unit_amount: p.amountInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: CANCEL_URL,
      metadata: {
        entityType: p.entityType,
        entityId: p.entityId,
        userId: p.userId,
      },
    });

    return { url: session.url, sessionId: session.id };
  });

exports.createPaymentIntent = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const p = requireValidPayment(data, context);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: p.amountInCents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      description: p.description || 'GameOn — najem igrišča',
      metadata: {
        entityType: p.entityType,
        entityId: p.entityId,
        userId: p.userId,
      },
    });

    return { clientSecret: paymentIntent.client_secret };
  });

exports.confirmPayment = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const uid = context && context.auth ? context.auth.uid : null;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Prijava je obvezna.');

    const sessionId = data && data.sessionId;
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Manjka ID seje.');
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
      throw new functions.https.HttpsError('not-found', 'Seja ne obstaja.');
    }

    if (session.payment_status !== 'paid') {
      throw new functions.https.HttpsError('failed-precondition', 'Plačilo ni zaključeno.');
    }

    const md = session.metadata || {};
    if (md.userId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Seja pripada drugemu uporabniku.');
    }

    if (md.entityType === 'match') {
      await db.collection('matches').doc(md.entityId).update({
        [`costSplit.${uid}`]: 'paid',
      });
    } else if (md.entityType === 'reservation') {
      await db.collection('reservations').doc(md.entityId).update({ paid: true });
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'Neveljaven tip placila.');
    }

    return { ok: true, entityType: md.entityType, entityId: md.entityId };
  });

exports.createReservation = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const authUid = context && context.auth ? context.auth.uid : null;
    const check = validateReservationRequest(data, authUid, Date.now());
    if (!check.ok) throw new functions.https.HttpsError(check.code, check.message);
    const r = check.value;

    const venueRef = db.collection('venues').doc(r.venueId);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Igrisce ne obstaja.');
    }
    const venue = venueSnap.data();
    if (venue.active === false) {
      throw new functions.https.HttpsError('failed-precondition', 'Igrisce ni na voljo.');
    }

    const scheduleSnap = await venueRef.collection('schedule').get();
    const slots = scheduleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const slot = findScheduleSlot(slots, r.weekday, r.startHHMM, r.endHHMM);
    if (!slot) {
      throw new functions.https.HttpsError('failed-precondition', 'Ta termin ni v urniku igrisca.');
    }

    const price = typeof slot.pricePerSlot === 'number' ? slot.pricePerSlot : 0;
    const reservationRef = db.collection('reservations').doc(r.reservationId);
    const bookedCol = venueRef.collection('booked');
    const bookedRef = bookedCol.doc(r.reservationId);

    await db.runTransaction(async (tx) => {
      const dayQuery = bookedCol.where('dateKey', '==', r.dateKey);
      const daySnap = await tx.get(dayQuery);
      const booked = daySnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const conflict = findConflict(booked, r.startHHMM, r.endHHMM, r.reservationId);
      if (conflict) {
        throw new functions.https.HttpsError(
          'already-exists',
          `Termin se prekriva z rezervacijo ${conflict.startHHMM}-${conflict.endHHMM}.`,
        );
      }

      const existingSnap = await tx.get(reservationRef);
      if (existingSnap.exists && existingSnap.data().status !== 'cancelled') {
        throw new functions.https.HttpsError('already-exists', 'Ta termin je ze rezerviran.');
      }

      const now = Timestamp.now();
      const date = Timestamp.fromMillis(r.dateMillis);

      tx.set(reservationRef, {
        venueId: r.venueId,
        ownerId: venue.ownerId,
        bookedBy: r.bookedBy,
        matchId: r.matchId,
        date,
        dateKey: r.dateKey,
        startHHMM: r.startHHMM,
        endHHMM: r.endHHMM,
        price,
        status: 'confirmed',
        paid: false,
        createdAt: now,
      });

      tx.set(bookedRef, {
        dateKey: r.dateKey,
        date,
        startHHMM: r.startHHMM,
        endHHMM: r.endHHMM,
      });
    });

    return { reservationId: r.reservationId, price };
  });

exports.cancelReservation = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const uid = context && context.auth ? context.auth.uid : null;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Prijava je obvezna.');

    const reservationId = data && data.reservationId;
    if (typeof reservationId !== 'string' || !reservationId) {
      throw new functions.https.HttpsError('invalid-argument', 'Manjka ID rezervacije.');
    }

    const reservationRef = db.collection('reservations').doc(reservationId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(reservationRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Rezervacija ne obstaja.');
      }
      const res = snap.data();
      if (res.bookedBy !== uid && res.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Rezervacija ni tvoja.');
      }
      if (res.status === 'cancelled') return;

      tx.update(reservationRef, { status: 'cancelled', cancelledAt: Timestamp.now() });
      tx.delete(db.collection('venues').doc(res.venueId).collection('booked').doc(reservationId));
    });

    return { ok: true };
  });

exports.markReservationPaid = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const uid = context && context.auth ? context.auth.uid : null;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Prijava je obvezna.');

    const reservationId = data && data.reservationId;
    if (typeof reservationId !== 'string' || !reservationId) {
      throw new functions.https.HttpsError('invalid-argument', 'Manjka ID rezervacije.');
    }

    const ref = db.collection('reservations').doc(reservationId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Rezervacija ne obstaja.');
      }
      const res = snap.data();
      if (res.bookedBy !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Rezervacija ni tvoja.');
      }
      if (res.status === 'cancelled') {
        throw new functions.https.HttpsError('failed-precondition', 'Rezervacija je preklicana.');
      }
      if (res.paid === true) return;
      tx.update(ref, { paid: true, paidAt: Timestamp.now() });
    });

    return { ok: true };
  });

const STARTING_ELO = 700;
const STARTING_REPUTATION = 50;
const ELO_K = 32;
const REP_ATTENDED = 2;
const REP_NO_SHOW = -5;

function isRealUid(uid) {
  return typeof uid === 'string' && uid.length > 10;
}

function eloDelta(playerElo, oppTeamAvg, actual) {
  const expected = 1 / (1 + Math.pow(10, (oppTeamAvg - playerElo) / 400));
  return Math.round(ELO_K * (actual - expected));
}

exports.assignCaptains = functions
  .region('europe-west1')
  .firestore.document('matches/{matchId}')
  .onUpdate(async (change) => {
    const after = change.after.data();

    if (!after.isPremium) return null;
    if (after.finalized) return null;
    if (after.matchStarted !== true) return null;
    if (after.captainA || after.captainB) return null;

    const patch = await buildCaptainPatch(after);
    if (!patch) return null;
    return change.after.ref.update(patch);
  });

async function buildCaptainPatch(match) {
  const teamA = (match.teamA || []).filter(isRealUid);
  const teamB = (match.teamB || []).filter(isRealUid);
  const uids = [...new Set([...teamA, ...teamB])];
  if (uids.length === 0) return null;

  const elos = new Map();
  await Promise.all(uids.map(async (uid) => {
    try {
      const snap = await db.collection('users').doc(uid).get();
      const elo = snap.exists ? snap.data().elo : undefined;
      elos.set(uid, elo === undefined || elo === null ? STARTING_ELO : elo);
    } catch (e) {
      elos.set(uid, STARTING_ELO);
    }
  }));

  const pickCaptain = (team) => team.reduce(
    (best, uid) => (best === null || elos.get(uid) > elos.get(best) ? uid : best),
    null,
  );

  const captainA = pickCaptain(teamA);
  const captainB = pickCaptain(teamB);
  if (!captainA && !captainB) return null;

  const patch = {
    scorePhase: 'awaiting_captains',
    scoreSubmissions: {},
    scoreDisputed: false,
  };
  if (captainA) patch.captainA = captainA;
  if (captainB) patch.captainB = captainB;
  return patch;
}

function tallyVotes(submissions, eligible) {
  const tally = new Map();
  for (const [pid, s] of Object.entries(submissions)) {
    if (!eligible.has(pid)) continue;
    const key = `${s.scoreA}-${s.scoreB}`;
    const cur = tally.get(key) || { scoreA: s.scoreA, scoreB: s.scoreB, count: 0, earliest: Infinity };
    cur.count += 1;
    const ts = s.submittedAt && s.submittedAt.toMillis ? s.submittedAt.toMillis() : 0;
    if (ts < cur.earliest) cur.earliest = ts;
    tally.set(key, cur);
  }

  const ranked = [...tally.values()].sort((a, b) => b.count - a.count || a.earliest - b.earliest);
  const top = ranked[0];
  const submittedCount = Object.keys(submissions).filter((p) => eligible.has(p)).length;

  return {
    top,
    hasMajority: !!top && top.count > eligible.size / 2,
    allSubmitted: submittedCount >= eligible.size,
  };
}

function statsFromSnapshot(uid, snap) {
  const d = snap && snap.exists ? snap.data() : null;
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  return {
    uid,
    elo: d && d.elo !== undefined && d.elo !== null ? d.elo : STARTING_ELO,
    reputation: d && d.reputation !== undefined && d.reputation !== null ? d.reputation : STARTING_REPUTATION,
    wins: n(d && d.wins),
    losses: n(d && d.losses),
    draws: n(d && d.draws),
    matchesPlayed: n(d && d.matchesPlayed),
    goals: n(d && d.goals),
    unlockedBadges: d && Array.isArray(d.unlockedBadges) ? d.unlockedBadges : [],
  };
}

function playerOutcome(s, ctx) {
  const { onA, oppAvg, actualA, result, hasAttended } = ctx;
  const actual = onA ? actualA : 1 - actualA;

  const dElo = hasAttended ? eloDelta(s.elo, oppAvg, actual) : 0;
  const dRep = hasAttended ? REP_ATTENDED : REP_NO_SHOW;

  return {
    uid: s.uid,
    team: onA ? 'A' : 'B',
    eloBefore: s.elo,
    dElo,
    dRep,
    repReason: hasAttended ? 'attended' : 'no_show',
    isWin: hasAttended && (onA ? result === 'team_a_won' : result === 'team_b_won'),
    isLoss: hasAttended && (onA ? result === 'team_b_won' : result === 'team_a_won'),
    isDraw: hasAttended && result === 'draw',
    newElo: Math.max(0, s.elo + dElo),
    newRep: Math.max(0, Math.min(100, s.reputation + dRep)),
    before: s,
  };
}

async function resolveMatch(tx, matchRef, match, scoreA, scoreB, submissions) {
  const matchId = matchRef.id;
  const teamA = match.teamA || [];
  const teamB = match.teamB || [];
  const attended = match.attended || [];

  const result = scoreA > scoreB ? 'team_a_won' : scoreB > scoreA ? 'team_b_won' : 'draw';

  const allPlayers = [...new Set([...teamA, ...teamB])];
  const snaps = allPlayers.length
    ? await tx.getAll(...allPlayers.map((uid) => db.collection('users').doc(uid)))
    : [];

  const stats = allPlayers.map((uid, i) => statsFromSnapshot(uid, snaps[i]));

  const eloMap = new Map(stats.map((s) => [s.uid, s.elo]));
  const avg = (team) => (team.length === 0
    ? STARTING_ELO
    : team.reduce((sum, uid) => sum + (eloMap.has(uid) ? eloMap.get(uid) : STARTING_ELO), 0) / team.length);

  const avgA = avg(teamA);
  const avgB = avg(teamB);
  const actualA = result === 'team_a_won' ? 1 : result === 'draw' ? 0.5 : 0;

  const perPlayer = stats.map((s) => playerOutcome(s, {
    onA: teamA.includes(s.uid),
    oppAvg: teamA.includes(s.uid) ? avgB : avgA,
    actualA,
    result,
    hasAttended: attended.includes(s.uid),
  }));

  const now = Timestamp.now();

  for (const p of perPlayer) {
    if (!isRealUid(p.uid)) continue;

    const userRef = db.collection('users').doc(p.uid);
    const patch = {
      uid: p.uid,
      elo: p.newElo,
      reputation: p.newRep,
      updatedAt: now,
      matchesPlayed: FieldValue.increment(1),
    };
    if (p.isWin) patch.wins = FieldValue.increment(1);
    else if (p.isLoss) patch.losses = FieldValue.increment(1);
    else if (p.isDraw) patch.draws = FieldValue.increment(1);

    const nextStats = {
      matchesPlayed: p.before.matchesPlayed + 1,
      wins: p.before.wins + (p.isWin ? 1 : 0),
      goals: p.before.goals,
      elo: p.newElo,
      reputation: p.newRep,
    };
    const merged = mergeUnlockedBadges(p.before.unlockedBadges, nextStats);
    if (merged.changed) patch.unlockedBadges = merged.badges;

    tx.set(userRef, patch, { merge: true });

    tx.set(userRef.collection('reputationLog').doc(), {
      delta: p.dRep,
      reason: p.repReason,
      matchId,
      balanceAfter: p.newRep,
      createdAt: now,
    });

    tx.set(userRef.collection('matchHistory').doc(), {
      matchId,
      sport: match.sport,
      locationName: (match.location && match.location.name) || '',
      datetime: match.datetime,
      team: p.team,
      scoreA,
      scoreB,
      outcome: p.repReason === 'no_show' ? 'no_show' : p.isWin ? 'win' : p.isLoss ? 'loss' : 'draw',
      goals: 0,
      eloBefore: p.eloBefore,
      eloDelta: p.dElo,
      eloAfter: p.newElo,
      createdAt: now,
    });
  }

  tx.update(matchRef, {
    scoreA,
    scoreB,
    result,
    finalized: true,
    status: 'closed',
    scorePhase: 'resolved',
    scoreSubmissions: submissions,
  });

  return result;
}

const MIN_TEAM_RATIO = 0.6;

function minPlayersPerTeam(totalSpots) {
  const perTeam = Math.floor((totalSpots || 0) / 2);
  return Math.max(1, Math.ceil(perTeam * MIN_TEAM_RATIO));
}

function canPlayMatch(m) {
  const min = minPlayersPerTeam(m.totalSpots);
  const players = Array.isArray(m.players) ? m.players : [];
  if (players.length < min * 2) return false;
  if (!m.isPremium) return true;
  const teamA = Array.isArray(m.teamA) ? m.teamA : [];
  const teamB = Array.isArray(m.teamB) ? m.teamB : [];
  return teamA.length >= min && teamB.length >= min;
}

const AUTO_START_DELAY_MS = 5 * 60 * 1000;

const AUTO_START_LOOKBACK_MS = 24 * 60 * 60 * 1000;

exports.autoStartMatches = functions
  .region('europe-west1')
  .pubsub.schedule('every 1 minutes')
  .timeZone('Europe/Ljubljana')
  .onRun(async () => {
    const now = Date.now();
    const cutoff = Timestamp.fromMillis(now - AUTO_START_DELAY_MS);
    const lookback = Timestamp.fromMillis(now - AUTO_START_LOOKBACK_MS);

    const snap = await db.collection('matches')
      .where('datetime', '>=', lookback)
      .where('datetime', '<=', cutoff)
      .get();

    const candidates = snap.docs.filter((d) => {
      const m = d.data();
      if (m.matchStarted === true) return false;
      if (m.finalized === true) return false;
      if (m.status === 'closed') return false;
      if (m.cancelReason) return false;
      return true;
    });

    if (candidates.length === 0) {
      console.log('autoStartMatches: ni tekem za zagon');
      return;
    }

    const startable = candidates.filter((d) => canPlayMatch(d.data()));
    const tooFew = candidates.filter((d) => !canPlayMatch(d.data()));

    await Promise.all([
      ...startable.map((d) => d.ref.update({
        matchStarted: true,
        startRequested: false,
        autoStarted: true,
        autoStartedAt: Timestamp.now(),
        matchStartedAt: d.data().matchStartedAt || Timestamp.now(),
      })),
      ...tooFew.map((d) => d.ref.update({
        status: 'closed',
        cancelReason: 'low_attendance',
        startRequested: false,
        cancelledAt: Timestamp.now(),
      })),
    ]);

    console.log(`autoStartMatches: zagnanih ${startable.length}, odpovedanih ${tooFew.length}`);
  });

exports.syncBadges = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const uid = context && context.auth ? context.auth.uid : null;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Prijava je obvezna.');

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return { unlocked: [], newlyUnlocked: [] };

    const d = snap.data();
    const before = Array.isArray(d.unlockedBadges) ? d.unlockedBadges : [];
    const merged = mergeUnlockedBadges(before, statsFromUser(d));

    if (merged.changed) {
      await userRef.set(
        { unlockedBadges: merged.badges, updatedAt: Timestamp.now() },
        { merge: true },
      );
    }

    return {
      unlocked: merged.badges,
      newlyUnlocked: merged.badges.filter(b => !before.includes(b)),
    };
  });

exports.submitMatchScore = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const uid = context.auth && context.auth.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Prijava je obvezna.');

    const matchId = data && data.matchId;
    const scoreA = Number(data && data.scoreA);
    const scoreB = Number(data && data.scoreB);

    if (!matchId) throw new functions.https.HttpsError('invalid-argument', 'Manjka ID tekme.');
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)
      || scoreA < 0 || scoreB < 0 || scoreA > 99 || scoreB > 99) {
      throw new functions.https.HttpsError('invalid-argument', 'Neveljaven rezultat.');
    }

    const matchRef = db.collection('matches').doc(matchId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Tekma ne obstaja.');

      const match = snap.data();
      if (!match.isPremium) throw new functions.https.HttpsError('failed-precondition', 'Samo Premium tekme imajo rezultat.');
      if (match.finalized) throw new functions.https.HttpsError('already-exists', 'Tekma je že zaključena.');
      if (!match.matchStarted) throw new functions.https.HttpsError('failed-precondition', 'Tekma se še ni začela.');
      if (!canPlayMatch(match)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Tekma nima dovolj igralcev v obeh ekipah — rezultata ni mogoče oddati.',
        );
      }

      const phase = match.scorePhase || 'none';
      const players = match.players || [];
      const captains = [match.captainA, match.captainB].filter(Boolean);

      if (phase === 'awaiting_captains') {
        if (!captains.includes(uid)) {
          throw new functions.https.HttpsError('permission-denied', 'Rezultat lahko vneseta samo kapetana.');
        }
      } else if (phase === 'awaiting_all') {
        if (!players.includes(uid) && !captains.includes(uid)) {
          throw new functions.https.HttpsError('permission-denied', 'Samo prijavljeni igralci lahko vnesejo rezultat.');
        }
      } else {
        throw new functions.https.HttpsError('failed-precondition', 'Vnos rezultata trenutno ni mogoč.');
      }

      const submissions = Object.assign({}, match.scoreSubmissions || {});
      submissions[uid] = { scoreA, scoreB, submittedAt: Timestamp.now() };

      if (phase === 'awaiting_captains') {
        const submitted = captains.filter((c) => submissions[c]);
        if (submitted.length < captains.length) {
          tx.update(matchRef, { scoreSubmissions: submissions });
          return { status: 'waiting_other_captain' };
        }

        const first = submissions[captains[0]];
        const agree = captains.every(
          (c) => submissions[c].scoreA === first.scoreA && submissions[c].scoreB === first.scoreB,
        );

        if (agree) {
          const result = await resolveMatch(tx, matchRef, match, first.scoreA, first.scoreB, submissions);
          return { status: 'resolved', result };
        }

        tx.update(matchRef, {
          scoreSubmissions: submissions,
          scorePhase: 'awaiting_all',
          scoreDisputed: true,
        });
        return { status: 'disputed' };
      }

      const eligible = new Set([...players, ...captains].filter(isRealUid));
      const { top, hasMajority, allSubmitted } = tallyVotes(submissions, eligible);

      if (top && (hasMajority || allSubmitted)) {
        const result = await resolveMatch(tx, matchRef, match, top.scoreA, top.scoreB, submissions);
        return { status: 'resolved', result };
      }

      tx.update(matchRef, { scoreSubmissions: submissions });
      return { status: 'waiting_more_players' };
    });
  });
