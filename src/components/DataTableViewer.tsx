/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Copy, 
  Check, 
  Filter, 
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { UploadedFile } from '../types';

interface DataTableViewerProps {
  file: UploadedFile;
  onClearFile: () => void;
}

export default function DataTableViewer({ file, onClearFile }: DataTableViewerProps) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>(file.headers);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorting Handler
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter Handler
  const handleFilterChange = (column: string, val: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: val
    }));
    setCurrentPage(1); // Reset page to 1 whenever filters change
  };

  // Reset Filters
  const resetFilters = () => {
    setColumnFilters({});
    setGlobalSearch('');
    setSortConfig(null);
    setCurrentPage(1);
  };

  // Process rows through sorting, search, column filters
  const processedRows = useMemo(() => {
    let result = [...file.rows];

    // 1. Apply Global Search
    if (globalSearch.trim() !== '') {
      const q = globalSearch.toLowerCase().trim();
      result = result.filter(row => {
        return Object.values(row).some(cellValue => 
          String(cellValue).toLowerCase().includes(q)
        );
      });
    }

    // 2. Apply Column filters
    Object.keys(columnFilters).forEach(col => {
      const filterVal = columnFilters[col].toLowerCase().trim();
      if (filterVal) {
        result = result.filter(row => {
          const cellVal = String(row[col] ?? '').toLowerCase();
          return cellVal.includes(filterVal);
        });
      }
    });

    // 3. Apply Sorting
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        const valA = a[key] ?? '';
        const valB = b[key] ?? '';
        
        const isNumA = !isNaN(Number(valA)) && valA !== '';
        const isNumB = !isNaN(Number(valB)) && valB !== '';

        if (isNumA && isNumB) {
          return direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return direction === 'asc' ? -1 : 1;
        if (strA > strB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [file.rows, globalSearch, columnFilters, sortConfig]);

  // Handle column visibility toggles
  const toggleColumnVisibility = (col: string) => {
    if (visibleColumns.includes(col)) {
      if (visibleColumns.length > 1) {
        setVisibleColumns(visibleColumns.filter(c => c !== col));
      }
    } else {
      setVisibleColumns([...visibleColumns, col]);
    }
  };

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedRows.slice(startIndex, startIndex + pageSize);
  }, [processedRows, currentPage, pageSize]);

  const totalPages = Math.ceil(processedRows.length / pageSize) || 1;

  // Copy parsed table values (TSV format so it can be pasted into Excel directly)
  const copyTableToClipboard = () => {
    try {
      const headerLine = visibleColumns.join('\t');
      const rowLines = processedRows.map(row => 
        visibleColumns.map(col => String(row[col] ?? '')).join('\t')
      );
      
      const clipboardContent = [headerLine, ...rowLines].join('\n');
      navigator.clipboard.writeText(clipboardContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin isi tabel:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Table File Header Details & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#18181b] p-5 border border-[#27272a] rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] px-2.5 py-0.5 bg-blue-550/10 text-blue-400 font-bold uppercase tracking-wider rounded border border-blue-500/20">
              verified dataset
            </span>
            <h4 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {file.name}
            </h4>
          </div>
          <p className="text-xs text-[#a1a1aa]">
            {file.rows.length} rows • {file.headers.length} columns • Loaded at {file.uploadedAt}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle configuration panel */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-md border text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
              showConfig 
                ? 'bg-zinc-850 border-zinc-700 text-white' 
                : 'bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:text-white'
            }`}
            title="Sembunyikan / Tampilkan Kolom"
          >
            <SlidersHorizontal size={12} />
            <span>Kolom</span>
          </button>

          {/* Copy Table */}
          <button
            onClick={copyTableToClipboard}
            className="p-2 px-3 bg-white hover:bg-zinc-200 text-black rounded-md text-xs font-semibold cursor-pointer transition flex items-center gap-1.5"
            title="Salin semua baris yang terfilter dalam format Excel (TAB-separated)"
          >
            {copied ? (
              <>
                <Check size={12} className="text-green-600" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy TSV ({processedRows.length})</span>
              </>
            )}
          </button>

          {/* New Excel Upload Reset */}
          <button
            onClick={onClearFile}
            className="p-2 px-3 bg-[#241717] hover:bg-[#341b1b] border border-[#4a2222] text-red-400 hover:text-red-350 rounded-md text-xs font-semibold cursor-pointer transition flex items-center gap-1"
          >
            <X size={12} />
            <span>Ganti File</span>
          </button>
        </div>
      </div>

      {/* Columns configuration panel */}
      {showConfig && (
        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Pilih Kolom Utama:</h5>
            <button 
              onClick={() => setVisibleColumns(file.headers)}
              className="text-[10px] text-zinc-400 hover:text-white underline"
            >
              Reset view
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {file.headers.map(col => {
              const isVisible = visibleColumns.includes(col);
              return (
                <button
                  key={col}
                  onClick={() => toggleColumnVisibility(col)}
                  className={`text-xs px-2.5 py-1 rounded transition cursor-pointer border ${
                    isVisible 
                      ? 'bg-zinc-800 border-zinc-700 text-white' 
                      : 'bg-[#09090b] border-[#27272a] text-[#52525b] hover:text-[#a1a1aa]'
                  }`}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Search and Filter Action States */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Global Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" size={14} />
          <input
            type="text"
            placeholder="Ketik kata kunci pencarian..."
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-xs font-sans focus:border-[#52525b] focus:outline-none text-[#fafafa] placeholder-[#52525b]"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Clear Filters Indicator */}
        {(Object.keys(columnFilters).length > 0 || sortConfig || globalSearch) && (
          <button
            onClick={resetFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#18181b] hover:bg-[#27272a]/40 border border-[#27272a] text-[#a1a1aa] hover:text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <RefreshCw size={11} />
            <span>Reset Filter & Sort</span>
          </button>
        )}
      </div>

      {/* Interactive Table Stage */}
      <div className="relative border border-[#27272a] rounded-xl overflow-hidden bg-[#18181b]/20">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-[#18181b] border-b border-[#27272a]">
                {visibleColumns.map((col) => (
                  <th key={col} className="p-3 text-xs font-semibold text-[#fafafa] align-top">
                    {/* Column Sorter Link */}
                    <button
                      onClick={() => handleSort(col)}
                      className="group flex items-center gap-1.5 hover:text-white transition cursor-pointer text-left select-none font-mono text-[11px] uppercase tracking-wider"
                    >
                      <span>{col}</span>
                      <span className="text-[#52525b] group-hover:text-[#a1a1aa] shrink-0 font-sans">
                        {sortConfig?.key === col ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        ) : (
                          <ChevronDown size={12} className="opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </button>

                    {/* Column-specific filter input */}
                    <div className="mt-2 relative">
                      <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52525b]" size={8} />
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={columnFilters[col] ?? ''}
                        onChange={(e) => handleFilterChange(col, e.target.value)}
                        className="w-full pl-6 pr-2 py-1 bg-[#09090b]/80 border border-[#27272a] rounded text-[10px] focus:outline-none focus:border-[#52525b] text-[#fafafa] placeholder-[#52525b]"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#18181b]/45 transition">
                    {visibleColumns.map((col) => (
                      <td key={col} className="p-3 text-xs text-[#a1a1aa] align-middle font-mono">
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : (
                          <span className="text-[#52525b]">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumns.length} className="p-12 text-center text-[#52525b] text-xs">
                    Tidak ditemukan data yang cocok dengan parameter kueri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-[#18181b] border-t border-[#27272a] text-xs">
          <div className="flex items-center gap-1.5 text-[#a1a1aa]">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#09090b] border border-[#27272a] px-2 py-0.5 rounded text-white focus:outline-none"
            >
              {[10, 25, 50, 100].map(sz => (
                <option key={sz} value={sz}>{sz}</option>
              ))}
            </select>
            <span className="text-[11px]">baris per halaman • Menampilkan {processedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, processedRows.length)} dari {processedRows.length} total baris</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 border border-[#27272a] hover:bg-[#27272a] rounded text-[#fafafa] transition disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[#fafafa] text-xs font-mono">
              <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 border border-[#27272a] hover:bg-[#27272a] rounded text-[#fafafa] transition disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
