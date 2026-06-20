/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clipboard, 
  Check, 
  Settings, 
  Search, 
  Sparkles, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Copy,
  Info
} from 'lucide-react';
import { UploadedFile, SheetRow, ColumnMapping, CustomTemplate } from '../types';
import { cleanNumber, formatThousands, formatDate, generateAutoMapping } from '../utils/formatter';

interface TemplateVisualizerProps {
  file: UploadedFile | null;
  activeTemplate: 'sc-buang-dana' | 'wd-pending' | 'order-summary' | 'template-builder';
  onFileLoaded?: (file: UploadedFile) => void;
}

export default function TemplateVisualizer({ file, activeTemplate, onFileLoaded }: TemplateVisualizerProps) {
  // Direct text paste handler states
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [showPasteDirect, setShowPasteDirect] = useState(false);

  // Column mapping states
  const [mappings, setMappings] = useState<ColumnMapping>({
    bankCol: '',
    accountNameCol: '',
    accountNumberCol: '',
    nominalCol: '',
    attachmentCol: '',
    usernameCol: '',
    orderIdCol: '',
    wdNominalCol: '',
    dateCol: '',
    statusCol: '',
    itemCol: '',
    summaryOrderIdCol: '',
    summaryBankCol: '',
    summaryAccountNumberCol: '',
    summaryAccountNameCol: '',
    summaryNominalCol: '',
  });

  // Filter & Search rows state (so user can only look at and format filtered records)
  const [searchTerm, setSearchTerm] = useState('');

  // Template Builder States
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [selectedCustomIndex, setSelectedCustomIndex] = useState<number>(0);
  const [builderTemplateString, setBuilderTemplateString] = useState('{ORDER_ID} | {DATE} | {NOMINAL}');
  const [customTemplateName, setCustomTemplateName] = useState('My Custom Layout');

  // Copy success status animations
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Initialize mappings with smart auto-detection
  useEffect(() => {
    if (file && file.headers.length > 0) {
      const autoMatches = generateAutoMapping(file.headers, file.rows);
      setMappings(prev => ({
        ...prev,
        ...autoMatches
      }));
    }
  }, [file, activeTemplate]);

  // Load custom templates on mount
  useEffect(() => {
    const stored = localStorage.getItem('xlsx_crosscheck_custom_templates');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CustomTemplate[];
        if (parsed.length > 0) {
          setCustomTemplates(parsed);
          setBuilderTemplateString(parsed[0].formatString);
          setCustomTemplateName(parsed[0].name);
        }
      } catch (err) {
        console.error("Gagal memuat template kustom:", err);
      }
    } else {
      // Set default template for builder
      const defaultTemplates: CustomTemplate[] = [
        {
          name: 'Format Standard Order',
          formatString: '{ORDER_ID} | {TANGGAL:DATE} | {TOTAL_DANA:NUMBER}',
          description: 'Format pencocokan order ID, penanggalan, dan total nominal rupiah.',
          createdAt: new Date().toISOString()
        },
        {
          name: 'Notifikasi Sukses WA',
          formatString: 'Halo {NAMA_REK}, transfer sejumlah Rp. {TOTAL_DANA:NUMBER} ke {BANK} sukses. Ref ID: {ORDER_REFF}',
          description: 'Format pesan whatsapp konon sukses.',
          createdAt: new Date().toISOString()
        }
      ];
      setCustomTemplates(defaultTemplates);
      setBuilderTemplateString(defaultTemplates[0].formatString);
      setCustomTemplateName(defaultTemplates[0].name);
      localStorage.setItem('xlsx_crosscheck_custom_templates', JSON.stringify(defaultTemplates));
    }
  }, []);

  // Save templates to LS
  const saveCustomTemplates = (templates: CustomTemplate[]) => {
    setCustomTemplates(templates);
    localStorage.setItem('xlsx_crosscheck_custom_templates', JSON.stringify(templates));
  };

  const handleAddCustomTemplate = () => {
    if (!customTemplateName.trim()) return;
    const newTemplate: CustomTemplate = {
      name: customTemplateName.trim(),
      formatString: builderTemplateString,
      createdAt: new Date().toISOString()
    };
    const updated = [...customTemplates, newTemplate];
    saveCustomTemplates(updated);
    setSelectedCustomIndex(updated.length - 1);
  };

  const handleDeleteCustomTemplate = (idx: number) => {
    const updated = customTemplates.filter((_, i) => i !== idx);
    saveCustomTemplates(updated);
    if (selectedCustomIndex >= updated.length) {
      const newIdx = Math.max(0, updated.length - 1);
      setSelectedCustomIndex(newIdx);
      if (updated[newIdx]) {
        setBuilderTemplateString(updated[newIdx].formatString);
        setCustomTemplateName(updated[newIdx].name);
      }
    }
  };

  const handleSelectTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value);
    setSelectedCustomIndex(idx);
    const tmpl = customTemplates[idx];
    if (tmpl) {
      setBuilderTemplateString(tmpl.formatString);
      setCustomTemplateName(tmpl.name);
    }
  };

  // Helper handling single column dropdown selection
  const handleMapChange = (field: keyof ColumnMapping, head: string) => {
    setMappings(prev => ({
      ...prev,
      [field]: head
    }));
  };

  // Renders the specific template formula based on mappings
  const renderRowTemplateOutput = (row: SheetRow, index: number): string => {
    try {
      if (activeTemplate === 'sc-buang-dana') {
        const bank = String(row[mappings.bankCol] ?? '').trim().toUpperCase();
        const accountName = String(row[mappings.accountNameCol] ?? '').trim().toUpperCase();
        const accountNumber = String(row[mappings.accountNumberCol] ?? '').trim();
        const nominalRaw = row[mappings.nominalCol];
        const nominal = formatThousands(nominalRaw);
        const attachment = String(row[mappings.attachmentCol] ?? '').trim();

        return `PENGIRIMAN DANA KE KAS ADMIN SEJUMLAH : Rp. ${nominal}\nKe : ${bank} | ${accountName} | ${accountNumber}\nLampiran : ${attachment}`;
      } 
      
      if (activeTemplate === 'wd-pending') {
        const username = String(row[mappings.usernameCol] ?? '').trim();
        const orderId = String(row[mappings.orderIdCol] ?? '').trim();
        const nominalRaw = row[mappings.wdNominalCol];
        const nominal = formatThousands(nominalRaw);

        return `ID : ${username}\nORDER ID : ${orderId}\nNOMINAL : ${nominal}`;
      } 
      
      if (activeTemplate === 'order-summary') {
        const orderId = String(row[mappings.summaryOrderIdCol] ?? '').trim();
        const dateRaw = row[mappings.dateCol];
        const date = formatDate(dateRaw);
        const nominalRaw = row[mappings.summaryNominalCol];
        const nominal = formatThousands(nominalRaw);

        return `${orderId} | ${date} | ${nominal}`;
      } 
      
      if (activeTemplate === 'template-builder') {
        // Advanced Custom Template string compiler!
        // Replace variables with format details
        // Pattern matches: {COLUMN_NAME} or {COLUMN_NAME:DATE} or {COLUMN_NAME:NUMBER}
        let completed = builderTemplateString;
        
        // Find all tags: {SOMETHING}
        const matches = completed.match(/\{([^\}]+)\}/g);
        if (matches) {
          for (const rawTag of matches) {
            const inner = rawTag.substring(1, rawTag.length - 1);
            const [colName, modifier] = inner.split(':');
            
            const cellValue = row[colName] !== undefined ? row[colName] : '';
            let replacement = String(cellValue);
            
            if (modifier === 'DATE') {
              replacement = formatDate(cellValue);
            } else if (modifier === 'NUMBER') {
              replacement = formatThousands(cellValue);
            } else if (modifier === 'UPPER') {
              replacement = String(cellValue).toUpperCase();
            } else if (modifier === 'LOWER') {
              replacement = String(cellValue).toLowerCase();
            }
            
            completed = completed.replace(rawTag, replacement);
          }
        }
        return completed;
      }

      return '';
    } catch (err) {
      return `Error formatting index ${index}: ` + String(err);
    }
  };

  // Column headers mapping picker renderer
  const renderMappingPicker = (label: string, field: keyof ColumnMapping, options: string[]) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider font-mono">{label}</label>
        <select
          value={mappings[field] ?? ''}
          onChange={(e) => handleMapChange(field, e.target.value)}
          className="w-full text-xs bg-[#09090b] border border-[#27272a] text-white p-2.5 rounded-md focus:outline-none focus:border-[#52525b] font-medium"
        >
          <option value="">-- Lewati kolom ini --</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  };

  // Perform filtering across original spreadsheet rows for easy processing
  const filteredRows = useMemo(() => {
    if (!file) return [];
    if (!searchTerm.trim()) return file.rows;
    const q = searchTerm.toLowerCase().trim();
    return file.rows.filter(row => {
      return Object.values(row).some(v => 
        String(v).toLowerCase().includes(q)
      );
    });
  }, [file, searchTerm]);

  // Combined compiled string of all formatting outputs
  const compiledAllString = useMemo(() => {
    const outputs = filteredRows.map((row, idx) => renderRowTemplateOutput(row, idx));
    const joinDelimiter = activeTemplate === 'order-summary' ? '\n' : '\n\n';
    return outputs.join(joinDelimiter);
  }, [filteredRows, mappings, builderTemplateString, activeTemplate]);

  // Copy single row text to Clipboard
  const handleCopyRow = (row: SheetRow, idx: number) => {
    const textOutput = renderRowTemplateOutput(row, idx);
    navigator.clipboard.writeText(textOutput);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Copy all results combined to clipboard
  const handleCopyAll = () => {
    navigator.clipboard.writeText(compiledAllString);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const isPasteActive = !file || showPasteDirect;

  // Header options sample helpers depending on active template
  const getTemplateHelperText = () => {
    switch (activeTemplate) {
      case 'sc-buang-dana':
        return {
          title: "Format SC Buang Dana Instan",
          desc: "Tempel baris spreadsheet dari Excel atau Sheets Anda. Sistem cerdas kami akan otomatis memisahkan nama bank, nama rekening tujuan, nomor rekening, nominal pengiriman dana, serta lampiran link bukti transfer.",
          example: "MANDIRI\tPT TRANSISI MAKMUR BERSAMA\t1820081111890\t100,000,000\thttps://sleekshot.app/v/tsIvVuz1LSF9"
        };
      case 'wd-pending':
        return {
          title: "Format WD Pending Members Instan",
          desc: "Tempel baris dari data pending penarikan dana. Kami akan otomatis menyaring Username, Order ID, dan jumlah nominal WD fungsional secara baris demi baris berkelompok.",
          example: "5\t\tdini1993\tDini harika putri\t083857718671\tDANA\tLGBDT-MW702654\t019ed79e-27e1-73c2-9b72-a1f3bde82bd5\t2026-06-18 05:05:27\t-\t500,000.00\twait for payment"
        };
      case 'order-summary':
        return {
          title: "Format Order Summary List Instan",
          desc: "Tempel baris rekam pesanan spreadsheet Anda. Sistem akan mencari dan mengekstrak rincian Order ID, konversi waktu menjadi penanggalan yang rapi, dan nominal rupiah fungsional.",
          example: "16/06/2026 23:10:07\tpending\tSMB 240\tLGBDT-MW697336\tCIMB Niaga\t762589546700\tMUHAMAD SOLAHUDIN\tRp150,000"
        };
      default:
        return {
          title: "Format Data Kustom Instan",
          desc: "Tempel baris dari clipboard Excel untuk diproses secara dinamis menggunakan builder kustom Anda.",
          example: "Kolom1\tKolom2\tKolom3\tKolom4"
        };
    }
  };

  const handlePasteProcess = () => {
    if (!pasteText.trim()) {
      setPasteError('Silakan tempel teks rekonsiliasi Anda terlebih dahulu.');
      return;
    }
    setPasteError(null);

    try {
      const lines = pasteText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length === 0) {
        setPasteError('Input kosong atau tidak mengandung data baris.');
        return;
      }

      // Check delimiters
      const firstLine = lines[0];
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const delimiter = tabCount >= commaCount && tabCount > 0 ? '\t' : ',';

      const parsedLines = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
      const maxCols = Math.max(...parsedLines.map(parts => parts.length));

      // Generate headers
      const generatedHeaders = Array.from({ length: maxCols }, (_, i) => `Kolom ${i + 1}`);

      // Map rows
      const rowsList = parsedLines.map(parts => {
        const rowObj: Record<string, any> = {};
        generatedHeaders.forEach((h, idx) => {
          rowObj[h] = parts[idx] !== undefined ? parts[idx] : '';
        });
        return rowObj;
      });

      const virtualFile: UploadedFile = {
        id: 'pasted-' + Math.random().toString(36).substring(2, 9),
        name: `Data Copas (${activeTemplate.toUpperCase()})`,
        size: pasteText.length,
        headers: generatedHeaders,
        rows: rowsList,
        uploadedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };

      if (onFileLoaded) {
        onFileLoaded(virtualFile);
        setPasteText(''); // clear textarea
        setShowPasteDirect(false); // hide paste area
      }
    } catch (err: any) {
      setPasteError('Gagal memproses data tempel: ' + (err.message || String(err)));
    }
  };

  const helperInfo = getTemplateHelperText();

  return (
    <div className="space-y-6">
      
      {/* SOURCE SELECTION BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#27272a]/50">
        <div>
          <span className="text-[10px] font-mono font-bold text-white bg-[#18181b] border border-[#27272a] px-2.5 py-1 rounded tracking-wide uppercase">
            {file ? `Penyaring Aktif: ${file.name}` : 'Instansi manual (Clipboard)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {file && (
            <button
              onClick={() => setShowPasteDirect(!showPasteDirect)}
              className="px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Clipboard size={12} />
              <span>{showPasteDirect ? 'Lihat Output Formatter' : 'Tempel Data Copas Baru'}</span>
            </button>
          )}
        </div>
      </div>

      {/* IS PASTE ACTIVE RENDER */}
      {isPasteActive ? (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#3b82f6] font-mono tracking-widest uppercase block animate-pulse">
              INPUT CLIPBOARD COPASTER EXCEL / SHEETS
            </span>
            <h3 className="text-sm font-bold text-white">
              {helperInfo.title}
            </h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              {helperInfo.desc}
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Salin satu atau beberapa baris data Excel Anda dan tempel di sini...\nContoh:\n${helperInfo.example}`}
              rows={6}
              className="w-full bg-[#09090b] border border-[#27272a] focus:border-[#3b82f6] text-xs p-4 rounded-lg font-mono text-[#e4e4e7] placeholder-[#52525b] focus:outline-none transition duration-200"
            />

            {pasteError && (
              <p className="text-xs text-red-400 font-medium font-sans">
                ⚠️ {pasteError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-[#71717a] font-sans">
                Mendukung salinan tab-separated (baris & kolom kolom) langsung dari clipboard.
              </div>
              
              <div className="flex items-center gap-2">
                {file && (
                  <button
                    type="button"
                    onClick={() => setShowPasteDirect(false)}
                    className="px-3.5 py-1.5 bg-[#27272a] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white text-xs font-semibold rounded-md transition cursor-pointer"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePasteProcess}
                  className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-white/5"
                >
                  <Clipboard size={12} />
                  <span>Proses & Format Instan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* SECTION 1: COLUMN MAPPER CONTROLS */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Settings className="text-white animate-spin-slow" size={15} />
                <h3 className="text-xs font-bold tracking-wider text-white uppercase font-display">
                  KONFIGURASI STRUKTUR PEMETAAN DATA
                </h3>
                <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold uppercase">
                  auto-mapped
                </span>
              </div>
            </div>

            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Sistem pembaca otomatis kami memetakan kolom dari tabel data Anda berdasarkan analogi header terbaik. Anda dapat menyesuaikannya manual lewat form dropdown di bawah:
            </p>

            {activeTemplate === 'sc-buang-dana' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 pt-2">
                {renderMappingPicker('1. Nama Bank', 'bankCol', file ? file.headers : [])}
                {renderMappingPicker('2. Nama Rekening', 'accountNameCol', file ? file.headers : [])}
                {renderMappingPicker('3. Nomor Rekening', 'accountNumberCol', file ? file.headers : [])}
                {renderMappingPicker('4. Nominal Rupiah', 'nominalCol', file ? file.headers : [])}
                {renderMappingPicker('5. Link Lampiran / Bukti', 'attachmentCol', file ? file.headers : [])}
              </div>
            )}

            {activeTemplate === 'wd-pending' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                {renderMappingPicker('1. Username', 'usernameCol', file ? file.headers : [])}
                {renderMappingPicker('2. ID Order (Order ID)', 'orderIdCol', file ? file.headers : [])}
                {renderMappingPicker('3. Nominal WD', 'wdNominalCol', file ? file.headers : [])}
              </div>
            )}

            {activeTemplate === 'order-summary' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                {renderMappingPicker('1. ID Order', 'summaryOrderIdCol', file ? file.headers : [])}
                {renderMappingPicker('2. Waktu / Tanggal', 'dateCol', file ? file.headers : [])}
                {renderMappingPicker('3. Nominal Transaksi', 'summaryNominalCol', file ? file.headers : [])}
              </div>
            )}

            {activeTemplate === 'template-builder' && (
              <div className="space-y-4 pt-2">
                
                {/* Template Selector dropdown */}
                <div className="p-4 bg-[#09090b] border border-[#27272a] rounded-lg space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Preset Template:</span>
                      <select
                        value={selectedCustomIndex}
                        onChange={handleSelectTemplateChange}
                        className="bg-[#18181b] border border-[#27272a] text-white text-xs p-1.5 rounded-md focus:outline-none focus:border-[#52525b]"
                      >
                        {customTemplates.map((t, idx) => (
                          <option key={idx} value={idx}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCustomTemplate(selectedCustomIndex)}
                      disabled={customTemplates.length <= 1}
                      className="px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded text-xs flex items-center gap-1 font-mono transition disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={11} />
                      <span>Hapus Preset</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#fafafa] uppercase tracking-wider font-mono">Format Teks Kustom Anda:</label>
                    <textarea
                      value={builderTemplateString}
                      onChange={(e) => setBuilderTemplateString(e.target.value)}
                      placeholder="Contoh: {ORDER_ID} | {TANGGAL:DATE} | {TOTAL_DANA:NUMBER}"
                      rows={3}
                      className="w-full bg-[#18181b] border border-[#27272a] focus:border-[#52525b] text-xs p-3 rounded font-mono text-white focus:outline-none placeholder-[#52525b]"
                    />
                  </div>

                  {/* Save template options */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-[#27272a]">
                    <input
                      type="text"
                      placeholder="Nama Template Baru..."
                      value={customTemplateName}
                      onChange={(e) => setCustomTemplateName(e.target.value)}
                      className="w-full sm:w-60 bg-[#18181b] border border-[#27272a] text-xs p-2 rounded-md focus:outline-none focus:border-[#52525b] text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomTemplate}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-md flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <Plus size={12} />
                      <span>Simpan Preset</span>
                    </button>
                  </div>
                </div>
                
                {/* Mapping Quick Helper Info */}
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex items-start gap-2 text-[#a1a1aa]">
                  <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] leading-relaxed">
                    <strong>Panduan Builder:</strong> Gunakan suffix <code className="text-blue-400 font-mono">{":NUMBER"}</code> untuk format angka ribuan, atau suffix <code className="text-[#a855f7] font-mono">{":DATE"}</code> untuk otomatis mengonversi serial waktu menjadi tanggal rapi. Contoh: <code className="text-white font-mono">{"{"}NOMINAL:NUMBER{"}"}</code>.  
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: TEMPLATE VIEWER ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Search tool inside report templates */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" size={13} />
              <input
                type="text"
                placeholder="Cari baris template..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-xs focus:outline-none focus:border-[#52525b] text-white placeholder-[#52525b]"
              />
            </div>

            {/* Big copy all trigger */}
            <button
              onClick={handleCopyAll}
              disabled={filteredRows.length === 0}
              className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-zinc-200 font-bold rounded-md text-xs text-black transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {copiedAll ? (
                <>
                  <Check size={12} />
                  <span>Semua Hasil Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy Semua List Formatter ({filteredRows.length})</span>
                </>
              )}
            </button>
          </div>

          {/* ROW SUMMARY BOXES GRID */}
          {filteredRows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRows.map((row, idx) => {
                const formattedOutput = renderRowTemplateOutput(row, idx);
                const isCopied = copiedIndex === idx;

                return (
                  <div 
                    key={idx}
                    className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] transition rounded-lg p-4.5 flex flex-col justify-between space-y-3.5 group relative overflow-hidden"
                  >
                    {/* original items tags bar */}
                    <div className="flex items-center justify-between border-b border-[#27272a] pb-2.5">
                      <span className="text-[9px] font-bold text-[#52525b] font-mono tracking-widest uppercase">
                        DATA BARIS #{idx + 1}
                      </span>
                      
                      {/* Copy Row Button */}
                      <button
                        onClick={() => handleCopyRow(row, idx)}
                        className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 border ${
                          isCopied 
                            ? 'bg-blue-500 text-white border-blue-500' 
                            : 'bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:text-white'
                        }`}
                        title="Salin output baris ini ke clipboard"
                      >
                        {isCopied ? <Check size={11} /> : <Clipboard size={11} />}
                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
                          {isCopied ? 'Selesai!' : 'Salin'}
                        </span>
                      </button>
                    </div>

                    {/* Formatted Output Display */}
                    <div className="bg-[#09090b] p-3.5 border border-[#27272a] rounded-lg font-mono text-[11px] leading-relaxed text-[#d4d4d8] break-words whitespace-pre-wrap select-all max-h-48 overflow-y-auto">
                      {formattedOutput || <span className="italic text-[#52525b]">Kolom kosong / belum dipetakan</span>}
                    </div>

                    {/* mini hover indicator decoration */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 border border-[#27272a] bg-[#18181b]/10 text-center rounded-xl">
              <HelpCircle className="mx-auto text-[#52525b] mb-2" size={28} />
              <h4 className="text-white font-bold text-xs mb-1 uppercase tracking-wider font-mono">Tidak ada data untuk diformat</h4>
              <p className="text-[#a1a1aa] text-xs max-w-sm mx-auto leading-relaxed">
                Silakan tempel teks rekonsiliasi Anda menggunakan tombol **Tempel Data Copas Baru** di kanan atas, atau gunakan fitur upload spreadsheet terlebih dahulu.
              </p>
            </div>
          )}
        </>
      )}

    </div>
  );
}
