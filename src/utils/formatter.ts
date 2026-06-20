/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SheetRow } from '../types';

// Helper to clean numeric values from diverse formats (e.g. "Rp. 150,000", "100000000", "500.000")
export function cleanNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  let str = String(val).trim();
  
  // Remove "Rp", "RP", any currency symbol, spacing
  str = str.replace(/rp\.?/gi, '').trim();
  
  // If we have a pattern like 100.000.000 or 150,000, we should clean it.
  // Sometimes numbers have comma as thousand separator, sometimes dot.
  // If there are multiple dots OR multiple commas, or standard formats:
  // Let's analyze if standard id-ID format is used: e.g. 100.000.000,00 (dot as thousand, comma as decimal)
  // Or standard US format: 100,000,000.00 (comma as thousand, dot as decimal)
  
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    const lastCommaIndex = str.lastIndexOf(',');
    const lastDotIndex = str.lastIndexOf('.');
    if (lastCommaIndex > lastDotIndex) {
      // Dot is thousand, comma is decimal (European/Indonesian style)
      str = str.replaceAll('.', '').replace(',', '.');
    } else {
      // Comma is thousand, dot is decimal (US style)
      str = str.replaceAll(',', '');
    }
  } else if (hasDot) {
    // Only dot is present. Read carefully: could be decimal (e.g. "5.5") or thousands (e.g. "100.000")
    // If it has multiple dots, it's definitely thousands
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replaceAll('.', '');
    } else {
      // Single dot. If there's 3 digits after it and the part before has length <= 3,
      // e.g. "150.000" it's likely thousand. If parts[0] is longer (e.g. "1000000.000"),
      // the dot is a decimal point.
      const parts = str.split('.');
      if (parts[1] && parts[1].length === 3 && parts[0].length <= 3) {
        str = str.replace('.', '');
      } else {
        // Leave it as decimal point
      }
    }
  } else if (hasComma) {
    // Only comma is present. Count occurrences
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replaceAll(',', '');
    } else {
      const parts = str.split(',');
      if (parts[1] && parts[1].length === 3 && parts[0].length <= 3) {
        str = str.replace(',', '');
      } else {
        // Could be decimal comma, convert to dot
        str = str.replace(',', '.');
      }
    }
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Formats number to comma separated thousands string (e.g. "100,000,000")
export function formatThousands(val: any): string {
  const num = cleanNumber(val);
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Parses string date or Excel serial to "DD MMMM YYYY" (e.g., "16 June 2026")
export function formatDate(val: any): string {
  if (!val) return '-';
  const strVal = String(val).trim();
  if (!strVal) return '-';

  // Check Excel serial number
  if (/^\d{5}(\.\d+)?$/.test(strVal)) {
    const serial = parseFloat(strVal);
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return formatToTargetDate(date);
  }

  // Parse custom strings: "16/06/2026 23:10:07", standard dates, "16-06-2026"
  // DD/MM/YYYY or MM/DD/YYYY
  let dateObj: Date | null = null;
  
  // Try custom regex for DD/MM/YYYY hh:mm:ss or similar Indonesian formats
  const dateParts = strVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dateParts) {
    const day = parseInt(dateParts[1], 10);
    const month = parseInt(dateParts[2], 10) - 1; // 0-indexed month
    const year = parseInt(dateParts[3], 10);
    
    // Check if parts are valid. Indonesian uploads normally are DD/MM/YYYY
    const dObj = new Date(year, month, day);
    if (!isNaN(dObj.getTime())) {
      dateObj = dObj;
    }
  }

  if (!dateObj) {
    const parsed = Date.parse(strVal);
    if (!isNaN(parsed)) {
      dateObj = new Date(parsed);
    }
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    return formatToTargetDate(dateObj);
  }

  return strVal; // Fallback to raw string if unable to parse
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatToTargetDate(date: Date): string {
  const day = date.getDate();
  const month = MONTHS_EN[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Fuzzy matching to detect header names
export function autoFindColumn(headers: string[], searchTerms: string[]): string {
  const normalizedHeaders = headers.map(h => String(h).toLowerCase().trim().replace(/[\s_-]+/g, ''));
  
  for (const term of searchTerms) {
    const normalizedTerm = term.toLowerCase().trim().replace(/[\s_-]+/g, '');
    const idx = normalizedHeaders.indexOf(normalizedTerm);
    if (idx !== -1) {
      return headers[idx];
    }
  }

  // Try partial matching as fallback
  for (const term of searchTerms) {
    const normalizedTerm = term.toLowerCase().trim().replace(/[\s_-]+/g, '');
    const idx = normalizedHeaders.findIndex(h => h.includes(normalizedTerm));
    if (idx !== -1) {
      return headers[idx];
    }
  }

  return headers[0] || '';
}

// Scans headers and inspects sample rows to auto-generate mapping config
export function generateAutoMapping(headers: string[], rows?: SheetRow[]): Record<string, string> {
  const mapping = {
    bankCol: autoFindColumn(headers, ['bank', 'nama bank', 'bank pengirim', 'bank tujuan']),
    accountNameCol: autoFindColumn(headers, ['nama rekening', 'namarek', 'pemilik rekening', 'rekening atas nama', 'atas nama', 'a/n', 'an_rekening', 'nama_rekening']),
    accountNumberCol: autoFindColumn(headers, ['nomor rekening', 'norek', 'no rek', 'no. rek', 'rekening', 'no_rekening', 'nomor_rekening']),
    nominalCol: autoFindColumn(headers, ['nominal', 'jumlah', 'nominal transfer', 'amount', 'total', 'nilai', 'minta transfer']),
    attachmentCol: autoFindColumn(headers, ['lampiran', 'bukti', 'bukti transfer', 'attachment', 'link bukti', 'url bukti', 'foto']),

    usernameCol: autoFindColumn(headers, ['username', 'user', 'nama user', 'id user', 'member', 'id member']),
    orderIdCol: autoFindColumn(headers, ['order id', 'order_id', 'id order', 'orderid', 'no order', 'transaksi id', 'transaction id', 'tx id', 'reff id', 'ref']),
    wdNominalCol: autoFindColumn(headers, ['nominal', 'nominal wd', 'jumlah wd', 'amount', 'total', 'jumlah']),

    dateCol: autoFindColumn(headers, ['date', 'tanggal', 'timestamp', 'waktu', 'created at', 'created_at', 'order date']),
    statusCol: autoFindColumn(headers, ['status', 'state', 'keterangan']),
    itemCol: autoFindColumn(headers, ['product', 'item', 'produk', 'tipe', 'type', 'smb']),
    summaryOrderIdCol: autoFindColumn(headers, ['order id', 'order_id', 'id order', 'orderid']),
    summaryBankCol: autoFindColumn(headers, ['bank', 'cimb', 'nama bank']),
    summaryAccountNumberCol: autoFindColumn(headers, ['nomor rekening', 'norek', 'no rek']),
    summaryAccountNameCol: autoFindColumn(headers, ['nama rekening', 'atas nama', 'nama']),
    summaryNominalCol: autoFindColumn(headers, ['nominal', 'jumlah', 'rp', 'total']),
  };

  // If we have row data, let's look at actual values to perform smart value-based heuristics (ideal for pasted Excel without correct column names)
  if (rows && rows.length > 0) {
    const sampleRows = rows.slice(0, 10); // Examine up to 10 sample rows for higher accuracy
    const banksList = ['mandiri', 'cimb', 'dana', 'bca', 'bri', 'bni', 'ovo', 'gopay', 'linkaja', 'permata', 'bsi', 'jenius'];

    // We will analyze the data characteristics of each column
    const colStats = headers.map(col => {
      let isUrl = false;
      let hasOrderId = false;
      let hasDate = false;
      let hasBankWord = false;
      let hasUuid = false;
      let isStatus = false;
      
      let numericCount = 0;
      let nonNumericCount = 0;
      let totalNumericVal = 0;
      let maxNumericVal = 0;
      let hasCurrencySymbol = false;
      let nameLikeScore = 0;
      let phoneLikeScore = 0;
      let usernameLikeScore = 0;

      sampleRows.forEach(row => {
        const val = String(row[col] ?? '').trim();
        if (!val) return;

        const valLower = val.toLowerCase();

        // 1. URL detect
        if (val.startsWith('http://') || val.startsWith('https://')) {
          isUrl = true;
        }

        // 2. Order ID detect (e.g. LGBDT-MW702654)
        if (/LGBDT-MW/i.test(val)) {
          hasOrderId = true;
        }

        // 3. UUID detect
        if (/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(val)) {
          hasUuid = true;
        }

        // 4. Date/Time detect
        if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(val) || /^\d{4}-\d{2}-\d{2}/.test(val)) {
          hasDate = true;
        }

        // 5. Bank name detect
        if (banksList.some(b => valLower.includes(b)) && val.length < 25) {
          hasBankWord = true;
        }

        // 6. Status detect
        if (['pending', 'wait for payment', 'success', 'failed', 'approved', 'rejected', 'done'].includes(valLower)) {
          isStatus = true;
        }

        // 7. Numeric detect (taking into package format like: 500,000.00 or Rp. 150.000)
        const cleaned = val.replace(/rp\.?/gi, '').trim().replaceAll(',', '').replaceAll('.', '');
        const valNum = parseFloat(cleaned);
        
        // Is it truly numeric? (contains digits, parsed as number, and not a date / uuid / order ID)
        const isTrueNumeric = !isNaN(valNum) && !hasDate && !hasUuid && !hasOrderId && /^\d+(\.\d+)?$/.test(val.replace(/rp\.?/gi, '').trim().replaceAll(',', '').replaceAll('.', ''));

        if (isTrueNumeric) {
          numericCount++;
          // Distinguish actual values vs telephone numbers (starts with 08 / 62 / +62 / 0 contains 9-14 digits)
          const isPhone = /^(08|62|\+62|0)\d{8,13}$/.test(val.replace(/[\s-]/g, ''));
          if (isPhone && val.replace(/[\s-]/g, '').length >= 9) {
            phoneLikeScore++;
          } else {
            totalNumericVal += valNum;
            if (valNum > maxNumericVal) {
              maxNumericVal = valNum;
            }
          }
        } else {
          nonNumericCount++;
        }

        if (valLower.includes('rp')) {
          hasCurrencySymbol = true;
        }

        // 8. Name-like detect (all uppercase words separated by spaces, length >= 4)
        if (/^[A-Z]{3,}(\s[A-Z\s]{2,})+$/.test(val)) {
          nameLikeScore++;
        }

        // 9. Username-like detect (alphanumeric, no spaces, starts with letter, e.g. dini1993)
        if (/^[a-z_][a-z0-9_]{3,14}$/i.test(val) && !banksList.some(b => valLower.includes(b)) && !isStatus) {
          usernameLikeScore++;
        }
      });

      return {
        col,
        isUrl,
        hasOrderId,
        hasDate,
        hasBankWord,
        hasUuid,
        isStatus,
        numericCount,
        nonNumericCount,
        avgNumericVal: numericCount > 0 ? totalNumericVal / numericCount : 0,
        maxNumericVal,
        hasCurrencySymbol,
        nameLikeScore,
        phoneLikeScore,
        usernameLikeScore
      };
    });

    // --- Bank Column classification ---
    const bankColCandidate = colStats.find(s => s.hasBankWord && !s.isUrl && !s.hasOrderId && !s.hasUuid);
    if (bankColCandidate) {
      mapping.bankCol = bankColCandidate.col;
      mapping.summaryBankCol = bankColCandidate.col;
    }

    // --- Order ID Column classification ---
    const orderIdColCandidate = colStats.find(s => s.hasOrderId);
    if (orderIdColCandidate) {
      mapping.orderIdCol = orderIdColCandidate.col;
      mapping.summaryOrderIdCol = orderIdColCandidate.col;
    }

    // --- Date Column classification ---
    const dateColCandidate = colStats.find(s => s.hasDate && !s.hasOrderId);
    if (dateColCandidate) {
      mapping.dateCol = dateColCandidate.col;
    }

    // --- Attachment Link Column classification ---
    const attachmentColCandidate = colStats.find(s => s.isUrl);
    if (attachmentColCandidate) {
      mapping.attachmentCol = attachmentColCandidate.col;
    }

    // --- Account Name Column classification ---
    const nameColCandidate = colStats
      .filter(s => s.nameLikeScore > 0 && !s.isUrl && !s.hasBankWord && !s.hasUuid && !s.hasOrderId)
      .sort((a, b) => b.nameLikeScore - a.nameLikeScore)[0];
    if (nameColCandidate) {
      mapping.accountNameCol = nameColCandidate.col;
      mapping.summaryAccountNameCol = nameColCandidate.col;
    }

    // --- Username Column classification ---
    const usernameColCandidate = colStats
      .filter(s => s.usernameLikeScore > 0 && !s.isUrl && !s.hasBankWord && !s.hasUuid && !s.hasOrderId && s.nameLikeScore === 0)
      .sort((a, b) => b.usernameLikeScore - a.usernameLikeScore)[0];
    if (usernameColCandidate) {
      mapping.usernameCol = usernameColCandidate.col;
    }

    // --- Account Number Column classification ---
    // Look for columns that contain numeric values and fit phoneLikeScore or are purely digits of length > 8 without currency symbols
    const accountNumCandidate = colStats
      .filter(s => (s.phoneLikeScore > 0 || (s.maxNumericVal > 10000000 && !s.hasCurrencySymbol)) && !s.isUrl && !s.hasOrderId && !s.hasUuid && !s.hasDate)
      .sort((a, b) => b.numericCount - a.numericCount)[0];
    if (accountNumCandidate) {
      mapping.accountNumberCol = accountNumCandidate.col;
      mapping.summaryAccountNumberCol = accountNumCandidate.col;
    }

    // --- Nominal Column classification ---
    // Specifically targets numeric columns that are NOT dates, URLs, UUIDs, account numbers, or phone numbers.
    // If there is more than 1 numeric candidate, we choose the one with the HIGHER average value.
    // This perfectly allows us to differentiate between Order nominal (e.g. 150,000) vs Invoice fees (e.g., 1,600).
    const nominalCandidates = colStats
      .filter(s => s.numericCount > 0 && !s.isUrl && !s.hasDate && !s.hasUuid && !s.hasOrderId && s.phoneLikeScore === 0 && s.col !== mapping.accountNumberCol)
      .sort((a, b) => b.avgNumericVal - a.avgNumericVal);

    if (nominalCandidates.length > 0) {
      const bestNominal = nominalCandidates[0].col;
      mapping.nominalCol = bestNominal;
      mapping.wdNominalCol = bestNominal;
      mapping.summaryNominalCol = bestNominal;
    }
  }

  return mapping;
}
