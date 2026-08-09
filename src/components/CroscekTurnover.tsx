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
  const [onlyShowAnomali, setOnlyShowAnomali] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Copy States
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Demo Data
  const handleLoadDemo = () => {
    const demoData = `Id Pemain\tTotal Bet Turnover\tValid Bet Turnover\tPemain menang/kalah\tKomisi Agent\tAgent Tagihan
"bca222\t"\t65063000\t65063000\t222943000\t-222943000\t0
"slot_vip77"\t1500000\t1500000\t12000000\t-12000000\t0
"player_normal"\t100000000\t100000000\t250000000\t-250000000\t0
"member_gacor"\t20000000\t20000000\t150000000\t-150000000\t0
"zeus_mania"\t50000000\t50000000\t80000000\t-80000000\t0`;
    
    setPasteText(demoData);
    processParsedText(demoData);
    setSuccessMsg('Data contoh berhasil dimuat! Menampilkan user yang memenuhi kriteria Turnover x3 < Pemain Menang.');
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

  // Main Anomaly Filter: (Turnover * Multiplier) < Pemain Menang
  // For example: Turnover = 65,063,000 * 3 = 195,189,000 < Pemain Menang (222,943,000) => FLAGGED!
  const processedData = useMemo(() => {
    return parsedRows.map(row => {
      const turnoverToUse = row.validTurnover || row.totalTurnover;
      const calculatedThreshold = turnoverToUse * multiplier;
      const playerWin = row.winLoss;

      // Anomaly trigger: Turnover x Multiplier < Menang
      const isAnomali = calculatedThreshold < playerWin && playerWin > 0;
      const selisih = playerWin - calculatedThreshold; // How much player win exceeds (TO * multiplier)

      return {
        ...row,
        turnoverToUse,
        calculatedThreshold,
        isAnomali,
        selisih
      };
    });
  }, [parsedRows, multiplier]);

  // Filtered dataset based on toggle & search
  const filteredRows = useMemo(() => {
    return processedData.filter(row => {
      if (onlyShowAnomali && !row.isAnomali) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        return row.userId.toLowerCase().includes(term);
      }
      return true;
    });
  }, [processedData, onlyShowAnomali, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalScanned = processedData.length;
    const anomaliRows = processedData.filter(r => r.isAnomali);
    const totalAnomaliCount = anomaliRows.length;
    const totalAnomaliTurnover = anomaliRows.reduce((acc, r) => acc + r.turnoverToUse, 0);
    const totalAnomaliWin = anomaliRows.reduce((acc, r) => acc + r.winLoss, 0);
    const totalSelisih = anomaliRows.reduce((acc, r) => acc + r.selisih, 0);

    return {
      totalScanned,
      totalAnomaliCount,
      totalAnomaliTurnover,
      totalAnomaliWin,
      totalSelisih
    };
  }, [processedData]);

  // Copy User IDs (Line by Line)
  const handleCopyUserIdsLine = () => {
    const targetRows = onlyShowAnomali ? processedData.filter(r => r.isAnomali) : processedData;
    const list = targetRows.map(r => r.userId).filter(Boolean).join('\n');
    if (!list) return;
    navigator.clipboard.writeText(list);
    setCopiedType('userIdLine');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Copy User IDs (Comma Separated)
  const handleCopyUserIdsComma = () => {
    const targetRows = onlyShowAnomali ? processedData.filter(r => r.isAnomali) : processedData;
    const list = targetRows.map(r => r.userId).filter(Boolean).join(', ');
    if (!list) return;
    navigator.clipboard.writeText(list);
    setCopiedType('userIdComma');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Copy Formatted Report for Admin / WhatsApp
  const handleCopyReport = () => {
    const targetRows = processedData.filter(r => r.isAnomali);
    if (targetRows.length === 0) return;

    let reportText = `🚨 *LAPORAN CROSCEK ANOMALI TURNOVER VS MENANG (x${multiplier})*\n`;
    reportText += `Tanggal Audit: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}\n`;
    reportText += `Total User Terindikasi: ${targetRows.length} User\n`;
    reportText += `------------------------------------------\n\n`;

    targetRows.forEach((r, idx) => {
      reportText += `#${idx + 1} User: *${r.userId}*\n`;
      reportText += `• Valid Turnover: Rp ${formatThousands(r.turnoverToUse)}\n`;
      reportText += `• TO x${multiplier}: Rp ${formatThousands(r.calculatedThreshold)}\n`;
      reportText += `• Pemain Menang: Rp ${formatThousands(r.winLoss)}\n`;
      reportText += `• Selisih (Menang - TOx${multiplier}): Rp ${formatThousands(r.selisih)}\n\n`;
    });

    reportText += `------------------------------------------\n`;
    reportText += `*Total Kemenangan Anomali:* Rp ${formatThousands(metrics.totalAnomaliWin)}\n`;

    navigator.clipboard.writeText(reportText);
    setCopiedType('reportText');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Export Filtered Result to Excel (.xlsx)
  const handleExportExcel = () => {
    const targetRows = onlyShowAnomali ? processedData.filter(r => r.isAnomali) : processedData;
    if (targetRows.length === 0) return;

    const excelData = targetRows.map((r, idx) => ({
      'No': idx + 1,
      'Id Pemain': r.userId,
      'Valid Bet Turnover': r.turnoverToUse,
      [`Turnover x${multiplier}`]: r.calculatedThreshold,
      'Pemain Menang/Kalah': r.winLoss,
      'Selisih (Menang - TO x Multiplier)': r.selisih,
      'Komisi Agent': r.komisiAgent,
      'Agent Tagihan': r.agentTagihan,
      'Status Audit': r.isAnomali ? `ANOMALI (TO x${multiplier} < Menang)` : 'NORMAL'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Anomali Turnover');
    XLSX.writeFile(wb, `Audit_Turnover_vs_Menang_x${multiplier}_${Date.now()}.xlsx`);
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
      <div className="bg-[#18181b]/70 backdrop-blur-md border border-amber-500/20 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500 animate-pulse" size={18} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              AUDIT CROSCEK TURNOVER VS PEMAIN MENANG
            </h2>
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Filter otomatis user dengan <span className="text-amber-400 font-mono font-semibold">Turnover x {multiplier} &lt; Pemain Menang</span> untuk mendeteksi rasio kemenangan yang tidak wajar.
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
        <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Input Data Section: Upload File or Paste Clipboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Box: Data Import & Settings */}
        <div className="col-span-1 lg:col-span-5 space-y-5">
          
          {/* File Upload & Paste Tab Header */}
          <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] rounded-xl p-5 space-y-4">
            <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-amber-500" />
              1. Import File Excel atau Paste Data
            </span>

            {/* Drag & Drop Upload Zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-[#09090b]/80 p-5 rounded-xl text-center cursor-pointer transition group space-y-2"
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
              <div className="grow border-t border-zinc-800"></div>
              <span className="shrink mx-2 text-[10px] font-mono uppercase text-zinc-600">ATAU PASTE TABEL</span>
              <div className="grow border-t border-zinc-800"></div>
            </div>

            {/* Direct Paste Area */}
            <textarea
              value={pasteText}
              onChange={handlePasteChange}
              placeholder="Paste baris data dari Excel di sini...&#10;Contoh:&#10;Id Pemain	Total Bet Turnover	Valid Bet Turnover	Pemain menang/kalah&#10;bca222	65063000	65063000	222943000"
              className="w-full h-36 bg-[#09090b] border border-[#27272a] text-white p-3 rounded-lg focus:outline-none focus:border-amber-500/50 text-xs font-mono leading-relaxed"
            />
          </div>

          {/* Configuration & Column Mapping Panel */}
          {fileData && (
            <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase flex items-center gap-1.5">
                <Filter size={14} className="text-amber-500" />
                2. Pemetaan Kolom & Paramater Filter
              </span>

              {/* Multiplier Configuration */}
              <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/15 space-y-2">
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
                          : 'bg-[#09090b] text-zinc-400 border border-zinc-800 hover:text-white'
                      }`}
                    >
                      x{val}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Sistem mendeteksi user jika: <span className="text-amber-300 font-mono font-semibold">(Turnover x {multiplier}) &lt; Pemain Menang</span>.
                </p>
              </div>

              {/* Column Mapping Selector */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Kolom Id Pemain / User ID</label>
                  <select
                    value={userIdCol}
                    onChange={(e) => setUserIdCol(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30"
                  >
                    {fileData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Kolom Valid / Total Bet Turnover</label>
                  <select
                    value={turnoverCol}
                    onChange={(e) => setTurnoverCol(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30"
                  >
                    {fileData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Kolom Pemain Menang/Kalah</label>
                  <select
                    value={winLossCol}
                    onChange={(e) => setWinLossCol(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30"
                  >
                    {fileData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
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
            
            <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] p-3.5 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-zinc-500 font-mono uppercase tracking-wider">Total Scanned</div>
              <div className="text-lg font-bold text-white font-mono">
                {metrics.totalScanned} <span className="text-xs text-zinc-500 font-normal">User</span>
              </div>
            </div>

            <div className="bg-[#18181b]/70 backdrop-blur-md border border-amber-500/30 p-3.5 rounded-xl space-y-1 bg-amber-500/5">
              <div className="text-[10px] font-bold text-amber-500 font-mono uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={10} />
                User Terindikasi
              </div>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {metrics.totalAnomaliCount} <span className="text-xs text-amber-500/70 font-normal">Anomali</span>
              </div>
            </div>

            <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] p-3.5 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-zinc-500 font-mono uppercase tracking-wider">Total TO Anomali</div>
              <div className="text-xs font-bold text-white font-mono truncate" title={`Rp ${formatThousands(metrics.totalAnomaliTurnover)}`}>
                Rp {formatThousands(metrics.totalAnomaliTurnover)}
              </div>
            </div>

            <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] p-3.5 rounded-xl space-y-1">
              <div className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-wider">Total Menang Anomali</div>
              <div className="text-xs font-bold text-emerald-400 font-mono truncate" title={`Rp ${formatThousands(metrics.totalAnomaliWin)}`}>
                Rp {formatThousands(metrics.totalAnomaliWin)}
              </div>
            </div>

          </div>

          {/* Action Toolbar */}
          <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative grow max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari ID Pemain..."
                className="w-full bg-[#09090b] border border-[#27272a] text-white pl-8 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500/40"
              />
            </div>

            {/* Filter Toggle Switch */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnlyShowAnomali(!onlyShowAnomali)}
                className={`px-3 py-1.5 rounded text-xs font-semibold font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                  onlyShowAnomali
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-[#09090b] text-zinc-400 border border-zinc-800'
                }`}
              >
                <Filter size={12} />
                {onlyShowAnomali ? 'Hanya Anomali' : 'Semua Data'}
              </button>
            </div>

            {/* Copy & Export Dropdown Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleCopyUserIdsLine}
                disabled={filteredRows.length === 0}
                className="px-2.5 py-1.5 bg-[#09090b] hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 text-xs font-mono transition flex items-center gap-1"
                title="Salin list ID Pemain per baris"
              >
                {copiedType === 'userIdLine' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                Salin ID (Baris)
              </button>

              <button
                onClick={handleCopyUserIdsComma}
                disabled={filteredRows.length === 0}
                className="px-2.5 py-1.5 bg-[#09090b] hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 text-xs font-mono transition flex items-center gap-1"
                title="Salin list ID Pemain dipisah koma"
              >
                {copiedType === 'userIdComma' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                Salin ID (Koma)
              </button>

              <button
                onClick={handleCopyReport}
                disabled={metrics.totalAnomaliCount === 0}
                className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 text-xs font-mono transition flex items-center gap-1"
                title="Salin ringkasan laporan ke WhatsApp"
              >
                {copiedType === 'reportText' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                Laporan WA
              </button>

              <button
                onClick={handleExportExcel}
                disabled={filteredRows.length === 0}
                className="px-2.5 py-1.5 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 rounded border border-emerald-500/30 text-xs font-mono transition flex items-center gap-1"
                title="Download Excel"
              >
                <Download size={12} />
                Excel
              </button>
            </div>

          </div>

          {/* Results Table */}
          <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#09090b] text-[10px] font-mono text-zinc-400 uppercase sticky top-0 z-10 border-b border-[#27272a]">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-3">Id Pemain</th>
                    <th className="py-3 px-3 text-right">Valid Turnover</th>
                    <th className="py-3 px-3 text-right bg-amber-500/5 text-amber-400">Turnover x{multiplier}</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Pemain Menang</th>
                    <th className="py-3 px-3 text-right">Selisih</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]/50 text-xs font-mono">
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
                        className={`hover:bg-zinc-800/40 transition ${
                          row.isAnomali ? 'bg-amber-500/5 hover:bg-amber-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-zinc-500 text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          <span className="bg-[#09090b] px-2 py-0.5 rounded border border-zinc-800 text-amber-300">
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
                          {formatThousands(row.winLoss)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-400 text-[11px]">
                          +{formatThousands(row.selisih)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.isAnomali ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              <AlertTriangle size={10} />
                              TO x{multiplier} &lt; Menang
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400">
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
              <div className="bg-[#09090b] p-3 border-t border-[#27272a] flex items-center justify-between text-[11px] font-mono text-zinc-400">
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
