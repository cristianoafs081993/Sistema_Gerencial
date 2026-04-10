import { HeaderSubtitle } from '@/components/HeaderParts';
import { AtasBatchWorkspace } from '@/components/atas/AtasBatchWorkspace';
import { AtasSearchWorkspace } from '@/components/atas/AtasSearchWorkspace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AtasPesquisaPrecos() {
  return (
    <>
      <HeaderSubtitle>
        <span>Apoio a pesquisa de precos com foco em itens de atas agrupados por ata.</span>
      </HeaderSubtitle>
      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single">Busca individual</TabsTrigger>
          <TabsTrigger value="batch">Batch guiado</TabsTrigger>
        </TabsList>
        <TabsContent value="single">
          <AtasSearchWorkspace module="pesquisa_precos" />
        </TabsContent>
        <TabsContent value="batch">
          <AtasBatchWorkspace />
        </TabsContent>
      </Tabs>
    </>
  );
}
