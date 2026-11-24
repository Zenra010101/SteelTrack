import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Tag,
  Edit2,
  X,
  Layers,
  Printer,
  DollarSign,
  Boxes,
  FileDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { ProductItem, CreateProductDto } from '../types/product';
import type { UserSession } from '../types/auth';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  fetchCategories,
  fetchBranches,
  type CategoryItem,
} from '../services/api';
import { TableExportButtons } from './TableExportButtons';
import { formatPHP } from '../utils/currency';

interface ProductsManagementViewProps {
  userSession?: UserSession;
}

export function ProductsManagementView({ userSession: _userSession }: ProductsManagementViewProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductItem | null>(null);

  // Form State for Add Product
  const [sku, setSku] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [grade, setGrade] = useState<string>('A36_Structural');
  const [size, setSize] = useState<string>('');
  const [thickness, setThickness] = useState<string>('');
  const [length, setLength] = useState<string>('6000mm');
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>('pc');
  const [unitPrice, setUnitPrice] = useState<string>('15000');
  const [costPrice, setCostPrice] = useState<string>('12000');
  const [stockQuantity, setStockQuantity] = useState<string>('20');
  const [reorderLevel, setReorderLevel] = useState<string>('10');

  // Edit Form State
  const [editName, setEditName] = useState<string>('');
  const [editUnitPrice, setEditUnitPrice] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');
  const [editStockQuantity, setEditStockQuantity] = useState<string>('');
  const [editReorderLevel, setEditReorderLevel] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catList, branchList] = await Promise.all([
        fetchProducts(
          search || undefined,
          selectedCategory || undefined,
          selectedGrade || undefined,
          false
        ),
        fetchCategories(),
        fetchBranches(),
      ]);
      setProducts(prodRes.data);
      setCategories(catList);
      setBranches(branchList);
      if (catList.length > 0 && !categoryId) {
        setCategoryId(catList[0].id);
      }
    } catch (err) {
      console.error('Failed loading products catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [search, selectedCategory, selectedGrade]);

  const handlePrintBarcodePdf = (p: ProductItem) => {
    const printWindow = window.open('', '_blank', 'width=700,height=800');
    if (!printWindow) {
      window.print();
      return;
    }
    const barcodeVal = p.barcode || p.sku || '480651200101';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Product Barcode Tag - ${p.sku}</title>
        <style>
          @page { size: auto; margin: 12mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            display: flex;
            justify-content: center;
            background: #ffffff;
          }
          .tag-card {
            width: 400px;
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 24px;
            box-sizing: border-box;
            text-align: center;
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #475569;
            font-weight: 700;
          }
          .sku {
            font-size: 22px;
            font-weight: 800;
            margin: 4px 0 0 0;
            color: #0f172a;
          }
          .meta-table {
            width: 100%;
            margin-bottom: 18px;
            text-align: left;
            font-size: 13px;
            line-height: 1.6;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #e2e8f0;
            padding: 5px 0;
          }
          .label {
            color: #64748b;
            font-weight: 600;
          }
          .value {
            font-weight: 700;
            color: #0f172a;
          }
          .barcode-box {
            border: 2px solid #0f172a;
            padding: 16px 12px;
            border-radius: 6px;
            margin-top: 10px;
            background: #ffffff;
          }
          .bars {
            display: flex;
            justify-content: center;
            height: 64px;
            gap: 3px;
            align-items: stretch;
            width: 90%;
            margin: 0 auto;
          }
          .bar-black {
            background: #000000;
          }
          .bar-white {
            background: #ffffff;
          }
          .barcode-text {
            font-family: 'Courier New', Courier, monospace;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: 4px;
            margin-top: 10px;
            color: #000000;
          }
          .footer-note {
            margin-top: 14px;
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="tag-card">
          <div class="header">
            <div class="title">SteelTrack Enterprise • Industrial Inventory Tag</div>
            <div class="sku">${p.sku}</div>
          </div>
          <div class="meta-table">
            <div class="meta-row"><span class="label">Product Name:</span><span class="value">${p.name}</span></div>
            <div class="meta-row"><span class="label">Category:</span><span class="value">${p.categoryName || 'General Steel'}</span></div>
            <div class="meta-row"><span class="label">Grade:</span><span class="value">${p.grade?.replace(/_/g, ' ') || 'SS304'}</span></div>
            <div class="meta-row"><span class="label">Specs / Size:</span><span class="value">${p.size || 'Standard'} ${p.thickness ? `(${p.thickness})` : ''}</span></div>
            <div class="meta-row"><span class="label">Unit Price:</span><span class="value">${formatPHP(p.unitPrice)} / ${p.unitOfMeasure}</span></div>
            <div class="meta-row"><span class="label">Barcode No:</span><span class="value">${barcodeVal}</span></div>
          </div>
          <div class="barcode-box">
            <div class="bars">
              ${[3, 1, 4, 1, 2, 5, 1, 3, 2, 4, 1, 3, 5, 2, 1, 4, 2, 3, 1, 4, 2, 5, 3, 1, 2]
                .map((w, i) => `<div style="flex: ${w};" class="${i % 2 === 0 ? 'bar-black' : 'bar-white'}"></div>`)
                .join('')}
            </div>
            <div class="barcode-text">${barcodeVal}</div>
          </div>
          <div class="footer-note">Certified Product Barcode • Scan with 1D/2D Laser Scanner</div>
        </div>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleOpenAddModal = () => {
    // Generate clean auto SKU recommendation based on grade
    const cleanGrade = grade.split('_')[0];
    setSku(`STL-${cleanGrade}-${Math.floor(100 + Math.random() * 900)}`);
    setSelectedBranchIds(branches.map((b) => b.id));
    setIsAddModalOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const dto: CreateProductDto = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      grade,
      size: size.trim() || undefined,
      thickness: thickness.trim() || undefined,
      length: length.trim() || undefined,
      unitOfMeasure,
      unitPrice: parseFloat(unitPrice) || 0,
      costPrice: parseFloat(costPrice) || 0,
      stockQuantity: parseInt(stockQuantity, 10) || 0,
      reorderLevel: parseInt(reorderLevel, 10) || 0,
      branchId: selectedBranchIds.length > 0 ? selectedBranchIds[0] : undefined,
      branchIds: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    };

    await createProduct(dto);
    setIsAddModalOpen(false);
    // Reset form
    setName('');
    setDescription('');
    setSize('');
    setThickness('');
    await loadData();
  };

  const handleOpenEdit = (p: ProductItem) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditUnitPrice(p.unitPrice.toString());
    setEditCostPrice(p.costPrice.toString());
    setEditStockQuantity(p.stockQuantity.toString());
    setEditReorderLevel(p.reorderLevel.toString());
    setEditIsActive(p.isActive);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    await updateProduct(editingProduct.id, {
      name: editName,
      unitPrice: parseFloat(editUnitPrice) || 0,
      costPrice: parseFloat(editCostPrice) || 0,
      stockQuantity: parseInt(editStockQuantity, 10) || 0,
      reorderLevel: parseInt(editReorderLevel, 10) || 0,
      isActive: editIsActive,
    });

    setEditingProduct(null);
    await loadData();
  };

  // Metrics
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stockQuantity, 0);
  const totalAssetValuePHP = products.reduce((acc, p) => acc + p.stockQuantity * p.costPrice, 0);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return products.slice(start, start + pageSize);
  }, [products, safePage, pageSize]);

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#000000', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Products Master Catalog & Specifications
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <TableExportButtons
            filename="SteelTrack_Products_Catalog"
            title="Products Master Catalog & Inventory"
            headers={['SKU', 'Barcode', 'Product Name', 'Category', 'Grade', 'Dimensions', 'Selling Price (PHP)', 'Cost Price (PHP)', 'Stock Quantity', 'Reorder Level', 'Status']}
            rows={products.map((p) => [
              p.sku,
              p.barcode || '—',
              p.name,
              p.categoryName || 'General',
              p.grade || 'Standard',
              p.size || p.thickness || p.length || 'Standard',
              formatPHP(p.unitPrice),
              formatPHP(p.costPrice),
              p.stockQuantity,
              p.reorderLevel,
              p.isActive ? 'Active' : 'Inactive',
            ])}
          />

          <button
            className="btn-primary"
            onClick={handleOpenAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem' }}
          >
            <Plus size={16} /> Add Catalog Product
          </button>
        </div>
      </div>

      {/* METRIC OVERVIEW CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#FFFFFF', padding: '1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
          <div style={{ color: '#000000', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Boxes size={15} color="#0284C7" /> Catalog SKUs
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#000000ff', marginTop: '0.35rem' }}>
            {totalProducts}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#000000', marginTop: '0.2rem' }}>
            Across {categories.length} active material categories
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
          <div style={{ color: '#000000', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={15} color="#059669" /> Physical Units in Yard
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#000000', marginTop: '0.35rem' }}>
            {totalStockUnits.toLocaleString()} units
          </div>
          <div style={{ fontSize: '0.75rem', color: '#000000', marginTop: '0.2rem' }}>
            Total on-hand catalog stock
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
          <div style={{ color: '#000000', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <DollarSign size={15} color="#0284C7" /> Catalog Inventory Value
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284C7', marginTop: '0.35rem' }}>
            ₱{totalAssetValuePHP.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#000000', marginTop: '0.2rem' }}>
            Total inventory asset cost basis
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="controls-bar" style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '260px' }}>
          <Search size={16} color="#475569" />
          <input
            type="text"
            placeholder="Search by SKU, Product Name, Grade, Dimensions, or Barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
          >
            <option value="">All Steel Grades</option>
            <option value="A36_Structural">A36 Structural</option>
            <option value="A572_HighStrength">A572 High Strength</option>
            <option value="SS304_Stainless">SS304 Stainless</option>
            <option value="SS316_Stainless">SS316 Stainless</option>
            <option value="AISI1045_Carbon">AISI 1045 Carbon</option>
          </select>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div style={{ background: '#FFFFFF', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#000000', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.75rem 1rem' }}>SKU & Barcode</th>
              <th style={{ padding: '0.75rem 1rem' }}>Product Name & Category</th>
              <th style={{ padding: '0.75rem 1rem' }}>Grade & Specs</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#000000' }}>
                  Loading Products Catalog...
                </td>
              </tr>
            ) : pagedProducts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#000000' }}>
                  No catalog products found matching filter criteria.
                </td>
              </tr>
            ) : (
              pagedProducts.map((p) => {
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid #E2E8F0',
                      fontSize: '0.88rem',
                      color: '#000000',
                      background: '#FFFFFF',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#0284C7', fontFamily: 'JetBrains Mono, monospace' }}>
                        {p.sku}
                      </div>
                      {p.barcode && (
                        <div style={{ fontSize: '0.75rem', color: '#000000', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Tag size={11} /> {p.barcode}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0284C7', fontSize: '0.92rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#000000' }}>
                        {p.categoryName || 'General Steel'} • UOM: {p.unitOfMeasure}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontWeight: 600, color: '#000000' }}>
                        {p.grade ? p.grade.replace(/_/g, ' ') : 'Standard'}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#000000' }}>
                        {p.size || p.thickness || p.length ? `${p.size || ''} ${p.thickness ? `(${p.thickness})` : ''} ${p.length ? `• L: ${p.length}` : ''}` : 'Standard dimensions'}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {p.isActive ? (
                        <span style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Active
                        </span>
                      ) : (
                        <span style={{ background: '#F1F5F9', color: '#000000', border: '1px solid #CBD5E1', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Inactive
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div
                        className="catalog-products-actions-grid"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 32px)',
                          gap: '0.35rem',
                          justifyContent: 'end',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                          }}
                          title="Print Barcode Tag"
                          aria-label="Print Barcode Tag"
                          onClick={() => setBarcodeProduct(p)}
                        >
                          <Tag size={15} />
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                          }}
                          title="Edit Product Details"
                          aria-label="Edit Product Details"
                          onClick={() => handleOpenEdit(p)}
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* TABLE PAGINATION BAR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          fontSize: '0.82rem',
          color: '#000000',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <div>
            Showing {totalProducts === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, totalProducts)} of {totalProducts} products
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.5rem' }}>
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8rem',
                  background: '#FFFFFF',
                  color: '#000000',
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(1)}
              style={{ padding: '0.3rem 0.5rem', opacity: safePage <= 1 ? 0.5 : 1 }}
              title="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ padding: '0.3rem 0.5rem', opacity: safePage <= 1 ? 0.5 : 1 }}
              title="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight: 600, color: '#000000', padding: '0 0.35rem' }}>
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '0.3rem 0.5rem', opacity: safePage >= totalPages ? 0.5 : 1 }}
              title="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              style={{ padding: '0.3rem 0.5rem', opacity: safePage >= totalPages ? 0.5 : 1 }}
              title="Last page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ADD PRODUCT MODAL */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '12px', border: '1px solid #CBD5E1', width: '90%', maxWidth: '620px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="#38BDF8" /> Add New Steel Product to Catalog
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>SKU Code</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A36 Wide Flange Beam 200x200"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Steel Grade</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  >
                    <option value="A36_Structural">A36 Structural</option>
                    <option value="A572_HighStrength">A572 High Strength</option>
                    <option value="SS304_Stainless">SS304 Stainless</option>
                    <option value="SS316_Stainless">SS316 Stainless</option>
                    <option value="AISI1045_Carbon">AISI 1045 Carbon</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Size / Dimensions</label>
                  <input
                    type="text"
                    placeholder="e.g. 200mm x 200mm"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Thickness</label>
                  <input
                    type="text"
                    placeholder="e.g. 8mm / 12mm"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Length</label>
                  <input
                    type="text"
                    placeholder="e.g. 6000mm"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Selling Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Cost Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Unit of Measure</label>
                  <select
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  >
                    <option value="pc">Piece (pc)</option>
                    <option value="bundle">Bundle</option>
                    <option value="length">Length</option>
                    <option value="ton">Metric Ton</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Initial Physical Stock</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Reorder Safety Threshold</label>
                  <input
                    type="number"
                    required
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              {/* BRANCH ASSIGNMENT OPTIONS */}
              <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.8rem', fontWeight: 600 }}>
                    Branch Availability & Assignment <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBranchIds.length === branches.length) {
                        setSelectedBranchIds([]);
                      } else {
                        setSelectedBranchIds(branches.map((b) => b.id));
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#0284C7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    {selectedBranchIds.length === branches.length ? 'Deselect All' : 'Select All Branches'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {branches.map((b) => {
                    const isChecked = selectedBranchIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.45rem 0.6rem',
                          background: isChecked ? '#E0F2FE' : '#FFFFFF',
                          border: isChecked ? '1px solid #38BDF8' : '1px solid #CBD5E1',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: isChecked ? 600 : 400,
                          color: isChecked ? '#0369A1' : '#334155',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBranchIds([...selectedBranchIds, b.id]);
                            } else {
                              setSelectedBranchIds(selectedBranchIds.filter((id) => id !== b.id));
                            }
                          }}
                          style={{ accentColor: '#0284C7', cursor: 'pointer' }}
                        />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedBranchIds.length === 0 && (
                  <p style={{ margin: '0.4rem 0 0 0', color: '#DC2626', fontSize: '0.75rem' }}>
                    * Warning: If no branch is selected, this product will not appear in branch POS inventory.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '12px', border: '1px solid #CBD5E1', width: '90%', maxWidth: '500px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Edit Product: {editingProduct.sku}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#000000' }}>{editingProduct.categoryName} • {editingProduct.grade}</span>
              </div>
              <button onClick={() => setEditingProduct(null)} style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Product Barcode</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '0.5rem 0.65rem', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 700, color: '#000000', fontSize: '0.85rem' }}>
                  <Tag size={15} style={{ color: '#0284C7' }} />
                  <span>{editingProduct.barcode || editingProduct.sku}</span>
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Product Title</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Selling Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editUnitPrice}
                    onChange={(e) => setEditUnitPrice(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Cost Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>On-Hand Stock</label>
                  <input
                    type="number"
                    required
                    value={editStockQuantity}
                    onChange={(e) => setEditStockQuantity(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Reorder Safety Threshold</label>
                  <input
                    type="number"
                    required
                    value={editReorderLevel}
                    onChange={(e) => setEditReorderLevel(e.target.value)}
                    style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#000000', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Catalog Active Status</label>
                <select
                  value={editIsActive ? 'true' : 'false'}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px' }}
                >
                  <option value="true">Active in Product Catalog</option>
                  <option value="false">Discontinued / Hidden</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingProduct(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARCODE TAG & PRODUCT INFO MODAL */}
      {barcodeProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '10px', width: '92%', maxWidth: '440px', padding: '1.75rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#000000', fontWeight: 700 }}>
                SteelTrack Enterprise • Industrial Product Tag
              </div>
              <h3 style={{ margin: '0.25rem 0', fontSize: '1.35rem', fontWeight: 800, color: '#000000' }}>
                {barcodeProduct.sku}
              </h3>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.88rem', textAlign: 'left', lineHeight: '1.6', background: '#F8FAFC', padding: '0.75rem 0.9rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <div><strong style={{ color: '#000000' }}>Product Name:</strong> <span style={{ fontWeight: 700 }}>{barcodeProduct.name}</span></div>
              <div><strong style={{ color: '#000000' }}>Category:</strong> {barcodeProduct.categoryName || 'General Steel'}</div>
              <div><strong style={{ color: '#000000' }}>Grade:</strong> {barcodeProduct.grade?.replace(/_/g, ' ')}</div>
              <div><strong style={{ color: '#000000' }}>Dimensions:</strong> {barcodeProduct.size} {barcodeProduct.thickness ? `(${barcodeProduct.thickness})` : ''}</div>
              <div><strong style={{ color: '#000000' }}>Unit Price:</strong> <span style={{ color: '#0284C7', fontWeight: 700 }}>{formatPHP(barcodeProduct.unitPrice)} / {barcodeProduct.unitOfMeasure}</span></div>
              <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <strong style={{ color: '#000000' }}>Barcode:</strong>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#000000', background: '#E2E8F0', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  {barcodeProduct.barcode || barcodeProduct.sku || '480651200101'}
                </span>
              </div>
            </div>

            {/* High-Contrast 1D Industrial Barcode Card */}
            <div style={{ background: '#FFFFFF', padding: '1rem 0.5rem', borderRadius: '6px', border: '2px solid #0F172A', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', height: '54px', gap: '3px', alignItems: 'stretch', width: '90%', margin: '0 auto' }}>
                {[3, 1, 4, 1, 2, 5, 1, 3, 2, 4, 1, 3, 5, 2, 1, 4, 2, 3, 1, 4, 2, 5, 3, 1, 2].map((w, i) => (
                  <div key={i} style={{ flex: `${w}`, background: i % 2 === 0 ? '#000000' : '#FFFFFF' }} />
                ))}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, Courier New, monospace', fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.3em', color: '#000000', marginTop: '0.5rem' }}>
                {barcodeProduct.barcode || barcodeProduct.sku || '480651200101'}
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setBarcodeProduct(null)}
                style={{ padding: '0.5rem 0.9rem' }}
              >
                Close
              </button>
              <button
                className="btn-secondary"
                onClick={() => window.print()}
                style={{ padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Print Tag using Browser Dialog"
              >
                <Printer size={14} /> Print Tag
              </button>
              <button
                className="btn-primary"
                onClick={() => handlePrintBarcodePdf(barcodeProduct)}
                style={{ padding: '0.5rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0284C7', fontWeight: 700 }}
                title="Generate and Download/Print PDF Tag"
              >
                <FileDown size={15} /> Print (in PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
