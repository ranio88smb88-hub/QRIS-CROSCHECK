/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle,
  FolderOpen
} from 'lucide-react';

import DashboardLayout from './components/DashboardLayout';
import ExcelUpload from './components/ExcelUpload';
import DataTableViewer from './components/DataTableViewer';
import TemplateVisualizer from './components/TemplateVisualizer';
import Instructions from './components/Instructions';
import QrisCrossCheck from './components/QrisCrossCheck';
import NaikSaldoQris from './components/NaikSaldoQris';
import { UploadedFile, ActiveTab } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('instructions');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  // Hook triggered when a file is successfully loaded
  const handleUploadSuccess = (file: UploadedFile) => {
    setUploadedFile(file);
    // Redirect user directly to the formatting tab to optimize workflow speed!
    setActiveTab('table');
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setActiveTab('upload');
  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      file={uploadedFile}
      onClearFile={handleClearFile}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full h-full"
        >
          {activeTab === 'instructions' && (
            <Instructions onGoToUpload={() => setActiveTab('upload')} />
          )}

          {activeTab === 'upload' && (
            <div className="max-w-4xl space-y-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase">
                  PENGUNGGAHAN FILE SPREADSHEET
                </span>
                <p className="text-xs text-[#a1a1aa]">
                  Unggah file berformat XLSX, XLS atau CSV yang Anda miliki untuk memulai ekstraksi dan auto-formatting.
                </p>
              </div>

              {uploadedFile ? (
                <div className="p-6 bg-[#18181b] border border-[#27272a] rounded-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-white">
                      <FolderOpen size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {uploadedFile.name}
                      </h4>
                      <p className="text-xs text-[#a1a1aa] font-mono">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • {uploadedFile.rows.length} baris data • diunggah pkl {uploadedFile.uploadedAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-[#27272a]">
                    <button
                      onClick={() => setActiveTab('table')}
                      className="px-3.5 py-1.5 bg-[#27272a] hover:bg-zinc-800 text-white text-xs font-semibold rounded-md cursor-pointer transition flex items-center gap-1.5"
                    >
                      <span>Lihat Grid Tabel</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('sc-buang-dana')}
                      className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-md cursor-pointer transition flex items-center gap-1.5"
                    >
                      <span>Format SC Buang Dana</span>
                    </button>
                    <button
                      onClick={handleClearFile}
                      className="px-3.5 py-1.5 bg-[#241717] hover:bg-[#341b1b] border border-[#4a2222] text-red-400 text-xs font-semibold rounded-md cursor-pointer transition flex items-center gap-1.5"
                    >
                      <span>Ganti File Spreadsheet</span>
                    </button>
                  </div>
                </div>
              ) : (
                <ExcelUpload onUploadSuccess={handleUploadSuccess} />
              )}
            </div>
          )}

          {activeTab === 'table' && uploadedFile && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase">
                  TABEL DATA SPREADSHEET AKTIF
                </span>
                <p className="text-xs text-[#a1a1aa]">
                  Lakukan kroscek data, penyaringan berdasar nama kolom, pencarian kata kunci, serta pengurutan data untuk memverifikasi akurasi record.
                </p>
              </div>
              <DataTableViewer 
                file={uploadedFile} 
                onClearFile={handleClearFile} 
              />
            </div>
          )}

          {activeTab === 'sc-buang-dana' && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase">
                  TEMPLATE FORMATTER: SC BUANG DANA
                </span>
                <p className="text-xs text-[#a1a1aa]">
                  Mengekstrak bank, nama rekening, nomor rekening, nominal rupiah terformat kembar koma, serta dokumen lampiran bukti transfer.
                </p>
              </div>
              <TemplateVisualizer 
                file={uploadedFile} 
                activeTemplate="sc-buang-dana" 
                onFileLoaded={handleUploadSuccess}
              />
            </div>
          )}

          {activeTab === 'wd-pending' && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase">
                  TEMPLATE FORMATTER: WD PENDING MEMBRES
                </span>
                <p className="text-xs text-[#a1a1aa]">
                  Merekap rincian tertundanya penarikan saldo, mencetak username member, order ID, serta jumlah nominal dana yang diajukan.
                </p>
              </div>
              <TemplateVisualizer 
                file={uploadedFile} 
                activeTemplate="wd-pending" 
                onFileLoaded={handleUploadSuccess}
              />
            </div>
          )}

          {activeTab === 'order-summary' && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase">
                  TEMPLATE FORMATTER: ORDER SUMMARY LIST
                </span>
                <p className="text-xs text-[#a1a1aa]">
                  Ringkasan berdasar baris tunggal rapi yang memetakan order transaksi, tanggal yang dikonversi rapi, serta nominal dana.
                </p>
              </div>
              <TemplateVisualizer 
                file={uploadedFile} 
                activeTemplate="order-summary" 
                onFileLoaded={handleUploadSuccess}
              />
            </div>
          )}

          {activeTab === 'template-builder' && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-white font-mono tracking-widest uppercase">
                  DENGAN TEMPLATE BUILDER KUSTOM
                </span>
                <p className="text-xs text-[#a1a1aa]">
                  Ketik dan susun format teks Anda sendiri menggunakan kombinasi field kolom Excel Anda secara dinamis.
                </p>
              </div>
              <TemplateVisualizer 
                file={uploadedFile} 
                activeTemplate="template-builder" 
                onFileLoaded={handleUploadSuccess}
              />
            </div>
          )}

          {activeTab === 'qris-crosscheck' && (
            <div className="space-y-6">
              <QrisCrossCheck activeFile={uploadedFile} />
            </div>
          )}

          {activeTab === 'naik-saldo-qris' && (
            <div className="space-y-6">
              <NaikSaldoQris />
            </div>
          )}

          {/* Fallback state when active tab is selected but file is empty - only for interactive table grid */}
          {!uploadedFile && activeTab === 'table' && (
            <div className="p-16 border border-[#27272a] bg-[#18181b]/20 text-center rounded-xl max-w-lg mx-auto">
              <AlertCircle className="mx-auto text-amber-500 mb-4 animate-pulse" size={32} />
              <h4 className="text-white font-bold text-xs mb-1 uppercase tracking-wider font-mono">Spreadsheet Belum Dimuat</h4>
              <p className="text-[#a1a1aa] text-xs leading-relaxed mb-6">
                Silakan upload file XLSX, XLS, atau CSV terlebih dahulu untuk mengaktifkan pemrosesan tabel interaktif ini.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 bg-white hover:bg-zinc-200 font-bold rounded-md text-xs text-black transition cursor-pointer"
              >
                Unggah File Sekarang
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
