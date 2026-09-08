import { Info } from 'lucide-react';

import { DEFAULT_IFRN_CAMPUS_UASG, getIfrnCampus } from '@/lib/ifrnCampuses';

type CampusDataUnavailableProps = {
  campusUasg: string;
  moduleName: string;
};

export function CampusDataUnavailable({ campusUasg, moduleName }: CampusDataUnavailableProps) {
  const campus = getIfrnCampus(campusUasg);
  const campusName = campus?.nome ?? (campusUasg === DEFAULT_IFRN_CAMPUS_UASG ? 'Currais Novos' : campusUasg);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="m-0">
        Ainda não há dados sincronizados para {moduleName} no campus <strong>{campusName}</strong> (UASG {campusUasg}).
        Importe ou sincronize essa base para disponibilizar os indicadores; nenhum dado de Currais Novos foi usado como substituto.
      </p>
    </div>
  );
}
