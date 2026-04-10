import { useState } from 'react';
import { Loader2, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type AuthPanelProps = {
  title: string;
  description: string;
};

export function AuthPanel({ title, description }: AuthPanelProps) {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      toast.error('Informe e-mail e senha para entrar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const error = await signInWithPassword(normalizedEmail, password);
      if (error) {
        throw error;
      }

      toast.success('Login realizado com sucesso.');
      setPassword('');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao autenticar no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
      <CardHeader className="space-y-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="auth-email" className="text-sm font-medium text-foreground">
            E-mail
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com"
              autoComplete="email"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="auth-password" className="text-sm font-medium text-foreground">
            Senha
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
              className="pl-9"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleLogin();
                }
              }}
            />
          </div>
        </div>

        <Button type="button" className="h-11 w-full" disabled={isSubmitting} onClick={() => void handleLogin()}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>

        <p className="text-xs leading-6 text-slate-500">
          A conta precisa existir no Supabase Auth. Se voce recebeu um convite por e-mail, abra o link para definir a
          senha do primeiro acesso.
        </p>
      </CardContent>
    </Card>
  );
}
