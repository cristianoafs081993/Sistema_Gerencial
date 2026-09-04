import React from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { InsumosDashboardView } from '@/components/refeitorio/InsumosDashboardView';

export default function RefeitorioInsumos() {
  return (
    <div className="space-y-6 pb-12">
      <SectionPanel
        title="Insumos do Refeitório"
        description="Acompanhamento do consumo, volume de requisições e custos de insumos e materiais do refeitório."
      >
        <InsumosDashboardView defaultBloco="refeitorio" />
      </SectionPanel>
    </div>
  );
}
