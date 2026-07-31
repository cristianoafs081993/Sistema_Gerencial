import { useState } from 'react';
import { Eye, EyeOff, GraduationCap, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { normalizeNextPath } from '@/lib/auth';
import { buildSuapAuthorizeUrl } from '@/lib/suapAuth';

type AuthPanelProps = {
  title: string;
  description?: string;
};

export function AuthPanel({ title, description }: AuthPanelProps) {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedNextPath = searchParams.get('next');
  const nextPath = normalizeNextPath(requestedNextPath);

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

  const handleSuapLogin = () => {
    localStorage.setItem('suap_login_next', nextPath);
    const suapAuthUrl = buildSuapAuthorizeUrl({ state: 'app' });
    window.location.href = suapAuthUrl;
  };

  return (
    <Card className="border-border-default/70 shadow-[0_22px_60px_rgba(26,43,102,0.06)] bg-white/80 backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-2xl font-black tracking-tight text-foreground">{title}</CardTitle>
        {description ? <CardDescription className="text-sm font-medium text-muted-foreground">{description}</CardDescription> : null}
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
              type={isPasswordVisible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
              className="pl-9 pr-12"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleLogin();
                }
              }}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
              aria-controls="auth-password"
              aria-pressed={isPasswordVisible}
              disabled={isSubmitting}
              onClick={() => setIsPasswordVisible((current) => !current)}
            >
              {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="button" className="h-11 w-full" disabled={isSubmitting} onClick={() => void handleLogin()}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase font-bold tracking-wider">
            ou acesse com
          </span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <Button
          type="button"
          onClick={handleSuapLogin}
          className="w-full bg-[#1b5e20] hover:bg-[#1b5e20]/90 text-white h-11 shadow-sm rounded-xl font-bold gap-2 flex items-center justify-center transition-all"
        >
          <GraduationCap className="h-5 w-5" />
          Entrar com SUAP
        </Button>

      </CardContent>
    </Card>
  );
}
