jest.mock('../../config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-id' })),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  },
}));

import { getDocs, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { listMyVenues, getVenue, createVenue, updateVenue, deleteVenue } from '../venueService';
import { listSchedule, addSlot, updateSlot, deleteSlot } from '../scheduleService';
import { listReservationsForOwner, listReservationsForVenue, aggregateRevenue } from '../reservationService';
import type { Venue, ScheduleSlot, Reservation } from '../../types/models';

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return { id: 'venue1', ownerId: 'owner1', name: 'Mladika', sport: 'futsal', location: { lat: 46.55, lng: 15.64, name: 'Mladika', address: 'Ulica 1' }, totalSpots: 10, active: true, ...overrides };
}

function makeSlot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return { id: 'slot1', venueId: 'venue1', weekday: 1, startHHMM: '18:00', endHHMM: '19:00', pricePerSlot: 30, active: true, ...overrides };
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return { id: 'res1', venueId: 'venue1', ownerId: 'owner1', bookedBy: 'user1', date: { toDate: () => new Date('2026-06-15') } as any, startHHMM: '18:00', endHHMM: '19:00', price: 30, status: 'confirmed', ...overrides };
}

describe('venueService', () => {
  it('listMyVenues vrne prazno polje', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
    expect(await listMyVenues('owner1')).toEqual([]);
  });

  it('listMyVenues vrne igrišča lastnika', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [{ id: 'v1', data: () => makeVenue({ name: 'Tabor' }) }] });
    const result = await listMyVenues('owner1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tabor');
  });

  it('getVenue vrne null če ne obstaja', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    expect(await getVenue('neobstoji')).toBeNull();
  });

  it('getVenue vrne igrišče', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, id: 'venue1', data: () => makeVenue() });
    const result = await getVenue('venue1');
    expect(result!.name).toBe('Mladika');
  });

  it('createVenue vrne ID', async () => {
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'new-123' });
    expect(await createVenue({ ownerId: 'owner1', name: 'Novo', sport: 'basketball', location: { lat: 0, lng: 0, name: 'T' }, totalSpots: 8, active: true })).toBe('new-123');
  });

  it('createVenue shrani pravilne podatke', async () => {
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'x' });
    await createVenue({ ownerId: 'owner1', name: 'Test', sport: 'futsal', location: { lat: 0, lng: 0, name: 'T' }, totalSpots: 6, active: true });
    const arg = (addDoc as jest.Mock).mock.calls.at(-1)[1];
    expect(arg.name).toBe('Test');
    expect(arg.ownerId).toBe('owner1');
  });

  it('updateVenue pokliče updateDoc', async () => {
    (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
    await updateVenue('venue1', { name: 'Novo' });
    expect(updateDoc).toHaveBeenCalled();
  });

  it('deleteVenue pokliče deleteDoc', async () => {
    (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
    await deleteVenue('venue1');
    expect(deleteDoc).toHaveBeenCalled();
  });
});

describe('scheduleService', () => {
  it('listSchedule vrne prazno polje', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
    expect(await listSchedule('venue1')).toEqual([]);
  });

  it('listSchedule sortira po weekday', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [{ id: 's2', data: () => makeSlot({ weekday: 3 }) }, { id: 's1', data: () => makeSlot({ weekday: 1 }) }] });
    const result = await listSchedule('venue1');
    expect(result[0].weekday).toBe(1);
    expect(result[1].weekday).toBe(3);
  });

  it('listSchedule sortira isti dan po uri', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [{ id: 's2', data: () => makeSlot({ startHHMM: '20:00' }) }, { id: 's1', data: () => makeSlot({ startHHMM: '10:00' }) }] });
    const result = await listSchedule('venue1');
    expect(result[0].startHHMM).toBe('10:00');
  });

  it('addSlot vrne ID', async () => {
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'slot-xyz' });
    expect(await addSlot('venue1', makeSlot())).toBe('slot-xyz');
  });

  it('addSlot shrani pravilne podatke', async () => {
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'x' });
    await addSlot('venue1', makeSlot({ weekday: 3, pricePerSlot: 40 }));
    const arg = (addDoc as jest.Mock).mock.calls.at(-1)[1];
    expect(arg.weekday).toBe(3);
    expect(arg.pricePerSlot).toBe(40);
  });

  it('updateSlot pokliče updateDoc', async () => {
    (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
    await updateSlot('venue1', 'slot1', { pricePerSlot: 40 });
    expect(updateDoc).toHaveBeenCalled();
  });

  it('deleteSlot pokliče deleteDoc', async () => {
    (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
    await deleteSlot('venue1', 'slot1');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('weekday 0 je veljaven (nedelja)', () => expect(makeSlot({ weekday: 0 }).weekday).toBe(0));
  it('weekday 6 je veljaven (sobota)', () => expect(makeSlot({ weekday: 6 }).weekday).toBe(6));
});

describe('reservationService', () => {
  it('listReservationsForOwner vrne prazno polje', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
    expect(await listReservationsForOwner('owner1')).toEqual([]);
  });

  it('listReservationsForOwner vrne rezervacije', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [{ id: 'r1', data: () => makeReservation() }] });
    expect(await listReservationsForOwner('owner1')).toHaveLength(1);
  });

  it('listReservationsForVenue vrne rezervacije', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [{ id: 'r1', data: () => makeReservation() }, { id: 'r2', data: () => makeReservation() }] });
    expect(await listReservationsForVenue('venue1')).toHaveLength(2);
  });

  it('aggregateRevenue vrne prazno za brez rezervacij', () => expect(aggregateRevenue([], 'month')).toEqual([]));

  it('aggregateRevenue preskoči preklicane', () => {
    expect(aggregateRevenue([makeReservation({ status: 'cancelled', price: 100 })], 'month')).toEqual([]);
  });

  it('aggregateRevenue sešteje isti mesec', () => {
    const result = aggregateRevenue([
      makeReservation({ price: 30, date: { toDate: () => new Date('2026-06-10') } as any }),
      makeReservation({ price: 40, date: { toDate: () => new Date('2026-06-20') } as any }),
    ], 'month');
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(70);
    expect(result[0].count).toBe(2);
  });

  it('aggregateRevenue loči različne mesece', () => {
    const result = aggregateRevenue([
      makeReservation({ price: 30, date: { toDate: () => new Date('2026-05-15') } as any }),
      makeReservation({ price: 50, date: { toDate: () => new Date('2026-06-15') } as any }),
    ], 'month');
    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2026-05');
    expect(result[1].period).toBe('2026-06');
  });

  it('aggregateRevenue tedenska granularnost', () => {
    const result = aggregateRevenue([
      makeReservation({ price: 30, date: { toDate: () => new Date('2026-06-15') } as any }),
      makeReservation({ price: 20, date: { toDate: () => new Date('2026-06-16') } as any }),
    ], 'week');
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(50);
  });

  it('aggregateRevenue sortira po period naraščajoče', () => {
    const result = aggregateRevenue([
      makeReservation({ price: 50, date: { toDate: () => new Date('2026-06-01') } as any }),
      makeReservation({ price: 30, date: { toDate: () => new Date('2026-04-01') } as any }),
    ], 'month');
    expect(result[0].period).toBe('2026-04');
    expect(result[1].period).toBe('2026-06');
  });
});