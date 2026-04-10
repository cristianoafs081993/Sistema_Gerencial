import { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type SetupPasswordPanelProps = {
  title: string;
  description: string;
  submitLabel?: string;
  onSuccess?: () => void | Promise<void>;
};

export function SetupPasswordPanel({
  title,
  description,
  submitLabel = 'Salvar senha',
  onSuccess,
}: SetupPasswordPanelProps) {
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      toast.error('Preencha e confirme a nova senha.');
      return;
    }

    if (password.length < 8) {
      toast.error('Use uma senha com pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas digitadas nao coincidem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const error = await updatePassword(password);
      if (error) {
        throw error;
      }

      setPassword('');
      setConfirmPassword('');
      toast.success('Senha definida com sucesso.');
      await onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao definir a senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
      <CardHeader className="space-y-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm leading-6 text-emerald-900">
          {session?.user.email
            ? `Convite validado para ${session.user.email}. Defina a senha para concluir o primeiro acesso.`
            : 'Convite validado. Defina a senha para concluir o primeiro acesso.'}
        </div>

        <div className="space-y-2">
          <label htmlFor="setup-password" className="text-sm font-medium text-foreground">
            Nova senha
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="setup-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimo de 8 caracteres"
              autoComplete="new-password"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="setup-password-confirmation" className="text-sm font-medium text-foreground">
            Confirmar senha
          </label>
          <div className="relative">
            <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="setup-password-confirmation"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
              className="pl-9"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSubmit();
                }
              }}
            />
          </div>
        </div>

        <Button
          type="button"
          className="h-11 w-full"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {isSubmitting ? 'Salvando...' : submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
