import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RouteLoadingFallback } from '@/components/design-system/RouteLoadingFallback';
import { Layout } from '@/components/Layout';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';

const AuthPage = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Atividades = lazy(() => import('./pages/Atividades'));
const Descentralizacoes = lazy(() => import('./pages/Descentralizacoes'));
const CreditoDisponivel = lazy(() => import('./pages/CreditoDisponivel'));
const Empenhos = lazy(() => import('./pages/Empenhos'));
const Contratos = lazy(() => import('./pages/Contratos'));
const RequisicaoCompra = lazy(() => import('./pages/RequisicaoCompra'));
const CadastroTerceirizados = lazy(() => import('./pages/CadastroTerceirizados'));
const CadastroFornecedores = lazy(() => import('./pages/CadastroFornecedores'));
const LiquidacoesPagamentos = lazy(() => import('./pages/LiquidacoesPagamentos'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const LCPage = lazy(() => import('./pages/LC'));
const RetencoesEfdReinfPage = lazy(() => import('./pages/RetencoesFdReinfDesign'));
const RastreabilidadePFs = lazy(() => import('./pages/RastreabilidadePFs'));
const ConciliacaoPfs = lazy(() => import('./pages/ConciliacaoPfs'));
const GeradorDocumentos = lazy(() => import('./pages/GeradorDocumentos'));
const EditorDocumentos = lazy(() => import('./pages/EditorDocumentos'));
const ArtefatosLicitacao = lazy(() => import('./pages/ArtefatosLicitacao'));
const PesquisaPrecos = lazy(() => import('./pages/PesquisaPrecos'));
const PriceResearchEad = lazy(() => import('./pages/PriceResearchEad'));
const PriceResearchValidation = lazy(() => import('./pages/PriceResearchValidation'));
const LicitacoesPregoes = lazy(() => import('./pages/LicitacoesPregoes'));
const AtasRegistroPrecos = lazy(() => import('./pages/AtasRegistroPrecos'));
const EnergiaCampus = lazy(() => import('./pages/energia/EnergiaCampus'));
const Consultor = lazy(() => import('./pages/ConsultorSessions'));
const Suap = lazy(() => import('./pages/Suap'));
const SuapCallback = lazy(() => import('./pages/SuapCallback'));
const SuapExtensionDispatch = lazy(() => import('./pages/SuapExtensionDispatch'));
const SuapExtensionProcessInfo = lazy(() => import('./pages/SuapExtensionProcessInfo'));
const SuapExtensionDocumentAnalysis = lazy(() => import('./pages/SuapExtensionDocumentAnalysis'));
const SuapExtensionPlanSummary = lazy(() => import('./pages/SuapExtensionPlanSummary'));
const ComprasnetEtpExtension = lazy(() => import('./pages/ComprasnetEtpExtension'));
const EconomiaTempo = lazy(() => import('./pages/EconomiaTempo'));
const ControleUsuarios = lazy(() => import('./pages/ControleUsuarios'));
const ModelosDocumentos = lazy(() => import('./pages/ModelosDocumentos'));
const DesignSystemPreview = lazy(() => import('./pages/DesignSystemPreview'));
const DashboardCloudscapePreview = lazy(() => import('./pages/DashboardCloudscapePreview'));
const ManutencaoAdmin = lazy(() => import('./pages/ManutencaoAdmin'));
const ImportacaoDados = lazy(() => import('./pages/ImportacaoDados'));
const Almoxarifado = lazy(() => import('./pages/Almoxarifado'));
const ControleOrgaos = lazy(() => import('./pages/ControleOrgaos'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const PublicFeedback = lazy(() => import('./pages/PublicFeedback'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const AppShell = () => (
  <DataProvider>
    <Layout>
      <Suspense fallback={<RouteLoadingFallback mode="content" />}>
        <Outlet />
      </Suspense>
    </Layout>
  </DataProvider>
);

const SuapExtensionShell = () => (
  <DataProvider>
    <Suspense fallback={<RouteLoadingFallback mode="screen" />}>
      <Outlet />
    </Suspense>
  </DataProvider>
);

const SuapExtensionFrameShell = () => (
  <Suspense fallback={<RouteLoadingFallback mode="screen" />}>
    <Outlet />
  </Suspense>
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
          <Suspense fallback={<RouteLoadingFallback mode="screen" />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/feedback-ambiente/:codigo" element={<PublicFeedback />} />
              <Route path="/suap-callback" element={<SuapCallback />} />
              <Route element={<SuapExtensionFrameShell />}>
                <Route path="/suap-extensao/processo-info" element={<SuapExtensionProcessInfo />} />
                <Route path="/suap-extensao/documento-analise" element={<SuapExtensionDocumentAnalysis />} />
                <Route path="/comprasnet-extensao/etp" element={<ComprasnetEtpExtension />} />
              </Route>
              <Route element={<AppShell />}>
                <Route path="/suap" element={<Suap />} />
                <Route path="/pesquisa-precos/validar" element={<PriceResearchValidation />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route element={<SuapExtensionShell />}>
                  <Route path="/suap-extensao/despacho" element={<SuapExtensionDispatch />} />
                </Route>
                <Route path="/suap-extensao/plano-resumo" element={<SuapExtensionPlanSummary />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/atividades/*" element={<Navigate replace to="/planejamento/campus" />} />
                  <Route path="/planejamento" element={<Navigate replace to="/planejamento/campus" />} />
                  <Route path="/planejamento/:scope" element={<Atividades />} />
                  <Route path="/descentralizacoes" element={<Descentralizacoes />} />
                  <Route path="/credito-disponivel" element={<CreditoDisponivel />} />
                  <Route path="/empenhos" element={<Empenhos />} />
                  <Route path="/contratos" element={<Contratos />} />
                  <Route path="/requisicao-compra" element={<RequisicaoCompra />} />
                  <Route path="/cadastro-terceirizados" element={<CadastroTerceirizados />} />
                  <Route path="/liquidacoes-pagamentos" element={<LiquidacoesPagamentos />} />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/lc" element={<LCPage />} />
                  <Route path="/retencoes-efd-reinf" element={<RetencoesEfdReinfPage />} />
                  <Route path="/rastreabilidade-pfs" element={<RastreabilidadePFs />} />
                  <Route path="/conciliacao-pfs" element={<ConciliacaoPfs />} />
                  <Route path="/gerador-documentos" element={<GeradorDocumentos />} />
                  <Route path="/editor-documentos" element={<EditorDocumentos />} />
                  <Route path="/editor-documentos/:modelId" element={<EditorDocumentos />} />
                  <Route path="/artefatos-licitacao" element={<ArtefatosLicitacao />} />
                  <Route path="/pesquisa-precos" element={<PesquisaPrecos />} />
                  <Route path="/pesquisa-precos/ead" element={<PriceResearchEad />} />
                  <Route path="/licitacoes-pregoes" element={<LicitacoesPregoes />} />
                  <Route path="/atas-registro-precos" element={<AtasRegistroPrecos />} />
                  <Route path="/cadastro-fornecedores" element={<CadastroFornecedores />} />
                  <Route path="/energia" element={<EnergiaCampus />} />
                  <Route path="/energia/cosern" element={<EnergiaCampus />} />
                  <Route path="/energia/mercatto" element={<EnergiaCampus />} />
                  <Route path="/energia/geracao-solar" element={<EnergiaCampus />} />
                  <Route path="/energia/contratos" element={<EnergiaCampus />} />
                  <Route path="/energia/financeiro" element={<EnergiaCampus />} />
                  <Route path="/energia/esg" element={<EnergiaCampus />} />
                  <Route path="/consultor" element={<Consultor />} />
                  <Route path="/economia-tempo" element={<EconomiaTempo />} />
                  <Route path="/controle-usuarios" element={<ControleUsuarios />} />
                  <Route path="/modelos-documentos" element={<ModelosDocumentos />} />
                  <Route path="/design-system-preview" element={<DesignSystemPreview />} />
                  <Route path="/dashboard-cloudscape-preview" element={<DashboardCloudscapePreview />} />
                  <Route path="/manutencao" element={<ManutencaoAdmin />} />
                  <Route path="/importacao-dados" element={<ImportacaoDados />} />
                  <Route path="/importacao" element={<Navigate replace to="/importacao-dados" />} />
                  <Route path="/almoxarifado" element={<Almoxarifado />} />
                  {/* Multi-órgão e auditoria — apenas superadmin */}
                  <Route path="/controle-orgaos" element={<ControleOrgaos />} />
                  <Route path="/audit-log" element={<AuditLog />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
