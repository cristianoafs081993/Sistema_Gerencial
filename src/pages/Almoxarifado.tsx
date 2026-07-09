import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, Boxes, Loader2, PackageOpen, Plus, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { inventoryService, type CatalogItem } from '@/services/inventory';
import {
  getStockLevelStatus,
  movementRequiresDestination,
  movementRequiresSource,
  stockMovementLabels,
  type StockMovementType,
  validateStockMovementInput,
} from '@/utils/inventory';

const EMPTY_WORKSPACE = { units: [], warehouses: [], items: [], balances: [], movements: [] };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

export default function Almoxarifado() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);

  const contextQuery = useQuery({
    queryKey: ['inventory', 'context'],
    queryFn: () => inventoryService.getContext(),
    staleTime: 60_000,
  });
  const context = contextQuery.data;
  const workspaceQuery = useQuery({
    queryKey: ['inventory', 'workspace', context?.id],
    queryFn: () => inventoryService.getWorkspace(context!.id),
    enabled: Boolean(context?.id),
    staleTime: 15_000,
  });
  const workspace = workspaceQuery.data || EMPTY_WORKSPACE;
  const canManage = isSuperAdmin || context?.role === 'admin' || context?.role === 'warehouse_manager';
  const canMove = isSuperAdmin || context?.role !== 'auditor';
  const warehouseMap = useMemo(
    () => new Map(workspace.warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [workspace.warehouses],
  );
  const filteredBalances = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return workspace.balances.filter((balance) => {
      const status = getStockLevelStatus(balance.quantity, balance.minimumStock);
      return (warehouseFilter === 'todos' || balance.warehouseId === warehouseFilter)
        && (statusFilter === 'todos' || status === statusFilter)
        && (!needle || `${balance.itemCode} ${balance.itemName}`.toLowerCase().includes(needle));
    });
  }, [search, statusFilter, warehouseFilter, workspace.balances]);
  const totalValue = workspace.balances.reduce((sum, balance) => sum + balance.inventoryValue, 0);
  const criticalCount = workspace.balances.filter(
    (balance) => getStockLevelStatus(balance.quantity, balance.minimumStock) !== 'available',
  ).length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inventory'] });

  if (!contextQuery.isLoading && !context) {
    return (
      <div className="space-y-6 pb-10">
        <HeaderSubtitle>Operações / Almoxarifado</HeaderSubtitle>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5" /><div><p className="font-semibold">Usuário sem entidade operacional</p><p className="mt-1 text-sm">Solicite ao administrador o vínculo com uma entidade.</p></div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Operações / Almoxarifado</HeaderSubtitle>
      <HeaderActions>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void refresh()} disabled={workspaceQuery.isFetching}>{workspaceQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Atualizar</Button>
          {canManage ? <Button variant="outline" className="gap-2" onClick={() => setItemDialogOpen(true)}><Plus className="h-4 w-4" />Cadastrar item</Button> : null}
          <Button className="gap-2" onClick={() => setMovementDialogOpen(true)} disabled={!canMove || !workspace.items.length}><ArrowRightLeft className="h-4 w-4" />Registrar movimento</Button>
        </div>
      </HeaderActions>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Itens com saldo" value={workspace.balances.filter((row) => row.quantity > 0).length} subtitle="Posições de estoque" icon={Boxes} stitchColor="vibrant-blue" isLoading={workspaceQuery.isLoading} />
        <StatCard title="Valor em estoque" value={currency.format(totalValue)} subtitle="Custo registrado" icon={PackageOpen} stitchColor="emerald-green" isLoading={workspaceQuery.isLoading} />
        <StatCard title="Estoque crítico" value={criticalCount} subtitle="Zerado ou abaixo do mínimo" icon={AlertTriangle} stitchColor="amber" isLoading={workspaceQuery.isLoading} />
        <StatCard title="Movimentos recentes" value={workspace.movements.length} subtitle="Últimos 50 registros" icon={ArrowRightLeft} stitchColor="purple" isLoading={workspaceQuery.isLoading} />
      </div>

      <Tabs defaultValue="saldos" className="space-y-4">
        <TabsList><TabsTrigger value="saldos">Saldos</TabsTrigger><TabsTrigger value="movimentos">Movimentações</TabsTrigger></TabsList>
        <TabsContent value="saldos" className="space-y-4">
          <FilterPanel>
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px]">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar item ou código" /></div>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}><SelectTrigger><SelectValue placeholder="Depósito" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os depósitos</SelectItem>{workspace.warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as situações</SelectItem><SelectItem value="available">Disponível</SelectItem><SelectItem value="low">Estoque baixo</SelectItem><SelectItem value="out">Sem estoque</SelectItem></SelectContent></Select>
            </div>
          </FilterPanel>
          <DataTablePanel title="Posições de estoque">
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Depósito</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {workspaceQuery.isLoading ? <TableRow><TableCell colSpan={5}><div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" />Carregando estoque...</div></TableCell></TableRow> : filteredBalances.length === 0 ? <TableRow><TableCell colSpan={5}><div className="py-10 text-center text-sm text-text-secondary">Nenhuma posição de estoque encontrada.</div></TableCell></TableRow> : filteredBalances.map((balance) => {
                  const status = getStockLevelStatus(balance.quantity, balance.minimumStock);
                  return <TableRow key={`${balance.warehouseId}:${balance.itemId}`}><TableCell><p className="font-medium text-text-primary">{balance.itemName}</p><p className="font-mono text-xs text-text-muted">{balance.itemCode}</p></TableCell><TableCell>{balance.warehouseName}</TableCell><TableCell><Badge variant={status === 'available' ? 'secondary' : 'destructive'}>{status === 'available' ? 'Disponível' : status === 'low' ? 'Estoque baixo' : 'Sem estoque'}</Badge></TableCell><TableCell className="text-right font-mono">{quantity.format(balance.quantity)} {balance.unitCode}</TableCell><TableCell className="text-right font-mono">{currency.format(balance.inventoryValue)}</TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          </DataTablePanel>
        </TabsContent>
        <TabsContent value="movimentos">
          <DataTablePanel title="Movimentações recentes">
            <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Origem</TableHead><TableHead>Destino</TableHead><TableHead>Referência</TableHead></TableRow></TableHeader><TableBody>{workspace.movements.length === 0 ? <TableRow><TableCell colSpan={5}><div className="py-10 text-center text-sm text-text-secondary">Nenhuma movimentação registrada.</div></TableCell></TableRow> : workspace.movements.map((movement) => <TableRow key={movement.id}><TableCell>{new Date(movement.occurredAt).toLocaleString('pt-BR')}</TableCell><TableCell><Badge variant="outline">{stockMovementLabels[movement.type]}</Badge></TableCell><TableCell>{movement.sourceWarehouseId ? warehouseMap.get(movement.sourceWarehouseId) : '—'}</TableCell><TableCell>{movement.destinationWarehouseId ? warehouseMap.get(movement.destinationWarehouseId) : '—'}</TableCell><TableCell className="font-mono text-xs">{movement.referenceNumber || '—'}</TableCell></TableRow>)}</TableBody></Table>
          </DataTablePanel>
        </TabsContent>
      </Tabs>

      <CatalogItemDialog open={itemDialogOpen} onOpenChange={setItemDialogOpen} entityId={context?.id || ''} units={workspace.units} onSaved={refresh} />
      <MovementDialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen} entityId={context?.id || ''} warehouses={workspace.warehouses} items={workspace.items} onSaved={refresh} />
    </div>
  );
}

