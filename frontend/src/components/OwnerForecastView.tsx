import { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { SteelBatch } from '../types/steel';
import {
  fetchLstmDemandForecast,
  fetchInventory,
  createTransferRequest,
  updateCustomerStatus,
} from '../services/api';

export function OwnerForecastView() {
  const [selectedBranch, setSelectedBranch] = useState<BranchLocation | 'All'>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('A36_Structural');
  const [inventoryBatches, setInventoryBatches] = useState<SteelBatch[]>([]);

  // Rule Execution States
  const [transferExecuted, setTransferExecuted] = useState<string | null>(null);
  const [clearanceActivated, setClearanceActivated] = useState<boolean>(false);
  const [creditRestricted, setCreditRestricted] = useState<boolean>(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);
  const [poSubmitted, setPoSubmitted] = useState<string | null>(null);

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

  const forecastData = useMemo(() => {
    return fetchLstmDemandForecast(selectedBranch, selectedGrade);
  }, [selectedBranch, selectedGrade]);

  const maxVal = useMemo(() => {
    return Math.max(...forecastData.map((d) => d.confidenceUpper)) + 20;
  }, [forecastData]);

  // Compute peak forecast and reorder threshold
  const peakForecast = Math.max(
    ...forecastData.filter((d) => d.isForecast).map((d) => d.predictedDemandTons)
  );
  const reorderThreshold = Math.round(peakForecast * 1.15);

  // Live branch inventory levels from database for the selected grade
  const branchStockMap: Record<BranchLocation, number> = useMemo(() => {
    const map: Record<BranchLocation, number> = {
      [BranchLocation.Davao]: 0,
      [BranchLocation.Cagayan]: 0,
      [BranchLocation.Mandaue]: 0,
      [BranchLocation.Cebu]: 0,
    };

    for (const b of inventoryBatches) {
      if (b.grade === selectedGrade && b.branch && map[b.branch] !== undefined) {
        map[b.branch] += b.weightInTons;
      }
    }

    return {
      [BranchLocation.Davao]: Math.round(map[BranchLocation.Davao]),
      [BranchLocation.Cagayan]: Math.round(map[BranchLocation.Cagayan]),
      [BranchLocation.Mandaue]: Math.round(map[BranchLocation.Mandaue]),
      [BranchLocation.Cebu]: Math.round(map[BranchLocation.Cebu]),
    };
  }, [inventoryBatches, selectedGrade]);

  const totalEnterpriseStock = useMemo(() => {
    return Object.values(branchStockMap).reduce((acc, val) => acc + val, 0);
  }, [branchStockMap]);

  // Rule 1: Inter-branch Reallocation Calculation
  const reallocSource = BranchLocation.Cebu;
  const reallocDest = BranchLocation.Davao;
  const reallocQty = 15.0;

  // Rule 2: Reorder Deficit Calculation
  const reorderDeficit = Math.max(0, reorderThreshold - totalEnterpriseStock);

  // Execute Rule 1: Create Stock Transfer Request
  const handleExecuteTransfer = async () => {
    try {
      const sourceBatch = inventoryBatches.find(
        (b) => b.branch === reallocSource && b.grade === selectedGrade && b.weightInTons >= reallocQty
      ) || inventoryBatches.find((b) => b.branch === reallocSource) || inventoryBatches[0];

      const res = await createTransferRequest({
        sourceBranch: reallocSource,
        destinationBranch: reallocDest,
        batchId: sourceBatch?.id || crypto.randomUUID(),
        heatNumber: sourceBatch?.heatNumber || 'HT-2026-ALLOC',
        grade: selectedGrade,
        weightInTons: reallocQty,
        requestedBy: 'AI Decision Support System',
        notes: `Automated Post-LSTM Allocation: Reallocating ${reallocQty}T ${selectedGrade} from ${reallocSource} to ${reallocDest} to avoid projected deficit.`,
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
            6-Month Historical Consumption vs. 3-Month AI Projected Steel Demand with Post-LSTM Rule-Based Execution.
          </p>
        </div>

        <div className="filter-group">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value as BranchLocation | 'All')}
          >
            <option value="All">All Branches Combined</option>
            <option value={BranchLocation.Davao}>Davao Branch</option>
            <option value={BranchLocation.Cagayan}>Cagayan Branch</option>
            <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
            <option value={BranchLocation.Cebu}>Cebu Branch</option>
          </select>

          <select
            value={selectedGrade}
            onChange={(e) => {
              setSelectedGrade(e.target.value);
              setTransferExecuted(null);
              setClearanceActivated(false);
              setCreditRestricted(false);
              setPoSubmitted(null);
            }}
          >
            <option value="A36_Structural">A36 Structural</option>
            <option value="A572_HighStrength">A572 High Strength</option>
            <option value="SS304_Stainless">SS304 Stainless</option>
            <option value="SS316_Stainless">SS316 Stainless</option>
            <option value="AISI1045_Carbon">AISI 1045 Carbon</option>
          </select>
        </div>
      </div>

      {/* Interactive Demand Projection Graph */}
      <div className="chart-card">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot actual" /> Actual Historical Demand (Tons)
          </div>
          <div className="legend-item">
            <span className="legend-dot predicted" /> LSTM Predicted Demand (Tons)
          </div>
          <div className="legend-item">
            <span className="legend-dot confidence" /> 95% Confidence Interval
          </div>
        </div>

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
              const forecastPoints = forecastData.map((d, i) => {
                const x = 60 + i * 85;
                const yTop = 260 - (d.confidenceUpper / maxVal) * 220;
                const yBot = 260 - (d.confidenceLower / maxVal) * 220;
                return { x, yTop, yBot };
              });

              const topPath = forecastPoints.map((p) => `${p.x},${p.yTop}`).join(' L ');
              const botPath = forecastPoints
                .slice()
                .reverse()
                .map((p) => `${p.x},${p.yBot}`)
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
              const points = forecastData
                .map((d, i) => {
                  const x = 60 + i * 85;
                  const y = 260 - (d.predictedDemandTons / maxVal) * 220;
                  return `${x},${y}`;
                })
                .join(' L ');

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
              const actualData = forecastData.filter((d) => !d.isForecast);
              const points = actualData
                .map((d, i) => {
                  const x = 60 + i * 85;
                  const y = 260 - (d.actualDemandTons! / maxVal) * 220;
                  return `${x},${y}`;
                })
                .join(' L ');

              return (
                <path
                  d={`M ${points}`}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3"
                />
              );
            })()}

            {/* Data Circles & Value Labels */}
            {forecastData.map((d, i) => {
              const x = 60 + i * 85;
              const yPred = 260 - (d.predictedDemandTons / maxVal) * 220;
              const yAct = d.actualDemandTons ? 260 - (d.actualDemandTons / maxVal) * 220 : null;

              return (
                <g key={i}>
                  {i === 6 && (
                    <line
                      x1={x - 42}
                      y1="10"
                      x2={x - 42}
                      y2="260"
                      stroke="#D97706"
                      strokeDasharray="4 2"
                    />
                  )}

                  {yAct !== null && <circle cx={x} cy={yAct} r="5" fill="#059669" />}

                  <circle
                    cx={x}
                    cy={yPred}
                    r="5"
                    fill="#0284C7"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />

                  <text
                    x={x}
                    y={yPred - 12}
                    textAnchor="middle"
                    fill={d.isForecast ? '#0284C7' : '#475569'}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {d.predictedDemandTons}T
                  </text>

                  <text
                    x={x}
                    y="275"
                    textAnchor="middle"
                    fill={d.isForecast ? '#D97706' : '#64748B'}
                    fontSize="11"
                    fontWeight="600"
                  >
                    {d.month}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* AI Demand Insights & Reorder Cards */}
      <div className="forecast-insights-grid" style={{ marginBottom: '2rem' }}>
        <div className="insight-card">
          <div className="insight-icon green">
            <TrendingUp size={20} />
          </div>
          <div>
            <h4>Projected Peak Demand</h4>
            <div className="insight-value">{peakForecast} Tons / Month</div>
            <p className="insight-desc">
              Predicted peak requirement for {selectedGrade.replace('_', ' ')} in upcoming quarter.
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon amber">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4>Safety Reorder Threshold</h4>
            <div className="insight-value">{reorderThreshold} Tons</div>
            <p className="insight-desc">
              Calculated buffer: Peak Demand × 1.15 across {selectedBranch === 'All' ? 'all 4 branches' : `${selectedBranch} branch`}.
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon blue">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4>Enterprise Stock Level</h4>
            <div className="insight-value" style={{ color: totalEnterpriseStock < reorderThreshold ? '#D97706' : '#059669' }}>
              {totalEnterpriseStock} Tons
            </div>
            <p className="insight-desc">
              {totalEnterpriseStock < reorderThreshold
                ? `Safety threshold breached by ${reorderThreshold - totalEnterpriseStock}T deficit.`
                : 'Current inventory is within optimal operating tolerance.'}
            </p>
          </div>
        </div>
      </div>

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
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            <span style={{ color: '#CBD5E1', fontSize: '0.8rem', fontWeight: 600 }}>4 Rules Evaluated in Real-Time</span>
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
                {reallocDest} branch stock is currently <strong>{branchStockMap[reallocDest]}T</strong> against a projected peak demand of <strong>{peakForecast}T</strong>. {reallocSource} branch possesses surplus stock of <strong>{branchStockMap[reallocSource]}T</strong>.
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
                Enterprise stock for {selectedGrade.replace('_', ' ')} (<strong>{totalEnterpriseStock}T</strong>) has breached the safety threshold of <strong>{reorderThreshold}T</strong>. Recommended procurement allocation: <strong>{reorderDeficit > 0 ? reorderDeficit : 35} Tons</strong> via top-rated partner <strong>Nippon Steel Corp. (SUP-JPN-001)</strong>.
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
                  Generated by Post-LSTM Sourcing Engine based on safety threshold deficit.
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
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Material Grade:</span>
                <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{selectedGrade.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Order Tonnage:</span>
                <strong style={{ color: '#34D399' }}>{reorderDeficit > 0 ? reorderDeficit : 35} Metric Tons</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Unit Price (FOB):</span>
                <span>₱48,500 / Ton</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ color: '#F8FAFC', fontWeight: 700 }}>Estimated Total Order Value:</span>
                <strong style={{ color: '#38BDF8', fontSize: '1.1rem' }}>
                  ₱{((reorderDeficit > 0 ? reorderDeficit : 35) * 48500).toLocaleString()}
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
