import { Loader2, ShieldCheck } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { buildAuthRoute } from '@/lib/auth';

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#ffffff_100%)] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-[28px] border border-white/80 bg-white/90 px-8 py-12 text-center shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-lg font-semibold text-slate-900">Validando sessao</p>
              <p className="text-sm leading-6 text-slate-500">
                O Sistema Gerencial esta confirmando sua autenticacao com o Supabase.
              </p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sessao persistente habilitada
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildAuthRoute(nextPath)} replace />;
  }

  return <Outlet />;
}
