import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppSplash } from '@/components/design-system/AppSplash';
import { useAuth } from '@/contexts/AuthContext';
import { appScreens } from '@/lib/appScreens';
import { buildAuthRoute } from '@/lib/auth';
import { APP_BRAND } from '@/lib/brand';

function getFirstAllowedPath(screenAccessIds: string[], userGroups: Array<{ slug: string }>) {
  if (userGroups.some((group) => group.slug === 'terceirizado')) {
    return '/requisicao-compra';
  }

  const allowedIds = new Set(screenAccessIds);
  return appScreens.find((screen) => allowedIds.has(screen.id))?.path;
}

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading, isAccessLoading, accessError, canAccessPath, screenAccessIds, userGroups } = useAuth();

  if (isLoading || (isAuthenticated && isAccessLoading)) {
    return (
      <AppSplash
        label="Validando sessão"
        description={`O ${APP_BRAND.name} está confirmando sua autenticação e permissões.`}
      />
    );
  }

  if (!isAuthenticated) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildAuthRoute(nextPath)} replace />;
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-white px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-xl border border-border-default bg-white px-8 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-lg font-bold text-foreground">Não foi possível carregar suas permissões</p>
              <p className="text-sm leading-6 text-muted-foreground">{accessError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccessPath(location.pathname)) {
    const isTerceirizado = userGroups.some((group) => group.slug === 'terceirizado');
    const firstAllowedPath = isTerceirizado || location.pathname === '/'
      ? getFirstAllowedPath(screenAccessIds, userGroups)
      : undefined;
    if (firstAllowedPath && firstAllowedPath !== location.pathname) {
      return <Navigate to={firstAllowedPath} replace />;
    }

    return (
      <div className="min-h-screen bg-white px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-xl border border-border-default bg-white px-8 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-lg font-bold text-foreground">Acesso restrito</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Seu grupo de usuários não possui permissão para acessar esta tela.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
