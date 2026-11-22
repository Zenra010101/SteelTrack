import { useState } from 'react';
import { X, Sliders } from 'lucide-react';
import type { SteelBatch } from '../types/steel';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  batch: SteelBatch | null;
  onClose: () => void;
  onSubmitAdjustment: (batchId: string, adjustedTons: number, reason: string) => Promise<void>;
}

export function StockAdjustmentModal({
  isOpen,
  batch,
  onClose,
  onSubmitAdjustment,
}: StockAdjustmentModalProps) {
  const [adjustedTons, setAdjustedTons] = useState<string>('');
  const [reason, setReason] = useState<string>('Physical Audit Discrepancy');

  if (!isOpen || !batch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustedTons || isNaN(parseFloat(adjustedTons))) return;

    await onSubmitAdjustment(batch.id, parseFloat(adjustedTons), reason);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '12px', border: '1px solid #CBD5E1', width: '90%', maxWidth: '480px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={20} style={{ color: '#B45309' }} /> Adjust Physical Batch Stock
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #E2E8F0', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 600, color: '#000000' }}>Heat #: {batch.heatNumber}</div>
          <div style={{ color: '#000000' }}>Grade: {batch.grade} ({batch.dimensions})</div>
          <div style={{ color: '#0369A1', fontWeight: 700, marginTop: '0.25rem' }}>
            Current Recorded Tonnage: {batch.weightInTons} MT
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#000000', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              New Adjusted Tonnage (MT)
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder={batch.weightInTons.toString()}
              value={adjustedTons}
              onChange={(e) => setAdjustedTons(e.target.value)}
              style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#000000', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Adjustment Reason / Notes
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem', borderRadius: '6px' }}
            >
              <option value="Physical Audit Discrepancy">Physical Audit Discrepancy</option>
              <option value="Damage / Scrap Write-off">Damage / Scrap Write-off</option>
              <option value="Scale Recalibration Difference">Scale Recalibration Difference</option>
              <option value="Supplier Over-delivery Adjustment">Supplier Over-delivery Adjustment</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ background: '#0369A1', borderRadius: '6px', padding: '0.55rem 1.1rem' }}>
              Confirm Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
