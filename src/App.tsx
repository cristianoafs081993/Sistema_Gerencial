import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { atasModuleConfig } from '@/lib/atas-config';

const AuthPage = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Atividades = lazy(() => import('./pages/Atividades'));
const Descentralizacoes = lazy(() => import('./pages/Descentralizacoes'));
const Empenhos = lazy(() => import('./pages/Empenhos'));
const Contratos = lazy(() => import('./pages/Contratos'));
const LiquidacoesPagamentos = lazy(() => import('./pages/LiquidacoesPagamentos'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const LCPage = lazy(() => import('./pages/LC'));
const RetencoesEfdReinfPage = lazy(() => import('./pages/RetencoesFdReinfDesign'));
const RastreabilidadePFs = lazy(() => import('./pages/RastreabilidadePFs'));
const ConciliacaoPfs = lazy(() => import('./pages/ConciliacaoPfs'));
const GeradorDocumentos = lazy(() => import('./pages/GeradorDocumentos'));
const EditorDocumentos = lazy(() => import('./pages/EditorDocumentos'));
const Consultor = lazy(() => import('./pages/ConsultorSessions'));
const Suap = lazy(() => import('./pages/Suap'));
const DesignSystemPreview = lazy(() => import('./pages/DesignSystemPreview'));
const AtasAdesao = lazy(() => import('./pages/AtasAdesao'));
const AtasPesquisaPrecos = lazy(() => import('./pages/AtasPesquisaPrecos'));
const AtasObservabilidade = lazy(() => import('./pages/AtasObservabilidade'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      Carregando modulo...
    </div>
  </div>
);

const AppShell = () => (
  <DataProvider>
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  </DataProvider>
);

const PublicShell = () => (
  <Layout>
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  </Layout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<PublicShell />}>
                <Route path="/consultor" element={<Consultor />} />
              </Route>
              <Route element={<AppShell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/atividades" element={<Atividades />} />
                <Route path="/descentralizacoes" element={<Descentralizacoes />} />
                <Route path="/empenhos" element={<Empenhos />} />
                <Route path="/contratos" element={<Contratos />} />
                <Route path="/liquidacoes-pagamentos" element={<LiquidacoesPagamentos />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/lc" element={<LCPage />} />
                <Route path="/retencoes-efd-reinf" element={<RetencoesEfdReinfPage />} />
                <Route path="/rastreabilidade-pfs" element={<RastreabilidadePFs />} />
                <Route path="/conciliacao-pfs" element={<ConciliacaoPfs />} />
                <Route path="/gerador-documentos" element={<GeradorDocumentos />} />
                <Route path="/editor-documentos" element={<EditorDocumentos />} />
                <Route path="/suap" element={<Suap />} />
                <Route path="/design-system-preview" element={<DesignSystemPreview />} />
                {atasModuleConfig.enabled && (
                  <>
                    <Route path="/atas/adesao" element={<AtasAdesao />} />
                    <Route path="/atas/pesquisa-precos" element={<AtasPesquisaPrecos />} />
                    <Route path="/atas/observabilidade" element={<AtasObservabilidade />} />
                  </>
                )}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
