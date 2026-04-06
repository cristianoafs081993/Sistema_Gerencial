import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DataProvider } from '@/contexts/DataContext';

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
const Consultor = lazy(() => import('./pages/Consultor'));
const Suap = lazy(() => import('./pages/Suap'));
const DesignSystemPreview = lazy(() => import('./pages/DesignSystemPreview'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DataProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Layout>
            <Suspense fallback={null}>
              <Routes>
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
                <Route path="/consultor" element={<Consultor />} />
                <Route path="/suap" element={<Suap />} />
                <Route path="/design-system-preview" element={<DesignSystemPreview />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
