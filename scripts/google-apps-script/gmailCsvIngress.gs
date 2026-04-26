var CONFIG_KEYS = {
  FUNCTION_URL: 'SUPABASE_FUNCTION_URL',
  SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
  INGEST_SECRET: 'EMAIL_CSV_INGEST_SECRET',
  GMAIL_QUERY: 'GMAIL_CSV_QUERY',
  SUCCESS_LABEL: 'GMAIL_CSV_SUCCESS_LABEL',
  ERROR_LABEL: 'GMAIL_CSV_ERROR_LABEL',
  BATCH_SIZE: 'GMAIL_CSV_BATCH_SIZE',
  PIPELINE_HINT: 'GMAIL_CSV_PIPELINE_HINT'
};

var EXPECTED_FUNCTION_PATH = '/functions/v1/ingest-email-csv';

function diagnoseCsvEmailIngestion() {
  Logger.log('=== Diagnostico da ingestao CSV por e-mail ===');

  var config = loadConfig_();
  logConfigSummary_(config);

  var threads = GmailApp.search(config.gmailQuery, 0, config.batchSize);
  Logger.log(
    'Gmail search OK | query="%s" | batchSize=%s | threadsEncontradas=%s',
    config.gmailQuery,
    config.batchSize,
    threads.length
  );

  if (threads.length > 0) {
    var firstThread = threads[0];
    var messages = firstThread.getMessages();
    var csvCount = 0;

    for (var i = 0; i < messages.length; i += 1) {
      csvCount += getCsvAttachments_(messages[i]).length;
    }

    Logger.log(
      'Primeira thread | id=%s | labels=%s | anexosCsv=%s',
      firstThread.getId(),
      getThreadLabelNames_(firstThread),
      csvCount
    );
  }

  var response = sendDiagnosticRequestToSupabase_(config);
  var payload = parseResponseBody_(response);
  var statusCode = response.getResponseCode();
  var body = response.getContentText();

  Logger.log('Teste HTTP da Edge Function | status=%s | body=%s', statusCode, body);

  if (statusCode === 400 && payload.error && String(payload.error).indexOf('attachment') !== -1) {
    Logger.log('RESULTADO: configuracao OK. O 400 e esperado porque o diagnostico nao envia anexo.');
    return;
  }

  if (statusCode === 401) {
    Logger.log(
      'RESULTADO: falha de autenticacao. Se o body disser "Segredo de ingestao ausente ou invalido", o problema e o EMAIL_CSV_INGEST_SECRET.'
    );
    return;
  }

  if (statusCode === 404) {
    Logger.log(
      'RESULTADO: URL incorreta ou function nao publicada. SUPABASE_FUNCTION_URL deve terminar com %s.',
      EXPECTED_FUNCTION_PATH
    );
    return;
  }

  Logger.log('RESULTADO: resposta inesperada. Veja status e body acima.');
}

function ingestCsvEmails() {
  var config = loadConfig_();
  logConfigSummary_(config);

  var successLabel = getOrCreateLabel_(config.successLabel);
  var errorLabel = getOrCreateLabel_(config.errorLabel);
  var threads = GmailApp.search(config.gmailQuery, 0, config.batchSize);

  Logger.log(
    'Iniciando ingestao | query="%s" | batchSize=%s | threadsEncontradas=%s',
    config.gmailQuery,
    config.batchSize,
    threads.length
  );

  for (var t = 0; t < threads.length; t += 1) {
    var thread = threads[t];
    var threadSucceeded = true;
    var threadHadCsv = false;
    var messages = thread.getMessages();

    for (var m = 0; m < messages.length; m += 1) {
      var message = messages[m];
      var attachments = getCsvAttachments_(message);

      if (!attachments.length) {
        continue;
      }

      threadHadCsv = true;
      Logger.log(
        'Mensagem com CSV | messageId=%s | subject="%s" | anexosCsv=%s',
        message.getId(),
        message.getSubject(),
        attachments.length
      );

      for (var a = 0; a < attachments.length; a += 1) {
        var attachment = attachments[a];
        var response = sendAttachmentToSupabase_(config, message, thread, attachment);
        var payload = parseResponseBody_(response);
        var statusCode = response.getResponseCode();
        var body = response.getContentText();

        Logger.log(
          'Resposta da Edge Function | arquivo="%s" | status=%s | body=%s',
          attachment.getName(),
          statusCode,
          body
        );

        if (statusCode >= 200 && statusCode < 300) {
          Logger.log(
            'CSV aceito pela function: %s | responseStatus=%s | pipeline=%s | rowsWritten=%s | runId=%s',
            attachment.getName(),
            payload.status || 'sem-status',
            payload.pipeline || 'auto',
            payload.rowsWritten || 0,
            payload.runId || '(sem runId)'
          );
          continue;
        }

        threadSucceeded = false;
        Logger.log('Falha ao processar %s: %s', attachment.getName(), payload.error || body);
      }
    }

    if (threadSucceeded && threadHadCsv) {
      thread.addLabel(successLabel);
      if (errorLabel) {
        thread.removeLabel(errorLabel);
      }
      thread.markRead();
      continue;
    }

    if (!threadSucceeded && errorLabel) {
      thread.addLabel(errorLabel);
    }
  }
}

