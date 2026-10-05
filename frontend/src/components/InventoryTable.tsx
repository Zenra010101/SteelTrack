import { useState } from 'react';
import { Tag, Sliders } from 'lucide-react';
import type { SteelBatch, BatchStatus } from '../types/steel';
import { BarcodePrintModal } from './BarcodePrintModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';

interface InventoryTableProps {
  batches: SteelBatch[];
  loading: boolean;
  onUpdateStatus: (id: string, newStatus: BatchStatus) => void;
  onAdjustStock?: (id: string, newTons: number, reason: string) => Promise<void>;
}

export function InventoryTable({
  batches,
  loading,
  onUpdateStatus,
  onAdjustStock,
}: InventoryTableProps) {
  const [selectedBarcodeBatch, setSelectedBarcodeBatch] = useState<SteelBatch | null>(null);
  const [selectedAdjustmentBatch, setSelectedAdjustmentBatch] = useState<SteelBatch | null>(null);

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'InProduction':
        return 'badge-inproduction';
      case 'QualityCheck':
        return 'badge-qualitycheck';
      case 'Available':
        return 'badge-available';
      case 'Reserved':
        return 'badge-reserved';
      case 'Shipped':
        return 'badge-shipped';
      default:
        return 'badge-available';
    }
  };

  const formatGrade = (gradeStr: string) => {
    return gradeStr.replace(/_/g, ' ');
  };

  return (
    <div className="table-container">
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
          Loading inventory batches...
        </div>
      ) : batches.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
          No steel inventory batches match your filter criteria.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Heat Number</th>
              <th>Grade</th>
              <th>Weight (Tons)</th>
              <th>Dimensions</th>
              <th>Yard Location</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>
                  <span className="branch-tag highlight">{b.branch || 'Davao'}</span>
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#0F172A' }}>
                  {b.heatNumber}
                </td>
                <td>
                  <span style={{ color: '#0284C7', fontWeight: 600 }}>
                    {formatGrade(b.grade)}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{b.weightInTons} t</td>
                <td style={{ color: '#64748B', fontSize: '0.85rem' }}>{b.dimensions}</td>
                <td style={{ color: '#475569' }}>{b.location}</td>
                <td>
                  <span className={`badge ${getBadgeClass(b.status)}`}>
                    {b.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      title="Print Industrial Barcode Tag"
                      onClick={() => setSelectedBarcodeBatch(b)}
                    >
                      <Tag size={12} /> Tag
                    </button>

                    <button
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      title="Adjust Physical Tonnage"
                      onClick={() => setSelectedAdjustmentBatch(b)}
                    >
                      <Sliders size={12} /> Adjust
                    </button>

                    <select
                      value={b.status}
                      onChange={(e) =>
                        onUpdateStatus(b.id, e.target.value as BatchStatus)
                      }
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem', borderRadius: '4px' }}
                    >
                      <option value="InProduction">InProduction</option>
                      <option value="QualityCheck">QualityCheck</option>
                      <option value="Available">Available</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Shipped">Shipped</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* BARCODE MODAL */}
      <BarcodePrintModal
        isOpen={Boolean(selectedBarcodeBatch)}
        batch={selectedBarcodeBatch}
        onClose={() => setSelectedBarcodeBatch(null)}
      />

      {/* ADJUSTMENT MODAL */}
      <StockAdjustmentModal
        isOpen={Boolean(selectedAdjustmentBatch)}
        batch={selectedAdjustmentBatch}
        onClose={() => setSelectedAdjustmentBatch(null)}
        onSubmitAdjustment={async (id, adjustedTons, reason) => {
          if (onAdjustStock) await onAdjustStock(id, adjustedTons, reason);
        }}
      />
    </div>
  );
}
