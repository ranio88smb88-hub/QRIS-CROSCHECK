/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  BookOpen, 
  Layers, 
  FileCheck, 
  CheckSquare, 
  Settings2, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface InstructionsProps {
  onGoToUpload: () => void;
}

export default function Instructions({ onGoToUpload }: InstructionsProps) {
  return (
    <div className="space-y-8 max-w-4xl">
      
      {/* Welcome Banner */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-amber-400 animate-pulse" size={18} />
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider font-display">reportXpress LIGABANDOT Dashboard</h3>
        </div>
        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          Aplikasi asisten finance ini didesain khusus untuk melipatgandakan produktivitas Anda dalam memproses data Excel, melakukan pencocokan data (cross check), serta menyusun ulang laporan ke dalam berbagai format standar salinan teks secara instan langsung di komputer Anda.
        </p>
        
        <div className="flex items-center gap-2 text-xs text-[#fafafa] bg-[#09090b]/50 py-2.5 px-3 rounded-lg border border-amber-500/10 max-w-md">
          <ShieldCheck size={14} className="text-amber-400 shrink-0" />
          <span className="text-[#a1a1aa]">Privasi Mutlak: Pemrosesan data berjalan 100% lokal tanpa API server / cloud.</span>
        </div>

        <div className="pt-2">
          <button
            onClick={onGoToUpload}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-black rounded-md text-xs transition cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.15)]"
          >
            Mulai Unggah Excel
          </button>
        </div>
      </div>

      {/* Grid of Features explanations */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-semibold tracking-widest text-[#52525b] font-mono uppercase pl-1">
          SUITE TEMPLATE & PROTOKOL TERSEDIA
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Format 1 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wide">
              <Layers size={14} className="text-[#a1a1aa]" />
              <span>1. Template SC Buang Dana</span>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Didesain untuk mencetak format instruksi transfer resmi ke admin kasir. Sistem secara otomatis membaca kolom Bank, Nama dan No Rekening, Nominal Rupiah, beserta dokumen lampiran.
            </p>
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] font-mono text-[10px] text-[#52525b] space-y-1">
              <div className="font-semibold text-[#a1a1aa] uppercase mb-1">Target Format Output:</div>
              <p className="text-[#fafafa]">PENGIRIMAN DANA KE KAS ADMIN SEJUMLAH : Rp. 100,000,000</p>
              <p className="text-[#fafafa]">Ke : MANDIRI | PT TRANSISI MAKMUR BERSAMA | 1820081111890</p>
              <p className="text-[#fafafa]">Lampiran : https://sleekshot.app/v/tsIvVuz1LSF9</p>
            </div>
            <div className="text-[10px] text-[#52525b] italic">
              *Syarat kolom: <span className="text-white font-semibold font-mono">BANK, NAMA REKENING, NOMOR REKENING, NOMINAL, LAMPIRAN</span>
            </div>
          </div>

          {/* Format 2 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wide">
              <FileCheck size={14} className="text-[#a1a1aa]" />
              <span>2. Template WD Pending Formatter</span>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Didesain untuk merekap dan mengumumkan transaksi penarikan dana (Withdrawal) member yang masih tertunda di dalam sistem antrean admin.
            </p>
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] font-mono text-[10px] text-[#52525b] space-y-1">
              <div className="font-semibold text-[#a1a1aa] uppercase mb-1">Target Format Output:</div>
              <p className="text-[#fafafa]">ID : dini1993</p>
              <p className="text-[#fafafa]">ORDER ID : LGBDT-MW702654</p>
              <p className="text-[#fafafa]">NOMINAL : 500,000</p>
            </div>
            <div className="text-[10px] text-[#52525b] italic">
              *Syarat kolom: <span className="text-white font-semibold font-mono">USERNAME, ORDER_ID, NOMINAL</span>
            </div>
          </div>

          {/* Format 3 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wide">
              <CheckSquare size={14} className="text-[#a1a1aa]" />
              <span>3. Template Order Summary</span>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Menghasilkan satu baris teratur yang merinci ID Order, waktu tanggal yang tercetak rapi secara spesifik, serta nominal terformat.
            </p>
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] font-mono text-[10px] text-[#52525b] space-y-1">
              <div className="font-semibold text-[#a1a1aa] uppercase mb-1">Target Format Output:</div>
              <p className="text-[#fafafa]">LGBDT-MW697336 | 16 June 2026 | 150,000</p>
            </div>
            <div className="text-[10px] text-[#52525b] italic">
              *Mendukung konversi otomatis format waktu timestamp Indonesia/Excel.
            </div>
          </div>

          {/* Format 4 */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wide">
              <Settings2 size={14} className="text-[#a1a1aa]" />
              <span>4. Custom Template Builder</span>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Anda bebas menentukan susunan format keluaran teks sesuai data kolom pada Excel yang diupload menggunakan tag kurung kurawal pembungkus nama kolom.
            </p>
            <div className="bg-[#09090b] p-3 rounded border border-[#27272a] font-mono text-[10px] text-[#52525b] space-y-1.5">
              <div className="font-semibold text-[#a1a1aa] mb-0.5 uppercase">Contoh Format Custom Anda:</div>
              <p className="text-zinc-200">{"{"}ORDER_ID{"}"} | {"{"}TANGGAL:DATE{"}"} | {"{"}NOMINAL:NUMBER{"}"}</p>
              <p className="text-[#52525b]">&darr; menghasilkan &darr;</p>
              <p className="text-[#fafafa] font-semibold">LGBDT-MW697336 | 16 Juin 2026 | 150,000</p>
            </div>
            <div className="text-[10px] text-[#52525b] italic">
              *Tersedia tombol kilat untuk menyisipkan variabel kolom secara otomatis.
            </div>
          </div>

        </div>
      </div>

      {/* Steps of operation and guidelines */}
      <div className="bg-[#18181b]/55 p-6 border border-[#27272a] rounded-xl space-y-4">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <BookOpen size={14} className="text-[#71717a]" />
          Alur Kerja Pemrosesan Dokumen
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#a1a1aa] leading-relaxed">
          <div className="space-y-2 relative">
            <div className="w-5 h-5 bg-[#27272a] text-white rounded flex items-center justify-center font-bold font-mono text-[10px]">1</div>
            <h5 className="font-semibold text-[#fafafa]">Unggah Spreadsheet</h5>
            <p className="text-xs">Buka <strong className="text-white">Upload Spreadsheet</strong>, seret file XLSX & CSV atau klik tombol simulasi instan.</p>
          </div>

          <div className="space-y-2 relative">
            <div className="w-5 h-5 bg-[#27272a] text-white rounded flex items-center justify-center font-bold font-mono text-[10px]">2</div>
            <h5 className="font-semibold text-[#fafafa]">Kroscek Data</h5>
            <p className="text-xs">Buka tab <strong className="text-white">Tampilan Tabel</strong> untuk filter kolom, mencari entri, atau menyortir angka nominal.</p>
          </div>

          <div className="space-y-2 relative">
            <div className="w-5 h-5 bg-[#27272a] text-white rounded flex items-center justify-center font-bold font-mono text-[10px]">3</div>
            <h5 className="font-semibold text-[#fafafa]">Salin Hasil</h5>
            <p className="text-xs">Pilih salah satu menu template formatter, salin hasil instan per baris atau copy sekaligus semua baris.</p>
          </div>
        </div>
      </div>

      {/* SOP Audit Guarantee */}
      <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-lg flex items-start gap-3">
        <ShieldCheck className="text-white mt-0.5 shrink-0" size={16} />
        <div>
          <h5 className="text-xs font-bold text-[#fafafa]">Pernyataan Proteksi Kerahasiaan Data Finance</h5>
          <p className="text-[10px] text-[#52525b] leading-relaxed mt-1">
            Alat bantu ini bersifat offline-first. Pemrosesan data spreadsheet Anda diselesaikan sepenuhnya di dalam memori internal (RAM) browser lokal Anda. Aplikasi ini tidak memiliki backend server tersembunyi, sehingga tidak ada data perbankan yang dikirim keluar atau disimpan ke server internet mana pun. 100% aman untuk operasional audit finance internal.
          </p>
        </div>
      </div>

    </div>
  );
}
