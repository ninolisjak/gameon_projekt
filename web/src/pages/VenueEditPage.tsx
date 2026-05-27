import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVenue, createVenue, updateVenue } from '../services/venueService';
import MapPicker from '../components/MapPicker';
import type { Sport, Venue } from '../types/models';

const SPORTS: { value: Sport; label: string }[] = [
  { value: 'futsal', label: 'Futsal' },
  { value: 'basketball', label: 'Košarka' },
  { value: 'both', label: 'Oba' },
];

export default function VenueEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { ownerProfile } = useAuth();

  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [sport, setSport] = React.useState<Sport>('futsal');
  const [locationName, setLocationName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [lat, setLat] = React.useState(46.5547);
  const [lng, setLng] = React.useState(15.6459);
  const [imageUrl, setImageUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [totalSpots, setTotalSpots] = React.useState(10);
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    getVenue(id!).then(v => {
      if (cancelled || !v) return;
      setName(v.name);
      setSport(v.sport);
      setLocationName(v.location.name);
      setAddress(v.location.address ?? '');
      setLat(v.location.lat);
      setLng(v.location.lng);
      setImageUrl(v.imageUrl ?? '');
      setDescription(v.description ?? '');
      setTotalSpots(v.totalSpots);
      setActive(v.active);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, isNew]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerProfile) return;
    setError(null);
    if (!name.trim() || !locationName.trim()) {
      setError('Ime in lokacija sta obvezni.');
      return;
    }
    setSaving(true);
    try {
      const data: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'> = {
        ownerId: ownerProfile.uid,
        name: name.trim(),
        sport,
        location: { lat, lng, name: locationName.trim(), address: address.trim() || '' },
        imageUrl: imageUrl.trim() || '',
        description: description.trim() || '',
        totalSpots,
        active,
      };
      if (isNew) {
        const newId = await createVenue(data);
        navigate(`/venues/${newId}/schedule`);
      } else {
        await updateVenue(id!, data);
        navigate('/venues');
      }
    } catch (err: any) {
      setError(err.message ?? 'Shranjevanje ni uspelo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-neutral-400">Nalaganje...</div>;

  return (
    <div>
      <div className="mb-6">
        <Link to="/venues" className="text-sm text-neutral-400 hover:text-white">← Nazaj na seznam</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{isNew ? 'Novo igrišče' : 'Uredi igrišče'}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Osnove</h2>
          <Field label="Ime igrišča">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="input"
              placeholder="npr. Športni center Tabor"
            />
          </Field>
          <Field label="Šport">
            <div className="flex gap-2">
              {SPORTS.map(s => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setSport(s.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    sport === s.value
                      ? 'border-brand bg-brand/15 text-brand'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Število mest">
            <input
              type="number"
              min={2}
              max={30}
              value={totalSpots}
              onChange={e => setTotalSpots(Math.max(2, Math.min(30, parseInt(e.target.value || '10', 10))))}
              className="input"
            />
          </Field>
          <Field label="Opis (opcijsko)">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="input"
              placeholder="Pokrita dvorana, parket, tuš..."
            />
          </Field>
          <Field label="URL slike (opcijsko)">
            <input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="input"
              placeholder="https://..."
            />
          </Field>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-sm text-white">Aktivno (vidno v aplikaciji)</span>
          </label>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Lokacija</h2>
          <Field label="Ime lokacije">
            <input
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              required
              className="input"
              placeholder="npr. Mariborska športna dvorana"
            />
          </Field>
          <Field label="Naslov (opcijsko)">
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="input"
              placeholder="Ulica 1, Maribor"
            />
          </Field>
          <Field label={`Koordinate (klikni na zemljevid): ${lat.toFixed(5)}, ${lng.toFixed(5)}`}>
            <MapPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
          </Field>
        </div>

        {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-neutral-900 hover:bg-brand-light disabled:opacity-50"
          >
            {saving ? 'Shranjujem...' : isNew ? 'Ustvari in nadaljuj' : 'Shrani spremembe'}
          </button>
          <Link
            to="/venues"
            className="rounded-lg border border-neutral-700 px-5 py-2.5 font-semibold text-neutral-300 hover:bg-neutral-800"
          >
            Prekliči
          </Link>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #404040;
          background: #262626;
          padding: 0.625rem 0.75rem;
          color: white;
          font-size: 0.875rem;
        }
        .input:focus { outline: none; border-color: #eab308; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-neutral-400">{label}</label>
      {children}
    </div>
  );
}
