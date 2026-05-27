import React from 'react';
import { useAuth } from '../context/AuthContext';
import { listReservationsForOwner, aggregateRevenue, RevenuePoint } from '../services/reservationService';
import type { Reservation } from '../types/models';

export default function RevenuePage() {
  const { ownerProfile } = useAuth();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [granularity, setGranularity] = React.useState<'week' | 'month'>('month');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!ownerProfile) return;
    setLoading(true);
    listReservationsForOwner(ownerProfile.uid)
      .then(setReservations)
      .finally(() => setLoading(false));
  }, [ownerProfile]);

  const points: RevenuePoint[] = React.useMemo(
    () => aggregateRevenue(reservations, granularity),
    [reservations, granularity],
  );
  const totalRevenue = React.useMemo(
    () => reservations.filter(r => r.status !== 'cancelled').reduce((s, r) => s + (r.price ?? 0), 0),
    [reservations],
  );
  const totalCount = reservations.filter(r => r.status !== 'cancelled').length;
  const maxValue = Math.max(1, ...points.map(p => p.total));

  function formatPeriodLabel(period: string): string {
    if (granularity === 'month') {
      const [y, m] = period.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return d.toLocaleDateString('sl-SI', { month: 'short', year: '2-digit' });
    }
    const d = new Date(period);
    return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Prihodki</h1>
        <p className="text-sm text-neutral-400 mt-1">Pregled prihodkov iz vseh tvojih igrišč.</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Skupni prihodek" value={`${totalRevenue.toFixed(2)} €`} sub="Vse rezervacije" />
        <Stat label="Število rezervacij" value={totalCount.toString()} sub="Brez preklicanih" />
        <Stat
          label="Povprečna rezervacija"
          value={totalCount > 0 ? `${(totalRevenue / totalCount).toFixed(2)} €` : '—'}
          sub="Cena na rezervacijo"
        />
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Po obdobjih</h2>
          <div className="flex gap-1 rounded-lg border border-neutral-800 p-1">
            {(['week', 'month'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  granularity === g ? 'bg-brand text-neutral-900' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {g === 'week' ? 'Teden' : 'Mesec'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-neutral-400">Nalaganje...</div>
        ) : points.length === 0 ? (
          <div className="py-12 text-center text-neutral-400">Ni podatkov o prihodkih.</div>
        ) : (
          <div className="space-y-2">
            {points.slice(-12).map(p => (
              <div key={p.period} className="flex items-center gap-3">
                <div className="w-20 text-xs text-neutral-400">{formatPeriodLabel(p.period)}</div>
                <div className="flex-1 h-7 rounded-md bg-neutral-800 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-brand-dark to-brand"
                    style={{ width: `${(p.total / maxValue) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-xs font-semibold text-white drop-shadow">
                      {p.total.toFixed(2)} €
                    </span>
                  </div>
                </div>
                <div className="w-16 text-right text-xs text-neutral-500">{p.count}×</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}
