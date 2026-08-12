jest.mock('../../config/firebase', () => ({ db: {} }));

// Skupna shramba, ki jo mock transakcije bere in piše.
const mockStore = new Map<string, any>();
const mockVersions = new Map<string, number>();


jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: any, ...path: string[]) => ({ path: path.join('/') })),

  doc: jest.fn((_db: any, ...path: string[]) => ({ id: path[path.length - 1], path: path.join('/') })),

  query: jest.fn((ref: any, ...constraints: any[]) => ({ ref, constraints })),

  where: jest.fn((field: string, op: string, value: any) => ({ field, op, value })),

  getDocs: jest.fn(),

  updateDoc: jest.fn(async (ref: any, patch: any) => {
    const current = mockStore.get(ref.id) ?? {};
    mockStore.set(ref.id, { ...current, ...patch });
    mockVersions.set(ref.id, (mockVersions.get(ref.id) ?? 0) + 1);
  }),

runTransaction: jest.fn(async (_db: any, updateFn: any) => {
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const readVersions = new Map<string, number>();
      const pendingWrites: { id: string; value?: any; patch?: any }[] = [];

      const tx = {
        get: async (ref: any) => {
          readVersions.set(ref.id, mockVersions.get(ref.id) ?? 0);
          const data = mockStore.get(ref.id);
          return {
            exists: () => data !== undefined,
            data: () => data,
            id: ref.id,
          };
        },
        set: (ref: any, value: any) => {
          pendingWrites.push({ id: ref.id, value });
        },
        update: (ref: any, patch: any) => {
          pendingWrites.push({ id: ref.id, patch });
        },
      };

      const result = await updateFn(tx);

      // Potrditev: če se je katerikoli prebrani dokument medtem spremenil, transakcijo zavržemo in jo poženemo znova.
      let conflict = false;
      for (const [id, versionAtRead] of readVersions) {
        if ((mockVersions.get(id) ?? 0) !== versionAtRead) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      for (const write of pendingWrites) {
        if (write.value !== undefined) {
          mockStore.set(write.id, write.value);
        } else {
          mockStore.set(write.id, { ...(mockStore.get(write.id) ?? {}), ...write.patch });
        }
        mockVersions.set(write.id, (mockVersions.get(write.id) ?? 0) + 1);
      }

      return result;
    }

    throw new Error('Transakcija ni uspela po največjem številu poskusov.');
  }),

  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2026-06-01T12:00:00Z') })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  },
}));

import { getDocs } from 'firebase/firestore';
import {
  buildReservationId,
  createReservation,
  fetchReservationsForDate,
  cancelReservation,
  Reservation,
} from '../reservationService';

const BASE = {
  venueId: 'venue1',
  ownerId: 'owner1',
  bookedBy: 'userA',
  date: new Date(2026, 5, 15, 0, 0, 0),
  startHHMM: '18:00',
  endHHMM: '19:00',
  price: 30,
};

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockVersions.clear();
});

// deterministični ključ (ID) rezervacije
describe('buildReservationId', () => {
  it('isti vhodi dajo vedno isti ID', () => {
    const a = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    const b = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    expect(a).toBe(b);
  });

  it('drugo igrišče da drug ID', () => {
    const a = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    const b = buildReservationId('venue2', new Date(2026, 5, 15), '18:00');
    expect(a).not.toBe(b);
  });

  it('drug datum da drug ID', () => {
    const a = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    const b = buildReservationId('venue1', new Date(2026, 5, 16), '18:00');
    expect(a).not.toBe(b);
  });

  it('druga ura da drug ID', () => {
    const a = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    const b = buildReservationId('venue1', new Date(2026, 5, 15), '19:00');
    expect(a).not.toBe(b);
  });

  it('enomestni mesec in dan sta dopolnjena z ničlo', () => {
    const id = buildReservationId('v', new Date(2026, 0, 5), '09:00');
    expect(id).toBe('v_2026-01-05_0900');
  });

  it('ID ne vsebuje poševnice (Firestore je ne dovoli v ID-ju)', () => {
    const id = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    expect(id).not.toContain('/');
  });

  it('ura ob polnoči da veljaven ID', () => {
    const id = buildReservationId('v', new Date(2026, 11, 31), '00:00');
    expect(id).toBe('v_2026-12-31_0000');
  });
});


// osnovni tok ustvarjanja rezervacije
describe('createReservation — osnovni tok', () => {
  it('prosti termin se uspešno rezervira', async () => {
    const id = await createReservation(BASE);
    expect(mockStore.has(id)).toBe(true);
    expect(mockStore.get(id).status).toBe('confirmed');
  });

  it('vrne determinističen ID, ne naključnega', async () => {
    const id = await createReservation(BASE);
    expect(id).toBe(buildReservationId(BASE.venueId, BASE.date, BASE.startHHMM));
  });

  it('novo rezervacijo označi kot neplačano', async () => {
    const id = await createReservation(BASE);
    expect(mockStore.get(id).paid).toBe(false);
  });

  it('shrani uporabnika, ki je rezerviral', async () => {
    const id = await createReservation(BASE);
    expect(mockStore.get(id).bookedBy).toBe('userA');
  });
});

