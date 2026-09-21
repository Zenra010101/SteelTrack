import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { BranchLocation } from '../types/auth';

interface BranchApprovalsViewProps {
  branch: BranchLocation;
  managerName: string;
}

export function BranchApprovalsView({ branch, managerName }: BranchApprovalsViewProps) {
  const [approvals, setApprovals] = useState([
    {
      id: 'app-901',
      heatNumber: 'HT-2026-9012',
      grade: 'SS304_Stainless',
      inspectionType: 'Tensile & Metallurgical Test',
      inspector: 'Testing Lab B',
      status: 'Pending',
      createdAt: '2026-09-18',
    },
    {
      id: 'app-902',
      heatNumber: 'HT-2026-8841',
      grade: 'A36_Structural',
      inspectionType: 'Ultrasonic Flaw Inspection',
      inspector: 'Quality Inspector Team',
      status: 'Approved',
      createdAt: '2026-09-17',
    },
  ]);

  const handleApprove = (id: string) => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Approved' } : a))
    );
  };

  return (
    <div className="approvals-container">
      <div className="controls-bar">
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            Quality Control & Status Approvals ({branch} Branch)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
            Supervised by {managerName} • Approve inspection releases before marking stock 'Available'
          </p>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Approval ID</th>
              <th>Heat Number</th>
              <th>Grade</th>
              <th>Inspection Protocol</th>
              <th>Inspector / Lab</th>
              <th>Status</th>
              <th>Manager Action</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((app) => (
              <tr key={app.id}>
                <td style={{ fontFamily: 'monospace', color: '#38BDF8', fontWeight: 600 }}>
                  {app.id}
                </td>
                <td style={{ fontWeight: 600 }}>{app.heatNumber}</td>
                <td>{app.grade.replace('_', ' ')}</td>
                <td style={{ color: '#CBD5E1' }}>{app.inspectionType}</td>
                <td style={{ color: '#94A3B8', fontSize: '0.85rem' }}>{app.inspector}</td>
                <td>
                  {app.status === 'Approved' ? (
                    <span className="badge badge-available">
                      <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Approved
                    </span>
                  ) : (
                    <span className="badge badge-inproduction">
                      <AlertCircle size={12} style={{ marginRight: 4 }} /> Pending Sign-off
                    </span>
                  )}
                </td>
                <td>
                  {app.status === 'Pending' ? (
                    <button
                      className="btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => handleApprove(app.id)}
                    >
                      <ClipboardCheck size={14} /> Sign & Approve Batch
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 500 }}>
                      Approved by {managerName}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
