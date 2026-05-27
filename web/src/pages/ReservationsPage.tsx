import React from 'react';
import { useAuth } from '../context/AuthContext';
import { listReservationsForOwner } from '../services/reservationService';
import { listMyVenues } from '../services/venueService';
import type { Reservation, Venue } from '../types/models';

const STATUS_LABEL: Record<Reservation['status'], { label: string; cls: string }> = {
  pending: { label: 'V čakanju', cls: 'bg-yellow-500/15 text-yellow-400' },
  confirmed: { label: 'Potrjeno', cls: 'bg-green-500/15 text-green-400' },
  cancelled: { label: 'Preklicano', cls: 'bg-red-500/15 text-red-400' },
};

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReservationsPage() {
  const { ownerProfile } = useAuth();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [venueFilter, setVenueFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  React.useEffect(() => {
    if (!ownerProfile) return;
    setLoading(true);
    Promise.all([
      listReservationsForOwner(ownerProfile.uid),
      listMyVenues(ownerProfile.uid),
    ]).then(([r, v]) => {
      setReservations(r);
      setVenues(v);
    }).finally(() => setLoading(false));
  }, [ownerProfile]);

  const venueMap = React.useMemo(() => {
    const m = new Map<string, Venue>();
    venues.forEach(v => m.set(v.id, v));
    return m;
  }, [venues]);

  const filtered = reservations.filter(r =>
    (venueFilter === 'all' || r.venueId === venueFilter) &&
    (statusFilter === 'all' || r.status === statusFilter)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Rezervacije</h1>
        <p className="text-sm text-neutral-400 mt-1">Pregled rezervacij vseh tvojih igrišč.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={venueFilter}
          onChange={e => setVenueFilter(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
        >
          <option value="all">Vsa igrišča</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
        >
          <option value="all">Vsi statusi</option>
          <option value="pending">V čakanju</option>
          <option value="confirmed">Potrjene</option>
          <option value="cancelled">Preklicane</option>
        </select>
      </div>

      {loading ? (
        <div className="text-neutral-400">Nalaganje...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center">
          <p className="text-sm text-neutral-400">Ni rezervacij.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="bg-neutral-800/50 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-4 py-3 text-left">Datum</th>
                <th className="px-4 py-3 text-left">Termin</th>
                <th className="px-4 py-3 text-left">Igrišče</th>
                <th className="px-4 py-3 text-left">Rezerviral</th>
                <th className="px-4 py-3 text-right">Cena</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-neutral-800">
                  <td className="px-4 py-3 text-neutral-300">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 font-mono text-white">{r.startHHMM} – {r.endHHMM}</td>
                  <td className="px-4 py-3 text-neutral-300">{venueMap.get(r.venueId)?.name ?? r.venueId}</td>
                  <td className="px-4 py-3 text-neutral-400">{r.bookedByName ?? r.bookedBy.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{r.price} €</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_LABEL[r.status].cls}`}>
                      {STATUS_LABEL[r.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
