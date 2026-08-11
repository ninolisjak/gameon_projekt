jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  runTransaction: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
  increment: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  },
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => jest.fn()),
}));

import { weatherDescription } from '../weatherService';
import { playerStrength, userToBalanceInput, computeBalanceScore, balanceTeams, BalanceInput } from '../teamBalancer';
import { requiredConfirmations, STARTING_ELO, UserDoc } from '../matchService';

function makePlayer(o: Partial<BalanceInput> = {}): BalanceInput {
  return { uid: 'p1', elo: 700, winRate: 0.5, matchesPlayed: 10, ...o };
}
function makeUser(o: Partial<UserDoc> = {}): UserDoc {
  return { uid: 'u1', elo: STARTING_ELO, reputation: 50, isPremium: false, ...o } as UserDoc;
}

describe('weatherDescription — mejne vrednosti WMO kod', () => {
  it('koda 0 (točno na meji) → Jasno', () => expect(weatherDescription(0).label).toBe('Jasno'));
  it('koda 1 (tik nad 0) → Delno oblačno', () => expect(weatherDescription(1).label).toBe('Delno oblačno'));
  it('koda 2 (zgornja meja) → Delno oblačno', () => expect(weatherDescription(2).label).toBe('Delno oblačno'));
  it('koda 3 (tik nad 2) → Oblačno', () => expect(weatherDescription(3).label).toBe('Oblačno'));
  it('koda 4 (tik nad 3) → Megla', () => expect(weatherDescription(4).label).toBe('Megla'));
  it('koda 49 (zgornja meja megle) → Megla', () => expect(weatherDescription(49).label).toBe('Megla'));
  it('koda 50 (tik nad megle) → Rosenje', () => expect(weatherDescription(50).label).toBe('Rosenje'));
  it('koda 59 (zgornja meja) → Rosenje', () => expect(weatherDescription(59).label).toBe('Rosenje'));
  it('koda 60 (tik nad) → Dež', () => expect(weatherDescription(60).label).toBe('Dež'));
  it('koda 69 (zgornja meja) → Dež', () => expect(weatherDescription(69).label).toBe('Dež'));
  it('koda 70 (tik nad) → Sneg', () => expect(weatherDescription(70).label).toBe('Sneg'));
  it('koda 99 (zgornja meja obsega) → Nevihta', () => expect(weatherDescription(99).label).toBe('Nevihta'));
  it('koda 100 (tik nad obsegom) → Neznano', () => expect(weatherDescription(100).label).toBe('Neznano'));
  it('negativna koda -1 → dokumentira znano šibkost', () => expect(weatherDescription(-1).label).toBe('Delno oblačno'));
  it('ekstremna koda 999999 → Neznano', () => expect(weatherDescription(999999).label).toBe('Neznano'));
});

describe('playerStrength — zgornja meja izkušenj', () => {
  it('49 tekem (tik pod mejo) šteje manj kot 50', () => {
    expect(playerStrength(makePlayer({ matchesPlayed: 49 }))).toBeLessThan(playerStrength(makePlayer({ matchesPlayed: 50 })));
  });
  it('50 tekem (na meji) == 51 tekem (tik nad)', () => {
    expect(playerStrength(makePlayer({ matchesPlayed: 50 }))).toBe(playerStrength(makePlayer({ matchesPlayed: 51 })));
  });
  it('1000 tekem (ekstremno) ne prinese več kot 50', () => {
    expect(playerStrength(makePlayer({ matchesPlayed: 1000 }))).toBe(playerStrength(makePlayer({ matchesPlayed: 50 })));
  });
  it('vse ničle → moč 0', () => expect(playerStrength(makePlayer({ elo: 0, winRate: 0, matchesPlayed: 0 }))).toBe(0));
  it('winRate 0 vs 1 → razlika točno 250', () => {
    expect(playerStrength(makePlayer({ winRate: 1 })) - playerStrength(makePlayer({ winRate: 0 }))).toBeCloseTo(250, 5);
  });
  it('ELO 0 (najnižji) vrne veljavno število', () => expect(Number.isFinite(playerStrength(makePlayer({ elo: 0 })))).toBe(true));
  it('ELO 100000 (ekstremno) ne prelije', () => expect(Number.isFinite(playerStrength(makePlayer({ elo: 100000 })))).toBe(true));
});

