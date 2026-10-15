import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Phone,
  X,
  CreditCard,
  Edit3,
  Building2,
  Filter,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { CustomerMaster } from '../types/suppliers';
import {
  fetchCustomers,
  createCustomer,
  updateCustomerCreditLimit,
  updateCustomerStatus,
} from '../services/api';

export function CustomerManagementView() {
  const [customers, setCustomers] = useState<CustomerMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Register Customer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [tin, setTin] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [creditLimit, setCreditLimit] = useState<string>('3000000');
  const [branch, setBranch] = useState<BranchLocation>(BranchLocation.Davao);

  // Edit Credit Limit Modal State (Owner Feature)
  const [editingCreditCustomer, setEditingCreditCustomer] = useState<CustomerMaster | null>(null);
  const [newCreditLimitPHP, setNewCreditLimitPHP] = useState<string>('');
  const [creditJustification, setCreditJustification] = useState<string>('Periodic credit review / account expansion');

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchCustomers();
      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCust: Partial<CustomerMaster> = {
      customerCode: `CUST-${branch.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      customerName,
      companyName: companyName || customerName,
      tin: tin || '000-000-000-000',
      address: address || 'Regional Commercial District',
      contactPerson,
      contactPhone,
      contactEmail,
      creditLimitPHP: parseFloat(creditLimit) || 1000000,
      termsDays: 30,
      status: 'Active',
      assignedBranch: branch,
    };

    await createCustomer(newCust);
    setIsAddModalOpen(false);
    setCustomerName('');
    setCompanyName('');
    setTin('');
    setContactPerson('');
    setContactPhone('');
    setContactEmail('');
    await loadData();
  };

  const handleOpenEditCredit = (c: CustomerMaster) => {
    setEditingCreditCustomer(c);
    setNewCreditLimitPHP(c.creditLimitPHP.toString());
    setCreditJustification('Periodic credit evaluation / satisfactory payment record');
  };

  const handleSaveCreditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCreditCustomer) return;

    const limitNum = parseFloat(newCreditLimitPHP);
    if (isNaN(limitNum) || limitNum < 0) return;

    await updateCustomerCreditLimit(editingCreditCustomer.id, limitNum, creditJustification);
    setEditingCreditCustomer(null);
    await loadData();
  };

  const handleStatusChange = async (c: CustomerMaster, newStatus: 'Active' | 'On Hold' | 'Blocked') => {
    // Optimistic UI update
    setCustomers((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, status: newStatus } : item))
    );
    await updateCustomerStatus(c.id, newStatus);
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.tin.includes(search) ||
      c.customerCode.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Customer Master Directory & Credit Control
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Manage corporate client accounts, adjust owner-authorized credit limits, and control active/blocked standing.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} /> Register New Customer
        </button>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
        <div className="search-box" style={{ maxWidth: '420px', flex: 1 }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search customer code, company, contact, or TIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94A3B8', fontSize: '0.85rem' }}>
            <Filter size={16} /> Status:
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Customer Accounts</option>
            <option value="Active">Active Accounts</option>
            <option value="On Hold">On Hold / Disabled</option>
            <option value="Blocked">Credit Blocked</option>
          </select>
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
              <th style={{ padding: '0.75rem 1rem' }}>Authorized Credit Limit</th>
              <th style={{ padding: '0.75rem 1rem' }}>Account Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  Loading Customer Directory...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  No customer records found matching filter.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7', fontFamily: 'monospace' }}>{c.customerCode}</div>
                    <div style={{ color: '#0F172A', fontWeight: 600 }}>{c.customerName}</div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Building2 size={12} /> {c.companyName}
                    </div>
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

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.95rem' }}>
                      ₱{c.creditLimitPHP.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Terms: {c.termsDays} Days
                    </div>
                  </td>

                  {/* ACTIVE / DISABLED / BLOCKED STATUS CONTROL */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <select
                      value={c.status}
                      onChange={(e) => handleStatusChange(c, e.target.value as 'Active' | 'On Hold' | 'Blocked')}
                      style={{
                        padding: '0.3rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid transparent',
                        background:
                          c.status === 'Active'
                            ? '#ECFDF5'
                            : c.status === 'Blocked'
                            ? '#FEF2F2'
                            : '#FFFBEB',
                        color:
                          c.status === 'Active'
                            ? '#047857'
                            : c.status === 'Blocked'
                            ? '#DC2626'
                            : '#D97706',
                        borderColor:
                          c.status === 'Active'
                            ? '#A7F3D0'
                            : c.status === 'Blocked'
                            ? '#FECACA'
                            : '#FDE68A',
                      }}
                    >
                      <option value="Active">● Active Account</option>
                      <option value="On Hold">⏸ On Hold / Disabled</option>
                      <option value="Blocked">⛔ Credit Blocked</option>
                    </select>
                  </td>

                  {/* ACTIONS: OWNER EDIT CREDIT LIMIT */}
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      onClick={() => handleOpenEditCredit(c)}
                      title="Adjust Credit Limit (Owner Authorized)"
                    >
                      <Edit3 size={13} /> Edit Credit Limit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* OWNER EDIT CREDIT LIMIT MODAL */}
      {editingCreditCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #38BDF8', width: '90%', maxWidth: '480px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38BDF8' }}>
                  <CreditCard size={18} /> Adjust Customer Credit Limit
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#94A3B8', fontSize: '0.8rem' }}>
                  Owner authorization required for corporate credit facility modification.
                </p>
              </div>
              <button onClick={() => setEditingCreditCustomer(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#0F172A', padding: '0.85rem', borderRadius: '6px', border: '1px solid #334155', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{editingCreditCustomer.customerName}</div>
              <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Code: {editingCreditCustomer.customerCode} • Branch: {editingCreditCustomer.assignedBranch}</div>
              <div style={{ marginTop: '0.35rem', color: '#94A3B8' }}>
                Current Limit: <strong style={{ color: '#34D399' }}>₱{editingCreditCustomer.creditLimitPHP.toLocaleString()}</strong>
              </div>
            </div>

            <form onSubmit={handleSaveCreditLimit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  New Approved Credit Limit (PHP) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="10000"
                  required
                  value={newCreditLimitPHP}
                  onChange={(e) => setNewCreditLimitPHP(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #38BDF8', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px', fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  Executive Justification / Reason Note
                </label>
                <textarea
                  rows={2}
                  value={creditJustification}
                  onChange={(e) => setCreditJustification(e.target.value)}
                  placeholder="e.g. Board resolution approval, audited financial statement verification..."
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingCreditCustomer(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save New Credit Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '92%', maxWidth: '540px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Register Corporate Customer Account</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterCustomer}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  Customer / Trade Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
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
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Registered Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mindanao Steelworks Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Tax TIN Number</label>
                  <input
                    type="text"
                    placeholder="241-890-112-000"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Business Address</label>
                <input
                  type="text"
                  placeholder="e.g. Panacan Industrial Estate, Davao City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Primary Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Engr. Roberto Dela Cruz"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+63 82 291 4000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Initial Credit Limit (PHP)</label>
                  <input
                    type="number"
                    step="10000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Assigned Branch</label>
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
