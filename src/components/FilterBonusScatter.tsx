/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Sparkles, 
  Upload, 
  Copy, 
  Check, 
  AlertTriangle, 
  FileSpreadsheet, 
  Search, 
  Download, 
  RefreshCw, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  ArrowRightLeft,
  Flame,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileCheck2,
  Trash2,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { formatThousands } from '../utils/formatter';

interface ParsedDataset {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  rawText?: string;
}

export type ScatterMatchStatus = 'only_doc' | 'only_smb' | 'nominal_mismatch' | 'matched';

interface ScatterComparisonRow {
  id: string;
  userId: string;
  normalizedUserId: string;
  source: 'doc' | 'smb' | 'both';
  matchStatus: ScatterMatchStatus;
  
  // Doc fields
  docData?: Record<string, any>;
  nominalDoc?: number;
  tanggalDoc?: string;
  buktiDoc?: string;
  kodeDoc?: string;

  // SMB fields
  smbData?: Record<string, any>;
  nominalSmb?: number;
  tanggalSmb?: string;
  gameSmb?: string;
  statusSmb?: string;
  ticketSmb?: string;

  // Differences
  nominalDiff?: number;
}

// Robust Nominal Parser for Scatter formats ("15.000", "15,000.00", "15000.000", "Rp 15.000", etc.)
export function parseScatterNominal(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);

  let str = String(val).trim();
  if (!str) return 0;

  // Remove currency words, letters, quotes, spaces
  str = str.replace(/rp\.?/gi, '').replace(/^["']|["']$/g, '').trim();

  // If already standard clean integer string e.g. "15000"
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastCommaIndex = str.lastIndexOf(',');
    const lastDotIndex = str.lastIndexOf('.');
    if (lastCommaIndex > lastDotIndex) {
      // 15.000,00 -> Dot is thousand, comma is decimal
      str = str.replaceAll('.', '').replace(',', '.');
    } else {
      // 15,000.00 -> Comma is thousand, dot is decimal
      str = str.replaceAll(',', '');
    }
  } else if (hasDot) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // "1.500.000" -> thousands separator
      str = str.replaceAll('.', '');
    } else {
      // Single dot: e.g. "15.000" (Indonesian format) vs "15000.000" (SQL decimal)
      const parts = str.split('.');
      if (parts[1] && (parts[1] === '000' || parts[1] === '00' || parts[1] === '0')) {
        // e.g. "15000.000" -> integer 15000
        str = parts[0];
      } else if (parts[1] && parts[1].length === 3 && parts[0].length <= 4) {
        // "15.000" or "100.000" -> thousands
        str = str.replace('.', '');
      } else {
        // Decimal
        str = parts[0];
      }
    }
  } else if (hasComma) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replaceAll(',', '');
    } else {
      const parts = str.split(',');
      if (parts[1] && (parts[1] === '00' || parts[1] === '0')) {
        str = parts[0];
      } else if (parts[1] && parts[1].length === 3 && parts[0].length <= 4) {
        str = str.replace(',', '');
      } else {
        str = parts[0];
      }
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

export default function FilterBonusScatter() {
  // Datasets State
  const [docData, setDocData] = useState<ParsedDataset | null>(null);
  const [smbData, setSmbData] = useState<ParsedDataset | null>(null);

  const [docPasteText, setDocPasteText] = useState<string>('');
  const [smbPasteText, setSmbPasteText] = useState<string>('');

  // Column Selectors for Data di Doc
  const [docUserIdCol, setDocUserIdCol] = useState<string>('');
  const [docNominalCol, setDocNominalCol] = useState<string>('');

  // Column Selectors for File Bonus SMB
  const [smbUserIdCol, setSmbUserIdCol] = useState<string>('');
  const [smbNominalCol, setSmbNominalCol] = useState<string>('');

  // Filter & Search Controls
  const [filterMode, setFilterMode] = useState<'all_unmatched' | 'only_doc' | 'only_smb' | 'nominal_mismatch' | 'matched' | 'all'>('all_unmatched');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Status Alerts
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const docFileInputRef = useRef<HTMLInputElement>(null);
  const smbFileInputRef = useRef<HTMLInputElement>(null);

  // Clean String Helper: removes quotes, tabs, leading/trailing whitespace
  const cleanString = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/^["']|["']$/g, '') // remove outer quotes
      .replace(/\t/g, ' ')         // replace tabs
      .replace(/[\r\n]+/g, ' ')   // replace newlines
      .trim();
  };

  const normalizeUserId = (val: any): string => {
    return cleanString(val).toLowerCase().replace(/\s+/g, '');
  };

  // Helper to parse TSV / CSV text lines
  const parseDelimitedText = (text: string, defaultName: string): ParsedDataset | null => {
    if (!text.trim()) return null;
    const lines = text.trim().split(/[\r\n]+/);
    if (lines.length === 0) return null;

    // Detect delimiter: tab > comma > semicolon
    const firstLine = lines[0];
    let sep = '\t';
    if (firstLine.includes('\t')) sep = '\t';
    else if (firstLine.includes(',')) sep = ',';
    else if (firstLine.includes(';')) sep = ';';

    // Parse headers
    let rawHeaders = firstLine.split(sep).map(h => cleanString(h));
    
    // Check if first line looks like data rather than header
    const isHeaderLikely = rawHeaders.some(h => 
      ['user', 'id', 'pemain', 'tanggal', 'nominal', 'deposit', 'bonus', 'game', 'status', 'bukti', 'link', 'kode'].some(k => h.toLowerCase().includes(k))
    );

    let headers: string[] = [];
    let dataStartIdx = 1;

    if (!isHeaderLikely && rawHeaders.length > 2) {
      headers = rawHeaders.map((_, i) => `Kolom ${i + 1}`);
      dataStartIdx = 0;
    } else {
      headers = rawHeaders.map((h, i) => h || `Kolom ${i + 1}`);
    }

    const rows: Record<string, any>[] = [];
    for (let i = dataStartIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(sep).map(c => cleanString(c));
      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] !== undefined ? cols[idx] : '';
      });
      rows.push(rowObj);
    }

    return {
      name: defaultName,
      headers,
      rows,
      rawText: text
    };
  };

  // Helper to process File Upload (Excel or CSV)
  const handleFileParsed = (file: File, isTargetDoc: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawJson = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
        if (rawJson.length === 0) {
          setErrorMsg('File kosong atau format tidak dapat dibaca.');
          return;
        }

        // Determine header & rows
        const firstRow = (rawJson[0] as any[]).map(c => cleanString(c));
        const isHeaderLikely = firstRow.some(h => 
          ['user', 'id', 'pemain', 'tanggal', 'nominal', 'deposit', 'bonus', 'game', 'status', 'bukti', 'link'].some(k => h.toLowerCase().includes(k))
        );

        let headers: string[] = [];
        let dataStartIdx = 1;

        if (!isHeaderLikely && firstRow.length > 2) {
          headers = firstRow.map((_, i) => `Kolom ${i + 1}`);
          dataStartIdx = 0;
        } else {
          headers = firstRow.map((h, i) => h || `Kolom ${i + 1}`);
        }

        const rows: Record<string, any>[] = [];
        for (let i = dataStartIdx; i < rawJson.length; i++) {
          const rowData = rawJson[i] as any[];
          if (!rowData || rowData.every(c => c === '')) continue;
          const rowObj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cleanString(rowData[idx]);
          });
          rows.push(rowObj);
        }

        const parsed: ParsedDataset = {
          name: file.name,
          headers,
          rows
        };

        if (isTargetDoc) {
          setDocData(parsed);
          autoDetectDocCols(headers);
          setSuccessMsg(`Data di Doc "${file.name}" berhasil dimuat (${rows.length} baris)`);
        } else {
          setSmbData(parsed);
          autoDetectSmbCols(headers);
          setSuccessMsg(`File Bonus SMB "${file.name}" berhasil dimuat (${rows.length} baris)`);
        }

        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setErrorMsg('Gagal membaca file: ' + (err?.message || 'Error tidak diketahui'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Auto-detect User ID and Nominal for Doc
  // Format Doc: Tanggal | User ID | Bukti/Link | Nominal | Kode/Ticket
  const autoDetectDocCols = (headers: string[]) => {
    // 1. User ID
    const userFound = headers.find(h => {
      const l = h.toLowerCase();
      return l.includes('user') || l.includes('id') || l.includes('pemain') || l.includes('member') || l.includes('username');
    });
    if (userFound) {
      setDocUserIdCol(userFound);
    } else if (headers.length >= 2) {
      setDocUserIdCol(headers[1]); // Default 2nd column
    } else if (headers.length > 0) {
      setDocUserIdCol(headers[0]);
    }

    // 2. Nominal
    const nomFound = headers.find(h => {
      const l = h.toLowerCase();
      return l.includes('nominal') || l.includes('amount') || l.includes('bonus') || l.includes('deposit') || l.includes('rp');
    });
    if (nomFound) {
      setDocNominalCol(nomFound);
    } else if (headers.length >= 4) {
      setDocNominalCol(headers[3]); // Default 4th column
    } else if (headers.length > 0) {
      setDocNominalCol(headers[headers.length - 1]);
    }
  };

  // Auto-detect User ID and Nominal for SMB
  // Format SMB: Tanggal | Brand | User ID | Game | Ticket | Channel | Bet | Scatter | Bonus Nominal | Extra | Status
  const autoDetectSmbCols = (headers: string[]) => {
    // 1. User ID
    const userFound = headers.find(h => {
      const l = h.toLowerCase();
      return l.includes('user') || l.includes('id') || l.includes('pemain') || l.includes('member') || l.includes('username');
    });
    if (userFound) {
      setSmbUserIdCol(userFound);
    } else if (headers.length >= 3) {
      setSmbUserIdCol(headers[2]); // Default 3rd column
    } else if (headers.length > 0) {
      setSmbUserIdCol(headers[0]);
    }

    // 2. Nominal
    const nomFound = headers.find(h => {
      const l = h.toLowerCase();
      return l.includes('nominal') || l.includes('bonus') || l.includes('amount') || l.includes('hadiah');
    });
    if (nomFound) {
      setSmbNominalCol(nomFound);
    } else if (headers.length >= 9) {
      setSmbNominalCol(headers[8]); // Default 9th column
    } else if (headers.length > 0) {
      setSmbNominalCol(headers[headers.length - 1]);
    }
  };

  // Direct Paste Handlers
  const handleDocPasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDocPasteText(text);
    if (!text.trim()) {
      setDocData(null);
      return;
    }
    const parsed = parseDelimitedText(text, 'Paste Data di Doc');
    if (parsed) {
      setDocData(parsed);
      autoDetectDocCols(parsed.headers);
    }
  };

  const handleSmbPasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSmbPasteText(text);
    if (!text.trim()) {
      setSmbData(null);
      return;
    }
    const parsed = parseDelimitedText(text, 'Paste Data Bonus SMB');
    if (parsed) {
      setSmbData(parsed);
      autoDetectSmbCols(parsed.headers);
    }
  };

  // Demo Data Loader (Using user-provided formats)
  const handleLoadDemo = () => {
    // Data di Doc format:
    // 27/08/2026	saputra270	https://prnt.sc/m_WmRdWNyogM	15.000	TK2E70T0JZ
    const docDemo = `Tanggal\tUser ID\tBukti Screenshot\tNominal\tKode Klaim
27/08/2026\tsaputra270\thttps://prnt.sc/m_WmRdWNyogM\t15.000\tTK2E70T0JZ
27/08/2026\tyugivary\thttps://prnt.sc/x_AB12CdEfGh\t15.000\tTK88HOKI01
27/08/2026\trajagacor88\thttps://prnt.sc/k_99ZzYxWvUt\t25.000\tTK99SCAT02
27/08/2026\thoki_mahjong99\thttps://prnt.sc/p_11QqRrSsTt\t50.000\tTK50MAHJ03
27/08/2026\tonly_doc_user1\thttps://prnt.sc/a_22BbCcDdEe\t15.000\tTK15ONLY04
27/08/2026\tonly_doc_user2\thttps://prnt.sc/b_33FfGgHhIi\t30.000\tTK30ONLY05`;

    // File Bonus SMB format:
    // 2026-08-03 00:10:43	LIGABANDOT	yugivary	mahjong	2083961661332542466	LIVECHAT	1600	3	15,000.00		APPROVED
    const smbDemo = `Tanggal\tWebsite\tUser ID\tGame\tTicket ID\tChannel\tBet\tScatter Count\tBonus Nominal\tExtra\tStatus
2026-08-03 00:10:43\tLIGABANDOT\tyugivary\tmahjong\t2083961661332542466\tLIVECHAT\t1600\t3\t15,000.00\t\tAPPROVED
2026-08-27 14:10:12\tLIGABANDOT\trajagacor88\tmahjong ways 2\t2083961661332542999\tTELEGRAM\t2000\t4\t20,000.00\t\tAPPROVED
2026-08-27 14:25:30\tLIGABANDOT\thoki_mahjong99\tmahjong ways\t2083961661332543111\tWHATSAPP\t4000\t5\t50,000.00\t\tAPPROVED
2026-08-27 16:15:20\tLIGABANDOT\tonly_smb_user1\tmahjong wins\t2083961661332543888\tLIVECHAT\t800\t3\t15,000.00\t\tAPPROVED
2026-08-27 17:00:44\tLIGABANDOT\tonly_smb_user2\tmahjong ways\t2083961661332544222\tLIVECHAT\t1200\t4\t25,000.00\t\tAPPROVED`;

    setDocPasteText(docDemo);
    setSmbPasteText(smbDemo);

    const parsedDoc = parseDelimitedText(docDemo, 'Demo Data di Doc');
    const parsedSmb = parseDelimitedText(smbDemo, 'Demo File Bonus SMB');

    if (parsedDoc) {
      setDocData(parsedDoc);
      autoDetectDocCols(parsedDoc.headers);
    }
    if (parsedSmb) {
      setSmbData(parsedSmb);
      autoDetectSmbCols(parsedSmb.headers);
    }

    setSuccessMsg('Data Demo Filter Scatter berhasil dimuat! Menampilkan perbedaan User ID dan Nominal antara Data Doc vs Bonus SMB.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleResetAll = () => {
    setDocData(null);
    setSmbData(null);
    setDocPasteText('');
    setSmbPasteText('');
    setDocUserIdCol('');
    setDocNominalCol('');
    setSmbUserIdCol('');
    setSmbNominalCol('');
    setSearchTerm('');
    setSuccessMsg('Semua data berhasil dibersihkan.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // EXTRACTORS
  const extractDocFields = (row: Record<string, any>) => {
    // Nominal
    let nom = 0;
    if (docNominalCol && row[docNominalCol] !== undefined) {
      nom = parseScatterNominal(row[docNominalCol]);
    } else {
      for (const [k, v] of Object.entries(row)) {
        const lk = k.toLowerCase();
        if (lk.includes('nominal') || lk.includes('amount') || lk.includes('bonus')) {
          const val = parseScatterNominal(v);
          if (val > 0) { nom = val; break; }
        }
      }
    }

    // Tanggal
    let tgl = '-';
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      if (lk.includes('tanggal') || lk.includes('date') || lk.includes('waktu')) {
        if (v) { tgl = String(v); break; }
      }
    }
    if (tgl === '-') {
      const vals = Object.values(row);
      if (vals[0] && (String(vals[0]).includes('/') || String(vals[0]).includes('-'))) {
        tgl = String(vals[0]);
      }
    }

    // Bukti / Screenshot Link
    let bukti = '';
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      const sv = String(v);
      if (lk.includes('bukti') || lk.includes('link') || lk.includes('prnt.sc') || lk.includes('screenshot') || sv.startsWith('http')) {
        if (sv) { bukti = sv; break; }
      }
    }

    // Kode / Ticket
    let kode = '';
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      if (lk.includes('kode') || lk.includes('ticket') || lk.includes('klaim')) {
        if (v) { kode = String(v); break; }
      }
    }
    if (!kode && Object.keys(row).length >= 5) {
      const vals = Object.values(row);
      kode = String(vals[vals.length - 1] || '');
    }

    return { nominal: nom, tanggal: tgl, bukti, kode };
  };

  const extractSmbFields = (row: Record<string, any>) => {
    // Nominal
    let nom = 0;
    if (smbNominalCol && row[smbNominalCol] !== undefined) {
      nom = parseScatterNominal(row[smbNominalCol]);
    } else {
      for (const [k, v] of Object.entries(row)) {
        const lk = k.toLowerCase();
        if (lk.includes('nominal') || lk.includes('bonus') || lk.includes('amount')) {
          const val = parseScatterNominal(v);
          if (val > 0) { nom = val; break; }
        }
      }
    }

    // Tanggal
    let tgl = '-';
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      if (lk.includes('tanggal') || lk.includes('date') || lk.includes('waktu')) {
        if (v) { tgl = String(v); break; }
      }
    }
    if (tgl === '-') {
      const vals = Object.values(row);
      if (vals[0] && (String(vals[0]).includes('/') || String(vals[0]).includes('-'))) {
        tgl = String(vals[0]);
      }
    }

    // Game
    let game = '-';
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      if (lk.includes('game') || lk.includes('permainan') || lk.includes('provider')) {
        if (v) { game = String(v); break; }
      }
    }

    // Status
    let status = '-';
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      if (lk.includes('status')) {
        if (v) { status = String(v); break; }
      }
    }

    // Ticket ID
    let ticket = '-';
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      if (lk.includes('ticket') || lk.includes('tiket') || lk.includes('order')) {
        if (v) { ticket = String(v); break; }
      }
    }

    return { nominal: nom, tanggal: tgl, game, status, ticket };
  };

  // CROSS-CHECK & COMPARISON LOGIC (USER ID + NOMINAL)
  const comparisonResults = useMemo(() => {
    const docRows = docData?.rows || [];
    const smbRows = smbData?.rows || [];

    if (docRows.length === 0 && smbRows.length === 0) {
      return {
        rows: [] as ScatterComparisonRow[],
        metrics: {
          totalDoc: 0,
          totalSmb: 0,
          onlyDocCount: 0,
          onlySmbCount: 0,
          nominalMismatchCount: 0,
          matchedCount: 0,
          totalDiscrepancies: 0
        }
      };
    }

    // Map Doc by normalized User ID
    const docMap = new Map<string, { originalUserId: string; row: Record<string, any> }[]>();
    docRows.forEach(row => {
      const rawUser = docUserIdCol ? row[docUserIdCol] : Object.values(row)[1] || Object.values(row)[0];
      const norm = normalizeUserId(rawUser);
      if (!norm) return;
      if (!docMap.has(norm)) {
        docMap.set(norm, []);
      }
      docMap.get(norm)!.push({ originalUserId: cleanString(rawUser), row });
    });

    // Map SMB by normalized User ID
    const smbMap = new Map<string, { originalUserId: string; row: Record<string, any> }[]>();
    smbRows.forEach(row => {
      const rawUser = smbUserIdCol ? row[smbUserIdCol] : Object.values(row)[2] || Object.values(row)[0];
      const norm = normalizeUserId(rawUser);
      if (!norm) return;
      if (!smbMap.has(norm)) {
        smbMap.set(norm, []);
      }
      smbMap.get(norm)!.push({ originalUserId: cleanString(rawUser), row });
    });

    const allKeys = new Set([...docMap.keys(), ...smbMap.keys()]);
    const processedRows: ScatterComparisonRow[] = [];

    let onlyDocCount = 0;
    let onlySmbCount = 0;
    let nominalMismatchCount = 0;
    let matchedCount = 0;

    allKeys.forEach((normKey) => {
      const docEntries = docMap.get(normKey);
      const smbEntries = smbMap.get(normKey);

      const hasDoc = Boolean(docEntries && docEntries.length > 0);
      const hasSmb = Boolean(smbEntries && smbEntries.length > 0);

      const primaryUserId = docEntries?.[0]?.originalUserId || smbEntries?.[0]?.originalUserId || normKey;

      if (hasDoc && !hasSmb) {
        // ONLY IN DOC (Tidak ada di Bonus SMB)
        onlyDocCount += (docEntries?.length || 1);
        docEntries?.forEach((entry, idx) => {
          const docInfo = extractDocFields(entry.row);
          processedRows.push({
            id: `doc-${normKey}-${idx}`,
            userId: entry.originalUserId,
            normalizedUserId: normKey,
            source: 'doc',
            matchStatus: 'only_doc',
            docData: entry.row,
            nominalDoc: docInfo.nominal,
            tanggalDoc: docInfo.tanggal,
            buktiDoc: docInfo.bukti,
            kodeDoc: docInfo.kode
          });
        });
      } else if (!hasDoc && hasSmb) {
        // ONLY IN SMB (Tidak ada di Data Doc)
        onlySmbCount += (smbEntries?.length || 1);
        smbEntries?.forEach((entry, idx) => {
          const smbInfo = extractSmbFields(entry.row);
          processedRows.push({
            id: `smb-${normKey}-${idx}`,
            userId: entry.originalUserId,
            normalizedUserId: normKey,
            source: 'smb',
            matchStatus: 'only_smb',
            smbData: entry.row,
            nominalSmb: smbInfo.nominal,
            tanggalSmb: smbInfo.tanggal,
            gameSmb: smbInfo.game,
            statusSmb: smbInfo.status,
            ticketSmb: smbInfo.ticket
          });
        });
      } else if (hasDoc && hasSmb) {
        // IN BOTH -> CHECK USER ID & NOMINAL
        const maxLen = Math.max(docEntries?.length || 0, smbEntries?.length || 0);
        for (let i = 0; i < maxLen; i++) {
          const dEntry = docEntries?.[i] || docEntries?.[0];
          const sEntry = smbEntries?.[i] || smbEntries?.[0];

          const docInfo = extractDocFields(dEntry.row);
          const smbInfo = extractSmbFields(sEntry.row);

          const nomDoc = docInfo.nominal;
          const nomSmb = smbInfo.nominal;
          const diff = Math.abs(nomDoc - nomSmb);

          let status: ScatterMatchStatus = 'matched';
          if (diff > 0.01) {
            status = 'nominal_mismatch';
            nominalMismatchCount++;
          } else {
            status = 'matched';
            matchedCount++;
          }

          processedRows.push({
            id: `both-${normKey}-${i}`,
            userId: primaryUserId,
            normalizedUserId: normKey,
            source: 'both',
            matchStatus: status,
            docData: dEntry.row,
            smbData: sEntry.row,
            nominalDoc: nomDoc,
            nominalSmb: nomSmb,
            nominalDiff: diff,
            tanggalDoc: docInfo.tanggal,
            buktiDoc: docInfo.bukti,
            kodeDoc: docInfo.kode,
            tanggalSmb: smbInfo.tanggal,
            gameSmb: smbInfo.game,
            statusSmb: smbInfo.status,
            ticketSmb: smbInfo.ticket
          });
        }
      }
    });

    return {
      rows: processedRows,
      metrics: {
        totalDoc: docRows.length,
        totalSmb: smbRows.length,
        onlyDocCount,
        onlySmbCount,
        nominalMismatchCount,
        matchedCount,
        totalDiscrepancies: onlyDocCount + onlySmbCount + nominalMismatchCount
      }
    };
  }, [docData, smbData, docUserIdCol, docNominalCol, smbUserIdCol, smbNominalCol]);

  // Filtered Rows based on Tab & Search
  const filteredRows = useMemo(() => {
    let list = comparisonResults.rows;

    // Filter Mode
    if (filterMode === 'all_unmatched') {
      list = list.filter(r => r.matchStatus === 'only_doc' || r.matchStatus === 'only_smb' || r.matchStatus === 'nominal_mismatch');
    } else if (filterMode === 'only_doc') {
      list = list.filter(r => r.matchStatus === 'only_doc');
    } else if (filterMode === 'only_smb') {
      list = list.filter(r => r.matchStatus === 'only_smb');
    } else if (filterMode === 'nominal_mismatch') {
      list = list.filter(r => r.matchStatus === 'nominal_mismatch');
    } else if (filterMode === 'matched') {
      list = list.filter(r => r.matchStatus === 'matched');
    }

    // Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(r => 
        r.userId.toLowerCase().includes(q) ||
        r.normalizedUserId.includes(q) ||
        (r.tanggalDoc && r.tanggalDoc.toLowerCase().includes(q)) ||
        (r.tanggalSmb && r.tanggalSmb.toLowerCase().includes(q)) ||
        (r.kodeDoc && r.kodeDoc.toLowerCase().includes(q)) ||
        (r.gameSmb && r.gameSmb.toLowerCase().includes(q)) ||
        (r.statusSmb && r.statusSmb.toLowerCase().includes(q)) ||
        (r.nominalDoc && String(r.nominalDoc).includes(q)) ||
        (r.nominalSmb && String(r.nominalSmb).includes(q))
      );
    }

    return list;
  }, [comparisonResults.rows, filterMode, searchTerm]);

  // Paginated Rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Copy User IDs (Line by line)
  const handleCopyUserIdsLine = () => {
    const ids = Array.from(new Set(filteredRows.map(r => r.userId))).filter(Boolean);
    if (ids.length === 0) return;
    navigator.clipboard.writeText(ids.join('\n'));
    setCopiedType('userIdLine');
    setSuccessMsg(`Berhasil menyalin ${ids.length} User ID (per baris)!`);
    setTimeout(() => {
      setCopiedType(null);
      setSuccessMsg(null);
    }, 2500);
  };

  // Copy User ID + Nominal format
  const handleCopyIdAndNominal = () => {
    if (filteredRows.length === 0) return;
    const lines = filteredRows.map(r => {
      const nomStr = r.nominalDoc ? `Rp ${formatThousands(r.nominalDoc)}` : (r.nominalSmb ? `Rp ${formatThousands(r.nominalSmb)}` : '-');
      let statusStr = '';
      if (r.matchStatus === 'only_doc') statusStr = '[HANYA DI DOC]';
      else if (r.matchStatus === 'only_smb') statusStr = '[HANYA DI SMB]';
      else if (r.matchStatus === 'nominal_mismatch') statusStr = `[BEDA NOMINAL: Doc Rp ${formatThousands(r.nominalDoc)} vs SMB Rp ${formatThousands(r.nominalSmb)}]`;
      else statusStr = '[COCOK]';

      return `${r.userId}\t${nomStr}\t${statusStr}`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedType('idNominal');
    setSuccessMsg(`Berhasil menyalin ${lines.length} data User ID & Nominal!`);
    setTimeout(() => {
      setCopiedType(null);
      setSuccessMsg(null);
    }, 2500);
  };

  // Copy User IDs (Comma separated)
  const handleCopyUserIdsComma = () => {
    const ids = Array.from(new Set(filteredRows.map(r => r.userId))).filter(Boolean);
    if (ids.length === 0) return;
    navigator.clipboard.writeText(ids.join(', '));
    setCopiedType('userIdComma');
    setSuccessMsg(`Berhasil menyalin ${ids.length} User ID (koma)!`);
    setTimeout(() => {
      setCopiedType(null);
      setSuccessMsg(null);
    }, 2500);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredRows.length === 0) return;

    const exportData = filteredRows.map((r, i) => {
      let statusLabel = 'MATCH / COCOK';
      if (r.matchStatus === 'only_doc') statusLabel = 'HANYA DI DOC (TIDAK ADA DI SMB)';
      else if (r.matchStatus === 'only_smb') statusLabel = 'HANYA DI BONUS SMB (TIDAK ADA DI DOC)';
      else if (r.matchStatus === 'nominal_mismatch') statusLabel = `BEDA NOMINAL (Doc: ${r.nominalDoc || 0} vs SMB: ${r.nominalSmb || 0})`;

      return {
        'No': i + 1,
        'User ID': r.userId,
        'Status Kroscek': statusLabel,
        'Nominal Doc': r.nominalDoc || 0,
        'Nominal SMB': r.nominalSmb || 0,
        'Selisih Nominal': r.nominalDiff || 0,
        'Tgl Doc': r.tanggalDoc || '-',
        'Bukti Screenshot Doc': r.buktiDoc || '-',
        'Kode Doc': r.kodeDoc || '-',
        'Tgl SMB': r.tanggalSmb || '-',
        'Game SMB': r.gameSmb || '-',
        'Ticket ID SMB': r.ticketSmb || '-',
        'Status SMB': r.statusSmb || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Filter_Scatter_Doc_vs_SMB');

    const fileName = `Kroscek_Scatter_Doc_vs_SMB_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setSuccessMsg(`File Excel "${fileName}" berhasil diunduh!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-black/40 backdrop-blur-2xl border border-amber-500/30 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Flame className="text-amber-500 animate-pulse" size={20} />
            <h3 className="text-base font-bold text-white font-mono tracking-wider uppercase">
              FILTER BONUS SCATTER: DATA DOC VS BONUS SMB
            </h3>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold px-2 py-0.5 rounded border border-amber-500/30">
              AUDIT USER ID & NOMINAL
            </span>
          </div>
          <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
            Mengecek kesesuaian <strong className="text-amber-400">User ID</strong> dan <strong className="text-amber-400">Nominal</strong> antara <strong className="text-amber-400">Data di Doc</strong> (Google Docs / Spreadsheet) dengan <strong className="text-amber-400">File Bonus SMB</strong>. 
            Jika user tidak ada di salah satu file atau nominal klaim berbeda, data akan langsung dimunculkan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleLoadDemo}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold font-mono rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:scale-105 active:scale-95"
            title="Muat contoh format Doc & Bonus SMB"
          >
            <Sparkles size={14} />
            <span>Muat Contoh Demo</span>
          </button>
          
          {(docData || smbData) && (
            <button
              onClick={handleResetAll}
              className="px-3 py-2 bg-white/5 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 text-xs font-mono font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 backdrop-blur-md"
              title="Reset kedua file"
            >
              <Trash2 size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/40 backdrop-blur-xl border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 shadow-lg">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 backdrop-blur-xl border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 shadow-lg">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* DUAL UPLOAD / PASTE CARDS (Side by Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* ================= BOX 1: DATA DI DOC ================= */}
        <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 space-y-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 font-mono tracking-widest uppercase flex items-center gap-1.5">
              <FileText size={15} className="text-amber-400" />
              1. DATA DI DOC (SPREADSHEET / GOOGLE DOCS)
            </span>
            {docData && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                {docData.rows.length} Baris Dimuat
              </span>
            )}
          </div>

          {/* Upload Drop Zone */}
          <div 
            onClick={() => docFileInputRef.current?.click()}
            className="border-2 border-dashed border-white/15 hover:border-amber-500/50 bg-black/20 hover:bg-black/40 p-4 rounded-xl text-center cursor-pointer transition group space-y-1.5 backdrop-blur-sm"
          >
            <input
              ref={docFileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv, .tsv"
              onChange={(e) => handleFileParsed(e.target.files?.[0] as File, true)}
              className="hidden"
            />
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/30 transition">
              <Upload size={14} />
            </div>
            <div className="text-xs font-semibold text-zinc-200">
              {docData ? docData.name : 'Upload File Data Doc (XLSX, XLS, CSV)'}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              Format: 27/08/2026 | saputra270 | https://prnt.sc/... | 15.000 | TK2E70T0JZ
            </p>
          </div>

          <div className="relative flex items-center py-0.5">
            <div className="grow border-t border-white/10"></div>
            <span className="shrink mx-2 text-[9px] font-mono uppercase text-zinc-400">ATAU PASTE TABEL DARI DOC</span>
            <div className="grow border-t border-white/10"></div>
          </div>

          {/* Direct Paste Area */}
          <textarea
            value={docPasteText}
            onChange={handleDocPasteChange}
            placeholder={`Paste data dari Doc di sini...\nContoh:\n27/08/2026\tsaputra270\thttps://prnt.sc/m_WmRdWNyogM\t15.000\tTK2E70T0JZ`}
            className="w-full h-28 bg-black/40 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-amber-500/50 text-xs font-mono leading-relaxed backdrop-blur-sm placeholder:text-zinc-600"
          />

          {/* Column Selectors (User ID & Nominal) */}
          {docData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 backdrop-blur-sm">
              <div>
                <label className="text-[10px] font-bold text-amber-300 font-mono uppercase block mb-1">
                  Kolom User ID Doc:
                </label>
                <select
                  value={docUserIdCol}
                  onChange={(e) => setDocUserIdCol(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500/40"
                >
                  {docData.headers.map(h => (
                    <option key={h} value={h} className="bg-zinc-900 text-white">{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-300 font-mono uppercase block mb-1">
                  Kolom Nominal Doc:
                </label>
                <select
                  value={docNominalCol}
                  onChange={(e) => setDocNominalCol(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500/40"
                >
                  {docData.headers.map(h => (
                    <option key={h} value={h} className="bg-zinc-900 text-white">{h}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ================= BOX 2: FILE BONUS SMB ================= */}
        <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 space-y-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 font-mono tracking-widest uppercase flex items-center gap-1.5">
              <FileCheck2 size={15} className="text-amber-400" />
              2. DATA FILE BONUS SMB (APPROVED SCATTER)
            </span>
            {smbData && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                {smbData.rows.length} Baris Dimuat
              </span>
            )}
          </div>

          {/* Upload Drop Zone */}
          <div 
            onClick={() => smbFileInputRef.current?.click()}
            className="border-2 border-dashed border-white/15 hover:border-amber-500/50 bg-black/20 hover:bg-black/40 p-4 rounded-xl text-center cursor-pointer transition group space-y-1.5 backdrop-blur-sm"
          >
            <input
              ref={smbFileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv, .tsv"
              onChange={(e) => handleFileParsed(e.target.files?.[0] as File, false)}
              className="hidden"
            />
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/30 transition">
              <Upload size={14} />
            </div>
            <div className="text-xs font-semibold text-zinc-200">
              {smbData ? smbData.name : 'Upload File Bonus SMB (XLSX, XLS, CSV)'}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              Format: 2026-08-03 00:10:43 | LIGABANDOT | yugivary | mahjong | 15,000.00 | APPROVED
            </p>
          </div>

          <div className="relative flex items-center py-0.5">
            <div className="grow border-t border-white/10"></div>
            <span className="shrink mx-2 text-[9px] font-mono uppercase text-zinc-400">ATAU PASTE TABEL BONUS SMB</span>
            <div className="grow border-t border-white/10"></div>
          </div>

          {/* Direct Paste Area */}
          <textarea
            value={smbPasteText}
            onChange={handleSmbPasteChange}
            placeholder={`Paste data dari Excel Bonus SMB di sini...\nContoh:\n2026-08-03 00:10:43\tLIGABANDOT\tyugivary\tmahjong\t2083961661332542466\tLIVECHAT\t1600\t3\t15,000.00\t\tAPPROVED`}
            className="w-full h-28 bg-black/40 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-amber-500/50 text-xs font-mono leading-relaxed backdrop-blur-sm placeholder:text-zinc-600"
          />

          {/* Column Selectors (User ID & Nominal) */}
          {smbData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 backdrop-blur-sm">
              <div>
                <label className="text-[10px] font-bold text-amber-300 font-mono uppercase block mb-1">
                  Kolom User ID SMB:
                </label>
                <select
                  value={smbUserIdCol}
                  onChange={(e) => setSmbUserIdCol(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500/40"
                >
                  {smbData.headers.map(h => (
                    <option key={h} value={h} className="bg-zinc-900 text-white">{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-300 font-mono uppercase block mb-1">
                  Kolom Nominal SMB:
                </label>
                <select
                  value={smbNominalCol}
                  onChange={(e) => setSmbNominalCol(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-500/40"
                >
                  {smbData.headers.map(h => (
                    <option key={h} value={h} className="bg-zinc-900 text-white">{h}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* SUMMARY STATISTIC METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Doc */}
        <div className="bg-black/30 backdrop-blur-2xl border border-white/10 p-4 rounded-xl space-y-1 shadow-lg">
          <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">Total Data Doc</div>
          <div className="text-lg font-bold text-white font-mono">
            {comparisonResults.metrics.totalDoc} <span className="text-xs text-zinc-500 font-normal">Baris</span>
          </div>
        </div>

        {/* Total SMB */}
        <div className="bg-black/30 backdrop-blur-2xl border border-white/10 p-4 rounded-xl space-y-1 shadow-lg">
          <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">Total Bonus SMB</div>
          <div className="text-lg font-bold text-white font-mono">
            {comparisonResults.metrics.totalSmb} <span className="text-xs text-zinc-500 font-normal">Baris</span>
          </div>
        </div>

        {/* Only Doc (Discrepancy 1) */}
        <div 
          onClick={() => { setFilterMode('only_doc'); setCurrentPage(1); }}
          className={`p-4 rounded-xl space-y-1 border cursor-pointer transition backdrop-blur-2xl shadow-lg ${
            filterMode === 'only_doc' 
              ? 'bg-rose-500/25 border-rose-500/70 ring-1 ring-rose-500/50' 
              : 'bg-black/30 border-rose-500/30 hover:bg-rose-500/15'
          }`}
        >
          <div className="text-[10px] font-bold text-rose-400 font-mono uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={12} />
            Hanya di Doc
          </div>
          <div className="text-lg font-bold text-rose-300 font-mono">
            {comparisonResults.metrics.onlyDocCount} <span className="text-xs text-rose-400/70 font-normal">User</span>
          </div>
          <div className="text-[9px] text-rose-400/80 font-mono truncate">Tidak ada di SMB</div>
        </div>

        {/* Only SMB (Discrepancy 2) */}
        <div 
          onClick={() => { setFilterMode('only_smb'); setCurrentPage(1); }}
          className={`p-4 rounded-xl space-y-1 border cursor-pointer transition backdrop-blur-2xl shadow-lg ${
            filterMode === 'only_smb' 
              ? 'bg-amber-500/25 border-amber-500/70 ring-1 ring-amber-500/50' 
              : 'bg-black/30 border-amber-500/30 hover:bg-amber-500/15'
          }`}
        >
          <div className="text-[10px] font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={12} />
            Hanya di SMB
          </div>
          <div className="text-lg font-bold text-amber-300 font-mono">
            {comparisonResults.metrics.onlySmbCount} <span className="text-xs text-amber-400/70 font-normal">User</span>
          </div>
          <div className="text-[9px] text-amber-400/80 font-mono truncate">Tidak ada di Doc</div>
        </div>

        {/* Beda Nominal (Discrepancy 3) */}
        <div 
          onClick={() => { setFilterMode('nominal_mismatch'); setCurrentPage(1); }}
          className={`p-4 rounded-xl space-y-1 border cursor-pointer transition backdrop-blur-2xl shadow-lg ${
            filterMode === 'nominal_mismatch' 
              ? 'bg-yellow-500/25 border-yellow-500/70 ring-1 ring-yellow-500/50' 
              : 'bg-black/30 border-yellow-500/30 hover:bg-yellow-500/15'
          }`}
        >
          <div className="text-[10px] font-bold text-yellow-400 font-mono uppercase tracking-wider flex items-center gap-1">
            <DollarSign size={12} />
            Beda Nominal
          </div>
          <div className="text-lg font-bold text-yellow-300 font-mono">
            {comparisonResults.metrics.nominalMismatchCount} <span className="text-xs text-yellow-400/70 font-normal">User</span>
          </div>
          <div className="text-[9px] text-yellow-400/80 font-mono truncate">Nominal tidak cocok</div>
        </div>

        {/* Matched in Both */}
        <div 
          onClick={() => { setFilterMode('matched'); setCurrentPage(1); }}
          className={`p-4 rounded-xl space-y-1 border cursor-pointer transition backdrop-blur-2xl shadow-lg ${
            filterMode === 'matched' 
              ? 'bg-emerald-500/25 border-emerald-500/70 ring-1 ring-emerald-500/50' 
              : 'bg-black/30 border-emerald-500/30 hover:bg-emerald-500/15'
          }`}
        >
          <div className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck size={12} />
            Cocok (Match)
          </div>
          <div className="text-lg font-bold text-emerald-300 font-mono">
            {comparisonResults.metrics.matchedCount} <span className="text-xs text-emerald-400/70 font-normal">User</span>
          </div>
          <div className="text-[9px] text-emerald-400/80 font-mono truncate">ID & Nominal Sesuai</div>
        </div>

      </div>

      {/* FILTER TABS & SEARCH TOOLBAR */}
      <div className="bg-black/30 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        
        {/* Search Input */}
        <div className="relative grow max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Cari User ID, Kode, Game..."
            className="w-full bg-black/40 border border-white/10 text-white pl-8 pr-3 py-1.5 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500/40 backdrop-blur-sm placeholder:text-zinc-600"
          />
        </div>

        {/* Filter View Selector Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setFilterMode('all_unmatched'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm ${
              filterMode === 'all_unmatched'
                ? 'bg-gradient-to-r from-rose-500/30 to-amber-500/30 text-white border border-amber-500/50 shadow-sm'
                : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
            }`}
          >
            <AlertTriangle size={12} className="text-amber-400" />
            <span>Semua Selisih ({comparisonResults.metrics.totalDiscrepancies})</span>
          </button>

          <button
            onClick={() => { setFilterMode('only_doc'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm ${
              filterMode === 'only_doc'
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/60'
                : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Hanya di Doc ({comparisonResults.metrics.onlyDocCount})</span>
          </button>

          <button
            onClick={() => { setFilterMode('only_smb'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm ${
              filterMode === 'only_smb'
                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60'
                : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Hanya Bonus SMB ({comparisonResults.metrics.onlySmbCount})</span>
          </button>

          <button
            onClick={() => { setFilterMode('nominal_mismatch'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm ${
              filterMode === 'nominal_mismatch'
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/60'
                : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Beda Nominal ({comparisonResults.metrics.nominalMismatchCount})</span>
          </button>

          <button
            onClick={() => { setFilterMode('matched'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm ${
              filterMode === 'matched'
                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/60'
                : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Cocok / Match ({comparisonResults.metrics.matchedCount})</span>
          </button>

          <button
            onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer backdrop-blur-sm ${
              filterMode === 'all'
                ? 'bg-white/20 text-white border border-white/40'
                : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
            }`}
          >
            <span>Semua Data ({comparisonResults.rows.length})</span>
          </button>
        </div>

        {/* Copy & Export Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleCopyIdAndNominal}
            disabled={filteredRows.length === 0}
            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl border border-amber-500/30 text-xs font-mono transition flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm font-semibold"
            title="Salin ID & Nominal lengkap"
          >
            {copiedType === 'idNominal' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>Salin ID & Nominal</span>
          </button>

          <button
            onClick={handleCopyUserIdsLine}
            disabled={filteredRows.length === 0}
            className="px-2.5 py-1.5 bg-black/40 hover:bg-white/10 text-zinc-300 rounded-xl border border-white/10 text-xs font-mono transition flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
            title="Salin list User ID per baris"
          >
            {copiedType === 'userIdLine' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>Salin ID</span>
          </button>

          <button
            onClick={handleCopyUserIdsComma}
            disabled={filteredRows.length === 0}
            className="px-2.5 py-1.5 bg-black/40 hover:bg-white/10 text-zinc-300 rounded-xl border border-white/10 text-xs font-mono transition flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
            title="Salin list User ID dipisah koma"
          >
            {copiedType === 'userIdComma' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>(Koma)</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0}
            className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-mono transition flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
            title="Download hasil kroscek dalam format Excel"
          >
            <Download size={12} />
            <span>Export Excel</span>
          </button>
        </div>

      </div>

      {/* RESULTS TABLE */}
      <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/60 backdrop-blur-md text-[10px] font-mono text-zinc-300 uppercase sticky top-0 z-10 border-b border-white/10">
              <tr>
                <th className="py-3.5 px-3 w-12 text-center">No</th>
                <th className="py-3.5 px-3">User ID</th>
                <th className="py-3.5 px-3 text-center">Status Verifikasi</th>
                <th className="py-3.5 px-3 text-right">Nominal di Doc</th>
                <th className="py-3.5 px-3 text-right">Nominal di SMB</th>
                <th className="py-3.5 px-3">Info Data di Doc</th>
                <th className="py-3.5 px-3">Info Bonus SMB</th>
                <th className="py-3.5 px-3 text-center">Bukti / Kode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-zinc-500">
                    <div className="space-y-2">
                      <ArrowRightLeft size={32} className="mx-auto text-zinc-600 animate-pulse" />
                      <div className="text-sm font-semibold text-zinc-400">Belum ada data untuk ditampilkan</div>
                      <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                        Silakan unggah atau paste Data di Doc dan File Bonus SMB, atau klik tombol <strong>"Muat Contoh Demo"</strong> di atas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr 
                      key={row.id}
                      className={`hover:bg-white/10 transition ${
                        row.matchStatus === 'only_doc' 
                          ? 'bg-rose-500/10 hover:bg-rose-500/20' 
                          : row.matchStatus === 'only_smb' 
                          ? 'bg-amber-500/10 hover:bg-amber-500/20' 
                          : row.matchStatus === 'nominal_mismatch'
                          ? 'bg-yellow-500/10 hover:bg-yellow-500/20'
                          : 'hover:bg-emerald-500/10'
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-zinc-500 font-medium">
                        {globalIdx}
                      </td>

                      {/* User ID */}
                      <td className="py-3 px-3 font-semibold text-white">
                        <span className="bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 text-amber-300 font-bold tracking-wide">
                          {row.userId || '-'}
                        </span>
                      </td>

                      {/* Match Status Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {row.matchStatus === 'only_doc' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm">
                            <AlertTriangle size={11} className="text-rose-400" />
                            Hanya di Doc (Tidak ada di SMB)
                          </span>
                        ) : row.matchStatus === 'only_smb' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm">
                            <AlertTriangle size={11} className="text-amber-400" />
                            Hanya di Bonus SMB (Tidak ada di Doc)
                          </span>
                        ) : row.matchStatus === 'nominal_mismatch' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-500/25 text-yellow-300 border border-yellow-500/40 shadow-sm">
                            <DollarSign size={11} className="text-yellow-400" />
                            Beda Nominal (Selisih: Rp {formatThousands(row.nominalDiff || 0)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm">
                            <ShieldCheck size={11} className="text-emerald-400" />
                            Cocok (ID & Nominal Valid)
                          </span>
                        )}
                      </td>

                      {/* Nominal di Doc */}
                      <td className="py-3 px-3 text-right font-medium">
                        {row.nominalDoc !== undefined && row.nominalDoc > 0 ? (
                          <span className={`font-bold ${row.matchStatus === 'nominal_mismatch' ? 'text-yellow-300 underline' : 'text-amber-300'}`}>
                            Rp {formatThousands(row.nominalDoc)}
                          </span>
                        ) : row.docData ? (
                          <span className="text-zinc-400">Rp 0</span>
                        ) : (
                          <span className="text-zinc-600 italic">- Tidak Ada di Doc -</span>
                        )}
                      </td>

                      {/* Nominal di SMB */}
                      <td className="py-3 px-3 text-right font-medium">
                        {row.nominalSmb !== undefined && row.nominalSmb > 0 ? (
                          <span className={`font-bold ${row.matchStatus === 'nominal_mismatch' ? 'text-yellow-300 underline' : 'text-emerald-300'}`}>
                            Rp {formatThousands(row.nominalSmb)}
                          </span>
                        ) : row.smbData ? (
                          <span className="text-zinc-400">Rp 0</span>
                        ) : (
                          <span className="text-zinc-600 italic">- Tidak Ada di SMB -</span>
                        )}
                      </td>

                      {/* Doc Details */}
                      <td className="py-3 px-3 text-zinc-300">
                        {row.docData ? (
                          <div className="space-y-0.5">
                            <div className="text-zinc-200">{row.tanggalDoc || '-'}</div>
                            {row.kodeDoc && (
                              <div className="text-[10px] text-amber-400 font-mono">
                                Kode: {row.kodeDoc}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic">- Data Doc Kosong -</span>
                        )}
                      </td>

                      {/* SMB Details */}
                      <td className="py-3 px-3 text-zinc-300">
                        {row.smbData ? (
                          <div className="space-y-0.5">
                            <div className="text-zinc-200">{row.tanggalSmb || '-'}</div>
                            <div className="text-[10px] text-zinc-400">
                              {row.gameSmb !== '-' ? `Game: ${row.gameSmb}` : 'Bonus Scatter SMB'} 
                              {row.statusSmb && ` • ${row.statusSmb}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic">- Data SMB Kosong -</span>
                        )}
                      </td>

                      {/* Bukti / Screenshot Link */}
                      <td className="py-3 px-3 text-center">
                        {row.buktiDoc && row.buktiDoc.startsWith('http') ? (
                          <a 
                            href={row.buktiDoc} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 underline bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20"
                          >
                            <span>Lihat Bukti</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : row.buktiDoc ? (
                          <span className="text-[10px] text-zinc-400 truncate max-w-[120px] block mx-auto">
                            {row.buktiDoc}
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        {filteredRows.length > 0 && (
          <div className="bg-black/50 backdrop-blur-md p-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <span>Tampilkan</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-black/60 border border-white/10 text-white px-2 py-0.5 rounded-lg text-xs font-mono focus:outline-none"
              >
                {[10, 25, 50, 100].map(sz => (
                  <option key={sz} value={sz} className="bg-zinc-900 text-white">{sz}</option>
                ))}
              </select>
              <span>per halaman • Menampilkan {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredRows.length)} dari {filteredRows.length} baris</span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-zinc-400">Hal {currentPage} dari {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-white/10 hover:bg-white/10 rounded-lg text-white transition disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-white/10 hover:bg-white/10 rounded-lg text-white transition disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
