import { useState, useMemo, useEffect } from 'react';
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
  Upload,
  Check,
  Download,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import type { SupplierMaster, SupplierAttachment } from '../types/suppliers';
import { fetchSuppliers, createSupplier } from '../services/api';
import { TableExportButtons } from './TableExportButtons';

interface CountryOption {
  name: string;
  code: string; // ISO-3
  flag: string;
}

const COUNTRIES: CountryOption[] = [
  { name: 'Philippines', code: 'PHL', flag: '🇵🇭' },
  { name: 'Japan', code: 'JPN', flag: '🇯🇵' },
  { name: 'South Korea', code: 'KOR', flag: '🇰🇷' },
  { name: 'China', code: 'CHN', flag: '🇨🇳' },
  { name: 'Taiwan', code: 'TWN', flag: '🇹🇼' },
  { name: 'Vietnam', code: 'VNM', flag: '🇻🇳' },
  { name: 'United States', code: 'USA', flag: '🇺🇸' },
  { name: 'Germany', code: 'DEU', flag: '🇩🇪' },
  { name: 'India', code: 'IND', flag: '🇮🇳' },
  { name: 'Singapore', code: 'SGP', flag: '🇸🇬' },
  { name: 'Australia', code: 'AUS', flag: '🇦🇺' },
  { name: 'Indonesia', code: 'IDN', flag: '🇮🇩' },
  { name: 'Malaysia', code: 'MYS', flag: '🇲🇾' },
  { name: 'Thailand', code: 'THA', flag: '🇹🇭' },
];

