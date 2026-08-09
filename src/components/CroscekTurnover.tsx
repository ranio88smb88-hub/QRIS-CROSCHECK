/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Calculator, 
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
  HelpCircle,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { cleanNumber, formatThousands } from '../utils/formatter';

interface CroscekRow {
  id: string;
  userId: string;
  totalTurnover: number;
  validTurnover: number;
  winLoss: number;
  komisiAgent: number;
  agentTagihan: number;
  rawRow: Record<string, any>;
}

export default function CroscekTurnover() {
  const [pasteText, setPasteText] = useState<string>('');
  const [fileData, setFileData] = useState<{ name: string; headers: string[]; rows: Record<string, any>[] } | null>(null);
  
  // Mapping State
  const [userIdCol, setUserIdCol] = useState<string>('');
  const [turnoverCol, setTurnoverCol] = useState<string>('');
  const [winLossCol, setWinLossCol] = useState<string>('');
  const [komisiCol, setKomisiCol] = useState<string>('');
  const [tagihanCol, setTagihanCol] = useState<string>('');

  // Config Rules
  const [multiplier, setMultiplier] = useState<number>(3);
  const [minTurnover, setMinTurnover] = useState<number>(100000);
  const [auditFilterMode, setAuditFilterMode] = useState<'all_flagged' | 'pl_hanti' | 'win_tinggi' | 'all_rows'>('pl_hanti');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Copy States
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Demo Data
  const handleLoadDemo = () => {
    const demoData = `Id Pemain\tTotal Bet Turnover\tValid Bet Turnover\tPemain menang/kalah\tKomisi Agent\tAgent Tagihan
"pl_hanti_user"\t300000\t300000\t500000\t-500000\t0
"bca222\t"\t65063000\t65063000\t222943000\t-222943000\t0
"slot_vip77"\t1500000\t1500000\t12000000\t-12000000\t0
"zeus_mania"\t50000000\t50000000\t80000000\t-80000000\t0
"player_rugi"\t261000\t261000\t1000\t-1000\t0
"player_kecil"\t50000\t50000\t30000\t-30000\t0`;
    
    setPasteText(demoData);
    processParsedText(demoData);
    setSuccessMsg('Data contoh berhasil dimuat! Menampilkan user yang memenuhi kriteria TO (min. 100.000) & Turnover x3.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Helper to process parsed text/tsv
  const processParsedText = (text: string) => {
    if (!text.trim()) return;
    const lines = text.trim().split(/[\r\n]+/);
    if (lines.length === 0) return;

    // Detect separator (tab or comma or semicolon)
    const firstLine = lines[0];
    let sep = '\t';
    if (firstLine.includes('\t')) sep = '\t';
    else if (firstLine.includes(',')) sep = ',';
    else if (firstLine.includes(';')) sep = ';';

    const headers = firstLine.split(sep).map(h => h.replace(/^["']|["']$/g, '').trim());
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(sep).map(c => c.replace(/^["']|["']$/g, '').trim());
      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] !== undefined ? cols[idx] : '';
      });
      rows.push(rowObj);
    }

    setFileData({ name: 'Text Input / Paste Clipboard', headers, rows });
    autoDetectColumns(headers);
  };

  // Handle File Upload (.xlsx, .xls, .csv, .tsv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawJson.length === 0) {
          setErrorMsg('File Excel / CSV kosong atau tidak memiliki data.');
          return;
        }

        const headers = Object.keys(rawJson[0]);
        setFileData({ name: file.name, headers, rows: rawJson });
        autoDetectColumns(headers);
        setSuccessMsg(`Berhasil mengimpor file ${file.name} (${rawJson.length} baris).`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err) {
        console.error('Error parsing excel:', err);
        setErrorMsg('Gagal membaca file Excel/CSV. Pastikan format file valid.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Auto detect columns by term matching
  const autoDetectColumns = (headers: string[]) => {
    const findCol = (terms: string[]) => {
      const hLower = headers.map(h => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));
      for (const t of terms) {
        const norm = t.toLowerCase().trim().replace(/[\s_-]+/g, '');
        const idx = hLower.findIndex(h => h.includes(norm));
        if (idx !== -1) return headers[idx];
      }
      return '';
    };

    const userCol = findCol(['id pemain', 'id_pemain', 'username', 'user id', 'pemain', 'account', 'id']);
    const toCol = findCol(['valid bet turnover', 'valid bet', 'validbet', 'total bet turnover', 'total bet', 'turnover']);
    const winCol = findCol(['pemain menang/kalah', 'pemain menang', 'menang/kalah', 'menang', 'win/loss', 'win loss', 'payout']);
    const komCol = findCol(['komisi agent', 'komisi', 'agent commission']);
    const tagCol = findCol(['agent tagihan', 'tagihan', 'agent bill']);

    setUserIdCol(userCol || headers[0] || '');
    setTurnoverCol(toCol || headers[1] || '');
    setWinLossCol(winCol || headers[3] || headers[2] || '');
    setKomisiCol(komCol || '');
    setTagihanCol(tagCol || '');
  };

  // Textarea input change handler
  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPasteText(val);
    processParsedText(val);
  };

  // Parse all rows into standardized CroscekRow objects
  const parsedRows = useMemo((): CroscekRow[] => {
    if (!fileData || fileData.rows.length === 0) return [];

    return fileData.rows.map((row, idx) => {
      // Clean User ID (strip quotes, extra spacing)
      const rawUser = String(row[userIdCol] ?? row[fileData.headers[0]] ?? '').replace(/^["']|["']$/g, '').trim();
      
      // Clean numeric fields
      const rawTurnoverVal = row[turnoverCol] ?? row['Valid Bet Turnover'] ?? row['Total Bet Turnover'] ?? 0;
      const rawTotalTo = row['Total Bet Turnover'] ?? rawTurnoverVal;
      const rawWinLossVal = row[winLossCol] ?? row['Pemain menang/kalah'] ?? 0;
      const rawKomisiVal = row[komisiCol] ?? row['Komisi Agent'] ?? 0;
      const rawTagihanVal = row[tagihanCol] ?? row['Agent Tagihan'] ?? 0;

      return {
        id: `row-${idx}`,
        userId: rawUser,
        totalTurnover: cleanNumber(rawTotalTo),
        validTurnover: cleanNumber(rawTurnoverVal),
        winLoss: cleanNumber(rawWinLossVal),
        komisiAgent: cleanNumber(rawKomisiVal),
        agentTagihan: cleanNumber(rawTagihanVal),
        rawRow: row
      };
    });
  }, [fileData, userIdCol, turnoverCol, winLossCol, komisiCol, tagihanCol]);

  // Main Anomaly & Audit Calculation
  // Kriteria audit hanya memproses user dengan Turnover minimal (misal Rp 100.000)
  // 1. Indikasi PL Hanti: Pemain Menang < (Turnover * Multiplier) -> Kemenangan tidak mencapai TO x3
  // 2. Anomali Win Tinggi: (Turnover * Multiplier) < Pemain Menang -> Kemenangan melebihi TO x3
  const processedData = useMemo(() => {
    return parsedRows.map(row => {
      const turnoverToUse = row.validTurnover || row.totalTurnover;
      const calculatedThreshold = turnoverToUse * multiplier;
      const playerWin = row.winLoss;

      // Cek syarat minimal Bet Turnover (misal: min. 100.000)
      const meetsMinTurnover = turnoverToUse >= minTurnover;

      // Indikasi PL Hanti: Pemain posisi Menang (Pemain Menang >= Valid TO) tetapi Kemenangan < Target TO x Multiplier
      const isPlHanti = meetsMinTurnover && playerWin >= turnoverToUse && playerWin < calculatedThreshold;
      const isWinTinggi = meetsMinTurnover && playerWin >= calculatedThreshold && playerWin > 0;
      const isAnomali = isPlHanti || isWinTinggi;
      const selisih = Math.abs(playerWin - calculatedThreshold);

      let status: 'PL_HANTI' | 'WIN_TINGGI' | 'NORMAL' = 'NORMAL';
      if (isPlHanti) status = 'PL_HANTI';
      else if (isWinTinggi) status = 'WIN_TINGGI';

      return {
        ...row,
        turnoverToUse,
        calculatedThreshold,
        playerWin,
        meetsMinTurnover,
        isPlHanti,
        isWinTinggi,
        isAnomali,
        status,
        selisih
      };
    });
  }, [parsedRows, multiplier, minTurnover]);

  // Filtered dataset based on selected audit filter mode & search term
  const filteredRows = useMemo(() => {
    return processedData.filter(row => {
      if (auditFilterMode === 'all_flagged' && !row.isAnomali) return false;
      if (auditFilterMode === 'pl_hanti' && !row.isPlHanti) return false;
      if (auditFilterMode === 'win_tinggi' && !row.isWinTinggi) return false;
      
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        return row.userId.toLowerCase().includes(term);
      }
      return true;
    });
  }, [processedData, auditFilterMode, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalScanned = processedData.length;
    const plHantiRows = processedData.filter(r => r.isPlHanti);
    const winTinggiRows = processedData.filter(r => r.isWinTinggi);
    const flaggedRows = processedData.filter(r => r.isAnomali);

    const totalPlHantiCount = plHantiRows.length;
    const totalWinTinggiCount = winTinggiRows.length;
    const totalFlaggedCount = flaggedRows.length;

    const totalPlHantiWin = plHantiRows.reduce((acc, r) => acc + r.playerWin, 0);
    const totalWinTinggiWin = winTinggiRows.reduce((acc, r) => acc + r.playerWin, 0);

    return {
      totalScanned,
      totalPlHantiCount,
      totalWinTinggiCount,
      totalFlaggedCount,
      totalPlHantiWin,
      totalWinTinggiWin
    };
  }, [processedData]);

  // Copy User IDs (Line by Line)
  const handleCopyUserIdsLine = () => {
    const list = filteredRows.map(r => r.userId).filter(Boolean).join('\n');
    if (!list) return;
    navigator.clipboard.writeText(list);
    setCopiedType('userIdLine');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Copy User IDs (Comma Separated)
  const handleCopyUserIdsComma = () => {
    const list = filteredRows.map(r => r.userId).filter(Boolean).join(', ');
    if (!list) return;
    navigator.clipboard.writeText(list);
    setCopiedType('userIdComma');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Copy Formatted Report for Admin / WhatsApp
  const handleCopyReport = () => {
    const targetRows = auditFilterMode === 'all_rows' ? processedData.filter(r => r.isAnomali) : filteredRows;
    if (targetRows.length === 0) return;

    let reportText = `🚨 *LAPORAN AUDIT CROSCEK TURNOVER VS MENANG (x${multiplier})*\n`;
    reportText += `Tanggal Audit: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}\n`;
    reportText += `Total User Terdeteksi: ${targetRows.length} User\n`;
    reportText += `------------------------------------------\n\n`;

    targetRows.forEach((r, idx) => {
      const statusLabel = r.isPlHanti 
        ? '🔴 Indikasi PL Hanti (Menang < TOx' + multiplier + ')' 
        : r.isWinTinggi 
        ? '🟡 Anomali Win Tinggi (TOx' + multiplier + ' < Menang)' 
        : '⚪ Normal';

      reportText += `#${idx + 1} User: *${r.userId}*\n`;
      reportText += `• Status: ${statusLabel}\n`;
      reportText += `• Valid Turnover: Rp ${formatThousands(r.turnoverToUse)}\n`;
      reportText += `• Target TO x${multiplier}: Rp ${formatThousands(r.calculatedThreshold)}\n`;
      reportText += `• Pemain Menang: Rp ${formatThousands(r.playerWin)}\n`;
      reportText += `• Selisih Nominal: Rp ${formatThousands(r.selisih)}\n\n`;
    });

    reportText += `------------------------------------------\n`;
    reportText += `*Ringkasan Laporan:*\n`;
    reportText += `• Total Indikasi PL Hanti: ${metrics.totalPlHantiCount} User (Rp ${formatThousands(metrics.totalPlHantiWin)})\n`;
    reportText += `• Total Win Tinggi (>TOx${multiplier}): ${metrics.totalWinTinggiCount} User (Rp ${formatThousands(metrics.totalWinTinggiWin)})\n`;

    navigator.clipboard.writeText(reportText);
    setCopiedType('reportText');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Export Filtered Result to Excel (.xlsx)
  const handleExportExcel = () => {
    const targetRows = auditFilterMode === 'all_rows' ? processedData : filteredRows;
    if (targetRows.length === 0) return;

    const excelData = targetRows.map((r, idx) => ({
      'No': idx + 1,
      'Id Pemain': r.userId,
      'Valid Bet Turnover': r.turnoverToUse,
      [`Turnover x${multiplier}`]: r.calculatedThreshold,
      'Pemain Menang/Kalah': r.playerWin,
      'Selisih Nominal': r.selisih,
      'Komisi Agent': r.komisiAgent,
      'Agent Tagihan': r.agentTagihan,
      'Kategori Status': r.isPlHanti 
        ? `Indikasi PL Hanti (Menang < TO x${multiplier})` 
        : r.isWinTinggi 
        ? `Anomali Win Tinggi (TO x${multiplier} < Menang)` 
        : 'Normal'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Turnover');
    XLSX.writeFile(wb, `Audit_Turnover_PL_Hanti_x${multiplier}_${Date.now()}.xlsx`);
  };

  const handleReset = () => {
    setPasteText('');
    setFileData(null);
    setSearchTerm('');
    setErrorMsg(null);
    setSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-black/40 backdrop-blur-md border border-amber-500/30 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500 animate-pulse" size={18} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              AUDIT CROSCEK TURNOVER VS PEMAIN MENANG
            </h2>
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Mendeteksi <span className="text-rose-400 font-mono font-semibold">Indikasi PL Hanti</span> (Kemenangan &lt; TO x{multiplier}) dan <span className="text-amber-400 font-mono font-semibold">Anomali Win Tinggi</span> untuk user dengan Bet Turnover &ge; Rp {formatThousands(minTurnover)}.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleLoadDemo}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded border border-amber-500/20 text-xs font-semibold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            Muat Data Contoh
          </button>

          {(pasteText || fileData) && (
            <button 
              onClick={handleReset}
              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/30 text-red-400 rounded border border-red-900/30 text-xs font-semibold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5"
            >
              Reset Data
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/40 backdrop-blur-md border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 backdrop-blur-md border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Input Data Section: Upload File or Paste Clipboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Box: Data Import & Settings */}
        <div className="col-span-1 lg:col-span-5 space-y-5">
          
          {/* File Upload & Paste Tab Header */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-5 space-y-4 shadow-lg">
            <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-amber-500" />
              1. Import File Excel atau Paste Data
            </span>

            {/* Drag & Drop Upload Zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-amber-500/50 bg-black/30 hover:bg-black/50 p-5 rounded-xl text-center cursor-pointer transition group space-y-2 backdrop-blur-sm"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload size={22} className="mx-auto text-zinc-500 group-hover:text-amber-500 transition-colors" />
              <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                {fileData ? fileData.name : 'Upload File Excel (.xlsx / .csv)'}
              </div>
              <p className="text-[10px] text-zinc-500">
                Klik atau drag & drop file laporan turnover di sini
              </p>
            </div>

            <div className="relative flex items-center py-1">
              <div className="grow border-t border-white/10"></div>
              <span className="shrink mx-2 text-[10px] font-mono uppercase text-zinc-500">ATAU PASTE TABEL</span>
              <div className="grow border-t border-white/10"></div>
            </div>

            {/* Direct Paste Area */}
            <textarea
              value={pasteText}
              onChange={handlePasteChange}
              placeholder="Paste baris data dari Excel di sini...&#10;Contoh:&#10;Id Pemain	Total Bet Turnover	Valid Bet Turnover	Pemain menang/kalah&#10;bca222	65063000	65063000	222943000"
              className="w-full h-36 bg-black/30 border border-white/10 text-white p-3 rounded-lg focus:outline-none focus:border-amber-500/50 text-xs font-mono leading-relaxed backdrop-blur-sm"
            />
          </div>

          {/* Configuration & Column Mapping Panel */}
          {fileData && (
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-5 space-y-4 shadow-lg">
              <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase flex items-center gap-1.5">
                <Filter size={14} className="text-amber-500" />
                2. Pemetaan Kolom & Paramater Filter
              </span>

              {/* Multiplier Configuration */}
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 space-y-2 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400 font-mono uppercase">
                    Faktor Kelipatan (Multiplier)
                  </label>
                  <span className="text-xs font-mono font-bold text-white bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                    Turnover x {multiplier}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => setMultiplier(val)}
                      className={`flex-1 py-1 rounded text-xs font-mono font-bold transition ${
                        multiplier === val
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      x{val}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Kriteria target: <span className="text-amber-300 font-mono font-semibold">(Turnover x {multiplier})</span>.
                </p>
              </div>

              {/* Minimal Bet Turnover Configuration */}
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 space-y-2 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400 font-mono uppercase">
                    Minimal Bet Turnover
                  </label>
                  <span className="text-xs font-mono font-bold text-white bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                    {minTurnover === 0 ? 'Semua TO' : `Min. Rp ${formatThousands(minTurnover)}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[0, 50000, 100000, 250000, 500000].map(val => (
                    <button
                      key={val}
                      onClick={() => setMinTurnover(val)}
                      className={`flex-1 py-1 rounded text-[11px] font-mono font-bold transition ${
                        minTurnover === val
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      {val === 0 ? 'Semua' : `${val / 1000}k`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Hanya mengaudit user dengan Bet Turnover <span className="text-amber-300 font-mono font-semibold">&ge; Rp {formatThousands(minTurnover)}</span>.
                </p>
              </div>

              {/* Column Mapping Selector */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Kolom Id Pemain / User ID</label>
                  <select
                    value={userIdCol}
                    onChange={(e) => setUserIdCol(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30 backdrop-blur-sm"
                  >
                    {fileData.headers.map(h => (
                      <option key={h} value={h} className="bg-zinc-900 text-white">{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Kolom Valid / Total Bet Turnover</label>
                  <select
                    value={turnoverCol}
                    onChange={(e) => setTurnoverCol(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30 backdrop-blur-sm"
                  >
                    {fileData.headers.map(h => (
                      <option key={h} value={h} className="bg-zinc-900 text-white">{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Kolom Pemain Menang/Kalah</label>
                  <select
                    value={winLossCol}
                    onChange={(e) => setWinLossCol(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30 backdrop-blur-sm"
                  >
                    {fileData.headers.map(h => (
                      <option key={h} value={h} className="bg-zinc-900 text-white">{h}</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Box: Results Dashboard & Data Table */}
        <div className="col-span-1 lg:col-span-7 space-y-5">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3.5 rounded-xl space-y-1 shadow-lg">
              <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">Total Scanned</div>
              <div className="text-lg font-bold text-white font-mono">
                {metrics.totalScanned} <span className="text-xs text-zinc-500 font-normal">User</span>
              </div>
            </div>

            <div 
              onClick={() => setAuditFilterMode('pl_hanti')}
              className={`p-3.5 rounded-xl space-y-1 border cursor-pointer transition backdrop-blur-md shadow-lg ${
                auditFilterMode === 'pl_hanti' 
                  ? 'bg-rose-500/20 border-rose-500/60 ring-1 ring-rose-500/40' 
                  : 'bg-black/40 border-rose-500/30 hover:bg-rose-500/15'
              }`}
            >
              <div className="text-[10px] font-bold text-rose-400 font-mono uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={10} />
                Indikasi PL Hanti
              </div>
              <div className="text-lg font-bold text-rose-300 font-mono">
                {metrics.totalPlHantiCount} <span className="text-xs text-rose-400/70 font-normal">User</span>
              </div>
              <div className="text-[10px] font-mono text-rose-400/80 truncate">
                Menang &lt; TO x{multiplier}
              </div>
            </div>

            <div 
              onClick={() => setAuditFilterMode('win_tinggi')}
              className={`p-3.5 rounded-xl space-y-1 border cursor-pointer transition backdrop-blur-md shadow-lg ${
                auditFilterMode === 'win_tinggi' 
                  ? 'bg-amber-500/20 border-amber-500/60 ring-1 ring-amber-500/40' 
                  : 'bg-black/40 border-amber-500/30 hover:bg-amber-500/15'
              }`}
            >
              <div className="text-[10px] font-bold text-amber-400 font-mono uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={10} />
                Win Tinggi
              </div>
              <div className="text-lg font-bold text-amber-300 font-mono">
                {metrics.totalWinTinggiCount} <span className="text-xs text-amber-400/70 font-normal">User</span>
              </div>
              <div className="text-[10px] font-mono text-amber-400/80 truncate">
                TO x{multiplier} &lt; Menang
              </div>
            </div>

            <div 
              onClick={() => setAuditFilterMode('all_flagged')}
              className={`p-3.5 rounded-xl space-y-1 border cursor-pointer transition backdrop-blur-md shadow-lg ${
                auditFilterMode === 'all_flagged' 
                  ? 'bg-amber-500/20 border-amber-500/60 ring-1 ring-amber-500/40' 
                  : 'bg-black/40 border-white/10 hover:bg-white/5'
              }`}
            >
              <div className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">Total Terdeteksi</div>
              <div className="text-lg font-bold text-white font-mono">
                {metrics.totalFlaggedCount} <span className="text-xs text-zinc-500 font-normal">Anomali</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 truncate">
                Gabungan Audit
              </div>
            </div>

          </div>

          {/* Action Toolbar */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-lg">
            
            {/* Search Input */}
            <div className="relative grow max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari ID Pemain..."
                className="w-full bg-black/40 border border-white/10 text-white pl-8 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500/40 backdrop-blur-sm"
              />
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setAuditFilterMode('pl_hanti')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1 cursor-pointer ${
                  auditFilterMode === 'pl_hanti'
                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50'
                    : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                <AlertTriangle size={12} className="text-rose-400" />
                Indikasi PL Hanti
              </button>

              <button
                onClick={() => setAuditFilterMode('win_tinggi')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1 cursor-pointer ${
                  auditFilterMode === 'win_tinggi'
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                    : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                <Filter size={12} className="text-amber-400" />
                Win Tinggi (&gt;TOx{multiplier})
              </button>

              <button
                onClick={() => setAuditFilterMode('all_flagged')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1 cursor-pointer ${
                  auditFilterMode === 'all_flagged'
                    ? 'bg-amber-500/25 text-amber-400 border border-amber-500/50'
                    : 'bg-black/40 text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                Semua Terindikasi
              </button>

              <button
                onClick={() => setAuditFilterMode('all_rows')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1 cursor-pointer ${
                  auditFilterMode === 'all_rows'
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-black/40 text-zinc-500 border border-white/10 hover:text-white'
                }`}
              >
                Semua Data
              </button>
            </div>

            {/* Copy & Export Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleCopyUserIdsLine}
                disabled={filteredRows.length === 0}
                className="px-2 py-1.5 bg-black/40 hover:bg-white/10 text-zinc-300 rounded border border-white/10 text-xs font-mono transition flex items-center gap-1"
                title="Salin list ID Pemain per baris"
              >
                {copiedType === 'userIdLine' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                Salin ID (Baris)
              </button>

              <button
                onClick={handleCopyUserIdsComma}
                disabled={filteredRows.length === 0}
                className="px-2 py-1.5 bg-black/40 hover:bg-white/10 text-zinc-300 rounded border border-white/10 text-xs font-mono transition flex items-center gap-1"
                title="Salin list ID Pemain dipisah koma"
              >
                {copiedType === 'userIdComma' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                Salin ID (Koma)
              </button>

              <button
                onClick={handleCopyReport}
                disabled={filteredRows.length === 0}
                className="px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 text-xs font-mono transition flex items-center gap-1"
                title="Salin ringkasan laporan ke WhatsApp"
              >
                {copiedType === 'reportText' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                Laporan WA
              </button>

              <button
                onClick={handleExportExcel}
                disabled={filteredRows.length === 0}
                className="px-2 py-1.5 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 rounded border border-emerald-500/30 text-xs font-mono transition flex items-center gap-1"
                title="Download Excel"
              >
                <Download size={12} />
                Excel
              </button>
            </div>

          </div>

          {/* Results Table */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-black/60 backdrop-blur-md text-[10px] font-mono text-zinc-300 uppercase sticky top-0 z-10 border-b border-white/10">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-3">Id Pemain</th>
                    <th className="py-3 px-3 text-right">Valid Turnover</th>
                    <th className="py-3 px-3 text-right bg-amber-500/10 text-amber-400">Target TO x{multiplier}</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Pemain Menang</th>
                    <th className="py-3 px-3 text-right">Selisih</th>
                    <th className="py-3 px-3 text-center">Status Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs font-mono">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        {fileData ? 'Tidak ada data user yang sesuai kriteria filter.' : 'Silakan import file Excel atau paste data untuk memulai audit.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr 
                        key={row.id}
                        className={`hover:bg-white/10 transition ${
                          row.isPlHanti 
                            ? 'bg-rose-500/10 hover:bg-rose-500/20' 
                            : row.isWinTinggi 
                            ? 'bg-amber-500/10 hover:bg-amber-500/20' 
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-zinc-500 text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          <span className="bg-black/50 px-2 py-0.5 rounded border border-white/10 text-amber-300">
                            {row.userId || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-300">
                          {formatThousands(row.turnoverToUse)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-400 bg-amber-500/5">
                          {formatThousands(row.calculatedThreshold)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {formatThousands(row.playerWin)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-400 text-[11px]">
                          Rp {formatThousands(row.selisih)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.isPlHanti ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40">
                              <AlertTriangle size={10} className="text-rose-400" />
                              Indikasi PL Hanti
                            </span>
                          ) : row.isWinTinggi ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40">
                              <Sparkles size={10} />
                              TO x{multiplier} &lt; Menang
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-zinc-400">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Bar */}
            {filteredRows.length > 0 && (
              <div className="bg-black/50 backdrop-blur-md p-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>Menampilkan {filteredRows.length} dari {processedData.length} User</span>
                <span>Audit Multiplier: TO x {multiplier}</span>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
