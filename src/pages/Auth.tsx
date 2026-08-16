import { useEffect } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { SetupPasswordPanel } from '@/components/auth/SetupPasswordPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { AUTH_INVITE_MODE, AUTH_RECOVERY_MODE, normalizeAuthMode, normalizeNextPath } from '@/lib/auth';
import { LogoIcon } from '@/components/Logo';

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
      <div className="md:col-span-5 lg:col-span-6 xl:col-span-7 hidden md:flex flex-col justify-between p-12 bg-[#0B1538] text-white relative overflow-hidden">
        <img
          src="/login-finance-background.jpg"
          alt=""
          aria-hidden="true"
          data-testid="auth-visual-background"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-30 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B1538]/95 via-[#1A2B66]/85 to-[#0056C3]/45 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_45%)] pointer-events-none" />
        <div className="absolute -left-16 -top-16 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        
        {/* Top Branding Logo */}
        <div className="flex items-center gap-3 z-10 select-none">
          <LogoIcon size={34} />
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-none text-white flex items-center gap-1.5 m-0">
              SUAP <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">IFRN</span>
            </h1>
            <p className="text-[10px] text-slate-300 tracking-wider m-0 mt-0.5">Sistema Unificado de Administração Pública</p>
          </div>
        </div>

        {/* Hero message & metrics */}
        <div className="space-y-10 max-w-lg z-10">
          <div className="space-y-4">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white drop-shadow-sm">
              Administração & Gestão Estratégica
            </h2>
            <p className="text-slate-300/90 text-sm lg:text-base leading-relaxed font-medium">
              Plataforma integrada para planejamento, conformidade regulatória e otimização dos fluxos de gestão pública.
            </p>
          </div>

          {/* Refined Minimalist Feature Highlight Bullets */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-primary-foreground transition-all duration-300 group-hover:bg-white/15">
                <RefreshCw className="h-5 w-5 animate-[spin_12s_linear_infinite]" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Integração de Sistemas Administrativos</h3>
                <p className="text-xs text-slate-300/80 leading-relaxed">
                  Centralização de registros provenientes do PNCP, SUAP e faturas de consumo em uma única interface, garantindo a integridade da informação.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-primary-foreground transition-all duration-300 group-hover:bg-white/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Automação e Padronização Documental</h3>
                <p className="text-xs text-slate-300/80 leading-relaxed">
                  Geração automatizada de Estudos Técnicos Preliminares (ETP), Termos de Referência e despachos oficiais, reduzindo o tempo de tramitação processual.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer brand info */}
        <div className="text-xs text-slate-400 font-medium z-10">
          SUAP Design System • IFRN Campus Currais Novos
        </div>
      </div>

      {/* Right Column: Authentication Card form */}
      <div className="md:col-span-7 lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-16 bg-background relative">
        <div className="mx-auto w-full max-w-md space-y-8">
          
          {/* Mobile-only branding logo */}
          <div className="flex md:hidden items-center justify-center gap-3 mb-6 select-none">
            <LogoIcon size={38} />
            <div>
              <h1 className="font-bold text-xl tracking-tight leading-none text-foreground flex items-center gap-1.5 m-0">
                SUAP <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">IFRN</span>
              </h1>
              <p className="text-[10px] text-muted-foreground tracking-wider m-0 mt-0.5">Sistema Unificado de Administração Pública</p>
            </div>
          </div>

          <div className="relative">
            {isLoading ? (
              <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(26,43,102,0.06)] bg-white/80 backdrop-blur-sm">
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
                <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(26,43,102,0.06)] bg-white/80 backdrop-blur-sm">
                  <CardContent className="space-y-5 py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2f9e41]/10 text-[#2f9e41]">
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
        </div>
      </div>
    </main>
  );
}