//to zgotovi dda novi user ne dobi NaN, ker bi lahko povzročalo probleme 
describe('userToBalanceInput — deljenje z nič', () => {
  it('0 tekem → winRate 0.5, ne NaN', () => {
    const r = userToBalanceInput(makeUser({ wins: 0, losses: 0, draws: 0 }));
    expect(r.winRate).toBe(0.5);
    expect(Number.isNaN(r.winRate)).toBe(false);
  });
  it('1 zmaga od 1 → winRate 1', () => expect(userToBalanceInput(makeUser({ wins: 1, losses: 0, draws: 0, matchesPlayed: 1 })).winRate).toBe(1));
  it('1 poraz od 1 → winRate 0', () => expect(userToBalanceInput(makeUser({ wins: 0, losses: 1, draws: 0, matchesPlayed: 1 })).winRate).toBe(0));
  it('remi šteje pol zmage', () => expect(userToBalanceInput(makeUser({ wins: 0, losses: 0, draws: 2, matchesPlayed: 2 })).winRate).toBe(0.5));
  it('manjkajoč ELO → privzeti 700', () => expect(userToBalanceInput({ uid: 'u1' } as UserDoc).elo).toBe(STARTING_ELO));
});

describe('computeBalanceScore — omejitev rezultata', () => {
  it('popolna izenačenost → 100', () => expect(computeBalanceScore(0, 100, 700)).toBe(100));
  it('ekstremna razlika ne da negativne ocene', () => expect(computeBalanceScore(100000, 0, 700)).toBeGreaterThanOrEqual(0));
  it('večja razlika → nižja ocena', () => expect(computeBalanceScore(200, 100, 700)).toBeLessThan(computeBalanceScore(10, 100, 700)));
  it('ocena vedno med 0 in 100', () => {
    ([[0,0,700],[999999,0,1],[0,100,100000]] as [number,number,number][]).forEach(([d,p,a]) => {
      const s = computeBalanceScore(d, p, a);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    });
  });
});

describe('balanceTeams — mejno število igralcev', () => {
  it('0 igralcev → prazni ekipi, ocena 100', () => {
    const r = balanceTeams([]);
    expect(r.teamA).toEqual([]);
    expect(r.score).toBe(100);
  });
  it('1 igralec (tik pod mejo) → vsi v A', () => {
    const r = balanceTeams([makePlayer({ uid: 'solo' })]);
    expect(r.teamA).toEqual(['solo']);
    expect(r.teamB).toEqual([]);
  });
  it('2 igralca (na meji) → 1 na 1', () => {
    const r = balanceTeams([makePlayer({ uid: 'a' }), makePlayer({ uid: 'b' })]);
    expect(r.teamA).toHaveLength(1);
    expect(r.teamB).toHaveLength(1);
  });
  it('10 igralcev → 5 na 5', () => {
    const r = balanceTeams(Array.from({ length: 10 }, (_, i) => makePlayer({ uid: `p${i}`, elo: 600 + i * 20 })));
    expect(r.teamA).toHaveLength(5);
    expect(r.teamB).toHaveLength(5);
  });
  it('liho število → razlika največ 1', () => {
    const r = balanceTeams(Array.from({ length: 7 }, (_, i) => makePlayer({ uid: `p${i}` })));
    expect(Math.abs(r.teamA.length - r.teamB.length)).toBeLessThanOrEqual(1);
  });
  it('noben igralec ni v obeh ekipah', () => {
    const r = balanceTeams(Array.from({ length: 8 }, (_, i) => makePlayer({ uid: `p${i}` })));
    expect(r.teamA.filter(u => r.teamB.includes(u))).toEqual([]);
  });
  it('noben igralec se ne izgubi', () => {
    const r = balanceTeams(Array.from({ length: 10 }, (_, i) => makePlayer({ uid: `p${i}` })));
    expect(r.teamA.length + r.teamB.length).toBe(10);
  });
});

describe('requiredConfirmations — meje zaokroževanja', () => {
  it('0 mest → spodnja meja 2', () => expect(requiredConfirmations(0)).toBe(2));
  it('negativno → spodnja meja 2', () => expect(requiredConfirmations(-5)).toBe(2));
  it('6 mest (točno deljivo) → 2', () => expect(requiredConfirmations(6)).toBe(2));
  it('7 mest (tik nad 6) → 3', () => expect(requiredConfirmations(7)).toBe(3));
  it('9 mest (točno deljivo) → 3', () => expect(requiredConfirmations(9)).toBe(3));
  it('10 mest (tik nad 9) → 4', () => expect(requiredConfirmations(10)).toBe(4));
  it('nikoli pod 2', () => [-100, 0, 1, 6].forEach(n => expect(requiredConfirmations(n)).toBeGreaterThanOrEqual(2)));
  it('monotona funkcija', () => {
    let prev = requiredConfirmations(1);
    for (let n = 2; n <= 40; n++) {
      const cur = requiredConfirmations(n);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});