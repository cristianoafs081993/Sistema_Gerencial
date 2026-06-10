import { useEffect } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { SetupPasswordPanel } from '@/components/auth/SetupPasswordPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { AUTH_INVITE_MODE, AUTH_RECOVERY_MODE, normalizeAuthMode, normalizeNextPath } from '@/lib/auth';
import { APP_BRAND } from '@/lib/brand';

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
      : 'Entre com e-mail e senha ou via SUAP.';

  const panelTitle = isInviteMode
    ? 'Senha do primeiro acesso'
    : requiresPasswordSetup
      ? 'Nova senha'
      : 'Entrar';

  const panelDescription = isInviteMode
    ? 'Crie uma senha com pelo menos 8 caracteres.'
    : requiresPasswordSetup
      ? 'Crie uma senha com pelo menos 8 caracteres.'
      : 'Informe seus dados de acesso.';

  const passwordSetupStatus = isInviteMode
    ? session?.user.email
      ? `Convite validado para ${session.user.email}.`
      : 'Convite validado.'
    : 'Sessão validada.';

  const handlePasswordSetupSuccess = () => {
    navigate(nextPath, { replace: true });
  };

  return (
    <main className="grid grid-cols-1 md:grid-cols-12 min-h-screen bg-background text-foreground font-ui">
      {/* Left Column: Visual Brand side for Desktop */}
      <div className="md:col-span-5 lg:col-span-6 xl:col-span-7 hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#0b2414] via-[#144722] to-[#237d39] text-white relative overflow-hidden">
        {/* Glows and Grids */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent)] pointer-events-none" />
        <div className="absolute -left-16 -top-16 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-emerald-300/15 blur-3xl pointer-events-none" />
        
        {/* Top Branding Spacer */}
        <div className="h-10 z-10" />

        {/* Hero message & metrics */}
        <div className="space-y-8 max-w-xl z-10">
          <div className="space-y-4">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white drop-shadow-sm">
              Gestão Orçamentária & Financeira
            </h2>
            <p className="text-emerald-100/90 text-base lg:text-lg leading-relaxed font-medium">
              Controle unificado de despesas, restos a pagar (RAP), contratos e licitações com o apoio de inteligência artificial.
            </p>
          </div>

          {/* Premium Glassmorphic Feature Highlight Cards */}
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <RefreshCw className="h-5 w-5 animate-[spin_8s_linear_infinite]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white tracking-wide">Integração Automática</h3>
                <p className="text-xs text-emerald-100/80 leading-relaxed font-medium">
                  Sincronização contínua de contratos e atas de registro de preços via Comprasnet/PNCP.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white tracking-wide">Inteligência Artificial</h3>
                <p className="text-xs text-emerald-100/80 leading-relaxed font-medium">
                  Elaboração ágil de ETP, Termos de Referência e minutas com suporte inteligente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer brand info */}
        <div className="text-xs text-emerald-200/80 font-medium z-10">
          {APP_BRAND.name} v3.0 • IFRN Campus Currais Novos
        </div>
      </div>

      {/* Right Column: Authentication Card form */}
      <div className="md:col-span-7 lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-16 bg-[radial-gradient(120%_120%_at_50%_10%,#ffffff_50%,rgba(47,158,65,0.03)_100%)] relative">
        <div className="mx-auto w-full max-w-md space-y-8">


          <div className="relative">
            {isLoading ? (
              <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)] bg-white/80 backdrop-blur-sm">
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
                <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)] bg-white/80 backdrop-blur-sm">
                  <CardContent className="space-y-5 py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-semibold text-foreground">Login confirmado</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {session.user.email ? `Sessão activa para ${session.user.email}.` : 'Sessão ativa.'}
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
        </div>
      </div>
    </main>
  );
}
