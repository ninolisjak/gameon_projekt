import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';


jest.mock('../../config/firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'user1',
      getIdToken: jest.fn(() => Promise.resolve('mock-token')),
    },
  },
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-doc-id' })),
  updateDoc: jest.fn(() => Promise.resolve()),
  setDoc: jest.fn(() => Promise.resolve()),
  runTransaction: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  arrayUnion: jest.fn((...args: any[]) => args),
  arrayRemove: jest.fn((...args: any[]) => args),
  increment: jest.fn((n: number) => n),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  },
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}));

jest.mock('../../services/reputationService', () => ({
  applyReputationChange: jest.fn(() => Promise.resolve()),
  REP_DELTA: { attended: 2, no_show: -5, late_cancel: -3, on_time_cancel: -1 },
}));

jest.mock('../../services/badgeService', () => ({
  syncBadges: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services/teamBalancer', () => ({
  balanceTeams: jest.fn((inputs: any[]) => ({
    teamA: inputs.slice(0, Math.floor(inputs.length / 2)).map((i: any) => i.uid),
    teamB: inputs.slice(Math.floor(inputs.length / 2)).map((i: any) => i.uid),
    score: 10,
    meta: { avgEloA: 700, avgEloB: 700, eloDiff: 0, positionBalance: 1 },
  })),
  userToBalanceInput: jest.fn((u: any) => ({
    uid: u.uid,
    elo: u.elo ?? 700,
    winRate: 0.5,
    matchesPlayed: 0,
  })),
}));

import { requiredConfirmations, STARTING_ELO, STARTING_REPUTATION } from '../matchService';
import { runTransaction, getDocs, addDoc } from 'firebase/firestore';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function eloDelta(playerElo: number, oppTeamAvg: number, actual: number): number {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (oppTeamAvg - playerElo) / 400));
  return Math.round(K * (actual - expected));
}

function makeBaseMatch(overrides: Record<string, any> = {}) {
  return {
    id: 'match1',
    sport: 'futsal',
    location: { lat: 46.55, lng: 15.64, name: 'Test' },
    datetime: new Date(Date.now() + 86_400_000),
    totalSpots: 10,
    filledSpots: 1,
    status: 'open',
    isPublic: true,
    players: ['user1'],
    waitlist: [],
    createdBy: 'user1',
    isPremium: false,
    ...overrides,
  };
}

function makePremiumMatch(overrides: Record<string, any> = {}) {
  return makeBaseMatch({
    isPremium: true,
    filledSpots: 10,
    status: 'full',
    players: ['user1', 'user2'],
    teamA: ['user1'],
    teamB: ['user2'],
    scoreA: 0,
    scoreB: 0,
    pendingEvents: [],
    events: [],
    attended: [],
    finalized: false,
    ...overrides,
  });
}

function mockTransaction(data: Record<string, any>) {
  (runTransaction as jest.Mock).mockImplementationOnce(async (_db: any, fn: any) =>
    fn({
      get: jest.fn().mockResolvedValue({ exists: () => true, data: () => data }),
      update: jest.fn(),
    })
  );
}

function mockTransactionNotFound() {
  (runTransaction as jest.Mock).mockImplementationOnce(async (_db: any, fn: any) =>
    fn({
      get: jest.fn().mockResolvedValue({ exists: () => false }),
      update: jest.fn(),
    })
  );
}

describe('requiredConfirmations', () => {
  it('minimum je 2 (1 mesto)', () => expect(requiredConfirmations(1)).toBe(2));
  it('minimum je 2 (2 mesti)', () => expect(requiredConfirmations(2)).toBe(2));
  it('4 mesta → 2 potrditve (ceil(4/3)=2)', () => expect(requiredConfirmations(4)).toBe(2));
  it('10 mest → 4 potrditve (ceil(10/3)=4)', () => expect(requiredConfirmations(10)).toBe(4));
  it('30 mest → 10 potrditev (ceil(30/3)=10)', () => expect(requiredConfirmations(30)).toBe(10));
});

