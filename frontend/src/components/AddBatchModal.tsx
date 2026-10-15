import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { CreateSteelBatchDto, SteelGrade } from '../types/steel';
import { BranchLocation } from '../types/auth';

interface AddBatchModalProps {
  isOpen: boolean;
  defaultBranch?: BranchLocation;
  onClose: () => void;
  onSubmit: (dto: CreateSteelBatchDto) => void;
}

export function AddBatchModal({
  isOpen,
  defaultBranch = BranchLocation.Davao,
  onClose,
  onSubmit,
}: AddBatchModalProps) {
  const [heatNumber, setHeatNumber] = useState('');
  const [grade, setGrade] = useState<SteelGrade>('A36_Structural');
  const [weightInTons, setWeightInTons] = useState<number>(10);
  const [dimensions, setDimensions] = useState('12mm x 1500mm x 6000mm');
  const [location, setLocation] = useState('Yard A - Bay 01');
  const [branch, setBranch] = useState<BranchLocation>(defaultBranch);
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      heatNumber: heatNumber.trim(),
      grade,
      weightInTons: Number(weightInTons),
      dimensions: dimensions.trim(),
      location: location.trim(),
      branch,
      createdAt: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
    });
    setHeatNumber('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Log New Steel Batch</h3>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.25rem 0.5rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Assigned Branch Location</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as BranchLocation)}
              >
                <option value={BranchLocation.Davao}>Davao Branch (Yard South)</option>
                <option value={BranchLocation.Cagayan}>Cagayan Branch (Northern Mindanao Hub)</option>
                <option value={BranchLocation.Mandaue}>Mandaue Branch (Visayas Logistics)</option>
                <option value={BranchLocation.Cebu}>Cebu Branch (Port Yard)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Heat Number (optional auto-generate)</label>
              <input
                type="text"
                placeholder="e.g. HT-2026-9901"
                value={heatNumber}
                onChange={(e) => setHeatNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Steel Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as SteelGrade)}
              >
                <option value="A36_Structural">A36 Structural Carbon</option>
                <option value="A572_HighStrength">A572 High Strength Alloy</option>
                <option value="SS304_Stainless">SS304 Stainless Steel</option>
                <option value="SS316_Stainless">SS316 Stainless Steel</option>
                <option value="AISI1045_Carbon">AISI 1045 Medium Carbon</option>
                <option value="ToolSteel_D2">Tool Steel D2 High Chrome</option>
              </select>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Weight (Metric Tons)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={weightInTons}
                  onChange={(e) => setWeightInTons(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Yard / Mill Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yard B - Bay 04"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Dimensions / Specifications</label>
              <input
                type="text"
                required
                placeholder="Thickness x Width x Length"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Production / Received Date</label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={16} /> Log Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
