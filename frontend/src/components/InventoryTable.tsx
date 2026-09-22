import type { SteelBatch, BatchStatus } from '../types/steel';

interface InventoryTableProps {
  batches: SteelBatch[];
  loading: boolean;
  onUpdateStatus: (id: string, newStatus: BatchStatus) => void;
}

export function InventoryTable({
  batches,
  loading,
  onUpdateStatus,
}: InventoryTableProps) {
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
    return gradeStr.replace('_', ' ');
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
              <th>Action</th>
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
                <td>
                  <select
                    value={b.status}
                    onChange={(e) =>
                      onUpdateStatus(b.id, e.target.value as BatchStatus)
                    }
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                  >
                    <option value="InProduction">InProduction</option>
                    <option value="QualityCheck">QualityCheck</option>
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Shipped">Shipped</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
