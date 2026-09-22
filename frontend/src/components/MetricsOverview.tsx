import { Package, Scale, ShieldCheck, Truck } from 'lucide-react';
import type { InventoryStats } from '../types/steel';

interface MetricsOverviewProps {
  stats: InventoryStats | null;
}

export function MetricsOverview({ stats }: MetricsOverviewProps) {
  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div>
          <div className="metric-label">Total Batches</div>
          <div className="metric-value">{stats?.totalBatches ?? 0}</div>
          <div className="metric-sub">Active tracked units in yard</div>
        </div>
        <div className="metric-icon-box cyan">
          <Package size={22} />
        </div>
      </div>

      <div className="metric-card">
        <div>
          <div className="metric-label">Gross Tonnage</div>
          <div className="metric-value">
            {stats?.totalTonnage ?? 0}{' '}
            <span style={{ fontSize: '1rem', color: '#64748B', fontWeight: 500 }}>Tons</span>
          </div>
          <div className="metric-sub">Total physical steel mass</div>
        </div>
        <div className="metric-icon-box purple">
          <Scale size={22} />
        </div>
      </div>

      <div className="metric-card">
        <div>
          <div className="metric-label">In Quality Control</div>
          <div className="metric-value">{stats?.qualityCheckCount ?? 0}</div>
          <div className="metric-sub">Pending metallurgical sign-off</div>
        </div>
        <div className="metric-icon-box amber">
          <ShieldCheck size={22} />
        </div>
      </div>

      <div className="metric-card">
        <div>
          <div className="metric-label">Dispatched / Shipped</div>
          <div className="metric-value">{stats?.shippedCount ?? 0}</div>
          <div className="metric-sub">Delivered to client projects</div>
        </div>
        <div className="metric-icon-box green">
          <Truck size={22} />
        </div>
      </div>
    </div>
  );
}
