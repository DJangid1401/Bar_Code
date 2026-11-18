// =========================================================================
// QR Inventory System - Google Apps Script Web App Backend
// =========================================================================
// SETUP INSTRUCTIONS:
// 1. Open Google Sheets -> Create a new spreadsheet (e.g. "QR Inventory")
// 2. Menu: Extensions -> Apps Script
// 3. Delete any existing code and paste this ENTIRE file
// 4. Click Save (Ctrl + S)
// 5. Click "Deploy" -> "New deployment"
//    - Select type: "Web app"
//    - Description: "QR Inventory API"
//    - Execute as: "Me"
//    - Who has access: "Anyone"
// 6. Click "Deploy" -> Authorize access -> Copy the Web App URL (ends with /exec)
// 7. Paste that URL into .env.local as VITE_GOOGLE_SHEET_URL=...
// =========================================================================

var STOCK_SHEET_NAME = 'Stock';
var LOGS_SHEET_NAME = 'Transactions';

var STOCK_HEADERS = [
  'Unique Code',
  'Product Name',
  'Size',
  'Color',
  'Total IN',
  'Total OUT',
  'Remaining Stock',
  'Unit',
  'Updated By',
  'Updated At',
];

var LOG_HEADERS = [
  'ID',
  'Type',
  'Unique Code',
  'Product Name',
  'Size',
  'Color',
  'Qty',
  'Unit',
  'Source',
  'Done By',
  'Timestamp',
];

function getOrCreateSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var stockSheet = ss.getSheetByName(STOCK_SHEET_NAME);
  if (!stockSheet) {
    stockSheet = ss.insertSheet(STOCK_SHEET_NAME);
    stockSheet.appendRow(STOCK_HEADERS);
    stockSheet.getRange(1, 1, 1, STOCK_HEADERS.length).setFontWeight('bold');
    stockSheet.setFrozenRows(1);
  } else if (stockSheet.getLastRow() === 0) {
    stockSheet.appendRow(STOCK_HEADERS);
    stockSheet.getRange(1, 1, 1, STOCK_HEADERS.length).setFontWeight('bold');
    stockSheet.setFrozenRows(1);
  }

  var logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(LOGS_SHEET_NAME);
    logsSheet.appendRow(LOG_HEADERS);
    logsSheet.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
    logsSheet.setFrozenRows(1);
  } else if (logsSheet.getLastRow() === 0) {
    logsSheet.appendRow(LOG_HEADERS);
    logsSheet.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
    logsSheet.setFrozenRows(1);
  }

  return { stockSheet: stockSheet, logsSheet: logsSheet };
}

function normalizeUnit(unit) {
  var u = String(unit || '').trim().toUpperCase();
  if (u === 'KG' || u === 'KGS' || u === 'KILOGRAM' || u === 'KILOGRAMS') {
    return 'KGS';
  }
  if (u === 'PAC' || u === 'PACK' || u === 'PACKS' || u === 'PKT' || u === 'PACKET' || u === 'PACKETS') {
    return 'PAC';
  }
  return 'PCS';
}

