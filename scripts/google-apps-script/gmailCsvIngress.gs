const CONFIG_KEYS = {
  FUNCTION_URL: 'SUPABASE_FUNCTION_URL',
  SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
  INGEST_SECRET: 'EMAIL_CSV_INGEST_SECRET',
  GMAIL_QUERY: 'GMAIL_CSV_QUERY',
  SUCCESS_LABEL: 'GMAIL_CSV_SUCCESS_LABEL',
  ERROR_LABEL: 'GMAIL_CSV_ERROR_LABEL',
  BATCH_SIZE: 'GMAIL_CSV_BATCH_SIZE',
  PIPELINE_HINT: 'GMAIL_CSV_PIPELINE_HINT',
};

function ingestCsvEmails() {
  const config = loadConfig_();
  const successLabel = getOrCreateLabel_(config.successLabel);
  const errorLabel = getOrCreateLabel_(config.errorLabel);
  const threads = GmailApp.search(config.gmailQuery, 0, config.batchSize);

  threads.forEach((thread) => {
    let threadSucceeded = true;

    thread.getMessages().forEach((message) => {
      const attachments = message
        .getAttachments({ includeInlineImages: false, includeAttachments: true })
        .filter((attachment) => /\.csv$/i.test(attachment.getName()));

      if (!attachments.length) {
        return;
      }

      attachments.forEach((attachment) => {
        const response = sendAttachmentToSupabase_(config, message, thread, attachment);
        const payload = parseResponseBody_(response);

        if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
          Logger.log(
            'CSV processado com sucesso: %s | pipeline=%s | rowsWritten=%s',
            attachment.getName(),
            payload.pipeline || 'auto',
            payload.rowsWritten || 0,
          );
          return;
        }

        threadSucceeded = false;
        Logger.log(
          'Falha ao processar %s: %s',
          attachment.getName(),
          payload.error || response.getContentText(),
        );
      });
    });

    if (threadSucceeded) {
      thread.addLabel(successLabel);
      if (errorLabel) {
        thread.removeLabel(errorLabel);
      }
      thread.markRead();
      return;
    }

    if (errorLabel) {
      thread.addLabel(errorLabel);
    }
  });
}

function sendAttachmentToSupabase_(config, message, thread, attachment) {
  const payload = {
    messageId: message.getId(),
    threadId: thread.getId(),
    subject: message.getSubject(),
    from: message.getFrom(),
    to: message.getTo(),
    receivedAt: message.getDate().toISOString(),
    pipelineHint: config.pipelineHint,
    gmailLabels: thread.getLabels().map((label) => label.getName()),
    attachment: {
      fileName: attachment.getName(),
      mimeType: attachment.getContentType(),
      contentBase64: Utilities.base64Encode(attachment.getBytes()),
    },
  };

  return UrlFetchApp.fetch(config.functionUrl, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + config.supabaseAnonKey,
      apikey: config.supabaseAnonKey,
      'x-email-ingest-secret': config.ingestSecret,
    },
    payload: JSON.stringify(payload),
  });
}

function loadConfig_() {
  const properties = PropertiesService.getScriptProperties();

  const functionUrl = requiredProperty_(properties, CONFIG_KEYS.FUNCTION_URL);
  const supabaseAnonKey = requiredProperty_(properties, CONFIG_KEYS.SUPABASE_ANON_KEY);
  const ingestSecret = requiredProperty_(properties, CONFIG_KEYS.INGEST_SECRET);

  return {
    functionUrl,
    supabaseAnonKey,
    ingestSecret,
    gmailQuery:
      properties.getProperty(CONFIG_KEYS.GMAIL_QUERY) ||
      'in:inbox has:attachment filename:csv -label:csv-ingestado -label:csv-ingestao-erro',
    successLabel: properties.getProperty(CONFIG_KEYS.SUCCESS_LABEL) || 'csv-ingestado',
    errorLabel: properties.getProperty(CONFIG_KEYS.ERROR_LABEL) || 'csv-ingestao-erro',
    batchSize: Number(properties.getProperty(CONFIG_KEYS.BATCH_SIZE) || '20'),
    pipelineHint: properties.getProperty(CONFIG_KEYS.PIPELINE_HINT) || 'auto',
  };
}

function requiredProperty_(properties, key) {
  const value = properties.getProperty(key);
  if (!value) {
    throw new Error('Defina a propriedade de script obrigatoria: ' + key);
  }
  return value;
}

function getOrCreateLabel_(name) {
  if (!name) return null;
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function parseResponseBody_(response) {
  const raw = response.getContentText();
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { error: raw || 'Resposta nao-JSON da Edge Function.' };
  }
}
