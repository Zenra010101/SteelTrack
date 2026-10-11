import { useState } from 'react';
import {
  Plus,
  Search,
  Phone,
  ShieldAlert,
  CheckCircle2,
  X,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { CustomerMaster } from '../types/suppliers';

const INITIAL_CUSTOMERS: CustomerMaster[] = [
  {
    id: 'cust-101',
    customerCode: 'CUST-DAV-001',
    customerName: 'Mindanao Steelworks Corp.',
    companyName: 'Mindanao Steelworks Corporation',
    tin: '241-890-112-000',
    address: 'Panacan Industrial Estate, Davao City',
    contactPerson: 'Engr. Roberto Dela Cruz',
    contactPhone: '+63 82 291 4000',
    contactEmail: 'purchasing@mindanaosteel.ph',
    creditLimitPHP: 5000000,
    termsDays: 30,
    status: 'Active',
    assignedBranch: BranchLocation.Davao,
    createdAt: '2025-11-10',
  },
  {
    id: 'cust-102',
    customerCode: 'CUST-CGY-004',
    customerName: 'Apex Industrial Builders',
    companyName: 'Apex Construction & Industrial Inc.',
    tin: '109-443-887-001',
    address: 'CM Recto Ave, Cagayan de Oro City',
    contactPerson: 'Clarissa Tan',
    contactPhone: '+63 88 856 9000',
    contactEmail: 'ctan@apexbuilders.ph',
    creditLimitPHP: 3000000,
    termsDays: 30,
    status: 'Active',
    assignedBranch: BranchLocation.Cagayan,
    createdAt: '2025-12-01',
  },
  {
    id: 'cust-103',
    customerCode: 'CUST-CEB-012',
    customerName: 'Visayas Shipyard Yard',
    companyName: 'Visayas Heavy Industries Corp.',
    tin: '334-112-990-000',
    address: 'MEPZ 1, Lapu-Lapu City, Cebu',
    contactPerson: 'Capt. Manuel Osmeña',
    contactPhone: '+63 32 340 8800',
    contactEmail: 'm.osmena@visayasshipyard.ph',
    creditLimitPHP: 4000000,
    termsDays: 60,
    status: 'Blocked',
    assignedBranch: BranchLocation.Cebu,
    createdAt: '2025-08-15',
  },
];

export function CustomerManagementView() {
  const [customers, setCustomers] = useState<CustomerMaster[]>(INITIAL_CUSTOMERS);
  const [search, setSearch] = useState<string>('');

  // Add Customer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [tin, setTin] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [creditLimit, setCreditLimit] = useState<string>('3000000');
  const [branch, setBranch] = useState<BranchLocation>(BranchLocation.Davao);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const newCust: CustomerMaster = {
      id: `cust-${Date.now()}`,
      customerCode: `CUST-${branch.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      customerName,
      companyName: companyName || customerName,
      tin,
      address: 'Registered Office',
      contactPerson,
      contactPhone,
      contactEmail,
      creditLimitPHP: parseFloat(creditLimit),
      termsDays: 30,
      status: 'Active',
      assignedBranch: branch,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setCustomers([newCust, ...customers]);
    setIsAddModalOpen(false);
  };

  const filteredCustomers = customers.filter((c) =>
    c.customerName.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.tin.includes(search) ||
    c.customerCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Customer Master Directory & Credit Line Setup
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Register corporate customer accounts, configure credit limits, and assign branch accounts.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} /> Register New Customer
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="search-box" style={{ maxWidth: '400px', flex: 1 }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search customer code, company, or TIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* CUSTOMER TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Customer Code & Name</th>
              <th style={{ padding: '0.75rem 1rem' }}>Primary Contact & TIN</th>
              <th style={{ padding: '0.75rem 1rem' }}>Assigned Branch</th>
              <th style={{ padding: '0.75rem 1rem' }}>Approved Credit Limit</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, color: '#0284C7' }}>{c.customerCode}</div>
                  <div style={{ color: '#0F172A', fontWeight: 600 }}>{c.customerName}</div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{c.companyName}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 600, color: '#334155' }}>{c.contactPerson}</div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <span><Phone size={12} /> {c.contactPhone}</span>
                  </div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem' }}>TIN: {c.tin}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <span className="branch-tag highlight">{c.assignedBranch}</span>
                </td>

                <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#059669' }}>
                  ₱{c.creditLimitPHP.toLocaleString()}
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  {c.status === 'Active' && (
                    <span style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={12} /> Active Account
                    </span>
                  )}
                  {c.status === 'Blocked' && (
                    <span style={{ background: '#7F1D1D', color: '#F87171', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ShieldAlert size={12} /> Credit Blocked
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REGISTER CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '520px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Register Corporate Customer Account</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCustomer}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Customer / Trade Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mindanao Steelworks Corp."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Tax TIN Number</label>
                  <input
                    type="text"
                    placeholder="241-890-112-000"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Assigned Branch</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value as BranchLocation)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  >
                    <option value={BranchLocation.Davao}>Davao Branch</option>
                    <option value={BranchLocation.Cagayan}>Cagayan Branch</option>
                    <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
                    <option value={BranchLocation.Cebu}>Cebu Branch</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Full Legal Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mindanao Steelworks Corp."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Contact Email</label>
                  <input
                    type="email"
                    placeholder="purchasing@company.ph"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Contact Phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Approved Credit Limit (PHP)</label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Customer Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
