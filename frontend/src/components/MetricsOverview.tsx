import { Package, Scale, ShieldCheck, Truck } from 'lucide-react';
import type { InventoryStats } from '../types/steel';

interface MetricsOverviewProps {
  stats: InventoryStats | null;
}

export function MetricsOverview({ stats }: MetricsOverviewProps) {
  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-header">
          <span>Total Batches</span>
          <Package size={18} style={{ color: '#38BDF8' }} />
        </div>
        <div className="metric-value">{stats?.totalBatches ?? 0}</div>
        <div className="metric-sub">Active tracked steel units</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <span>Total Tonnage</span>
          <Scale size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="metric-value">{stats?.totalTonnage ?? 0} <span style={{ fontSize: '1rem', color: '#94A3B8' }}>tons</span></div>
        <div className="metric-sub">Gross inventory weight</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <span>Quality Check</span>
          <ShieldCheck size={18} style={{ color: '#38BDF8' }} />
        </div>
        <div className="metric-value">{stats?.qualityCheckCount ?? 0}</div>
        <div className="metric-sub">Under lab testing / QA</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <span>Shipped / Dispatched</span>
          <Truck size={18} style={{ color: '#10B981' }} />
        </div>
        <div className="metric-value">{stats?.shippedCount ?? 0}</div>
        <div className="metric-sub">Delivered to clients</div>
      </div>
    </div>
  );
}
