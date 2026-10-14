import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe,expect,it,vi } from 'vitest';
import { SiafiChecklist } from '../SiafiChecklist';
import type { ChecklistItem } from '@/services/siafiLiquidacao';
const item:ChecklistItem={id:'C04:NF:123',regraId:'C04',entidade:'NF:123',descricao:'Valor bruto',prioridade:0,status:'divergente',esperado:'100,00',encontrado:'101,00',diferenca:'1,00',observacao:'Diferença documentada.',acao:'Corrigir valor.',evidencias:[]};
describe('revisão humana do checklist',()=>{
  it('esconde conformes inicialmente e permite mostrar todos',()=>{
    render(<SiafiChecklist items={[item,{...item,id:'C02:geral',regraId:'C02',descricao:'Credor correto',status:'conforme'}]} onReview={vi.fn()}/>);
    expect(screen.queryByText('C02 — Credor correto')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Mostrar todos'));expect(screen.getByText('C02 — Credor correto')).toBeInTheDocument();
  });
  it('conferido não muda o parecer da IA',async()=>{
    const onReview=vi.fn().mockResolvedValue(undefined);
    render(<SiafiChecklist items={[item]} onReview={onReview}/>);
    fireEvent.click(screen.getByLabelText('Conferido'));
    await waitFor(()=>expect(onReview).toHaveBeenCalledWith(item.id,true,undefined,undefined));
    expect(document.querySelector('[data-status="divergente"]')).toBeInTheDocument();
    expect(item.status).toBe('divergente');
  });
  it('envia motivo do falso positivo e exibe falha de persistência',async()=>{
    const onReview=vi.fn().mockRejectedValue(new Error('Explique o motivo do falso positivo.'));
    render(<SiafiChecklist items={[item]} onReview={onReview}/>);
    fireEvent.change(screen.getByLabelText(`Motivo da revisão ${item.id}`),{target:{value:'Pagamento parcial autorizado'}});
    fireEvent.click(screen.getByText('Indicar falso positivo'));
    await waitFor(()=>expect(onReview).toHaveBeenCalledWith(item.id,true,'falso_positivo','Pagamento parcial autorizado'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Explique');
  });
});
