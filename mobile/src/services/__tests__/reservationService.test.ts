
jest.mock('../../config/firebase', () => ({ db: {}, functions: {} }));

const mockCallable = jest.fn(async () => ({
  data: { reservationId: 'rez-1', price: 30 },
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: any, ...path: string[]) => ({ path: path.join('/') })),
  doc: jest.fn((_db: any, ...path: string[]) => ({ path: path.join('/'), id: path[path.length - 1] })),
  query: jest.fn((ref: any, ...c: any[]) => ({ ref, c })),
  where: jest.fn((field: string, op: string, value: any) => ({ field, op, value })),
  getDocs: jest.fn(),
  updateDoc: jest.fn(async () => {}),
}));

import { getDocs, updateDoc } from 'firebase/firestore';
import {
  hhmmToMinutes,
  rangesOverlap,
  toDateKey,
  buildReservationId,
  fetchActiveVenues,
  fetchVenueSchedule,
  fetchBookedSlots,
  fetchMyReservations,
  createReservation,
  cancelReservation,
  markReservationPaid,
} from '../reservationService';

function mockSnapshot(rows: any[]) {
  (getDocs as jest.Mock).mockResolvedValueOnce({
    docs: rows.map((r, i) => ({ id: r.id ?? `d${i}`, data: () => r })),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallable.mockResolvedValue({ data: { reservationId: 'rez-1', price: 30 } });
});

//hhmmToMinutes

describe('hhmmToMinutes — pretvorba časa v minute', () => {
  it('polnoč je nič minut (spodnja meja)', () => {
    expect(hhmmToMinutes('00:00')).toBe(0);
  });

  it('zadnja minuta dneva je 1439 (zgornja meja)', () => {
    expect(hhmmToMinutes('23:59')).toBe(1439);
  });

  it('ura 24 je neveljavna (tik nad mejo)', () => {
    expect(hhmmToMinutes('24:00')).toBeNaN();
  });

  it('minuta 60 je neveljavna (tik nad mejo)', () => {
    expect(hhmmToMinutes('12:60')).toBeNaN();
  });

  it('minuta 59 je veljavna (na meji)', () => {
    expect(hhmmToMinutes('12:59')).toBe(779);
  });

  it('enomestna ura brez vodilne ničle je sprejeta', () => {
    expect(hhmmToMinutes('9:30')).toBe(570);
  });

  it('enomestna minuta je zavrnjena', () => {
    expect(hhmmToMinutes('9:3')).toBeNaN();
  });

  it('zapis brez dvopičja je zavrnjen', () => {
    expect(hhmmToMinutes('1800')).toBeNaN();
  });

  it('prazen niz je zavrnjen', () => {
    expect(hhmmToMinutes('')).toBeNaN();
  });

  it('nedefinirana vrednost je zavrnjena', () => {
    expect(hhmmToMinutes(undefined as any)).toBeNaN();
  });

  it('besedilo je zavrnjeno', () => {
    expect(hhmmToMinutes('osemnajst')).toBeNaN();
  });

  it('negativni zapis je zavrnjen', () => {
    expect(hhmmToMinutes('-1:00')).toBeNaN();
  });

  it('celo uro pretvori v mnogokratnik šestdesetih', () => {
    expect(hhmmToMinutes('18:00')).toBe(1080);
  });
});

//rangesOverlap

describe('rangesOverlap — prekrivanje terminov', () => {
  it('zaporedna termina se ne prekrivata (dotik na meji)', () => {
    expect(rangesOverlap('18:00', '19:00', '19:00', '20:00')).toBe(false);
  });

  it('zaporedna termina v obratnem vrstnem redu se ne prekrivata', () => {
    expect(rangesOverlap('19:00', '20:00', '18:00', '19:00')).toBe(false);
  });

  it('prekrivanje ene minute je prekrivanje (tik čez mejo)', () => {
    expect(rangesOverlap('18:00', '19:01', '19:00', '20:00')).toBe(true);
  });

  it('enaka termina se prekrivata', () => {
    expect(rangesOverlap('18:00', '19:00', '18:00', '19:00')).toBe(true);
  });

  it('termin v celoti znotraj drugega se prekriva', () => {
    expect(rangesOverlap('18:15', '18:45', '18:00', '19:00')).toBe(true);
  });

  it('termin, ki obsega drugega, se prekriva', () => {
    expect(rangesOverlap('17:00', '21:00', '18:00', '19:00')).toBe(true);
  });

  it('delno prekrivanje na začetku', () => {
    expect(rangesOverlap('17:30', '18:30', '18:00', '19:00')).toBe(true);
  });

  it('delno prekrivanje na koncu', () => {
    expect(rangesOverlap('18:30', '19:30', '18:00', '19:00')).toBe(true);
  });

  it('povsem ločena termina se ne prekrivata', () => {
    expect(rangesOverlap('08:00', '09:00', '18:00', '19:00')).toBe(false);
  });

  it('neveljaven zapis pomeni, da prekrivanja ne ugotovimo', () => {
    expect(rangesOverlap('nekaj', '19:00', '18:00', '19:00')).toBe(false);
  });

  it('neveljaven zapis v drugem terminu prav tako', () => {
    expect(rangesOverlap('18:00', '19:00', '18:00', '25:00')).toBe(false);
  });

  it('termin ničelne dolžine se ne prekriva z ničimer', () => {
    expect(rangesOverlap('18:00', '18:00', '18:00', '19:00')).toBe(false);
  });
});

//toDateKey

describe('toDateKey — ključ datuma', () => {
  it('sestavi obliko leto-mesec-dan', () => {
    expect(toDateKey(new Date(2026, 5, 15))).toBe('2026-06-15');
  });

  it('enomestni mesec dopolni z ničlo', () => {
    expect(toDateKey(new Date(2026, 0, 15))).toBe('2026-01-15');
  });

  it('enomestni dan dopolni z ničlo', () => {
    expect(toDateKey(new Date(2026, 5, 5))).toBe('2026-06-05');
  });

  it('prvi dan leta', () => {
    expect(toDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('zadnji dan leta', () => {
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('prestopni dan', () => {
    expect(toDateKey(new Date(2028, 1, 29))).toBe('2028-02-29');
  });

  it('ura na ključ ne vpliva', () => {
    expect(toDateKey(new Date(2026, 5, 15, 23, 59))).toBe('2026-06-15');
  });
});

//buildReservationId

describe('buildReservationId — determinističen ključ', () => {
  it('isti vhodi dajo isti ID', () => {
    const a = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    const b = buildReservationId('venue1', new Date(2026, 5, 15), '18:00');
    expect(a).toBe(b);
  });

  it('sestavljen je iz igrišča, datuma in ure', () => {
    expect(buildReservationId('venue1', new Date(2026, 5, 15), '18:00'))
      .toBe('venue1_2026-06-15_1800');
  });

  it('drugo igrišče da drug ID', () => {
    expect(buildReservationId('venue1', new Date(2026, 5, 15), '18:00'))
      .not.toBe(buildReservationId('venue2', new Date(2026, 5, 15), '18:00'));
  });

  it('drug datum da drug ID', () => {
    expect(buildReservationId('venue1', new Date(2026, 5, 15), '18:00'))
      .not.toBe(buildReservationId('venue1', new Date(2026, 5, 16), '18:00'));
  });

  it('druga ura da drug ID', () => {
    expect(buildReservationId('venue1', new Date(2026, 5, 15), '18:00'))
      .not.toBe(buildReservationId('venue1', new Date(2026, 5, 15), '19:00'));
  });

  it('ID ne vsebuje poševnice, ki je Firestore ne dovoli', () => {
    expect(buildReservationId('venue1', new Date(2026, 5, 15), '18:00')).not.toContain('/');
  });

  it('ID ne vsebuje dvopičja', () => {
    expect(buildReservationId('venue1', new Date(2026, 5, 15), '18:00')).not.toContain(':');
  });
});

//fetchActiveVenues

describe('fetchActiveVenues', () => {
  const futsal = { name: 'A', sport: 'futsal', active: true };
  const basket = { name: 'B', sport: 'basketball', active: true };
  const both = { name: 'C', sport: 'both', active: true };

  it('brez filtra vrne vsa aktivna igrišča', async () => {
    mockSnapshot([futsal, basket, both]);
    expect(await fetchActiveVenues()).toHaveLength(3);
  });

  it('filter za futsal vključi tudi igrišča za oba športa', async () => {
    mockSnapshot([futsal, basket, both]);
    const r = await fetchActiveVenues('futsal');
    expect(r.map(v => v.name)).toEqual(['A', 'C']);
  });

  it('filter za košarko vključi tudi igrišča za oba športa', async () => {
    mockSnapshot([futsal, basket, both]);
    const r = await fetchActiveVenues('basketball');
    expect(r.map(v => v.name)).toEqual(['B', 'C']);
  });

  it('prazna zbirka vrne prazen seznam', async () => {
    mockSnapshot([]);
    expect(await fetchActiveVenues('futsal')).toEqual([]);
  });
});

//fetchVenueSchedule

describe('fetchVenueSchedule', () => {
  it('razvrsti termine po dnevu v tednu', async () => {
    mockSnapshot([
      { weekday: 3, startHHMM: '18:00' },
      { weekday: 1, startHHMM: '18:00' },
    ]);
    const r = await fetchVenueSchedule('venue1');
    expect(r.map(s => s.weekday)).toEqual([1, 3]);
  });

  it('termine istega dne razvrsti po uri', async () => {
    mockSnapshot([
      { weekday: 1, startHHMM: '20:00' },
      { weekday: 1, startHHMM: '09:00' },
    ]);
    const r = await fetchVenueSchedule('venue1');
    expect(r.map(s => s.startHHMM)).toEqual(['09:00', '20:00']);
  });

  it('vsakemu terminu pripiše igrišče', async () => {
    mockSnapshot([{ weekday: 1, startHHMM: '18:00' }]);
    const r = await fetchVenueSchedule('venue1');
    expect(r[0].venueId).toBe('venue1');
  });

  it('prazen urnik vrne prazen seznam', async () => {
    mockSnapshot([]);
    expect(await fetchVenueSchedule('venue1')).toEqual([]);
  });
});

//fetchBookedSlots

describe('fetchBookedSlots', () => {
  it('vrne zasedene termine za dani dan', async () => {
    mockSnapshot([
      { dateKey: '2026-06-15', startHHMM: '18:00', endHHMM: '19:00' },
      { dateKey: '2026-06-15', startHHMM: '20:00', endHHMM: '21:00' },
    ]);
    expect(await fetchBookedSlots('venue1', new Date(2026, 5, 15))).toHaveLength(2);
  });

  it('brez zasedenih terminov vrne prazen seznam', async () => {
    mockSnapshot([]);
    expect(await fetchBookedSlots('venue1', new Date(2026, 5, 15))).toEqual([]);
  });

  it('vsakemu zapisu ohrani identifikator', async () => {
    mockSnapshot([{ id: 'b1', dateKey: '2026-06-15', startHHMM: '18:00', endHHMM: '19:00' }]);
    const r = await fetchBookedSlots('venue1', new Date(2026, 5, 15));
    expect(r[0].id).toBe('b1');
  });
});

//fetchMyReservations

describe('fetchMyReservations', () => {
  const rez = (status: string, ms: number) => ({
    status,
    date: { toDate: () => new Date(ms) },
  });

  it('preklicane rezervacije izpusti', async () => {
    mockSnapshot([rez('cancelled', 1000), rez('confirmed', 2000)]);
    const r = await fetchMyReservations('user1');
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe('confirmed');
  });

  it('razvrsti od najstarejše proti najnovejši', async () => {
    mockSnapshot([rez('confirmed', 3000), rez('confirmed', 1000)]);
    const r = await fetchMyReservations('user1');
    expect(r[0].date.toDate().getTime()).toBe(1000);
  });

  it('rezervacijo brez datuma obravnava kot najstarejšo', async () => {
    mockSnapshot([rez('confirmed', 5000), { status: 'confirmed' }]);
    const r = await fetchMyReservations('user1');
    expect(r).toHaveLength(2);
  });

  it('brez rezervacij vrne prazen seznam', async () => {
    mockSnapshot([]);
    expect(await fetchMyReservations('user1')).toEqual([]);
  });

  it('same preklicane rezervacije dajo prazen seznam', async () => {
    mockSnapshot([rez('cancelled', 1000), rez('cancelled', 2000)]);
    expect(await fetchMyReservations('user1')).toEqual([]);
  });
});

//Pogodba proti Cloud Functions

describe('createReservation — pogodba klica', () => {
  const BASE = {
    venueId: 'venue1',
    date: new Date(2026, 5, 15),
    startHHMM: '18:00',
    endHHMM: '19:00',
  };

  it('datum pošlje kot ključ, ne kot objekt', async () => {
    await createReservation(BASE);
    expect(mockCallable.mock.calls[0][0]).toMatchObject({ dateKey: '2026-06-15' });
  });

  it('pošlje igrišče in oba časa', async () => {
    await createReservation(BASE);
    expect(mockCallable.mock.calls[0][0]).toMatchObject({
      venueId: 'venue1',
      startHHMM: '18:00',
      endHHMM: '19:00',
    });
  });

  it('brez tekme polja matchId ne pošlje', async () => {
    await createReservation(BASE);
    expect(mockCallable.mock.calls[0][0]).not.toHaveProperty('matchId');
  });

  it('s tekmo polje matchId pošlje', async () => {
    await createReservation({ ...BASE, matchId: 'match1' });
    expect(mockCallable.mock.calls[0][0]).toMatchObject({ matchId: 'match1' });
  });

  it('vrne odgovor strežnika nespremenjen', async () => {
    const r = await createReservation(BASE);
    expect(r).toEqual({ reservationId: 'rez-1', price: 30 });
  });

  it('napako strežnika posreduje naprej', async () => {
    mockCallable.mockRejectedValueOnce(new Error('Termin je že rezerviran.'));
    await expect(createReservation(BASE)).rejects.toThrow('Termin je že rezerviran.');
  });
});

describe('cancelReservation in markReservationPaid', () => {
  it('preklic pošlje identifikator rezervacije', async () => {
    await cancelReservation('rez-1');
    expect(mockCallable.mock.calls[0][0]).toEqual({ reservationId: 'rez-1' });
  });

  it('napako pri preklicu posreduje naprej', async () => {
    mockCallable.mockRejectedValueOnce(new Error('Preklic ni mogoč.'));
    await expect(cancelReservation('rez-1')).rejects.toThrow('Preklic ni mogoč.');
  });

  it('označitev plačila zapiše v dokument rezervacije', async () => {
    await markReservationPaid('rez-1');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rez-1' }),
      { paid: true },
    );
  });
});
