import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DIMENSOES } from '@/types';

type DashboardFiltersSheetProps = {
  buttonClassName: string;
  filterDimensao: string;
  filterOrigem: string;
  dateStart: string;
  dateEnd: string;
  origensDisponiveis: string[];
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  onFilterDimensaoChange: (value: string) => void;
  onFilterOrigemChange: (value: string) => void;
  onDateStartChange: (value: string) => void;
  onDateEndChange: (value: string) => void;
  onClearFilters: () => void;
};

export function DashboardFiltersSheet({
  buttonClassName,
  filterDimensao,
  filterOrigem,
  dateStart,
  dateEnd,
  origensDisponiveis,
  hasActiveFilters,
  activeFiltersCount,
  onFilterDimensaoChange,
  onFilterOrigemChange,
  onDateStartChange,
  onDateEndChange,
  onClearFilters,
}: DashboardFiltersSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className={buttonClassName}>
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtrar Dashboard</SheetTitle>
          <SheetDescription>
            Selecione os criterios para visualizar os dados.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Dimensao</Label>
            <Select value={filterDimensao} onValueChange={onFilterDimensaoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {DIMENSOES.map((d) => (
                  <SelectItem key={d.codigo} value={d.codigo}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Origem de Recurso</Label>
            <Select value={filterOrigem} onValueChange={onFilterOrigemChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {origensDisponiveis.map((origem) => (
                  <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Periodo de Inicio</Label>
            <Input type="date" value={dateStart} onChange={(event) => onDateStartChange(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Periodo Final</Label>
            <Input type="date" value={dateEnd} onChange={(event) => onDateEndChange(event.target.value)} />
          </div>
        </div>
        <SheetFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {hasActiveFilters && (
            <Button variant="ghost" onClick={onClearFilters} className="w-full text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <X className="mr-2 h-4 w-4" />
              Limpar Filtros
            </Button>
          )}
          <SheetClose asChild>
            <Button type="submit" className="w-full bg-primary text-white shadow-sm hover:bg-brand-700">Aplicar</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
