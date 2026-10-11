import { useMemo } from 'react';
import { BarChart3, TrendingUp, Building2, Layers } from 'lucide-react';
import { BranchLocation } from '../types/auth';

export function OwnerAnalyticsView() {
  const branchData = useMemo(() => [
    { name: BranchLocation.Cagayan, tonnage: 168.5, percentage: 38, activeBatches: 24, revenuePHP: 143225 },
    { name: BranchLocation.Davao, tonnage: 124.0, percentage: 28, activeBatches: 18, revenuePHP: 105400 },
    { name: BranchLocation.Cebu, tonnage: 89.2, percentage: 20, activeBatches: 12, revenuePHP: 75820 },
    { name: BranchLocation.Mandaue, tonnage: 62.1, percentage: 14, activeBatches: 9, revenuePHP: 52785 },
  ], []);

  const totalTonnage = branchData.reduce((sum, b) => sum + b.tonnage, 0);
  const totalRevenue = branchData.reduce((sum, b) => sum + b.revenuePHP, 0);

  return (
    <div className="analytics-container">
      <div className="forecast-header">
        <div>
          <div className="badge-ai">
            <BarChart3 size={14} /> Owner Executive Report
          </div>
          <h2 className="section-title">Cross-Branch Analytics & Revenue Breakdown</h2>
          <p className="section-sub">
            Real-time multi-branch inventory distribution, total tonnage, and sales metrics across Davao, Mandaue, Cebu, and Cagayan.
          </p>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div>
            <div className="metric-label">Total Network Tonnage</div>
            <div className="metric-value">{totalTonnage.toFixed(1)} <span style={{ fontSize: '1rem', color: '#64748B', fontWeight: 500 }}>T</span></div>
            <div className="metric-sub">Distributed across 4 branches</div>
          </div>
          <div className="metric-icon-box cyan">
            <Layers size={22} />
          </div>
        </div>

        <div className="metric-card">
          <div>
            <div className="metric-label">Network Inventory Valuation</div>
            <div className="metric-value">₱{totalRevenue.toLocaleString()}</div>
            <div className="metric-sub">Based on current steel market spot rates</div>
          </div>
          <div className="metric-icon-box green">
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="metric-card">
          <div>
            <div className="metric-label">Active Steel Batches</div>
            <div className="metric-value">
              {branchData.reduce((acc, b) => acc + b.activeBatches, 0)}
            </div>
            <div className="metric-sub">Across production & storage yards</div>
          </div>
          <div className="metric-icon-box amber">
            <Building2 size={22} />
          </div>
        </div>
      </div>

      {/* Branch Distribution Table */}
      <div className="table-container" style={{ marginBottom: '2rem' }}>
        <table>
          <thead>
            <tr>
              <th>Branch Location</th>
              <th>Total Stock Tonnage</th>
              <th>Tonnage Distribution %</th>
              <th>Active Batches</th>
              <th>Valuation (₱ PHP)</th>
            </tr>
          </thead>
          <tbody>
            {branchData.map((branch) => (
              <tr key={branch.name}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <Building2 size={16} style={{ color: '#0284C7' }} />
                    {branch.name} Branch
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{branch.tonnage} Tons</td>
                <td style={{ width: '30%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${branch.percentage}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #0284C7, #2563EB)',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#64748B', width: '32px', fontWeight: 600 }}>
                      {branch.percentage}%
                    </span>
                  </div>
                </td>
                <td>{branch.activeBatches} Batches</td>
                <td style={{ fontWeight: 700, color: '#059669', fontFamily: 'Outfit, sans-serif' }}>
                  ₱{branch.revenuePHP.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
