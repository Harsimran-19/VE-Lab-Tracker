/* Bound Google Apps Script. Enable the advanced Google Sheets API service.
 * All production instances MUST use this one writer. See COLLABORATION_SETUP.md.
 */
function doPost(event) {
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    var config = PropertiesService.getScriptProperties();
    var secret = config.getProperty('TRANSACTION_KEY');
    var sheetId = config.getProperty('SPREADSHEET_ID');
    if (!secret || secret.length < 32 || !sheetId) return result_({ ok: false });
    var envelope = JSON.parse(event.postData.contents);
    if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') return result_({ ok: false });
    var signature = Utilities.computeHmacSha256Signature(envelope.payload, secret).map(function(b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
    var mismatch = signature.length ^ envelope.signature.length;
    for (var i = 0; i < signature.length; i++) mismatch |= signature.charCodeAt(i) ^ (envelope.signature.charCodeAt(i) || 0);
    if (mismatch) return result_({ ok: false });
    var input = JSON.parse(envelope.payload);
    if (input.schema !== 1 || input.sheetId !== sheetId || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || (!Number.isSafeInteger(input.issuedAt) || Math.abs(Date.now() - input.issuedAt) > 60000)) return result_({ ok: false });
    acquired = lock.tryLock(10000);
    if (!acquired) return result_({ ok: false });
    var book = SpreadsheetApp.openById(sheetId);
    var revisionSheet = book.getSheetByName('LabRevision');
    if (!revisionSheet || revisionSheet.getRange(1,1,1,2).getValues()[0].join(',') !== 'id,version') return result_({ ok: false });
    var revisionRow = revisionSheet.getRange(2,1,1,2).getValues()[0];
    var revision = Number(revisionRow[1] || 0);
    if (!Number.isSafeInteger(revision) || revision < 0 || (revisionRow[0] && revisionRow[0] !== 'lab')) return result_({ ok: false });
    if (revision !== input.expectedRevision) return result_({ ok: false, conflict: true });
    var tables = ['LabProjects','LabMemberships','LabReports','LabFolders','LabActivity','LabInvitations'];
    if (Object.keys(input.data).sort().join(',') !== tables.slice().sort().join(',')) return result_({ ok: false });
    var requests = [];
    tables.forEach(function(title) {
      var tab = book.getSheetByName(title);
      var headers = input.headers[title];
      if (!tab || !Array.isArray(headers) || headers[0] !== 'id' || tab.getRange(1,1,1,headers.length).getValues()[0].join('\u0000') !== headers.join('\u0000')) throw new Error('Schema mismatch');
      var rows = input.data[title];
      if (!Array.isArray(rows) || rows.some(function(r) { return !Array.isArray(r) || r.length !== headers.length || r.some(function(v) { return typeof v !== 'string' || v.length > 45000; }); })) throw new Error('Invalid rows');
      var ids = rows.map(function(r) { return r[0]; });
      if (ids.some(function(id) { return !id; }) || new Set(ids).size !== ids.length) throw new Error('Duplicate IDs');
      if (title === 'LabActivity' && tab.getLastRow() > 1) {
        var previousIds = new Set(tab.getRange(2,1,tab.getLastRow()-1,1).getValues().map(function(r) { return r[0]; }));
        if (ids.some(function(id) { return previousIds.has(id); })) throw new Error('Historical activity IDs cannot be reused');
      }
      var start = title === 'LabActivity' ? tab.getLastRow() : 1;
      var end = Math.max(start + rows.length, title === 'LabActivity' ? start : tab.getLastRow());
      if (end > tab.getMaxRows()) requests.push({ appendDimension: { sheetId: tab.getSheetId(), dimension: 'ROWS', length: end - tab.getMaxRows() } });
      if (end > start) requests.push({ updateCells: {
        range: { sheetId: tab.getSheetId(), startRowIndex: start, endRowIndex: end, startColumnIndex: 0, endColumnIndex: headers.length },
        rows: rows.map(function(row) { return { values: row.map(function(value) { return { userEnteredValue: { stringValue: value } }; }) }; }),
        fields: 'userEnteredValue'
      } });
    });
    requests.push({ updateCells: { range: { sheetId: revisionSheet.getSheetId(), startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 }, rows: [{ values: [{ userEnteredValue: { stringValue: 'lab' } }, { userEnteredValue: { stringValue: String(revision + 1) } }] }], fields: 'userEnteredValue' } });
    // Sheets batchUpdate is atomic: any invalid request rolls back the entire
    // batch, including the data, append-only audit rows and revision increment.
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, sheetId);
    return result_({ ok: true, revision: revision + 1 });
  } catch (_) {
    // Never disclose credentials, payloads or upstream exception text.
    return result_({ ok: false });
  } finally {
    if (acquired) lock.releaseLock();
  }
}
function result_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