export function SupplierManagementView() {
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Modals
  const [selectedSupplierDetails, setSelectedSupplierDetails] = useState<SupplierMaster | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form State
  const [companyName, setCompanyName] = useState<string>('');
  const [supplierCode, setSupplierCode] = useState<string>('');
  const [tin, setTin] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState<boolean>(false);
  const [termsDays, setTermsDays] = useState<number>(30);
  const [ratingScore, setRatingScore] = useState<number>(5);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await fetchSuppliers(search);
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to load suppliers from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Helper to generate automated code based on ISO-3 and existing sequence
  const generateSupplierCode = (countryCode: string) => {
    const prefix = `SUP-${countryCode}-`;
    const matching = suppliers.filter((s) => s.supplierCode.startsWith(prefix));
    let nextSeq = 1;
    if (matching.length > 0) {
      const numbers = matching.map((s) => {
        const parts = s.supplierCode.split('-');
        const parsed = parseInt(parts[parts.length - 1], 10);
        return isNaN(parsed) ? 0 : parsed;
      });
      nextSeq = Math.max(...numbers) + 1;
    }
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  };

  const handleOpenAddModal = () => {
    const defaultCountry = COUNTRIES[0];
    setSelectedCountry(defaultCountry);
    setCountrySearch('');
    setIsCountryDropdownOpen(false);
    setSupplierCode(generateSupplierCode(defaultCountry.code));
    setCompanyName('');
    setTin('');
    setTermsDays(30);
    setRatingScore(5);
    setIsAddModalOpen(true);
  };

  const handleSelectCountry = (country: CountryOption) => {
    setSelectedCountry(country);
    setIsCountryDropdownOpen(false);
    // Auto-generate code based on country
    setSupplierCode(generateSupplierCode(country.code));
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = supplierCode || generateSupplierCode(selectedCountry.code);

    const newSup: Partial<SupplierMaster> = {
      supplierCode: finalCode,
      companyName,
      tin: tin || '000-000-000-000',
      countryOfOrigin: selectedCountry.name,
      paymentTermsDays: Number(termsDays),
      ratingScore: ratingScore,
      status: 'Active',
      contacts: [],
      attachments: [],
    };

    try {
      const created = await createSupplier(newSup);
      setSuppliers((prev) => [created, ...prev]);
    } catch (err) {
      console.error('Failed to create supplier in database:', err);
    }
    setIsAddModalOpen(false);
  };

  // Upload MTC file handler
  const handleUploadMtc = (supplierId: string, file: File) => {
    const newAttachment: SupplierAttachment = {
      id: `att-${Date.now()}`,
      supplierId,
      fileName: file.name,
      fileType: 'Mill_Test_Certificate',
      uploadDate: new Date().toISOString().split('T')[0],
      fileUrl: URL.createObjectURL(file),
    };

    // Update in suppliers list
    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id === supplierId) {
          return {
            ...s,
            attachments: [newAttachment, ...s.attachments],
          };
        }
        return s;
      })
    );

    // Update currently viewed supplier
    if (selectedSupplierDetails && selectedSupplierDetails.id === supplierId) {
      setSelectedSupplierDetails({
        ...selectedSupplierDetails,
        attachments: [newAttachment, ...selectedSupplierDetails.attachments],
      });
    }
  };

  const handleDeleteAttachment = (supplierId: string, attachmentId: string) => {
    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id === supplierId) {
          return {
            ...s,
            attachments: s.attachments.filter((a) => a.id !== attachmentId),
          };
        }
        return s;
      })
    );

    if (selectedSupplierDetails && selectedSupplierDetails.id === supplierId) {
      setSelectedSupplierDetails({
        ...selectedSupplierDetails,
        attachments: selectedSupplierDetails.attachments.filter((a) => a.id !== attachmentId),
      });
    }
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const filteredSuppliers = suppliers.filter(
    (s) =>
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
            Accredited global & domestic steel mills, automated codes (e.g. SUP-PHL-001), quality ratings, and MTC file compliance.
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenAddModal}>
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      {/* SEARCH BAR & EXPORT */}
      <div className="controls-bar" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="search-box" style={{ maxWidth: '400px', flex: 1 }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search supplier name, code, or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <TableExportButtons
          filename="SteelTrack_Suppliers_Directory"
          title="Supplier Master Directory & Mill Certifications"
          headers={['Supplier Code', 'Company Name', 'Country of Origin', 'TIN', 'Contact Person', 'Email', 'Phone', 'Rating', 'Payment Terms']}
          rows={filteredSuppliers.map((s) => [
            s.supplierCode,
            s.companyName,
            s.countryOfOrigin,
            s.tin,
            s.contacts?.[0]?.contactPerson || '—',
            s.contacts?.[0]?.email || '—',
            s.contacts?.[0]?.phone || '—',
            `${s.ratingScore}/5`,
            `${s.paymentTermsDays} Days`,
          ])}
        />
      </div>

      {/* SUPPLIER TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Code & Supplier</th>
              <th style={{ padding: '0.75rem 1rem' }}>Country / TIN</th>
              <th style={{ padding: '0.75rem 1rem' }}>Quality Rating</th>
              <th style={{ padding: '0.75rem 1rem' }}>Terms</th>
              <th style={{ padding: '0.75rem 1rem' }}>MTC Certificates</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={18} className="animate-spin" /> Loading suppliers from database...
                  </div>
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                  No registered suppliers found in database. Click <strong>Add Supplier</strong> to create one.
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, color: '#0284C7', fontFamily: 'monospace' }}>{s.supplierCode}</div>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{s.companyName}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0F172A', fontWeight: 500 }}>
                    <Globe size={14} style={{ color: '#0284C7' }} /> {s.countryOfOrigin}
                  </div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem' }}>TIN: {s.tin}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        fill={star <= s.ratingScore ? '#F59E0B' : 'none'}
                        color={star <= s.ratingScore ? '#F59E0B' : '#CBD5E1'}
                      />
                    ))}
                    <span style={{ fontSize: '0.78rem', color: '#B45309', fontWeight: 700, marginLeft: '0.3rem' }}>
                      {s.ratingScore}.0
                    </span>
                  </div>
                </td>

                <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                  {s.paymentTermsDays} Days
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0F172A', fontSize: '0.85rem' }}>
                    <Paperclip size={14} style={{ color: '#64748B' }} />
                    <span style={{ fontWeight: 600 }}>{s.attachments.length}</span> file(s)
                  </div>
                </td>

                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={() => setSelectedSupplierDetails(s)}
                  >
                    View Details & MTCs
                  </button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {/* DETAILS & ATTACHMENTS MODAL WITH MTC UPLOAD */}
      {selectedSupplierDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '12px', border: '1px solid #334155', width: '92%', maxWidth: '640px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#38BDF8' }}>
                  {selectedSupplierDetails.companyName}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.2rem' }}>
                  Code: <strong style={{ color: '#F8FAFC', fontFamily: 'monospace' }}>{selectedSupplierDetails.supplierCode}</strong> • {selectedSupplierDetails.countryOfOrigin} • Terms: {selectedSupplierDetails.paymentTermsDays} Days
                </div>
              </div>
              <button onClick={() => setSelectedSupplierDetails(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* QUALITY RATING BADGE */}
            <div style={{ background: '#0F172A', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #334155', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Supplier Quality Rating:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    fill={star <= selectedSupplierDetails.ratingScore ? '#F59E0B' : 'none'}
                    color={star <= selectedSupplierDetails.ratingScore ? '#F59E0B' : '#475569'}
                  />
                ))}
                <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.9rem', marginLeft: '0.35rem' }}>
                  {selectedSupplierDetails.ratingScore}.0 Stars
                </span>
              </div>
            </div>

            {/* CONTACTS */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#F8FAFC' }}>Primary Contacts:</div>
              {selectedSupplierDetails.contacts.length === 0 ? (
                <div style={{ color: '#64748B', fontSize: '0.85rem', fontStyle: 'italic' }}>No contacts listed for this supplier.</div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F8FAFC' }}>
                  Mill Test Certificates (MTC / MTR) & Compliance Files:
                </div>

                {/* UPLOAD MTC FILE BUTTON */}
                <label
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    padding: '0.35rem 0.75rem',
                  }}
                >
                  <Upload size={14} /> Upload MTC Certificate
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedSupplierDetails) {
                        handleUploadMtc(selectedSupplierDetails.id, file);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>

              {selectedSupplierDetails.attachments.length === 0 ? (
                <div style={{ background: '#0F172A', padding: '1.25rem', borderRadius: '6px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem', border: '1px dashed #334155' }}>
                  No compliance certificates uploaded for this supplier yet. Click "Upload MTC Certificate" to attach PDF inspection test sheets.
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <a
                        href={a.fileUrl}
                        download={a.fileName}
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={12} /> View/Download
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(selectedSupplierDetails.id, a.id)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.25rem' }}
                        title="Remove attachment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setSelectedSupplierDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER MODAL WITH SEARCHABLE COUNTRY, AUTO-CODE & 1-5 STARS */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '12px', border: '1px solid #CBD5E1', width: '92%', maxWidth: '540px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Add Accredited Steel Supplier</h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.8rem' }}>
                  Select country of origin to automatically generate supplier code.
                </p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSupplier}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.8rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Mill / Supplier Company Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Baosteel Group Corporation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              {/* SEARCHABLE COUNTRY SELECT DROPDOWN */}
              <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.8rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Country of Origin (ISO-3) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#0F172A',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{selectedCountry.flag}</span>
                    <strong style={{ color: '#0284C7' }}>{selectedCountry.code}</strong> — {selectedCountry.name}
                  </span>
                  <span style={{ color: '#64748B', fontSize: '0.75rem' }}>Change ▼</span>
                </button>

                {isCountryDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.35rem',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      zIndex: 2000,
                      maxHeight: '220px',
                      overflowY: 'auto',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid #E2E8F0' }}>
                      <input
                        type="text"
                        placeholder="Type to filter country or ISO code..."
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%',
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          color: '#0F172A',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>
                    {filteredCountries.map((c) => (
                      <div
                        key={c.code}
                        onClick={() => handleSelectCountry(c)}
                        style={{
                          padding: '0.55rem 0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          background: c.code === selectedCountry.code ? '#ECFDF5' : 'transparent',
                          color: c.code === selectedCountry.code ? '#059669' : '#0F172A',
                          borderBottom: '1px solid #E2E8F0',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{c.flag}</span>
                          <strong style={{ color: '#0284C7' }}>{c.code}</strong> — {c.name}
                        </span>
                        {c.code === selectedCountry.code && <Check size={14} style={{ color: '#059669' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AUTOMATED SUPPLIER CODE & TAX TIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>
                      Automated Supplier Code <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <span style={{ color: '#059669', fontSize: '0.7rem', fontWeight: 600 }}>Auto-Generated</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SUP-PHL-001"
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Tax TIN #</label>
                  <input
                    type="text"
                    placeholder="e.g. 009-881-224-000"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              {/* PAYMENT TERMS & 1-5 STAR QUALITY RATING */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={termsDays}
                    onChange={(e) => setTermsDays(Number(e.target.value))}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>

                {/* INTERACTIVE 1-5 STAR QUALITY RATING */}
                <div>
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
                    Quality Rating (1–5 Stars)
                  </label>
                  <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '0.45rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingScore(star)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem' }}
                        >
                          <Star
                            size={18}
                            fill={star <= ratingScore ? '#F59E0B' : 'none'}
                            color={star <= ratingScore ? '#F59E0B' : '#CBD5E1'}
                          />
                        </button>
                      ))}
                    </div>
                    <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem' }}>
                      {ratingScore}.0 Stars
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Accredited Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
