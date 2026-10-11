import { useState, useMemo } from 'react';
import { TrendingUp, Cpu, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BranchLocation } from '../types/auth';
import { fetchLstmDemandForecast } from '../services/api';

export function OwnerForecastView() {
  const [selectedBranch, setSelectedBranch] = useState<BranchLocation | 'All'>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('A36_Structural');

  const forecastData = useMemo(() => {
    return fetchLstmDemandForecast(selectedBranch, selectedGrade);
  }, [selectedBranch, selectedGrade]);

  const maxVal = useMemo(() => {
    return Math.max(...forecastData.map((d) => d.confidenceUpper)) + 20;
  }, [forecastData]);

  // Compute reorder recommendation based on peak forecast
  const peakForecast = Math.max(...forecastData.filter((d) => d.isForecast).map((d) => d.predictedDemandTons));

  return (
    <div className="forecast-container">
      <div className="forecast-header">
        <div>
          <div className="badge-ai">
            <Cpu size={14} /> Mock LSTM Neural Network Engine
          </div>
          <h2 className="section-title">Steel Batch Demand Forecasting</h2>
          <p className="section-sub">
            6-Month Historical Consumption vs. 3-Month AI Projected Steel Demand (Mock Graph ready for Python PyTorch/TensorFlow LSTM backend)
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
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            <option value="A36_Structural">A36 Structural</option>
            <option value="A572_HighStrength">A572 High Strength</option>
            <option value="SS304_Stainless">SS304 Stainless</option>
            <option value="SS316_Stainless">SS316 Stainless</option>
            <option value="AISI1045_Carbon">AISI 1045 Carbon</option>
          </select>
        </div>
      </div>

      {/* Interactive Mock SVG Graph */}
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
              const forecastPoints = forecastData
                .map((d, i) => {
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
                  {/* Forecast vs Historical separator vertical line */}
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

                  {/* Actual dot */}
                  {yAct !== null && (
                    <circle cx={x} cy={yAct} r="5" fill="#059669" />
                  )}

                  {/* Predicted dot */}
                  <circle
                    cx={x}
                    cy={yPred}
                    r="5"
                    fill="#0284C7"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />

                  {/* Text value */}
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

                  {/* Month Label */}
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
      <div className="forecast-insights-grid">
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
            <h4>Automated Reorder Threshold</h4>
            <div className="insight-value">{Math.round(peakForecast * 1.15)} Tons</div>
            <p className="insight-desc">
              Recommended minimum safety stock across {selectedBranch === 'All' ? 'all 4 branches' : `${selectedBranch} branch`}.
            </p>
          </div>
        </div>

        <div className="insight-card">
          <div className="insight-icon blue">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4>Python Model Integration Status</h4>
            <div className="insight-value" style={{ fontSize: '1rem', color: '#38BDF8' }}>
              Mock Graph Ready (PyTorch/TF Hook)
            </div>
            <p className="insight-desc">
              Chart endpoint is ready to bind to your external Python LSTM model via REST API endpoint.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
