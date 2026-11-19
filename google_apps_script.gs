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
var USERS_SHEET_NAME = 'Users';
var CUSTOMERS_SHEET_NAME = 'Customers';

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
  'Price',
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
  'Customer Name',
  'Price',
  'Total Amount',
];

var USER_HEADERS = [
  'ID',
  'Name',
  'Username',
  'Password',
  'Role',
  'Created At',
];

var CUSTOMER_HEADERS = [
  'ID',
  'Name',
  'GST',
  'Phone',
  'Address',
  'PAN',
  'Created At',
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

  var usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(USERS_SHEET_NAME);
    usersSheet.appendRow(USER_HEADERS);
    usersSheet.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight('bold');
    usersSheet.setFrozenRows(1);
    usersSheet.appendRow([
      'admin-default',
      'Admin',
      'admin',
      'admin123',
      'Admin',
      Date.now(),
    ]);
  } else if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(USER_HEADERS);
    usersSheet.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight('bold');
    usersSheet.setFrozenRows(1);
    usersSheet.appendRow([
      'admin-default',
      'Admin',
      'admin',
      'admin123',
      'Admin',
      Date.now(),
    ]);
  }

  var customersSheet = ss.getSheetByName(CUSTOMERS_SHEET_NAME);
  if (!customersSheet) {
    customersSheet = ss.insertSheet(CUSTOMERS_SHEET_NAME);
    customersSheet.appendRow(CUSTOMER_HEADERS);
    customersSheet.getRange(1, 1, 1, CUSTOMER_HEADERS.length).setFontWeight('bold');
    customersSheet.setFrozenRows(1);
  } else if (customersSheet.getLastRow() === 0) {
    customersSheet.appendRow(CUSTOMER_HEADERS);
    customersSheet.getRange(1, 1, 1, CUSTOMER_HEADERS.length).setFontWeight('bold');
    customersSheet.setFrozenRows(1);
  }

  return {
    stockSheet: stockSheet,
    logsSheet: logsSheet,
    usersSheet: usersSheet,
    customersSheet: customersSheet,
  };
}

