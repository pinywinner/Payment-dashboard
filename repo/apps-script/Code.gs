/**
 * Server-side gateway for one master sheet holding every client.
 *
 * The sheet stays PRIVATE. This script is the only way out, and it
 * returns exactly one client's rows — the filtering happens here,
 * before anything leaves Google, so a client cannot see other clients.
 *
 * Install: Extensions -> Apps Script, paste this, Deploy -> New deployment
 * -> Web app -> Execute as: Me -> Who has access: Anyone.
 * Copy the /exec URL into each client's index.html as apiUrl.
 */

var TABS = {
  clients:   'Clients',
  payments:  'Payments',
  contracts: 'Contracts',
  schedule:  'Schedule',
  config:    'Config'
};

function doGet(e) {
  var callback = (e && e.parameter && e.parameter.callback) || null;
  var payload;

  try {
    payload = build_((e && e.parameter && e.parameter.token) || '');
  } catch (err) {
    payload = { error: String(err && err.message ? err.message : err) };
  }

  var json = JSON.stringify(payload);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function build_(token) {
  if (!token) throw new Error('Missing token.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var clients = rows_(ss, TABS.clients);
  var match = null;
  for (var i = 0; i < clients.length; i++) {
    var active = String(clients[i].active || '').toLowerCase();
    if (String(clients[i].token) === token && active !== 'no' && active !== 'false') {
      match = clients[i];
      break;
    }
  }
  if (!match) throw new Error('Unknown or disabled token.');

  var client = String(match.client);

  return {
    client:    client,
    payments:  forClient_(rows_(ss, TABS.payments),  client),
    contracts: forClient_(rows_(ss, TABS.contracts), client),
    schedule:  forClient_(rows_(ss, TABS.schedule),  client),
    config:    forClient_(rows_(ss, TABS.config),    client)
  };
}

/** Reads a tab into objects keyed by lower-cased header. */
function rows_(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('Missing tab: ' + tabName);

  var values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {}, hasData = false;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = String(values[r][c]).trim();
      obj[headers[c]] = v;
      if (v) hasData = true;
    }
    if (hasData) out.push(obj);
  }
  return out;
}

/**
 * Keeps rows belonging to this client.
 * A blank Client cell inherits the client above it, so continuation
 * rows (a schedule month with several line items) work unchanged.
 */
function forClient_(rows, client) {
  var out = [], current = '';
  for (var i = 0; i < rows.length; i++) {
    var c = rows[i].client;
    if (c) current = c;
    if (current === client) {
      var copy = {};
      for (var k in rows[i]) if (k !== 'client') copy[k] = rows[i][k];
      out.push(copy);
    }
  }
  return out;
}
