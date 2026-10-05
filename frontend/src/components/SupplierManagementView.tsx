import { useState } from 'react';
import {
  Plus,
  Search,
  Paperclip,
  Phone,
  Mail,
  Star,
  FileCheck,
  Globe,
  X,
} from 'lucide-react';
import type { SupplierMaster } from '../types/suppliers';

const INITIAL_SUPPLIERS: SupplierMaster[] = [
  {
    id: 'sup-101',
    supplierCode: 'SUP-JPN-001',
    companyName: 'Nippon Steel Corporation',
    tin: '990-112-441-000',
    countryOfOrigin: 'Japan',
    paymentTermsDays: 60,
    ratingScore: 5,
    status: 'Active',
    contacts: [
      {
        id: 'c-1',
        supplierId: 'sup-101',
        contactPerson: 'Kenji Sato',
        designation: 'Export Sales Manager',
        phone: '+81 3 6867 4111',
        email: 'k.sato@nipponsteel.com',
        isPrimary: true,
      },
    ],
    attachments: [
      {
        id: 'att-1',
        supplierId: 'sup-101',
        fileName: 'Nippon_JIS_G3101_Mill_Test_Cert_2026.pdf',
        fileType: 'Mill_Test_Certificate',
        uploadDate: '2026-01-15',
        fileUrl: '#',
      },
      {
        id: 'att-2',
        supplierId: 'sup-101',
        fileName: 'ISO_9001_Quality_Compliance.pdf',
        fileType: 'ISO_Certification',
        uploadDate: '2026-02-01',
        fileUrl: '#',
      },
    ],
  },
  {
    id: 'sup-102',
    supplierCode: 'SUP-KOR-004',
    companyName: 'POSCO International',
    tin: '881-304-992-000',
    countryOfOrigin: 'South Korea',
    paymentTermsDays: 45,
    ratingScore: 4,
    status: 'Active',
    contacts: [
      {
        id: 'c-2',
        supplierId: 'sup-102',
        contactPerson: 'Min-Jun Park',
        designation: 'Southeast Asia Regional Director',
        phone: '+82 2 3457 2114',
        email: 'park.mj@posco.com',
        isPrimary: true,
      },
    ],
    attachments: [
      {
        id: 'att-3',
        supplierId: 'sup-102',
        fileName: 'POSCO_SS304_Mill_Test_Certificate.pdf',
        fileType: 'Mill_Test_Certificate',
        uploadDate: '2026-03-10',
        fileUrl: '#',
      },
    ],
  },
  {
    id: 'sup-103',
    supplierCode: 'SUP-PHL-009',
    companyName: 'SteelAsia Manufacturing Corp.',
    tin: '102-884-331-000',
    countryOfOrigin: 'Philippines',
    paymentTermsDays: 30,
    ratingScore: 4,
    status: 'Active',
    contacts: [
      {
        id: 'c-3',
        supplierId: 'sup-103',
        contactPerson: 'Eduardo Tan',
        designation: 'Key Account Executive',
        phone: '+63 2 8892 1000',
        email: 'etan@steelasia.com',
        isPrimary: true,
      },
    ],
    attachments: [],
  },
];

