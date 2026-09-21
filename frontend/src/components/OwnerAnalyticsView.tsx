import { useMemo } from 'react';
import { BarChart3, TrendingUp, Building2, Layers } from 'lucide-react';
import { BranchLocation } from '../types/auth';

export function OwnerAnalyticsView() {
  const branchData = useMemo(() => [
    { name: BranchLocation.Makati, tonnage: 168.5, percentage: 38, activeBatches: 24, revenueUSD: 143225 },
    { name: BranchLocation.Davao, tonnage: 124.0, percentage: 28, activeBatches: 18, revenueUSD: 105400 },
    { name: BranchLocation.Cebu, tonnage: 89.2, percentage: 20, activeBatches: 12, revenueUSD: 75820 },
    { name: BranchLocation.Mandaue, tonnage: 62.1, percentage: 14, activeBatches: 9, revenueUSD: 52785 },
  ], []);

  const totalTonnage = branchData.reduce((sum, b) => sum + b.tonnage, 0);
  const totalRevenue = branchData.reduce((sum, b) => sum + b.revenueUSD, 0);

  return (
    <div className="analytics-container">
      <div className="forecast-header">
        <div>
          <div className="badge-ai" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            <BarChart3 size={14} /> Owner Executive Report
          </div>
          <h2 className="section-title">Cross-Branch Analytics & Revenue Breakdown</h2>
          <p className="section-sub">
            Real-time multi-branch inventory distribution, total tonnage, and sales metrics across Davao, Makati, Mandaue, and Cebu.
          </p>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span>Total Network Tonnage</span>
            <Layers size={18} style={{ color: '#38BDF8' }} />
          </div>
          <div className="metric-value">{totalTonnage.toFixed(1)} T</div>
          <div className="metric-sub">Distributed across 4 branches</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Estimated Network Inventory Value</span>
            <TrendingUp size={18} style={{ color: '#10B981' }} />
          </div>
          <div className="metric-value">${totalRevenue.toLocaleString()}</div>
          <div className="metric-sub">Based on current market valuations</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Active Steel Batches</span>
            <Building2 size={18} style={{ color: '#F59E0B' }} />
          </div>
          <div className="metric-value">
            {branchData.reduce((acc, b) => acc + b.activeBatches, 0)}
          </div>
          <div className="metric-sub">Across production & storage yards</div>
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
              <th>Valuation ($ USD)</th>
            </tr>
          </thead>
          <tbody>
            {branchData.map((branch) => (
              <tr key={branch.name}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <Building2 size={16} style={{ color: '#38BDF8' }} />
                    {branch.name} Branch
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>{branch.tonnage} Tons</td>
                <td style={{ width: '30%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flex: 1, height: '8px', background: '#0F172A', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${branch.percentage}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #38BDF8, #6366F1)',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94A3B8', width: '32px' }}>
                      {branch.percentage}%
                    </span>
                  </div>
                </td>
                <td>{branch.activeBatches} Batches</td>
                <td style={{ fontWeight: 700, color: '#10B981' }}>
                  ${branch.revenueUSD.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
