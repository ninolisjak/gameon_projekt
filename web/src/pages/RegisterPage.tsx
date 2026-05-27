import React from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { ensureOwnerProfile } from '../services/ownerService';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Geslo mora imeti vsaj 6 znakov.');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim()) await updateProfile(cred.user, { displayName: displayName.trim() });
      await ensureOwnerProfile(cred.user.uid, cred.user.email!, displayName.trim() || undefined);
      await refresh();
      navigate('/venues');
    } catch (err: any) {
      setError(err.message ?? 'Registracija ni uspela.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-neutral-900 text-2xl font-black">G</div>
          <h1 className="mt-4 text-2xl font-bold text-white">Registracija lastnika</h1>
          <p className="mt-1 text-sm text-neutral-400">Ustvari račun in dodaj svoja igrišča</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-400">Ime / podjetje</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500 focus:border-brand focus:outline-none"
              placeholder="Športni center Tabor"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-400">Geslo</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white focus:border-brand focus:outline-none"
              placeholder="Najmanj 6 znakov"
            />
          </div>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-semibold text-neutral-900 hover:bg-brand-light disabled:opacity-50"
          >
            {loading ? 'Ustvarjanje...' : 'Ustvari račun'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-400">
          Že imaš račun?{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">Prijava</Link>
        </p>
      </div>
    </div>
  );
}
