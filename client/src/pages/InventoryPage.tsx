import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Layers,
  Plus,
  Search,
  RotateCcw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Eye,
  DollarSign,
  AlertCircle,
  TrendingDown,
  RefreshCw,
  Clock,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../core/context/AuthContext';
import { useModule } from '../core/context/ModuleContext';
import { useToast } from '../core/context/ToastContext';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Tooltip } from '../components/common/Tooltip';
import { Pagination } from '../components/common/Pagination';
import { formatDate, formatCurrency } from '../core/utils/dateUtils';
import { ViewInventoryItemModal, InventoryItem } from '../components/inventory/ViewInventoryItemModal';

interface InventoryCategory {
  id: string;
  name: string;
  productType: string;
  status: string;
  description?: string;
  branchId?: string;
  moduleKey?: string;
  branch?: { id: string; name: string; code?: string };
  _count?: { items: number };
}

interface InventoryMetrics {
  totalItems: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export const InventoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { activeModuleMode, enabledModules } = useModule();
  const toast = useToast();

  const locale = i18n.language === 'es' ? 'es-MX' : 'en-US';

  // Dynamic Module Resolution (Rule 16)
  const currentModuleKey = useMemo(() => {
    if (activeModuleMode && activeModuleMode !== 'PLATFORM') {
      return activeModuleMode;
    }
    if (!isTenantAdmin && user?.allowedModules && user.allowedModules.length > 0) {
      return user.allowedModules[0];
    }
    const saved = localStorage.getItem('ud_active_module_mode');
    if (saved && (saved === 'LAB' || saved === 'CLINIC')) {
      return saved;
    }
    return enabledModules[0] || 'CLINIC';
  }, [activeModuleMode, isTenantAdmin, user?.allowedModules, enabledModules]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  // Data States
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics>({
    totalItems: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Category Pagination State
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(15);

  // Modal States
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    categoryId: '',
    status: 'IN_STOCK',
    quantity: '0',
    minQuantity: '5',
    unitPrice: '0',
    brand: '',
    supplier: '',
    expiryDate: '',
    description: '',
    branchId: '',
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    productType: 'FOR_USE',
    status: 'ACTIVE',
    description: '',
    branchId: '',
  });

  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<InventoryCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Available branches list scoped strictly to current active module mode
  const availableBranches = useMemo(() => {
    const all = user?.availableBranches || [];
    return all.filter((b) => (b.moduleKey || 'CLINIC').toUpperCase() === currentModuleKey);
  }, [user, currentModuleKey]);

  // Reset filters when switching between Clinic and Lab modules
  useEffect(() => {
    setSelectedBranch('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setLowStockOnly(false);
    setSearch('');
    setPage(1);
    setCategoryPage(1);
  }, [currentModuleKey]);

  // Generate Suggested SKU Helper
  const generateNewSku = useCallback(async () => {
    try {
      const res = await api.get('/inventory/items/sku/generate');
      if (res.data) {
        return res.data;
      }
    } catch {
      // Fallback local SKU generator
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `INV-${y}${m}${d}-${rnd}`;
  }, []);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const params: any = { moduleKey: currentModuleKey };
      if (selectedBranch !== 'all') {
        params.branchId = selectedBranch;
      }
      const res = await api.get('/inventory/categories', { params });
      setCategories(res.data || []);
    } catch (err) {
      console.error('Failed to load inventory categories:', err);
    }
  }, [currentModuleKey, selectedBranch]);

