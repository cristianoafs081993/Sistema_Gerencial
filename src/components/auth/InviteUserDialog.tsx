import { useMemo, useState } from 'react';
import { Loader2, Mail, MailPlus, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { SUPERADMIN_EMAIL } from '@/lib/authz';
import { buildInviteRedirectUrl } from '@/lib/auth';
import { inviteUserByEmail } from '@/services/authInvites';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type InviteUserDialogProps = {
  defaultNextPath?: string;
};

export function InviteUserDialog({ defaultNextPath = '/' }: InviteUserDialogProps) {
  const { canInviteUsers } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(
    () => buildInviteRedirectUrl(window.location.origin, defaultNextPath),
    [defaultNextPath],
  );

  const handleInvite = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error('Informe o e-mail do usuario a ser convidado.');
      return;
    }

    setIsSubmitting(true);

    try {
      await inviteUserByEmail({
        email: normalizedEmail,
        redirectTo,
      });

      toast.success(`Convite enviado para ${normalizedEmail}.`);
      setEmail('');
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar o convite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canInviteUsers) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 border-slate-200 bg-white/85 text-slate-700">
          <MailPlus className="h-4 w-4" />
          Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md border-none bg-white p-0 shadow-2xl">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(47,103,216,0.08),rgba(16,185,129,0.04))] px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold text-slate-950">Convidar usuario</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-600">
              Envia um e-mail de convite pelo Supabase. O usuario acessa o link e define a senha no primeiro login.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p>
                O envio tambem e validado no backend. No estado atual, apenas o superadministrador
                {' '}
                <span className="font-semibold">{SUPERADMIN_EMAIL}</span>
                {' '}
                pode disparar convites.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
              E-mail do usuario
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@exemplo.com"
                autoComplete="email"
                className="pl-9"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleInvite();
                  }
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500">
            Redirecionamento apos o clique no convite:
            <br />
            <span className="font-medium text-slate-700">{redirectTo}</span>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleInvite()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
              {isSubmitting ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