describe('eloDelta', () => {
  it('enaka ELO, zmaga → +16', () => expect(eloDelta(700, 700, 1)).toBe(16));
  it('enaka ELO, poraz → -16', () => expect(eloDelta(700, 700, 0)).toBe(-16));
  it('enaka ELO, remi → 0', () => expect(eloDelta(700, 700, 0.5)).toBe(0));
  it('nižji ELO zmaga → več kot 16', () => expect(eloDelta(600, 800, 1)).toBeGreaterThan(16));
  it('višji ELO izgubi → manj kot -16', () => expect(eloDelta(800, 600, 0)).toBeLessThan(-16));
  it('zmaga vedno pozitivna delta', () => expect(eloDelta(700, 700, 1)).toBeGreaterThan(0));
});

describe('haversineKm', () => {
  it('ista točka → 0 km', () => expect(haversineKm(46.55, 15.64, 46.55, 15.64)).toBeCloseTo(0, 4));
  it('Maribor → Ljubljana ~100 km', () => {
    const d = haversineKm(46.5547, 15.6459, 46.0569, 14.5058);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(115);
  });
  it('sosednji točki < 2 km', () => expect(haversineKm(46.55, 15.64, 46.56, 15.65)).toBeLessThan(2));
  it('negativne koordinate delajo', () => expect(haversineKm(-33.87, 151.21, -33.87, 151.21)).toBeCloseTo(0, 4));
});

describe('joinMatch', () => {
  it('vrže napako: user že prijavljen', async () => {
    mockTransaction(makeBaseMatch({ players: ['user1', 'user2'] }));
    const { joinMatch } = require('../matchService');
    await expect(joinMatch('match1', 'user2')).rejects.toThrow('Že si prijavljen.');
  });

  it('vrže napako: user že na čakalni vrsti', async () => {
    mockTransaction(makeBaseMatch({ waitlist: ['user2'], filledSpots: 10, status: 'full' }));
    const { joinMatch } = require('../matchService');
    await expect(joinMatch('match1', 'user2')).rejects.toThrow('Že si na čakalni vrsti.');
  });

  it('vrže napako: premium tekma brez premijuma', async () => {
    mockTransaction(makeBaseMatch({ isPremium: true }));
    const { joinMatch } = require('../matchService');
    await expect(joinMatch('match1', 'user2', { userIsPremium: false })).rejects.toThrow('Premium');
  });

  it('vrže napako: tekma ne obstaja', async () => {
    mockTransactionNotFound();
    const { joinMatch } = require('../matchService');
    await expect(joinMatch('neobstojeca', 'user2')).rejects.toThrow('Tekma ne obstaja.');
  });

  it('polna tekma → waitlisted', async () => {
    mockTransaction(makeBaseMatch({ filledSpots: 10, totalSpots: 10, status: 'full' }));
    const { joinMatch } = require('../matchService');
    const result = await joinMatch('match1', 'user99');
    expect(result.status).toBe('waitlisted');
  });
});

describe('leaveMatch', () => {
  it('vrže napako: ustvarjalec ne more zapustiti', async () => {
    mockTransaction(makeBaseMatch({ players: ['creator'], createdBy: 'creator' }));
    const { leaveMatch } = require('../matchService');
    await expect(leaveMatch('match1', 'creator')).rejects.toThrow('Ustvarjalec ne more zapustiti tekme.');
  });

  it('vrže napako: user ni prijavljen', async () => {
    mockTransaction(makeBaseMatch({ players: ['user1'], createdBy: 'user1' }));
    const { leaveMatch } = require('../matchService');
    await expect(leaveMatch('match1', 'outsider')).rejects.toThrow('Nisi prijavljen.');
  });
});

describe('proposeGoal', () => {
  it('vrže napako: ne-premium tekma', async () => {
    mockTransaction({ ...makePremiumMatch(), isPremium: false });
    const { proposeGoal } = require('../matchService');
    await expect(proposeGoal('match1', 'user1', 'user1')).rejects.toThrow('Samo Premium tekme');
  });

  it('vrže napako: zaključena tekma', async () => {
    mockTransaction(makePremiumMatch({ finalized: true }));
    const { proposeGoal } = require('../matchService');
    await expect(proposeGoal('match1', 'user1', 'user1')).rejects.toThrow('zaključena');
  });

  it('vrže napako: strelec ni prijavljen', async () => {
    mockTransaction(makePremiumMatch());
    const { proposeGoal } = require('../matchService');
    await expect(proposeGoal('match1', 'outsider', 'user1')).rejects.toThrow('Strelec ni prijavljen');
  });

  it('vrže napako: predlagatelj ni prijavljen', async () => {
    mockTransaction(makePremiumMatch());
    const { proposeGoal } = require('../matchService');
    await expect(proposeGoal('match1', 'user1', 'outsider')).rejects.toThrow('Samo prijavljeni');
  });
});

