import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** A content page inside the existing shell; the parent keeps its filtered list mounted. */
export function RecordDetailsPage({ children, backLabel, onBack }: {
  children: ReactNode;
  backLabel: string;
  onBack: () => void;
}) {
  const backRef = useRef<HTMLButtonElement>(null);
  const returnTarget = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const scrollContainer = useRef(returnTarget.current?.closest('main'));
  const scrollTop = useRef(scrollContainer.current?.scrollTop ?? 0);
  useEffect(() => {
    backRef.current?.focus();
    const target = returnTarget.current;
    const container = scrollContainer.current;
    const top = scrollTop.current;
    return () => {
      requestAnimationFrame(() => {
        if (target?.isConnected && !target.closest('[hidden]')) {
          target.focus({ preventScroll: true });
          if (container) container.scrollTop = top;
        }
      });
    };
  }, []);
  return <section className="space-y-4" aria-label="Detalhes do registro">
    <Button ref={backRef} variant="ghost" onClick={onBack} className="gap-2">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}
    </Button>
    <div className="overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm">
      {children}
    </div>
  </section>;
}
