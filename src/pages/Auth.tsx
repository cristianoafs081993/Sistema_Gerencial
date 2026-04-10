import { useEffect } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { SetupPasswordPanel } from '@/components/auth/SetupPasswordPanel';
import { Badge } from '@/components/ui/badge';
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

  const authBadgeLabel = isInviteMode
    ? 'Convite Supabase'
    : requiresPasswordSetup
      ? 'Recuperacao de acesso'
      : 'Autenticacao Supabase';

  const authTitle = isInviteMode
    ? 'Conclua o convite definindo a sua senha de acesso.'
    : requiresPasswordSetup
      ? 'Defina uma nova senha para recuperar o acesso ao sistema.'
      : 'Entre com e-mail e senha para acessar o sistema.';

  const authDescription = isInviteMode
    ? 'O convite do Supabase ja validou a sua identidade. Falta apenas definir a senha que sera usada nos proximos logins.'
    : requiresPasswordSetup
      ? 'Depois de atualizar a senha, o acesso continua protegido pela mesma sessao persistente do Supabase.'
      : 'A autenticacao agora e centralizada no Supabase Auth com sessao persistente. Depois do login, todas as rotas do app passam a usar a mesma sessao.';

  const panelTitle = isInviteMode
    ? 'Definir senha do primeiro acesso'
    : requiresPasswordSetup
      ? 'Criar nova senha'
      : 'Entrar no Sistema Gerencial';

  const panelDescription = isInviteMode
    ? 'Use o convite recebido por e-mail para concluir o cadastro com uma senha definitiva.'
    : requiresPasswordSetup
      ? 'Atualize a senha da sua conta para voltar a acessar o Sistema Gerencial.'
      : 'Use seu e-mail e senha cadastrados no Supabase para abrir o Sistema Gerencial.';

  const handlePasswordSetupSuccess = () => {
    navigate(nextPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(47,103,216,0.12),transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#ffffff_100%)] px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-[0_30px_120px_rgba(15,23,42,0.14)] backdrop-blur md:grid md:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden border-b border-slate-200/70 px-6 py-8 md:border-b-0 md:border-r md:px-10 md:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(47,103,216,0.06),transparent_55%)]" />
          <div className="relative space-y-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">Sistema Gerencial</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Controle orcamentario
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-9 border-white/80 bg-white/80">
                <Link to="/">Voltar</Link>
              </Button>
            </div>

            <div className="space-y-5">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                {authBadgeLabel}
              </Badge>
              <div className="space-y-3">
                <h1 className="max-w-xl font-ui text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                  {authTitle}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                  {authDescription}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Card className="border-slate-200/80 bg-white/80 shadow-sm">
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-900">Sessao unica do app</p>
                    <p className="text-sm leading-6 text-slate-600">
                      A mesma sessao passa a valer para modulos como SUAP e futuros recursos com historico por usuario.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 bg-white/80 shadow-sm">
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-900">Rotas protegidas</p>
                    <p className="text-sm leading-6 text-slate-600">
                      Sem sessao valida, o app redireciona automaticamente para esta tela antes de carregar qualquer modulo.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-8 md:px-10 md:py-12">
          <div className="mx-auto w-full max-w-md">
            {isLoading ? (
              <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
                <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">Validando sessao</p>
                    <p className="text-sm text-slate-500">Aguarde enquanto o Supabase conclui a autenticacao.</p>
                  </div>
                </CardContent>
              </Card>
            ) : session ? (
              requiresPasswordSetup ? (
                <SetupPasswordPanel
                  title={panelTitle}
                  description={panelDescription}
                  submitLabel={isInviteMode ? 'Concluir cadastro' : 'Atualizar senha'}
                  onSuccess={handlePasswordSetupSuccess}
                />
              ) : (
                <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
                  <CardContent className="space-y-5 py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-semibold text-slate-900">Login confirmado</p>
                      <p className="text-sm leading-6 text-slate-500">
                        {session.user.email ? `Sessao ativa para ${session.user.email}.` : 'Sessao ativa no Supabase.'}
                      </p>
                      <p className="text-sm font-medium text-primary">Redirecionando para o sistema...</p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <Button asChild className="sm:min-w-[180px]">
                        <Link to={nextPath}>Continuar</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <AuthPanel title={panelTitle} description={panelDescription} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
