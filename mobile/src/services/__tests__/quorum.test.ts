

jest.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: null }, functions: {} }));

const mockDocs = new Map<string, any>();
const mockAdded: { path: string; data: any }[] = [];

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: any, ...path: string[]) => ({ path: path.join('/') })),
  doc: jest.fn((_db: any, ...path: string[]) => ({ path: path.join('/'), id: path[path.length - 1] })),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
  addDoc: jest.fn(async (ref: any, data: any) => {
    mockAdded.push({ path: ref.path, data });
    return { id: 'new-doc' };
  }),
  updateDoc: jest.fn(async (ref: any, patch: any) => {
    mockDocs.set(ref.path, { ...(mockDocs.get(ref.path) ?? {}), ...patch });
  }),
  setDoc: jest.fn(),
  deleteField: jest.fn(),
  onSnapshot: jest.fn(),
  arrayUnion: jest.fn((...a: any[]) => a),
  arrayRemove: jest.fn((...a: any[]) => a),
  increment: jest.fn((n: number) => n),
  runTransaction: jest.fn(async (_db: any, fn: any) => {
    const tx = {
      get: async (ref: any) => {
        const data = mockDocs.get(ref.path);
        return { exists: () => data !== undefined, data: () => data };
      },
      update: (ref: any, patch: any) => {
        mockDocs.set(ref.path, { ...(mockDocs.get(ref.path) ?? {}), ...patch });
      },
      set: (ref: any, value: any) => mockDocs.set(ref.path, value),
    };
    return fn(tx);
  }),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2026-06-01T12:00:00Z') })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  },
}));

jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn(() => jest.fn()) }));
jest.mock('../reputationService', () => ({
  applyReputationChange: jest.fn(async () => {}),
  REP_DELTA: { attended: 2, no_show: -5, late_cancel: -3, on_time_cancel: -1 },
}));

import { rsvpSlot, RSVP } from '../matchService';

// pomozne funkcije 

const SLOT = 'slots/slot1';
const GROUP = 'groups/grp1';

//  prep-a skupino in termin z danimi odgovori,  clani brez izrecnega odgovora so zabeleženi kot maybe
function pripravi(opts: {
  members?: number;
  minQuorum: number;
  coming?: number;
  notComing?: number;
  status?: 'pending' | 'confirmed' | 'cancelled';
}) {
  const total = opts.members ?? 10;
  const members = Array.from({ length: total }, (_, i) => `u${i}`);

  const rsvps: Record<string, RSVP> = {};
  members.forEach(m => { rsvps[m] = 'maybe'; });
  for (let i = 0; i < (opts.coming ?? 0); i++) rsvps[`u${i}`] = 'coming';
  for (let i = 0; i < (opts.notComing ?? 0); i++) rsvps[`u${total - 1 - i}`] = 'not_coming';

  mockDocs.set(GROUP, {
    name: 'Sredina ekipa',
    sport: 'futsal',
    location: { lat: 0, lng: 0, name: '' },
    totalSpots: total,
    members,
    createdBy: 'u0',
    weekday: 3,
    timeHHMM: '18:00',
    minQuorum: opts.minQuorum,
    inviteCode: 'ABC123',
  });

  mockDocs.set(SLOT, {
    groupId: 'grp1',
    datetime: { toDate: () => new Date('2026-06-17T18:00:00Z') },
    rsvps,
    status: opts.status ?? 'pending',
  });
}

const statusTermina = () => mockDocs.get(SLOT).status;
const steviloNovihTerminov = () => mockAdded.filter(a => a.path === 'slots').length;

beforeEach(() => {
  mockDocs.clear();
  mockAdded.length = 0;
  jest.clearAllMocks();
});

// prag za potrditev
describe('rsvpSlot — prag za potrditev termina', () => {
  it('en glas pod kvorumom termin pusti odprt', async () => {
    // 10 clanov & kvorum 6, stirje ze potrdili ; 5-ti glas da skupaj 5
    pripravi({ minQuorum: 6, coming: 4 });
    await rsvpSlot('slot1', 'u8', 'coming');
    expect(statusTermina()).toBe('pending');
  });

  it('natanko na kvorumu termin potrdi', async () => {
    // 5 potrdilo, 6-ti glas doseže kvorum 6
    pripravi({ minQuorum: 6, coming: 5 });
    await rsvpSlot('slot1', 'u8', 'coming');
    expect(statusTermina()).toBe('confirmed');
  });

  it('nad kvorumom termin ostane potrjen', async () => {
    pripravi({ minQuorum: 6, coming: 6 });
    await rsvpSlot('slot1', 'u8', 'coming');
    expect(statusTermina()).toBe('confirmed');
  });

  it('kvorum 1 potrdi termin že ob prvem odgovoru', async () => {
    pripravi({ minQuorum: 1, coming: 0 });
    await rsvpSlot('slot1', 'u0', 'coming');
    expect(statusTermina()).toBe('confirmed');
  });

  it('kvorum, enak številu vseh članov, zahteva soglasje vseh', async () => {
    pripravi({ members: 4, minQuorum: 4, coming: 3 });
    await rsvpSlot('slot1', 'u3', 'coming');
    expect(statusTermina()).toBe('confirmed');
  });
});

