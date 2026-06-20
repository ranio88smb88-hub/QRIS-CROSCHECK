/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  ArrowRightLeft, 
  Upload, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  FileSpreadsheet, 
  Copy, 
  CornerDownRight, 
  Search, 
  ArrowUpDown,
  Check,
  RefreshCw,
  Database,
  Calendar,
  Download
} from 'lucide-react';
import { UploadedFile } from '../types';
import { formatThousands, cleanNumber } from '../utils/formatter';

interface QrisCrossCheckProps {
  activeFile: UploadedFile | null;
}

interface DatasetState {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  mappedOrderId: string;
  mappedNominal: string;
  mappedUserId: string;
  mappedDate?: string;
  mappedFee?: string;
  pastedText: string;
}

export default function QrisCrossCheck({ activeFile }: QrisCrossCheckProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Tab within reconciliation lists
  const [activeListTab, setActiveListTab] = useState<'not-in-admin' | 'not-in-vendor'>('not-in-admin');
  
  // Search state
  const [searchFilter, setSearchFilter] = useState('');
  
  // Accumulation (Append) states for multi-day logs
  const [appendModeVendor, setAppendModeVendor] = useState<boolean>(true); // default true for vendor daily files
  const [appendModeAdmin, setAppendModeAdmin] = useState<boolean>(false);  // default false for group files
  
  // Group Date Filter states (e.g. Day 1 to 10 of month)
  const [filterType, setFilterType] = useState<'none' | 'day-of-month'>('none');
  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(10);
  
  // Format numeric values cleanly with thousand separator and zero decimals
  const formatVal = (val: number) => {
    return Math.round(val).toLocaleString('en-US'); // Will show e.g. 50,000 without decimal
  };

  // Dataset 1: QRIS Minera (Vendor)
  const [vendorData, setVendorData] = useState<DatasetState>({
    name: 'Dashboard QRIS Minera (Vendor)',
    headers: [],
    rows: [],
    mappedOrderId: '',
    mappedNominal: '',
    mappedUserId: '',
    mappedDate: '',
    mappedFee: '',
    pastedText: ''
  });

  // Dataset 2: Laporan Admin QRIS (Admin)
  const [adminData, setAdminData] = useState<DatasetState>({
    name: 'Laporan Admin QRIS (Admin)',
    headers: [],
    rows: [],
    mappedOrderId: '',
    mappedNominal: '',
    mappedUserId: '',
    mappedDate: '',
    mappedFee: '',
    pastedText: ''
  });

  const vendorFileInputRef = useRef<HTMLInputElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  // Parse TSV text copied from Excel
  const parsePasteContent = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };

    const firstLineCols = lines[0].split('\t').map(c => c.trim());
    const headers = firstLineCols.map((col, idx) => col || `Kolom ${idx + 1}`);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t').map(c => c.trim());
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] || '';
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  };

  // Smart heuristic column guesser
  const guessColumns = (headers: string[], rows: Record<string, any>[]): { orderIdCol: string; nominalCol: string; userIdCol: string; dateCol: string; feeCol: string } => {
    let guessedOrderId = '';
    let guessedNominal = '';
    let guessedUserId = '';
    let guessedDate = '';
    let guessedFee = '';

    const orderIdKeywords = ['order', 'ord', 'ref', 'trx', 'transaksi_id', 'id_transaksi', 'id order', 'order id', 'no_ref', 'reference', 'transaksi', 'notransaksi'];
    const nominalKeywords = ['nominal', 'amount', 'harga', 'total', 'bayar', 'jumlah', 'wd', 'credit', 'debit', 'value', 'net amount', 'saldo', 'total tagihan', 'nilai'];
    const userIdKeywords = ['user', 'username', 'member', 'id_member', 'member_id', 'id_user', 'user_id', 'login', 'pengirim', 'akun', 'id akun'];
    const dateKeywords = ['waktu', 'tanggal', 'date', 'time', 'created_at', 'created', 'timestamp', 'tgl', 'tanggal_transaksi', 'tanggal kroscek'];
    const feeKeywords = ['fee', 'biaya', 'admin_fee', 'potongan', 'charge', 'mdr', 'biaya admin', 'biaya_admin', 'biaya mdr', 'fee qris', 'fee_qris', 'fee/biaya'];

    // Search by exact or close keyword match in headers
    for (const h of headers) {
      const hLower = h.toLowerCase();
      if (orderIdKeywords.some(kw => hLower === kw || hLower.startsWith(kw) || hLower.endsWith(kw))) {
        guessedOrderId = h;
      } else if (nominalKeywords.some(kw => hLower === kw || hLower.startsWith(kw) || hLower.endsWith(kw)) && !feeKeywords.some(kw => hLower === kw || hLower.includes(kw))) {
        guessedNominal = h;
      } else if (userIdKeywords.some(kw => hLower === kw || hLower.startsWith(kw) || hLower.endsWith(kw))) {
        guessedUserId = h;
      } else if (dateKeywords.some(kw => hLower === kw || hLower.startsWith(kw) || hLower.endsWith(kw))) {
        guessedDate = h;
      } else if (feeKeywords.some(kw => hLower === kw || hLower.includes(kw))) {
        guessedFee = h;
      }
    }

    // Secondary pass: fuzzy match in headers
    if (!guessedOrderId) {
      guessedOrderId = headers.find(h => orderIdKeywords.some(kw => h.toLowerCase().includes(kw))) || '';
    }
    if (!guessedNominal) {
      guessedNominal = headers.find(h => nominalKeywords.some(kw => h.toLowerCase().includes(kw)) && !feeKeywords.some(kw => h.toLowerCase().includes(kw))) || '';
    }
    if (!guessedUserId) {
      guessedUserId = headers.find(h => userIdKeywords.some(kw => h.toLowerCase().includes(kw))) || '';
    }
    if (!guessedDate) {
      guessedDate = headers.find(h => dateKeywords.some(kw => h.toLowerCase().includes(kw))) || '';
    }
    if (!guessedFee) {
      guessedFee = headers.find(h => feeKeywords.some(kw => h.toLowerCase().includes(kw))) || '';
    }

    // Heuristics based on cell contents
    if (!guessedOrderId && rows.length > 0) {
      for (const h of headers) {
        if (rows.some(r => /LGBDT-|Minera/i.test(String(r[h] ?? '')))) {
          guessedOrderId = h;
          break;
        }
      }
    }

    if (!guessedNominal && rows.length > 0) {
      for (const h of headers) {
        if (h === guessedOrderId || h === guessedUserId || h === guessedDate || h === guessedFee) continue;
        const vals = rows.map(r => cleanNumber(r[h])).filter(n => n > 0);
        if (vals.length > 0) {
          const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
          // Typical nominals are likely 1,000 to dozens of millions but NOT standard timestamps / account numbers
          if (avg > 1000 && avg < 50000000 && !rows.some(r => /^\d{8,20}$/.test(String(r[h] ?? '')))) {
            guessedNominal = h;
            break;
          }
        }
      }
    }

    if (!guessedUserId && rows.length > 0) {
      for (const h of headers) {
        if (h === guessedOrderId || h === guessedNominal || h === guessedDate || h === guessedFee) continue;
        // Looking for standard short strings with alpha letters
        if (rows.some(r => /^[a-z_][a-z0-9_]{3,14}$/i.test(String(r[h] ?? '')))) {
          guessedUserId = h;
          break;
        }
      }
    }

    if (!guessedDate && rows.length > 0) {
      for (const h of headers) {
        if (h === guessedOrderId || h === guessedNominal || h === guessedUserId || h === guessedFee) continue;
        if (rows.some(r => r[h] instanceof Date || (typeof r[h] === 'string' && (r[h].includes('/') || r[h].includes('-')) && /\d/.test(r[h])))) {
          guessedDate = h;
          break;
        }
      }
    }

    return {
      orderIdCol: guessedOrderId || headers[0] || '',
      nominalCol: guessedNominal || headers[1] || headers[0] || '',
      userIdCol: guessedUserId || headers[2] || headers[0] || '',
      dateCol: guessedDate || headers[3] || headers[0] || '',
      feeCol: guessedFee || ''
    };
  };

  // Populate state with loaded headers and rows
  const loadDataset = (isVendor: boolean, newHeaders: string[], newRows: Record<string, any>[], sourceName: string) => {
    const isAppend = isVendor ? appendModeVendor : appendModeAdmin;
    const currentData = isVendor ? vendorData : adminData;

    let finalRows = newRows;
    let finalHeaders = newHeaders;
    let finalName = sourceName;

    if (isAppend && currentData.rows.length > 0) {
      finalRows = [...currentData.rows, ...newRows];
      finalHeaders = Array.from(new Set([...currentData.headers, ...newHeaders]));
      if (currentData.name.includes(sourceName)) {
        finalName = currentData.name;
      } else {
        finalName = `${currentData.name} + ${sourceName}`;
      }
    }

    const guesses = guessColumns(finalHeaders, finalRows);
    
    // Fallback or keep existing mappings if they are valid in append mode
    const finalOrderId = (isAppend && currentData.mappedOrderId && finalHeaders.includes(currentData.mappedOrderId)) 
      ? currentData.mappedOrderId 
      : (guesses.orderIdCol || currentData.mappedOrderId);
      
    const finalNominal = (isAppend && currentData.mappedNominal && finalHeaders.includes(currentData.mappedNominal)) 
      ? currentData.mappedNominal 
      : (guesses.nominalCol || currentData.mappedNominal);
      
    const finalUserId = (isAppend && currentData.mappedUserId && finalHeaders.includes(currentData.mappedUserId)) 
      ? currentData.mappedUserId 
      : (guesses.userIdCol || currentData.mappedUserId);

    const finalDate = (isAppend && currentData.mappedDate && finalHeaders.includes(currentData.mappedDate))
      ? currentData.mappedDate
      : (guesses.dateCol || currentData.mappedDate);

    const finalFee = (isAppend && currentData.mappedFee && finalHeaders.includes(currentData.mappedFee))
      ? currentData.mappedFee
      : (guesses.feeCol || currentData.mappedFee || '');

    const updatedState = {
      name: finalName,
      headers: finalHeaders,
      rows: finalRows,
      mappedOrderId: finalOrderId,
      mappedNominal: finalNominal,
      mappedUserId: finalUserId,
      mappedDate: finalDate,
      mappedFee: finalFee,
      pastedText: ''
    };

    if (isVendor) {
      setVendorData(updatedState);
    } else {
      setAdminData(updatedState);
    }
    
    setSuccessMsg(`Berhasil memuat ${newRows.length} baris baru ${isAppend ? '(ditambahkan)' : ''} ke data ${isVendor ? 'Vendor' : 'Admin'}. Total keseluruhan: ${finalRows.length} baris.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handle Multiple Excel/CSV files parse
  const handleFilesChange = async (isVendor: boolean, files: FileList) => {
    if (!files || files.length === 0) return;

    setSuccessMsg(`Membaca dan memproses ${files.length} file...`);

    const parseSingleFile = (file: File): Promise<{ headers: string[], rows: Record<string, any>[], name: string }> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            if (!data) throw new Error(`Gagal membaca data dari file: ${file.name}`);

            const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { 
              defval: '',
              raw: false
            });

            if (rawRows.length === 0) {
              return resolve({ headers: [], rows: [], name: file.name });
            }

            // Headers
            const headers: string[] = [];
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const address = XLSX.utils.encode_col(C) + '1';
              const cell = worksheet[address];
              if (cell && cell.v) {
                headers.push(String(cell.v).trim());
              }
            }

            const fallbackHeaders = Array.from(new Set(rawRows.flatMap(row => Object.keys(row))));
            const finalHeaders = headers.length > 0 
              ? headers.filter(h => fallbackHeaders.includes(h) || h !== '') 
              : fallbackHeaders;

            resolve({
              headers: finalHeaders.length > 0 ? finalHeaders : fallbackHeaders,
              rows: rawRows,
              name: file.name
            });
          } catch (err: any) {
            reject(new Error(`File "${file.name}": ${err.message}`));
          }
        };
        reader.onerror = () => reject(new Error(`Gagal membaca file: ${file.name}`));
        reader.readAsBinaryString(file);
      });
    };

    try {
      const parsedResults = await Promise.all(
        Array.from(files).map(file => parseSingleFile(file))
      );

      const validResults = parsedResults.filter(r => r.rows.length > 0);

      if (validResults.length === 0) {
        setErrorMsg("Semua file yang diunggah kosong atau tidak memiliki data.");
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }

      const combinedRows: Record<string, any>[] = [];
      const combinedHeadersSet = new Set<string>();
      const namesList: string[] = [];

      for (const res of validResults) {
        combinedRows.push(...res.rows);
        res.headers.forEach(h => combinedHeadersSet.add(h));
        namesList.push(res.name);
      }

      const combinedHeaders = Array.from(combinedHeadersSet);

      let finalName = namesList[0];
      if (namesList.length > 1) {
        if (namesList.length <= 3) {
          finalName = namesList.join(' + ');
        } else {
          finalName = `${namesList.length} File (${namesList.slice(0, 2).join(', ')}... + ${namesList.length - 2} file lainnya)`;
        }
      }

      loadDataset(isVendor, combinedHeaders, combinedRows, finalName);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses beberapa file.");
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  // Handle pasted text submit
  const handlePasteSubmit = (isVendor: boolean) => {
    const targetText = isVendor ? vendorData.pastedText : adminData.pastedText;
    if (!targetText.trim()) return;

    try {
      const { headers, rows } = parsePasteContent(targetText);
      if (rows.length === 0) {
        setErrorMsg("Gagal mengurai teks kroscek Excel. Pastikan data disalin langsung dari Excel/Spreadsheet.");
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }
      loadDataset(isVendor, headers, rows, `Pasted Excel (${rows.length} rows)`);
    } catch (e) {
      setErrorMsg("Gagal memproses text copy-paste.");
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Import active app-wide spreadsheet
  const handleUseActiveFile = (isVendor: boolean) => {
    if (!activeFile) return;
    loadDataset(isVendor, activeFile.headers, activeFile.rows, activeFile.name);
  };

  // Clear datasets
  const handleClearDataset = (isVendor: boolean) => {
    const emptyState = {
      name: isVendor ? 'Dashboard QRIS Minera (Vendor)' : 'Laporan Admin QRIS (Admin)',
      headers: [],
      rows: [],
      mappedOrderId: '',
      mappedNominal: '',
      mappedUserId: '',
      mappedDate: '',
      mappedFee: '',
      pastedText: ''
    };
    if (isVendor) {
      setVendorData(emptyState);
    } else {
      setAdminData(emptyState);
    }
  };

  // LOAD SIMULATION DATA
  const loadSimulationData = () => {
    // Mimic the structures of Minera QRIS and Admin Report with decimal points
    const simVendorRows = [
      { 'Order ID': 'Minera298897517804197144829', 'Username': 'dini1993', 'Jumlah Trx': '150000.00', 'Waktu': '19/06/2026 12:10:00', 'Biaya MDR': '1050.00' },
      { 'Order ID': 'Minera298897517804201019001', 'Username': 'agus88', 'Jumlah Trx': '200000.00', 'Waktu': '19/06/2026 12:15:00', 'Biaya MDR': '1400.00' },
      { 'Order ID': 'Minera298897517804202231221', 'Username': 'rizkyt_9', 'Jumlah Trx': '75000.00', 'Waktu': '19/06/2026 12:20:00', 'Biaya MDR': '525.00' },
      { 'Order ID': 'Minera298897517804203348123', 'Username': 'ranio88', 'Jumlah Trx': '50000.00', 'Waktu': '19/06/2026 12:30:00', 'Biaya MDR': '350.00' },
      { 'Order ID': 'Minera298897517804205561244', 'Username': 'meta_store', 'Jumlah Trx': '350000.00', 'Waktu': '19/06/2026 12:45:00', 'Biaya MDR': '2450.00' }, // This order ID is vendor-only (not in admin)
      { 'Order ID': 'Minera298897517804208891255', 'Username': 'andrean', 'Jumlah Trx': '100000.00', 'Waktu': '19/06/2026 12:50:00', 'Biaya MDR': '700.00' }, // Nominal mismatch: vendor 100k vs admin 90k
    ];

    const simAdminRows = [
      { 'ID Transaksi': 'Minera298897517804197144829', 'ID Akun': 'dini1993', 'Nominal Tagihan': '150000.00', 'Status': 'Success' },
      { 'ID Transaksi': 'Minera298897517804201019001', 'ID Akun': 'agus88', 'Nominal Tagihan': '200000.00', 'Status': 'Success' },
      { 'ID Transaksi': 'Minera298897517804202231221', 'ID Akun': 'rizkyt_9', 'Nominal Tagihan': '75000.00', 'Status': 'Success' },
      { 'ID Transaksi': 'Minera298897517804203348123', 'ID Akun': 'ranio88', 'Nominal Tagihan': '50000.00', 'Status': 'Success' },
      { 'ID Transaksi': 'Minera298897517804208891255', 'ID Akun': 'andrean', 'Nominal Tagihan': '90000.00', 'Status': 'Success' }, // Nominal mismatch (90,000 vs 100,000)
      { 'ID Transaksi': 'Minera298897517804209999126', 'ID Akun': 'lia_lestari', 'Nominal Tagihan': '125000.00', 'Status': 'Success' }, // This order ID is admin-only (not in vendor)
    ];

    loadDataset(true, ['Order ID', 'Username', 'Jumlah Trx', 'Waktu', 'Biaya MDR'], simVendorRows, 'Simulation Vendor Data.xlsx');
    loadDataset(false, ['ID Transaksi', 'ID Akun', 'Nominal Tagihan', 'Status'], simAdminRows, 'Simulation Admin Data.xlsx');
    
    setSuccessMsg("Sukses mengisi simulasi data vendor & admin!");
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Helper to extract Day number (1-31) from date cell
  const getDayFromCell = (val: any): number | null => {
    if (!val) return null;
    if (val instanceof Date) {
      return val.getDate();
    }
    const str = String(val).trim();
    const datePart = str.split(' ')[0] || str;
    
    // Check for DD/MM/YYYY or DD-MM-YYYY
    const ddMmYyyyMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddMmYyyyMatch) {
      return parseInt(ddMmYyyyMatch[1], 10);
    }
    // Check for YYYY-MM-DD or YYYY/MM/DD
    const yyyyMmDdMatch = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyyMmDdMatch) {
      return parseInt(yyyyMmDdMatch[3], 10);
    }
    // Check if it's just raw day or similar
    const firstNum = parseInt(datePart, 10);
    if (!isNaN(firstNum) && firstNum >= 1 && firstNum <= 31) {
      return firstNum;
    }
    return null;
  };

  // --- RECONCILIATION ENGINE CRITICAL CALCULATIONS ---
  const results = useMemo(() => {
    let vRows = vendorData.rows;
    let aRows = adminData.rows;

    const vOrderIdCol = vendorData.mappedOrderId;
    const vNominalCol = vendorData.mappedNominal;
    const vUserIdCol = vendorData.mappedUserId;
    const vDateCol = vendorData.mappedDate;
    const vFeeCol = vendorData.mappedFee;

    const aOrderIdCol = adminData.mappedOrderId;
    const aNominalCol = adminData.mappedNominal;
    const aUserIdCol = adminData.mappedUserId;
    const aDateCol = adminData.mappedDate;
    const aFeeCol = adminData.mappedFee;

    // Apply Filter Group (e.g. Day 1 to 10)
    if (filterType === 'day-of-month') {
      if (vDateCol) {
        vRows = vRows.filter(row => {
          const dVal = row[vDateCol];
          if (!dVal) return false;
          const day = getDayFromCell(dVal);
          return day !== null && day >= startDay && day <= endDay;
        });
      }
      if (aDateCol) {
        aRows = aRows.filter(row => {
          const dVal = row[aDateCol];
          if (!dVal) return false;
          const day = getDayFromCell(dVal);
          return day !== null && day >= startDay && day <= endDay;
        });
      }
    }

    if (vRows.length === 0 || aRows.length === 0) {
      return {
        notInAdmin: [],
        notInVendor: [],
        nominalDiff: [],
        allMatches: [],
        vendorTotalSum: 0,
        adminTotalSum: 0,
        vendorTotalFee: 0,
        adminTotalFee: 0,
        matchRate: 0
      };
    }

    // Hash maps for quick search Lookup
    const adminMap = new Map<string, { nominal: number; r: any }>();
    aRows.forEach(row => {
      const oid = String(row[aOrderIdCol] ?? '').trim().toLowerCase();
      if (oid) {
        const nom = cleanNumber(row[aNominalCol]);
        adminMap.set(oid, { nominal: nom, r: row });
      }
    });

    const vendorMap = new Map<string, { nominal: number; r: any }>();
    vRows.forEach(row => {
      const oid = String(row[vOrderIdCol] ?? '').trim().toLowerCase();
      if (oid) {
        const nom = cleanNumber(row[vNominalCol]);
        vendorMap.set(oid, { nominal: nom, r: row });
      }
    });

    // Output containers
    const notInAdmin: Array<{ orderId: string; userId: string; nominal: number; row: any }> = [];
    const notInVendor: Array<{ orderId: string; userId: string; nominal: number; row: any }> = [];
    const allMatches: Array<{ orderId: string; userId: string; nominal: number }> = [];

    // 1. Process vendor rows to check against admin
    let vendorTotalSum = 0;
    let vendorTotalFee = 0;
    vRows.forEach(row => {
      const oid = String(row[vOrderIdCol] ?? '').trim();
      const oidLower = oid.toLowerCase();
      const uid = String(row[vUserIdCol] ?? '').trim() || '-';
      const nom = cleanNumber(row[vNominalCol]);
      vendorTotalSum += nom;

      const feeVal = vFeeCol ? cleanNumber(row[vFeeCol]) : 0;
      vendorTotalFee += feeVal;

      if (!oid) return;

      const adminRecord = adminMap.get(oidLower);
      if (!adminRecord) {
        notInAdmin.push({
          orderId: oid,
          userId: uid,
          nominal: nom,
          row
        });
      } else {
        allMatches.push({
          orderId: oid,
          userId: uid,
          nominal: nom
        });
      }
    });

    // 2. Process admin rows to check against vendor
    let adminTotalSum = 0;
    let adminTotalFee = 0;
    aRows.forEach(row => {
      const oid = String(row[aOrderIdCol] ?? '').trim();
      const oidLower = oid.toLowerCase();
      const uid = String(row[aUserIdCol] ?? '').trim() || '-';
      const nom = cleanNumber(row[aNominalCol]);
      adminTotalSum += nom;

      const feeVal = aFeeCol ? cleanNumber(row[aFeeCol]) : 0;
      adminTotalFee += feeVal;

      if (!oid) return;

      const vendorRecord = vendorMap.get(oidLower);
      if (!vendorRecord) {
        notInVendor.push({
          orderId: oid,
          userId: uid,
          nominal: nom,
          row
        });
      }
    });

    const totalCalculatedStatsCount = vRows.length;
    const matchCount = allMatches.length;
    const matchRate = totalCalculatedStatsCount > 0 ? (matchCount / totalCalculatedStatsCount) * 100 : 0;

    return {
      notInAdmin,
      notInVendor,
      allMatches,
      vendorTotalSum,
      adminTotalSum,
      vendorTotalFee,
      adminTotalFee,
      matchRate
    };
  }, [vendorData, adminData, filterType, startDay, endDay]);

  // Combined compiled spreadsheet-style output text boxes
  const compiledOutputString = useMemo(() => {
    if (vendorData.rows.length === 0 || adminData.rows.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push("📋 ORDER ID YANG TIDAK MATCH (Dengan Nominal & Fee)");
    lines.push("");

    if (results.notInAdmin.length > 0) {
      results.notInAdmin.forEach(item => {
        const feeVal = vendorData.mappedFee ? cleanNumber(item.row?.[vendorData.mappedFee]) : 0;
        lines.push(`❌ ${item.orderId} (ID: ${item.userId}) → tidak ada di ADMIN (Nominal: Rp. ${formatVal(item.nominal)} | Fee: Rp. ${formatVal(feeVal)})`);
      });
    } else {
      lines.push("✅ Semua order ID Vendor tercatat di Admin.");
    }

    lines.push("");

    if (results.notInVendor.length > 0) {
      results.notInVendor.forEach(item => {
        const feeVal = adminData.mappedFee ? cleanNumber(item.row?.[adminData.mappedFee]) : 0;
        lines.push(`❌ ${item.orderId} (ID: ${item.userId}) → tidak ada di VENDOR (Nominal: Rp. ${formatVal(item.nominal)} | Fee: Rp. ${formatVal(feeVal)})`);
      });
    } else {
      lines.push("✅ Semua order ID Admin tercatat di Vendor.");
    }

    return lines.join('\n');
  }, [results, vendorData.rows.length, adminData.rows.length, vendorData.mappedFee, adminData.mappedFee]);

  // Clipboard copies
  const copyToClipboard = (text: string, customMessage?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setSuccessMsg(customMessage || "Berhasil disalin ke clipboard!");
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Excel Export
  const exportResultsToExcel = () => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Tab 1: Vendor Only
      const vendorOnlyData = results.notInAdmin.map(item => {
        const feeVal = vendorData.mappedFee ? cleanNumber(item.row?.[vendorData.mappedFee]) : 0;
        return {
          'Order ID': item.orderId,
          'User Member ID': item.userId,
          'Nominal': item.nominal,
          'Fee/MDR': feeVal,
          'Net Total': item.nominal - feeVal,
          'Status': 'Tidak ada di Admin'
        };
      });
      const wsVendor = XLSX.utils.json_to_sheet(vendorOnlyData);
      XLSX.utils.book_append_sheet(wb, wsVendor, 'Vendor Only (No Admin)');

      // Tab 2: Admin Only
      const adminOnlyData = results.notInVendor.map(item => {
        const feeVal = adminData.mappedFee ? cleanNumber(item.row?.[adminData.mappedFee]) : 0;
        return {
          'Order ID': item.orderId,
          'User Member ID': item.userId,
          'Nominal': item.nominal,
          'Fee/MDR': feeVal,
          'Net Total': item.nominal - feeVal,
          'Status': 'Tidak ada di Vendor'
        };
      });
      const wsAdmin = XLSX.utils.json_to_sheet(adminOnlyData);
      XLSX.utils.book_append_sheet(wb, wsAdmin, 'Admin Only (No Vendor)');

      // Generate file name e.g. "Kroscek_QRIS_Group_1_10.xlsx" depending on filter
      let fileName = 'Kroscek_QRIS_Hasil.xlsx';
      if (filterType === 'day-of-month') {
        fileName = `Kroscek_QRIS_Hari_${startDay}_sd_${endDay}.xlsx`;
      }

      XLSX.writeFile(wb, fileName);
      setSuccessMsg(`Berhasil mengekspor ke Excel: ${fileName}`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg("Gagal export Excel: " + err.message);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Filter listings based on search key
  const filteredListItems = useMemo(() => {
    const filter = searchFilter.toLowerCase();
    
    if (activeListTab === 'not-in-admin') {
      return results.notInAdmin.filter(item => 
        item.orderId.toLowerCase().includes(filter) || 
        item.userId.toLowerCase().includes(filter)
      );
    }
    return results.notInVendor.filter(item => 
      item.orderId.toLowerCase().includes(filter) || 
      item.userId.toLowerCase().includes(filter)
    );
  }, [results, activeListTab, searchFilter]);

  const hasLoadedBoth = vendorData.rows.length > 0 && adminData.rows.length > 0;

  return (
    <div id="qris-crosscheck-container" className="space-y-6">
      
      {/* Intro Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#18181b] border border-[#27272a] p-5 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 bg-[#e11d48]/10 text-[#f43f5e] font-mono text-[9px] font-bold rounded uppercase tracking-wider">RECON TOOL</span>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Kroscek Selisih QRIS Minera vs Admin</h3>
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Modul pembanding dual-sumber data mandiri untuk melakukan rekonsiliasi instan, mencocokkan ID Transaksi kedua platform langsung secara real-time.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSimulationData}
            className="px-3.5 py-1.5 bg-[#27272a]/80 hover:bg-[#27272a] border border-[#3f3f46] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Sparkles size={13} className="text-amber-400" />
            <span>Gunakan Data Simulasi</span>
          </button>
        </div>
      </div>

      {/* INPUT PANELS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PANEL A: VENDOR */}
        <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4 shadow-sm relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Platform Vendor (QRIS Minera)
              </h4>
            </div>
            {vendorData.rows.length > 0 && (
              <button 
                onClick={() => handleClearDataset(true)}
                className="text-[10px] text-red-400 hover:underline font-mono"
              >
                Reset
              </button>
            )}
          </div>

          {/* Append Mode Control Panel */}
          <div className="flex items-center gap-2 bg-[#10b981]/10 border border-[#10b981]/20 p-2.5 rounded-lg text-xs font-mono text-[#10b981]">
            <input
              type="checkbox"
              id="append-mode-vendor-chk"
              checked={appendModeVendor}
              onChange={(e) => setAppendModeVendor(e.target.checked)}
              className="accent-[#10b981] h-3.5 w-3.5 rounded border-[#27272a] bg-[#09090b] cursor-pointer"
            />
            <label htmlFor="append-mode-vendor-chk" className="cursor-pointer select-none font-semibold">
              Gabungkan dengan upload sebelumnya (Bisa upload berkali-kali)
            </label>
          </div>

          {vendorData.rows.length > 0 ? (
            <div className="space-y-3 bg-[#18181b]/50 p-3 rounded-lg border border-[#27272a] text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-[#a1a1aa]">Sumber:</span>
                <span className="text-white font-semibold truncate max-w-[180px] text-right">{vendorData.name}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#a1a1aa]">Total records:</span>
                <span className="text-white font-semibold">{vendorData.rows.length} baris</span>
              </div>
              
              {/* Guess / selectors dropdowns */}
              <div className="pt-2.5 border-t border-[#27272a] space-y-1.5 font-mono text-[11px]">
                <div className="text-[#71717a] font-bold uppercase tracking-wider text-[9px] mb-1">MAPPING KOLOM (AUTO-MATCHED)</div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Order ID:</span>
                  <select 
                    value={vendorData.mappedOrderId}
                    onChange={(e) => setVendorData({ ...vendorData, mappedOrderId: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none"
                  >
                    {vendorData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Nominal Rp:</span>
                  <select 
                    value={vendorData.mappedNominal}
                    onChange={(e) => setVendorData({ ...vendorData, mappedNominal: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none"
                  >
                    {vendorData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> User ID:</span>
                  <select 
                    value={vendorData.mappedUserId}
                    onChange={(e) => setVendorData({ ...vendorData, mappedUserId: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none"
                  >
                    {vendorData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Kolom Tanggal:</span>
                  <select 
                    value={vendorData.mappedDate || ''}
                    onChange={(e) => setVendorData({ ...vendorData, mappedDate: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">- Tidak Ada / Kosong -</option>
                    {vendorData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Kolom Fee/MDR:</span>
                  <select 
                    value={vendorData.mappedFee || ''}
                    onChange={(e) => setVendorData({ ...vendorData, mappedFee: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">- Tidak Ada / Kosong -</option>
                    {vendorData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
                {activeFile && (
                  <button
                    onClick={() => handleUseActiveFile(true)}
                    className="p-2 border border-[#27272a] bg-[#18181b] hover:bg-[#27272a] rounded-lg transition-all text-white flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Database size={14} className="text-blue-400" />
                    <span>Gunakan File Aktif</span>
                  </button>
                )}
                <div 
                  onClick={() => vendorFileInputRef.current?.click()}
                  className={`p-2 border border-dashed border-[#27272a] bg-[#09090b] hover:bg-[#18181b] rounded-lg transition-all text-[#a1a1aa] flex flex-col items-center justify-center gap-1 cursor-pointer ${activeFile ? '' : 'col-span-2'}`}
                >
                  <Upload size={14} className="text-emerald-400" />
                  <span>Upload Sekaligus XLSX/CSV</span>
                  <input 
                    type="file" 
                    ref={vendorFileInputRef}
                    onChange={(e) => e.target.files && handleFilesChange(true, e.target.files)}
                    className="hidden" 
                    accept=".xlsx,.xls,.csv"
                    multiple
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold font-mono text-[#a1a1aa] block uppercase tracking-wider">
                  ATAU PASTE KAN DATA EXCEL (TSV):
                </label>
                <textarea
                  value={vendorData.pastedText}
                  onChange={(e) => setVendorData({ ...vendorData, pastedText: e.target.value })}
                  placeholder="Salin/Copy kolom transaksi Anda di Excel Minera lalu paste di sini..."
                  rows={4}
                  className="w-full text-xs font-mono p-3 bg-[#09090b] border border-[#27272a] rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none"
                />
                <button
                  type="button"
                  disabled={!vendorData.pastedText}
                  onClick={() => handlePasteSubmit(true)}
                  className={`w-full py-1.5 font-bold rounded-lg text-xs font-mono transition-all ${
                    vendorData.pastedText 
                      ? 'bg-[#10b981] text-black hover:bg-[#34d399] cursor-pointer' 
                      : 'bg-[#18181b] text-zinc-600 border border-[#27272a] cursor-not-allowed'
                  }`}
                >
                  Proses Data Paste Vendor
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PANEL B: ADMIN */}
        <div className="p-5 bg-[#09090b] border border-[#27272a] rounded-xl space-y-4 shadow-sm relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Laporan Admin (Admin QRIS)
              </h4>
            </div>
            {adminData.rows.length > 0 && (
              <button 
                onClick={() => handleClearDataset(false)}
                className="text-[10px] text-red-400 hover:underline font-mono"
              >
                Reset
              </button>
            )}
          </div>

          {/* Append Mode Control Panel */}
          <div className="flex items-center gap-2 bg-[#f59e0b]/10 border border-[#f59e0b]/20 p-2.5 rounded-lg text-xs font-mono text-[#f59e0b]">
            <input
              type="checkbox"
              id="append-mode-admin-chk"
              checked={appendModeAdmin}
              onChange={(e) => setAppendModeAdmin(e.target.checked)}
              className="accent-[#f59e0b] h-3.5 w-3.5 rounded border-[#27272a] bg-[#09090b] cursor-pointer"
            />
            <label htmlFor="append-mode-admin-chk" className="cursor-pointer select-none font-semibold">
              Gabungkan dengan upload sebelumnya (Bisa upload berkali-kali)
            </label>
          </div>

          {adminData.rows.length > 0 ? (
            <div className="space-y-3 bg-[#18181b]/50 p-3 rounded-lg border border-[#27272a] text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-[#a1a1aa]">Sumber:</span>
                <span className="text-white font-semibold truncate max-w-[180px] text-right">{adminData.name}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#a1a1aa]">Total records:</span>
                <span className="text-white font-semibold">{adminData.rows.length} baris</span>
              </div>
              
              {/* Guess / selectors dropdowns */}
              <div className="pt-2.5 border-t border-[#27272a] space-y-1.5 font-mono text-[11px]">
                <div className="text-[#71717a] font-bold uppercase tracking-wider text-[9px] mb-1">MAPPING KOLOM (AUTO-MATCHED)</div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Order ID:</span>
                  <select 
                    value={adminData.mappedOrderId}
                    onChange={(e) => setAdminData({ ...adminData, mappedOrderId: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none"
                  >
                    {adminData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Nominal Rp:</span>
                  <select 
                    value={adminData.mappedNominal}
                    onChange={(e) => setAdminData({ ...adminData, mappedNominal: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none"
                  >
                    {adminData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> User ID:</span>
                  <select 
                    value={adminData.mappedUserId}
                    onChange={(e) => setAdminData({ ...adminData, mappedUserId: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none"
                  >
                    {adminData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Kolom Tanggal:</span>
                  <select 
                    value={adminData.mappedDate || ''}
                    onChange={(e) => setAdminData({ ...adminData, mappedDate: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none focus:border-amber-500"
                  >
                    <option value="">- Tidak Ada / Kosong -</option>
                    {adminData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a1a1aa] flex items-center gap-1"><CornerDownRight size={10} /> Kolom Fee/MDR:</span>
                  <select 
                    value={adminData.mappedFee || ''}
                    onChange={(e) => setAdminData({ ...adminData, mappedFee: e.target.value })}
                    className="bg-[#18181b] border border-[#3f3f46] text-white py-0.5 px-1.5 rounded text-[10px] focus:outline-none focus:border-amber-500"
                  >
                    <option value="">- Tidak Ada / Kosong -</option>
                    {adminData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
                {activeFile && (
                  <button
                    onClick={() => handleUseActiveFile(false)}
                    className="p-2 border border-[#27272a] bg-[#18181b] hover:bg-[#27272a] rounded-lg transition-all text-white flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Database size={14} className="text-blue-400" />
                    <span>Gunakan File Aktif</span>
                  </button>
                )}
                <div 
                  onClick={() => adminFileInputRef.current?.click()}
                  className={`p-2 border border-dashed border-[#27272a] bg-[#09090b] hover:bg-[#18181b] rounded-lg transition-all text-[#a1a1aa] flex flex-col items-center justify-center gap-1 cursor-pointer ${activeFile ? '' : 'col-span-2'}`}
                >
                  <Upload size={14} className="text-amber-400" />
                  <span>Upload Sekaligus XLSX/CSV</span>
                  <input 
                    type="file" 
                    ref={adminFileInputRef}
                    onChange={(e) => e.target.files && handleFilesChange(false, e.target.files)}
                    className="hidden" 
                    accept=".xlsx,.xls,.csv"
                    multiple
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold font-mono text-[#a1a1aa] block uppercase tracking-wider">
                  ATAU PASTE KAN DATA EXCEL (TSV):
                </label>
                <textarea
                  value={adminData.pastedText}
                  onChange={(e) => setAdminData({ ...adminData, pastedText: e.target.value })}
                  placeholder="Salin/Copy kolom transaksi Anda di Excel mutasi Admin lalu paste di sini..."
                  rows={4}
                  className="w-full text-xs font-mono p-3 bg-[#09090b] border border-[#27272a] rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none"
                />
                <button
                  type="button"
                  disabled={!adminData.pastedText}
                  onClick={() => handlePasteSubmit(false)}
                  className={`w-full py-1.5 font-bold rounded-lg text-xs font-mono transition-all ${
                    adminData.pastedText 
                      ? 'bg-[#f59e0b] text-black hover:bg-[#fbbf24] cursor-pointer' 
                      : 'bg-[#18181b] text-zinc-600 border border-[#27272a] cursor-not-allowed'
                  }`}
                >
                  Proses Data Paste Admin
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* FEEDBACK STATUS */}
      {successMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono text-xs flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-red-400 font-mono text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* RECON RESULTS AREA */}
      {hasLoadedBoth ? (
        <div className="space-y-6">

          {/* GROUP DATE INTERACTIVE FILTER */}
          <div className="p-5 bg-[#18181b] border border-[#27272a] rounded-xl space-y-4 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="text-blue-400" size={16} />
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wide">Filter Group Tanggal / Hari</h4>
                </div>
                <p className="text-[11px] text-[#a1a1aa] font-mono leading-relaxed">
                  Saring data kroscek berdasarkan rentang hari (contoh tanggal 1 - 10, dsb). Vendor mengupload harian dan Admin mengupload dalam group bulanan.
                </p>
              </div>

              {/* Filter mode Selector */}
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterType('none')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                    filterType === 'none' 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                      : 'bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Semua Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('day-of-month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                    filterType === 'day-of-month' 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                      : 'bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Filter Hari Kroscek (1-31)
                </button>
              </div>
            </div>

            {filterType === 'day-of-month' && (
              <div className="pt-3 border-t border-[#27272a] flex flex-col sm:flex-row sm:items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[#a1a1aa]">Mulai Hari:</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={startDay}
                    onChange={(e) => setStartDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                    className="w-16 bg-[#09090b] border border-[#27272a] rounded p-1 text-center text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#a1a1aa]">Selesai Hari:</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={endDay}
                    onChange={(e) => setEndDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 10)))}
                    className="w-16 bg-[#09090b] border border-[#27272a] rounded p-1 text-center text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Quick select presets */}
                <div className="flex flex-wrap gap-1.5 items-center bg-[#09090b] p-1.5 border border-[#27272a] rounded-lg">
                  <span className="text-[#71717a] text-[10px] uppercase font-bold mr-1">Preset Rentang:</span>
                  <button
                    type="button"
                    onClick={() => { setStartDay(1); setEndDay(10); }}
                    className="px-2 py-0.5 bg-[#18181b] hover:bg-[#27272a] text-[#e4e4e7] text-[10px] font-semibold rounded cursor-pointer transition-colors"
                  >
                    Hari 1-10
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStartDay(11); setEndDay(20); }}
                    className="px-2 py-0.5 bg-[#18181b] hover:bg-[#27272a] text-[#e4e4e7] text-[10px] font-semibold rounded cursor-pointer transition-colors"
                  >
                    Hari 11-20
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStartDay(21); setEndDay(31); }}
                    className="px-2 py-0.5 bg-[#18181b] hover:bg-[#27272a] text-[#e4e4e7] text-[10px] font-semibold rounded cursor-pointer transition-colors"
                  >
                    Hari 21-31
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bento Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-[#18181b]/50 border border-[#27272a] rounded-xl space-y-1">
              <span className="text-[9px] font-mono font-semibold text-[#71717a] uppercase tracking-wider">Total Vendor</span>
              <div className="text-lg font-bold text-white font-mono">{vendorData.rows.length} Trx</div>
              <div className="text-[10px] text-[#10b981] font-mono truncate">Rp. {formatVal(results.vendorTotalSum)}</div>
            </div>
            <div className="p-4 bg-[#18181b]/50 border border-[#27272a] rounded-xl space-y-1">
              <span className="text-[9px] font-mono font-semibold text-[#71717a] uppercase tracking-wider">Total Admin</span>
              <div className="text-lg font-bold text-white font-mono">{adminData.rows.length} Trx</div>
              <div className="text-[10px] text-[#f59e0b] font-mono truncate">Rp. {formatVal(results.adminTotalSum)}</div>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
              <span className="text-[9px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">Total Fee Minera QRIS</span>
              <div className="text-lg font-bold text-emerald-400 font-mono">Rp. {formatVal(results.vendorTotalFee)}</div>
              <div className="text-[10px] text-zinc-400 font-mono truncate">Net: Rp. {formatVal(results.vendorTotalSum - results.vendorTotalFee)}</div>
            </div>
            <div className="p-4 bg-[#18181b]/50 border border-[#27272a] rounded-xl space-y-1">
              <span className="text-[9px] font-mono font-semibold text-[#71717a] uppercase tracking-wider">Kelayakan Cocok</span>
              <div className="text-lg font-bold text-white font-mono">
                {results.matchRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[#a1a1aa] font-mono">
                {results.allMatches.length} order match
              </div>
            </div>
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-1">
              <span className="text-[9px] font-mono font-semibold text-red-400 uppercase tracking-wider">Selisih Item</span>
              <div className="text-lg font-bold text-red-400 font-mono">
                {results.notInAdmin.length + results.notInVendor.length} Item
              </div>
              <div className="text-[10px] text-[#a1a1aa] font-mono truncate">
                Tidak ada di salah satu platform
              </div>
            </div>
          </div>

          {/* SPREADSHEET FORMULA OUTPUT PREVIEW */}
          <div className="p-5 bg-[#18181b] border border-[#27272a] rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Clipboard size={14} className="text-white" />
                <h4 className="text-xs font-bold text-white font-mono uppercase">Hasil Formulasi Selisih Kroscek</h4>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={exportResultsToExcel}
                  className="px-3 py-1.5 bg-[#10b981] hover:bg-[#34d399] hover:scale-[1.01] active:scale-[0.99] text-black text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download size={13} />
                  <span>Unduh Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(compiledOutputString)}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] text-black text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Copy size={12} />
                  <span>Salin Saringan Teks</span>
                </button>
              </div>
            </div>

            <pre className="p-4 bg-[#09090b] border border-[#27272a] text-xs font-mono text-[#e4e4e7] overflow-x-auto max-h-[220px] rounded-lg whitespace-pre select-all leading-relaxed scrollbar-thin">
              {compiledOutputString}
            </pre>
            <div className="text-[10px] text-[#71717a] font-mono italic">
              * Teks di atas diformat mirip representasi output excel formulasi Anda, lengkap dengan User Member ID.
            </div>
          </div>

          {/* INTERACTIVE SPLIT LISTS VIEW */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              {/* Tab options selector */}
              <div className="flex flex-wrap p-1 bg-[#18181b] border border-[#27272a] rounded-lg text-xs font-mono">
                <button
                  onClick={() => setActiveListTab('not-in-admin')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeListTab === 'not-in-admin' ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span>Vendor Only/Tidak di Admin ({results.notInAdmin.length})</span>
                </button>
                <button
                  onClick={() => setActiveListTab('not-in-vendor')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeListTab === 'not-in-vendor' ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span>Admin Only/Tidak di Vendor ({results.notInVendor.length})</span>
                </button>
              </div>

              {/* Fast Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 text-[#52525b]" size={13} />
                <input 
                  type="text"
                  placeholder="Cari Order ID / User..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg py-1.5 pl-8 pr-3 text-xs placeholder-zinc-500 font-mono text-white focus:outline-none focus:border-[#3b82f6]"
                />
              </div>
            </div>

            {/* List Details Panel */}
            <div className="border border-[#27272a] bg-[#09090b] rounded-xl overflow-hidden font-mono text-xs">
              
              {/* Table header indicators */}
              <div className="grid grid-cols-12 bg-[#18181b] px-4 py-2 text-[#71717a] font-bold uppercase tracking-wider text-[10px] border-b border-[#27272a]">
                <div className="col-span-3">Order ID</div>
                <div className="col-span-2">User Member ID</div>
                <div className="col-span-2">Nominal</div>
                <div className="col-span-2">Fee/MDR</div>
                <div className="col-span-3 text-right">Salin Sesuai Keinginan</div>
              </div>

              {/* Main detail rows representation */}
              <div className="divide-y divide-[#27272a] max-h-[380px] overflow-y-auto scrollbar-thin">
                {filteredListItems.length > 0 ? (
                  filteredListItems.map((item: any, idx: number) => {
                    const orderId = item.orderId;
                    const userId = item.userId;

                    const feeVal = activeListTab === 'not-in-admin' && vendorData.mappedFee 
                      ? cleanNumber(item.row?.[vendorData.mappedFee]) 
                      : activeListTab === 'not-in-vendor' && adminData.mappedFee 
                        ? cleanNumber(item.row?.[adminData.mappedFee])
                        : 0;

                    return (
                      <div key={idx} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-[#18181b]/40 text-white transition-colors">
                        {/* Order ID: Clickable to copy */}
                        <div 
                          onClick={() => copyToClipboard(orderId, "Order ID berhasil disalin!")}
                          className="col-span-3 font-bold cursor-pointer hover:text-rose-400 flex items-center gap-1 group transition-colors truncate pr-2"
                          title="Klik untuk menyalin Order ID"
                        >
                          <span className="truncate">{orderId}</span>
                          <Copy className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity flex-shrink-0" size={10} />
                        </div>

                        {/* User Member ID: Clickable to copy */}
                        <div 
                          onClick={() => copyToClipboard(userId, "User ID berhasil disalin!")}
                          className="col-span-2 text-blue-400 cursor-pointer hover:text-blue-300 flex items-center gap-1 group transition-colors truncate pr-2"
                          title="Klik untuk menyalin User ID"
                        >
                          <span className="truncate">{userId}</span>
                          <Copy className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-blue-300 transition-opacity flex-shrink-0" size={10} />
                        </div>
                        
                        {/* Nominal/Status: Clickable to copy */}
                        <div 
                          onClick={() => copyToClipboard(String(item.nominal), "Nominal transaksi berhasil disalin!")}
                          className="col-span-2 cursor-pointer hover:brightness-110 flex items-center gap-1 group transition-all"
                          title="Klik untuk menyalin nominal numeric"
                        >
                          {activeListTab === 'not-in-admin' ? (
                            <span className="text-xs bg-red-950/20 border border-red-900/30 text-red-400 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                              <span>Rp. {formatVal(item.nominal)}</span>
                              <Copy className="opacity-0 group-hover:opacity-100 text-red-400/60 transition-opacity flex-shrink-0" size={10} />
                            </span>
                          ) : (
                            <span className="text-xs bg-red-950/20 border border-red-900/30 text-red-500 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                              <span>Rp. {formatVal(item.nominal)}</span>
                              <Copy className="opacity-0 group-hover:opacity-100 text-red-500/60 transition-opacity flex-shrink-0" size={10} />
                            </span>
                          )}
                        </div>

                        {/* Fee/MDR: Clickable to copy */}
                        <div 
                          onClick={() => copyToClipboard(String(feeVal), "Biaya fee/MDR berhasil disalin!")}
                          className="col-span-2 cursor-pointer hover:brightness-110 flex items-center gap-1 group transition-all text-zinc-400"
                          title="Klik untuk menyalin nominal fee"
                        >
                          <span className="text-xs bg-zinc-950/40 border border-zinc-800 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                            <span>Rp. {formatVal(feeVal)}</span>
                            <Copy className="opacity-0 group-hover:opacity-100 text-zinc-500 transition-opacity flex-shrink-0" size={10} />
                          </span>
                        </div>

                        {/* Choice of Copy buttons */}
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <button
                            onClick={() => copyToClipboard(orderId, "Order ID berhasil disalin!")}
                            className="px-1.5 py-1 bg-[#18181b] hover:bg-zinc-800 border border-[#27272a] hover:border-zinc-500 text-[10px] text-zinc-400 hover:text-white rounded cursor-pointer transition-all"
                            title="Salin Order ID saja"
                          >
                            Order ID
                          </button>
                          <button
                            onClick={() => copyToClipboard(userId, "User ID berhasil disalin!")}
                            className="px-1.5 py-1 bg-[#18181b] hover:bg-zinc-800 border border-[#27272a] hover:border-zinc-500 text-[10px] text-zinc-400 hover:text-white rounded cursor-pointer transition-all"
                            title="Salin User ID saja"
                          >
                            User ID
                          </button>
                          <button
                            onClick={() => copyToClipboard(String(feeVal), "Nominal Fee berhasil disalin!")}
                            className="px-1.5 py-1 bg-[#18181b] hover:bg-zinc-800 border border-[#27272a] hover:border-emerald-500 text-[10px] text-emerald-400 hover:text-emerald-300 rounded cursor-pointer transition-all animate-pulse"
                            title="Salin Fee saja"
                          >
                            Fee
                          </button>
                          <button
                            onClick={() => {
                              let cText = '';
                              if (activeListTab === 'not-in-admin') {
                                cText = `❌ ${orderId} (ID: ${userId}) → tidak ada di ADMIN (Nominal: Rp. ${formatVal(item.nominal)} | Fee: Rp. ${formatVal(feeVal)})`;
                              } else {
                                cText = `❌ ${orderId} (ID: ${userId}) → tidak ada di VENDOR (Nominal: Rp. ${formatVal(item.nominal)} | Fee: Rp. ${formatVal(feeVal)})`;
                              }
                              copyToClipboard(cText, "Seluruh detail baris berhasil disalin!");
                            }}
                            className="p-1 px-1.5 bg-rose-950/30 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 border border-rose-900/40 hover:border-rose-600 rounded cursor-pointer transition-all flex items-center gap-1 text-[10px]"
                            title="Salin rincian lengkap baris ini"
                          >
                            <Copy size={10} />
                            <span>Lengkap</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 text-center text-[#52525b] font-mono">
                    {searchFilter ? 'Tidak ada hasil pencarian yang cocok.' : 'Kosong atau semua transaksi tercatat bersih!'}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      ) : (
        <div className="p-16 border border-[#27272a] bg-[#18181b]/10 text-center rounded-xl max-w-lg mx-auto">
          <ArrowRightLeft className="mx-auto text-[#f59e0b] mb-4 animate-pulse" size={32} />
          <h4 className="text-white font-bold text-xs mb-1 uppercase tracking-wider font-mono">Data Belum Sinkron</h4>
          <p className="text-[#a1a1aa] text-xs leading-relaxed mb-6">
            Silakan unggah berkas excel pengeluaran atau salin data tabel Anda untuk platform **Vendor (Minera QRIS)** & **Admin** agar sistem dapat mengevaluasi dan merumuskan perbedaannya.
          </p>
          <button
            onClick={loadSimulationData}
            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg cursor-pointer transition-all inline-flex items-center gap-1.5"
          >
            <Sparkles size={13} />
            <span>Coba Pakai Data Simulasi</span>
          </button>
        </div>
      )}

    </div>
  );
}