function sendAttachmentToSupabase_(config, message, thread, attachment) {
  var payload = {
    messageId: message.getId(),
    threadId: thread.getId(),
    subject: message.getSubject(),
    from: message.getFrom(),
    to: message.getTo(),
    receivedAt: message.getDate().toISOString(),
    pipelineHint: config.pipelineHint,
    gmailLabels: getThreadLabelArray_(thread),
    attachment: {
      fileName: attachment.getName(),
      mimeType: attachment.getContentType(),
      contentBase64: Utilities.base64Encode(attachment.getBytes())
    }
  };

  return UrlFetchApp.fetch(config.functionUrl, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + config.supabaseAnonKey,
      apikey: config.supabaseAnonKey,
      'x-email-ingest-secret': config.ingestSecret
    },
    payload: JSON.stringify(payload)
  });
}

function sendDiagnosticRequestToSupabase_(config) {
  return UrlFetchApp.fetch(config.functionUrl, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + config.supabaseAnonKey,
      apikey: config.supabaseAnonKey,
      'x-email-ingest-secret': config.ingestSecret
    },
    payload: JSON.stringify({
      messageId: 'diagnostic-' + new Date().toISOString()
    })
  });
}

function loadConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var functionUrl = requiredProperty_(properties, CONFIG_KEYS.FUNCTION_URL);
  var supabaseAnonKey = requiredProperty_(properties, CONFIG_KEYS.SUPABASE_ANON_KEY);
  var ingestSecret = requiredProperty_(properties, CONFIG_KEYS.INGEST_SECRET);

  return {
    functionUrl: functionUrl,
    supabaseAnonKey: supabaseAnonKey,
    ingestSecret: ingestSecret,
    gmailQuery:
      String(properties.getProperty(CONFIG_KEYS.GMAIL_QUERY) || '').trim() ||
      'in:inbox has:attachment filename:csv -label:csv-ingestado -label:csv-ingestao-erro',
    successLabel: String(properties.getProperty(CONFIG_KEYS.SUCCESS_LABEL) || '').trim() || 'csv-ingestado',
    errorLabel: String(properties.getProperty(CONFIG_KEYS.ERROR_LABEL) || '').trim() || 'csv-ingestao-erro',
    batchSize: Number(properties.getProperty(CONFIG_KEYS.BATCH_SIZE) || '20'),
    pipelineHint: String(properties.getProperty(CONFIG_KEYS.PIPELINE_HINT) || '').trim() || 'auto'
  };
}

function requiredProperty_(properties, key) {
  var value = String(properties.getProperty(key) || '').trim();
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
  var raw = response.getContentText();
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { error: raw || 'Resposta nao-JSON da Edge Function.' };
  }
}

function getCsvAttachments_(message) {
  return message
    .getAttachments({ includeInlineImages: false, includeAttachments: true })
    .filter(function (attachment) {
      return /\.csv$/i.test(attachment.getName());
    });
}

function getThreadLabelArray_(thread) {
  var labels = thread.getLabels();
  var names = [];

  for (var i = 0; i < labels.length; i += 1) {
    names.push(labels[i].getName());
  }

  return names;
}

function getThreadLabelNames_(thread) {
  var names = getThreadLabelArray_(thread);
  return names.join(',') || '(sem labels)';
}

function logConfigSummary_(config) {
  var hasFunctionPath = String(config.functionUrl).indexOf(EXPECTED_FUNCTION_PATH) !== -1;

  Logger.log(
    'Config | functionUrl=%s | terminaComFunctionPath=%s | anonKey=%s | ingestSecret=%s | successLabel=%s | errorLabel=%s | pipelineHint=%s',
    config.functionUrl,
    hasFunctionPath,
    describeSecret_(config.supabaseAnonKey),
    describeSecret_(config.ingestSecret),
    config.successLabel || '(sem label)',
    config.errorLabel || '(sem label)',
    config.pipelineHint
  );

  if (!hasFunctionPath) {
    Logger.log(
      'ERRO DE CONFIG: SUPABASE_FUNCTION_URL deve ser a URL completa da Edge Function e terminar com %s.',
      EXPECTED_FUNCTION_PATH
    );
  }

  if (config.supabaseAnonKey.split('.').length !== 3) {
    Logger.log('ERRO DE CONFIG: SUPABASE_ANON_KEY nao parece ser um JWT valido.');
  }
}

function describeSecret_(value) {
  if (!value) return 'MISSING';
  if (value.length <= 8) return 'SET(len=' + value.length + ')';
  return 'SET(len=' + value.length + ', first4=' + value.slice(0, 4) + ', last4=' + value.slice(-4) + ')';
}
