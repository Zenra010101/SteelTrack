import { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { BranchLocation } from '../types/auth';

interface SalesReportVerificationModalProps {
  isOpen: boolean;
  branch: BranchLocation;
  cashierName: string;
  systemTotalPHP: number;
  onClose: () => void;
  onSubmitVerification: (data: { actualCashPHP: number; variancePHP: number; notes: string }) => void;
}

export function SalesReportVerificationModal({
  isOpen,
  branch,
  cashierName,
  systemTotalPHP,
  onClose,
  onSubmitVerification,
}: SalesReportVerificationModalProps) {
  const [actualCash, setActualCash] = useState<string>(systemTotalPHP.toString());
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const actualNum = parseFloat(actualCash) || 0;
  const variance = actualNum - systemTotalPHP;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitVerification({
      actualCashPHP: actualNum,
      variancePHP: variance,
      notes,
    });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '12px', border: '1px solid #CBD5E1', width: '90%', maxWidth: '520px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#000000' }}>
            <Calculator size={20} style={{ color: '#0284C7' }} /> End-of-Day (EOD) Drawer Balancing
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer', padding: '0.2rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Terminal Info Card: Pure White Background (#FFFFFF) & Pure Black Text (#000000) */}
        <div style={{ background: '#FFFFFF', padding: '1.1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #CBD5E1', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.88rem' }}>
            <span style={{ color: '#000000', fontWeight: 600 }}>Terminal Branch:</span>
            <span style={{ color: '#000000', fontWeight: 700 }}>{branch} Counter</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.88rem' }}>
            <span style={{ color: '#000000', fontWeight: 600 }}>Cashier on Duty:</span>
            <span style={{ color: '#000000', fontWeight: 700 }}>{cashierName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #E2E8F0', fontSize: '0.98rem' }}>
            <span style={{ color: '#000000', fontWeight: 600 }}>System Recorded Net Sales:</span>
            <strong style={{ color: '#000000', fontSize: '1.1rem' }}>₱{systemTotalPHP.toLocaleString()}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#000000', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              Physical Cash Count in Drawer (PHP)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.65rem', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 700, outline: 'none' }}
            />
          </div>

          {/* Cash Variance Card: Pure White Background (#FFFFFF) & Pure Black Text (#000000) */}
          <div style={{
            background: '#FFFFFF',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            border: variance === 0 ? '2px solid #059669' : variance > 0 ? '2px solid #0284C7' : '2px solid #DC2626',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#000000',
          }}>
            <div style={{ fontSize: '0.9rem', color: '#000000' }}>
              <strong style={{ color: '#000000' }}>Cash Variance:</strong>
              {variance === 0 && <span style={{ color: '#000000', fontWeight: 600 }}> (Exact Match)</span>}
              {variance > 0 && <span style={{ color: '#000000', fontWeight: 600 }}> (Over Cash)</span>}
              {variance < 0 && <span style={{ color: '#000000', fontWeight: 600 }}> (Shortage)</span>}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#000000' }}>
              ₱{Math.abs(variance).toLocaleString()}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#000000', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              Verification Notes / Shortage Explanation
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain any drawer discrepancy, petty cash vouchers, or float amounts..."
              style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem', borderRadius: '6px', outline: 'none', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ color: '#000000' }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Submit EOD Verification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
