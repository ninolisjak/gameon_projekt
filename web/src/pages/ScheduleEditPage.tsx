import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { getVenue } from '../services/venueService';
import { listSchedule, addSlot, updateSlot, deleteSlot } from '../services/scheduleService';
import type { ScheduleSlot, Venue } from '../types/models';
import { WEEKDAY_LABELS } from '../types/models';

export default function ScheduleEditPage() {
  const { id } = useParams<{ id: string }>();
  const [venue, setVenue] = React.useState<Venue | null>(null);
  const [slots, setSlots] = React.useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [newWeekday, setNewWeekday] = React.useState(1);
  const [newStart, setNewStart] = React.useState('18:00');
  const [newEnd, setNewEnd] = React.useState('19:00');
  const [newPrice, setNewPrice] = React.useState(30);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [v, s] = await Promise.all([getVenue(id), listSchedule(id)]);
    setVenue(v);
    setSlots(s);
    setLoading(false);
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    if (newStart >= newEnd) {
      setError('Konec mora biti za začetkom.');
      return;
    }
    try {
      await addSlot(id, {
        weekday: newWeekday,
        startHHMM: newStart,
        endHHMM: newEnd,
        pricePerSlot: newPrice,
        active: true,
      });
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Dodajanje ni uspelo.');
    }
  }

  async function handleToggle(slot: ScheduleSlot) {
    if (!id) return;
    await updateSlot(id, slot.id, { active: !slot.active });
    await load();
  }

  async function handleDelete(slotId: string) {
    if (!id || !confirm('Izbrišem termin?')) return;
    await deleteSlot(id, slotId);
    await load();
  }

  if (loading) return <div className="text-neutral-400">Nalaganje...</div>;
  if (!venue) return <div className="text-neutral-400">Igrišče ne obstaja.</div>;

  return (
    <div>
      <div className="mb-6">
        <Link to="/venues" className="text-sm text-neutral-400 hover:text-white">← Nazaj na igrišča</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Termini · {venue.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">Določi tedenske termine in cene. Igralci jih bodo videli ob rezervaciji.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-500">Tedenski razpored</h2>

          {slots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center">
              <p className="text-sm text-neutral-400">Ni terminov. Dodaj prvi termin ob strani.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {WEEKDAY_LABELS.map((label, weekday) => {
                const daySlots = slots.filter(s => s.weekday === weekday);
                if (daySlots.length === 0) return null;
                return (
                  <div key={weekday} className="rounded-xl border border-neutral-800 p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-brand">{label}</div>
                    <div className="space-y-2">
                      {daySlots.map(s => (
                        <div key={s.id} className={`flex items-center gap-3 rounded-lg p-2 ${s.active ? 'bg-neutral-800' : 'bg-neutral-800/50 opacity-60'}`}>
                          <div className="font-mono text-sm font-semibold text-white">
                            {s.startHHMM} – {s.endHHMM}
                          </div>
                          <div className="text-sm text-brand font-semibold">{s.pricePerSlot} €</div>
                          <div className="flex-1" />
                          <button
                            onClick={() => handleToggle(s)}
                            className={`text-xs px-2 py-1 rounded ${s.active ? 'bg-green-500/15 text-green-400' : 'bg-neutral-700 text-neutral-400'}`}
                          >
                            {s.active ? 'Aktivno' : 'Neaktivno'}
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Izbriši
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleAdd} className="h-fit rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Dodaj termin</h2>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-400">Dan</label>
            <select
              value={newWeekday}
              onChange={e => setNewWeekday(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white"
            >
              {WEEKDAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-neutral-400">Začetek</label>
              <input
                type="time"
                value={newStart}
                onChange={e => setNewStart(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-neutral-400">Konec</label>
              <input
                type="time"
                value={newEnd}
                onChange={e => setNewEnd(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-neutral-400">Cena (€)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={newPrice}
              onChange={e => setNewPrice(parseFloat(e.target.value || '0'))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white"
            />
          </div>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            className="w-full rounded-lg bg-brand py-2 font-semibold text-neutral-900 hover:bg-brand-light"
          >
            + Dodaj termin
          </button>
        </form>
      </div>
    </div>
  );
}
