import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUAP_BASE_URL = 'https://suap.ifrn.edu.br';

// Função nativa e segura para converter ArrayBuffer para Base64 em pedaços (chunks),
// evitando estouro de call stack e eliminando a necessidade de imports externos do Deno.
function uint8ArrayToBase64(uint8: Uint8Array): string {
  let binary = '';
  const len = uint8.length;
  const chunkSize = 8192; // pedaços seguros de 8KB
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    // Convertendo pedaço por pedaço de forma segura para a stack
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticação do usuário no Supabase para segurança do proxy
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cabeçalho Authorization ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado no Supabase' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parsear parâmetros da requisição
    const { action, username, password, path, method = 'GET', suapSessionId, body = null } = await req.json();

    // FLUXO DE LOGIN NO SUAP
    if (action === 'login') {
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Usuário e senha do SUAP são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[suap-proxy] Iniciando login no SUAP para o usuário ${username}...`);

      // 1. Fazer GET na página de login do SUAP para capturar o token CSRF
      const loginPageUrl = `${SUAP_BASE_URL}/accounts/login/`;
      const getRes = await fetch(loginPageUrl);
      const getHtml = await getRes.text();

      // Extrair o csrftoken dos cabeçalhos Set-Cookie ou do HTML
      let csrfToken = '';
      const setCookieHeaders = getRes.headers.get('Set-Cookie') || '';
      const csrfMatchFromCookie = setCookieHeaders.match(/csrftoken=([^;]+)/);
      
      if (csrfMatchFromCookie) {
        csrfToken = csrfMatchFromCookie[1];
      } else {
        const csrfMatchFromHtml = getHtml.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/);
        csrfToken = csrfMatchFromHtml ? csrfMatchFromHtml[1] : '';
      }

      if (!csrfToken) {
        return new Response(JSON.stringify({ error: 'Não foi possível capturar o token CSRF do SUAP' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Executar o POST de login no SUAP
      const loginParams = new URLSearchParams();
      loginParams.append('username', username);
      loginParams.append('password', password);
      loginParams.append('csrfmiddlewaretoken', csrfToken);
      loginParams.append('next', '/');

      console.log('[suap-proxy] Enviando credenciais ao SUAP...');
      const postRes = await fetch(loginPageUrl, {
        method: 'POST',
        headers: {
          'Cookie': `csrftoken=${csrfToken}`,
          'Referer': loginPageUrl,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: loginParams.toString(),
        redirect: 'manual', // Impedir redirecionamento automático para podermos ler os cookies de resposta
      });

      const postSetCookie = postRes.headers.get('Set-Cookie') || '';
      console.log('[suap-proxy] Set-Cookie recebidos do login:', postSetCookie);

      const sessionIdMatch = postSetCookie.match(/sessionid=([^;]+)/);
      const suapSessionId = sessionIdMatch ? sessionIdMatch[1] : null;

      if (!suapSessionId) {
        return new Response(JSON.stringify({ error: 'Credenciais inválidas ou falha na autenticação do SUAP' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[suap-proxy] Login no SUAP realizado com sucesso!');
      return new Response(JSON.stringify({ 
        success: true, 
        suapSessionId 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // FLUXO DE PROXY DE ENDPOINT (REQUISIÇÃO COM COOKIE)
    if (!path) {
      return new Response(JSON.stringify({ error: 'O parâmetro path é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!suapSessionId) {
      return new Response(JSON.stringify({ error: 'É necessário fornecer o suapSessionId (cookie de sessão)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validação de segurança simples para garantir que o proxy só acesse endpoints permitidos do SUAP
    const cleanPath = String(path).trim();
    if (!cleanPath.startsWith('/processo_eletronico/') && !cleanPath.startsWith('/djtools/')) {
      return new Response(JSON.stringify({ error: 'Caminho não permitido no SUAP' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Montar URL e headers para a requisição ao SUAP
    const targetUrl = `${SUAP_BASE_URL}${cleanPath}`;
    const suapHeaders: HeadersInit = {
      'Cookie': `sessionid=${suapSessionId}`,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    };

    const fetchOptions: RequestInit = {
      method,
      headers: suapHeaders,
    };

    if (method === 'POST' && body) {
      if (typeof body === 'object') {
        suapHeaders['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchOptions.body = body;
      }
    }

    console.log(`[suap-proxy] Proxificando ${method} para ${targetUrl}`);
    const suapResponse = await fetch(targetUrl, fetchOptions);

    if (!suapResponse.ok) {
      const errorText = await suapResponse.text();
      return new Response(JSON.stringify({ 
        error: `Erro ao acessar o SUAP: ${suapResponse.statusText}`, 
        status: suapResponse.status,
        details: errorText 
      }), {
        status: suapResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = suapResponse.headers.get('Content-Type') || '';
    
    // Se for PDF ou outro arquivo binário, retornar em base64
    if (contentType.includes('application/pdf') || cleanPath.includes('/djtools/process_progress/1/')) {
      const arrayBuffer = await suapResponse.arrayBuffer();
      // Utiliza a função chunked nativa e segura para base64
      const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
      return new Response(JSON.stringify({ 
        base64, 
        contentType: 'application/pdf' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Caso contrário, é HTML/Texto
    const text = await suapResponse.text();
    return new Response(JSON.stringify({ 
      text,
      contentType 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[suap-proxy] Erro inesperado:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno no proxy' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
