import { HeaderSubtitle } from '@/components/HeaderParts';
import { AtasSearchWorkspace } from '@/components/atas/AtasSearchWorkspace';

export default function AtasAdesao() {
  return (
    <>
      <HeaderSubtitle>
        <span>Triagem inicial para localizar atas com potencial de adesao.</span>
      </HeaderSubtitle>
      <AtasSearchWorkspace module="adesao" />
    </>
  );
}
