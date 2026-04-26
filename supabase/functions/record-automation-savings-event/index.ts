import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-event-secret',
};

type AutomationSavingsEventRequest = {
  scenarioId?: string;
  source?: string;
  eventName?: string;
  occurredAt?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
};

type ScenarioRow = {
  id: string;
  baseline_minutes: number;
  automated_minutes: number;
  status: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`A variavel ${name} precisa estar configurada no ambiente do Supabase.`);
  }
  return value;
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`O campo ${fieldName} e obrigatorio.`);
  }
  return value.trim();
}

function parseOccurredAt(value?: string) {
  if (!value) return new Date().toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('O campo occurredAt precisa ser uma data ISO valida.');
  }

  return parsed.toISOString();
}

async function getAuthorizedUserEmail(params: {
  request: Request;
  supabaseUrl: string;
  anonKey: string;
  expectedSecret?: string;
}) {
  const receivedSecret = params.request.headers.get('x-automation-event-secret');
  if (params.expectedSecret && receivedSecret && receivedSecret === params.expectedSecret) {
    return null;
  }

  const authorization = params.request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ error: 'Informe x-automation-event-secret ou Authorization Bearer valido.' }, 401);
  }

  const authClient = createClient(params.supabaseUrl, params.anonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return jsonResponse({ error: 'Token de usuario invalido.' }, 401);
  }

  return data.user.email || null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Metodo nao permitido.' }, 405);
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const anonKey = requireEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const expectedSecret = Deno.env.get('AUTOMATION_EVENT_SECRET') || undefined;

    const authorizedEmail = await getAuthorizedUserEmail({
      request,
      supabaseUrl,
      anonKey,
      expectedSecret,
    });

    if (authorizedEmail instanceof Response) {
      return authorizedEmail;
    }

    const body = (await request.json()) as AutomationSavingsEventRequest;
    const scenarioId = requireString(body.scenarioId, 'scenarioId');
    const source = requireString(body.source, 'source');
    const eventName = requireString(body.eventName, 'eventName');
    const occurredAt = parseOccurredAt(body.occurredAt);
    const userEmail = body.userEmail || authorizedEmail;
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: scenario, error: scenarioError } = await supabase
      .from('automation_savings_scenarios')
      .select('id,baseline_minutes,automated_minutes,status')
      .eq('id', scenarioId)
      .single();

    if (scenarioError || !scenario) {
      return jsonResponse({ error: `Cenario ${scenarioId} nao encontrado.` }, 404);
    }

    const scenarioRow = scenario as ScenarioRow;
    if (scenarioRow.status !== 'active') {
      return jsonResponse({ error: `Cenario ${scenarioId} esta inativo.` }, 422);
    }

    const baselineMinutes = Number(scenarioRow.baseline_minutes) || 0;
    const automatedMinutes = Number(scenarioRow.automated_minutes) || 0;
    const savedMinutes = Math.max(0, baselineMinutes - automatedMinutes);

    const { data, error } = await supabase
      .from('automation_savings_events')
      .insert({
        scenario_id: scenarioId,
        source,
        event_name: eventName,
        occurred_at: occurredAt,
        user_email: userEmail,
        metadata,
        baseline_minutes: baselineMinutes,
        automated_minutes: automatedMinutes,
        saved_minutes: savedMinutes,
      })
      .select('id,scenario_id,source,event_name,occurred_at,user_email,metadata,baseline_minutes,automated_minutes,saved_minutes')
      .single();

    if (error) {
      throw error;
    }

    return jsonResponse({ event: data }, 201);
  } catch (error) {
    console.error(error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha ao registrar evento de economia de tempo.',
      },
      400,
    );
  }
});
