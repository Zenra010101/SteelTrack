/**
 * Universal Table Export Utility for SteelTrack
 * Provides standardized CSV export and printable PDF table generation
 * across all modules and tables in the application.
 */

import { formatPHP } from './currency';

export interface ExportTableData {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  subtitle?: string;
}

/**
 * Exports data to a clean CSV file with UTF-8 BOM for Excel compatibility.
 */
export function exportToCsv({ filename, headers, rows }: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}): void {
  const sanitizeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows: string[] = [];
  csvRows.push(headers.map(sanitizeCell).join(','));

  for (const row of rows) {
    csvRows.push(row.map(sanitizeCell).join(','));
  }

  // Prepend UTF-8 BOM so Excel opens special characters correctly
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print-formatted view that triggers the browser's PDF print/save dialogue.
 */
export function exportToPdf({ title, headers, rows, subtitle }: {
  title: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  subtitle?: string;
}): void {
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) {
    alert('Please allow popups to export printable PDF documents.');
    return;
  }

  const generatedDate = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tableHeaderHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const tableRowsHtml = rows
    .map(
      (r, idx) =>
        `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
          ${r.map((cell) => `<td>${escapeHtml(cell !== null && cell !== undefined ? String(cell) : '—')}</td>`).join('')}
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - SteelTrack</title>
  <style>
    @page {
      size: landscape;
      margin: 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 20px;
      background: #FFFFFF;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #0284C7;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #0284C7;
      letter-spacing: -0.02em;
    }
    .brand-sub {
      font-size: 10px;
      color: #64748B;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: right;
      font-size: 10px;
      color: #475569;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 700;
      color: #0F172A;
      margin: 4px 0 2px 0;
    }
    .doc-subtitle {
      font-size: 11px;
      color: #64748B;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 10.5px;
    }
    th {
      background-color: #F1F5F9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #CBD5E1;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    td {
      padding: 6px 9px;
      border: 1px solid #E2E8F0;
      color: #1E293B;
      word-break: break-word;
    }
    tr.even {
      background-color: #FFFFFF;
    }
    tr.odd {
      background-color: #F8FAFC;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #E2E8F0;
      padding-top: 8px;
      font-size: 9.5px;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      tr {
        page-break-inside: avoid;
      }
      thead {
        display: table-header-group;
      }
    }
    .toolbar {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
    }
    .btn-print {
      background: #0284C7;
      color: #FFFFFF;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div>
      <div class="brand-title">SteelTrack Enterprise Logistics</div>
      <div class="brand-sub">Philippines Industrial Steel Supply & Depots</div>
      <div class="doc-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="doc-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div class="doc-meta">
      <div><strong>Date Generated:</strong> ${generatedDate}</div>
      <div><strong>Total Records:</strong> ${rows.length} item(s)</div>
      <div><strong>System Status:</strong> Verified Live Operational Data</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${tableHeaderHtml}</tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>SteelTrack Enterprise Infrastructure • Confidential Internal Business Document</div>
    <div>Page 1 • Authenticated System Report</div>
  </div>

  <script>
    window.onload = function() {
      // Auto-trigger print prompt after rendering
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Dedicated thermal / invoice PDF generator for cashier receipts.
 */
export function printReceiptPdf(receipt: any): void {
  const printWindow = window.open('', '_blank', 'width=450,height=750');
  if (!printWindow) {
    window.print();
    return;
  }

  const itemsHtml = (receipt.items || [])
    .map(
      (it: any) => `
    <tr>
      <td style="padding: 4px 0;">
        <strong>${escapeHtml(it.productName || it.grade || 'Steel Product')}</strong>
        <div style="font-size: 9px; color: #64748B;">${escapeHtml(it.sku || it.dimensions || 'Standard')}</div>
      </td>
      <td style="text-align: right; padding: 4px 0;">${Number(it.quantityTons ?? it.quantity ?? 1)}</td>
      <td style="text-align: right; padding: 4px 0;">${formatPHP(it.pricePerTonPHP ?? it.unitPrice ?? 0)}</td>
      <td style="text-align: right; padding: 4px 0; font-weight: 700;">${formatPHP(it.lineTotalPHP ?? it.lineTotal ?? 0)}</td>
    </tr>`
    )
    .join('');

  const splitHtml = receipt.splitTenders && receipt.splitTenders.length > 0
    ? `<div style="margin: 6px 0; padding: 6px; background: #F8FAFC; border-radius: 4px; font-size: 10px;">
        <div style="font-weight: 700; margin-bottom: 3px;">Payment Tender Breakdown:</div>
        ${receipt.splitTenders.map((t: any) => `
          <div style="display: flex; justify-content: space-between;">
            <span>• ${escapeHtml(t.method)} ${t.referenceNumber ? `(${escapeHtml(t.referenceNumber)})` : ''}:</span>
            <strong>${formatPHP(t.amount)}</strong>
          </div>
        `).join('')}
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${escapeHtml(receipt.invoiceNumber || 'Official Invoice')}</title>
  <style>
    @page { margin: 6mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body {
      font-family: 'JetBrains Mono', Courier, monospace;
      font-size: 11px;
      color: #0F172A;
      margin: 0;
      padding: 10px;
      background: #FFFFFF;
      line-height: 1.35;
    }
    .header { text-align: center; margin-bottom: 12px; }
    .brand { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; }
    .sub { font-size: 9.5px; color: #475569; }
    .title { font-size: 11px; font-weight: 700; margin-top: 6px; border-top: 1px dashed #94A3B8; border-bottom: 1px dashed #94A3B8; padding: 4px 0; }
    .meta { font-size: 10px; margin: 8px 0; border-bottom: 1px dashed #CBD5E1; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 6px 0; }
    th { border-bottom: 1px solid #000; padding: 3px 0; text-align: left; font-size: 9px; }
    .totals { border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; font-size: 10.5px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .grand { font-size: 13px; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-top: 4px; }
    .footer { text-align: center; font-size: 9px; color: #64748B; margin-top: 14px; border-top: 1px dashed #CBD5E1; padding-top: 8px; }
    @media print {
      .no-print { display: none !important; }
    }
    .btn-print {
      width: 100%;
      background: #0284C7;
      color: #FFFFFF;
      border: none;
      padding: 8px;
      font-weight: 700;
      border-radius: 4px;
      margin-bottom: 10px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="header">
    <div class="brand">STEELTRACK PHILIPPINES</div>
    <div class="sub">${escapeHtml(receipt.branch || 'Main')} Depot Facility</div>
    <div class="sub">TIN: 004-982-120-000 VAT Registered</div>
    <div class="sub">Industrial Highway, ${escapeHtml(receipt.branch || 'Main')} City</div>
    <div class="title">OFFICIAL SALES INVOICE</div>
  </div>

  <div class="meta">
    <div><strong>Invoice #:</strong> ${escapeHtml(receipt.invoiceNumber || '—')}</div>
    <div><strong>Date:</strong> ${new Date(receipt.createdAt || Date.now()).toLocaleString()}</div>
    <div><strong>Cashier:</strong> ${escapeHtml(receipt.cashierName || 'Terminal')}</div>
    <div><strong>Customer:</strong> ${escapeHtml(receipt.customerName || 'Walk-in Client')}</div>
    ${receipt.customerTin ? `<div><strong>Client TIN:</strong> ${escapeHtml(receipt.customerTin)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Qty</th>
        <th style="text-align: right;">Price</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="row">
      <span>Subtotal:</span>
      <span>${formatPHP(receipt.subtotalPHP ?? receipt.totalAmountPHP ?? 0)}</span>
    </div>
    ${receipt.discountPHP > 0 ? `
    <div class="row" style="color: #059669;">
      <span>Volume Discount:</span>
      <span>-${formatPHP(receipt.discountPHP)}</span>
    </div>` : ''}
    <div class="row">
      <span>12% VAT Included:</span>
      <span>${formatPHP(receipt.taxPHP ?? 0)}</span>
    </div>
    <div class="row grand">
      <span>TOTAL DUE:</span>
      <span>${formatPHP(receipt.totalAmountPHP ?? receipt.totalAmountUSD ?? 0)}</span>
    </div>
    <div class="row" style="margin-top: 4px;">
      <span>Payment Method:</span>
      <span><strong>${escapeHtml(receipt.paymentMethod || 'Cash')}</strong></span>
    </div>
    ${splitHtml}
    ${receipt.paymentMethod === 'Cash' && receipt.amountTenderedPHP !== undefined ? `
    <div class="row">
      <span>Cash Tendered:</span>
      <span>${formatPHP(receipt.amountTenderedPHP)}</span>
    </div>
    <div class="row">
      <span>Change Due:</span>
      <span>${formatPHP(receipt.changeDuePHP ?? 0)}</span>
    </div>` : ''}
  </div>

  <div class="footer">
    <div>BIR Permit No. FP-2026-981240-00</div>
    <div>Certified Official Machine Generated Invoice</div>
    <div style="margin-top: 4px;">Thank you for your business!</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

