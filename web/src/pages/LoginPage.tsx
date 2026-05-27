import React from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/venues');
    } catch (err: any) {
      setError(err.message ?? 'Prijava ni uspela.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-neutral-900 text-2xl font-black">G</div>
          <h1 className="mt-4 text-2xl font-bold text-white">GameOn Konzola</h1>
          <p className="mt-1 text-sm text-neutral-400">Prijava za lastnike igrišč</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500 focus:border-brand focus:outline-none"
              placeholder="ime@primer.si"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-400">Geslo</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500 focus:border-brand focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-semibold text-neutral-900 hover:bg-brand-light disabled:opacity-50"
          >
            {loading ? 'Prijava...' : 'Prijavi se'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-400">
          Še nimaš računa?{' '}
          <Link to="/register" className="font-semibold text-brand hover:underline">Registracija</Link>
        </p>
      </div>
    </div>
  );
}