//  testiranje praga za odpoved termina 
describe('rsvpSlot — prag za odpoved termina', () => {
  it('trije odkloni kvoruma še ne ogrozijo', async () => {
    // 10 članov, kvorum 6 , potem,  odpoved šele pri več kot 4 odklonih
    pripravi({ minQuorum: 6, notComing: 2 });
    await rsvpSlot('slot1', 'u0', 'not_coming');
    expect(statusTermina()).toBe('pending');
  });

  it('natanko na meji termin še vzdrži', async () => {
    // 4 odkloni: preostalih 6 natanko doseže kvorum
    pripravi({ minQuorum: 6, notComing: 3 });
    await rsvpSlot('slot1', 'u0', 'not_coming');
    expect(statusTermina()).toBe('pending');
  });

  it('en odklon nad mejo termin odpove', async () => {
    // 5 odklonov, psoledicno preostalih, 5 ne more doseči kvoruma 6
    pripravi({ minQuorum: 6, notComing: 4 });
    await rsvpSlot('slot1', 'u0', 'not_coming');
    expect(statusTermina()).toBe('cancelled');
  });

  it('pri soglasnem kvorumu že en odklon odpove termin', async () => {
    pripravi({ members: 4, minQuorum: 4, notComing: 0 });
    await rsvpSlot('slot1', 'u0', 'not_coming');
    expect(statusTermina()).toBe('cancelled');
  });
});

// prednost potrditve pred odpovedjo
describe('rsvpSlot — ko sta izpolnjena oba pogoja', () => {
  it('potrditev ima prednost pred odpovedjo', async () => {
    // !!!: 10 članov, kvorum 3: pet je potrdilo a 4 so odklonili, kar pomeni da je dobolj odklonov za (5 > 10-3) a kvorum je dosezen, zato mora obveljati potrditev.
    pripravi({ members: 10, minQuorum: 3, coming: 5, notComing: 4 });
    await rsvpSlot('slot1', 'u5', 'not_coming');
    expect(statusTermina()).toBe('confirmed');
  });
});

// sprememba odgovora
describe('rsvpSlot — sprememba že oddanega odgovora', () => {
  it('umik potrditve termina ne potrdi', async () => {
    // 5 potrdilo, 1 si premisli potem ostanejo 4
    pripravi({ minQuorum: 6, coming: 5 });
    await rsvpSlot('slot1', 'u0', 'not_coming');
    expect(statusTermina()).toBe('pending');
  });

  it('odgovor maybe ne šteje k nobenemu pragu', async () => {
    pripravi({ minQuorum: 6, coming: 5 });
    await rsvpSlot('slot1', 'u8', 'maybe');
    expect(statusTermina()).toBe('pending');
  });

  it('ponovni enak odgovor stanja ne spremeni', async () => {
    pripravi({ minQuorum: 6, coming: 3 });
    await rsvpSlot('slot1', 'u0', 'coming');
    expect(statusTermina()).toBe('pending');
  });
});

// samodejno ustvarjanje naslednjega termina
describe('rsvpSlot — naslednji termin', () => {
  it('po potrditvi ustvari naslednji termin', async () => {
    pripravi({ minQuorum: 6, coming: 5 });
    await rsvpSlot('slot1', 'u8', 'coming');
    expect(steviloNovihTerminov()).toBe(1);
  });

  it('po odpovedi prav tako ustvari naslednji termin', async () => {
    pripravi({ minQuorum: 6, notComing: 4 });
    await rsvpSlot('slot1', 'u0', 'not_coming');
    expect(steviloNovihTerminov()).toBe(1);
  });

  it('dokler je termin odprt, novega ne ustvari', async () => {
    pripravi({ minQuorum: 6, coming: 2 });
    await rsvpSlot('slot1', 'u8', 'coming');
    expect(steviloNovihTerminov()).toBe(0);
  });

  it('novi termin vse člane zabeleži kot neopredeljene', async () => {
    pripravi({ minQuorum: 6, coming: 5 });
    await rsvpSlot('slot1', 'u8', 'coming');
    const novi = mockAdded.find(a => a.path === 'slots')!;
    expect(Object.values(novi.data.rsvps).every(r => r === 'maybe')).toBe(true);
  });

  it('novi termin je odprt za odgovore', async () => {
    pripravi({ minQuorum: 6, coming: 5 });
    await rsvpSlot('slot1', 'u8', 'coming');
    const novi = mockAdded.find(a => a.path === 'slots')!;
    expect(novi.data.status).toBe('pending');
  });
});

// zavrnitev neveljavnih zahtev
describe('rsvpSlot — neveljavne zahteve', () => {
  it('neobstoječ termin zavrne', async () => {
    await expect(rsvpSlot('slot1', 'u0', 'coming')).rejects.toThrow('Termin ne obstaja.');
  });

  it('na potrjen termin ni več mogoče odgovarjati', async () => {
    pripravi({ minQuorum: 6, coming: 6, status: 'confirmed' });
    await expect(rsvpSlot('slot1', 'u8', 'coming')).rejects.toThrow('Termin ni več aktiven.');
  });

  it('na odpovedan termin ni več mogoče odgovarjati', async () => {
    pripravi({ minQuorum: 6, notComing: 9, status: 'cancelled' });
    await expect(rsvpSlot('slot1', 'u0', 'coming')).rejects.toThrow('Termin ni več aktiven.');
  });

  it('zavrnjena zahteva ne ustvari naslednjega termina', async () => {
    pripravi({ minQuorum: 6, coming: 6, status: 'confirmed' });
    await rsvpSlot('slot1', 'u8', 'coming').catch(() => {});
    expect(steviloNovihTerminov()).toBe(0);
  });
});
