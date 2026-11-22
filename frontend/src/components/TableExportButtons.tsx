import { Download, FileText } from 'lucide-react';
import { exportToCsv, exportToPdf } from '../utils/tableExport';

export interface TableExportButtonsProps {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  subtitle?: string;
  compact?: boolean;
}

export function TableExportButtons({
  filename,
  title,
  headers,
  rows,
  subtitle,
  compact = false,
}: TableExportButtonsProps) {
  const handleExportCsv = () => {
    exportToCsv({
      filename,
      headers,
      rows,
    });
  };

  const handleExportPdf = () => {
    exportToPdf({
      title,
      headers,
      rows,
      subtitle,
    });
  };

  return (
    <div
      className="table-export-actions no-print"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      <button
        type="button"
        onClick={handleExportCsv}
        className="btn-secondary"
        title="Export data to CSV spreadsheet"
        style={{
          padding: compact ? '0.35rem 0.65rem' : '0.45rem 0.85rem',
          fontSize: compact ? '0.75rem' : '0.82rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          background: '#FFFFFF',
          borderColor: '#CBD5E1',
          color: '#000000',
          fontWeight: 600,
          borderRadius: '6px',
        }}
      >
        <Download size={compact ? 13 : 15} color="#0284C7" />
        <span>Export CSV</span>
      </button>

      <button
        type="button"
        onClick={handleExportPdf}
        className="btn-secondary"
        title="Export data to formatted PDF"
        style={{
          padding: compact ? '0.35rem 0.65rem' : '0.45rem 0.85rem',
          fontSize: compact ? '0.75rem' : '0.82rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          background: '#FFFFFF',
          borderColor: '#CBD5E1',
          color: '#000000',
          fontWeight: 600,
          borderRadius: '6px',
        }}
      >
        <FileText size={compact ? 13 : 15} color="#D97706" />
        <span>Export PDF</span>
      </button>
    </div>
  );
}

