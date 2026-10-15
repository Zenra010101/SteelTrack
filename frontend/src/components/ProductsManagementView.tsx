import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Tag,
  Edit2,
  X,
  Layers,
  Printer,
  DollarSign,
  Boxes,
} from 'lucide-react';
import type { ProductItem, CreateProductDto } from '../types/product';
import type { UserSession } from '../types/auth';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  fetchCategories,
  type CategoryItem,
} from '../services/api';

interface ProductsManagementViewProps {
  userSession?: UserSession;
}

export function ProductsManagementView({ userSession: _userSession }: ProductsManagementViewProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

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
      const [prodRes, catList] = await Promise.all([
        fetchProducts(
          search || undefined,
          selectedCategory || undefined,
          selectedGrade || undefined,
          lowStockOnly
        ),
        fetchCategories(),
      ]);
      setProducts(prodRes.data);
      setCategories(catList);
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
    loadData();
  }, [search, selectedCategory, selectedGrade, lowStockOnly]);

  const handleOpenAddModal = () => {
    // Generate clean auto SKU recommendation based on grade
    const cleanGrade = grade.split('_')[0];
    setSku(`STL-${cleanGrade}-${Math.floor(100 + Math.random() * 900)}`);
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
  const lowStockCount = products.filter((p) => p.stockQuantity <= p.reorderLevel).length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stockQuantity, 0);
  const totalAssetValuePHP = products.reduce((acc, p) => acc + p.stockQuantity * p.costPrice, 0);

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={24} color="#38BDF8" /> Products Master Catalog & Specifications
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Enterprise steel product catalog, dimension specifications, pricing formulas, and stock reorder thresholds.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={handleOpenAddModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem' }}
        >
          <Plus size={16} /> Add Catalog Product
        </button>
      </div>

      {/* METRIC OVERVIEW CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#1E293B', padding: '1.1rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Boxes size={15} color="#38BDF8" /> Catalog SKUs
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F8FAFC', marginTop: '0.35rem' }}>
            {totalProducts}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Across {categories.length} active material categories
          </div>
        </div>

        <div style={{ background: '#1E293B', padding: '1.1rem', borderRadius: '10px', border: lowStockCount > 0 ? '1px solid #F59E0B' : '1px solid #334155' }}>
          <div style={{ color: lowStockCount > 0 ? '#FBBF24' : '#94A3B8', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertTriangle size={15} color={lowStockCount > 0 ? '#F59E0B' : '#94A3B8'} /> Low Stock Triggered
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: lowStockCount > 0 ? '#FBBF24' : '#F8FAFC', marginTop: '0.35rem' }}>
            {lowStockCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Inventory at or below safety reorder level
          </div>
        </div>

        <div style={{ background: '#1E293B', padding: '1.1rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={15} color="#34D399" /> Physical Units in Yard
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F8FAFC', marginTop: '0.35rem' }}>
            {totalStockUnits.toLocaleString()} units
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Total on-hand catalog stock
          </div>
        </div>

        <div style={{ background: '#1E293B', padding: '1.1rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <DollarSign size={15} color="#60A5FA" /> Catalog Inventory Value
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8', marginTop: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
            ₱{totalAssetValuePHP.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Total inventory asset cost basis
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="controls-bar" style={{ background: '#1E293B', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '260px' }}>
          <Search size={16} color="#94A3B8" />
          <input
            type="text"
            placeholder="Search by SKU, Product Name, Grade, Dimensions, or Barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
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
            style={{ background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}
          >
            <option value="">All Steel Grades</option>
            <option value="A36_Structural">A36 Structural</option>
            <option value="A572_HighStrength">A572 High Strength</option>
            <option value="SS304_Stainless">SS304 Stainless</option>
            <option value="SS316_Stainless">SS316 Stainless</option>
            <option value="AISI1045_Carbon">AISI 1045 Carbon</option>
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            style={{
              background: lowStockOnly ? '#D97706' : '#0F172A',
              color: lowStockOnly ? '#FFFFFF' : '#94A3B8',
              border: '1px solid #334155',
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: lowStockOnly ? 700 : 500,
            }}
          >
            <AlertTriangle size={14} /> Low Stock Only
          </button>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div style={{ background: '#FFFFFF', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.75rem 1rem' }}>SKU & Barcode</th>
              <th style={{ padding: '0.75rem 1rem' }}>Product Name & Category</th>
              <th style={{ padding: '0.75rem 1rem' }}>Grade & Specs</th>
              <th style={{ padding: '0.75rem 1rem' }}>Unit Selling Price</th>
              <th style={{ padding: '0.75rem 1rem' }}>Cost Price</th>
              <th style={{ padding: '0.75rem 1rem' }}>Stock / Reorder</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  Loading Products Catalog...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  No catalog products found matching filter criteria.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isLowStock = p.stockQuantity <= p.reorderLevel;
                const isOutOfStock = p.stockQuantity === 0;

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #E2E8F0', fontSize: '0.88rem', color: '#0F172A', background: isLowStock ? '#FFFBEB' : '#FFFFFF' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#0284C7', fontFamily: 'JetBrains Mono, monospace' }}>
                        {p.sku}
                      </div>
                      {p.barcode && (
                        <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Tag size={11} /> {p.barcode}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {p.categoryName || 'General Steel'} • UOM: {p.unitOfMeasure}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>
                        {p.grade ? p.grade.replace(/_/g, ' ') : 'Standard'}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {p.size || p.thickness || p.length ? `${p.size || ''} ${p.thickness ? `(${p.thickness})` : ''} ${p.length ? `• L: ${p.length}` : ''}` : 'Standard dimensions'}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0F172A' }}>
                      ₱{p.unitPrice.toLocaleString()}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                      ₱{p.costPrice.toLocaleString()}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isOutOfStock ? '#DC2626' : isLowStock ? '#D97706' : '#059669' }}>
                          {p.stockQuantity}
                        </span>
                        <span style={{ color: '#64748B', fontSize: '0.75rem' }}>/ Min: {p.reorderLevel}</span>
                      </div>
                      {isOutOfStock ? (
                        <span style={{ fontSize: '0.7rem', color: '#DC2626', fontWeight: 700 }}>Out of Stock</span>
                      ) : isLowStock ? (
                        <span style={{ fontSize: '0.7rem', color: '#D97706', fontWeight: 700 }}>Reorder Alert</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Adequate Stock</span>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {p.isActive ? (
                        <span style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Active
                        </span>
                      ) : (
                        <span style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Inactive
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Print Barcode Tag"
                          onClick={() => setBarcodeProduct(p)}
                        >
                          <Tag size={12} /> Tag
                        </button>

                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Edit Product Details"
                          onClick={() => handleOpenEdit(p)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD PRODUCT MODAL */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '620px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="#38BDF8" /> Add New Steel Product to Catalog
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>SKU Code</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A36 Wide Flange Beam 200x200"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Steel Grade</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
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
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Size / Dimensions</label>
                  <input
                    type="text"
                    placeholder="e.g. 200mm x 200mm"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Thickness</label>
                  <input
                    type="text"
                    placeholder="e.g. 8mm / 12mm"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Length</label>
                  <input
                    type="text"
                    placeholder="e.g. 6000mm"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Selling Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Cost Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Unit of Measure</label>
                  <select
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
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
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Initial Physical Stock</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Reorder Safety Threshold</label>
                  <input
                    type="number"
                    required
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
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
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '500px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Edit Product: {editingProduct.sku}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{editingProduct.categoryName} • {editingProduct.grade}</span>
              </div>
              <button onClick={() => setEditingProduct(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Product Title</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Selling Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editUnitPrice}
                    onChange={(e) => setEditUnitPrice(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Cost Price (PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>On-Hand Stock</label>
                  <input
                    type="number"
                    required
                    value={editStockQuantity}
                    onChange={(e) => setEditStockQuantity(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Reorder Safety Threshold</label>
                  <input
                    type="number"
                    required
                    value={editReorderLevel}
                    onChange={(e) => setEditReorderLevel(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Catalog Active Status</label>
                <select
                  value={editIsActive ? 'true' : 'false'}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
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

      {/* BARCODE TAG PRINTABLE MODAL */}
      {barcodeProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', width: '90%', maxWidth: '420px', padding: '1.75rem', textAlign: 'center' }}>
            <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B' }}>
                SteelTrack Enterprise • Industrial Tag
              </div>
              <h3 style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 800 }}>
                {barcodeProduct.sku}
              </h3>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'left', lineHeight: '1.6' }}>
              <div><strong>Name:</strong> {barcodeProduct.name}</div>
              <div><strong>Category:</strong> {barcodeProduct.categoryName || 'General Steel'}</div>
              <div><strong>Grade:</strong> {barcodeProduct.grade?.replace(/_/g, ' ')}</div>
              <div><strong>Specs:</strong> {barcodeProduct.size} {barcodeProduct.thickness ? `(${barcodeProduct.thickness})` : ''}</div>
              <div><strong>Unit Price:</strong> ₱{barcodeProduct.unitPrice.toLocaleString()} / {barcodeProduct.unitOfMeasure}</div>
            </div>

            {/* Simulated 1D Barcode Pattern */}
            <div style={{ background: '#000000', padding: '1rem 0.5rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', height: '48px', gap: '3px', alignItems: 'stretch' }}>
                {[3, 1, 4, 1, 2, 5, 1, 3, 2, 4, 1, 3, 5, 2, 1, 4, 2, 3, 1, 4, 2, 5].map((w, i) => (
                  <div key={i} style={{ width: `${w * 2}px`, background: i % 2 === 0 ? '#FFFFFF' : 'transparent' }} />
                ))}
              </div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.2em', color: '#334155', marginBottom: '1.5rem' }}>
              {barcodeProduct.barcode || '480651200101'}
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setBarcodeProduct(null)}
                style={{ padding: '0.5rem 1rem' }}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => window.print()}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Printer size={14} /> Print Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
