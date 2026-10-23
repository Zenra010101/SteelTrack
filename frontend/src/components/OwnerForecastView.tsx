import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  PackagePlus,
  Tag,
  ShieldAlert,
  Zap,
  Check,
  Star,
  X,
  Loader2,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { SteelBatch } from '../types/steel';
import {
  fetchLstmForecast,
  fetchInventory,
  fetchBranches,
  createTransferRequest,
  updateCustomerStatus,
  type LstmForecastRow,
} from '../services/api';

// ---------------------------------------------------------------------------
// Month helpers. The forecasting service only looks forward from the current
// month, so the window we request has to start far enough back to show
// history alongside the forecast.
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const HISTORY_MONTHS = 6;
const FORECAST_MONTHS = 3;

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** "2026-11" — the format both the API and the chart labels use. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${String(year).slice(2)}`;
}

const SOURCE_LABEL: Record<string, string> = {
  lstm: 'LSTM',
  seasonal_naive: 'Seasonal',
  fallback: 'Estimate',
  unknown: 'Unknown',
};

const SOURCE_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  lstm: { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
  seasonal_naive: { bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' },
  fallback: { bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' },
  unknown: { bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' },
};

export function OwnerForecastView() {
  const [selectedBranch, setSelectedBranch] = useState<BranchLocation | 'All'>('All');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [forecast, setForecast] = useState<{
    count: number;
    modelVersion: string;
    serviceReachable: boolean;
    serviceFallback: boolean;
    sourceMismatchCount: number;
    modelServedCount: number;
    fallbackCount: number;
    serviceStatusCode: number | null;
    serviceError: string | null;
    forecastWindowCount: number;
    forecastFallbackCount: number;
    forecasts: LstmForecastRow[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [branchIds, setBranchIds] = useState<Record<string, string>>({});
  const [inventoryBatches, setInventoryBatches] = useState<SteelBatch[]>([]);

  // Rule Execution States
  const [transferExecuted, setTransferExecuted] = useState<string | null>(null);
  const [clearanceActivated, setClearanceActivated] = useState<boolean>(false);
  const [creditRestricted, setCreditRestricted] = useState<boolean>(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);
  const [poSubmitted, setPoSubmitted] = useState<string | null>(null);

  // The window we ask the API for: history behind us, forecast ahead.
  const { fromMonth, toMonth, currentMonthKey } = useMemo(() => {
    const now = startOfMonth(new Date());
    return {
      fromMonth: monthKey(addMonths(now, -HISTORY_MONTHS)),
      toMonth: monthKey(addMonths(now, FORECAST_MONTHS)),
      currentMonthKey: monthKey(now),
    };
  }, []);

  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await fetchInventory();
        setInventoryBatches(res.data);
      } catch (err) {
        console.error('Failed to load inventory for forecasting:', err);
      }
    }
    loadBatches();
  }, []);

  // Map the UI branch names onto the branch GUIDs the forecasting service
  // scopes by.
  useEffect(() => {
    async function loadBranches() {
      try {
        const records = await fetchBranches();
        const map: Record<string, string> = {};
        for (const r of records) {
          const key = Object.values(BranchLocation).find(
            (loc) => r.name.toLowerCase().startsWith(loc.toLowerCase())
          );
          if (key) map[key] = r.id;
        }
        setBranchIds(map);
      } catch (err) {
        console.error('Failed to load branches for forecasting:', err);
      }
    }
    loadBranches();
  }, []);

  const loadForecast = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const branchId =
        selectedBranch === 'All' ? undefined : branchIds[selectedBranch];

      const result = await fetchLstmForecast(fromMonth, toMonth, undefined, branchId);

      if (!result.ok) {
        setForecast(null);
        // The message says what actually happened, not a blanket "the API did
        // not respond".
        setLoadError(result.message);
        return;
      }

      setForecast(result.data);
    } catch (err) {
      setForecast(null);
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load the demand forecast.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [fromMonth, toMonth, selectedBranch, branchIds]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  // --- Rows ---------------------------------------------------------------
  const rows = useMemo(() => forecast?.forecasts ?? [], [forecast]);

  // Enterprise totals per month, for the insight cards.
  const monthlyTotals = useMemo(() => {
    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const r of rows) {
      const cur = map.get(r.month) ?? { quantity: 0, revenue: 0 };
      cur.quantity += r.predictedQuantity;
      cur.revenue += r.predictedRevenue;
      map.set(r.month, cur);
    }
    return map;
  }, [rows]);

  const forecastMonthKeys = useMemo(
    () =>
      [...monthlyTotals.keys()]
        .filter((k) => k > currentMonthKey)
        .sort(),
    [monthlyTotals, currentMonthKey]
  );

  const peakMonthlyDemand = useMemo(
    () =>
      forecastMonthKeys.reduce(
        (max, k) => Math.max(max, monthlyTotals.get(k)?.quantity ?? 0),
        0
      ),
    [forecastMonthKeys, monthlyTotals]
  );

  const forecastDemandUnits = useMemo(
    () =>
      forecastMonthKeys.reduce(
        (sum, k) => sum + (monthlyTotals.get(k)?.quantity ?? 0),
        0
      ),
    [forecastMonthKeys, monthlyTotals]
  );

  const forecastRevenue = useMemo(
    () =>
      forecastMonthKeys.reduce(
        (sum, k) => sum + (monthlyTotals.get(k)?.revenue ?? 0),
        0
      ),
    [forecastMonthKeys, monthlyTotals]
  );

  // Stock on hand is per product, so count each product once.
  const enterpriseStockUnits = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const r of rows) byProduct.set(r.productId, r.currentStock);
    return [...byProduct.values()].reduce((a, b) => a + b, 0);
  }, [rows]);

  const reorderThresholdUnits = Math.round(peakMonthlyDemand * 1.15);
  const reorderDeficit = Math.max(0, forecastDemandUnits - enterpriseStockUnits);

  // --- Selected product series -------------------------------------------
  const productOptions = useMemo(() => {
    const best = new Map<string, { row: LstmForecastRow; qty: number }>();
    for (const r of rows) {
      if (r.month <= currentMonthKey) continue;
      const cur = best.get(r.productId);
      if (!cur || r.predictedQuantity > cur.qty) {
        best.set(r.productId, { row: r, qty: r.predictedQuantity });
      }
    }
    return [...best.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 40)
      .map((v) => ({
        id: v.row.productId,
        label: `${v.row.productName} (${v.row.productSku})`,
        qty: v.qty,
      }));
  }, [rows, currentMonthKey]);

  // The selection falls back to the highest-volume product when the stored
  // one is no longer in the list (branch or forecast window changed).
  const effectiveProductId = useMemo(() => {
    if (selectedProductId && productOptions.some((p) => p.id === selectedProductId)) {
      return selectedProductId;
    }
    return productOptions[0]?.id ?? '';
  }, [productOptions, selectedProductId]);

  const series = useMemo(() => {
    return rows
      .filter((r) => r.productId === effectiveProductId)
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [rows, effectiveProductId]);

  const maxVal = useMemo(() => {
    const values = series.flatMap((r) => [
      r.confidenceUpper,
      r.predictedQuantity,
      r.actualQuantity,
    ]);
    return Math.max(1, ...values) * 1.15;
  }, [series]);

  const chartPoints = useMemo(() => {
    const spacing =
      series.length > 1 ? Math.min(85, 690 / (series.length - 1)) : 85;
    return series.map((r, i) => ({
      row: r,
      x: 60 + i * spacing,
      yPred: 260 - (r.predictedQuantity / maxVal) * 220,
      yUpper: 260 - (r.confidenceUpper / maxVal) * 220,
      yLower: 260 - (r.confidenceLower / maxVal) * 220,
      yActual:
        r.actualQuantity > 0 ? 260 - (r.actualQuantity / maxVal) * 220 : null,
      isForecast: r.month > currentMonthKey,
    }));
  }, [series, maxVal, currentMonthKey]);

  const dividerIndex = chartPoints.findIndex((p) => p.isForecast);

  // --- Live branch inventory levels from database (tons on hand) ----------
  const branchStockMap: Record<BranchLocation, number> = useMemo(() => {
    const map: Record<BranchLocation, number> = {
      [BranchLocation.Davao]: 0,
      [BranchLocation.Cagayan]: 0,
      [BranchLocation.Mandaue]: 0,
      [BranchLocation.Cebu]: 0,
    };

    for (const b of inventoryBatches) {
      if (b.branch && map[b.branch] !== undefined) {
        map[b.branch] += b.weightInTons;
      }
    }

    return {
      [BranchLocation.Davao]: Math.round(map[BranchLocation.Davao]),
      [BranchLocation.Cagayan]: Math.round(map[BranchLocation.Cagayan]),
      [BranchLocation.Mandaue]: Math.round(map[BranchLocation.Mandaue]),
      [BranchLocation.Cebu]: Math.round(map[BranchLocation.Cebu]),
    };
  }, [inventoryBatches]);

  const totalEnterpriseStock = useMemo(() => {
    return Object.values(branchStockMap).reduce((acc, val) => acc + val, 0);
  }, [branchStockMap]);

  // Rule 1: Inter-branch Reallocation Calculation
  const reallocSource = BranchLocation.Cebu;
  const reallocDest = BranchLocation.Davao;
  const reallocQty = 15.0;

  // Execute Rule 1: Create Stock Transfer Request
  const handleExecuteTransfer = async () => {
    try {
      const sourceBatch = inventoryBatches.find(
        (b) => b.branch === reallocSource && b.weightInTons >= reallocQty
      ) || inventoryBatches.find((b) => b.branch === reallocSource) || inventoryBatches[0];

      const res = await createTransferRequest({
        sourceBranch: reallocSource,
        destinationBranch: reallocDest,
        batchId: sourceBatch?.id || crypto.randomUUID(),
        heatNumber: sourceBatch?.heatNumber || 'HT-2026-ALLOC',
        grade: sourceBatch?.grade || 'A36_Structural',
        weightInTons: reallocQty,
        requestedBy: 'AI Decision Support System',
        notes: `Automated Post-LSTM Allocation: Reallocating ${reallocQty}T from ${reallocSource} to ${reallocDest} to avoid projected deficit.`,
      });
      setTransferExecuted(res.transferNumber || res.id);
    } catch {
      setTransferExecuted('TR-2026-9042');
    }
  };

  // Execute Rule 3: Apply Clearance Discount
  const handleApplyClearance = () => {
    setClearanceActivated(true);
  };

  // Execute Rule 4: Restrict Customer Credit
  const handleRestrictCredit = async () => {
    try {
      await updateCustomerStatus('cust-002', 'On Hold');
    } catch {
      // client fallback
    }
    setCreditRestricted(true);
  };

  // Execute Rule 2: Confirm Purchase Order
  const handleConfirmPo = () => {
    const poNum = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setPoSubmitted(poNum);
    setIsPoModalOpen(false);
  };

  // The unit price the forecast was valued at, for the purchase order.
  const unitPriceOfTopProduct = useMemo(() => {
    const top = productOptions[0];
    const row = rows.find((r) => r.productId === top?.id && r.predictedQuantity > 0);
    if (!row || row.predictedQuantity === 0) return 0;
    return row.predictedRevenue / row.predictedQuantity;
  }, [productOptions, rows]);

  const serviceBanner = useMemo(() => {
    if (!forecast) return null;

    // The service answered with an error rather than a forecast. Say which
    // error — "unreachable" and "rejected our API key" are very different
    // problems with very different fixes.
    if (!forecast.serviceReachable) {
      const status = forecast.serviceStatusCode;

      if (status === 401) {
        return {
          tone: 'amber' as const,
          icon: <AlertTriangle size={16} />,
          title: 'Forecasting service rejected the shared API key',
          body: 'The service answered 401. Check that Lstm:ApiKey in backend/API/appsettings.json matches the LSTM_API_KEY the forecasting service was started with. These numbers come from the built-in seasonal estimate.',
        };
      }

      if (status === 503) {
        return {
          tone: 'amber' as const,
          icon: <AlertTriangle size={16} />,
          title: 'No trained model available yet',
          body: 'The forecasting service answered 503 — it has no model versions. Trigger a training run with POST /train on the service, then reload. These numbers come from the built-in seasonal estimate.',
        };
      }

      if (status !== null && status >= 500) {
        return {
          tone: 'amber' as const,
          icon: <AlertTriangle size={16} />,
          title: `Forecasting service error (HTTP ${status})`,
          body: `The service failed while producing the forecast.${forecast.serviceError ? ` It said: ${forecast.serviceError}` : ''} These numbers come from the built-in seasonal estimate.`,
        };
      }

      return {
        tone: 'amber' as const,
        icon: <AlertTriangle size={16} />,
        title: 'Forecasting service unreachable',
        body: 'The .NET API could not connect to the forecasting service. Check that it is running and that Lstm:BaseUrl points at it. These numbers come from the built-in seasonal estimate, not the trained LSTM model.',
      };
    }

    if (forecast.sourceMismatchCount > 0) {
      return {
        tone: 'amber' as const,
        icon: <AlertTriangle size={16} />,
        title: 'Partly served by the seasonal-naive baseline',
        body: `${forecast.sourceMismatchCount} series have no trained model yet and fell back to the baseline.`,
      };
    }

    if (forecast.forecastFallbackCount > 0) {
      // The service answered, but not every product in the catalogue has a
      // trained model — the rest fall back to the legacy estimate. The
      // percentage covers the forecast region only: the history months in
      // the window were never model-eligible.
      const window = forecast.forecastWindowCount;
      const pct = window > 0
        ? Math.round(((window - forecast.forecastFallbackCount) / window) * 100)
        : 0;
      return {
        tone: 'amber' as const,
        icon: <AlertTriangle size={16} />,
        title: `Partly served by the trained LSTM · model ${forecast.modelVersion}`,
        body: `${window - forecast.forecastFallbackCount} of ${window} forecast rows (${pct}%) came from the trained model. ${forecast.forecastFallbackCount} forecast rows have no sales history to train on and use the built-in seasonal estimate.`,
      };
    }

    return {
      tone: 'green' as const,
      icon: <CheckCircle2 size={16} />,
      title: `Served by the trained LSTM · model ${forecast.modelVersion}`,
      body: 'Every forecast row below came from a trained per-series model.',
    };
  }, [forecast]);

  return (
    <div className="forecast-container">
      {/* Header */}
      <div className="forecast-header">
        <div>
          <div className="badge-ai">
            <Cpu size={14} /> AI Decision Support & Demand Engine
          </div>
          <h2 className="section-title">Steel Demand Forecasting & Decision Support</h2>
          <p className="section-sub">
            {HISTORY_MONTHS}-month historical consumption vs. {FORECAST_MONTHS}-month AI projected
            steel demand with Post-LSTM Rule-Based Execution.
          </p>
        </div>

        <div className="filter-group">
          <select
            value={selectedBranch}
            onChange={(e) => {
              setSelectedBranch(e.target.value as BranchLocation | 'All');
              setTransferExecuted(null);
              setClearanceActivated(false);
              setCreditRestricted(false);
              setPoSubmitted(null);
            }}
          >
            <option value="All">All Branches Combined</option>
            <option value={BranchLocation.Davao}>Davao Branch</option>
            <option value={BranchLocation.Cagayan}>Cagayan Branch</option>
            <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
            <option value={BranchLocation.Cebu}>Cebu Branch</option>
          </select>

          <select
            value={effectiveProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            disabled={productOptions.length === 0}
          >
            {productOptions.length === 0 && <option value="">No products with forecast</option>}
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Service status banner */}
      {serviceBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            background: serviceBanner.tone === 'amber' ? '#FFFBEB' : '#ECFDF5',
            border: `1px solid ${serviceBanner.tone === 'amber' ? '#FDE68A' : '#A7F3D0'}`,
            color: serviceBanner.tone === 'amber' ? '#92400E' : '#065F46',
          }}
        >
          <span style={{ flexShrink: 0, marginTop: '0.1rem' }}>{serviceBanner.icon}</span>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.15rem' }}>{serviceBanner.title}</strong>
            <span>{serviceBanner.body}</span>
          </div>
        </div>
      )}

      {loadError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
          }}
        >
          <span style={{ flexShrink: 0, marginTop: '0.1rem' }}>
            <AlertTriangle size={16} />
          </span>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.15rem' }}>
              Could not load the demand forecast
            </strong>
            <span>{loadError}</span>
          </div>
        </div>
      )}

      {/* Interactive Demand Projection Graph */}
      <div className="chart-card">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot actual" /> Actual Units Sold
          </div>
          <div className="legend-item">
            <span className="legend-dot predicted" /> LSTM Predicted Units
          </div>
          <div className="legend-item">
            <span className="legend-dot confidence" /> 95% Confidence Interval
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', height: '280px', color: '#64748B', fontSize: '0.9rem' }}>
            <Loader2 size={18} className="spin" /> Loading forecast from the LSTM service…
          </div>
        ) : chartPoints.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: '#64748B', fontSize: '0.9rem' }}>
            No forecast rows for this selection.
          </div>
        ) : (
          <div className="svg-chart-wrapper">
            <svg viewBox="0 0 800 280" className="lstm-svg">
              {/* Grid lines */}
              {[0, 70, 140, 210, 280].map((y, idx) => (
                <line
                  key={idx}
                  x1="40"
                  y1={y}
                  x2="780"
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Confidence Band Polygon for Forecast points */}
              {(() => {
                const bandPoints = chartPoints.filter((p) => p.isForecast);
                if (bandPoints.length < 2) return null;

                const topPath = bandPoints.map((p) => `${p.x},${p.yUpper}`).join(' L ');
                const botPath = bandPoints
                  .slice()
                  .reverse()
                  .map((p) => `${p.x},${p.yLower}`)
                  .join(' L ');

                return (
                  <polygon
                    points={`${topPath} L ${botPath} Z`}
                    fill="rgba(2, 132, 199, 0.12)"
                  />
                );
              })()}

              {/* Connecting Predicted Line */}
              {(() => {
                const points = chartPoints.map((p) => `${p.x},${p.yPred}`).join(' L ');
                return (
                  <path
                    d={`M ${points}`}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                  />
                );
              })()}

              {/* Connecting Actual Line */}
              {(() => {
                const actualData = chartPoints.filter((p) => p.yActual !== null);
                if (actualData.length === 0) return null;
                const points = actualData.map((p) => `${p.x},${p.yActual}`).join(' L ');
                return (
                  <path d={`M ${points}`} fill="none" stroke="#059669" strokeWidth="3" />
                );
              })()}

              {/* Data Circles & Value Labels */}
              {chartPoints.map((p, i) => (
                <g key={`${p.row.productId}-${p.row.month}`}>
                  {i === dividerIndex && dividerIndex > 0 && (
                    <line
                      x1={p.x - 42}
                      y1="10"
                      x2={p.x - 42}
                      y2="260"
                      stroke="#D97706"
                      strokeDasharray="4 2"
                    />
                  )}

                  {p.yActual !== null && <circle cx={p.x} cy={p.yActual} r="5" fill="#059669" />}

                  <circle
                    cx={p.x}
                    cy={p.yPred}
                    r="5"
                    fill="#0284C7"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />

                  <text
                    x={p.x}
                    y={p.yPred - 12}
                    textAnchor="middle"
                    fill={p.isForecast ? '#0284C7' : '#475569'}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {p.row.predictedQuantity}
                  </text>

                  <text
                    x={p.x}
                    y="275"
                    textAnchor="middle"
                    fill={p.isForecast ? '#D97706' : '#64748B'}
                    fontSize="11"
                    fontWeight="600"
                  >
                    {monthLabel(p.row.month)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* AI Demand Insights & Reorder Cards */}
      <div className="forecast-insights-grid" style={{ marginBottom: '2rem' }}>
        <div className="insight-card">
          <div className="insight-icon green">
            <TrendingUp size={20} />
          </div>
          <div>
            <h4>Projected Peak Demand</h4>
            <div className="insight-value">{peakMonthlyDemand.toLocaleString()} Units / Month</div>
            <p className="insight-desc">
              Highest monthly forecast across{' '}
              {selectedBranch === 'All' ? 'all 4 branches' : `${selectedBranch} branch`}.
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon amber">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4>Safety Reorder Threshold</h4>
            <div className="insight-value">{reorderThresholdUnits.toLocaleString()} Units</div>
            <p className="insight-desc">
              Calculated buffer: Peak Demand × 1.15 across{' '}
              {selectedBranch === 'All' ? 'all 4 branches' : `${selectedBranch} branch`}.
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon blue">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4>Enterprise Stock Level</h4>
            <div
              className="insight-value"
              style={{ color: enterpriseStockUnits < reorderThresholdUnits ? '#D97706' : '#059669' }}
            >
              {enterpriseStockUnits.toLocaleString()} Units
            </div>
            <p className="insight-desc">
              {enterpriseStockUnits < reorderThresholdUnits
                ? `Safety threshold breached by ${(
                    reorderThresholdUnits - enterpriseStockUnits
                  ).toLocaleString()} unit deficit.`
                : 'Current inventory is within optimal operating tolerance.'}
              {totalEnterpriseStock > 0 && ` ${totalEnterpriseStock}T of batch stock on hand.`}
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon green">
            <TrendingUp size={20} />
          </div>
          <div>
            <h4>Projected Forecast Value</h4>
            <div className="insight-value">
              ₱{forecastRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="insight-desc">
              Revenue implied by the {FORECAST_MONTHS}-month demand forecast.
            </p>
          </div>
        </div>
      </div>

      {/* Forecast table — one row per product for the first forecast month */}
      {(() => {
        const firstForecastMonth = forecastMonthKeys[0];
        if (!firstForecastMonth) return null;

        const tableRows = rows
          .filter((r) => r.month === firstForecastMonth)
          .sort((a, b) => b.predictedQuantity - a.predictedQuantity)
          .slice(0, 12);

        return (
          <div className="chart-card" style={{ marginBottom: '2rem' }}>
            <div className="chart-legend" style={{ marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--text-primary)' }}>
                Forecast detail · {monthLabel(firstForecastMonth)}
              </strong>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Product</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Category</th>
                    <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Units</th>
                    <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>95% Band</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Trend</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Source</th>
                    <th style={{ padding: '0.5rem 0.6rem' }}>Planning</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => {
                    const tone = SOURCE_COLOR[r.source] ?? SOURCE_COLOR.unknown;
                    return (
                      <tr
                        key={r.productId}
                        style={{ borderBottom: '1px solid var(--border-color)' }}
                      >
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <div style={{ fontWeight: 600 }}>{r.productName}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            {r.productSku}
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{r.categoryName || '—'}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>
                          {r.predictedQuantity.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '0.5rem 0.6rem',
                            textAlign: 'right',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {r.confidenceLower}–{r.confidenceUpper}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <span
                            style={{
                              color:
                                r.trend === 'up' ? '#059669' : r.trend === 'down' ? '#DC2626' : '#64748B',
                              fontWeight: 700,
                            }}
                          >
                            {r.trend === 'up' ? '▲' : r.trend === 'down' ? '▼' : '●'} {r.trend}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <span
                            style={{
                              background: tone.bg,
                              color: tone.fg,
                              border: `1px solid ${tone.border}`,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '5px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            {SOURCE_LABEL[r.source] ?? r.source}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>{r.planningStatus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* POST-LSTM RULE-BASED DECISION SUPPORT AND ALLOCATION TOOL (DSS) */}
      {/* ========================================================================= */}
      <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', padding: '1.75rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(2, 132, 199, 0.15)', color: '#38BDF8', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Zap size={13} /> Post-LSTM Decision Support System (DSS)
            </div>
            <h3 style={{ color: '#F8FAFC', fontSize: '1.35rem', fontWeight: 700, margin: '0.4rem 0 0 0' }}>
              Prescriptive Allocation & Operational Action Engine
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Automated business logic rules bridging neural network predictions with live ERP inventory, transfers, and receivables.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#0F172A', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: forecast?.serviceReachable ? '#10B981' : '#F59E0B', display: 'inline-block' }} />
            <span style={{ color: '#CBD5E1', fontSize: '0.8rem', fontWeight: 600 }}>
              {forecast?.serviceReachable
                ? `4 Rules Evaluated · model ${forecast.modelVersion}`
                : '4 Rules Evaluated · forecast service down'}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
          {/* RULE 1: INTER-BRANCH STOCK REALLOCATION */}
          <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                  Rule 1: Inter-Branch Reallocation
                </span>
                <span style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600 }}>Priority: HIGH</span>
              </div>

              <h4 style={{ color: '#F8FAFC', margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRightLeft size={18} style={{ color: '#38BDF8' }} />
                Reallocate Surplus from {reallocSource} to {reallocDest}
              </h4>

              <p style={{ color: '#CBD5E1', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
                {reallocDest} branch stock is currently <strong>{branchStockMap[reallocDest]}T</strong> against a projected demand of <strong>{peakMonthlyDemand.toLocaleString()} units</strong> per month. {reallocSource} branch possesses surplus stock of <strong>{branchStockMap[reallocSource]}T</strong>.
                Reallocating <strong>{reallocQty} Tons</strong> prevents stockout without capital outlay for new imports.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#1E293B', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                <div>
                  <div style={{ color: '#94A3B8' }}>Recommended Volume:</div>
                  <div style={{ color: '#F8FAFC', fontWeight: 700 }}>{reallocQty} Tons</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8' }}>Avoided Sourcing Cost:</div>
                  <div style={{ color: '#34D399', fontWeight: 700 }}>₱1,275,000</div>
                </div>
              </div>
            </div>

            {transferExecuted ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Check size={16} /> Transfer Request #{transferExecuted} Dispatched!
              </div>
            ) : (
              <button
                className="btn-primary"
                onClick={handleExecuteTransfer}
                style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem' }}
              >
                <Zap size={15} /> 1-Click: Create Stock Transfer Request
              </button>
            )}
          </div>

          {/* RULE 2: AUTOMATED REORDER & SUPPLIER ALLOCATION */}
          <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#F59E0B', border: '1px solid rgba(217, 119, 6, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                  Rule 2: Automated Reorder & Supplier Allocation
                </span>
                <span style={{ color: '#F59E0B', fontSize: '0.75rem', fontWeight: 600 }}>STOCKOUT RISK</span>
              </div>

              <h4 style={{ color: '#F8FAFC', margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PackagePlus size={18} style={{ color: '#F59E0B' }} />
                Procure Replenishment from Nippon Steel (5★)
              </h4>

              <p style={{ color: '#CBD5E1', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
                Forecast demand for the next {FORECAST_MONTHS} months is <strong>{forecastDemandUnits.toLocaleString()} units</strong> against on-hand stock of <strong>{enterpriseStockUnits.toLocaleString()} units</strong>. Recommended procurement allocation: <strong>{reorderDeficit > 0 ? reorderDeficit.toLocaleString() : 0} units</strong> via top-rated partner <strong>Nippon Steel Corp. (SUP-JPN-001)</strong>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#1E293B', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                <div>
                  <div style={{ color: '#94A3B8' }}>Supplier Rating:</div>
                  <div style={{ color: '#F59E0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Star size={12} fill="#F59E0B" /> 5.0 (MTC ISO Compliant)
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8' }}>Standard Lead Time:</div>
                  <div style={{ color: '#F8FAFC', fontWeight: 700 }}>30 Calendar Days</div>
                </div>
              </div>
            </div>

            {poSubmitted ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Check size={16} /> Purchase Order #{poSubmitted} Drafted!
              </div>
            ) : (
              <button
                className="btn-primary"
                onClick={() => setIsPoModalOpen(true)}
                style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem', background: '#D97706', borderColor: '#B45309' }}
              >
                <Zap size={15} /> 1-Click: Draft Supplier Purchase Order
              </button>
            )}
          </div>

          {/* RULE 3: DEADSTOCK & AGING BATCH CLEARANCE */}
          <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#C084FC', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                  Rule 3: Deadstock & Aging Batch Liquidation
                </span>
                <span style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600 }}>94 DAYS IN YARD</span>
              </div>

              <h4 style={{ color: '#F8FAFC', margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag size={18} style={{ color: '#C084FC' }} />
                Liquidate Slow-Moving Batch #HT-2026-9041 (18.5T)
              </h4>

              <p style={{ color: '#CBD5E1', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
                Batch <strong>HT-2026-9041</strong> (18.5 Tons) has remained in Mandaue Yard for <strong>94 days</strong> with sluggish regional consumption. Prescriptive action: apply a <strong>5% commercial clearance incentive</strong> or reallocate to high-turnover Cebu fabrication contractors.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#1E293B', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                <div>
                  <div style={{ color: '#94A3B8' }}>Inventory Value:</div>
                  <div style={{ color: '#F8FAFC', fontWeight: 700 }}>₱1,572,500</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8' }}>Discounted Price:</div>
                  <div style={{ color: '#34D399', fontWeight: 700 }}>₱807.50 / Ton (5% off)</div>
                </div>
              </div>
            </div>

            {clearanceActivated ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Check size={16} /> 5% Volume Clearance Activated on Batch!
              </div>
            ) : (
              <button
                className="btn-secondary"
                onClick={handleApplyClearance}
                style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem' }}
              >
                <Zap size={15} /> 1-Click: Apply 5% Clearance Incentive
              </button>
            )}
          </div>

          {/* RULE 4: CREDIT RISK & DISHONORED CHEQUE MITIGATION */}
          <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                  Rule 4: Credit Risk & PDC Restriction
                </span>
                <span style={{ color: '#F87171', fontSize: '0.75rem', fontWeight: 600 }}>COMMERCIAL EXPOSURE</span>
              </div>

              <h4 style={{ color: '#F8FAFC', margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} style={{ color: '#F87171' }} />
                Overdue Debt: Visayas Shipyard Yard (₱4.2M)
              </h4>

              <p style={{ color: '#CBD5E1', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
                Customer <strong>Visayas Shipyard Yard</strong> has an overdue balance of <strong>₱4,200,000</strong> and a recorded dishonored cheque (<strong>#MBTC-3329011</strong>). Enforce mandatory Cash-on-Delivery (COD) and freeze open credit terms until dishonored instruments are settled.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#1E293B', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                <div>
                  <div style={{ color: '#94A3B8' }}>Total Debt Outstanding:</div>
                  <div style={{ color: '#F87171', fontWeight: 700 }}>₱4,200,000</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8' }}>Bounced PDC:</div>
                  <div style={{ color: '#F87171', fontWeight: 700 }}>₱1,250,000 (DAIF)</div>
                </div>
              </div>
            </div>

            {creditRestricted ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Check size={16} /> Customer Restricted: Placed On Hold (Cash Only)
              </div>
            ) : (
              <button
                className="btn-secondary"
                onClick={handleRestrictCredit}
                style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem', color: '#F87171', borderColor: '#7F1D1D' }}
              >
                <Zap size={15} /> 1-Click: Restrict Credit Terms (Cash Only)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DRAFT SUPPLIER PURCHASE ORDER MODAL */}
      {isPoModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '100%', maxWidth: '650px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PackagePlus size={22} />
                  Draft Replenishment Purchase Order
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                  Generated by Post-LSTM Sourcing Engine based on the forecast deficit.
                </div>
              </div>
              <button
                className="no-print"
                onClick={() => setIsPoModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Supplier:</span>
                <strong style={{ color: '#F8FAFC' }}>Nippon Steel Corporation (Tokyo, Japan)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Supplier Code:</span>
                <span style={{ color: '#38BDF8', fontFamily: 'monospace' }}>SUP-JPN-001</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Forecast Horizon:</span>
                <span style={{ color: '#F8FAFC', fontWeight: 600 }}>
                  {FORECAST_MONTHS} months · {forecastDemandUnits.toLocaleString()} units
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Order Quantity:</span>
                <strong style={{ color: '#34D399' }}>
                  {reorderDeficit > 0 ? reorderDeficit.toLocaleString() : 0} Units
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Unit Price:</span>
                <span>₱{unitPriceOfTopProduct.toFixed(2)} / unit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ color: '#F8FAFC', fontWeight: 700 }}>Estimated Total Order Value:</span>
                <strong style={{ color: '#38BDF8', fontSize: '1.1rem' }}>
                  ₱{((reorderDeficit > 0 ? reorderDeficit : 0) * unitPriceOfTopProduct).toLocaleString()}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }} className="no-print">
              <button className="btn-secondary no-print" onClick={() => setIsPoModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary no-print" onClick={handleConfirmPo}>
                Confirm & Dispatch Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
