import {describe,expect,it,vi} from 'vitest';
import {runSuapPdfRetention,type RetentionStore} from '../../../supabase/functions/_shared/suap_pdf_retention';
const row={object_id:'1',object_path:'tenant/1.pdf',byte_size:123};
function store():RetentionStore{
  return {candidates:vi.fn().mockResolvedValue({data:[row],error:null}),claim:vi.fn().mockResolvedValue({data:[row],error:null}),
    confirm:vi.fn().mockResolvedValue({data:true,error:null}),remove:vi.fn().mockResolvedValue({data:[],error:null}),finish:vi.fn().mockResolvedValue({data:null,error:null})};
}
describe('retention worker',()=>{
  it('dry-run não reclama, remove ou altera referências',async()=>{const s=store();expect(await runSuapPdfRetention(s,true)).toMatchObject({selected:1,eligibleBytes:123,deleted:0});expect(s.claim).not.toHaveBeenCalled();expect(s.remove).not.toHaveBeenCalled();expect(s.finish).not.toHaveBeenCalled();});
  it('revalida, remove pela API e só depois limpa referências',async()=>{const s=store();expect(await runSuapPdfRetention(s,false)).toMatchObject({deleted:1,bytes:123,failed:0});expect(s.remove).toHaveBeenCalledWith(row.object_path);expect(s.finish).toHaveBeenCalledWith('1',true);expect(vi.mocked(s.finish).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(s.remove).mock.invocationCallOrder[0]);});
  it('recência/versão alterada cancela a remoção',async()=>{const s=store();vi.mocked(s.confirm).mockResolvedValue({data:false,error:null});expect(await runSuapPdfRetention(s,false)).toMatchObject({skipped:1,deleted:0});expect(s.remove).not.toHaveBeenCalled();expect(s.finish).toHaveBeenCalledWith('1',false);});
  it('falha do Storage mantém as referências',async()=>{const s=store();vi.mocked(s.remove).mockResolvedValue({data:null,error:{message:'offline'}});expect(await runSuapPdfRetention(s,false)).toMatchObject({failed:1,deleted:0});expect(s.finish).toHaveBeenCalledWith('1',false);});
  it('falha depois da remoção preserva a lease para reconciliação',async()=>{const s=store();vi.mocked(s.finish).mockRejectedValue(new Error('offline'));expect(await runSuapPdfRetention(s,false)).toMatchObject({failed:1});expect(s.finish).toHaveBeenCalledExactlyOnceWith('1',true);});
});
