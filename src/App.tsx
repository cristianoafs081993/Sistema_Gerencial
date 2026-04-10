import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/contexts/DataContext";
import { Layout } from "@/components/Layout";
import { atasModuleConfig } from "@/lib/atas-config";

const queryClient = new QueryClient();

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Atividades = lazy(() => import("./pages/Atividades"));
const Descentralizacoes = lazy(() => import("./pages/Descentralizacoes"));
const Empenhos = lazy(() => import("./pages/Empenhos"));
const Contratos = lazy(() => import("./pages/Contratos"));
const LiquidacoesPagamentos = lazy(() => import("./pages/LiquidacoesPagamentos"));
const RastreabilidadePFs = lazy(() => import("./pages/RastreabilidadePFs"));
const ConciliacaoPfs = lazy(() => import("./pages/ConciliacaoPfs"));
const GeradorDocumentos = lazy(() => import("./pages/GeradorDocumentos"));
const AtasAdesao = lazy(() => import("./pages/AtasAdesao"));
const AtasPesquisaPrecos = lazy(() => import("./pages/AtasPesquisaPrecos"));
const AtasObservabilidade = lazy(() => import("./pages/AtasObservabilidade"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      Carregando modulo...
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DataProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/atividades" element={<Atividades />} />
                <Route path="/descentralizacoes" element={<Descentralizacoes />} />
                <Route path="/empenhos" element={<Empenhos />} />
                <Route path="/contratos" element={<Contratos />} />
                <Route path="/liquidacoes-pagamentos" element={<LiquidacoesPagamentos />} />
                <Route path="/rastreabilidade-pfs" element={<RastreabilidadePFs />} />
                <Route path="/conciliacao-pfs" element={<ConciliacaoPfs />} />
                <Route path="/gerador-documentos" element={<GeradorDocumentos />} />
                {atasModuleConfig.enabled && (
                  <>
                    <Route path="/atas/adesao" element={<AtasAdesao />} />
                    <Route path="/atas/pesquisa-precos" element={<AtasPesquisaPrecos />} />
                    <Route path="/atas/observabilidade" element={<AtasObservabilidade />} />
                  </>
                )}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </Suspense>
        </BrowserRouter>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
