import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useData } from '@/contexts/DataContext';
import CadastroTerceirizadosPage from '@/pages/CadastroTerceirizados';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import type { Empenho, Terceirizado, TerceirizadoPermission } from '@/types';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/services/requisicoesCompra', () => ({
  requisicoesCompraService: {
    listTerceirizados: vi.fn(),
    listPermissions: vi.fn(),
    saveTerceirizado: vi.fn(),
    deleteTerceirizado: vi.fn(),
    addPermission: vi.fn(),
    removePermission: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: ReactNode }) => (
    <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, disabled, children }: { value: string; disabled?: boolean; children: ReactNode }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  ),
}));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

const mockedUseData = vi.mocked(useData);
const mockedService = vi.mocked(requisicoesCompraService);

const terceirizado: Terceirizado = {
  id: 'tc-1',
  name: 'Teste',
  matricula: '3128880',
  email: 'teste@ifrn.edu.br',
  tipo: 'refeitorio',
  createdAt: new Date('2026-01-10T00:00:00Z'),
  updatedAt: new Date('2026-01-10T00:00:00Z'),
};

const makeEmpenho = (id: string, numero: string, valor: number, favorecidoNome: string): Empenho => ({
  id,
  numero,
  descricao: `Empenho ${numero}`,
  valor,
  dimensao: 'AD',
  componenteFuncional: 'Compras',
  origemRecurso: 'Tesouro',
  naturezaDespesa: '339039',
  favorecidoNome,
  tipo: 'exercicio',
  dataEmpenho: new Date('2026-01-10T00:00:00Z'),
  status: 'pendente',
  createdAt: new Date('2026-01-10T00:00:00Z'),
  updatedAt: new Date('2026-01-10T00:00:00Z'),
});

const permissions: TerceirizadoPermission[] = [
  {
    id: 'perm-1',
    userMatricula: '3128880',
    userEmail: 'teste@ifrn.edu.br',
    empenhoId: 'emp-335',
    createdBy: 'admin-1',
    createdAt: new Date('2026-01-10T00:00:00Z'),
  },
  {
    id: 'perm-2',
    userMatricula: '3128880',
    userEmail: 'teste@ifrn.edu.br',
    empenhoId: 'emp-336',
    createdBy: 'admin-1',
    createdAt: new Date('2026-01-10T00:00:00Z'),
  },
];

function setup(permissionRows: TerceirizadoPermission[] = []) {
  mockedUseData.mockReturnValue({
    empenhos: [
      makeEmpenho('emp-335', '2025NE000335', 347.96, 'CONSULTSIDE COMERCIO LTDA'),
      makeEmpenho('emp-336', '2025NE000336', 500, 'PRIME CONSULTORIA LTDA'),
    ],
    contratos: [],
  } as never);

  mockedService.listTerceirizados.mockResolvedValue([terceirizado]);
  mockedService.listPermissions.mockResolvedValue(permissionRows);
  mockedService.saveTerceirizado.mockResolvedValue(undefined as never);
  mockedService.addPermission.mockResolvedValue(undefined as never);
  mockedService.removePermission.mockResolvedValue(undefined as never);

  render(<CadastroTerceirizadosPage />);
}

async function openEditView() {
  await screen.findByText('Teste');
  fireEvent.click(screen.getByTitle('Editar terceirizado'));
  await screen.findByRole('heading', { name: /Editar terceirizado/i });
}

describe('CadastroTerceirizadosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre cadastro em modal pelo botao no topo', async () => {
    setup();

    await screen.findByText('Teste');

    expect(screen.getByRole('button', { name: /Cadastrar Terceirizado/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Novo Terceirizado/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome Completo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Terceirizado/i }));

    const dialog = await screen.findByRole('dialog', { name: /Novo Terceirizado/i });
    expect(within(dialog).getByText(/Cadastre um novo prestador/i)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Nome Completo'), { target: { value: 'Novo Prestador' } });
    fireEvent.change(within(dialog).getByLabelText(/Matrícula/i), { target: { value: '3129999' } });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'refeitorio' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Cadastrar Terceirizado/i }));

    await waitFor(() => expect(mockedService.saveTerceirizado).toHaveBeenCalledWith(expect.objectContaining({
      id: undefined,
      name: 'Novo Prestador',
      matricula: '3129999',
      tipo: 'refeitorio',
    })));
  });
  it('abre edicao em pagina inteira pelo lapis e salva dados cadastrais', async () => {
    setup();

    await openEditView();

    expect(screen.getByText(/Dados do terceirizado/i)).toBeInTheDocument();
    expect(screen.getByText(/Vincular Contratos e Empenhos/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Cadastro de Terceirizados/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Prestadores Cadastrados/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome Completo'), { target: { value: 'Teste Atualizado' } });
    fireEvent.change(screen.getByLabelText(/Matrícula/i), { target: { value: '3129999' } });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'limpeza_manutencao' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar dados/i }));

    await waitFor(() => expect(mockedService.saveTerceirizado).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tc-1',
      name: 'Teste Atualizado',
      matricula: '3129999',
      previousMatricula: '3128880',
      tipo: 'limpeza_manutencao',
    })));
  });

  it('usa empenho como padrao e cria multiplos vinculos filtrados', async () => {
    setup();

    await openEditView();

    expect(screen.getAllByRole('combobox')[1]).toHaveValue('empenho');
    expect(screen.getByText('Empenho / NE')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: /Buscar e selecionar empenhos/i }));

    const search = screen.getByPlaceholderText(/Filtrar por número/i);
    fireEvent.change(search, { target: { value: '335' } });
    fireEvent.click(await screen.findByText(/2025NE000335/i));

    fireEvent.change(search, { target: { value: '336' } });
    fireEvent.click(await screen.findByText(/2025NE000336/i));

    expect(screen.getByRole('combobox', { name: /2 empenho\(s\) selecionado\(s\)/i })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Empenhos selecionados')).getByText(/2025NE000335/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Empenhos selecionados')).getByText(/2025NE000336/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Vincular Acesso/i }));

    await waitFor(() => expect(mockedService.addPermission).toHaveBeenCalledTimes(2));
    expect(mockedService.addPermission).toHaveBeenNthCalledWith(1, '3128880', 'empenho', 'emp-335', undefined, 'teste@ifrn.edu.br');
    expect(mockedService.addPermission).toHaveBeenNthCalledWith(2, '3128880', 'empenho', 'emp-336', undefined, 'teste@ifrn.edu.br');
  });

  it('agrupa vinculos ativos com quebra de linha e permite remover individualmente', async () => {
    setup(permissions);

    await openEditView();
    await screen.findByText(/Vínculos de Acesso Ativos \(2\)/i);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getByText('Empenho')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2025NE000335')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2025NE000336')).toBeInTheDocument();

    fireEvent.click(within(rows[1]).getByRole('button', { name: /Remover vínculo 2025NE000335/i }));

    await waitFor(() => expect(mockedService.removePermission).toHaveBeenCalledWith('perm-1'));
  });
});