// osrednji del preprečevanja dvojnih rezervacij
describe('createReservation — preprečevanje dvojnih rezervacij', () => {
  it('drugi uporabnik na istem terminu dobi napako', async () => {
    await createReservation({ ...BASE, bookedBy: 'userA' });

    await expect(
      createReservation({ ...BASE, bookedBy: 'userB' })
    ).rejects.toThrow('Ta termin je že rezerviran. Izberi drug termin.');
  });

  it('po neuspelem drugem poskusu ostane zapisan prvi uporabnik', async () => {
    const id = await createReservation({ ...BASE, bookedBy: 'userA' });

    await expect(
      createReservation({ ...BASE, bookedBy: 'userB' })
    ).rejects.toThrow();

    expect(mockStore.get(id).bookedBy).toBe('userA');
  });

  it('v shrambi nastane natanko en zapis, tudi po dveh poskusih', async () => {
    await createReservation({ ...BASE, bookedBy: 'userA' });
    await createReservation({ ...BASE, bookedBy: 'userB' }).catch(() => {});

    expect(mockStore.size).toBe(1);
  });

  it('pri treh hkratnih poskusih uspe natanko eden', async () => {
    const results = await Promise.allSettled([
      createReservation({ ...BASE, bookedBy: 'userA' }),
      createReservation({ ...BASE, bookedBy: 'userB' }),
      createReservation({ ...BASE, bookedBy: 'userC' }),
    ]);

    const uspeli = results.filter(r => r.status === 'fulfilled');
    const zavrnjeni = results.filter(r => r.status === 'rejected');

    expect(uspeli).toHaveLength(1);
    expect(zavrnjeni).toHaveLength(2);
    expect(mockStore.size).toBe(1);
  });

  it('isti uporabnik ne more rezervirati istega termina dvakrat', async () => {
    await createReservation({ ...BASE, bookedBy: 'userA' });

    await expect(
      createReservation({ ...BASE, bookedBy: 'userA' })
    ).rejects.toThrow('Ta termin je že rezerviran. Izberi drug termin.');
  });

  it('drug termin na istem igrišču se rezervira brez težav', async () => {
    await createReservation({ ...BASE, startHHMM: '18:00', endHHMM: '19:00' });
    await createReservation({ ...BASE, startHHMM: '19:00', endHHMM: '20:00' });

    expect(mockStore.size).toBe(2);
  });

  it('isti termin na drugem igrišču se rezervira brez težav', async () => {
    await createReservation({ ...BASE, venueId: 'venue1' });
    await createReservation({ ...BASE, venueId: 'venue2' });

    expect(mockStore.size).toBe(2);
  });

  it('isti termin naslednji teden se rezervira brez težav', async () => {
    await createReservation({ ...BASE, date: new Date(2026, 5, 15) });
    await createReservation({ ...BASE, date: new Date(2026, 5, 22) });

    expect(mockStore.size).toBe(2);
  });
});

// da priklic sprosti termin in omogoči drugim da ga rezervirajo
describe('createReservation — preklican termin je spet prost', () => {
  it('po preklicu lahko drug uporabnik rezervira isti termin', async () => {
    const id = await createReservation({ ...BASE, bookedBy: 'userA' });
    await cancelReservation(id);

    await expect(
      createReservation({ ...BASE, bookedBy: 'userB' })
    ).resolves.toBe(id);

    expect(mockStore.get(id).bookedBy).toBe('userB');
    expect(mockStore.get(id).status).toBe('confirmed');
  });

  it('preklic nastavi status na cancelled', async () => {
    const id = await createReservation(BASE);
    await cancelReservation(id);
    expect(mockStore.get(id).status).toBe('cancelled');
  });
});

// pridobivanje rezervacij za datum - filtriranje 
describe('fetchReservationsForDate', () => {
  function mockDocs(reservations: Partial<Reservation>[]) {
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: reservations.map((r, i) => ({
        id: r.id ?? `r${i}`,
        data: () => r,
      })),
    });
  }

  it('preklicane rezervacije izpusti', async () => {
    mockDocs([
      { status: 'cancelled', date: { toDate: () => new Date(2026, 5, 15, 18) }, startHHMM: '18:00' },
      { status: 'confirmed', date: { toDate: () => new Date(2026, 5, 15, 19) }, startHHMM: '19:00' },
    ]);

    const result = await fetchReservationsForDate('venue1', new Date(2026, 5, 15));
    expect(result).toHaveLength(1);
    expect(result[0].startHHMM).toBe('19:00');
  });

  it('rezervacije z drugega dne izpusti', async () => {
    mockDocs([
      { status: 'confirmed', date: { toDate: () => new Date(2026, 5, 14, 18) }, startHHMM: '18:00' },
      { status: 'confirmed', date: { toDate: () => new Date(2026, 5, 15, 18) }, startHHMM: '18:00' },
      { status: 'confirmed', date: { toDate: () => new Date(2026, 5, 16, 18) }, startHHMM: '18:00' },
    ]);

    const result = await fetchReservationsForDate('venue1', new Date(2026, 5, 15));
    expect(result).toHaveLength(1);
  });

  it('rezervacijo ob 00:00 istega dne vključi (spodnja meja)', async () => {
    mockDocs([
      { status: 'confirmed', date: { toDate: () => new Date(2026, 5, 15, 0, 0, 0) }, startHHMM: '00:00' },
    ]);

    const result = await fetchReservationsForDate('venue1', new Date(2026, 5, 15));
    expect(result).toHaveLength(1);
  });

  it('rezervacijo ob 23:59 istega dne vključi (zgornja meja)', async () => {
    mockDocs([
      { status: 'confirmed', date: { toDate: () => new Date(2026, 5, 15, 23, 59, 59) }, startHHMM: '23:00' },
    ]);

    const result = await fetchReservationsForDate('venue1', new Date(2026, 5, 15));
    expect(result).toHaveLength(1);
  });

  it('prazna kolekcija vrne prazen seznam', async () => {
    mockDocs([]);
    const result = await fetchReservationsForDate('venue1', new Date(2026, 5, 15));
    expect(result).toEqual([]);
  });
});