function readAllCustomers(customersSheet) {
  var values = customersSheet.getDataRange().getValues();
  var customers = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var id = String(r[0] || '').trim();
    var name = String(r[1] || '').trim();
    var gst = String(r[2] || '').trim();
    if (!id || !name || !gst) continue;
    customers.push({
      id: id,
      name: name,
      gst: gst,
      phone: String(r[3] || '').trim(),
      address: String(r[4] || '').trim(),
      pan: String(r[5] || '').trim(),
      createdAt: Number(r[6]) || Date.now(),
    });
  }
  customers.sort(function (a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return customers;
}

function readAllUsers(usersSheet) {
  var values = usersSheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var id = String(r[0] || '').trim();
    var username = String(r[2] || '').trim();
    if (!id || !username) continue;
    users.push({
      id: id,
      name: String(r[1] || username).trim(),
      username: username,
      password: String(r[3] || ''),
      role: String(r[4] || 'Staff').trim() === 'Admin' ? 'Admin' : 'Staff',
      createdAt: Number(r[5]) || Date.now(),
    });
  }
  return users;
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

function roundQty(val) {
  return Math.round((Number(val) || 0) * 1000) / 1000;
}

function resolveStockValue(rawStockCell, totalInVal, totalOutVal) {
  if (rawStockCell === '' || rawStockCell === null || rawStockCell === undefined) {
    return roundQty(Math.max(0, (Number(totalInVal) || 0) - (Number(totalOutVal) || 0)));
  }
  return roundQty(Math.max(0, Number(rawStockCell) || 0));
}

function readAllData() {
  var sheets = getOrCreateSheets();
  var stockValues = sheets.stockSheet.getDataRange().getValues();
  var logValues = sheets.logsSheet.getDataRange().getValues();

  var stockHeaders = stockValues.length > 0 ? stockValues[0] : [];
  var colMap = {};
  for (var c = 0; c < stockHeaders.length; c++) {
    colMap[String(stockHeaders[c] || '').trim().toLowerCase()] = c;
  }

  function findCol(aliases, fallback) {
    for (var a = 0; a < aliases.length; a++) {
      var k = aliases[a].toLowerCase();
      if (colMap[k] !== undefined) return colMap[k];
    }
    for (var hName in colMap) {
      for (var b = 0; b < aliases.length; b++) {
        if (hName.indexOf(aliases[b].toLowerCase()) !== -1) {
          return colMap[hName];
        }
      }
    }
    return fallback;
  }

  var cBarcode = findCol(['barcode', 'unique code', 'code'], 0);
  var cName = findCol(['product name', 'name', 'product'], 1);
  var cSize = findCol(['size'], 2);
  var cColor = findCol(['color', 'colour'], 3);
  var cTotalIn = findCol(['total in', 'in'], 4);
  var cTotalOut = findCol(['total out', 'out'], 5);
  var cStock = findCol(['remaining stock', 'stock', 'balance', 'remaining'], 6);
  var cPrice = findCol(
    [
      'price per unit',
      'per unit price',
      'selling price per pcs',
      'selling price',
      'unit price',
      'price',
      'rate',
      'mrp',
    ],
    -1
  );
  var cUnit = findCol(['unit', 'uom'], 7);
  var cUpdatedBy = findCol(['updated by', 'done by', 'by'], 8);
  var cUpdatedAt = findCol(['updated at', 'timestamp', 'date'], 9);

  var items = [];
  for (var i = 1; i < stockValues.length; i++) {
    var row = stockValues[i];
    var barcode = String(row[cBarcode] || '').trim();
    if (!barcode) continue;
    var totalInVal = Number(row[cTotalIn]) || 0;
    var totalOutVal = Number(row[cTotalOut]) || 0;
    var stockVal = resolveStockValue(row[cStock], totalInVal, totalOutVal);

    var rawPrice = cPrice !== -1 ? row[cPrice] : undefined;
    var priceVal =
      rawPrice !== undefined &&
      rawPrice !== '' &&
      !isNaN(rawPrice) &&
      Number(rawPrice) < 100000000000
        ? roundQty(Number(rawPrice))
        : undefined;

    items.push({
      barcode: barcode,
      name: String(row[cName] || '').trim(),
      size: String(row[cSize] || '').trim(),
      color: String(row[cColor] || '').trim(),
      price: priceVal,
      totalIn: totalInVal,
      totalOut: totalOutVal,
      stock: stockVal,
      unit: normalizeUnit(row[cUnit]),
      updatedBy: String(row[cUpdatedBy] || '').trim(),
      updatedAt: Number(row[cUpdatedAt]) || 0,
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
    var logPrice =
      lrow[12] !== undefined && lrow[12] !== '' && !isNaN(lrow[12]) ? Number(lrow[12]) : undefined;
    var logTotal =
      lrow[13] !== undefined && lrow[13] !== '' && !isNaN(lrow[13]) ? Number(lrow[13]) : undefined;
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
      customerName: String(lrow[11] || '').trim(),
      price: logPrice,
      totalAmount: logTotal,
    });
  }

  // Sort newest logs first
  logs.sort(function (a, b) {
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  var customers = readAllCustomers(sheets.customersSheet);
  return { items: items, logs: logs, customers: customers };
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
    var usersSheet = sheets.usersSheet;
    var customersSheet = sheets.customersSheet;
    var now = Date.now();

    if (action === 'LOGIN') {
      var loginUser = String(payload.username || '').trim().toLowerCase();
      var loginPass = String(payload.password || '');
      if (!loginUser || !loginPass) {
        return jsonResponse({ success: false, message: 'Login ID and password are required.' });
      }
      var allUsers = readAllUsers(usersSheet);
      for (var lu = 0; lu < allUsers.length; lu++) {
        if (
          allUsers[lu].username.toLowerCase() === loginUser &&
          allUsers[lu].password === loginPass
        ) {
          return jsonResponse({
            success: true,
            message: 'Login successful.',
            user: {
              id: allUsers[lu].id,
              name: allUsers[lu].name,
              username: allUsers[lu].username,
              role: allUsers[lu].role,
            },
          });
        }
      }
      return jsonResponse({ success: false, message: 'Invalid Login ID or password.' });
    }

    if (action === 'GET_USERS') {
      return jsonResponse({
        success: true,
        users: readAllUsers(usersSheet),
      });
    }

    if (action === 'CREATE_USER') {
      var uName = String(payload.name || '').trim();
      var uUsername = String(payload.username || '').trim();
      var uPassword = String(payload.password || '').trim();
      var uRole = String(payload.role || 'Staff').trim() === 'Admin' ? 'Admin' : 'Staff';

      if (!uName || !uUsername || !uPassword) {
        return jsonResponse({
          success: false,
          message: 'Name, Login ID, and Password are all required.',
        });
      }

      var currUsers = readAllUsers(usersSheet);
      for (var cu = 0; cu < currUsers.length; cu++) {
        if (currUsers[cu].username.toLowerCase() === uUsername.toLowerCase()) {
          return jsonResponse({
            success: false,
            message: 'This Login ID already exists. Please choose another Login ID.',
          });
        }
      }

      usersSheet.appendRow([
        Utilities.getUuid(),
        uName,
        uUsername,
        uPassword,
        uRole,
        now,
      ]);

      return jsonResponse({
        success: true,
        message: 'User "' + uName + '" created successfully.',
        users: readAllUsers(usersSheet),
      });
    }

    if (action === 'DELETE_USER') {
      var delUserId = String(payload.id || '').trim();
      var uRows = usersSheet.getDataRange().getValues();
      var targetUIdx = -1;
      var adminCount = 0;
      var targetIsAdmin = false;

      for (var ur = 1; ur < uRows.length; ur++) {
        var rowRole = String(uRows[ur][4] || '').trim();
        if (rowRole === 'Admin') adminCount++;
        if (String(uRows[ur][0] || '').trim() === delUserId) {
          targetUIdx = ur + 1;
          if (rowRole === 'Admin') targetIsAdmin = true;
        }
      }

      if (targetUIdx === -1) {
        return jsonResponse({ success: false, message: 'User not found.' });
      }
      if (targetIsAdmin && adminCount <= 1) {
        return jsonResponse({
          success: false,
          message: 'Cannot delete the last Admin account.',
        });
      }

      usersSheet.deleteRow(targetUIdx);
      return jsonResponse({
        success: true,
        message: 'User deleted successfully.',
        users: readAllUsers(usersSheet),
      });
    }

    if (action === 'GET_CUSTOMERS') {
      return jsonResponse({
        success: true,
        customers: readAllCustomers(customersSheet),
      });
    }

    if (action === 'SAVE_CUSTOMER') {
      var cust = payload.customer || {};
      var cId = String(cust.id || '').trim() || Utilities.getUuid();
      var cName = String(cust.name || '').trim();
      var cGst = String(cust.gst || '').trim().toUpperCase();
      var cPhone = String(cust.phone || '').trim();
      var cAddress = String(cust.address || '').trim();
      var cPan = String(cust.pan || '').trim().toUpperCase();
      var cCreated = Number(cust.createdAt) || now;

      if (!cName || !cGst) {
        return jsonResponse({ success: false, message: 'Customer Name and GST are mandatory.' });
      }

      var cData = customersSheet.getDataRange().getValues();
      var cRowIdx = -1;
      for (var ci = 1; ci < cData.length; ci++) {
        if (
          String(cData[ci][0] || '').trim() === cId ||
          String(cData[ci][2] || '').trim().toUpperCase() === cGst
        ) {
          cRowIdx = ci + 1;
          break;
        }
      }

      if (cRowIdx >= 1) {
        customersSheet.getRange(cRowIdx, 1, 1, CUSTOMER_HEADERS.length).setValues([[
          cId, cName, cGst, cPhone, cAddress, cPan, cCreated
        ]]);
      } else {
        customersSheet.appendRow([cId, cName, cGst, cPhone, cAddress, cPan, cCreated]);
      }

      return jsonResponse({
        success: true,
        message: 'Customer saved successfully.',
        customers: readAllCustomers(customersSheet),
      });
    }

    if (action === 'DELETE_CUSTOMER') {
      var delCustId = String(payload.id || '').trim();
      var cdData = customersSheet.getDataRange().getValues();
      var cdRowIdx = -1;
      for (var cdi = 1; cdi < cdData.length; cdi++) {
        if (String(cdData[cdi][0] || '').trim() === delCustId) {
          cdRowIdx = cdi + 1;
          break;
        }
      }
      if (cdRowIdx !== -1) {
        customersSheet.deleteRow(cdRowIdx);
      }
      return jsonResponse({
        success: true,
        message: 'Customer deleted successfully.',
        customers: readAllCustomers(customersSheet),
      });
    }

    if (action === 'SCAN_IN') {
      var barcode = String(payload.barcode || '').trim();
      var name = String(payload.name || '').trim();
      var size = String(payload.size || '').trim();
      var color = String(payload.color || '').trim();
      var qty = roundQty(Number(payload.qty) || 0);
      var unit = normalizeUnit(payload.unit);
      var source = String(payload.source || 'MANUAL');
      var doneBy = String(payload.doneBy || '').trim();

      if (!barcode || !name) {
        return jsonResponse({
          success: false,
          message: 'Unique Code and Product Name are required.',
        });
      }
      if (qty <= 0) {
        return jsonResponse({
          success: false,
          message: 'Quantity must be greater than 0.',
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
        var existingTotalIn = roundQty(Number(existingRow[4]) || 0);
        var existingTotalOut = roundQty(Number(existingRow[5]) || 0);
        var existingStock = resolveStockValue(existingRow[6], existingTotalIn, existingTotalOut);
        var newTotalIn = roundQty(existingTotalIn + qty);
        var newStock = roundQty(existingStock + qty);
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
        '',
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
      var outQty = roundQty(Number(payload.qty) || 0);
      var outBy = String(payload.doneBy || '').trim();
      var outCustomer = String(payload.customerName || '').trim();

      if (!outCode) {
        return jsonResponse({ success: false, message: 'Product Code is required.' });
      }
      if (outQty <= 0) {
        return jsonResponse({ success: false, message: 'Dispatch quantity must be greater than 0.' });
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
      var currTotalIn = roundQty(Number(currRow[4]) || 0);
      var currTotalOut = roundQty(Number(currRow[5]) || 0);
      var currStock = resolveStockValue(currRow[6], currTotalIn, currTotalOut);
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

      var nextTotalOut = roundQty(currTotalOut + outQty);
      var nextStock = roundQty(Math.max(0, currStock - outQty));

      var outPrice =
        payload.price !== undefined && payload.price !== '' ? roundQty(payload.price) : currRow[10] || '';
      var outTotal =
        payload.totalAmount !== undefined && payload.totalAmount !== ''
          ? roundQty(payload.totalAmount)
          : outPrice !== ''
          ? roundQty(Number(outPrice) * outQty)
          : '';

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
            currRow[10] || '',
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
        outCustomer,
        outPrice,
        outTotal,
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

        var eQty = roundQty(Number(entry.qty) || 0);
        if (eQty <= 0) eQty = 1;
        var eSize = String(entry.size || '').trim();
        var eColor = String(entry.color || '').trim();
        var eUnit = normalizeUnit(entry.unit);
        var lowerCode = eCode.toLowerCase();
        var ts = now + idx;

        if (codeToRowIndex[lowerCode]) {
          var targetRow = codeToRowIndex[lowerCode];
          var rowArr = stockSheet.getRange(targetRow, 1, 1, STOCK_HEADERS.length).getValues()[0];
          var prevIn = roundQty(Number(rowArr[4]) || 0);
          var updOut = roundQty(Number(rowArr[5]) || 0);
          var prevStock = resolveStockValue(rowArr[6], prevIn, updOut);
          var updIn = roundQty(prevIn + eQty);
          var updStock = roundQty(prevStock + eQty);
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
          '',
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
        payload.stock !== undefined
          ? roundQty(Math.max(0, Number(payload.stock) || 0))
          : resolveStockValue(oldRow[6], oldRow[4], oldRow[5]);
      var nextUnitVal = normalizeUnit(payload.unit !== undefined ? payload.unit : oldRow[7]);

      var nextPrice =
        payload.price !== undefined && payload.price !== '' ? roundQty(payload.price) : oldRow[10] || '';

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
            nextPrice,
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