export function SupplierManagementView() {
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>(INITIAL_SUPPLIERS);
  const [search, setSearch] = useState<string>('');

  // Modals
  const [selectedSupplierDetails, setSelectedSupplierDetails] = useState<SupplierMaster | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form
  const [companyName, setCompanyName] = useState<string>('');
  const [supplierCode, setSupplierCode] = useState<string>('');
  const [tin, setTin] = useState<string>('');
  const [country, setCountry] = useState<string>('Philippines');
  const [termsDays, setTermsDays] = useState<number>(30);

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const newSup: SupplierMaster = {
      id: `sup-${Date.now()}`,
      supplierCode: supplierCode || `SUP-PHL-${Math.floor(100 + Math.random() * 900)}`,
      companyName,
      tin,
      countryOfOrigin: country,
      paymentTermsDays: Number(termsDays),
      ratingScore: 5,
      status: 'Active',
      contacts: [],
      attachments: [],
    };

    setSuppliers([newSup, ...suppliers]);
    setIsAddModalOpen(false);
    setCompanyName('');
    setTin('');
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.companyName.toLowerCase().includes(search.toLowerCase()) ||
    s.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
    s.countryOfOrigin.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Supplier Master Directory & Mill Certifications
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Manage international steel mills, local fabricators, compliance documents, and payment terms.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="search-box" style={{ maxWidth: '400px', flex: 1 }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search supplier name, code, or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* SUPPLIER TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Code & Supplier</th>
              <th style={{ padding: '0.75rem 1rem' }}>Origin & TIN</th>
              <th style={{ padding: '0.75rem 1rem' }}>Credit Terms</th>
              <th style={{ padding: '0.75rem 1rem' }}>Quality Rating</th>
              <th style={{ padding: '0.75rem 1rem' }}>Certificates</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, color: '#0284C7' }}>{s.supplierCode}</div>
                  <div style={{ color: '#0F172A', fontWeight: 600 }}>{s.companyName}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#334155' }}>
                    <Globe size={14} style={{ color: '#0284C7' }} /> {s.countryOfOrigin}
                  </div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem' }}>TIN: {s.tin}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0F172A' }}>
                  Net {s.paymentTermsDays} Days
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.15rem', color: '#D97706' }}>
                    {Array.from({ length: s.ratingScore }).map((_, idx) => (
                      <Star key={idx} size={14} fill="#D97706" />
                    ))}
                  </div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <span style={{ background: '#F1F5F9', color: '#0284C7', border: '1px solid #CBD5E1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                    <Paperclip size={12} /> {s.attachments.length} Documents
                  </span>
                </td>

                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={() => setSelectedSupplierDetails(s)}
                  >
                    View Details & MTC
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DETAILS & ATTACHMENTS MODAL */}
      {selectedSupplierDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '600px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#38BDF8' }}>
                  {selectedSupplierDetails.companyName}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{selectedSupplierDetails.supplierCode} • {selectedSupplierDetails.countryOfOrigin}</div>
              </div>
              <button onClick={() => setSelectedSupplierDetails(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* CONTACTS */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#F8FAFC' }}>Primary Contacts:</div>
              {selectedSupplierDetails.contacts.length === 0 ? (
                <div style={{ color: '#64748B', fontSize: '0.85rem' }}>No contacts listed.</div>
              ) : (
                selectedSupplierDetails.contacts.map((c) => (
                  <div key={c.id} style={{ background: '#0F172A', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{c.contactPerson} ({c.designation})</div>
                    <div style={{ color: '#94A3B8', display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={12} /> {c.phone}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={12} /> {c.email}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ATTACHMENTS & MILL TEST CERTIFICATES */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#F8FAFC' }}>
                Uploaded Mill Test Certificates (MTC) & Compliance Files:
              </div>
              {selectedSupplierDetails.attachments.length === 0 ? (
                <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '6px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
                  No compliance certificates uploaded for this supplier.
                </div>
              ) : (
                selectedSupplierDetails.attachments.map((a) => (
                  <div key={a.id} style={{ background: '#0F172A', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <FileCheck size={14} /> {a.fileName}
                      </div>
                      <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Type: {a.fileType.replace(/_/g, ' ')} • Uploaded: {a.uploadDate}</div>
                    </div>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      Download PDF
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setSelectedSupplierDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER MODAL */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '500px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Add New Steel Supplier</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSupplier}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Baosteel Group Corp."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Supplier Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SUP-CHN-008"
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Tax TIN #</label>
                  <input
                    type="text"
                    placeholder="e.g. 009-881-224-000"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Country of Origin</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={termsDays}
                    onChange={(e) => setTermsDays(Number(e.target.value))}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