describe('confirmGoal', () => {
  it('vrže napako: user že potrdil gol', async () => {
    mockTransaction(makePremiumMatch({
      pendingEvents: [{ id: 'evt1', team: 'A', scorerId: 'user1', proposedBy: 'user1', confirmedBy: ['user1'] }],
    }));
    const { confirmGoal } = require('../matchService');
    await expect(confirmGoal('match1', 'evt1', 'user1')).rejects.toThrow('Že si potrdil');
  });

  it('vrže napako: dogodek ne obstaja', async () => {
    mockTransaction(makePremiumMatch({ pendingEvents: [] }));
    const { confirmGoal } = require('../matchService');
    await expect(confirmGoal('match1', 'neobstoji', 'user2')).rejects.toThrow('Dogodek ne obstaja.');
  });
});

describe('invite koda', () => {
  it('createPrivateMatch vrne 6-znakovno kodo', async () => {
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'private-match-1' });
    const { createPrivateMatch } = require('../matchService');
    const result = await createPrivateMatch({
      sport: 'futsal', lat: 46.55, lng: 15.64, locationName: 'Test',
      datetime: new Date(Date.now() + 86400000), totalSpots: 10, createdBy: 'user1',
    });
    expect(result.inviteCode).toHaveLength(6);
    expect(result.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('joinMatchByInviteCode vrže napako: neveljavna koda', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ empty: true, docs: [] });
    const { joinMatchByInviteCode } = require('../matchService');
    await expect(joinMatchByInviteCode('XXXXXX', 'user2')).rejects.toThrow('Povabilo ni veljavno');
  });

  it('joinMatchByInviteCode vrže napako: user že prijavljen', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'match1',
        data: () => ({
          players: ['user2'], waitlist: [], filledSpots: 1, totalSpots: 10,
          status: 'open', isPublic: false, isPrivate: true, inviteCode: 'ABC123',
        }),
      }],
    });
    const { joinMatchByInviteCode } = require('../matchService');
    await expect(joinMatchByInviteCode('ABC123', 'user2')).rejects.toThrow('Že si prijavljen');
  });
});

describe('rsvpSlot', () => {
  it('vrže napako: termin ne obstaja', async () => {
    mockTransactionNotFound();
    const { rsvpSlot } = require('../matchService');
    await expect(rsvpSlot('slot1', 'user1', 'coming')).rejects.toThrow('Termin ne obstaja.');
  });

  it('vrže napako: termin ni aktiven', async () => {
    (runTransaction as jest.Mock).mockImplementationOnce(async (_db: any, fn: any) =>
      fn({
        get: jest.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ groupId: 'grp1', status: 'confirmed', rsvps: {} }),
        }),
        update: jest.fn(),
      })
    );
    const { rsvpSlot } = require('../matchService');
    await expect(rsvpSlot('slot1', 'user1', 'coming')).rejects.toThrow('Termin ni več aktiven.');
  });
});

describe('createRecurringGroup', () => {
  it('vrne inviteCode dolžine 6', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'group-1' });
    const { createRecurringGroup } = require('../matchService');
    const result = await createRecurringGroup({
      name: 'Sreda ekipa', sport: 'futsal', lat: 46.55, lng: 15.64,
      locationName: 'SC Tabor', totalSpots: 10, weekday: 3,
      timeHHMM: '18:00', minQuorum: 6, createdBy: 'user1',
    });
    expect(result.inviteCode).toHaveLength(6);
    expect(result.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
  });
});

describe('konstante', () => {
  it('STARTING_ELO je 700', () => expect(STARTING_ELO).toBe(700));
  it('STARTING_REPUTATION je 50', () => expect(STARTING_REPUTATION).toBe(50));
});