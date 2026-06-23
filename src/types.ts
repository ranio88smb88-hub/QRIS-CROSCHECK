/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SheetRow {
  [key: string]: any;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  headers: string[];
  rows: SheetRow[];
  uploadedAt: string;
}

export interface ColumnMapping {
  // SC Buang Dana
  bankCol: string;
  accountNameCol: string;
  accountNumberCol: string;
  nominalCol: string;
  attachmentCol: string;

  // WD Pending
  usernameCol: string;
  orderIdCol: string;
  wdNominalCol: string;

  // Order Summary
  dateCol: string;
  statusCol: string;
  itemCol: string;
  summaryOrderIdCol: string;
  summaryBankCol: string;
  summaryAccountNumberCol: string;
  summaryAccountNameCol: string;
  summaryNominalCol: string;
}

export interface CustomTemplate {
  name: string;
  formatString: string; // e.g. "{ORDER_ID} | {DATE} | {NOMINAL}"
  description?: string;
  createdAt: string;
}

export type ActiveTab = 'upload' | 'table' | 'sc-buang-dana' | 'wd-pending' | 'order-summary' | 'template-builder' | 'instructions' | 'qris-crosscheck' | 'naik-saldo-qris' | 'peminjaman-dana';
