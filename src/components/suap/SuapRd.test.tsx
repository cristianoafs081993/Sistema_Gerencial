import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SuapRdMovements } from './SuapRdMovements';
import { SuapRdSyncCard } from './SuapRdSyncCard';
import { SuapRdMovementBadge } from './SuapRdMovementBadge';
import { suapRdService, type RdMovement, type RdSyncRun } from '@/services/suapRdService';
import type { Empenho } from '@/types';
const state = vi.hoisted(()=>({admin:true}));
vi.mock('@/contexts/AuthContext',()=>({useOptionalAuth:()=>({isSuperAdmin:state.admin,userOrg:{id:'org'},userCampus:{codigo:'158366'}}),useAuth:()=>({isSuperAdmin:state.admin,userOrg:{id:'org'},userCampus:{codigo:'158366'}})}));
vi.mock('@/services/suapRdService',async importOriginal=>({ ...await importOriginal<typeof import('@/services/suapRdService')>(),suapRdService:{ read:vi.fn(),action:vi.fn(),preview:vi.fn().mockResolvedValue([]) } }));
const renderUi=(ui:ReactElement)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{ui}</QueryClientProvider>);
const emp={id:'e',numero:'2026NE000014',valor:150} as Empenho;
const movement={org_id:'org',campus_uasg:'158366',suap_unit_code:'19',run_id:'run',suap_rd_id:'1',rd_numero:'2026RD000001',tipo:'dotacao',rd_situacao:'Concluída',source_url:'https://suap.ifrn.edu.br/plan_estrategico/detalhar_requisicaodespesa/1/',atividade_nome:'Almoxarifado',line_index:1,valor:100,empenho_id:'e',empenho_numero:emp.numero,linha_situacao:'Confirmada',confirmed:true,resolution:'resolvido',captured_at:'2026-10-05T12:00:00Z'} as RdMovement;
const run={id:'run',runId:'run',status:'preview',complete:true,summary:{rds:4,movimentos:3},phase:'ready',sourceCount:4,processed:4,activitiesProcessed:1,activitiesTotal:1} as RdSyncRun;
it('informa reaproveitamento e orienta revalidar tudo sem iniciar coleta no frontend',async()=>{
  const incremental={...run,syncMode:'incremental' as const,reusedDetails:3,refreshedDetails:1,reusedActivities:1};
  vi.mocked(suapRdService.action).mockResolvedValue({...incremental,run:incremental});
  renderUi(<SuapRdSyncCard onSynced={vi.fn()} />);
  expect(await screen.findByText('3 RDs reaproveitadas · 1 relidas · 1 relações de atividades reaproveitadas.')).toBeInTheDocument();
  expect(screen.getByText(/Para reconferir tudo imediatamente/)).toHaveTextContent('reaproveita permanentemente RDs concluídas');
  expect(vi.mocked(suapRdService.action).mock.calls.some(([action])=>action==='sync')).toBe(false);
});
beforeEach(()=>{ vi.clearAllMocks();state.admin=true;vi.mocked(suapRdService.action).mockResolvedValue({ ...run,run:null });vi.mocked(suapRdService.read).mockResolvedValue([]); });
it('mostra reforço e anulação negativa, exclui cancelada dos totais e não duplica linha com conflito',async()=>{
  vi.mocked(suapRdService.read).mockResolvedValue([movement,{...movement,suap_rd_id:'2',rd_numero:'2026RD000002',tipo:'reforco',valor:60},
    {...movement,suap_rd_id:'3',rd_numero:'2026RD000003',tipo:'anulacao',valor:-10},
    {...movement,suap_rd_id:'4',rd_numero:'2026RD000004',tipo:'reforco',valor:5000,confirmed:false,rd_situacao:'Cancelada'},movement]);
  renderUi(<SuapRdMovements empenho={emp} enabled />);
  await screen.findAllByText('Reforço'); await screen.findByText('Anulação');
  expect(screen.getByText('Líquido das RDs:').textContent).toContain('150,00');
  expect(screen.getAllByRole('link')).toHaveLength(4);
  expect(screen.getByText('Não contabilizada nas RDs')).toBeInTheDocument();
  expect(suapRdService.read).toHaveBeenCalledWith('suap_rd_movimentacoes','org','158366','19');
  const negative=screen.getByText('Anulação').closest('tr')!;expect(within(negative).getByText(/-.*10,00/)).toBeInTheDocument();
});
it('não mascara erro de leitura como ausência de movimentos',async()=>{
  vi.mocked(suapRdService.read).mockRejectedValue(new Error('offline'));renderUi(<SuapRdMovements empenho={emp} enabled />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar');
});
it('mostra quantidade na lista e abre o detalhe sem disparar o clique da linha',async()=>{
  vi.mocked(suapRdService.read).mockResolvedValue([{...movement,tipo:'reforco'}, {...movement,tipo:'reforco',line_index:2}, {...movement,suap_rd_id:'2',tipo:'anulacao',valor:-10}]);
  const onOpen=vi.fn(),onRow=vi.fn();renderUi(<div onClick={onRow}><SuapRdMovementBadge empenho={emp} onOpen={onOpen} /></div>);
  fireEvent.click(await screen.findByRole('button',{name:'1 reforço · 1 anulação (RD)'}));expect(onOpen).toHaveBeenCalledOnce();expect(onRow).not.toHaveBeenCalled();
});
it('superadmin atualiza a captura da extensão e aplica somente após conferência completa',async()=>{
  vi.mocked(suapRdService.action).mockImplementation(async action=>action==='status' ? { ...run,run } : { ...run,status:'applied' });
  const onSynced=vi.fn();renderUi(<SuapRdSyncCard onSynced={onSynced} />);
  await waitFor(()=>expect(suapRdService.action).toHaveBeenCalledWith('status','19','158366'));
  fireEvent.click(screen.getByRole('button',{name:'Atualizar conferência das RDs'}));
  fireEvent.click(await screen.findByRole('button',{name:'Aplicar conferência das RDs'}));
  await waitFor(()=>expect(suapRdService.action).toHaveBeenCalledWith('apply','19','158366','run'));
  await waitFor(()=>expect(onSynced).toHaveBeenCalledOnce());
  expect(vi.mocked(suapRdService.action).mock.calls.some(([action])=>action==='sync')).toBe(false);
});
it('não oferece escrita de RDs para usuário sem papel superadmin',()=>{
  state.admin=false;renderUi(<SuapRdSyncCard onSynced={vi.fn()} />);expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(suapRdService.action).not.toHaveBeenCalled();
});
it('permite reverter a captura ativa mesmo se uma nova conferência falhou',async()=>{
  vi.mocked(suapRdService.action).mockImplementation(async action=>action==='status' ? {...run,run:{...run,status:'failed'},appliedRun:{...run,id:'previous',status:'applied'}} : {...run,status:'reverted'});
  renderUi(<SuapRdSyncCard onSynced={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button',{name:'Reverter última aplicação'}));
  await waitFor(()=>expect(suapRdService.action).toHaveBeenCalledWith('revert','19','158366','previous'));
});
