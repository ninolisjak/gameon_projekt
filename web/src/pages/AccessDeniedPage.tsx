import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Dostop zavrnjen</h1>
        <p className="text-neutral-400 mb-6">
          Ta račun nima vloge lastnika igrišča. Spletna konzola je samo za lastnike.
        </p>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-neutral-900 hover:bg-brand-light"
        >
          Odjavi se
        </button>
      </div>
    </div>
  );
}
