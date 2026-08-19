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
import {
  suggestMissingPosition, STARTING_ELO, UserDoc, PlayerPosition,
  minPlayersPerTeam, minPlayersToStart, hasEnoughPlayers, teamsAreViable,
} from '../matchService';

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

// ────────────────────────────────────────────────────────────────
// suggestMissingPosition — katera pozicija v ekipi manjka
//
// Pri futsalu velja posebno pravilo: če v ekipi ni vratarja IN je ciljna
// velikost ekipe vsaj 4, funkcija vedno predlaga vratarja. Meja je
// teamTargetSize === 4, zato jo preverimo pri 3, 4 in 5.
// Sicer vrne pozicijo z najmanj igralci.
// ────────────────────────────────────────────────────────────────

const FUTSAL: PlayerPosition[] = ['goalkeeper', 'defender', 'midfielder', 'forward'];
const BASKETBALL: PlayerPosition[] = ['guard', 'forward', 'center'];

describe('suggestMissingPosition — mejna velikost ekipe pri futsalu', () => {
  const brezVratarja = [
    { uid: 'a', position: 'defender' as PlayerPosition },
    { uid: 'b', position: 'midfielder' as PlayerPosition },
  ];

  it('ekipa 3 (tik pod mejo) — vratar', () => {
    expect(suggestMissingPosition('futsal', brezVratarja, 3)).toBe('goalkeeper');
  });

  it('ekipa 4 (točno na meji) — vratar', () => {
    expect(suggestMissingPosition('futsal', brezVratarja, 4)).toBe('goalkeeper');
  });

  it('ekipa 5 (tik nad mejo) — vratar', () => {
    expect(suggestMissingPosition('futsal', brezVratarja, 5)).toBe('goalkeeper');
  });

  it('ekipa 0 (degenerirani primer) — vrne veljavno pozicijo', () => {
    const r = suggestMissingPosition('futsal', brezVratarja, 0);
    expect(FUTSAL).toContain(r);
  });

  it('ko je vratar že v ekipi, predlaga pozicijo z najmanj igralci', () => {
    const zVratarjem = [
      { uid: 'a', position: 'goalkeeper' as PlayerPosition },
      { uid: 'b', position: 'defender' as PlayerPosition },
      { uid: 'c', position: 'midfielder' as PlayerPosition },
    ];
    expect(suggestMissingPosition('futsal', zVratarjem, 5)).toBe('forward');
  });
});

describe('suggestMissingPosition — robni vhodi', () => {
  it('prazna ekipa vrne veljavno pozicijo', () => {
    const r = suggestMissingPosition('futsal', [], 5);
    expect(FUTSAL).toContain(r);
  });

  it('igralci brez določene pozicije ne pokvarijo štetja', () => {
    const brezPozicij = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }];
    const r = suggestMissingPosition('futsal', brezPozicij, 5);
    expect(r).toBe('goalkeeper');
  });

  it('pozicija iz napačnega športa se pri štetju izpusti', () => {
    // 'center' je košarkarska pozicija; pri futsalu se ne sme šteti
    const mesano = [
      { uid: 'a', position: 'goalkeeper' as PlayerPosition },
      { uid: 'b', position: 'center' as PlayerPosition },
    ];
    const r = suggestMissingPosition('futsal', mesano, 5);
    expect(FUTSAL).toContain(r);
    expect(r).not.toBe('center');
  });

  it('pri košarki nikoli ne predlaga vratarja', () => {
    const r = suggestMissingPosition('basketball', [], 5);
    expect(BASKETBALL).toContain(r);
    expect(r).not.toBe('goalkeeper');
  });

  it('pri košarki upošteva le košarkarske pozicije', () => {
    const ekipa = [
      { uid: 'a', position: 'guard' as PlayerPosition },
      { uid: 'b', position: 'center' as PlayerPosition },
    ];
    expect(suggestMissingPosition('basketball', ekipa, 5)).toBe('forward');
  });

  it('enakomerno zasedena ekipa vrne prvo pozicijo po vrsti', () => {
    const polna = [
      { uid: 'a', position: 'goalkeeper' as PlayerPosition },
      { uid: 'b', position: 'defender' as PlayerPosition },
      { uid: 'c', position: 'midfielder' as PlayerPosition },
      { uid: 'd', position: 'forward' as PlayerPosition },
    ];
    expect(suggestMissingPosition('futsal', polna, 5)).toBe('goalkeeper');
  });

  it('vrne pozicijo, ki v ekipi še ni zastopana', () => {
    const ekipa = [
      { uid: 'a', position: 'goalkeeper' as PlayerPosition },
      { uid: 'b', position: 'defender' as PlayerPosition },
      { uid: 'c', position: 'defender' as PlayerPosition },
      { uid: 'd', position: 'forward' as PlayerPosition },
    ];
    expect(suggestMissingPosition('futsal', ekipa, 5)).toBe('midfielder');
  });
});

