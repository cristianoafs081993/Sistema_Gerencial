import { useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { SetupPasswordPanel } from '@/components/auth/SetupPasswordPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { AUTH_INVITE_MODE, AUTH_RECOVERY_MODE, normalizeAuthMode, normalizeNextPath } from '@/lib/auth';

export default function Auth() {
  const { isLoading, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedNextPath = searchParams.get('next');
  const nextPath = normalizeNextPath(requestedNextPath);
  const authMode = normalizeAuthMode(searchParams.get('mode'));
  const requiresPasswordSetup = authMode === AUTH_INVITE_MODE || authMode === AUTH_RECOVERY_MODE;
  const isInviteMode = authMode === AUTH_INVITE_MODE;

  useEffect(() => {
    if (isLoading || !session || requiresPasswordSetup) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      navigate(nextPath, { replace: true });
    }, 900);

    return () => window.clearTimeout(redirectTimer);
  }, [isLoading, navigate, nextPath, requiresPasswordSetup, session]);

  const authTitle = isInviteMode
    ? 'Defina sua senha'
    : requiresPasswordSetup
      ? 'Crie uma nova senha'
      : 'Acesse sua conta';

  const authDescription = isInviteMode
    ? 'Use o convite recebido por e-mail para concluir o acesso.'
    : requiresPasswordSetup
      ? 'Informe a nova senha para recuperar o acesso.'
      : 'Entre com e-mail e senha.';

  const panelTitle = isInviteMode
    ? 'Senha do primeiro acesso'
    : requiresPasswordSetup
      ? 'Nova senha'
      : 'Entrar';

  const panelDescription = isInviteMode
    ? 'Crie uma senha com pelo menos 8 caracteres.'
    : requiresPasswordSetup
      ? 'Crie uma senha com pelo menos 8 caracteres.'
      : 'Informe os dados de acesso.';

  const passwordSetupStatus = isInviteMode
    ? session?.user.email
      ? `Convite validado para ${session.user.email}.`
      : 'Convite validado.'
    : 'Sessão validada.';

  const handlePasswordSetupSuccess = () => {
    navigate(nextPath, { replace: true });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold text-primary">Sistema Gerencial</p>
          <h1 className="font-ui text-2xl font-bold tracking-tight text-foreground">{authTitle}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{authDescription}</p>
        </div>

        {isLoading ? (
          <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Validando sessão</p>
                <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
              </div>
            </CardContent>
          </Card>
        ) : session ? (
          requiresPasswordSetup ? (
            <SetupPasswordPanel
              title={panelTitle}
              description={panelDescription}
              submitLabel={isInviteMode ? 'Concluir cadastro' : 'Atualizar senha'}
              statusMessage={passwordSetupStatus}
              onSuccess={handlePasswordSetupSuccess}
            />
          ) : (
            <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
              <CardContent className="space-y-5 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-foreground">Login confirmado</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {session.user.email ? `Sessão ativa para ${session.user.email}.` : 'Sessão ativa.'}
                  </p>
                  <p className="text-sm font-medium text-primary">Redirecionando...</p>
                </div>

                <Button asChild className="w-full">
                  <Link to={nextPath}>Continuar</Link>
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          <AuthPanel title={panelTitle} description={panelDescription} />
        )}
      </div>
    </main>
  );
}
