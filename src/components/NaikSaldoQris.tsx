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
  AlertCircle, 
  FileSpreadsheet, 
  TrendingUp, 
  RefreshCw, 
  ArrowRight,
  Info
} from 'lucide-react';
import { cleanNumber, formatThousands } from '../utils/formatter';

interface DashboardFileState {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  selectedCol: string;
  selectedFeeCol: string;
}

export default function NaikSaldoQris() {
  const [saldoAwalInput, setSaldoAwalInput] = useState<string>('');
  const [totalApproveSemalamInput, setTotalApproveSemalamInput] = useState<string>('');
  const [selisihTetapInput, setSelisihTetapInput] = useState<string>('-40024');
  const [saldoPendingInput, setSaldoPendingInput] = useState<string>('');
  const [saldoDashboardInput, setSaldoDashboardInput] = useState<string>('');
  const [saldoDashboardSaatIniInput, setSaldoDashboardSaatIniInput] = useState<string>('');
  const [biayaInput, setBiayaInput] = useState<string>('');

  // Dashboard File upload state
  const [dashboardFile, setDashboardFile] = useState<DashboardFileState | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse clipboard / multiple numbers pasted in a text block
  const sumNumbersFromText = (text: string): number => {
    if (!text) return 0;
    
    // Find all potential numeric sequences block by block (handles line breaks or random separators)
    // First, let's extract individual lines
    const lines = text.split(/[\r\n]+/);
    let total = 0;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Clean up common characters but keep signs if necessary
      // Clean money values like "Rp. 150.000" or similar
      const cleaned = cleanNumber(trimmed);
      if (cleaned !== 0) {
        total += cleaned;
      }
    });

    return total;
  };

  // Convert inputs to raw numbers or sum.
  // If the user pasted a multi-line spreadsheet copy, this handles it beautifully.
  const handleCalculateValue = (input: string): number => {
    if (!input) return 0;
    if (input.includes('\n')) {
      return sumNumbersFromText(input);
    }
    return cleanNumber(input);
  };

  const parsedSaldoAwal = useMemo(() => handleCalculateValue(saldoAwalInput), [saldoAwalInput]);
  const parsedTotalApproveSemalam = useMemo(() => handleCalculateValue(totalApproveSemalamInput), [totalApproveSemalamInput]);
  const parsedSelisihTetap = useMemo(() => cleanNumber(selisihTetapInput), [selisihTetapInput]);
  const parsedSaldoPending = useMemo(() => handleCalculateValue(saldoPendingInput), [saldoPendingInput]);
  const parsedSaldoWithdraw = useMemo(() => handleCalculateValue(saldoDashboardInput), [saldoDashboardInput]);
  const parsedSaldoDashboardSaatIni = useMemo(() => handleCalculateValue(saldoDashboardSaatIniInput), [saldoDashboardSaatIniInput]);
  const parsedBiaya = useMemo(() => handleCalculateValue(biayaInput), [biayaInput]);

  // Sisa Saldo Rekon: Saldo Awal (Total Saldo) dikurangi semua data pengurangan dan withdraw
  const sisaSaldoRekon = useMemo(() => {
    return parsedSaldoAwal - parsedTotalApproveSemalam - parsedSelisihTetap - parsedSaldoPending - parsedBiaya - parsedSaldoWithdraw;
  }, [parsedSaldoAwal, parsedTotalApproveSemalam, parsedSelisihTetap, parsedSaldoPending, parsedBiaya, parsedSaldoWithdraw]);

  // Selisih antara Sisa Saldo Rekon dengan Saldo Dashboard Saat Ini
  const selisihMatch = useMemo(() => {
    return sisaSaldoRekon - parsedSaldoDashboardSaatIni;
  }, [sisaSaldoRekon, parsedSaldoDashboardSaatIni]);

  const isKlop = useMemo(() => {
    return selisihMatch === 0;
  }, [selisihMatch]);

  // Clipboard copy state tracker
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Process uploaded Dashboard File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("Gagal membaca file");

        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { 
          defval: '',
          raw: false
        });

        if (rawRows.length === 0) {
          setErrorMsg("File kosong atau tidak memiliki baris data.");
          setTimeout(() => setErrorMsg(null), 4000);
          return;
        }

        // Detect all headers
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
        const finalHeaders = headers.length > 0 ? headers.filter(h => fallbackHeaders.includes(h) || h !== '') : fallbackHeaders;

        // Auto guessing the best numeric column (Prefer exact or partial "amount" match first)
        let bestCol = '';
        const exactAmountCol = finalHeaders.find(h => h.toLowerCase() === 'amount');
        if (exactAmountCol) {
          bestCol = exactAmountCol;
        } else {
          const partialAmountCol = finalHeaders.find(h => h.toLowerCase().includes('amount'));
          if (partialAmountCol) {
            bestCol = partialAmountCol;
          } else {
            // Other keywords fallback
            const keywords = ['nominal', 'jumlah', 'approve', 'total', 'bayar', 'saldo', 'value', 'credit'];
            for (const h of finalHeaders) {
              if (keywords.some(kw => h.toLowerCase().includes(kw))) {
                bestCol = h;
                break;
              }
            }
          }
        }

        if (!bestCol && finalHeaders.length > 0) {
          bestCol = finalHeaders[0];
        }

        // Auto guessing the fee column (Prefer "fee", "charge", "mdr", "biaya")
        let bestFeeCol = '';
        const feeKeywords = ['fee', 'charge', 'mdr', 'biaya'];
        const exactFeeCol = finalHeaders.find(h => h.toLowerCase() === 'fee');
        if (exactFeeCol) {
          bestFeeCol = exactFeeCol;
        } else {
          const partialFeeCol = finalHeaders.find(h => feeKeywords.some(kw => h.toLowerCase().includes(kw)));
          if (partialFeeCol) {
            bestFeeCol = partialFeeCol;
          }
        }

        setDashboardFile({
          name: file.name,
          headers: finalHeaders,
          rows: rawRows,
          selectedCol: bestCol,
          selectedFeeCol: bestFeeCol
        });

        // Compute the auto-sum of the extracted column
        const sumAmount = rawRows.reduce((acc, row) => {
          return acc + cleanNumber(row[bestCol]);
        }, 0);

        // Auto fill into Saldo Withdraw field
        setSaldoDashboardInput(String(sumAmount));

        // Auto fill fee column into Biaya if found
        let feeMsg = '';
        if (bestFeeCol) {
          const sumFee = rawRows.reduce((acc, row) => {
            return acc + cleanNumber(row[bestFeeCol]);
          }, 0);
          setBiayaInput(String(sumFee));
          feeMsg = ` dan kolom "${bestFeeCol}" otomatis diproses ke Biaya (Rp. ${formatThousands(sumFee)})`;
        }

        setSuccessMsg(`Berhasil memuat dashboard: ${file.name}. Kolom "${bestCol}" otomatis diproses ke Saldo Withdraw (Rp. ${formatThousands(sumAmount)})${feeMsg}`);
        setTimeout(() => setSuccessMsg(null), 5500);
      } catch (err: any) {
        setErrorMsg("Kesalahan membaca file: " + (err.message || "Format tidak didukung"));
        setTimeout(() => setErrorMsg(null), 5000);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Computed sum from dashboard spreadsheet file for selected Col
  const dashboardSpreadsheetSum = useMemo(() => {
    if (!dashboardFile || !dashboardFile.selectedCol) return 0;
    return dashboardFile.rows.reduce((sum, row) => {
      const val = row[dashboardFile.selectedCol];
      return sum + cleanNumber(val);
    }, 0);
  }, [dashboardFile]);

  // Computed sum for fee column
  const dashboardSpreadsheetFeeSum = useMemo(() => {
    if (!dashboardFile || !dashboardFile.selectedFeeCol) return 0;
    return dashboardFile.rows.reduce((sum, row) => {
      const val = row[dashboardFile.selectedFeeCol];
      return sum + cleanNumber(val);
    }, 0);
  }, [dashboardFile]);

  // When selected column changes, auto updates Saldo Withdraw with the new sum
  const handleUpdateDashboardColumn = (newCol: string) => {
    if (!dashboardFile) return;
    setDashboardFile({ ...dashboardFile, selectedCol: newCol });
    
    const sum = dashboardFile.rows.reduce((acc, row) => {
      return acc + cleanNumber(row[newCol]);
    }, 0);
    setSaldoDashboardInput(String(sum));
    setSuccessMsg(`Kolom diubah ke "${newCol}" dan saldo dicocokkan ke Rp. ${formatThousands(sum)}!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // When selected fee column changes, auto updates Biaya with the new sum
  const handleUpdateFeeColumn = (newFeeCol: string) => {
    if (!dashboardFile) return;
    setDashboardFile({ ...dashboardFile, selectedFeeCol: newFeeCol });
    
    const sum = dashboardFile.rows.reduce((acc, row) => {
      if (!newFeeCol) return acc;
      return acc + cleanNumber(row[newFeeCol]);
    }, 0);
    setBiayaInput(String(sum));
    setSuccessMsg(`Kolom Biaya diubah ke "${newFeeCol || 'Tidak ada'}" dan disesuaikan ke Rp. ${formatThousands(sum)}!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleApplySpreadsheetSum = (target: 'saldoAwal' | 'totalApproveSemalam' | 'saldoPending' | 'saldoDashboard' | 'saldoDashboardSaatIni' | 'biaya') => {
    if (!dashboardFile) return;
    const valueString = String(dashboardSpreadsheetSum);
    
    if (target === 'saldoAwal') {
      setSaldoAwalInput(valueString);
    } else if (target === 'totalApproveSemalam') {
      setTotalApproveSemalamInput(valueString);
    } else if (target === 'saldoPending') {
      setSaldoPendingInput(valueString);
    } else if (target === 'saldoDashboard') {
      setSaldoDashboardInput(valueString);
    } else if (target === 'saldoDashboardSaatIni') {
      setSaldoDashboardSaatIniInput(valueString);
    } else if (target === 'biaya') {
      setBiayaInput(valueString);
    }

    setSuccessMsg(`Berhasil menyalin nominal dashboard Rp. ${formatThousands(dashboardSpreadsheetSum)} ke input!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleResetCalculator = () => {
    setSaldoAwalInput('');
    setTotalApproveSemalamInput('');
    setSaldoPendingInput('');
    setSaldoDashboardInput('');
    setBiayaInput('');
    setSelisihTetapInput('-40024');
    setDashboardFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded font-mono uppercase">
              RECON MODULE
            </span>
            <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase">
              NAIK SALDO QRIS MINERA
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Kalkulator Naik Saldo QRIS Minera
          </h2>
          <p className="text-xs text-[#a1a1aa]">
            Pilih atau unggah file dashboard. Data kolom "amount" akan dijumlahkan otomatis ke Saldo Dashboard.
          </p>
        </div>
        
        <button
          onClick={handleResetCalculator}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-zinc-800 border border-[#27272a] text-zinc-400 hover:text-white rounded-lg text-xs cursor-pointer transition"
        >
          <RefreshCw size={13} />
          <span>Reset Form / Data</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
          <span>✔️</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-500 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Inputs and Multi-line Paste */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 bg-[#18181b]/30 border border-[#27272a] rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-white font-mono uppercase flex items-center gap-1.5">
              <Calculator size={14} className="text-amber-500" />
              Formula & Rincian Input
            </h3>

            {/* Input Saldo Awal */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-white font-semibold flex items-center gap-1">
                  <span>1. Saldo Awal</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-[#a1a1aa] text-[10px] font-mono">
                  {saldoAwalInput ? `Terdeteksi: Rp. ${formatThousands(parsedSaldoAwal)}` : 'Bisa ditempel/dipaste'}
                </span>
              </div>
              <textarea
                value={saldoAwalInput}
                onChange={(e) => setSaldoAwalInput(e.target.value)}
                placeholder="Tempel nominal saldo awal di sini (Contoh: 1,500,000 atau paste baris Excel)"
                rows={2}
                className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none transition"
              />
            </div>

            {/* Input Total Approve Semalam */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-white font-semibold flex items-center gap-1">
                  <span>2. Total Approve Semalam</span>
                </label>
                <span className="text-[#a1a1aa] text-[10px] font-mono">
                  {totalApproveSemalamInput ? `Terdeteksi: Rp. ${formatThousands(parsedTotalApproveSemalam)}` : 'Bisa ditempel/dipaste'}
                </span>
              </div>
              <textarea
                value={totalApproveSemalamInput}
                onChange={(e) => setTotalApproveSemalamInput(e.target.value)}
                placeholder="Tempel nominal total approve semalam (Bisa berupa deretan angka atau hasil dump)"
                rows={2}
                className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none transition"
              />
            </div>

            {/* Grid for Selisih Tetap & Saldo Pending */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Selisih Tetap */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-white font-semibold">
                    3. Selisih Tetap
                  </label>
                  <span className="text-[10px] text-[#a1a1aa] font-mono">
                    Default: -40,024
                  </span>
                </div>
                <input
                  type="text"
                  value={selisihTetapInput}
                  onChange={(e) => setSelisihTetapInput(e.target.value)}
                  placeholder="-40024"
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>

              {/* Saldo Pending */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-white font-semibold">
                    4. Saldo Pending
                  </label>
                  <span className="text-[10px] text-[#a1a1aa] font-mono">
                    Rp. {formatThousands(parsedSaldoPending)}
                  </span>
                </div>
                <input
                  type="text"
                  value={saldoPendingInput}
                  onChange={(e) => setSaldoPendingInput(e.target.value)}
                  placeholder="Ketik/tempel saldo pending"
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>

            </div>

            {/* Grid for Saldo Withdraw & Biaya */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Saldo Withdraw */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-white font-semibold flex items-center gap-1">
                    <span>5. Saldo Withdraw (Hasil Excel)</span>
                  </label>
                  <span className="text-[10px] text-[#a1a1aa] font-mono">
                    {saldoDashboardInput ? `Terdeteksi: Rp. ${formatThousands(parsedSaldoWithdraw)}` : 'Manual / Auto-fill Excel'}
                  </span>
                </div>
                <input
                  type="text"
                  value={saldoDashboardInput}
                  onChange={(e) => setSaldoDashboardInput(e.target.value)}
                  placeholder="Isi manual atau auto-fill dari file dashboard di bawah"
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>

              {/* Biaya */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-white font-semibold flex items-center gap-1">
                    <span>6. Biaya</span>
                  </label>
                  <span className="text-[10px] text-[#a1a1aa] font-mono">
                    Rp. {formatThousands(parsedBiaya)}
                  </span>
                </div>
                <input
                  type="text"
                  value={biayaInput}
                  onChange={(e) => setBiayaInput(e.target.value)}
                  placeholder="Tempel nominal biaya jika ada"
                  className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>

            </div>

            {/* Input Saldo Dashboard Saat Ini (Kenyataan) */}
            <div className="space-y-1.5 pt-2 border-t border-[#27272a]/60">
              <div className="flex justify-between items-center text-xs">
                <label className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>7. Saldo Dashboard Saat Ini (Kenyataan)</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-[#a1a1aa] text-[10px] font-mono">
                  {saldoDashboardSaatIniInput ? `Terdeteksi: Rp. ${formatThousands(parsedSaldoDashboardSaatIni)}` : 'Sisa saldo aktual di Dashboard'}
                </span>
              </div>
              <input
                type="text"
                value={saldoDashboardSaatIniInput}
                onChange={(e) => setSaldoDashboardSaatIniInput(e.target.value)}
                placeholder="Masukkan saldo yang saat ini tampil di dashboard (untuk dicek klop/tidak)"
                className="w-full bg-[#09090b] border border-emerald-500/20 focus:border-emerald-500 rounded-lg p-3 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>

          </div>

          {/* Upload Data Dashboard integration */}
          <div className="p-5 bg-[#18181b]/30 border border-[#27272a] rounded-xl space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white font-mono uppercase flex items-center gap-1.5">
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                  Upload Data Dashboard (.xlsx / .csv)
                </h3>
                <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Auto-sum 'amount' & 'fee'
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Sistem otomatis memindai kolom <strong className="text-zinc-300">"amount"</strong> (ke Saldo Dashboard) dan kolom <strong className="text-zinc-300">"fee / mdr / biaya"</strong> (ke Biaya) secara instan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              
              {/* File Uploader */}
              <div className="border border-dashed border-[#27272a] hover:border-emerald-500/50 bg-[#09090b]/80 p-4 rounded-xl text-center cursor-pointer relative group transition-all">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls,.csv"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload size={18} className="mx-auto text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs text-white block font-semibold">
                  Pilih / Seret File Excel Dashboard
                </span>
                <span className="text-[9px] text-[#71717a] block mt-1">
                  Format .xlsx, .xls, .csv
                </span>
              </div>

              {/* Status File and Mapping Option */}
              <div className="space-y-3">
                {dashboardFile ? (
                  <div className="p-3 bg-emerald-950/10 border border-emerald-950/20 rounded-lg space-y-3">
                    <div className="flex items-center justify-between border-b border-[#27272a]/50 pb-1.5">
                      <span className="text-[10px] text-emerald-400 font-mono font-bold truncate block max-w-[150px]">
                        {dashboardFile.name}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono bg-[#18181b] px-1.5 py-0.5 rounded">
                        {dashboardFile.rows.length} baris
                      </span>
                    </div>

                    {/* Selector 1: Saldo */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-zinc-500">Kolom Saldo (Amount):</span>
                        <span className="text-white font-mono">Rp. {formatThousands(dashboardSpreadsheetSum)}</span>
                      </div>
                      <select
                        value={dashboardFile.selectedCol}
                        onChange={(e) => handleUpdateDashboardColumn(e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] text-white p-1 rounded text-[10px] focus:outline-none cursor-pointer font-mono"
                      >
                        {dashboardFile.headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Selector 2: Fee */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-zinc-500">Kolom Biaya (Fee / MDR):</span>
                        <span className="text-amber-500 font-mono">Rp. {formatThousands(dashboardSpreadsheetFeeSum)}</span>
                      </div>
                      <select
                        value={dashboardFile.selectedFeeCol || ''}
                        onChange={(e) => handleUpdateFeeColumn(e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] text-white p-1 rounded text-[10px] focus:outline-none cursor-pointer font-mono"
                      >
                        <option value="">-- Tanpa Kolom Fee --</option>
                        {dashboardFile.headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                ) : (
                  <div className="p-4 border border-[#27272a] bg-[#09090b]/40 rounded-lg text-center text-[10px] text-zinc-500 select-none">
                    Unggah file dashboard untuk melakukan auto-sum kolom secara instan
                  </div>
                )}
              </div>
            </div>

            {/* Quick action mapping buttons */}
            {dashboardFile && (
              <div className="pt-2 border-t border-[#27272a]/70">
                <span className="text-[9px] text-[#71717a] font-bold uppercase tracking-wider block mb-2">
                  Terapkan Hasil Excel (Rp. {formatThousands(dashboardSpreadsheetSum)}) ke:
                </span>
                <div className="grid grid-cols-6 gap-1.5">
                  <button
                    onClick={() => handleApplySpreadsheetSum('saldoAwal')}
                    className="px-1 py-1.5 bg-[#18181b] hover:bg-emerald-950/20 hover:border-emerald-500 border border-[#27272a] text-zinc-300 hover:text-emerald-400 font-semibold rounded text-[9px] transition cursor-pointer text-center"
                    title="1. Saldo Awal"
                  >
                    1. S.Awal
                  </button>
                  <button
                    onClick={() => handleApplySpreadsheetSum('totalApproveSemalam')}
                    className="px-1 py-1.5 bg-[#18181b] hover:bg-emerald-950/20 hover:border-emerald-500 border border-[#27272a] text-zinc-300 hover:text-emerald-400 font-semibold rounded text-[9px] transition cursor-pointer text-center"
                    title="2. Total Approve Semalam"
                  >
                    2. S.Semalam
                  </button>
                  <button
                    onClick={() => handleApplySpreadsheetSum('saldoPending')}
                    className="px-1 py-1.5 bg-[#18181b] hover:bg-emerald-950/20 hover:border-emerald-500 border border-[#27272a] text-zinc-300 hover:text-emerald-400 font-semibold rounded text-[9px] transition cursor-pointer text-center"
                    title="4. Saldo Pending"
                  >
                    4. Pending
                  </button>
                  <button
                    onClick={() => handleApplySpreadsheetSum('saldoDashboard')}
                    className="px-1 py-1.5 bg-[#18181b] hover:bg-emerald-950/20 hover:border-emerald-500 border border-[#27272a] text-zinc-300 hover:text-emerald-400 font-semibold rounded text-[9px] transition cursor-pointer text-center"
                    title="5. Saldo Withdraw"
                  >
                    5. S.Wd
                  </button>
                  <button
                    onClick={() => handleApplySpreadsheetSum('biaya')}
                    className="px-1 py-1.5 bg-[#18181b] hover:bg-emerald-950/20 hover:border-emerald-500 border border-[#27272a] text-zinc-300 hover:text-emerald-400 font-semibold rounded text-[9px] transition cursor-pointer text-center"
                    title="6. Biaya"
                  >
                    6. Biaya
                  </button>
                  <button
                    onClick={() => handleApplySpreadsheetSum('saldoDashboardSaatIni')}
                    className="px-1 py-1.5 bg-[#18181b] hover:bg-emerald-950/20 hover:border-emerald-500 border border-[#27272a] text-zinc-300 hover:text-emerald-400 font-semibold rounded text-[9px] transition cursor-pointer text-center"
                    title="7. Saldo Dashboard Saat Ini"
                  >
                    7. S.Dash
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Right column: Beautiful calculations and output cards */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Status Match Card: KLOP / tidak */}
          <div className={`p-5 rounded-2xl border ${
            isKlop 
              ? 'bg-emerald-950/20 border-emerald-500/30' 
              : 'bg-rose-950/20 border-rose-500/30'
          } space-y-3 relative overflow-hidden transition`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono ${
                isKlop ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                Pengecekan Saldo
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Real-time status</span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-zinc-400 block">Kondisi Hasil Akhir</span>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  isKlop ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isKlop ? 'KLOP 🟢' : 'TIDAK KLOP 🔴'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/60 text-[11px] space-y-1.5 font-mono text-zinc-300">
              <div className="flex justify-between">
                <span>Sisa Saldo Rekon:</span>
                <span className="font-bold text-white">Rp. {formatThousands(sisaSaldoRekon)}</span>
              </div>
              <div className="flex justify-between">
                <span>Saldo Dashboard Aktual:</span>
                <span className="font-bold text-white">Rp. {formatThousands(parsedSaldoDashboardSaatIni)}</span>
              </div>
              
              <div className={`flex justify-between border-t border-zinc-800/40 pt-1.5 font-semibold ${
                isKlop ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                <span>Selisih:</span>
                <span>
                  {selisihMatch === 0 
                    ? 'Rp. 0' 
                    : `${selisihMatch > 0 ? '+' : ''}${formatThousands(selisihMatch)}`
                  }
                </span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 leading-relaxed pt-1">
              {isKlop 
                ? 'Sempurna! Sisa saldo rekon Anda tepat sama dengan saldo dashboard.' 
                : selisihMatch > 0 
                  ? `Sisa saldo rekon Anda lebih besar Rp. ${formatThousands(selisihMatch)} dibandingkan saldo dashboard.`
                  : `Sisa saldo rekon Anda kurang Rp. ${formatThousands(Math.abs(selisihMatch))} dibandingkan saldo dashboard.`
              }
            </p>
          </div>

          <div className="p-6 bg-gradient-to-b from-[#1c1917]/50 to-[#0c0a09]/50 border border-amber-500/15 rounded-2xl relative overflow-hidden flex flex-col justify-between space-y-6">
            
            {/* Ambient Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-amber-400 font-mono tracking-wider uppercase bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Rincian Pengurangan
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Daftar Data Rekon</span>
              </div>

              {/* Step calculations */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-zinc-300 bg-zinc-900/40 p-1.5 rounded">
                  <span className="font-semibold">(+) Saldo Awal:</span>
                  <span className="font-mono text-white font-bold">Rp. {formatThousands(parsedSaldoAwal)}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400 px-1.5">
                  <span>(-) Total Approve Semalam:</span>
                  <span className="font-mono text-zinc-200">Rp. {formatThousands(parsedTotalApproveSemalam)}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400 px-1.5">
                  <span>(-) Selisih Tetap:</span>
                  <span className="font-mono text-amber-500">Rp. {formatThousands(parsedSelisihTetap)}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400 px-1.5">
                  <span>(-) Saldo Pending:</span>
                  <span className="font-mono text-zinc-200">Rp. {formatThousands(parsedSaldoPending)}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400 px-1.5">
                  <span>(-) Saldo Withdraw (Excel):</span>
                  <span className="font-mono text-zinc-200">Rp. {formatThousands(parsedSaldoWithdraw)}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400 px-1.5 pb-1">
                  <span>(-) Biaya (Fee Excel):</span>
                  <span className="font-mono text-zinc-200">Rp. {formatThousands(parsedBiaya)}</span>
                </div>
              </div>

              <div className="border-t border-[#27272a]/60 pt-4">
                <span className="text-[10px] text-zinc-400 block mb-1">HASIL AKHIR REKONSTRUKSI SALDO:</span>
                <div className="text-xl font-bold text-amber-400 font-mono flex items-baseline gap-1 bg-zinc-950/40 p-2 border border-zinc-800/60 rounded-xl justify-between">
                  <span className="text-[#a1a1aa] text-[10px] font-mono">Sisa Rekon:</span>
                  <span>Rp. {formatThousands(sisaSaldoRekon)}</span>
                </div>
              </div>
            </div>

            {/* Step summary block text printable */}
            <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#71717a] font-bold uppercase font-mono tracking-wider">SALIN REKAP RECON</span>
                <button
                  onClick={() => {
                    const isKlopText = isKlop ? "KLOP (Rp. 0)" : `BELUM KLOP (Selisih: Rp. ${formatThousands(selisihMatch)})`;
                    const text = `=== REKAP NAIK SALDO QRIS ===\n` +
                      `Saldo Awal            : Rp. ${formatThousands(parsedSaldoAwal)}\n` +
                      `Total Approve Semalam  : Rp. ${formatThousands(parsedTotalApproveSemalam)}\n` +
                      `Selisih Tetap         : Rp. ${formatThousands(parsedSelisihTetap)}\n` +
                      `Saldo Pending         : Rp. ${formatThousands(parsedSaldoPending)}\n` +
                      `Saldo Withdraw (Excel): Rp. ${formatThousands(parsedSaldoWithdraw)}\n` +
                      `Biaya                 : Rp. ${formatThousands(parsedBiaya)}\n` +
                      `---------------------------------\n` +
                      `Sisa Saldo Rekon      : Rp. ${formatThousands(sisaSaldoRekon)}\n` +
                      `Saldo Dashboard Aktual: Rp. ${formatThousands(parsedSaldoDashboardSaatIni)}\n` +
                      `---------------------------------\n` +
                      `Status Kenyataan      : ${isKlopText}`;
                    copyToClipboard(text, 'summary_all');
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedSection === 'summary_all' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedSection === 'summary_all' ? 'Disalin' : 'Copy Rekap'}</span>
                </button>
              </div>

              <div className="text-[10px] text-zinc-300 font-mono space-y-1.5 select-all pointer-events-auto leading-relaxed">
                <div>✨ **Saldo Awal:** Rp. {formatThousands(parsedSaldoAwal)}</div>
                <div>🌙 **Total Approve Semalam:** Rp. {formatThousands(parsedTotalApproveSemalam)}</div>
                <div>⚖️ **Selisih Tetap:** Rp. {formatThousands(parsedSelisihTetap)}</div>
                <div>⏳ **Saldo Pending:** Rp. {formatThousands(parsedSaldoPending)}</div>
                <div>💸 **Saldo Withdraw (Excel):** Rp. {formatThousands(parsedSaldoWithdraw)}</div>
                <div>🏷️ **Biaya:** Rp. {formatThousands(parsedBiaya)}</div>
                <div className="border-t border-zinc-800 pt-1.5 space-y-0.5">
                  <div className="flex justify-between">
                    <span>📊 **Sisa Saldo Rekon:**</span>
                    <span className="text-white font-semibold">Rp. {formatThousands(sisaSaldoRekon)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🖥️ **Saldo Dashboard Aktual:**</span>
                    <span className="text-white font-semibold">Rp. {formatThousands(parsedSaldoDashboardSaatIni)}</span>
                  </div>
                </div>
                <div className="border-t border-zinc-800 pt-1.5 font-bold text-white flex justify-between items-center">
                  <span>💰 **Hasil Selisih:**</span>
                  <span className={isKlop ? "text-emerald-400" : "text-rose-400"}>
                    {isKlop ? "KLOP 🟢" : `Rp. ${formatThousands(selisihMatch)} 🔴`}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Helper Banner */}
            <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-2.5 items-start">
              <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-[10px] text-[#a1a1aa] leading-relaxed">
                <strong className="text-zinc-200">Informasi Formula:</strong> Pengurangan semua data dilakukan dari Saldo Awal, kemudian divalidasi kelelerannya (tingkat kecocokannya) dengan Saldo Dashboard Aktual secara langsung.
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
