import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuotationItem = {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
};

type Recipient = {
  supplierId?: string;
  name: string;
  email: string;
  customMessage?: string;   // mensagem personalizada por fornecedor (modo custom)
  items?: QuotationItem[];  // itens filtrados para este fornecedor (modo direct)
};

type DispatchRequest = {
  researchId: string;
  modality: 'direct' | 'express' | 'batch' | 'custom' | 'manual';
  recipients: Recipient[];
  items: QuotationItem[];
  processNumber?: string;
  objectDescription: string;
  responsibleName: string;
  deadlineDate?: string;        // YYYY-MM-DD
  deadlineBusinessDays?: number;
  additionalMessage?: string;
  instructions?: string;
  replyTo?: string;
  agencyName?: string;
  agencySub?: string;
  agencySector?: string;
};

type DispatchResult = {
  email: string;
  name: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  sentAt?: string;
};

type DbResearch = {
  id: string;
  object_description: string;
  process_number: string | null;
  responsible_name: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODALITY_LABELS: Record<string, string> = {
  direct: 'Cotação Segmentada (Direta)',
  express: 'Cotação Urgente (Expressa)',
  batch: 'Cotação em Lote',
  custom: 'Mensagem Customizada (Personalizada)',
  manual: 'Envio Avulso (Por E-mail)',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada.`);
  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function formatDate(dateStr: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  if (!dateStr || dateStr.length < 10) return dateStr;
  return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}`;
}

function deadlineText(deadlineDate?: string, deadlineBusinessDays?: number, modality?: string): string {
  if (deadlineDate) return formatDate(deadlineDate);
  if (deadlineBusinessDays) return `${deadlineBusinessDays} dia(s) útil(eis) após o recebimento`;
  if (modality === 'express') return '1 (um) dia útil após o recebimento desta solicitação (URGENTE)';
  return '3 (três) dias úteis após o recebimento desta solicitação';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultInstructions(replyTo: string, objectDescription: string): string {
  return [
    'Enviar proposta em papel timbrado da empresa, com CNPJ, preços unitários e totais;',
    'Incluir validade mínima da proposta de 60 (sessenta) dias;',
    'Informar marca e/ou modelo dos produtos, quando aplicável;',
    `Encaminhar a proposta para o e-mail: ${replyTo};`,
    `Identificar o e-mail com o assunto: "Cotação — ${objectDescription.slice(0, 60)}".`,
  ].join('\n');
}

function buildInstructionItems(params: { instructions?: string; replyTo: string; objectDescription: string }): string {
  const source = params.instructions?.trim() || defaultInstructions(params.replyTo, params.objectDescription);
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');
}

// ---------------------------------------------------------------------------
// HTML email builder
// ---------------------------------------------------------------------------

function buildEmailHtml(params: {
  recipientName: string;
  objectDescription: string;
  processNumber?: string | null;
  responsibleName: string;
  modality: string;
  items: QuotationItem[];
  deadline: string;
  additionalMessage?: string;
  instructions?: string;
  replyTo: string;
  agencyName?: string;
  agencySub?: string;
  agencySector?: string;
}): string {
  const {
    recipientName,
    objectDescription,
    processNumber,
    responsibleName,
    modality,
    items,
    deadline,
    additionalMessage,
    instructions,
    replyTo,
    agencyName = 'INSTITUTO FEDERAL DO RIO GRANDE DO NORTE',
    agencySub = 'Campus Currais Novos',
    agencySector = 'Setor de Licitações e Contratos',
  } = params;

  const itemRows = items
    .map(
      (item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#ffffff'}">
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:#374151">${item.itemNumber}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151">${item.description}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${item.unit}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px">______________</td>
      </tr>`,
    )
    .join('');

  const processBlock = processNumber
    ? `<p style="margin:4px 0;color:#374151"><strong>Processo:</strong> ${processNumber}</p>`
    : '';

  const additionalBlock = additionalMessage
    ? `<div style="margin-top:20px;padding:16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px">
        <p style="margin:0;color:#92400e;font-size:14px"><strong>Observações:</strong></p>
        <p style="margin:8px 0 0;color:#92400e;font-size:14px;white-space:pre-line">${additionalMessage}</p>
       </div>`
    : '';

  const instructionItems = buildInstructionItems({ instructions, replyTo, objectDescription });
  const today = new Date().toLocaleDateString('pt-BR');

  // Change background color depending on urgency
  const headerBackground = modality === 'express'
    ? 'linear-gradient(135deg,#991b1b 0%,#dc2626 100%)' // Red banner for Urgent
    : 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)'; // Blue banner for standard

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Solicitação de Cotação de Preços — ${agencyName}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:${headerBackground};padding:28px 32px">
      <p style="margin:0;color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600">${agencyName.toUpperCase()}</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:700">Solicitação de Cotação de Preços</h1>
      <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px">${MODALITY_LABELS[modality] ?? modality} · ${today}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 20px;color:#374151;font-size:15px">
        Prezado(a) <strong>${recipientName}</strong>,
      </p>
      <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.7">
        O <strong>${agencyName}${agencySub ? ` — ${agencySub}` : ''}</strong> solicita a gentileza de encaminhar proposta de preços
        para os itens abaixo relacionados, visando à pesquisa de preços para futura aquisição, em conformidade
        com o art. 23 da Lei nº 14.133/2021 e a Instrução Normativa SEGES/ME nº 65/2021.
      </p>

      <!-- Dados da pesquisa -->
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0 0 8px;color:#0369a1;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Dados da Pesquisa</p>
        ${processBlock}
        <p style="margin:4px 0;color:#374151"><strong>Objeto:</strong> ${objectDescription}</p>
        <p style="margin:4px 0;color:#374151"><strong>Responsável:</strong> ${responsibleName}</p>
        <p style="margin:4px 0;color:#dc2626"><strong>Prazo para resposta:</strong> ${deadline}</p>
      </div>

      <!-- Tabela de itens -->
      <h2 style="font-size:15px;color:#1e3a5f;margin:0 0 12px;font-weight:700">Itens Solicitados</h2>
      <div style="overflow-x:auto;border-radius:8px;border:1px solid #e5e7eb">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#1e3a5f">
              <th style="padding:10px 12px;color:#ffffff;text-align:center;font-weight:600;width:48px">Nº</th>
              <th style="padding:10px 12px;color:#ffffff;text-align:left;font-weight:600">Descrição</th>
              <th style="padding:10px 12px;color:#ffffff;text-align:center;font-weight:600;width:72px">Unid.</th>
              <th style="padding:10px 12px;color:#ffffff;text-align:center;font-weight:600;width:72px">Qtd.</th>
              <th style="padding:10px 12px;color:#ffffff;text-align:center;font-weight:600;width:120px">Preço Unit. (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>

      <!-- Observações adicionais -->
      ${additionalBlock}

      <!-- Instruções -->
      <div style="margin-top:28px;padding:20px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        <p style="margin:0 0 10px;color:#1e3a5f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Instruções para envio da proposta</p>
        <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.9">
          ${instructionItems}
        </ul>
      </div>

      <p style="margin:28px 0 0;color:#4b5563;font-size:14px;line-height:1.7">
        Agradecemos a atenção e nos colocamos à disposição para esclarecimentos.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 32px">
      <p style="margin:0;color:#374151;font-size:13px;font-weight:600">${responsibleName}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:12px">${agencySector}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:12px">${agencyName}${agencySub ? ` — ${agencySub}` : ''}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:12px">
        Este e-mail foi gerado automaticamente pelo SIAGES - Sistema Integrado de Administração e Gestão Estratégica.
        Não responda diretamente a este endereço.
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send via Resend
// ---------------------------------------------------------------------------

async function sendViaResend(params: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  resendApiKey: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.replyTo) body.reply_to = params.replyTo;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.resendApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API error ${response.status}: ${text.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Validate user JWT
// ---------------------------------------------------------------------------

async function validateUser(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Sessão autenticada obrigatória.');
  }
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error('Sessão inválida ou expirada.');
  return data.user;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  try {
    // Validate session
    const user = await validateUser(request);

    // Parse request body
    const body = (await request.json()) as DispatchRequest;
    const {
      researchId,
      modality,
      recipients,
      items,
      objectDescription,
      processNumber,
      responsibleName,
      deadlineDate,
      deadlineBusinessDays,
      additionalMessage,
      instructions,
      replyTo: bodyReplyTo,
      agencyName,
      agencySub,
      agencySector,
    } = body;

    if (!researchId) return jsonResponse({ error: 'researchId é obrigatório.' }, 400);
    if (!modality) return jsonResponse({ error: 'modality é obrigatório.' }, 400);
    if (!recipients?.length) return jsonResponse({ error: 'Informe ao menos um destinatário.' }, 400);
    if (!items?.length) return jsonResponse({ error: 'Informe ao menos um item.' }, 400);
    if (!objectDescription) return jsonResponse({ error: 'objectDescription é obrigatório.' }, 400);

    // Environment
    const resendApiKey = requireEnv('RESEND_API_KEY');
    const emailFrom = requireEnv('EMAIL_FROM');
    const emailReplyTo = bodyReplyTo || Deno.env.get('EMAIL_REPLY_TO') || emailFrom;

    // Supabase service role client for DB writes
    const serviceClient = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Validate research ownership
    const { data: research, error: researchError } = await serviceClient
      .from('price_researches')
      .select('id, object_description, process_number, responsible_name, created_by')
      .eq('id', researchId)
      .maybeSingle();

    if (researchError) throw researchError;
    if (!research) return jsonResponse({ error: 'Pesquisa de preços não encontrada.' }, 404);
    if ((research as any).created_by !== user.id) {
      // Allow superadmin
      if (user.email !== 'cristiano.cnrn@gmail.com') {
        return jsonResponse({ error: 'Sem permissão para esta pesquisa.' }, 403);
      }
    }

    const deadline = deadlineText(deadlineDate, deadlineBusinessDays, modality);
    const subjectPrefix = modality === 'express' ? '[URGENTE] ' : '';
    const subject = `${subjectPrefix}Solicitação de Cotação de Preços — ${objectDescription.slice(0, 80)} — IFRN`;

    const results: DispatchResult[] = [];

    for (const recipient of recipients) {
      const recipientName = recipient.name || recipient.email;
      const customMsg = recipient.customMessage ?? additionalMessage;

      // Segmented items logic (for 'direct' modality)
      const recipientItems = recipient.items && recipient.items.length > 0
        ? recipient.items
        : items;

      const html = buildEmailHtml({
        recipientName,
        objectDescription: (research as DbResearch).object_description || objectDescription,
        processNumber: (research as DbResearch).process_number || processNumber,
        responsibleName: (research as DbResearch).responsible_name || responsibleName,
        modality,
        items: recipientItems,
        deadline,
        additionalMessage: customMsg,
        instructions,
        replyTo: emailReplyTo,
        agencyName,
        agencySub,
        agencySector,
      });

      let status: 'sent' | 'failed' = 'sent';
      let errorMessage: string | undefined;
      let sentAt: string | undefined;

      try {
        await sendViaResend({
          from: emailFrom,
          to: recipient.email,
          replyTo: emailReplyTo,
          subject,
          html,
          resendApiKey,
        });
        sentAt = new Date().toISOString();
      } catch (err) {
        status = 'failed';
        errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[disparar-cotacao-email] Falha ao enviar para ${recipient.email}:`, errorMessage);
      }

      // Persist dispatch record
      await serviceClient.from('price_research_email_dispatches').insert({
        research_id: researchId,
        supplier_id: recipient.supplierId ?? null,
        modality,
        recipient_email: recipient.email,
        recipient_name: recipientName,
        subject,
        body_html: html,
        status,
        error_message: errorMessage ?? null,
        sent_at: sentAt ?? null,
        sent_by: user.id,
      });

      results.push({
        email: recipient.email,
        name: recipientName,
        status,
        errorMessage,
        sentAt,
      });
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return jsonResponse({ results, summary: { sent, failed } });
  } catch (error) {
    console.error('[disparar-cotacao-email] Erro:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