  // Fetch Items & Metrics
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: pageSize,
        moduleKey: currentModuleKey,
      };

      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'all') params.categoryId = selectedCategory;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedBranch !== 'all') params.branchId = selectedBranch;
      if (lowStockOnly) params.lowStockOnly = true;

      const res = await api.get('/inventory/items', { params });
      setItems(res.data?.items || []);
      setTotalItems(res.data?.pagination?.totalItems || 0);
      setTotalPages(res.data?.pagination?.totalPages || 1);

      if (res.data?.metrics) {
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      console.error('Failed to load inventory items:', err);
    } finally {
      setLoading(false);
    }
  }, [currentModuleKey, page, pageSize, search, selectedCategory, selectedStatus, selectedBranch, lowStockOnly]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Paginated Categories Slice
  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * categoryPageSize;
    return categories.slice(start, start + categoryPageSize);
  }, [categories, categoryPage, categoryPageSize]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedBranch('all');
    setLowStockOnly(false);
    setPage(1);
  };

  // Open Add Item Modal
  const handleOpenAddItem = async () => {
    const defaultBranchId = user?.activeBranchId || availableBranches[0]?.id || '';
    const suggestedSku = await generateNewSku();

    setEditingItem(null);
    setItemForm({
      name: '',
      sku: suggestedSku,
      categoryId: categories[0]?.id || '',
      status: 'IN_STOCK',
      quantity: '0',
      minQuantity: '5',
      unitPrice: '0',
      brand: '',
      supplier: '',
      expiryDate: '',
      description: '',
      branchId: defaultBranchId,
    });
    setIsItemModalOpen(true);
  };

  // Open Edit Item Modal
  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku,
      categoryId: item.categoryId,
      status: item.status,
      quantity: String(item.quantity ?? 0),
      minQuantity: String(item.minQuantity ?? 5),
      unitPrice: String(item.unitPrice ?? 0),
      brand: item.brand || '',
      supplier: item.supplier || '',
      expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
      description: item.description || '',
      branchId: item.branchId,
    });
    setIsItemModalOpen(true);
  };

  // Submit Item Form
  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.categoryId) {
      toast.error(t('inventory.placeholders.itemName'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: itemForm.name.trim(),
        sku: itemForm.sku.trim() || undefined,
        categoryId: itemForm.categoryId,
        status: itemForm.status,
        quantity: Math.max(0, parseInt(itemForm.quantity, 10) || 0),
        minQuantity: Math.max(0, parseInt(itemForm.minQuantity, 10) || 0),
        unitPrice: Math.max(0, parseFloat(itemForm.unitPrice) || 0),
        brand: itemForm.brand.trim() || undefined,
        supplier: itemForm.supplier.trim() || undefined,
        expiryDate: itemForm.expiryDate || undefined,
        description: itemForm.description.trim() || undefined,
        moduleKey: currentModuleKey,
      };

      if (isTenantAdmin && itemForm.branchId) {
        payload.branchId = itemForm.branchId;
      }

      if (editingItem) {
        await api.patch(`/inventory/items/${editingItem.id}`, payload);
        toast.success(t('inventory.toast.updatedItem'));
      } else {
        await api.post('/inventory/items', payload);
        toast.success(t('inventory.toast.createdItem'));
      }

      setIsItemModalOpen(false);
      fetchItems();
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('inventory.toast.errorItem');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Item Handler
  const handleConfirmDeleteItem = async () => {
    if (!deletingItem) return;
    setSubmitting(true);
    try {
      await api.delete(`/inventory/items/${deletingItem.id}`);
      toast.success(t('inventory.toast.deletedItem'));
      setDeletingItem(null);
      fetchItems();
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('inventory.toast.errorItem');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Add Category Modal
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      productType: 'FOR_USE',
      status: 'ACTIVE',
      description: '',
      branchId: user?.activeBranchId || availableBranches[0]?.id || '',
    });
    setIsCategoryModalOpen(true);
  };

  // Open Edit Category Modal
  const handleOpenEditCategory = (cat: InventoryCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      productType: cat.productType || 'FOR_USE',
      status: cat.status || 'ACTIVE',
      description: cat.description || '',
      branchId: cat.branchId || '',
    });
    setIsCategoryModalOpen(true);
  };

  // Submit Category Form
  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: categoryForm.name.trim(),
        productType: categoryForm.productType,
        status: categoryForm.status,
        description: categoryForm.description.trim() || undefined,
        moduleKey: currentModuleKey,
      };

      if (isTenantAdmin && categoryForm.branchId) {
        payload.branchId = categoryForm.branchId;
      }

      if (editingCategory) {
        await api.patch(`/inventory/categories/${editingCategory.id}`, payload);
        toast.success(t('inventory.toast.updatedCategory'));
      } else {
        await api.post('/inventory/categories', payload);
        toast.success(t('inventory.toast.createdCategory'));
      }

      setIsCategoryModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('inventory.toast.errorCategory');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Category Handler (Tenant Admin only)
  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setSubmitting(true);
    try {
      await api.delete(`/inventory/categories/${deletingCategory.id}`);
      toast.success(t('inventory.toast.deletedCategory'));
      setDeletingCategory(null);
      fetchCategories();
      fetchItems();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('inventory.toast.errorCategory');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Select Options
  const categoryFilterOptions = [
    { value: 'all', label: t('inventory.filters.categoryAll') },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const statusFilterOptions = [
    { value: 'all', label: t('inventory.filters.statusAll') },
    { value: 'IN_STOCK', label: t('inventory.statusOptions.IN_STOCK') },
    { value: 'LOW_STOCK', label: t('inventory.statusOptions.LOW_STOCK') },
    { value: 'OUT_OF_STOCK', label: t('inventory.statusOptions.OUT_OF_STOCK') },
    { value: 'DISCONTINUED', label: t('inventory.statusOptions.DISCONTINUED') },
  ];

  const branchFilterOptions = [
    { value: 'all', label: t('inventory.filters.branchAll') },
    ...availableBranches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const categoryFormOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const statusFormOptions = [
    { value: 'IN_STOCK', label: t('inventory.statusOptions.IN_STOCK') },
    { value: 'LOW_STOCK', label: t('inventory.statusOptions.LOW_STOCK') },
    { value: 'OUT_OF_STOCK', label: t('inventory.statusOptions.OUT_OF_STOCK') },
    { value: 'DISCONTINUED', label: t('inventory.statusOptions.DISCONTINUED') },
  ];

  const productTypeOptions = [
    { value: 'FOR_USE', label: t('inventory.productTypeOptions.FOR_USE') },
    { value: 'FOR_SALE', label: t('inventory.productTypeOptions.FOR_SALE') },
    { value: 'RAW_MATERIAL', label: t('inventory.productTypeOptions.RAW_MATERIAL') },
    { value: 'EQUIPMENT', label: t('inventory.productTypeOptions.EQUIPMENT') },
  ];

  const categoryStatusOptions = [
    { value: 'ACTIVE', label: t('inventory.categoryStatusOptions.ACTIVE') },
    { value: 'INACTIVE', label: t('inventory.categoryStatusOptions.INACTIVE') },
  ];

  const branchFormOptions = availableBranches.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  // Status Badge Renderer Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_STOCK':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: 'var(--badge-success-bg)',
              color: 'var(--badge-success-text)',
            }}
          >
            <CheckCircle2 size={12} />
            {t('inventory.statusOptions.IN_STOCK')}
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: 'var(--badge-warning-bg)',
              color: 'var(--badge-warning-text)',
            }}
          >
            <AlertTriangle size={12} />
            {t('inventory.statusOptions.LOW_STOCK')}
          </span>
        );
      case 'OUT_OF_STOCK':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: 'var(--badge-danger-bg)',
              color: 'var(--badge-danger-text)',
            }}
          >
            <AlertCircle size={12} />
            {t('inventory.statusOptions.OUT_OF_STOCK')}
          </span>
        );
      case 'DISCONTINUED':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 600,
              backgroundColor: 'var(--bg-surface-muted)',
              color: 'var(--text-muted)',
            }}
          >
            {t('inventory.statusOptions.DISCONTINUED')}
          </span>
        );
    }
  };

  return (
    <div className="page-container" style={{ paddingBottom: '60px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--badge-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-600)',
              }}
            >
              <Package size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('inventory.managementTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('inventory.subtitle')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'items' ? 'var(--primary-600)' : 'transparent',
              color: activeTab === 'items' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Package size={15} />
            <span>{t('inventory.tabs.items')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'categories' ? 'var(--primary-600)' : 'transparent',
              color: activeTab === 'categories' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={15} />
            <span>{t('inventory.tabs.categories')}</span>
          </button>
        </div>
      </div>

      {/* Primary Action Button (Branch Operator only; Tenant Admin can only view and delete) */}
      {!isTenantAdmin && (
        <div style={{ marginBottom: '20px' }}>
          {activeTab === 'items' ? (
            <button
              type="button"
              onClick={handleOpenAddItem}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontWeight: 600,
                fontSize: '13.5px',
              }}
            >
              <Plus size={16} />
              <span>{t('inventory.addItem')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddCategory}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontWeight: 600,
                fontSize: '13.5px',
              }}
            >
              <Plus size={16} />
              <span>{t('inventory.addCategory')}</span>
            </button>
          )}
        </div>
      )}

      {activeTab === 'items' ? (
        <>
          {/* Filters Bar (Moved to top above KPI cards) */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                className="input"
                placeholder={t('inventory.filters.searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>

            {/* Category Filter */}
            <div style={{ width: '200px' }}>
              <SearchableSelect
                options={categoryFilterOptions}
                value={selectedCategory}
                onChange={(val) => {
                  setSelectedCategory(val);
                  setPage(1);
                }}
                placeholder={t('inventory.filters.categoryAll')}
              />
            </div>

            {/* Status Filter */}
            <div style={{ width: '180px' }}>
              <SearchableSelect
                options={statusFilterOptions}
                value={selectedStatus}
                onChange={(val) => {
                  setSelectedStatus(val);
                  setPage(1);
                }}
                placeholder={t('inventory.filters.statusAll')}
              />
            </div>

            {/* Branch Filter (if applicable) */}
            {(isTenantAdmin || availableBranches.length > 1) && (
              <div style={{ width: '180px' }}>
                <SearchableSelect
                  options={branchFilterOptions}
                  value={selectedBranch}
                  onChange={(val) => {
                    setSelectedBranch(val);
                    setPage(1);
                  }}
                  placeholder={t('inventory.filters.branchAll')}
                />
              </div>
            )}

            {/* Low Stock Filter Button */}
            <button
              type="button"
              onClick={() => {
                setLowStockOnly(!lowStockOnly);
                setPage(1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                backgroundColor: lowStockOnly ? 'var(--badge-warning-bg)' : 'var(--bg-card)',
                color: lowStockOnly ? 'var(--badge-warning-text)' : 'var(--text-main)',
                transition: 'all 0.15s ease',
              }}
            >
              <AlertTriangle size={14} />
              <span>{t('inventory.filters.lowStockOnly')}</span>
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
              }}
            >
              <RotateCcw size={14} />
              <span>{t('inventory.filters.reset')}</span>
            </button>
          </div>

          {/* 4 Summary Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {/* Total Items */}
            <div
              className="card"
              style={{
                padding: '20px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-primary-bg)',
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Package size={24} />
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  {t('inventory.metrics.totalItems')}
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {metrics.totalItems}
                </div>
              </div>
            </div>

            {/* Total Stock Value */}
            <div
              className="card"
              style={{
                padding: '20px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DollarSign size={24} />
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  {t('inventory.metrics.totalStockValue')}
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                  {formatCurrency(metrics.totalStockValue)}
                </div>
              </div>
            </div>

            {/* Low Stock Items */}
            <div
              className="card"
              style={{
                padding: '20px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                border: metrics.lowStockCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : undefined,
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-warning-bg)',
                  color: 'var(--badge-warning-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  {t('inventory.metrics.lowStockItems')}
                </span>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: metrics.lowStockCount > 0 ? 'var(--badge-warning-text)' : 'var(--text-heading)',
                    marginTop: '2px',
                  }}
                >
                  {metrics.lowStockCount}
                </div>
              </div>
            </div>

            {/* Out of Stock Items */}
            <div
              className="card"
              style={{
                padding: '20px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                border: metrics.outOfStockCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--badge-danger-bg)',
                  color: 'var(--badge-danger-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <TrendingDown size={24} />
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  {t('inventory.metrics.outOfStockItems')}
                </span>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: metrics.outOfStockCount > 0 ? 'var(--badge-danger-text)' : 'var(--text-heading)',
                    marginTop: '2px',
                  }}
                >
                  {metrics.outOfStockCount}
                </div>
              </div>
            </div>
          </div>

          {/* Items Data Table (Rule 13) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '14px' }}>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('inventory.fields.itemName')} / {t('inventory.fields.sku')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('inventory.fields.category')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('inventory.fields.brand')} & {t('inventory.fields.supplier')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>
                      {t('inventory.fields.stockLevel')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                      {t('inventory.fields.unitPrice')} & {t('inventory.fields.totalValue')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>
                      {t('inventory.fields.status')}
                    </th>
                    {(isTenantAdmin || availableBranches.length > 1) && (
                      <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {t('inventory.fields.branch')}
                      </th>
                    )}
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                      {t('inventory.fields.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>{t('common.loading')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              backgroundColor: 'var(--bg-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              marginBottom: '8px',
                            }}
                          >
                            <Package size={24} />
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                            {t('inventory.emptyState.noItems')}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {t('inventory.emptyState.noItemsDesc')}
                          </span>
                          {!isTenantAdmin && (
                            <button
                              type="button"
                              onClick={handleOpenAddItem}
                              className="btn btn-primary"
                              style={{ marginTop: '12px' }}
                            >
                              <Plus size={15} />
                              <span>{t('inventory.addItem')}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => {
                      const itemQty = Number(it.quantity) || 0;
                      const itemMinQty = Number(it.minQuantity) || 0;
                      const itemPrice = Number(it.unitPrice) || 0;
                      const itemTotalVal = itemQty * itemPrice;

                      return (
                        <tr
                          key={it.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {/* Item & SKU */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '13.5px' }}>
                              {it.name}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {it.sku}
                            </div>
                          </td>

                          {/* Category */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              {it.category?.name || '—'}
                            </span>
                          </td>

                          {/* Brand & Supplier */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                              {it.brand || '—'}
                            </div>
                            {it.supplier && (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {it.supplier}
                              </div>
                            )}
                          </td>

                          {/* Stock Level */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 800,
                                color:
                                  itemQty === 0
                                    ? 'var(--badge-danger-text)'
                                    : itemQty <= itemMinQty
                                    ? 'var(--badge-warning-text)'
                                    : 'var(--text-heading)',
                              }}
                            >
                              {itemQty}{' '}
                              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                                / min {itemMinQty}
                              </span>
                            </div>
                          </td>

                          {/* Unit Price & Total Value */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                              {formatCurrency(itemTotalVal)}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {formatCurrency(itemPrice)} / unit
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                            {renderStatusBadge(it.status)}
                          </td>

                          {/* Branch (if visible) */}
                          {(isTenantAdmin || availableBranches.length > 1) && (
                            <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                {it.branch?.name || '—'}
                              </span>
                            </td>
                          )}

                          {/* Action Buttons */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              {/* View Item Button */}
                              <Tooltip content={t('inventory.buttons.viewDetails')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => setViewingItem(it)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--primary-600)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Eye size={14} />
                                </button>
                              </Tooltip>

                              {/* Edit Item Button */}
                              {!isTenantAdmin && (
                                <Tooltip content={t('inventory.buttons.edit')}>
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => handleOpenEditItem(it)}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-card)',
                                      color: 'var(--text-main)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </Tooltip>
                              )}

                              {/* Delete Item Button */}
                              {isTenantAdmin && (
                                <Tooltip content={t('inventory.buttons.delete')}>
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => setDeletingItem(it)}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--badge-danger-border, #fecdd3)',
                                      backgroundColor: 'var(--badge-danger-bg)',
                                      color: 'var(--badge-danger-text, var(--rose-600))',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        </>
      ) : (
        <>
          {/* Categories Tab (Rule 13) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '14px' }}>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('inventory.fields.categoryName')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('inventory.fields.productType')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('inventory.fields.categoryStatus')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('inventory.fields.categoryDescription')}
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>
                      {t('inventory.fields.itemsCount')}
                    </th>
                    {(isTenantAdmin || availableBranches.length > 1) && (
                      <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {t('inventory.fields.branch')}
                      </th>
                    )}
                    <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                      {t('inventory.fields.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              backgroundColor: 'var(--bg-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              marginBottom: '8px',
                            }}
                          >
                            <Layers size={24} />
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                            {t('inventory.emptyState.noCategories')}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {t('inventory.emptyState.noCategoriesDesc')}
                          </span>
                          {!isTenantAdmin && (
                            <button
                              type="button"
                              onClick={handleOpenAddCategory}
                              className="btn btn-primary"
                              style={{ marginTop: '12px' }}
                            >
                              <Plus size={15} />
                              <span>{t('inventory.addCategory')}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedCategories.map((cat) => (
                      <tr
                        key={cat.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* Category Name */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontWeight: 700, color: 'var(--text-heading)', fontSize: '13.5px' }}>
                          {cat.name}
                        </td>

                        {/* Product Type */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                            }}
                          >
                            {t(`inventory.productTypeOptions.${cat.productType || 'FOR_USE'}`)}
                          </span>
                        </td>

                        {/* Category Status */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              backgroundColor: cat.status === 'ACTIVE' ? 'var(--badge-success-bg)' : 'var(--bg-surface-muted)',
                              color: cat.status === 'ACTIVE' ? 'var(--badge-success-text)' : 'var(--text-muted)',
                            }}
                          >
                            {t(`inventory.categoryStatusOptions.${cat.status || 'ACTIVE'}`)}
                          </span>
                        </td>

                        {/* Description */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '280px' }}>
                          {cat.description || '—'}
                        </td>

                        {/* Items Count */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '24px',
                              height: '24px',
                              padding: '0 6px',
                              borderRadius: '12px',
                              backgroundColor: 'var(--badge-primary-bg)',
                              color: 'var(--primary-600)',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {cat._count?.items ?? 0}
                          </span>
                        </td>

                        {/* Branch */}
                        {(isTenantAdmin || availableBranches.length > 1) && (
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                            {cat.branch?.name || t('inventory.filters.branchAll')}
                          </td>
                        )}

                        {/* Actions */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {!isTenantAdmin && (
                              <Tooltip content={t('inventory.buttons.edit')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => handleOpenEditCategory(cat)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Edit2 size={14} />
                                </button>
                              </Tooltip>
                            )}

                            {isTenantAdmin && (
                              <Tooltip content={t('inventory.buttons.delete')}>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => setDeletingCategory(cat)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--badge-danger-border, #fecdd3)',
                                    backgroundColor: 'var(--badge-danger-bg)',
                                    color: 'var(--badge-danger-text, var(--rose-600))',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={categoryPage}
              totalPages={Math.ceil(categories.length / categoryPageSize) || 1}
              pageSize={categoryPageSize}
              totalItems={categories.length}
              onPageChange={setCategoryPage}
              onPageSizeChange={(newSize) => {
                setCategoryPageSize(newSize);
                setCategoryPage(1);
              }}
            />
          </div>
        </>
      )}

      {/* ─── ADD / EDIT ITEM MODAL (Rule 14 & Matches User Screenshot 1) ─── */}
      {isItemModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={() => setIsItemModalOpen(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {editingItem ? t('inventory.modals.editItemTitle') : t('inventory.modals.addItemTitle')}
                </h2>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsItemModalOpen(false)}
                style={{ width: '32px', height: '32px' }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitItem} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div
                style={{
                  padding: '24px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  maxHeight: 'calc(92vh - 140px)',
                }}
              >
                {/* Row 1: Item Name & SKU */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.itemName')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder={t('inventory.placeholders.itemName')}
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      <span>
                        {t('inventory.fields.sku')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                      </span>
                      {!editingItem && (
                        <button
                          type="button"
                          onClick={async () => {
                            const newSku = await generateNewSku();
                            setItemForm((f) => ({ ...f, sku: newSku }));
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-600)',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                            padding: 0,
                          }}
                        >
                          <RefreshCw size={11} />
                          <span>Generate</span>
                        </button>
                      )}
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="INV-YYYYMMDD-XXXX"
                      value={itemForm.sku}
                      onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Category & Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.category')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <SearchableSelect
                      options={categoryFormOptions}
                      value={itemForm.categoryId}
                      onChange={(val) => setItemForm({ ...itemForm, categoryId: val })}
                      placeholder={t('inventory.placeholders.selectCategory')}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.status')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <SearchableSelect
                      options={statusFormOptions}
                      value={itemForm.status}
                      onChange={(val) => setItemForm({ ...itemForm, status: val })}
                      placeholder={t('inventory.placeholders.selectStatus')}
                    />
                  </div>
                </div>

                {/* Row 3: Current Quantity, Minimum Quantity, Unit Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.currentQuantity')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.minimumQuantity')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      value={itemForm.minQuantity}
                      onChange={(e) => setItemForm({ ...itemForm, minQuantity: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.unitPrice')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                        }}
                      >
                        MXN
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        style={{ paddingLeft: '44px' }}
                        value={itemForm.unitPrice}
                        onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Brand, Supplier, Expiry Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.brand')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder={t('inventory.placeholders.brand')}
                      value={itemForm.brand}
                      onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.supplier')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder={t('inventory.placeholders.supplier')}
                      value={itemForm.supplier}
                      onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.expiryDate')}
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={itemForm.expiryDate}
                      onChange={(e) => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('inventory.fields.description')}
                  </label>
                  <textarea
                    rows={3}
                    className="input"
                    placeholder={t('inventory.placeholders.description')}
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  />
                </div>

                {/* Branch Selection (for Tenant Admin) */}
                {isTenantAdmin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.branch')}
                    </label>
                    <SearchableSelect
                      options={branchFormOptions}
                      value={itemForm.branchId}
                      onChange={(val) => setItemForm({ ...itemForm, branchId: val })}
                      placeholder="Select branch"
                    />
                  </div>
                )}
              </div>

              {/* Form Footer Action Row */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  backgroundColor: 'var(--bg-modal, var(--bg-card))',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  {t('inventory.buttons.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? t('common.loading')
                    : editingItem
                    ? t('inventory.buttons.saveChanges')
                    : t('inventory.buttons.createItem')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT CATEGORY MODAL (Rule 14 & Matches User Screenshot 2) ─── */}
      {isCategoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px',
          }}
          onClick={() => setIsCategoryModalOpen(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                {editingCategory ? t('inventory.modals.editCategoryTitle') : t('inventory.modals.addCategoryTitle')}
              </h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsCategoryModalOpen(false)}
                style={{ width: '32px', height: '32px' }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitCategory}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Category Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('inventory.fields.categoryName')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder={t('inventory.placeholders.categoryName')}
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                  />
                </div>

                {/* Product Type & Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.productType')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <SearchableSelect
                      options={productTypeOptions}
                      value={categoryForm.productType}
                      onChange={(val) => setCategoryForm({ ...categoryForm, productType: val })}
                      placeholder={t('inventory.placeholders.selectProductType')}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {t('inventory.fields.categoryStatus')} <span style={{ color: 'var(--rose-500, #ef4444)' }}>*</span>
                    </label>
                    <SearchableSelect
                      options={categoryStatusOptions}
                      value={categoryForm.status}
                      onChange={(val) => setCategoryForm({ ...categoryForm, status: val })}
                      placeholder={t('inventory.placeholders.selectCategoryStatus')}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('inventory.fields.categoryDescription')}
                  </label>
                  <textarea
                    rows={3}
                    className="input"
                    placeholder={t('inventory.placeholders.categoryDescription')}
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  {t('inventory.buttons.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? t('common.loading') : t('inventory.buttons.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── VIEW ITEM MODAL ─── */}
      <ViewInventoryItemModal
        item={viewingItem}
        isOpen={Boolean(viewingItem)}
        onClose={() => setViewingItem(null)}
        onEdit={handleOpenEditItem}
        onDelete={(it) => setDeletingItem(it)}
        isTenantAdmin={isTenantAdmin}
      />

      {/* ─── DELETE ITEM CONFIRMATION MODAL ─── */}
      {deletingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            padding: '16px',
          }}
          onClick={() => setDeletingItem(null)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--badge-danger-bg)',
                  color: 'var(--badge-danger-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                {t('inventory.deleteModal.titleItem')}
              </h3>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              {t('inventory.deleteModal.msgItem')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                {t('inventory.deleteModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                className="btn btn-danger"
                disabled={submitting}
              >
                {submitting ? t('inventory.deleteModal.deleting') : t('inventory.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CATEGORY CONFIRMATION MODAL ─── */}
      {deletingCategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            padding: '16px',
          }}
          onClick={() => setDeletingCategory(null)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-modal, var(--bg-card))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--badge-danger-bg)',
                  color: 'var(--badge-danger-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                {t('inventory.deleteModal.titleCategory')}
              </h3>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              {t('inventory.deleteModal.msgCategory')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="btn btn-secondary"
                disabled={submitting}
              >
                {t('inventory.deleteModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="btn btn-danger"
                disabled={submitting}
              >
                {submitting ? t('inventory.deleteModal.deleting') : t('inventory.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
