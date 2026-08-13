function hhmmToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

function rangesOverlap(startA, endA, startB, endB) {
  const aS = hhmmToMinutes(startA);
  const aE = hhmmToMinutes(endA);
  const bS = hhmmToMinutes(startB);
  const bE = hhmmToMinutes(endB);
  if ([aS, aE, bS, bE].some(Number.isNaN)) return false;
  return aS < bE && bS < aE;
}

function isValidDateKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function weekdayFromDateKey(key) {
  if (!isValidDateKey(key)) return NaN;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

function millisFromDateKey(key) {
  if (!isValidDateKey(key)) return NaN;
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

function buildReservationId(venueId, dateKey, startHHMM) {
  return `${venueId}_${dateKey}_${startHHMM.replace(':', '')}`;
}

function validateReservationRequest(data, authUid) {
  if (!authUid) {
    return { ok: false, code: 'unauthenticated', message: 'Prijava je obvezna.' };
  }
  const body = data || {};

  if (typeof body.venueId !== 'string' || !body.venueId || body.venueId.length > 128) {
    return { ok: false, code: 'invalid-argument', message: 'Neveljavno igrisce.' };
  }
  if (!isValidDateKey(body.dateKey)) {
    return { ok: false, code: 'invalid-argument', message: 'Neveljaven datum.' };
  }
  const start = hhmmToMinutes(body.startHHMM);
  const end = hhmmToMinutes(body.endHHMM);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { ok: false, code: 'invalid-argument', message: 'Neveljaven termin.' };
  }
  if (start >= end) {
    return { ok: false, code: 'invalid-argument', message: 'Konec termina mora biti za zacetkom.' };
  }
  if (body.matchId !== undefined && body.matchId !== null && typeof body.matchId !== 'string') {
    return { ok: false, code: 'invalid-argument', message: 'Neveljaven ID tekme.' };
  }

  return {
    ok: true,
    value: {
      bookedBy: authUid,
      venueId: body.venueId,
      dateKey: body.dateKey,
      startHHMM: body.startHHMM,
      endHHMM: body.endHHMM,
      matchId: typeof body.matchId === 'string' ? body.matchId : null,
      weekday: weekdayFromDateKey(body.dateKey),
      dateMillis: millisFromDateKey(body.dateKey),
      reservationId: buildReservationId(body.venueId, body.dateKey, body.startHHMM),
    },
  };
}

function findScheduleSlot(slots, weekday, startHHMM, endHHMM) {
  return (slots || []).find(s =>
    s.active !== false
    && s.weekday === weekday
    && s.startHHMM === startHHMM
    && s.endHHMM === endHHMM
  ) || null;
}

function findConflict(booked, startHHMM, endHHMM, ignoreId) {
  return (booked || []).find(b =>
    b.id !== ignoreId && rangesOverlap(startHHMM, endHHMM, b.startHHMM, b.endHHMM)
  ) || null;
}

module.exports = {
  hhmmToMinutes,
  rangesOverlap,
  isValidDateKey,
  weekdayFromDateKey,
  millisFromDateKey,
  buildReservationId,
  validateReservationRequest,
  findScheduleSlot,
  findConflict,
};
