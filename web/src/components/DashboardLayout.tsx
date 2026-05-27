import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/venues', label: 'Igrišča' },
  { to: '/reservations', label: 'Rezervacije' },
  { to: '/revenue', label: 'Prihodki' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { ownerProfile } = useAuth();

  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="hidden md:flex w-64 flex-col border-r border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-neutral-900 font-black">G</div>
          <div>
            <div className="text-sm font-bold">GameOn</div>
            <div className="text-xs text-neutral-500">Konzola</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand/15 text-brand'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-neutral-800 pt-4">
          <div className="px-3 mb-2">
            <div className="text-sm font-semibold text-white truncate">{ownerProfile?.displayName ?? 'Lastnik'}</div>
            <div className="text-xs text-neutral-500 truncate">{ownerProfile?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            Odjava
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
