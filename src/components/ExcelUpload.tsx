/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { UploadedFile } from '../types';

interface ExcelUploadProps {
  onUploadSuccess: (file: UploadedFile) => void;
}

export default function ExcelUpload({ onUploadSuccess }: ExcelUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setError(null);
    setSuccessMsg(null);
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(file.type) && fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      setError("Format file tidak didukung. Harap upload file XLSX, XLS, atau CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Gagal membaca data file");

        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse raw JSON rows with strings for columns
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { 
          defval: '',
          raw: false // conversion to clean string values
        });

        if (rawRows.length === 0) {
          setError("File kosong atau tidak memiliki data baris.");
          return;
        }

        // Extract headers from first object keys or worksheet range
        const headers: string[] = [];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + '1';
          const cell = worksheet[address];
          if (cell && cell.v) {
            headers.push(String(cell.v).trim());
          }
        }

        // If headers weren't extracted correctly, fallback to keys of row objects
        const fallbackHeaders = Array.from(
          new Set(rawRows.flatMap(row => Object.keys(row)))
        );
        const finalHeaders = headers.length > 0 ? headers.filter(h => fallbackHeaders.includes(h) || h !== '') : fallbackHeaders;

        const newFile: UploadedFile = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          headers: finalHeaders.length > 0 ? finalHeaders : fallbackHeaders,
          rows: rawRows,
          uploadedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        onUploadSuccess(newFile);
        setSuccessMsg(`Berhasil memuat ${newFile.rows.length} baris dari "${newFile.name}"!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err: any) {
        console.error(err);
        setError("Gagal memproses file Excel: " + (err.message || "Pastikan format file Anda benar."));
      }
    };

    reader.onerror = () => {
      setError("Kesalahan saat membaca file.");
    };

    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Generate mock templates for instant testing!
  const generateMockTemplate = (type: 'buang-dana' | 'wd-pending' | 'order-summary') => {
    let headers: string[] = [];
    let rows: Record<string, string>[] = [];
    let filename = '';

    if (type === 'buang-dana') {
      filename = 'Template_Buang_Dana.xlsx';
      headers = ['BANK', 'NAMA REKENING', 'NOMOR REKENING', 'NOMINAL', 'LAMPIRAN'];
      rows = [
        {
          'BANK': 'MANDIRI',
          'NAMA REKENING': 'PT TRANSISI MAKMUR BERSAMA',
          'NOMOR REKENING': '1820081111890',
          'NOMINAL': '100000000',
          'LAMPIRAN': 'https://sleekshot.app/v/tsIvVuz1LSF9'
        },
        {
          'BANK': 'BCA',
          'NAMA REKENING': 'PT KARYA UTAMA DIGITAL',
          'NOMOR REKENING': '88726155910',
          'NOMINAL': '45000000',
          'LAMPIRAN': 'https://sleekshot.app/v/bca992817x'
        },
        {
          'BANK': 'BNI',
          'NAMA REKENING': 'CV DIGITAL INDO JAYA',
          'NOMOR REKENING': '5517281928',
          'NOMINAL': '12500000',
          'LAMPIRAN': 'https://sleekshot.app/v/bni33182a'
        }
      ];
    } else if (type === 'wd-pending') {
      filename = 'Template_WD_Pending.xlsx';
      headers = ['USERNAME', 'ORDER_ID', 'NOMINAL'];
      rows = [
        {
          'USERNAME': 'dini1993',
          'ORDER_ID': 'LGBDT-MW702654',
          'NOMINAL': '500,000'
        },
        {
          'USERNAME': 'budi_hartono',
          'ORDER_ID': 'LGBDT-MW702812',
          'NOMINAL': '1500000'
        },
        {
          'USERNAME': 'susi88',
          'ORDER_ID': 'LGBDT-MW703001',
          'NOMINAL': '250.000'
        }
      ];
    } else {
      filename = 'Template_Order_Summary.xlsx';
      headers = ['TANGGAL', 'STATUS', 'ITEM', 'ORDER_REFF', 'BANK', 'NOMOR_REK', 'NAMA_REK', 'TOTAL_DANA'];
      rows = [
        {
          'TANGGAL': '16/06/2026 23:10:07',
          'STATUS': 'pending',
          'ITEM': 'SMB 240',
          'ORDER_REFF': 'LGBDT-MW697336',
          'BANK': 'CIMB Niaga',
          'NOMOR_REK': '762589546700',
          'NAMA_REK': 'MUHAMAD SOLAHUDIN',
          'TOTAL_DANA': 'Rp150,000'
        },
        {
          'TANGGAL': '17/06/2026 09:44:12',
          'STATUS': 'success',
          'ITEM': 'SMB 300',
          'ORDER_REFF': 'LGBDT-MW698201',
          'BANK': 'BCA',
          'NOMOR_REK': '2109887121',
          'NAMA_REK': 'SANTI RAHMAWATI',
          'TOTAL_DANA': 'Rp250.000'
        },
        {
          'TANGGAL': '18/06/2026 14:15:23',
          'STATUS': 'pending',
          'ITEM': 'SMB 500',
          'ORDER_REFF': 'LGBDT-MW699411',
          'BANK': 'MANDIRI',
          'NOMOR_REK': '13300892718',
          'NAMA_REK': 'KURNIA JAYA',
          'TOTAL_DANA': 'Rp500,000'
        }
      ];
    }

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="w-full space-y-6">
      {/* Upload Drag Card */}
      <div 
        id="drag-upload-container"
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-all backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] ${
          dragActive 
            ? 'border-amber-400/80 bg-amber-500/10' 
            : 'border-white/15 bg-black/20 hover:border-amber-500/50 hover:bg-black/30'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          accept=".xlsx,.xls,.csv" 
          onChange={handleChange}
        />

        <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-[#fafafa] mb-4 border border-white/15">
          <Upload size={24} className={dragActive ? 'animate-bounce text-amber-400' : 'text-amber-400'} />
        </div>

        <h3 className="text-base font-semibold text-[#fafafa] mb-1 tracking-tight font-display">
          Seret & Lepas file Excel / CSV Anda ke sini
        </h3>
        <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto mb-6 leading-relaxed">
          Mendukung format <strong className="text-white">XLSX, XLS, atau CSV</strong>. Semua kalkulasi dilakukan aman secara private 100% di browser Anda.
        </p>

        <button
          onClick={onButtonClick}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95"
        >
          <FileSpreadsheet size={15} />
          <span>Pilih File dari Komputer</span>
        </button>

        {dragActive && (
          <div className="absolute inset-0 w-full h-full rounded-2xl bg-amber-500/10 pointer-events-none border-2 border-amber-400/80" />
        )}
      </div>

      {/* Upload Status / Alerts */}
      {error && (
        <div className="p-4 bg-red-950/40 backdrop-blur-xl border border-red-500/30 rounded-xl flex items-start gap-3 text-red-200 shadow-lg">
          <AlertCircle className="shrink-0 mt-0.5 text-red-400" size={16} />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold text-red-100">Gagal mengunggah:</span> {error}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 backdrop-blur-xl border border-emerald-500/30 rounded-xl flex items-start gap-3 text-emerald-200 shadow-lg">
          <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-400" size={16} />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold text-white">Berhasil!</span> {successMsg}
          </div>
        </div>
      )}

      {/* Sandbox Test Templates Column */}
      <div className="bg-black/20 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-amber-400 animate-pulse" size={16} />
          <h4 className="text-xs font-bold tracking-wider text-white uppercase font-display">
            SIMULASI DATA REKONSILIASI INSTAN
          </h4>
        </div>
        <p className="text-xs text-[#a1a1aa] mb-4 leading-relaxed">
          Kami telah membekali aplikasi ini dengan data demonstrasi fiktif terstruktur. Klik salah satu tombol di bawah untuk men-download file excel demo dan mencobanya seketika.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => generateMockTemplate('buang-dana')}
            className="flex items-center justify-between p-4 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-white/10 hover:border-amber-500/40 rounded-xl transition text-left cursor-pointer group shadow-md"
          >
            <div>
              <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition">1. SC Buang Dana</div>
              <div className="text-[10px] text-zinc-400 font-mono">MANDIRI, NOMINAL, BUKTI...</div>
            </div>
            <FileSpreadsheet size={15} className="text-[#a1a1aa] group-hover:text-amber-400 shrink-0 transition" />
          </button>

          <button
            onClick={() => generateMockTemplate('wd-pending')}
            className="flex items-center justify-between p-4 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-white/10 hover:border-blue-500/40 rounded-xl transition text-left cursor-pointer group shadow-md"
          >
            <div>
              <div className="text-xs font-semibold text-white group-hover:text-blue-400 transition">2. WD Pending</div>
              <div className="text-[10px] text-zinc-400 font-mono">USERNAME, ORDER_ID, NOMINAL</div>
            </div>
            <FileSpreadsheet size={15} className="text-[#a1a1aa] group-hover:text-blue-400 shrink-0 transition" />
          </button>

          <button
            onClick={() => generateMockTemplate('order-summary')}
            className="flex items-center justify-between p-4 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-white/10 hover:border-emerald-500/40 rounded-xl transition text-left cursor-pointer group shadow-md"
          >
            <div>
              <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition">3. Order Summary</div>
              <div className="text-[10px] text-zinc-400 font-mono">TIMESTAMP, STATUS, Rp150K</div>
            </div>
            <FileSpreadsheet size={15} className="text-[#a1a1aa] group-hover:text-emerald-400 shrink-0 transition" />
          </button>
        </div>
      </div>
    </div>
  );
}
