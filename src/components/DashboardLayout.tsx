/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Table, 
  Layers, 
  FileCheck, 
  FileX, 
  CheckSquare, 
  Settings2, 
  Menu,
  X,
  BookOpen,
  ArrowRightLeft,
  ChevronRight,
  TrendingUp,
  CloudLightning,
  MonitorCheck
} from 'lucide-react';
import { UploadedFile, ActiveTab } from '../types';

interface DashboardLayoutProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  children: React.ReactNode;
  file: UploadedFile | null;
  onClearFile: () => void;
}

export default function DashboardLayout({ 
  activeTab, 
  setActiveTab, 
  children, 
  file, 
  onClearFile 
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Nav menu items definition
  const menuItems = [
    { 
      id: 'instructions' as ActiveTab, 
      label: 'Panduan Penggunaan', 
      icon: BookOpen, 
      badge: null,
      description: 'Cara kerja & format input'
    },
    { 
      id: 'upload' as ActiveTab, 
      label: 'Upload Spreadsheet', 
      icon: FileSpreadsheet, 
      badge: file ? 'Ready' : null,
      description: 'Unggah XLSX, XLS, atau CSV'
    },
    { 
      id: 'table' as ActiveTab, 
      label: 'Tampilan Tabel Data', 
      icon: Table, 
      badge: file ? `${file.rows.length} Baris` : null,
      description: 'Filter, cari & urutkan kolom',
      disabled: !file
    },
    { 
      id: 'sc-buang-dana' as ActiveTab, 
      label: 'SC Buang Dana', 
      icon: Layers, 
      badge: file ? 'Active' : 'Paste',
      description: 'Format lampiran transfer',
      disabled: false
    },
    { 
      id: 'wd-pending' as ActiveTab, 
      label: 'WD Pending Formatter', 
      icon: FileCheck, 
      badge: file ? 'Active' : 'Paste',
      description: 'Cek pending withdraw member',
      disabled: false
    },
    { 
      id: 'order-summary' as ActiveTab, 
      label: 'Order Summary List', 
      icon: CheckSquare, 
      badge: file ? 'Active' : 'Paste',
      description: 'Format ringkas tgl & ID',
      disabled: false
    },
    { 
      id: 'template-builder' as ActiveTab, 
      label: 'Custom Builder', 
      icon: Settings2, 
      badge: file ? 'Custom' : 'Paste',
      description: 'Desain template sendiri',
      disabled: false
    },
    { 
      id: 'qris-crosscheck' as ActiveTab, 
      label: 'Kroscek QRIS Minera', 
      icon: ArrowRightLeft, 
      badge: 'Selisih',
      description: 'Croscheck vendor vs admin',
      disabled: false
    },
    { 
      id: 'naik-saldo-qris' as ActiveTab, 
      label: 'Naik Saldo QRIS Minera', 
      icon: TrendingUp, 
      badge: 'Kalkulator',
      description: 'Penyesuaian saldo & dashboard',
      disabled: false
    },
  ];

  const handleNavClick = (tabId: ActiveTab, disabled?: boolean) => {
    if (disabled) return;
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="h-screen w-full bg-[#09090b] text-[#fafafa] font-sans flex flex-col md:flex-row overflow-hidden border-0 md:border-8 border-[#18181b] antialiased">
      
      {/* MOBILE HEADER BAR */}
      <header className="md:hidden w-full bg-[#09090b] border-b border-[#27272a] px-4 py-3.5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#3b82f6] rounded-md shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">ReportXpress</h1>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-[#18181b] rounded-lg transition cursor-pointer"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* MOBILE SLIDEOUT DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-[#09090b]/98 z-40 md:hidden p-5 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <span className="text-xs font-bold text-[#52525b] font-mono tracking-widest uppercase">NAVIGASI MENU</span>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#a1a1aa] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="space-y-1">
              {menuItems.map(item => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    disabled={item.disabled}
                    onClick={() => handleNavClick(item.id, item.disabled)}
                    className={`w-full p-3 rounded-lg flex items-center justify-between text-left transition-all ${
                      isActive 
                        ? 'bg-[#27272a] text-white' 
                        : item.disabled 
                          ? 'opacity-30 cursor-not-allowed text-[#52525b]' 
                          : 'text-[#a1a1aa] hover:bg-[#18181b]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={isActive ? 'text-white' : 'text-[#a1a1aa]'} />
                      <div>
                        <div className="text-xs font-semibold">{item.label}</div>
                        <div className="text-[9px] text-[#71717a]">{item.description}</div>
                      </div>
                    </div>

                    {item.badge && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isActive ? 'bg-white/10 text-white' : 'bg-zinc-850 text-[#a1a1aa]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {file && (
            <div className="p-4 bg-[#18181b] rounded-xl border border-[#27272a] space-y-3">
              <div className="text-xs text-[#a1a1aa]">
                Loaded: <strong className="text-[#fafafa]">{file.name}</strong>
              </div>
              <button
                onClick={() => {
                  onClearFile();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 bg-red-950/20 border border-red-900/30 text-red-400 hover:text-red-300 rounded-lg text-xs font-semibold cursor-pointer transition text-center"
              >
                Reset & Ganti Spreadsheet
              </button>
            </div>
          )}
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 border-r border-[#27272a] bg-[#09090b] flex-col justify-between shrink-0 h-full overflow-y-auto">
        <div className="p-6">
          
          {/* Logo Brand Header */}
          <div className="flex items-center gap-2 mb-8 select-none">
            <div className="w-6 h-6 bg-[#3b82f6] rounded-md shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            <h1 className="font-bold text-lg tracking-tight text-white">ReportXpress</h1>
          </div>

          {/* Navigation Links list */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#52525b] tracking-widest pl-3 uppercase">
              Main Menu
            </span>
            <nav className="space-y-1 pt-2">
              {menuItems.map(item => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    disabled={item.disabled}
                    onClick={() => handleNavClick(item.id, item.disabled)}
                    className={`w-full px-3 py-2 rounded-md flex items-center justify-between text-left group transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#27272a] text-white font-medium' 
                        : item.disabled 
                          ? 'opacity-25 cursor-not-allowed text-[#52525b]' 
                          : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={14} className={isActive ? 'text-white' : 'text-[#a1a1aa] group-hover:text-white transition-colors'} />
                      <span className="text-xs">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded transition ${
                        isActive 
                          ? 'bg-zinc-800 text-white' 
                          : 'bg-zinc-900 text-[#71717a] group-hover:text-[#a1a1aa]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Desktop Sidebar Bottom Footer Panel */}
        <div className="mt-auto">
          {file && (
            <div className="m-4 p-4 bg-[#18181b]/50 border border-[#27272a] rounded-xl space-y-2">
              <span className="text-[9px] text-[#52525b] font-bold uppercase tracking-wider block">FILE VERIFICATION</span>
              <p className="text-xs text-[#fafafa] font-semibold truncate" title={file.name}>
                {file.name}
              </p>
              <div className="text-[10px] text-[#a1a1aa] font-mono">
                {file.rows.length} rows loaded
              </div>
              <button
                onClick={onClearFile}
                className="w-full mt-2 py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 hover:text-red-300 rounded-lg text-[10px] font-bold cursor-pointer transition text-center"
              >
                Clear Dataset
              </button>
            </div>
          )}

          <div className="p-4 border-t border-[#27272a] bg-[#0c0c0e]">
            <div className="text-[10px] text-[#52525b] mb-1.5 uppercase font-bold tracking-wider">ENGINE STATUS</div>
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-[#a1a1aa]">Client-Side Only Mode</span>
              </div>
              <span className="text-[9px] font-mono text-[#52525b]">SECURE</span>
            </div>
          </div>
        </div>
      </aside>

      {/* CORE DISPLAY WINDOW FRAME */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090b]">
        
        {/* Dynamic Nav Header Bar */}
        <header className="h-16 border-b border-[#27272a] flex items-center justify-between px-8 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-[#71717a]">
              Pages / {menuItems.find(item => item.id === activeTab)?.label}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            {file ? (
              <span className="text-[10px] font-mono bg-[#18181b] border border-[#27272a] text-[#a1a1aa] px-2.5 py-1 rounded">
                DATASET ACTIVE ({file.rows.length} ROWS)
              </span>
            ) : (
              <span className="text-[10px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2.5 py-1 rounded">
                RECONCILIATION COLD (0 ROWS)
              </span>
            )}
            <span className="text-[10px] font-mono bg-[#1a2e1a] border border-[#2e5c2e] text-green-400 px-2.5 py-1 rounded">
              100% OFFLINE AUDIT
            </span>
          </div>
        </header>

        {/* Active Content Body display */}
        <section className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </section>

        {/* Global Footer element */}
        <footer className="px-8 py-3 border-t border-[#27272a] bg-[#0c0c0e]/40 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-[#52525b] gap-2 shrink-0">
          <div>
            <span>© 2026 ReportXpress Excel Auditor.</span>
            <span className="hidden sm:inline"> Terenkripsi penuh & diproses langsung di memori browser lokal.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hover:text-[#a1a1aa] transition select-none cursor-pointer">SOP Finance</span>
            <span>•</span>
            <span className="hover:text-[#a1a1aa] transition select-none cursor-pointer">Ready for Vercel</span>
          </div>
        </footer>
      </main>

    </div>
  );
}
