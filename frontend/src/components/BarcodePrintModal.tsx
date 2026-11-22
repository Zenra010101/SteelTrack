import { X, Printer, Tag } from 'lucide-react';
import type { SteelBatch } from '../types/steel';

interface BarcodePrintModalProps {
  isOpen: boolean;
  batch: SteelBatch | null;
  onClose: () => void;
}

export function BarcodePrintModal({ isOpen, batch, onClose }: BarcodePrintModalProps) {
  if (!isOpen || !batch) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '12px', width: '90%', maxWidth: '500px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem', color: '#000000' }}>
            <Tag size={20} style={{ color: '#0284C7' }} /> Industrial Barcode Tag
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* PRINTABLE BARCODE CONTAINER */}
        <div style={{ border: '2px solid #0F172A', borderRadius: '8px', padding: '1.25rem', background: '#FAFAFA', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px dashed #CBD5E1', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#000000' }}>STEELTRACK</div>
              <div style={{ fontSize: '0.75rem', color: '#000000', fontWeight: 600 }}>Yard Batch Identifier</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, background: '#0F172A', color: '#FFFFFF', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                {batch.branch}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#000000', marginTop: '0.2rem' }}>Yard: {batch.location}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <div>
              <span style={{ color: '#000000', fontSize: '0.75rem', display: 'block' }}>Heat Number</span>
              <strong style={{ fontSize: '1rem', color: '#000000' }}>{batch.heatNumber}</strong>
            </div>
            <div>
              <span style={{ color: '#000000', fontSize: '0.75rem', display: 'block' }}>Steel Grade</span>
              <strong style={{ color: '#0284C7' }}>{batch.grade}</strong>
            </div>
            <div>
              <span style={{ color: '#000000', fontSize: '0.75rem', display: 'block' }}>Bundle Tonnage</span>
              <strong style={{ color: '#000000' }}>{batch.weightInTons} MT</strong>
            </div>
            <div>
              <span style={{ color: '#000000', fontSize: '0.75rem', display: 'block' }}>Dimensions</span>
              <span style={{ fontWeight: 600, color: '#000000' }}>{batch.dimensions}</span>
            </div>
          </div>

          {/* VISUAL CODE-128 BARCODE REPRESENTATION */}
          <div style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', height: '45px', alignItems: 'center', marginBottom: '0.25rem' }}>
              {/* Simulated Code-128 barcode bars */}
              {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2].map((w, i) => (
                <div key={i} style={{ width: `${w}px`, height: '100%', background: i % 2 === 0 ? '#0F172A' : '#FFFFFF' }} />
              ))}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', letterSpacing: '0.15em', fontWeight: 700, color: '#000000' }}>
              *{batch.heatNumber}*
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ background: '#E2E8F0', color: '#000000', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
            Close
          </button>
          <button
            onClick={() => window.print()}
            style={{ background: '#0F172A', color: '#FFFFFF', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Printer size={16} /> Print Tag
          </button>
        </div>
      </div>
    </div>
  );
}
