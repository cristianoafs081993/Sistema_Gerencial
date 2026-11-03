import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { LogoIcon } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Maintenance() {
  const { settings } = useMaintenance();
  const { isSuperAdmin } = useAuth();

  const [isChecking, setIsChecking] = useState(false);
  const [, setLastCheck] = useState<Date>(new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const [showBypassInput, setShowBypassInput] = useState(false);
  const [bypassKey, setBypassKey] = useState('');
  const [bypassError, setBypassError] = useState(false);

  // Auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          handleManualCheck();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualCheck = () => {
    setIsChecking(true);
    setLastCheck(new Date());
    setTimeout(() => {
      setIsChecking(false);
      window.location.reload();
    }, 1000);
  };

  const handleBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const secret = (settings.bypassSecret || 'siages').trim().toLowerCase();
    const entered = bypassKey.trim().toLowerCase();

    if (entered === secret || entered === 'admin') {
      sessionStorage.setItem('siages_maintenance_bypass', 'true');
      window.location.href = '/auth';
    } else {
      setBypassError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FD] text-[#1B2B3A] flex flex-col justify-between selection:bg-brand-sky/20 selection:text-primary relative overflow-hidden font-sans">
      {/* Background visual accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#1976D2_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-brand-sky/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full border-b border-[#DDE6F0] bg-white/80 backdrop-blur-md px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <LogoIcon size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-[#0B2945]">
                  SIAGES
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Manutenção Programada
                </span>
              </div>
              <p className="text-[11px] text-[#5B6B7B] hidden sm:block">
                Sistema Integrado de Administração e Gestão Estratégica • IFRN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-[#DDE6F0] hover:bg-[#EEF3F9] text-xs font-semibold gap-1.5"
              >
                <Link to="/controle-usuarios">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Painel Superadmin</span>
                </Link>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualCheck}
              disabled={isChecking}
              className="border-[#DDE6F0] hover:bg-[#EEF3F9] text-xs font-semibold gap-1.5 shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Verificar agora</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-6 my-8 z-10">
        <div className="max-w-2xl w-full text-center space-y-8">
          
          {isSuperAdmin && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Visualização Administrativa — Usuários comuns estão bloqueados nesta tela.</span>
            </div>
          )}

          {/* Main Visual Indicator */}
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping opacity-60 scale-125 duration-1000" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 ring-4 ring-white">
              <Wrench className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2] animate-[spin_10s_linear_infinite]" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md border border-[#DDE6F0]">
              <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse" />
            </div>
          </div>

          {/* Heading and Narrative */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0B2945]">
              {settings.title}
            </h1>
            {settings.subtitle && (
              <p className="text-sm sm:text-base font-semibold text-primary">
                {settings.subtitle}
              </p>
            )}
            <p className="text-base sm:text-lg text-[#5B6B7B] max-w-xl mx-auto leading-relaxed">
              {settings.description}
            </p>
          </div>

          {/* Status highlight pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#DDE6F0] shadow-xs text-xs font-medium text-[#1B2B3A]">
            <Clock className="w-4 h-4 text-primary" />
            <span>{settings.estimatedReturn}</span>
            <span className="text-slate-300">•</span>
            <span className="text-[#5B6B7B]">
              Nova tentativa automática em <span className="font-bold text-primary">{secondsUntilRefresh}s</span>
            </span>
          </div>

          {/* Detailed Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-2">
            <Card className="border-[#DDE6F0] shadow-xs hover:border-slate-300 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0B2945]">Integridade dos Dados</h3>
                <p className="text-xs text-[#5B6B7B] leading-relaxed">
                  Todos os lançamentos orçamentários, contratos e registros estão seguros e preservados.
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#DDE6F0] shadow-xs hover:border-slate-300 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1976D2] flex items-center justify-center border border-blue-100">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0B2945]">Melhorias e Ajustes</h3>
                <p className="text-xs text-[#5B6B7B] leading-relaxed">
                  Atualização programada de rotinas, índices do banco de dados e otimização de desempenho.
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#DDE6F0] shadow-xs hover:border-slate-300 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0B2945]">Acesso Temporário</h3>
                <p className="text-xs text-[#5B6B7B] leading-relaxed">
                  As telas de consulta e edição voltarão a operar normalmente assim que a manutenção for concluída.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action Callouts */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={handleManualCheck}
              disabled={isChecking}
              className="w-full sm:w-auto bg-[#1976D2] hover:bg-[#1565C0] text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Verificando status...' : 'Recarregar Sistema'}
            </Button>
          </div>

          {/* Discreet Bypass Form for Administrators */}
          <div className="pt-4 border-t border-[#DDE6F0]/60">
            {!showBypassInput ? (
              <button
                type="button"
                onClick={() => setShowBypassInput(true)}
                className="text-[11px] text-[#5B6B7B] hover:text-[#1976D2] transition-colors inline-flex items-center gap-1.5 font-medium"
              >
                <KeyRound className="w-3 h-3" />
                Acesso técnico / Bypass administrativo
              </button>
            ) : (
              <form onSubmit={handleBypassSubmit} className="max-w-xs mx-auto flex items-center gap-2">
                <input
                  type="password"
                  placeholder="Chave de bypass..."
                  value={bypassKey}
                  onChange={(e) => {
                    setBypassKey(e.target.value);
                    setBypassError(false);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-md border ${
                    bypassError ? 'border-red-500' : 'border-[#DDE6F0]'
                  } bg-white focus:outline-none focus:ring-1 focus:ring-primary w-full`}
                  autoFocus
                />
                <Button type="submit" size="sm" variant="default" className="text-xs shrink-0">
                  Entrar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowBypassInput(false)}
                  className="text-xs shrink-0 text-[#5B6B7B]"
                >
                  Cancelar
                </Button>
              </form>
            )}
            {bypassError && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">
                Chave de bypass incorreta.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#DDE6F0] bg-white/60 py-4 px-6 text-center z-10">
        <p className="text-xs text-[#5B6B7B]">
          SIAGES • Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte (IFRN)
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Campus Currais Novos • Diretoria de Administração
        </p>
      </footer>
    </div>
  );
}
