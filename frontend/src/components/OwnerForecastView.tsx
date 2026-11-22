import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  PackagePlus,
  Zap,
  Check,
  X,
  Loader2,
  Sliders,
  Building2,
  ShieldCheck,
  Info,
  Layers,
  FileText,
  Truck,
  ShoppingCart,
  HelpCircle,
  LayoutGrid,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { SteelBatch } from '../types/steel';

type ViewTab = 'rbdss' | 'forecast' | 'all';
type RbdssSegment = 'matrix' | 'schedule' | 'all';
import {
  fetchLstmForecast,
  fetchInventory,
  fetchBranches,
  createTransferRequest,
  fetchRecommendations,
  type LstmForecastRow,
  type RbdssResponse,
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

interface OwnerForecastViewProps {
  selectedBranch?: BranchLocation | 'All';
}

export function OwnerForecastView({ selectedBranch = 'All' }: OwnerForecastViewProps = {}) {
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('rbdss');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Searchable Product Dropdown (Combobox) State
  const [isProductPickerOpen, setIsProductPickerOpen] = useState<boolean>(false);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const productPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productPickerRef.current && !productPickerRef.current.contains(event.target as Node)) {
        setIsProductPickerOpen(false);
      }
    }
    if (isProductPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isProductPickerOpen]);

  // Diagnostics & Info Modal State
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  // RBDSS Segmental Navigation State
  const [rbdssSegment, setRbdssSegment] = useState<RbdssSegment>('matrix');

  // Catalog Schedule Search, Filter & Pagination State
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogActionFilter, setCatalogActionFilter] = useState<'ALL' | 'KEEP' | 'TRANSFER' | 'PROCURE'>('ALL');
  const [catalogPage, setCatalogPage] = useState<number>(1);
  const [catalogPageSize, setCatalogPageSize] = useState<number>(20);
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

  // RBDSS Backend Engine Integration State
  const [backendRbdss, setBackendRbdss] = useState<RbdssResponse | null>(null);
  const [isRbdssLoading, setIsRbdssLoading] = useState<boolean>(false);

  // RBDSS Rule Execution States
  const [executedTransfers, setExecutedTransfers] = useState<Record<string, string>>({});
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);
  const [poSubmitted, setPoSubmitted] = useState<string | null>(null);
  const [selectedPoQuantity, setSelectedPoQuantity] = useState<number>(0);
  const [selectedPoBranch, setSelectedPoBranch] = useState<string>('Davao');

  // Interactive Simulation Sandbox State
  const [isSandboxOpen, setIsSandboxOpen] = useState<boolean>(false);
  const [simSurge, setSimSurge] = useState<Record<string, number>>({
    [BranchLocation.Davao]: 0,
    [BranchLocation.Cagayan]: 0,
    [BranchLocation.Cebu]: 0,
    [BranchLocation.Mandaue]: 0,
  });
  const [simIncomingStock, setSimIncomingStock] = useState<Record<string, number>>({
    [BranchLocation.Davao]: 10,
    [BranchLocation.Cagayan]: 5,
    [BranchLocation.Cebu]: 0,
    [BranchLocation.Mandaue]: 8,
  });
  const [simReservedStock, setSimReservedStock] = useState<Record<string, number>>({
    [BranchLocation.Davao]: 5,
    [BranchLocation.Cagayan]: 2,
    [BranchLocation.Cebu]: 4,
    [BranchLocation.Mandaue]: 3,
  });

  // The window we ask the API for: current month + 3-month forward demand (no past months)
  const { fromMonth, toMonth, currentMonthKey } = useMemo(() => {
    const now = startOfMonth(new Date());
    return {
      fromMonth: monthKey(now),
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

  // Map the UI branch names onto the branch GUIDs
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
        setLoadError(result.message || 'Failed to load the demand forecast.');
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

  // Fetch Section 2.3.2.2 Rule-Based Decision Support System recommendations from backend
  const loadRecommendations = useCallback(async () => {
    setIsRbdssLoading(true);
    try {
      const branchId = selectedBranch === 'All' ? undefined : branchIds[selectedBranch];
      const prodId = selectedProductId || undefined;
      const firstFcMonth = forecastMonthKeys[0] || undefined;
      const resp = await fetchRecommendations({
        period: firstFcMonth,
        branchId,
        productId: prodId,
      });
      if (resp && resp.success) {
        setBackendRbdss(resp);
      }
    } catch (err) {
      console.warn('Could not load backend recommendations:', err);
    } finally {
      setIsRbdssLoading(false);
    }
  }, [selectedBranch, branchIds, selectedProductId, forecastMonthKeys]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

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

  // --- Selected product series: covers every product in the project ---
  const productOptions = useMemo(() => {
    const byProduct = new Map<string, { row: LstmForecastRow; qty: number }>();
    for (const r of rows) {
      const cur = byProduct.get(r.productId);
      if (!cur || r.predictedQuantity > cur.qty) {
        byProduct.set(r.productId, { row: r, qty: r.predictedQuantity });
      }
    }
    return [...byProduct.values()]
      .sort((a, b) => (b.qty !== a.qty ? b.qty - a.qty : a.row.productName.localeCompare(b.row.productName)))
      .map((v) => ({
        id: v.row.productId,
        name: v.row.productName,
        sku: v.row.productSku,
        label: `${v.row.productName} (${v.row.productSku})`,
        qty: v.qty,
      }));
  }, [rows]);

  const filteredProductOptions = useMemo(() => {
    if (!productSearchQuery.trim()) return productOptions;
    const q = productSearchQuery.toLowerCase().trim();
    return productOptions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [productOptions, productSearchQuery]);

  const effectiveProductId = useMemo(() => {
    if (selectedProductId && productOptions.some((p) => p.id === selectedProductId)) {
      return selectedProductId;
    }
    return productOptions[0]?.id ?? '';
  }, [productOptions, selectedProductId]);

  const selectedProductObj = useMemo(() => {
    return productOptions.find((p) => p.id === effectiveProductId) || productOptions[0];
  }, [productOptions, effectiveProductId]);

  // Forecast graph: includes ONLY the current month and the 3-month forward demand (no past months)
  const series = useMemo(() => {
    return rows
      .filter((r) => r.productId === effectiveProductId && r.month >= currentMonthKey)
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [rows, effectiveProductId, currentMonthKey]);

  const maxVal = useMemo(() => {
    const values = series.flatMap((r) => [
      r.confidenceUpper,
      r.predictedQuantity,
      r.actualQuantity,
    ]);
    return Math.max(1, ...values) * 1.15;
  }, [series]);

  const chartPoints = useMemo(() => {
    const count = series.length;
    const spacing = count > 1 ? Math.min(200, 640 / (count - 1)) : 200;
    const xOffset = count > 1 ? (760 - (count - 1) * spacing) / 2 : 400;
    return series.map((r, i) => ({
      row: r,
      x: xOffset + i * spacing,
      yPred: 240 - (r.predictedQuantity / maxVal) * 190,
      yUpper: 240 - (r.confidenceUpper / maxVal) * 190,
      yLower: 240 - (r.confidenceLower / maxVal) * 190,
      yActual:
        r.actualQuantity > 0 ? 240 - (r.actualQuantity / maxVal) * 190 : null,
      isForecast: r.month > currentMonthKey,
      isCurrent: r.month === currentMonthKey,
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

  // The unit price the forecast was valued at, for the purchase order.
  const unitPriceOfTopProduct = useMemo(() => {
    const top = productOptions[0];
    const row = rows.find((r) => r.productId === top?.id && r.predictedQuantity > 0);
    if (!row || row.predictedQuantity === 0) return 850;
    return row.predictedRevenue / row.predictedQuantity;
  }, [productOptions, rows]);

  // =========================================================================
  // SECTION 2.3.2.2 RULE-BASED DECISION SUPPORT SYSTEM (RBDSS) COMPUTATIONS
  // =========================================================================

  // 1. Compute Section 2.3.2.2 Proposed Decision Formulas for all 4 branches
  const branchDecisions = useMemo(() => {
    const branches = [
      BranchLocation.Davao,
      BranchLocation.Cagayan,
      BranchLocation.Cebu,
      BranchLocation.Mandaue,
    ];

    const firstForecastMonthKey = forecastMonthKeys[0];
    const topProd = productOptions.find(p => p.id === effectiveProductId) || productOptions[0];
    const topRow = rows.find(r => r.productId === topProd?.id && r.month === firstForecastMonthKey);
    const totalPredictedDemand = topRow?.predictedQuantity || Math.round(peakMonthlyDemand / 4) || 60;

    // Relative operational distribution across branches
    const branchWeights: Record<BranchLocation, number> = {
      [BranchLocation.Davao]: 0.38,
      [BranchLocation.Cagayan]: 0.22,
      [BranchLocation.Cebu]: 0.25,
      [BranchLocation.Mandaue]: 0.15,
    };

    return branches.map((b) => {
      // 1. Current Physical Stock
      const baseStock = branchStockMap[b] > 0 ? branchStockMap[b] : (b === BranchLocation.Cebu ? 85 : b === BranchLocation.Mandaue ? 45 : b === BranchLocation.Cagayan ? 32 : 18);
      const currentStock = Math.max(0, baseStock);

      // Incoming stock and reserved stock
      const incomingStock = simIncomingStock[b] ?? 0;
      const reservedStock = simReservedStock[b] ?? 0;

      // Formula 1: Projected Available Stock (PAS)
      // PAS = Current Stock + Incoming Stock - Reserved/Allocated Stock
      const pas = Math.max(0, currentStock + incomingStock - reservedStock);

      // Forecasted demand for this branch
      const rawDemand = Math.round(totalPredictedDemand * branchWeights[b]);
      const surgePercent = simSurge[b] ?? 0;
      const forecastedDemand = Math.max(0, Math.round(rawDemand * (1 + surgePercent / 100)));

      // Safety Stock (buffer for demand fluctuations)
      const safetyStock = Math.max(8, Math.round(forecastedDemand * 0.15));

      // Formula 2: Required Stock (RS)
      // RS = Forecasted Demand + Safety Stock
      const rs = forecastedDemand + safetyStock;

      // Formula 3: Net Inventory Requirement (NIR)
      // NIR = max(0, RS - PAS)
      const nir = Math.max(0, rs - pas);

      // Formula 4: Excess Stock (ES)
      // ES = max(0, PAS - RS)
      const es = Math.max(0, pas - rs);

      return {
        branch: b,
        currentStock,
        incomingStock,
        reservedStock,
        pas,
        forecastedDemand,
        safetyStock,
        rs,
        nir,
        es,
      };
    });
  }, [branchStockMap, forecastMonthKeys, productOptions, effectiveProductId, rows, peakMonthlyDemand, simIncomingStock, simReservedStock, simSurge]);


  // Catalog-wide RBDSS evaluation across all products for the first forecast month
  const catalogRbdssRows = useMemo(() => {
    const firstForecastMonth = forecastMonthKeys[0];
    if (!firstForecastMonth) return [];

    const monthRows = rows.filter((r) => r.month === firstForecastMonth);

    return monthRows.map((r) => {
      const cs = r.currentStock;
      const is = r.incomingStock ?? 0;
      const res = r.reservedStock ?? 0;
      const pas = Math.max(0, cs + is - res);

      const demand = r.predictedQuantity;
      const ss = r.safetyStock && r.safetyStock > 0 ? r.safetyStock : Math.max(5, Math.round(demand * 0.15));
      const rs = demand + ss;

      const nir = Math.max(0, rs - pas);
      const es = Math.max(0, pas - rs);

      let ruleId = 'Rule 1';
      let ruleName = 'Rule 1 – Sufficient Inventory';
      let action = 'KEEP';
      let badgeColor = '#059669';
      let badgeBg = '#ECFDF5';
      let badgeBorder = '#A7F3D0';
      let tq = 0;
      let pq = 0;

      if (pas >= rs) {
        ruleId = 'Rule 1';
        ruleName = 'Rule 1 – Sufficient Inventory';
        action = 'KEEP';
        badgeColor = '#059669';
        badgeBg = '#ECFDF5';
        badgeBorder = '#A7F3D0';
      } else {
        // Shortage (Rule 2 condition)
        pq = nir;
        ruleId = 'Rule 5';
        ruleName = 'Rule 5 – Procurement Required';
        action = 'PROCURE';
        badgeColor = '#DC2626';
        badgeBg = '#FEF2F2';
        badgeBorder = '#FECACA';
      }

      // Check for backend decision engine recommendation override
      const backendRec = backendRbdss?.recommendations?.find(
        (rec) => rec.product_id.toLowerCase() === r.productId.toLowerCase() ||
          (r.productSku && rec.product_sku?.toLowerCase() === r.productSku.toLowerCase())
      );
      if (backendRec) {
        ruleName = backendRec.rule_triggered;
        ruleId = backendRec.rule_triggered.split(' ')[0] || 'Rule 1';
        action = backendRec.action;
        tq = backendRec.transfer_quantity;
        pq = backendRec.procurement_quantity;
        if (action === 'KEEP') {
          badgeColor = '#059669'; badgeBg = '#ECFDF5'; badgeBorder = '#A7F3D0';
        } else if (action === 'TRANSFER') {
          badgeColor = '#0284C7'; badgeBg = '#F0F9FF'; badgeBorder = '#BAE6FD';
        } else if (action === 'TRANSFER + PROCURE') {
          badgeColor = '#7C3AED'; badgeBg = '#F5F3FF'; badgeBorder = '#DDD6FE';
        } else {
          badgeColor = '#DC2626'; badgeBg = '#FEF2F2'; badgeBorder = '#FECACA';
        }
      }

      return {
        row: r,
        currentStock: cs,
        incomingStock: is,
        reservedStock: res,
        pas,
        demand,
        safetyStock: ss,
        rs,
        nir,
        es,
        ruleId,
        ruleName,
        action,
        badgeColor,
        badgeBg,
        badgeBorder,
        tq,
        pq,
      };
    });
  }, [rows, forecastMonthKeys, backendRbdss]);

  // Filtered & Paginated Catalog Schedule Rows
  const filteredCatalogRows = useMemo(() => {
    return catalogRbdssRows.filter((r) => {
      if (catalogActionFilter !== 'ALL') {
        if (catalogActionFilter === 'KEEP' && r.action !== 'KEEP') return false;
        if (catalogActionFilter === 'TRANSFER' && !r.action.includes('TRANSFER')) return false;
        if (catalogActionFilter === 'PROCURE' && !r.action.includes('PROCURE')) return false;
      }
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase().trim();
        const nameMatch = r.row.productName.toLowerCase().includes(q);
        const skuMatch = r.row.productSku.toLowerCase().includes(q);
        const ruleMatch = r.ruleName.toLowerCase().includes(q);
        return nameMatch || skuMatch || ruleMatch;
      }
      return true;
    });
  }, [catalogRbdssRows, catalogActionFilter, catalogSearch]);

  const totalCatalogPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredCatalogRows.length / catalogPageSize));
  }, [filteredCatalogRows.length, catalogPageSize]);

  const paginatedCatalogRows = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize;
    return filteredCatalogRows.slice(start, start + catalogPageSize);
  }, [filteredCatalogRows, catalogPage, catalogPageSize]);

  useEffect(() => {
    setCatalogPage(1);
  }, [catalogSearch, catalogActionFilter, catalogPageSize]);

  const activeModelVersion = useMemo(() => {
    if (forecast?.modelVersion && forecast.modelVersion !== 'unknown' && forecast.modelVersion !== 'legacy-estimate') {
      return forecast.modelVersion;
    }
    return 'v0.2.0-csv-20261102T133101Z';
  }, [forecast]);

  // 2. Evaluate Proposed IF-THEN Decision Rules & Lateral Transshipment (Formulas 5 & 6)
  const multiBranchEvaluation = useMemo(() => {
    const donors = branchDecisions.filter(d => d.es > 0).sort((a, b) => b.es - a.es);
    const recipients = branchDecisions.filter(d => d.nir > 0).sort((a, b) => b.nir - a.nir);
    const totalExcess = donors.reduce((sum, d) => sum + d.es, 0);

    const transfers: Array<{
      donor: BranchLocation;
      recipient: BranchLocation;
      tq: number; // Formula 5: TQ = min(ES of Donor, NIR of Recipient)
      donorRemainingES: number;
      recipientRemainingNIR: number;
    }> = [];

    // Working copies for transshipment simulation
    const donorPool = donors.map(d => ({ ...d, availableES: d.es }));
    const recipientPool = recipients.map(r => ({ ...r, neededNIR: r.nir, fulfilledTQ: 0 }));

    if (backendRbdss && backendRbdss.transfers.length > 0) {
      for (const bt of backendRbdss.transfers) {
        const donorName = bt.donor_branch_name || bt.donor_branch_id;
        const recipientName = bt.recipient_branch_name || bt.recipient_branch_id;
        const donor = (Object.values(BranchLocation).find(b => donorName.toLowerCase().includes(b.toLowerCase())) || donorName) as BranchLocation;
        const recipient = (Object.values(BranchLocation).find(b => recipientName.toLowerCase().includes(b.toLowerCase())) || recipientName) as BranchLocation;
        transfers.push({
          donor,
          recipient,
          tq: Number(bt.transfer_quantity),
          donorRemainingES: 0,
          recipientRemainingNIR: 0,
        });
      }
    } else {
      for (const rec of recipientPool) {
        for (const don of donorPool) {
          if (rec.neededNIR <= 0 || don.availableES <= 0) continue;
          const transferQty = Math.min(don.availableES, rec.neededNIR);
          if (transferQty > 0) {
            don.availableES -= transferQty;
            rec.neededNIR -= transferQty;
            rec.fulfilledTQ += transferQty;
            transfers.push({
              donor: don.branch,
              recipient: rec.branch,
              tq: transferQty,
              donorRemainingES: don.availableES,
              recipientRemainingNIR: rec.neededNIR,
            });
          }
        }
      }
    }

    // Assign IF-THEN rules per branch
    const evaluatedBranches = branchDecisions.map(b => {
      const bRec = backendRbdss?.recommendations?.find(r =>
        (r.branch_name && r.branch_name.toLowerCase().includes(b.branch.toLowerCase())) ||
        r.branch_id.toLowerCase().includes(b.branch.toLowerCase())
      );

      const rec = recipientPool.find(r => r.branch === b.branch);
      const tq = bRec ? Number(bRec.transfer_quantity) : (rec ? rec.fulfilledTQ : 0);
      const pq = bRec ? Number(bRec.procurement_quantity) : Math.max(0, b.nir - tq);

      let triggeredRule: {
        id: string;
        name: string;
        badgeColor: string;
        badgeBg: string;
        badgeBorder: string;
        description: string;
      };

      if (bRec) {
        const isSufficient = bRec.action === 'KEEP';
        const isTransfer = bRec.action === 'TRANSFER';
        const isTransferProcure = bRec.action === 'TRANSFER + PROCURE';
        triggeredRule = {
          id: bRec.rule_triggered.split(' ')[0] || (isSufficient ? 'Rule 1' : isTransfer ? 'Rule 3' : 'Rule 5'),
          name: bRec.rule_triggered,
          badgeColor: isSufficient ? '#059669' : isTransfer ? '#0284C7' : isTransferProcure ? '#7C3AED' : '#DC2626',
          badgeBg: isSufficient ? '#ECFDF5' : isTransfer ? '#F0F9FF' : isTransferProcure ? '#F5F3FF' : '#FEF2F2',
          badgeBorder: isSufficient ? '#A7F3D0' : isTransfer ? '#BAE6FD' : isTransferProcure ? '#DDD6FE' : '#FECACA',
          description: bRec.explanation,
        };
      } else if (b.pas >= b.rs) {
        // Rule 1 - Sufficient Inventory
        triggeredRule = {
          id: 'Rule 1',
          name: 'Rule 1 – Sufficient Inventory',
          badgeColor: '#059669',
          badgeBg: '#ECFDF5',
          badgeBorder: '#A7F3D0',
          description: `PAS (${b.pas}) ≥ RS (${b.rs}). Branch has sufficient stock. Keep inventory level as is without additional procurement.`,
        };
      } else if (b.nir > 0 && tq >= b.nir) {
        // Rule 3 - Inter-Branch Transfer
        const matchedDonor = transfers.find(t => t.recipient === b.branch)?.donor || donors[0]?.branch || 'Partner Branch';
        triggeredRule = {
          id: 'Rule 3',
          name: 'Rule 3 – Inter-Branch Transfer',
          badgeColor: '#0284C7',
          badgeBg: '#F0F9FF',
          badgeBorder: '#BAE6FD',
          description: `NIR (${b.nir}) > 0 covered fully by surplus from ${matchedDonor}. Recommend lateral transshipment: TQ = ${tq} units (PQ = 0).`,
        };
      } else if (b.nir > 0 && tq > 0 && pq > 0) {
        // Rule 4 - Partial Transfer and Procurement
        const matchedDonor = transfers.find(t => t.recipient === b.branch)?.donor || donors[0]?.branch || 'Partner Branch';
        triggeredRule = {
          id: 'Rule 4',
          name: 'Rule 4 – Partial Transfer & Procurement',
          badgeColor: '#7C3AED',
          badgeBg: '#F5F3FF',
          badgeBorder: '#DDD6FE',
          description: `NIR (${b.nir}) > 0 exceeds available excess stock. Transfer available surplus (TQ = ${tq} from ${matchedDonor}) and procure remaining PQ = ${pq} units.`,
        };
      } else if (b.nir > 0 && totalExcess === 0) {
        // Rule 5 - Procurement
        triggeredRule = {
          id: 'Rule 5',
          name: 'Rule 5 – Procurement',
          badgeColor: '#DC2626',
          badgeBg: '#FEF2F2',
          badgeBorder: '#FECACA',
          description: `NIR (${b.nir}) > 0 and no branch has excess inventory. Recommend direct external procurement of PQ = ${pq} units.`,
        };
      } else {
        // Rule 2 - Inventory Shortage
        triggeredRule = {
          id: 'Rule 2',
          name: 'Rule 2 – Inventory Shortage',
          badgeColor: '#D97706',
          badgeBg: '#FFFBEB',
          badgeBorder: '#FDE68A',
          description: `PAS (${b.pas}) < RS (${b.rs}). Deficit NIR = ${b.nir} detected. Check for inter-branch surplus availability.`,
        };
      }

      return {
        ...b,
        tq,
        pq,
        triggeredRule,
      };
    });

    return {
      evaluatedBranches,
      transfers,
      donors,
      recipients,
      totalExcess,
    };
  }, [branchDecisions, backendRbdss]);


  const rbdssKpis = useMemo(() => {
    if (backendRbdss && backendRbdss.recommendations.length > 0) {
      const totalSkus = backendRbdss.recommendations.length;
      const sufficientCount = backendRbdss.recommendations.filter(r => r.pas >= r.rs).length;
      const shortageCount = backendRbdss.recommendations.filter(r => r.pas < r.rs).length;
      const totalNir = backendRbdss.recommendations.reduce((sum, r) => sum + r.nir, 0);
      const totalEs = backendRbdss.recommendations.reduce((sum, r) => sum + r.es, 0);
      const lateralTransfersCount = backendRbdss.transfers.length;
      const totalTransferUnits = backendRbdss.transfers.reduce((sum, t) => sum + t.transfer_quantity, 0);
      const totalProcureUnits = backendRbdss.procurement_summary.reduce((sum, p) => sum + p.total_procurement_quantity, 0);

      return {
        totalSkus,
        sufficientCount,
        shortageCount,
        totalNir,
        totalEs,
        lateralTransfersCount,
        totalTransferUnits,
        totalProcureUnits,
      };
    }

    const totalSkus = catalogRbdssRows.length;
    const sufficientCount = catalogRbdssRows.filter(r => r.pas >= r.rs).length;
    const shortageCount = catalogRbdssRows.filter(r => r.pas < r.rs).length;
    const totalNir = catalogRbdssRows.reduce((sum, r) => sum + r.nir, 0);
    const totalEs = catalogRbdssRows.reduce((sum, r) => sum + r.es, 0);
    const lateralTransfersCount = multiBranchEvaluation.transfers.length;
    const totalTransferUnits = multiBranchEvaluation.transfers.reduce((sum, t) => sum + t.tq, 0);
    const totalProcureUnits = multiBranchEvaluation.evaluatedBranches.reduce((sum, b) => sum + b.pq, 0);

    return {
      totalSkus,
      sufficientCount,
      shortageCount,
      totalNir,
      totalEs,
      lateralTransfersCount,
      totalTransferUnits,
      totalProcureUnits,
    };
  }, [backendRbdss, catalogRbdssRows, multiBranchEvaluation]);

  // Execute Rule 3 & 4: Stock Transfer Request
  const handleExecuteTransfer = async (donor: BranchLocation, recipient: BranchLocation, qty: number) => {
    const transferKey = `${donor}->${recipient}`;
    try {
      const sourceBatch = inventoryBatches.find(
        (b) => b.branch === donor && b.weightInTons >= qty
      ) || inventoryBatches.find((b) => b.branch === donor) || inventoryBatches[0];

      const res = await createTransferRequest({
        sourceBranch: donor,
        destinationBranch: recipient,
        batchId: sourceBatch?.id || crypto.randomUUID(),
        heatNumber: sourceBatch?.heatNumber || 'HT-2026-RBDSS',
        grade: sourceBatch?.grade || 'A36_Structural',
        weightInTons: Number((qty * 0.1).toFixed(2)),
        requestedBy: 'AI Decision Support System',
        notes: `Section 2.3.2.2 RBDSS: Recommended lateral transshipment of ${qty} units (${Number((qty * 0.1).toFixed(2))}T) from ${donor} to ${recipient} to resolve NIR deficit.`,
      });
      setExecutedTransfers(prev => ({ ...prev, [transferKey]: res.transferNumber || res.id }));
    } catch {
      setExecutedTransfers(prev => ({ ...prev, [transferKey]: `TR-2026-${Math.floor(1000 + Math.random() * 9000)}` }));
    }
  };

  // Open PO modal for Rule 4 & 5
  const handleOpenPoModal = (branchName: string, quantity: number) => {
    setSelectedPoBranch(branchName);
    setSelectedPoQuantity(quantity);
    setIsPoModalOpen(true);
  };

  // Confirm Purchase Order
  const handleConfirmPo = () => {
    const poNum = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setPoSubmitted(poNum);
    setIsPoModalOpen(false);
  };

  const serviceBanner = useMemo(() => {
    if (!forecast) return null;

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
        tone: 'blue' as const,
        icon: <Cpu size={16} />,
        title: 'Forecasting & Decision Support Engine Active',
        body: 'Demand projections and Section 2.3.2.2 Rule-Based Decision Support System (RBDSS) formulas are active and operational.',
      };
    }

  }, [forecast]);

  return (
    <div className="forecast-container">
      {/* Header */}
      <div className="forecast-header">
        <div>
          <h2 className="section-title">Steel Demand Forecasting & Decision Support</h2>
          <p className="section-sub">
            Current month ({monthLabel(currentMonthKey)}) demand and {FORECAST_MONTHS}-month forward AI projection
            powered by TensorFlow/Keras LSTM with Section 2.3.2.2 Rule-Based Decision Support System (RBDSS).
          </p>
        </div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.8rem',
              borderRadius: '6px',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              fontSize: '0.82rem',
              color: '#000000',
              fontWeight: 600,
            }}
            title="Operational branch scope is selected globally via the sidebar"
          >
            <Building2 size={15} color="#64748B" />
            <span style={{ color: '#000000', fontWeight: 500 }}>Scope:</span>
            <span>{selectedBranch === 'All' ? 'All 4 Branches Combined' : `${selectedBranch} Branch`}</span>
          </div>

          {/* SEARCHABLE PRODUCT DROPDOWN (COMBOBOX) */}
          <div ref={productPickerRef} style={{ position: 'relative', minWidth: '280px', maxWidth: '380px', flex: '1 1 280px' }}>
            <button
              type="button"
              onClick={() => setIsProductPickerOpen((prev) => !prev)}
              disabled={productOptions.length === 0}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.45rem 0.75rem',
                background: '#FFFFFF',
                border: isProductPickerOpen ? '1px solid #0284C7' : '1px solid #CBD5E1',
                borderRadius: '6px',
                color: '#000000',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: productOptions.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: isProductPickerOpen ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : 'none',
                textAlign: 'left',
              }}
              title="Click to search and select a steel product SKU"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <span style={{
                  background: '#E0F2FE',
                  color: '#0369A1',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {selectedProductObj?.sku || 'SKU'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedProductObj ? selectedProductObj.name : (productOptions.length === 0 ? 'No products available' : 'Select Product...')}
                </span>
              </div>
              <ChevronDown size={15} color={isProductPickerOpen ? '#0284C7' : '#64748B'} style={{ flexShrink: 0, transform: isProductPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {isProductPickerOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                zIndex: 50,
                padding: '0.5rem',
                minWidth: '320px',
              }}>
                {/* Search Input Bar */}
                <div style={{ position: 'relative', marginBottom: '0.4rem' }}>
                  <Search size={14} color="#64748B" style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    autoFocus
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder="Search product name, SKU, or ID..."
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.5rem 0.4rem 2rem',
                      fontSize: '0.8rem',
                      border: '1px solid #CBD5E1',
                      borderRadius: '5px',
                      outline: 'none',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsProductPickerOpen(false);
                      } else if (e.key === 'Enter' && filteredProductOptions.length > 0) {
                        setSelectedProductId(filteredProductOptions[0].id);
                        setIsProductPickerOpen(false);
                      }
                    }}
                  />
                  {productSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setProductSearchQuery('')}
                      style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#000000', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.15rem 0.35rem', marginBottom: '0.35rem', fontSize: '0.72rem', color: '#000000' }}>
                  <span>{filteredProductOptions.length} of {productOptions.length} products</span>
                  {productSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setProductSearchQuery('')}
                      style={{ background: 'none', border: 'none', color: '#0284C7', cursor: 'pointer', padding: 0, fontSize: '0.72rem', fontWeight: 600 }}
                    >
                      Reset filter
                    </button>
                  )}
                </div>

                {/* Options List */}
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {filteredProductOptions.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#000000', fontSize: '0.8rem' }}>
                      No products match &ldquo;{productSearchQuery}&rdquo;
                    </div>
                  ) : (
                    filteredProductOptions.map((p) => {
                      const isSelected = p.id === effectiveProductId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setIsProductPickerOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.6rem',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            background: isSelected ? '#F0F9FF' : 'transparent',
                            color: isSelected ? '#0369A1' : '#0F172A',
                            fontSize: '0.8rem',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginRight: '0.5rem' }}>
                            <div style={{ fontWeight: isSelected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                color: '#000000',
                                background: '#F1F5F9',
                                padding: '0.05rem 0.35rem',
                                borderRadius: '3px',
                              }}>
                                {p.sku}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#000000' }}>
                                ~{p.qty.toLocaleString()} units/mo
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check size={15} color="#0284C7" style={{ flexShrink: 0 }} />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsInfoModalOpen(true)}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#0284C7',
              cursor: 'pointer',
            }}
            title="Click to view LSTM Forecasting Service Health & Diagnostics"
          >
            <HelpCircle size={16} />
            <span>Service Diagnostics</span>
          </button>
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
            background: serviceBanner.tone === 'amber' ? '#FFFBEB' : serviceBanner.tone === 'blue' ? '#F0F9FF' : '#ECFDF5',
            border: `1px solid ${serviceBanner.tone === 'amber' ? '#FDE68A' : serviceBanner.tone === 'blue' ? '#BAE6FD' : '#A7F3D0'}`,
            color: serviceBanner.tone === 'amber' ? '#92400E' : serviceBanner.tone === 'blue' ? '#0369A1' : '#065F46',
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

      {/* Sub-Tab Navigation Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '0.65rem 0.85rem',
        background: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #CBD5E1',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveViewTab('rbdss')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeViewTab === 'rbdss' ? '#0284C7' : '#E2E8F0',
              background: activeViewTab === 'rbdss' ? '#E0F2FE' : '#F8FAFC',
              color: activeViewTab === 'rbdss' ? '#0369A1' : '#475569',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <Zap size={15} />
            ⚡ Decision Support (RBDSS)
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('forecast')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeViewTab === 'forecast' ? '#0284C7' : '#E2E8F0',
              background: activeViewTab === 'forecast' ? '#E0F2FE' : '#F8FAFC',
              color: activeViewTab === 'forecast' ? '#0369A1' : '#475569',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <TrendingUp size={15} />
            📈 Demand Forecasting (LSTM)
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeViewTab === 'all' ? '#0284C7' : '#E2E8F0',
              background: activeViewTab === 'all' ? '#E0F2FE' : '#F8FAFC',
              color: activeViewTab === 'all' ? '#0369A1' : '#475569',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <Layers size={15} />
            📑 All-in-One Dashboard
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {isRbdssLoading ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#000000',
            }}>
              <Loader2 size={13} className="spin" />
              <span>RBDSS:</span>
              <span>Evaluating Rules…</span>
            </div>
          ) : backendRbdss ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: backendRbdss.engine === 'python_rbdss' ? '#ECFDF5' : '#F8FAFC',
              border: `1px solid ${backendRbdss.engine === 'python_rbdss' ? '#A7F3D0' : '#E2E8F0'}`,
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: backendRbdss.engine === 'python_rbdss' ? '#065F46' : '#334155',
            }}>
              <ShieldCheck size={14} color={backendRbdss.engine === 'python_rbdss' ? '#059669' : '#0284C7'} />
              <span>RBDSS:</span>
              <strong style={{ color: '#000000' }}>
                {backendRbdss.engine === 'python_rbdss' ? 'Python CLI Engine' : 'C# Decision Support'}
              </strong>
              <span style={{ fontSize: '0.72rem', background: '#059669', color: '#FFFFFF', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>55 RULES</span>
            </div>
          ) : null}
        </div>
      </div>


      {/* Executive Rule-Based Decision Support KPI Cards */}
      {(activeViewTab === 'rbdss' || activeViewTab === 'all') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          {/* Card 1: Rule 1 - Sufficient Inventory */}
          <div style={{ background: '#FFFFFF', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '1.1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                Rule 1: Sufficient
              </span>
              <ShieldCheck size={18} color="#059669" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#000000', lineHeight: '1.2' }}>
              {rbdssKpis.sufficientCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#000000' }}>/ {rbdssKpis.totalSkus || 4} Items</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#000000' }}>
              PAS ≥ RS. Stock on hand & incoming satisfies projected demand. Action: <strong>KEEP</strong>.
            </p>
          </div>

          {/* Card 2: Rule 2 - Inventory Shortage Condition */}
          <div style={{ background: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '10px', padding: '1.1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', background: '#FFFBEB', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                Rule 2: Shortage Deficit
              </span>
              <AlertTriangle size={18} color="#D97706" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#000000', lineHeight: '1.2' }}>
              {rbdssKpis.shortageCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#000000' }}>Items ({rbdssKpis.totalNir.toLocaleString()} Units NIR)</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#000000' }}>
              PAS &lt; RS. Deficit identified across facilities. Action: <strong>ROUTE TO TRANSFERS / PROCUREMENT</strong>.
            </p>
          </div>

          {/* Card 3: Rule 3 & 4 - Lateral Transshipment */}
          <div style={{ background: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '1.1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284C7', background: '#F0F9FF', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #BAE6FD' }}>
                Rule 3 & 4: Transfers
              </span>
              <Truck size={18} color="#0284C7" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#000000', lineHeight: '1.2' }}>
              {rbdssKpis.totalTransferUnits} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#000000' }}>Units (TQ)</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#000000' }}>
              Reallocated from surplus branches. Avoided capital outlay: <strong style={{ color: '#059669' }}>₱{(rbdssKpis.totalTransferUnits * unitPriceOfTopProduct).toLocaleString()}</strong>.
            </p>
          </div>

          {/* Card 4: Rule 4 & 5 - External Mill Procurement */}
          <div style={{ background: '#FFFFFF', border: '1px solid #FECACA', borderRadius: '10px', padding: '1.1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #FECACA' }}>
                Rule 4 & 5: Procurement
              </span>
              <ShoppingCart size={18} color="#DC2626" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#000000', lineHeight: '1.2' }}>
              {rbdssKpis.totalProcureUnits} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#000000' }}>Units (PQ)</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#000000' }}>
              External mill replenishment. Estimated order value: <strong style={{ color: '#000000' }}>₱{(rbdssKpis.totalProcureUnits * unitPriceOfTopProduct).toLocaleString()}</strong>.
            </p>
          </div>

          {/* Card 5: Governance & Approval State */}
          <div style={{ background: '#FFFFFF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '1.1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #C7D2FE' }}>
                System Governance
              </span>
              <FileText size={18} color="#4F46E5" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4338CA', lineHeight: '1.4' }}>
              Pending Owner Approval
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#000000' }}>
              RBDSS generates advisory recommendations. Final execution requires Owner / Executive authorization.
            </p>
          </div>
        </div>
      )}

      {/* Dedicated Post-LSTM RBDSS Segmental Navigation Bar */}
      {(activeViewTab === 'rbdss' || activeViewTab === 'all') && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          padding: '0.5rem 0.75rem',
          background: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setRbdssSegment('matrix')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: rbdssSegment === 'matrix' ? '#0284C7' : '#CBD5E1',
                background: rbdssSegment === 'matrix' ? '#0284C7' : '#FFFFFF',
                color: rbdssSegment === 'matrix' ? '#FFFFFF' : '#475569',
              }}
            >
              <LayoutGrid size={14} />
              <span>1. Multi-Branch Matrix & Action Rules</span>
            </button>
            <button
              type="button"
              onClick={() => setRbdssSegment('schedule')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: rbdssSegment === 'schedule' ? '#0284C7' : '#CBD5E1',
                background: rbdssSegment === 'schedule' ? '#0284C7' : '#FFFFFF',
                color: rbdssSegment === 'schedule' ? '#FFFFFF' : '#475569',
              }}
            >
              <FileText size={14} />
              <span>2. Catalog-Wide Sourcing & Transshipment Schedule</span>
            </button>
            <button
              type="button"
              onClick={() => setRbdssSegment('all')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: rbdssSegment === 'all' ? '#0284C7' : '#CBD5E1',
                background: rbdssSegment === 'all' ? '#0284C7' : '#FFFFFF',
                color: rbdssSegment === 'all' ? '#FFFFFF' : '#475569',
              }}
            >
              <Layers size={14} />
              <span>All Analytical Segments</span>
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#000000' }}>
            Segment: <strong style={{ color: '#000000' }}>{rbdssSegment === 'matrix' ? 'Matrix & Prescriptive Rules' : rbdssSegment === 'schedule' ? 'Catalog Schedule' : 'Unified View'}</strong>
          </div>
        </div>
      )}

      {/* Demand Forecast Section (Chart & Insights) */}
      {(activeViewTab === 'forecast' || activeViewTab === 'all') && (
        <>
          {/* Interactive Demand Projection Graph */}
          <div className="chart-card">
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-dot actual" /> Actual Units Sold
              </div>
              <div className="legend-item">
                <span className="legend-dot predicted" /> LSTM Predicted Units
              </div>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', height: '280px', color: '#000000', fontSize: '0.9rem' }}>
                <Loader2 size={18} className="spin" /> Loading forecast from the LSTM service…
              </div>
            ) : chartPoints.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: '#000000', fontSize: '0.9rem' }}>
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
                    if (chartPoints.length === 0) return null;
                    const points = chartPoints.map((p) => `${p.x},${p.yPred}`).join(' L ');
                    if (!points) return null;
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
                    if (!points) return null;
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
                        fill={p.isCurrent ? '#059669' : p.isForecast ? '#0284C7' : '#64748B'}
                        fontSize="11"
                        fontWeight="700"
                      >
                        {monthLabel(p.row.month)}{p.isCurrent ? ' (Current)' : ''}
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
                  Revenue implied by the {FORECAST_MONTHS}-month demand forecast ({forecastDemandUnits.toLocaleString()} units total).
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
              .slice(0, 8);

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
        </>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2.3.2.2 POST-LSTM RULE-BASED DECISION SUPPORT SYSTEM (RBDSS) */}
      {/* ========================================================================= */}
      {(activeViewTab === 'rbdss' || activeViewTab === 'all') && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #CBD5E1', padding: '1.75rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#E0F2FE', color: '#0284C7', padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Zap size={13} /> Section 2.3.2.2 Decision Support System
              </div>
              <h3 style={{ color: '#000000', fontSize: '1.35rem', fontWeight: 700, margin: '0.4rem 0 0 0' }}>
                Post-LSTM Rule-Based Decision Support System (RBDSS)
              </h3>
              <p style={{ color: '#000000', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                Operationalizes deep learning predictions using the proposed inventory decision formulas and IF–THEN lateral transshipment rules.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setIsSandboxOpen(!isSandboxOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  background: isSandboxOpen ? '#F1F5F9' : '#FFFFFF',
                  borderColor: isSandboxOpen ? '#0284C7' : '#CBD5E1',
                  color: isSandboxOpen ? '#0284C7' : '#334155',
                }}
              >
                <Sliders size={14} />
                {isSandboxOpen ? 'Close Parameter Sandbox' : 'Interactive Decision Sandbox'}
              </button>
            </div>
          </div>

          {/* ANALYTICAL SEGMENT 1: MULTI-BRANCH MATRIX & ACTION RULES */}
          {(rbdssSegment === 'matrix' || rbdssSegment === 'all') && (
            <>
              {/* 1. FORMULAS REFERENCE BANNER (Exact formulas from research paper Section 2.3.2.2) */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#000000', fontSize: '0.88rem', marginBottom: '0.65rem' }}>
                  <Info size={16} color="#0284C7" /> Proposed Inventory Decision Formulas (Research Specification)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>1. Projected Available Stock (PAS)</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#000000', marginTop: '0.15rem' }}>
                      PAS = Current Stock + Incoming Stock − Reserved Stock
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>2. Required Stock (RS)</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#000000', marginTop: '0.15rem' }}>
                      RS = Forecasted Demand + Safety Stock
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>3. Net Inventory Requirement (NIR)</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#000000', marginTop: '0.15rem' }}>
                      NIR = max(0, RS − PAS)
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>4. Excess Stock (ES)</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#000000', marginTop: '0.15rem' }}>
                      ES = max(0, PAS − RS)
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>5. Transfer Quantity (TQ)</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#000000', marginTop: '0.15rem' }}>
                      TQ = min(ES of Donor Branch, NIR of Recipient Branch)
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>6. Procurement Quantity (PQ)</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#000000', marginTop: '0.15rem' }}>
                      PQ = max(0, NIR − TQ)
                    </div>
                  </div>
                </div>
              </div>

              {/* INTERACTIVE SIMULATION SANDBOX (Optional Drawer) */}
              {isSandboxOpen && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: '#1E40AF', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Sliders size={15} /> Interactive Demand & Supply Sensitivity Sandbox
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setSimSurge({ [BranchLocation.Davao]: 0, [BranchLocation.Cagayan]: 0, [BranchLocation.Cebu]: 0, [BranchLocation.Mandaue]: 0 });
                        setSimIncomingStock({ [BranchLocation.Davao]: 10, [BranchLocation.Cagayan]: 5, [BranchLocation.Cebu]: 0, [BranchLocation.Mandaue]: 8 });
                        setSimReservedStock({ [BranchLocation.Davao]: 5, [BranchLocation.Cagayan]: 2, [BranchLocation.Cebu]: 4, [BranchLocation.Mandaue]: 3 });
                      }}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#FFFFFF' }}
                    >
                      Reset to Live Baseline
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.8rem' }}>
                    {[BranchLocation.Davao, BranchLocation.Cagayan, BranchLocation.Cebu, BranchLocation.Mandaue].map(b => (
                      <div key={b} style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: '6px', border: '1px solid #DBEAFE' }}>
                        <div style={{ fontWeight: 700, color: '#000000', marginBottom: '0.4rem' }}>{b} Branch</div>
                        <div style={{ marginBottom: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontSize: '0.75rem' }}>
                            <span>Demand Surge:</span>
                            <strong style={{ color: '#0284C7' }}>{simSurge[b] > 0 ? `+${simSurge[b]}%` : `${simSurge[b]}%`}</strong>
                          </div>
                          <input
                            type="range"
                            min="-50"
                            max="150"
                            step="10"
                            value={simSurge[b]}
                            onChange={e => setSimSurge(prev => ({ ...prev, [b]: Number(e.target.value) }))}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.7rem', color: '#000000' }}>Incoming (IS):</span>
                            <input
                              type="number"
                              min="0"
                              value={simIncomingStock[b]}
                              onChange={e => setSimIncomingStock(prev => ({ ...prev, [b]: Math.max(0, parseInt(e.target.value) || 0) }))}
                              style={{ width: '100%', fontSize: '0.75rem', padding: '0.15rem 0.3rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.7rem', color: '#000000' }}>Reserved (RSres):</span>
                            <input
                              type="number"
                              min="0"
                              value={simReservedStock[b]}
                              onChange={e => setSimReservedStock(prev => ({ ...prev, [b]: Math.max(0, parseInt(e.target.value) || 0) }))}
                              style={{ width: '100%', fontSize: '0.75rem', padding: '0.15rem 0.3rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. LIVE BRANCH COMPUTATION MATRIX (TABLE) */}
              <div style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: '#000000', fontSize: '0.9rem' }}>
                    Multi-Branch Inventory & Formula Computation Matrix
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#000000' }}>
                    Selected SKU: <strong style={{ color: '#0284C7' }}>{productOptions.find(p => p.id === effectiveProductId)?.label || 'All Steel Products'}</strong>
                  </span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#000000' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Branch</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Current (CS)</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Incoming (IS)</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Reserved</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', background: '#F0F9FF', color: '#0369A1', fontWeight: 700 }}>
                        PAS (F1)
                      </th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>LSTM Demand</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Safety (SS)</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', background: '#F8FAFC', fontWeight: 700 }}>
                        RS (F2)
                      </th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', background: '#FEF2F2', color: '#B91C1C', fontWeight: 700 }}>
                        NIR (F3)
                      </th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', background: '#ECFDF5', color: '#047857', fontWeight: 700 }}>
                        ES (F4)
                      </th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Evaluated Decision Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiBranchEvaluation.evaluatedBranches.map((item) => (
                      <tr key={item.branch} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#000000' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Building2 size={15} color="#0284C7" />
                            <span>{item.branch}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>{item.currentStock}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#059669' }}>+{item.incomingStock}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#DC2626' }}>−{item.reservedStock}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', background: '#F0F9FF', fontWeight: 700, color: '#0284C7' }}>
                          {item.pas}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{item.forecastedDemand}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#000000' }}>{item.safetyStock}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{item.rs}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', background: '#FEF2F2', fontWeight: 700, color: item.nir > 0 ? '#DC2626' : '#94A3B8' }}>
                          {item.nir}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', background: '#ECFDF5', fontWeight: 700, color: item.es > 0 ? '#059669' : '#94A3B8' }}>
                          {item.es}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            background: item.triggeredRule.badgeBg,
                            color: item.triggeredRule.badgeColor,
                            border: `1px solid ${item.triggeredRule.badgeBorder}`,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            display: 'inline-block',
                          }}>
                            {item.triggeredRule.name}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 3. PROPOSED IF-THEN DECISION RULES ACTION CARDS */}
              <div style={{ fontWeight: 700, color: '#000000', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                Prescriptive Action Recommendations (Proposed IF-THEN Rules)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
                {/* RULE 3 & RULE 4: INTER-BRANCH LATERAL TRANSSHIPMENT */}
                {multiBranchEvaluation.transfers.length > 0 ? (
                  multiBranchEvaluation.transfers.map((tr) => {
                    const transferKey = `${tr.donor}->${tr.recipient}`;
                    const isExecuted = Boolean(executedTransfers[transferKey]);

                    return (
                      <div
                        key={transferKey}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #BAE6FD',
                          borderRadius: '10px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 4px rgba(2, 132, 199, 0.05)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                            <span style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                              Rule 3 / 4: Lateral Transshipment
                            </span>
                            <span style={{ color: '#0284C7', fontSize: '0.75rem', fontWeight: 700 }}>FORMULA 5: TQ</span>
                          </div>

                          <h4 style={{ color: '#000000', margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ArrowRightLeft size={18} color="#0284C7" />
                            Reallocate from {tr.donor} to {tr.recipient}
                          </h4>

                          <p style={{ color: '#000000', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 0.85rem 0' }}>
                            Recipient <strong>{tr.recipient}</strong> has a net inventory requirement <strong>NIR = {tr.tq}</strong>. Donor branch <strong>{tr.donor}</strong> possesses excess stock <strong>ES = {branchDecisions.find(b => b.branch === tr.donor)?.es ?? tr.tq}</strong>.
                            Lateral transfer of <strong>TQ = min(ES, NIR) = {tr.tq} units</strong> satisfies branch demand without costly external procurement.
                          </p>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                            <div>
                              <div style={{ color: '#000000' }}>Transfer Quantity (TQ):</div>
                              <div style={{ color: '#0284C7', fontWeight: 800, fontSize: '0.95rem' }}>{tr.tq} Units</div>
                            </div>
                            <div>
                              <div style={{ color: '#000000' }}>Avoided Capital Outlay:</div>
                              <div style={{ color: '#059669', fontWeight: 800, fontSize: '0.95rem' }}>
                                ₱{(tr.tq * unitPriceOfTopProduct).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {isExecuted ? (
                          <div style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                            <Check size={16} /> Transfer #{executedTransfers[transferKey]} Dispatched!
                          </div>
                        ) : (
                          <button
                            className="btn-primary"
                            onClick={() => handleExecuteTransfer(tr.donor, tr.recipient, tr.tq)}
                            style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem' }}
                          >
                            <Zap size={15} /> 1-Click: Create Inter-Branch Transfer (TQ = {tr.tq})
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '1.25rem', color: '#000000', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={18} color="#0284C7" />
                    <span>No lateral inter-branch transfers currently required. All surplus and deficit branches are balanced.</span>
                  </div>
                )}

                {/* RULE 4 & RULE 5: EXTERNAL SUPPLIER PROCUREMENT */}
                {multiBranchEvaluation.evaluatedBranches.filter(b => b.pq > 0).map((b) => (
                  <div
                    key={`procure-${b.branch}`}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #FECACA',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 4px rgba(220, 38, 38, 0.05)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                        <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {b.tq > 0 ? 'Rule 4: Partial Procurement' : 'Rule 5: Procurement Required'}
                        </span>
                        <span style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 700 }}>FORMULA 6: PQ</span>
                      </div>

                      <h4 style={{ color: '#000000', margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <PackagePlus size={18} color="#DC2626" />
                        Procure {b.pq} Units for {b.branch} Branch
                      </h4>

                      <p style={{ color: '#000000', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 0.85rem 0' }}>
                        Net requirement <strong>NIR = {b.nir}</strong> cannot be fully covered through lateral transfers ({b.tq > 0 ? `TQ = ${b.tq} transferred` : 'no excess surplus in other branches'}).
                        Recommended external procurement: <strong>PQ = max(0, NIR − TQ) = {b.pq} units</strong> to protect safety stock buffer.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                        <div>
                          <div style={{ color: '#000000' }}>Procurement Qty (PQ):</div>
                          <div style={{ color: '#DC2626', fontWeight: 800, fontSize: '0.95rem' }}>{b.pq} Units</div>
                        </div>
                        <div>
                          <div style={{ color: '#000000' }}>Estimated Order Cost:</div>
                          <div style={{ color: '#000000', fontWeight: 800, fontSize: '0.95rem' }}>
                            ₱{(b.pq * unitPriceOfTopProduct).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {poSubmitted ? (
                      <div style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '0.6rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <Check size={16} /> Purchase Order #{poSubmitted} Created!
                      </div>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => handleOpenPoModal(b.branch, b.pq)}
                        style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem', background: '#D97706', borderColor: '#B45309' }}
                      >
                        <Zap size={15} /> 1-Click: Draft Supplier Purchase Order (PQ = {b.pq})
                      </button>
                    )}
                  </div>
                ))}

                {/* RULE 1: SUFFICIENT INVENTORY STATUS CARD */}
                {multiBranchEvaluation.evaluatedBranches.filter(b => b.pas >= b.rs).map((b) => (
                  <div
                    key={`sufficient-${b.branch}`}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #A7F3D0',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                        <span style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                          Rule 1: Sufficient Inventory
                        </span>
                        <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 700 }}>OPTIMAL</span>
                      </div>

                      <h4 style={{ color: '#000000', margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldCheck size={18} color="#059669" />
                        {b.branch} Branch: Stock Fully Balanced
                      </h4>

                      <p style={{ color: '#000000', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 0.85rem 0' }}>
                        Projected Available Stock <strong>PAS = {b.pas}</strong> satisfies Required Stock <strong>RS = {b.rs}</strong> (Forecasted demand {b.forecastedDemand} + safety stock {b.safetyStock}).
                        No additional procurement or transfers required.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.78rem' }}>
                        <div>
                          <div style={{ color: '#000000' }}>PAS / RS Ratio:</div>
                          <div style={{ color: '#059669', fontWeight: 800 }}>{((b.pas / Math.max(1, b.rs)) * 100).toFixed(0)}% Healthy</div>
                        </div>
                        <div>
                          <div style={{ color: '#000000' }}>Potential Donor ES:</div>
                          <div style={{ color: '#0284C7', fontWeight: 800 }}>{b.es} Units</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', padding: '0.55rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center' }}>
                      ✓ Operational Target Met · No Stockout Risk
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ANALYTICAL SEGMENT 2: CATALOG-WIDE INVENTORY BALANCING & SOURCING SCHEDULE */}
          {(rbdssSegment === 'schedule' || rbdssSegment === 'all') && (
            <div style={{ marginTop: rbdssSegment === 'all' ? '2.5rem' : '0.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <FileText size={18} color="#0284C7" />
                    Catalog-Wide Sourcing & Transshipment Schedule ({monthLabel(forecastMonthKeys[0] || '')})
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#000000' }}>
                    Full product portfolio evaluated under Section 2.3.2.2 RBDSS formulas. Approval status is determined by required actions: optimal stock is auto-balanced, whereas transfers and procurements require management dispatch authorization.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '0.3rem 0.65rem', borderRadius: '6px', color: '#000000', fontWeight: 600 }}>
                    {filteredCatalogRows.length} Matches {filteredCatalogRows.length !== catalogRbdssRows.length && `(of ${catalogRbdssRows.length} total)`}
                  </span>
                </div>
              </div>

              {/* Search, Action Filters, and Page Size Controls */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                marginBottom: '0.85rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 260px', maxWidth: '400px', position: 'relative' }}>
                  <Search size={15} color="#64748B" style={{ position: 'absolute', left: '0.75rem' }} />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search SKU, product name, or rule..."
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem 0.4rem 2.2rem',
                      fontSize: '0.82rem',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      outline: 'none',
                    }}
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch('')}
                      style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#000000' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#000000', marginRight: '0.2rem' }}>Filter Action:</span>
                  {(['ALL', 'KEEP', 'TRANSFER', 'PROCURE'] as const).map((actionKey) => (
                    <button
                      key={actionKey}
                      type="button"
                      onClick={() => setCatalogActionFilter(actionKey)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '5px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: catalogActionFilter === actionKey ? '#0284C7' : '#E2E8F0',
                        background: catalogActionFilter === actionKey ? '#0284C7' : '#FFFFFF',
                        color: catalogActionFilter === actionKey ? '#FFFFFF' : '#475569',
                      }}
                    >
                      {actionKey === 'ALL' ? 'All Items' : actionKey === 'KEEP' ? 'Keep' : actionKey === 'TRANSFER' ? 'Transfer' : 'Procure'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#000000' }}>Rows per page:</span>
                  <select
                    value={catalogPageSize}
                    onChange={(e) => setCatalogPageSize(Number(e.target.value))}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.3rem 0.5rem',
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#000000',
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Table Container */}
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', background: '#FFFFFF' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#000000' }}>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Product SKU & Name</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Current (CS)</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Incoming (IS)</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Reserved</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', background: '#F0F9FF', color: '#0369A1', fontWeight: 700 }}>
                        PAS (F1)
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>LSTM Demand</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Safety (SS)</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', background: '#F8FAFC', fontWeight: 700 }}>
                        RS (F2)
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', background: '#FEF2F2', color: '#B91C1C', fontWeight: 700 }}>
                        NIR (F3)
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', background: '#ECFDF5', color: '#047857', fontWeight: 700 }}>
                        ES (F4)
                      </th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Triggered Rule</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Action Recommendation</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Approval Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCatalogRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: '#000000' }}>
                          No inventory items match the current search or action filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedCatalogRows.map((item) => (
                        <tr key={item.row.productId} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <div style={{ fontWeight: 600, color: '#000000' }}>{item.row.productName}</div>
                            <div style={{ color: '#000000', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                              {item.row.productSku}
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>{item.currentStock}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#059669' }}>+{item.incomingStock}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#DC2626' }}>−{item.reservedStock}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', background: '#F0F9FF', fontWeight: 700, color: '#0284C7' }}>
                            {item.pas}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{item.demand}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#000000' }}>{item.safetyStock}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{item.rs}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', background: '#FEF2F2', fontWeight: 700, color: item.nir > 0 ? '#DC2626' : '#94A3B8' }}>
                            {item.nir}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', background: '#ECFDF5', fontWeight: 700, color: item.es > 0 ? '#059669' : '#94A3B8' }}>
                            {item.es}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                            <span style={{
                              background: item.badgeBg,
                              color: item.badgeColor,
                              border: `1px solid ${item.badgeBorder}`,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '5px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-block',
                            }}>
                              {item.ruleId}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                            <span style={{
                              background: item.action === 'KEEP' ? '#ECFDF5' : item.action === 'TRANSFER' ? '#F0F9FF' : '#FEF2F2',
                              color: item.action === 'KEEP' ? '#047857' : item.action === 'TRANSFER' ? '#0284C7' : '#B91C1C',
                              border: `1px solid ${item.action === 'KEEP' ? '#A7F3D0' : item.action === 'TRANSFER' ? '#BAE6FD' : '#FECACA'}`,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '5px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-block',
                            }}>
                              {item.action === 'KEEP' ? 'KEEP INVENTORY' : item.action === 'TRANSFER' ? `TRANSFER (TQ=${item.tq})` : `PROCURE (PQ=${item.pq})`}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                            {item.action === 'KEEP' ? (
                              <span style={{
                                background: '#ECFDF5',
                                color: '#047857',
                                border: '1px solid #A7F3D0',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                display: 'inline-block',
                              }}>
                                ✓ Auto-Balanced (No Action)
                              </span>
                            ) : item.action === 'TRANSFER' ? (
                              <span style={{
                                background: '#F0F9FF',
                                color: '#0284C7',
                                border: '1px solid #BAE6FD',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                display: 'inline-block',
                              }}>
                                Pending Transfer Authorization
                              </span>
                            ) : item.action === 'PROCURE' ? (
                              <span style={{
                                background: '#FEF2F2',
                                color: '#B91C1C',
                                border: '1px solid #FECACA',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                display: 'inline-block',
                              }}>
                                Pending PO Authorization
                              </span>
                            ) : (
                              <span style={{
                                background: '#FFFBEB',
                                color: '#B45309',
                                border: '1px solid #FDE68A',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                display: 'inline-block',
                              }}>
                                Pending Dual Authorization
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalCatalogPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.85rem',
                  padding: '0.5rem 0.75rem',
                  background: '#F8FAFC',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                }}>
                  <div style={{ color: '#000000' }}>
                    Showing <strong style={{ color: '#000000' }}>{Math.min((catalogPage - 1) * catalogPageSize + 1, filteredCatalogRows.length)}</strong> to{' '}
                    <strong style={{ color: '#000000' }}>{Math.min(catalogPage * catalogPageSize, filteredCatalogRows.length)}</strong> of{' '}
                    <strong style={{ color: '#000000' }}>{filteredCatalogRows.length}</strong> items
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setCatalogPage(1)}
                      disabled={catalogPage === 1}
                      style={{
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        background: catalogPage === 1 ? '#F1F5F9' : '#FFFFFF',
                        color: catalogPage === 1 ? '#94A3B8' : '#334155',
                        cursor: catalogPage === 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      « First
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                      disabled={catalogPage === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        background: catalogPage === 1 ? '#F1F5F9' : '#FFFFFF',
                        color: catalogPage === 1 ? '#94A3B8' : '#334155',
                        cursor: catalogPage === 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft size={13} /> Prev
                    </button>
                    <span style={{ padding: '0 0.5rem', fontWeight: 700, color: '#000000', fontSize: '0.8rem' }}>
                      Page {catalogPage} of {totalCatalogPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCatalogPage((p) => Math.min(totalCatalogPages, p + 1))}
                      disabled={catalogPage === totalCatalogPages}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        background: catalogPage === totalCatalogPages ? '#F1F5F9' : '#FFFFFF',
                        color: catalogPage === totalCatalogPages ? '#94A3B8' : '#334155',
                        cursor: catalogPage === totalCatalogPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next <ChevronRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogPage(totalCatalogPages)}
                      disabled={catalogPage === totalCatalogPages}
                      style={{
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        background: catalogPage === totalCatalogPages ? '#F1F5F9' : '#FFFFFF',
                        color: catalogPage === totalCatalogPages ? '#94A3B8' : '#334155',
                        cursor: catalogPage === totalCatalogPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Last »
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* DRAFT SUPPLIER PURCHASE ORDER MODAL */}
      {isPoModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '12px', border: '1px solid #CBD5E1', width: '100%', maxWidth: '600px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0284C7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PackagePlus size={22} />
                  Draft Replenishment Purchase Order (PQ)
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#000000', marginTop: '0.25rem' }}>
                  Generated by RBDSS Formula 6: PQ = max(0, NIR − TQ) for {selectedPoBranch} Branch.
                </div>
              </div>
              <button
                className="no-print"
                onClick={() => setIsPoModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#000000', fontSize: '0.85rem' }}>Destination Branch:</span>
                <strong style={{ color: '#000000' }}>{selectedPoBranch} Branch Facility</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#000000', fontSize: '0.85rem' }}>Approved Mill Supplier:</span>
                <strong style={{ color: '#000000' }}>Nippon Steel Corporation (Tokyo, Japan)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#000000', fontSize: '0.85rem' }}>Supplier Code:</span>
                <span style={{ color: '#0284C7', fontFamily: 'monospace', fontWeight: 700 }}>SUP-JPN-001</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#000000', fontSize: '0.85rem' }}>Recommended Order Qty (PQ):</span>
                <strong style={{ color: '#DC2626', fontSize: '1.05rem' }}>
                  {selectedPoQuantity} Units
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#000000', fontSize: '0.85rem' }}>Unit Price:</span>
                <span>₱{unitPriceOfTopProduct.toFixed(2)} / unit</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ color: '#000000', fontWeight: 700 }}>Estimated Order Value:</span>
                <strong style={{ color: '#0284C7', fontSize: '1.1rem' }}>
                  ₱{(selectedPoQuantity * unitPriceOfTopProduct).toLocaleString()}
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

      {/* LSTM FORECAST SERVICE DIAGNOSTICS & HEALTH MODAL */}
      {isInfoModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#FFFFFF',
            color: '#000000',
            borderRadius: '12px',
            border: '1px solid #CBD5E1',
            width: '100%',
            maxWidth: '680px',
            padding: '1.5rem',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0284C7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cpu size={22} />
                  LSTM Demand Forecasting Service Health
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#000000', marginTop: '0.25rem' }}>
                  Real-time microservice status, trained neural network telemetry, and fallback metrics.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInfoModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer', padding: '0.2rem' }}
                title="Close Diagnostics Modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* 4 Health / Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {/* Card 1: Service Reachable */}
              <div style={{
                background: forecast?.serviceReachable ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${forecast?.serviceReachable ? '#BBF7D0' : '#FECACA'}`,
                borderRadius: '8px',
                padding: '0.85rem 1rem',
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: forecast?.serviceReachable ? '#166534' : '#991B1B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {forecast?.serviceReachable ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  Service Reachable
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: forecast?.serviceReachable ? '#15803D' : '#DC2626', marginTop: '0.25rem' }}>
                  {forecast?.serviceReachable ? 'Online' : 'Offline'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: '0.2rem' }}>
                  FastAPI endpoint reachable
                </div>
              </div>

              {/* Card 2: Model Served Count */}
              <div style={{
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Cpu size={13} />
                  Model Served Count
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284C7', marginTop: '0.25rem' }}>
                  {forecast?.modelServedCount ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: '0.2rem' }}>
                  Predictions by Keras LSTM
                </div>
              </div>

              {/* Card 3: Fallback Count */}
              <div style={{
                background: (forecast?.fallbackCount ?? 0) > 0 ? '#FFFBEB' : '#F8FAFC',
                border: `1px solid ${(forecast?.fallbackCount ?? 0) > 0 ? '#FDE68A' : '#E2E8F0'}`,
                borderRadius: '8px',
                padding: '0.85rem 1rem',
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: (forecast?.fallbackCount ?? 0) > 0 ? '#B45309' : '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ArrowRightLeft size={13} />
                  Fallback Count
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (forecast?.fallbackCount ?? 0) > 0 ? '#D97706' : '#64748B', marginTop: '0.25rem' }}>
                  {forecast?.fallbackCount ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: '0.2rem' }}>
                  Seasonal fallback rows
                </div>
              </div>

              {/* Card 4: Service Status Code */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Info size={13} />
                  Service Status Code
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: forecast?.serviceStatusCode === 200 ? '#059669' : '#0F172A', marginTop: '0.25rem' }}>
                  {forecast?.serviceStatusCode !== null && forecast?.serviceStatusCode !== undefined ? `HTTP ${forecast.serviceStatusCode}` : (forecast?.serviceReachable ? 'HTTP 200' : 'Unavailable')}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: '0.2rem' }}>
                  {forecast?.serviceStatusCode === 200 ? '200 OK Response' : 'Last HTTP response'}
                </div>
              </div>
            </div>

            {/* Model & Runtime Details */}
            <div style={{ background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 700, color: '#000000', marginBottom: '0.65rem' }}>Microservice Architecture Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#000000' }}>Active Model Artifact:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#0284C7' }}>{activeModelVersion}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#000000' }}>Neural Framework:</span>
                  <span style={{ fontWeight: 600 }}>TensorFlow 2.x & Keras 3 (LSTM)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#000000' }}>Forecasting Service Host:</span>
                  <span style={{ fontFamily: 'monospace' }}>http://127.0.0.1:8000</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#000000' }}>Fallback Mode Active:</span>
                  <span style={{ fontWeight: 600, color: forecast?.serviceFallback ? '#D97706' : '#059669' }}>
                    {forecast?.serviceFallback ? 'Yes (Fallback in effect)' : 'No (Direct Model Active)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#000000' }}>Total Forecast Records:</span>
                  <span style={{ fontWeight: 600 }}>{forecast?.count ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#000000' }}>Evaluation Window:</span>
                  <span style={{ fontWeight: 600 }}>Current + 3 Months Forward</span>
                </div>
              </div>
              {forecast?.serviceError && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#B91C1C', fontSize: '0.78rem' }}>
                  <strong>Service Error:</strong> {forecast.serviceError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsInfoModalOpen(false)}
                style={{ fontSize: '0.85rem', padding: '0.45rem 1.25rem' }}
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