// minimalno stevilo igralcev za zacetek tekme
const igralci = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

describe('minPlayersPerTeam — mejne velikosti tekem', () => {
  it('5v5 zahteva 3 na ekipo', () => expect(minPlayersPerTeam(10)).toBe(3));
  it('4v4 zahteva 3 na ekipo', () => expect(minPlayersPerTeam(8)).toBe(3));
  it('3v3 zahteva 2 na ekipo', () => expect(minPlayersPerTeam(6)).toBe(2));
  it('2v2 zahteva 2 na ekipo', () => expect(minPlayersPerTeam(4)).toBe(2));
  it('1v1 zahteva 1 na ekipo (spodnja meja)', () => expect(minPlayersPerTeam(2)).toBe(1));
  it('nikoli ne vrne 0', () => expect(minPlayersPerTeam(0)).toBe(1));
  it('skupni minimum je dvakratnik ekipe', () => expect(minPlayersToStart(10)).toBe(6));
});

describe('hasEnoughPlayers — prag za zacetek', () => {
  it('5 igralcev na 5v5 ni dovolj', () =>
    expect(hasEnoughPlayers({ totalSpots: 10, players: igralci(5) })).toBe(false));
  it('6 igralcev na 5v5 je dovolj (natanko na meji)', () =>
    expect(hasEnoughPlayers({ totalSpots: 10, players: igralci(6) })).toBe(true));
  it('7 igralcev na 5v5 je dovolj', () =>
    expect(hasEnoughPlayers({ totalSpots: 10, players: igralci(7) })).toBe(true));
  it('en sam igralec ni dovolj', () =>
    expect(hasEnoughPlayers({ totalSpots: 10, players: igralci(1) })).toBe(false));
  it('manjkajoc seznam igralcev ne sesuje', () =>
    expect(hasEnoughPlayers({ totalSpots: 10, players: undefined as any })).toBe(false));
});

describe('teamsAreViable — obe ekipi morata biti zasedeni', () => {
  it('prazna ekipa B prepreci igro (izkoriscanje ELO)', () =>
    expect(teamsAreViable({ totalSpots: 10, isPremium: true, teamA: igralci(1), teamB: [] })).toBe(false));
  it('razmerje 3+2 na 5v5 ni dovolj', () =>
    expect(teamsAreViable({ totalSpots: 10, isPremium: true, teamA: ['a', 'b', 'c'], teamB: ['d', 'e'] })).toBe(false));
  it('razmerje 3+3 na 5v5 zadosca', () =>
    expect(teamsAreViable({ totalSpots: 10, isPremium: true, teamA: ['a', 'b', 'c'], teamB: ['d', 'e', 'f'] })).toBe(true));
  it('navadna tekma ekip ne preverja', () =>
    expect(teamsAreViable({ totalSpots: 10, isPremium: false, teamA: [], teamB: [] })).toBe(true));
  it('manjkajoci ekipi ne sesujeta', () =>
    expect(teamsAreViable({ totalSpots: 10, isPremium: true, teamA: undefined, teamB: undefined })).toBe(false));
});