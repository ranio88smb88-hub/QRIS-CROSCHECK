/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  HelpCircle, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  History, 
  Edit3, 
  FileText,
  Clock,
  Sparkles,
  Plus,
  X
} from 'lucide-react';

interface ParsedLoan {
  id: string;
  rawLine: string;
  bank: string;
  accountNumber: string;
  accountName: string;
  nominalStr: string;
  nominalNum: number;
}

export default function PeminjamanDana() {
  const [inputText, setInputText] = useState<string>('');
  
  // Customization Options
  const [bankSuffix, setBankSuffix] = useState<string>('BERSIH');
  const [nominalPrefix, setNominalPrefix] = useState<string>('Rp ');
  const [nominalSuffix, setNominalSuffix] = useState<string>(',-');
  const [nameCase, setNameCase] = useState<'as-is' | 'upper' | 'title' | 'lower'>('as-is');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  
  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBank, setEditBank] = useState<string>('');
  const [editNumber, setEditNumber] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editNominal, setEditNominal] = useState<string>('');

  // History state saved in localStorage
  const [history, setHistory] = useState<{ id: string; text: string; date: string }[]>([]);

  // Load history from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('loan_report_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error reading loan report history from localstorage:", e);
    }
  }, []);

  // Save history to localstorage
  const saveToHistory = (text: string) => {
    if (!text.trim()) return;
    try {
      const newHistory = [
        {
          id: `hist-${Date.now()}`,
          text,
          date: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
        },
        ...history.slice(0, 9) // keep top 10 sessions
      ];
      setHistory(newHistory);
      localStorage.setItem('loan_report_history', JSON.stringify(newHistory));
    } catch (e) {
      console.error("Error saving loan report history:", e);
    }
  };

  // Preset demo data
  const handleLoadDemo = () => {
    setInputText(
      "BCA 2770833313 Ami 25,000,000\nBCA 5800670464 KADEK ARYA BUDIARTA 25,000,000"
    );
  };

  // Parsing Engine
  const parsedItems = useMemo((): ParsedLoan[] => {
    if (!inputText.trim()) return [];
    
    const lines = inputText.split(/[\r\n]+/);
    const items: ParsedLoan[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Group 1: Bank (including letters and spaces, non-greedy so it splits on account number)
      // Group 2: Account Number (only digits)
      // Group 3: Account Name (anything in between)
      // Group 4: Nominal (digits, commas, periods, dashes)
      const match = trimmed.match(/^([a-zA-Z\s]+?)\s+(\d+)\s+(.+?)\s+([\d,.-]+)$/);
      
      if (match) {
        const bank = match[1].trim();
        const accountNumber = match[2].trim();
        const accountName = match[3].trim();
        const nominalStr = match[4].trim();

        const cleanNominal = nominalStr.replace(/[^\d]/g, '');
        const nominalNum = parseInt(cleanNominal, 10) || 0;

        items.push({
          id: `loan-${index}`,
          rawLine: trimmed,
          bank,
          accountNumber,
          accountName,
          nominalStr,
          nominalNum
        });
      } else {
        // Fallback lenient parser in case the regex misses (due to custom separators, extra space, etc.)
        const tokens = trimmed.split(/\s+/);
        if (tokens.length >= 4) {
          const bank = tokens[0];
          const accountNumber = tokens[1];
          const nominalStr = tokens[tokens.length - 1];
          const cleanNominal = nominalStr.replace(/[^\d]/g, '');
          const nominalNum = parseInt(cleanNominal, 10) || 0;
          const accountName = tokens.slice(2, tokens.length - 1).join(' ');

          items.push({
            id: `loan-${index}`,
            rawLine: trimmed,
            bank,
            accountNumber,
            accountName,
            nominalStr,
            nominalNum
          });
        } else {
          // Unparseable format - put as a generic entity
          items.push({
            id: `loan-${index}`,
            rawLine: trimmed,
            bank: 'BCA',
            accountNumber: '-',
            accountName: trimmed,
            nominalStr: '0',
            nominalNum: 0
          });
        }
      }
    });

    return items;
  }, [inputText]);

  // Handle local state edit save
  const [editedItemsMap, setEditedItemsMap] = useState<Record<string, Partial<ParsedLoan>>>({});

  // Reset edited map when input text changes to avoid stale overrides
  useEffect(() => {
    setEditedItemsMap({});
  }, [inputText]);

  // Apply edits locally
  const finalItems = useMemo((): ParsedLoan[] => {
    return parsedItems.map(item => {
      const overrides = editedItemsMap[item.id];
      if (overrides) {
        return { ...item, ...overrides };
      }
      return item;
    });
  }, [parsedItems, editedItemsMap]);

  // Open Edit Modal/Inline fields
  const handleStartEdit = (item: ParsedLoan) => {
    setEditingId(item.id);
    setEditBank(item.bank);
    setEditNumber(item.accountNumber);
    setEditName(item.accountName);
    setEditNominal(item.nominalNum.toString());
  };

  const handleSaveEdit = (id: string) => {
    const numClean = editNominal.replace(/[^\d]/g, '');
    const numVal = parseInt(numClean, 10) || 0;
    
    setEditedItemsMap(prev => ({
      ...prev,
      [id]: {
        bank: editBank,
        accountNumber: editNumber,
        accountName: editName,
        nominalNum: numVal,
        nominalStr: numVal.toLocaleString('en-US')
      }
    }));
    setEditingId(null);
  };

  const handleDeleteItem = (id: string) => {
    // To delete an item, we can filter it from the input text lines by matching the item lines,
    // or we can exclude it in our edited items map by marking it as deleted
    setEditedItemsMap(prev => ({
      ...prev,
      [id]: { ...prev[id], id: '__DELETED__' }
    }));
  };

  const activeVisibleItems = useMemo(() => {
    return finalItems.filter(item => editedItemsMap[item.id]?.id !== '__DELETED__');
  }, [finalItems, editedItemsMap]);

  // Format Nama Rekening case
  const formatNameCase = (name: string): string => {
    if (!name) return '';
    switch (nameCase) {
      case 'upper':
        return name.toUpperCase();
      case 'lower':
        return name.toLowerCase();
      case 'title':
        return name
          .toLowerCase()
          .replace(/\b\w/g, char => char.toUpperCase());
      default:
        return name;
    }
  };

  // Convert parsed items to formatted text cards
  const formatSingleItemText = (item: ParsedLoan): string => {
    const formattedBankStr = item.bank.toUpperCase() + (bankSuffix ? ` ${bankSuffix}` : '');
    const formattedName = formatNameCase(item.accountName);
    const formattedNominal = `${nominalPrefix}${item.nominalNum.toLocaleString('en-US')}${nominalSuffix}`;

    return [
      `Bank : ${formattedBankStr}`,
      `Nama Rekening : ${formattedName}`,
      `Nomor Rekening : ${item.accountNumber}`,
      `Nominal : ${formattedNominal}`
    ].join('\n');
  };

  // Combined full output string
  const combinedFormattedOutput = useMemo(() => {
    return activeVisibleItems.map(item => formatSingleItemText(item)).join('\n\n');
  }, [activeVisibleItems, bankSuffix, nominalPrefix, nominalSuffix, nameCase]);

  // Copy single block
  const handleCopySingle = (item: ParsedLoan) => {
    const text = formatSingleItemText(item);
    navigator.clipboard.writeText(text);
    setCopiedItem(item.id);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  // Copy all blocks
  const handleCopyAll = () => {
    if (!combinedFormattedOutput) return;
    navigator.clipboard.writeText(combinedFormattedOutput);
    setCopiedAll(true);
    saveToHistory(inputText);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Total summary calculations
  const summaryTotals = useMemo(() => {
    const count = activeVisibleItems.length;
    const totalAmount = activeVisibleItems.reduce((acc, item) => acc + item.nominalNum, 0);
    return { count, totalAmount };
  }, [activeVisibleItems]);

  const handleClearAll = () => {
    setInputText('');
    setEditedItemsMap({});
  };

  // Handle loading past history item
  const handleLoadHistory = (histText: string) => {
    setInputText(histText);
    setEditedItemsMap({});
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('loan_report_history');
  };

  return (
    <div className="space-y-6">
      
      {/* Banner Title Card */}
      <div className="bg-[#18181b]/70 backdrop-blur-md border border-amber-500/20 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500 animate-pulse" size={16} />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              FORM FORMATTER PEMINJAMAN DANA
            </h2>
          </div>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Format cepat catatan peminjaman dana, restrukturisasi output per rekening bank, & salin laporan siap kirim secara instan.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleLoadDemo}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded border border-amber-500/20 text-xs font-semibold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            Gunakan Format Contoh
          </button>
          
          {inputText && (
            <button 
              onClick={handleClearAll}
              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/30 text-red-400 rounded border border-red-900/30 text-xs font-semibold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              Reset Input
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* --- LEFT COLUMN: INPUT SOURCE & PARSING TUNING --- */}
        <div className="col-span-1 lg:col-span-6 space-y-6">
          
          {/* Main Raw Input Box */}
          <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase flex items-center gap-1.5">
                <FileText size={12} className="text-amber-500" />
                Raw Input Data Peminjaman
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                Format: [BANK] [NO_REK] [NAMA] [NOMINAL]
              </span>
            </div>

            <textarea
              className="w-full h-64 bg-[#09090b] border border-[#27272a] text-white p-4 rounded-lg focus:outline-none focus:border-amber-500/50 text-xs font-mono leading-relaxed"
              placeholder="Paste format text peminjaman Anda di sini secara berurutan...&#10;Contoh:&#10;BCA 2770833313 Ami 25,000,000&#10;BCA 5800670464 KADEK ARYA BUDIARTA 25,000,000"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <div className="text-[10px] text-[#71717a] leading-relaxed flex items-start gap-1.5 bg-[#09090b]/50 p-3 rounded border border-zinc-800/40">
              <HelpCircle size={14} className="shrink-0 text-amber-500/70" />
              <span>
                <strong>Multi-line Support:</strong> Setiap baris akan dianalisis secara baris demi baris, mengekstrak Kode Bank, Nomor Rekening, Nama Penerima, dan Angka Nominal secara mandiri.
              </span>
            </div>
          </div>

          {/* Suffix Symmetrical Controls Panel */}
          <div className="bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] rounded-xl p-5 space-y-4">
            <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase block">
              Parameter Keinginan Output Laporan
            </span>

            <div className="grid grid-cols-2 gap-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Suffix Nama Bank</label>
                <input
                  type="text"
                  value={bankSuffix}
                  onChange={(e) => setBankSuffix(e.target.value)}
                  placeholder="Misal: BERSIH"
                  className="w-full bg-[#09090b] border border-[#27272a] text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Prefix Nominal</label>
                <input
                  type="text"
                  value={nominalPrefix}
                  onChange={(e) => setNominalPrefix(e.target.value)}
                  placeholder="Misal: Rp "
                  className="w-full bg-[#09090b] border border-[#27272a] text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Suffix Nominal</label>
                <input
                  type="text"
                  value={nominalSuffix}
                  onChange={(e) => setNominalSuffix(e.target.value)}
                  placeholder="Misal: ,-"
                  className="w-full bg-[#09090b] border border-[#27272a] text-white px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block">Kapitalisasi Nama</label>
                <select
                  value={nameCase}
                  onChange={(e) => setNameCase(e.target.value as any)}
                  className="w-full bg-[#09090b] border border-[#27272a] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500/30 cursor-pointer"
                >
                  <option value="as-is">Sesuai Input (Default)</option>
                  <option value="upper">UPPERCASE (HURUF BESAR ALL)</option>
                  <option value="title">Title Case (Huruf Depan Besar)</option>
                  <option value="lower">lowercase (huruf kecil semua)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Paste History Panel */}
          {history.length > 0 && (
            <div className="bg-[#18181b]/40 border border-[#27272a] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#71717a] font-mono tracking-widest uppercase flex items-center gap-1.5">
                  <History size={12} />
                  Sesi Riwayat Terakhir
                </span>
                <button
                  onClick={handleClearHistory}
                  className="text-[9px] font-semibold text-rose-400 hover:text-rose-300 transition"
                >
                  Hapus Riwayat
                </button>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {history.map((hist) => (
                  <button
                    key={hist.id}
                    onClick={() => handleLoadHistory(hist.text)}
                    className="w-full p-2 bg-[#09090b]/50 border border-zinc-800/40 text-left rounded hover:border-zinc-700/60 transition group flex items-center justify-between block"
                  >
                    <div className="truncate pr-3">
                      <span className="text-[10px] font-mono text-zinc-500 block">
                        Dipakai {hist.date}
                      </span>
                      <span className="text-[11px] text-[#fafafa] font-mono truncate block group-hover:text-amber-500 transition-colors">
                        {hist.text.replace(/\n/g, ' • ')}
                      </span>
                    </div>
                    <Clock size={12} className="text-zinc-600 group-hover:text-amber-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* --- RIGHT COLUMN: THE RESULTS & COPIER ACTIONS --- */}
        <div className="col-span-1 lg:col-span-6 space-y-6">

          {/* Stats Summary & Copy Card */}
          <div className="bg-[#18181b]/70 backdrop-blur-md border border-amber-500/20 p-5 rounded-xl space-y-4">
            
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 rounded">
                  <CheckCircle2 size={16} className="text-amber-500" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-zinc-400 font-mono tracking-wider uppercase">
                    TOTAL PERHITUNGAN REKON
                  </div>
                  <div className="text-white font-mono font-bold text-sm">
                    {summaryTotals.count} Rekening Peminjam
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider">
                  AKUMULASI NOMINAL
                </div>
                <div className="text-white font-mono font-bold text-sm">
                  Rp {summaryTotals.totalAmount.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyAll}
              disabled={activeVisibleItems.length === 0}
              className={`w-full py-2.5 rounded-lg font-bold text-xs tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-2 ${
                activeVisibleItems.length === 0
                  ? 'bg-[#1c1c1f] text-zinc-600 border border-zinc-800/80 cursor-not-allowed'
                  : copiedAll
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              }`}
            >
              {copiedAll ? (
                <>
                  <Check size={14} className="animate-bounce" />
                  Seluruh Laporan Berhasil Disalin!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Salin Seluruh Laporan Peminjaman ({activeVisibleItems.length})
                </>
              )}
            </button>
          </div>

          {/* List of Parsed Items */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            
            {activeVisibleItems.length === 0 ? (
              <div className="p-16 text-center border border-dashed border-zinc-800 rounded-xl space-y-2 bg-[#18181b]/10">
                <HelpCircle className="mx-auto text-zinc-600" size={24} />
                <h4 className="text-xs text-[#a1a1aa] font-bold uppercase tracking-wider">Belum Ada Hasil Ekstraksi</h4>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Silakan masukkan teks dalam format di kolom kiri atau klik "Gunakan Format Contoh" untuk membuat review laporan otomatis.
                </p>
              </div>
            ) : (
              activeVisibleItems.map((item, index) => {
                const isEditing = editingId === item.id;
                const formattedReport = formatSingleItemText(item);

                return (
                  <div 
                    key={item.id} 
                    className="p-4 bg-[#18181b]/70 backdrop-blur-md border border-[#27272a] rounded-xl hover:border-zinc-700/60 transition relative group"
                  >
                    
                    {/* Header bar within single card */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-850">
                      <span className="text-[10px] font-bold text-amber-500 font-mono">
                        # {index + 1} - DATA PEMINJAM
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 bg-[#09090b] border border-zinc-800 hover:border-zinc-600 rounded text-zinc-400 hover:text-white transition"
                            title="Edit Data Ini"
                          >
                            <Edit3 size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 bg-[#1a0e0e] border border-red-950 hover:border-red-800 rounded text-rose-400 hover:text-rose-300 transition"
                          title="Hapus Data Ini"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      /* Editing Form Fields */
                      <div className="space-y-3 p-2 bg-[#09090b]/80 border border-zinc-800 rounded-lg text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-0.5">BANK</span>
                            <input
                              type="text"
                              value={editBank}
                              onChange={(e) => setEditBank(e.target.value)}
                              className="w-full bg-[#18181b] border border-zinc-800 text-white p-1 rounded font-mono font-semibold"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-0.5">NOMOR REKENING</span>
                            <input
                              type="text"
                              value={editNumber}
                              onChange={(e) => setEditNumber(e.target.value)}
                              className="w-full bg-[#18181b] border border-zinc-800 text-white p-1 rounded font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-0.5">NAMA REKENING</span>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-[#18181b] border border-zinc-800 text-white p-1 rounded"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-0.5">NOMINAL RUPIAH</span>
                            <input
                              type="text"
                              value={editNominal}
                              onChange={(e) => setEditNominal(e.target.value)}
                              className="w-full bg-[#18181b] border border-zinc-800 text-white p-1 rounded font-mono text-amber-500 font-bold"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-705 text-[#fafafa] rounded text-[10px]"
                          >
                            Batal
                          </button>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="px-2.5 py-1 bg-[#1a2e1a] hover:bg-[#254225] border border-[#2e5c2e] text-green-400 rounded font-semibold text-[10px]"
                          >
                            Simpan Perubahan
                          </button>
                        </div>
                      </div>

                    ) : (

                      /* Live Output Review & Copier Block */
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-8 bg-[#09090b]/80 border border-zinc-850 rounded-lg p-3">
                          <pre className="text-xs font-mono text-[#fafafa] whitespace-pre-wrap leading-relaxed select-all">
                            {formattedReport}
                          </pre>
                        </div>

                        <div className="md:col-span-4 h-full flex flex-col justify-end">
                          <button
                            onClick={() => handleCopySingle(item)}
                            className={`w-full py-2 rounded font-semibold text-[10px] uppercase font-mono tracking-wider transition flex items-center justify-center gap-1.5 ${
                              copiedItem === item.id
                                ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30'
                                : 'bg-[#18181b] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white border border-[#27272a]'
                            }`}
                          >
                            {copiedItem === item.id ? (
                              <>
                                <Check size={11} />
                                Disalin!
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                Salin Item
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