function CatalogItemDialog({ open, onOpenChange, entityId, units, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; entityId: string; units: { id: string; code: string; name: string }[]; onSaved: () => Promise<unknown> }) {
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [unitId, setUnitId] = useState(''); const [itemType, setItemType] = useState<CatalogItem['itemType']>('consumption');
  const mutation = useMutation({ mutationFn: () => inventoryService.createCatalogItem({ entityId, unitId, code, name, itemType }), onSuccess: async () => { await onSaved(); toast.success('Item cadastrado.'); setCode(''); setName(''); setUnitId(''); onOpenChange(false); }, onError: (error) => toast.error(message(error)) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Cadastrar item</DialogTitle><DialogDescription>Crie um item no catálogo compartilhado.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="item-code">Código</Label><Input id="item-code" value={code} onChange={(event) => setCode(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="item-name">Nome</Label><Input id="item-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="grid gap-2"><Label>Tipo</Label><Select value={itemType} onValueChange={(value) => setItemType(value as CatalogItem['itemType'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="consumption">Consumo</SelectItem><SelectItem value="permanent">Permanente</SelectItem><SelectItem value="service">Serviço</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Unidade</Label><Select value={unitId} onValueChange={setUnitId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.code} — {unit.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!code.trim() || !name.trim() || !unitId || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button></DialogFooter></DialogContent></Dialog>;
}

function MovementDialog({ open, onOpenChange, entityId, warehouses, items, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; entityId: string; warehouses: { id: string; name: string }[]; items: CatalogItem[]; onSaved: () => Promise<unknown> }) {
  const [type, setType] = useState<StockMovementType>('receipt'); const [source, setSource] = useState(''); const [destination, setDestination] = useState(''); const [itemId, setItemId] = useState(''); const [amount, setAmount] = useState(''); const [cost, setCost] = useState(''); const [reference, setReference] = useState(''); const [notes, setNotes] = useState('');
  const parsedAmount = Number(amount.replace(',', '.')); const parsedCost = movementRequiresSource(type) ? 0 : Number(cost.replace(',', '.'));
  const validation = validateStockMovementInput({ type, sourceWarehouseId: source, destinationWarehouseId: destination, itemId, quantity: parsedAmount, unitCost: parsedCost });
  const mutation = useMutation({ mutationFn: () => inventoryService.postMovement({ entityId, type, sourceWarehouseId: source, destinationWarehouseId: destination, itemId, quantity: parsedAmount, unitCost: parsedCost, referenceNumber: reference, notes }), onSuccess: async () => { await onSaved(); toast.success('Movimentação registrada.'); setItemId(''); setAmount(''); setCost(''); setReference(''); setNotes(''); onOpenChange(false); }, onError: (error) => toast.error(message(error)) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Registrar movimento</DialogTitle><DialogDescription>O lançamento será gravado no razão imutável.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="grid gap-2 sm:col-span-2"><Label>Tipo</Label><Select value={type} onValueChange={(value) => setType(value as StockMovementType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(stockMovementLabels) as StockMovementType[]).map((value) => <SelectItem key={value} value={value}>{stockMovementLabels[value]}</SelectItem>)}</SelectContent></Select></div>{movementRequiresSource(type) ? <div className="grid gap-2"><Label>Origem</Label><Select value={source} onValueChange={setSource}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select></div> : null}{movementRequiresDestination(type) ? <div className="grid gap-2"><Label>Destino</Label><Select value={destination} onValueChange={setDestination}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select></div> : null}<div className="grid gap-2 sm:col-span-2"><Label>Item</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{items.filter((item) => item.itemType !== 'service').map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="stock-quantity">Quantidade</Label><Input id="stock-quantity" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="stock-cost">Custo unitário</Label><Input id="stock-cost" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} disabled={movementRequiresSource(type)} placeholder={movementRequiresSource(type) ? 'Calculado' : '0,00'} /></div><div className="grid gap-2"><Label htmlFor="stock-reference">Referência</Label><Input id="stock-reference" value={reference} onChange={(event) => setReference(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="stock-notes">Observação</Label><Textarea id="stock-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={Boolean(validation) || mutation.isPending} title={validation || undefined} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Registrar</Button></DialogFooter></DialogContent></Dialog>;
}
