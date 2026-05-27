import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, ownerProfile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Nalaganje...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!ownerProfile || ownerProfile.role !== 'owner') {
    return <Navigate to="/access-denied" replace />;
  }
  return <>{children}</>;
}
