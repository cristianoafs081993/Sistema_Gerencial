function diagnosticarIngestaoCsv() {
  var props = PropertiesService.getScriptProperties();

  var functionUrl = prop_(props, 'SUPABASE_FUNCTION_URL');
  var anonKey = prop_(props, 'SUPABASE_ANON_KEY');
  var ingestSecret = prop_(props, 'EMAIL_CSV_INGEST_SECRET');
  var query =
    propOptional_(props, 'GMAIL_CSV_QUERY') ||
    'in:inbox has:attachment filename:csv -label:csv-ingestado -label:csv-ingestao-erro';
  var batchSize = Number(propOptional_(props, 'GMAIL_CSV_BATCH_SIZE') || '20');
  var expectedPath = '/functions/v1/ingest-email-csv';

  Logger.log('=== Diagnostico ingestao CSV ===');
  Logger.log('SUPABASE_FUNCTION_URL=%s', functionUrl);
  Logger.log('URL termina com function path=%s', functionUrl.indexOf(expectedPath) !== -1);
  Logger.log('SUPABASE_ANON_KEY=%s', mask_(anonKey));
  Logger.log('EMAIL_CSV_INGEST_SECRET=%s', mask_(ingestSecret));
  Logger.log('GMAIL_CSV_QUERY=%s', query);
  Logger.log('GMAIL_CSV_BATCH_SIZE=%s', batchSize);

  if (functionUrl.indexOf(expectedPath) === -1) {
    Logger.log('ERRO: SUPABASE_FUNCTION_URL deve terminar com %s', expectedPath);
  }

  if (anonKey.split('.').length !== 3) {
    Logger.log('ERRO: SUPABASE_ANON_KEY nao parece ser JWT valido');
  }

  var threads = GmailApp.search(query, 0, batchSize);
  Logger.log('Threads encontradas pelo Gmail=%s', threads.length);

  if (threads.length > 0) {
    var messages = threads[0].getMessages();
    var csvs = 0;
    for (var i = 0; i < messages.length; i++) {
      var attachments = messages[i].getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      });
      for (var j = 0; j < attachments.length; j++) {
        if (/\.csv$/i.test(attachments[j].getName())) csvs++;
      }
    }
    Logger.log('CSVs na primeira thread=%s', csvs);
  }

  var response = UrlFetchApp.fetch(functionUrl, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + anonKey,
      apikey: anonKey,
      'x-email-ingest-secret': ingestSecret
    },
    payload: JSON.stringify({
      messageId: 'diagnostico-' + new Date().toISOString()
    })
  });

  var status = response.getResponseCode();
  var body = response.getContentText();
  Logger.log('HTTP status=%s', status);
  Logger.log('HTTP body=%s', body);

  if (status === 400 && body.indexOf('attachment') !== -1) {
    Logger.log('RESULTADO: configuracao OK. O 400 e esperado porque nao enviamos anexo.');
  } else if (status === 401) {
    Logger.log('RESULTADO: erro de autenticacao. Provavel EMAIL_CSV_INGEST_SECRET incorreto.');
  } else if (status === 404) {
    Logger.log('RESULTADO: URL incorreta ou function nao publicada.');
  } else {
    Logger.log('RESULTADO: resposta inesperada; veja status e body acima.');
  }
}

function testarQueriesGmailCsv() {
  var queries = [
    'has:attachment',
    'filename:csv',
    'has:attachment filename:csv',
    'in:inbox has:attachment filename:csv',
    'inbox has:attachment filename:csv',
    'has:attachment filename:csv -label:csv-ingestado -label:csv-ingestao-erro',
    'in:inbox has:attachment filename:csv -label:csv-ingestado -label:csv-ingestao-erro',
    'in:anywhere has:attachment filename:csv -label:csv-ingestado -label:csv-ingestao-erro',
    'newer_than:30d has:attachment filename:csv -label:csv-ingestado -label:csv-ingestao-erro'
  ];

  Logger.log('=== Teste de queries Gmail CSV ===');

  for (var i = 0; i < queries.length; i++) {
    var query = queries[i];
    var threads = GmailApp.search(query, 0, 10);
    Logger.log('QUERY [%s] => threads=%s', query, threads.length);

    if (threads.length > 0) {
      var firstMessage = threads[0].getMessages()[0];
      Logger.log(
        '  primeira thread | subject="%s" | from="%s" | labels="%s"',
        firstMessage.getSubject(),
        firstMessage.getFrom(),
        getThreadLabelNamesForDiagnostic_(threads[0])
      );
    }
  }
}

function prop_(props, key) {
  var value = String(props.getProperty(key) || '').trim();
  if (!value) throw new Error('Propriedade obrigatoria ausente: ' + key);
  return value;
}

function propOptional_(props, key) {
  return String(props.getProperty(key) || '').trim();
}

function mask_(value) {
  if (!value) return 'MISSING';
  if (value.length <= 8) return 'SET(len=' + value.length + ')';
  return 'SET(len=' + value.length + ', first4=' + value.slice(0, 4) + ', last4=' + value.slice(-4) + ')';
}

function getThreadLabelNamesForDiagnostic_(thread) {
  var labels = thread.getLabels();
  var names = [];

  for (var i = 0; i < labels.length; i++) {
    names.push(labels[i].getName());
  }

  return names.join(',') || '(sem labels)';
}