function readAllData() {
  var sheets = getOrCreateSheets();
  var stockValues = sheets.stockSheet.getDataRange().getValues();
  var logValues = sheets.logsSheet.getDataRange().getValues();

  var items = [];
  for (var i = 1; i < stockValues.length; i++) {
    var row = stockValues[i];
    var barcode = String(row[0] || '').trim();
    if (!barcode) continue;
    items.push({
      barcode: barcode,
      name: String(row[1] || '').trim(),
      size: String(row[2] || '').trim(),
      color: String(row[3] || '').trim(),
      totalIn: Number(row[4]) || 0,
      totalOut: Number(row[5]) || 0,
      stock: Number(row[6]) || 0,
      unit: normalizeUnit(row[7]),
      updatedBy: String(row[8] || '').trim(),
      updatedAt: Number(row[9]) || Date.now(),
    });
  }

  // Sort most recently updated first
  items.sort(function (a, b) {
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  var logs = [];
  for (var j = 1; j < logValues.length; j++) {
    var lrow = logValues[j];
    var id = String(lrow[0] || '').trim();
    if (!id) continue;
    logs.push({
      id: id,
      type: String(lrow[1] || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN',
      barcode: String(lrow[2] || '').trim(),
      name: String(lrow[3] || '').trim(),
      size: String(lrow[4] || '').trim(),
      color: String(lrow[5] || '').trim(),
      qty: Number(lrow[6]) || 1,
      unit: normalizeUnit(lrow[7]),
      source: String(lrow[8] || 'MANUAL'),
      doneBy: String(lrow[9] || '').trim(),
      timestamp: Number(lrow[10]) || Date.now(),
    });
  }

  // Sort newest logs first
  logs.sort(function (a, b) {
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return { items: items, logs: logs };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// GET -> Read all stock items and transaction logs
function doGet() {
  try {
    var data = readAllData();
    return jsonResponse({
      success: true,
      items: data.items,
      logs: data.logs,
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      message: 'GET Error: ' + err.toString(),
    });
  }
}

// POST -> Add, Update, Out, Bulk Import, or Delete
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 15 seconds for concurrent users (Person A & Person B)
    lock.waitLock(15000);

    var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(rawBody);
    var action = String(body.action || '').toUpperCase();
    var payload = body.payload || {};

    var sheets = getOrCreateSheets();
    var stockSheet = sheets.stockSheet;
    var logsSheet = sheets.logsSheet;
    var now = Date.now();

    if (action === 'SCAN_IN') {
      var barcode = String(payload.barcode || '').trim();
      var name = String(payload.name || '').trim();
      var size = String(payload.size || '').trim();
      var color = String(payload.color || '').trim();
      var qty = Math.max(1, Number(payload.qty) || 1);
      var unit = normalizeUnit(payload.unit);
      var source = String(payload.source || 'MANUAL');
      var doneBy = String(payload.doneBy || '').trim();

      if (!barcode || !name) {
        return jsonResponse({
          success: false,
          message: 'Unique Code and Product Name are required.',
        });
      }

      var stockData = stockSheet.getDataRange().getValues();
      var foundRowIndex = -1;
      for (var i = 1; i < stockData.length; i++) {
        if (String(stockData[i][0] || '').trim().toLowerCase() === barcode.toLowerCase()) {
          foundRowIndex = i + 1; // 1-indexed sheet row
          break;
        }
      }

      var savedItem;
      if (foundRowIndex !== -1) {
        var existingRow = stockData[foundRowIndex - 1];
        var newTotalIn = (Number(existingRow[4]) || 0) + qty;
        var existingTotalOut = Number(existingRow[5]) || 0;
        var newStock = (Number(existingRow[6]) || 0) + qty;
        var resolvedCode = String(existingRow[0]).trim();
        var resolvedName = name || String(existingRow[1]).trim();
        var resolvedSize = size || String(existingRow[2] || '').trim();
        var resolvedColor = color || String(existingRow[3] || '').trim();
        var resolvedUnit = normalizeUnit(unit || existingRow[7]);

        stockSheet
          .getRange(foundRowIndex, 1, 1, STOCK_HEADERS.length)
          .setValues([
            [
              resolvedCode,
              resolvedName,
              resolvedSize,
              resolvedColor,
              newTotalIn,
              existingTotalOut,
              newStock,
              resolvedUnit,
              doneBy,
              now,
            ],
          ]);

        savedItem = {
          barcode: resolvedCode,
          name: resolvedName,
          size: resolvedSize,
          color: resolvedColor,
          totalIn: newTotalIn,
          totalOut: existingTotalOut,
          stock: newStock,
          unit: resolvedUnit,
          updatedBy: doneBy,
          updatedAt: now,
        };
      } else {
        stockSheet.appendRow([
          barcode,
          name,
          size,
          color,
          qty,
          0,
          qty,
          unit,
          doneBy,
          now,
        ]);

        savedItem = {
          barcode: barcode,
          name: name,
          size: size,
          color: color,
          totalIn: qty,
          totalOut: 0,
          stock: qty,
          unit: unit,
          updatedBy: doneBy,
          updatedAt: now,
        };
      }

      var logId = Utilities.getUuid();
      logsSheet.appendRow([
        logId,
        'IN',
        savedItem.barcode,
        savedItem.name,
        savedItem.size,
        savedItem.color,
        qty,
        savedItem.unit,
        source,
        doneBy,
        now,
      ]);

      var updatedAll = readAllData();
      return jsonResponse({
        success: true,
        message: 'Success: +' + qty + ' ' + savedItem.unit + ' of ' + savedItem.name + ' added to Stock IN.',
        item: savedItem,
        items: updatedAll.items,
        logs: updatedAll.logs,
      });
    }

    if (action === 'SCAN_OUT') {
      var outCode = String(payload.barcode || '').trim();
      var outQty = Math.max(1, Number(payload.qty) || 1);
      var outBy = String(payload.doneBy || '').trim();

      if (!outCode) {
        return jsonResponse({ success: false, message: 'Product Code is required.' });
      }

      var sData = stockSheet.getDataRange().getValues();
      var rowIdx = -1;
      for (var k = 1; k < sData.length; k++) {
        if (String(sData[k][0] || '').trim().toLowerCase() === outCode.toLowerCase()) {
          rowIdx = k + 1;
          break;
        }
      }

      if (rowIdx === -1) {
        return jsonResponse({
          success: false,
          message: 'Error: Product not found in Google Sheet.',
        });
      }

      var currRow = sData[rowIdx - 1];
      var currStock = Number(currRow[6]) || 0;
      var currUnit = normalizeUnit(currRow[7]);
      var currName = String(currRow[1] || '').trim();

      if (currStock < outQty) {
        return jsonResponse({
          success: false,
          message:
            'Error: Insufficient stock! Available: ' +
            currStock +
            ' ' +
            currUnit +
            ', Requested: ' +
            outQty,
        });
      }

      var nextTotalOut = (Number(currRow[5]) || 0) + outQty;
      var nextStock = currStock - outQty;

      stockSheet
        .getRange(rowIdx, 1, 1, STOCK_HEADERS.length)
        .setValues([
          [
            currRow[0],
            currName,
            currRow[2] || '',
            currRow[3] || '',
            Number(currRow[4]) || 0,
            nextTotalOut,
            nextStock,
            currUnit,
            outBy,
            now,
          ],
        ]);

      logsSheet.appendRow([
        Utilities.getUuid(),
        'OUT',
        String(currRow[0]).trim(),
        currName,
        String(currRow[2] || '').trim(),
        String(currRow[3] || '').trim(),
        outQty,
        currUnit,
        'MANUAL',
        outBy,
        now,
      ]);

      var afterOut = readAllData();
      return jsonResponse({
        success: true,
        message: 'Success: -' + outQty + ' ' + currUnit + ' of ' + currName + ' dispatched (Stock OUT).',
        items: afterOut.items,
        logs: afterOut.logs,
      });
    }

    if (action === 'BULK_STOCK_IN') {
      var entries = payload.entries || [];
      var bulkBy = String(payload.doneBy || '').trim();
      if (!entries.length) {
        return jsonResponse({ success: false, message: 'No items provided for import.' });
      }

      var existingData = stockSheet.getDataRange().getValues();
      var codeToRowIndex = {};
      for (var r = 1; r < existingData.length; r++) {
        var existingCode = String(existingData[r][0] || '').trim().toLowerCase();
        if (existingCode) {
          codeToRowIndex[existingCode] = r + 1;
        }
      }

      var newStockRows = [];
      var newLogRows = [];
      var importedBarcodes = {};
      var processed = 0;

      for (var idx = 0; idx < entries.length; idx++) {
        var entry = entries[idx];
        var eCode = String(entry.barcode || '').trim();
        var eName = String(entry.name || '').trim();
        if (!eCode || !eName) continue;

        var eQty = Math.max(1, Number(entry.qty) || 1);
        var eSize = String(entry.size || '').trim();
        var eColor = String(entry.color || '').trim();
        var eUnit = normalizeUnit(entry.unit);
        var lowerCode = eCode.toLowerCase();
        var ts = now + idx;

        if (codeToRowIndex[lowerCode]) {
          var targetRow = codeToRowIndex[lowerCode];
          var rowArr = stockSheet.getRange(targetRow, 1, 1, STOCK_HEADERS.length).getValues()[0];
          var updIn = (Number(rowArr[4]) || 0) + eQty;
          var updOut = Number(rowArr[5]) || 0;
          var updStock = (Number(rowArr[6]) || 0) + eQty;
          stockSheet
            .getRange(targetRow, 1, 1, STOCK_HEADERS.length)
            .setValues([
              [
                rowArr[0],
                eName || rowArr[1],
                eSize || rowArr[2] || '',
                eColor || rowArr[3] || '',
                updIn,
                updOut,
                updStock,
                eUnit,
                bulkBy,
                ts,
              ],
            ]);
          importedBarcodes[String(rowArr[0]).trim().toLowerCase()] = true;
        } else {
          // Check if already queued in newStockRows
          var queuedIdx = -1;
          for (var q = 0; q < newStockRows.length; q++) {
            if (String(newStockRows[q][0]).toLowerCase() === lowerCode) {
              queuedIdx = q;
              break;
            }
          }
          if (queuedIdx !== -1) {
            newStockRows[queuedIdx][4] += eQty;
            newStockRows[queuedIdx][6] += eQty;
            newStockRows[queuedIdx][9] = ts;
          } else {
            newStockRows.push([
              eCode,
              eName,
              eSize,
              eColor,
              eQty,
              0,
              eQty,
              eUnit,
              bulkBy,
              ts,
            ]);
          }
          importedBarcodes[lowerCode] = true;
        }

        newLogRows.push([
          Utilities.getUuid(),
          'IN',
          eCode,
          eName,
          eSize,
          eColor,
          eQty,
          eUnit,
          'EXCEL_IMPORT',
          bulkBy,
          ts,
        ]);
        processed++;
      }

      if (newStockRows.length > 0) {
        stockSheet
          .getRange(stockSheet.getLastRow() + 1, 1, newStockRows.length, STOCK_HEADERS.length)
          .setValues(newStockRows);
      }

      if (newLogRows.length > 0) {
        logsSheet
          .getRange(logsSheet.getLastRow() + 1, 1, newLogRows.length, LOG_HEADERS.length)
          .setValues(newLogRows);
      }

      var afterBulk = readAllData();
      var importedItems = afterBulk.items.filter(function (it) {
        return !!importedBarcodes[it.barcode.toLowerCase()];
      });

      return jsonResponse({
        success: true,
        count: processed,
        message: 'Success: ' + processed + ' item(s) imported into Google Sheet.',
        importedItems: importedItems,
        items: afterBulk.items,
        logs: afterBulk.logs,
      });
    }

    if (action === 'UPDATE_ITEM') {
      var updCode = String(payload.barcode || '').trim();
      var updBy = String(payload.updatedBy || '').trim();
      var uData = stockSheet.getDataRange().getValues();
      var uRowIdx = -1;
      for (var u = 1; u < uData.length; u++) {
        if (String(uData[u][0] || '').trim().toLowerCase() === updCode.toLowerCase()) {
          uRowIdx = u + 1;
          break;
        }
      }

      if (uRowIdx === -1) {
        return jsonResponse({ success: false, message: 'Item not found in Google Sheet.' });
      }

      var oldRow = uData[uRowIdx - 1];
      var nextName = payload.name !== undefined ? String(payload.name).trim() : String(oldRow[1]);
      var nextSize = payload.size !== undefined ? String(payload.size).trim() : String(oldRow[2] || '');
      var nextColor = payload.color !== undefined ? String(payload.color).trim() : String(oldRow[3] || '');
      var nextStockVal =
        payload.stock !== undefined ? Math.max(0, Number(payload.stock) || 0) : Number(oldRow[6]) || 0;
      var nextUnitVal = normalizeUnit(payload.unit !== undefined ? payload.unit : oldRow[7]);

      stockSheet
        .getRange(uRowIdx, 1, 1, STOCK_HEADERS.length)
        .setValues([
          [
            oldRow[0],
            nextName,
            nextSize,
            nextColor,
            Number(oldRow[4]) || 0,
            Number(oldRow[5]) || 0,
            nextStockVal,
            nextUnitVal,
            updBy,
            now,
          ],
        ]);

      var afterUpd = readAllData();
      return jsonResponse({
        success: true,
        message: 'Product "' + nextName + '" updated in Google Sheet.',
        items: afterUpd.items,
        logs: afterUpd.logs,
      });
    }

    if (action === 'DELETE_ITEM') {
      var delCode = String(payload.barcode || '').trim();
      var dData = stockSheet.getDataRange().getValues();
      var dRowIdx = -1;
      var deletedName = delCode;
      for (var d = 1; d < dData.length; d++) {
        if (String(dData[d][0] || '').trim().toLowerCase() === delCode.toLowerCase()) {
          dRowIdx = d + 1;
          deletedName = String(dData[d][1] || delCode);
          break;
        }
      }

      if (dRowIdx === -1) {
        return jsonResponse({ success: false, message: 'Item not found in Google Sheet.' });
      }

      stockSheet.deleteRow(dRowIdx);
      var afterDel = readAllData();
      return jsonResponse({
        success: true,
        message: 'Product "' + deletedName + '" deleted from Google Sheet.',
        items: afterDel.items,
        logs: afterDel.logs,
      });
    }

    if (action === 'DELETE_LOG') {
      var delLogId = String(payload.id || '').trim();
      var lData = logsSheet.getDataRange().getValues();
      var lRowIdx = -1;
      for (var m = 1; m < lData.length; m++) {
        if (String(lData[m][0] || '').trim() === delLogId) {
          lRowIdx = m + 1;
          break;
        }
      }

      if (lRowIdx !== -1) {
        logsSheet.deleteRow(lRowIdx);
      }

      var afterLogDel = readAllData();
      return jsonResponse({
        success: true,
        message: 'Transaction log deleted from Google Sheet.',
        items: afterLogDel.items,
        logs: afterLogDel.logs,
      });
    }

    return jsonResponse({ success: false, message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({
      success: false,
      message: 'POST Error: ' + err.toString(),
    });
  } finally {
    lock.releaseLock();
  }
}
