import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listMyVenues, deleteVenue } from '../services/venueService';
import type { Venue } from '../types/models';

export default function VenuesPage() {
  const { ownerProfile } = useAuth();
  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!ownerProfile) return;
    setLoading(true);
    try {
      setVenues(await listMyVenues(ownerProfile.uid));
    } finally {
      setLoading(false);
    }
  }, [ownerProfile]);

  React.useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Izbrišem igrišče "${name}"? Pripadajoči termini se ne bodo več prikazovali.`)) return;
    try {
      await deleteVenue(id);
      await load();
    } catch (e: any) {
      alert(e.message ?? 'Brisanje ni uspelo.');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Moja igrišča</h1>
          <p className="text-sm text-neutral-400 mt-1">Dodaj in upravljaj svoje igrišča.</p>
        </div>
        <Link
          to="/venues/new"
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-neutral-900 hover:bg-brand-light"
        >
          + Dodaj igrišče
        </Link>
      </div>

      {loading ? (
        <div className="text-neutral-400">Nalaganje...</div>
      ) : venues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Še ni igrišč</h3>
          <p className="text-sm text-neutral-400 mb-4">Dodaj svoje prvo igrišče in začni z urejanjem terminov.</p>
          <Link to="/venues/new" className="inline-block rounded-lg bg-brand px-4 py-2 font-semibold text-neutral-900">
            Dodaj prvo igrišče
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {venues.map(v => (
            <div key={v.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              {v.imageUrl ? (
                <img src={v.imageUrl} alt={v.name} className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 w-full bg-neutral-800 flex items-center justify-center">
                  <span className="text-xs uppercase tracking-widest text-neutral-600 font-semibold">
                    {v.sport === 'basketball' ? 'Košarka' : v.sport === 'futsal' ? 'Futsal' : 'Futsal + Košarka'}
                  </span>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white">{v.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${v.active ? 'bg-green-500/15 text-green-400' : 'bg-neutral-700 text-neutral-400'}`}>
                    {v.active ? 'Aktivno' : 'Neaktivno'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-1">{v.location.name}</p>
                <p className="text-xs text-neutral-500 mb-4">
                  {v.sport === 'both' ? 'Futsal + Košarka' : v.sport === 'futsal' ? 'Futsal' : 'Košarka'} · {v.totalSpots} mest
                </p>
                <div className="flex gap-2">
                  <Link
                    to={`/venues/${v.id}`}
                    className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Uredi
                  </Link>
                  <Link
                    to={`/venues/${v.id}/schedule`}
                    className="flex-1 rounded-lg bg-brand/15 px-3 py-2 text-center text-sm font-semibold text-brand hover:bg-brand/25"
                  >
                    Termini
                  </Link>
                  <button
                    onClick={() => handleDelete(v.id, v.name)}
                    className="rounded-lg border border-red-900/50 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    Izbriši
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
