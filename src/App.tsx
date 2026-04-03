import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/contexts/DataContext";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import Atividades from "./pages/Atividades";
import Descentralizacoes from "./pages/Descentralizacoes";
import Empenhos from "./pages/Empenhos";
import NotFound from "./pages/NotFound";

import Contratos from "./pages/Contratos";
import LiquidacoesPagamentos from "./pages/LiquidacoesPagamentos";
import Financeiro from "./pages/Financeiro";
import LCPage from "./pages/LC";
import RetencoesEfdReinfPage from "./pages/RetencoesEfdReinf";
import RastreabilidadePFs from "./pages/RastreabilidadePFs";
import ConciliacaoPfs from "./pages/ConciliacaoPfs";
import GeradorDocumentos from "./pages/GeradorDocumentos";
import EditorDocumentos from "./pages/EditorDocumentos";
import Consultor from "./pages/Consultor";
import DesignSystemPreview from "./pages/DesignSystemPreview";
import Suap from "./pages/Suap";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DataProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
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
          </Layout>
        </BrowserRouter>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
