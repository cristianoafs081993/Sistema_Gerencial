import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export default function SuapCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);
  const { session, isLoading } = useAuth();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const isAppLogin = state === 'app' || (state && state.startsWith('app'));
    const isPublicFeedbackCallback = !!(code && state && !isAppLogin);

    // 1. If session is already active (e.g. after Supabase hash verify redirects here), redirect to next path
    // But ONLY if we are not actively processing a public feedback login callback.
    if (session && !isPublicFeedbackCallback) {
      const nextPath = localStorage.getItem('suap_login_next') || '/';
      localStorage.removeItem('suap_login_next');
      navigate(nextPath, { replace: true });
      toast.success('Autenticado com sucesso!');
      return;
    }

    // 2. If the URL contains access_token, it means Supabase is currently parsing the callback hash.
    // We do not want to trigger the "missing code" error; instead, we wait for the session to be populated.
    if (window.location.hash.includes('access_token')) {
      return;
    }

    if (!code) {
      if (isLoading) return;
      setError('Código de autorização ausente.');
      return;
    }

    if (calledRef.current) return;
    calledRef.current = true;

    const handleCallback = async () => {
      const isAppLogin = state === 'app' || (state && state.startsWith('app'));

      try {
        const redirectUri = window.location.origin + '/suap-callback';
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suap-token-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ 
            code, 
            redirectUri,
            loginSupabase: isAppLogin,
            clientId: env.suapClientId
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('Erro retornado pela Edge Function:', data);
          throw new Error(data.details || data.error || 'Falha ao autenticar com o SUAP.');
        }

        if (isAppLogin) {
          // Use verifyOtp with the token_hash to establish the session directly,
          // avoiding the Supabase redirect URL whitelist that sends localhost to production.
          if (data?.hashed_token) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: data.hashed_token,
              type: 'magiclink',
            });

            if (verifyError) {
              console.error('Erro ao verificar OTP:', verifyError);
              throw new Error(verifyError.message || 'Falha ao verificar autenticação.');
            }

            const nextPath = localStorage.getItem('suap_login_next') || '/';
            localStorage.removeItem('suap_login_next');
            navigate(nextPath, { replace: true });
            toast.success('Autenticado com sucesso!');
          } else if (data?.action_link) {
            // Fallback: redirect to action_link (works when redirect URLs are whitelisted)
            window.location.href = data.action_link;
          } else {
            throw new Error('Link de autenticação não gerado pela Edge Function.');
          }
        } else {
          // Legacy flow for public feedback
          if (data && data.user) {
            // Store the authenticated staff user in sessionStorage
            sessionStorage.setItem('suap_staff_user', JSON.stringify(data.user));
            
            // Redirect back to the dynamic environment page
            if (state) {
              navigate(`/feedback-ambiente/${state}`, { replace: true });
            } else {
              navigate('/manutencao', { replace: true });
            }
            toast.success(`Autenticado como ${data.user.nome}`);
          } else {
            throw new Error('Nenhum dado de usuário retornado.');
          }
        }
      } catch (err) {
        console.error('Erro no callback SUAP:', err);
        setError(err instanceof Error ? err.message : 'Falha na autenticação com o SUAP. Tente novamente.');
      }
    };

    void handleCallback();
  }, [searchParams, navigate, session, isLoading]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-foreground">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Falha na Autenticação</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={() => navigate('/auth')}
            className="mt-4 text-xs font-semibold text-emerald-600 hover:underline"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-foreground">
      <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
      <p className="text-sm font-semibold text-slate-600">Finalizando autenticação no SUAP...</p>
      <p className="text-xs text-slate-400 mt-1">Carregando perfil e redirecionando...</p>
    </div>
  );
}
