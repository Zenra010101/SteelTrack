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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '520px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calculator size={20} style={{ color: '#38BDF8' }} /> End-of-Day (EOD) Drawer Balancing
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: '#94A3B8' }}>Terminal Branch:</span>
            <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{branch} Counter</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: '#94A3B8' }}>Cashier on Duty:</span>
            <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{cashierName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #334155', fontSize: '0.95rem' }}>
            <span style={{ color: '#94A3B8' }}>System Recorded Net Sales:</span>
            <strong style={{ color: '#38BDF8' }}>₱{systemTotalPHP.toLocaleString()}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Physical Cash Count in Drawer (PHP)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.65rem', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 700 }}
            />
          </div>

          <div style={{ background: variance === 0 ? '#064E3B' : variance > 0 ? '#1E3A8A' : '#7F1D1D', padding: '0.85rem', borderRadius: '6px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Cash Variance:</strong>
              {variance === 0 && <span> (Exact Match)</span>}
              {variance > 0 && <span> (Over Cash)</span>}
              {variance < 0 && <span> (Shortage)</span>}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              ₱{Math.abs(variance).toLocaleString()}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Verification Notes / Shortage Explanation
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain any drawer discrepancy, petty cash vouchers, or float amounts..."
              style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
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
