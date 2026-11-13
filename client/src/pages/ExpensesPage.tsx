import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign,
  TrendingDown,
  Layers,
  Plus,
  Search,
  RotateCcw,
  Edit2,
  Trash2,
  Receipt,
  X,
  AlertTriangle,
  Eye,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Tag,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../core/context/AuthContext';
import { useModule } from '../core/context/ModuleContext';
import { useToast } from '../core/context/ToastContext';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Tooltip } from '../components/common/Tooltip';
import { Pagination } from '../components/common/Pagination';
import { DateRangePicker, DateRange } from '../components/common/DateRangePicker';
import { formatDate, formatCurrency } from '../core/utils/dateUtils';
import { ViewExpenseModal } from '../components/expenses/ViewExpenseModal';
import { paymentMethodService, PaymentMethodItem } from '../services/paymentMethodService';

export interface ExpenseSubcategory {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: { id: string; name: string };
  _count?: { expenses: number };
  totalAmount?: number;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  branchId?: string;
  branch?: { id: string; name: string; code?: string };
  _count?: { expenses: number; subcategories?: number };
  totalAmount?: number;
  subcategories?: ExpenseSubcategory[];
}

interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number | string;
  expenseDate: string;
  paymentMethod: string;
  branchId: string;
  categoryId: string;
  subcategoryId?: string;
  category?: { id: string; name: string };
  subcategory?: { id: string; name: string };
  branch?: { id: string; name: string; code?: string };
  createdBy?: { id: string; name: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

interface ExpenseMetrics {
  totalExpenses: number;
  averageExpense: number;
  expenseCount: number;
}


function getInitialDateRange(): DateRange {
  return {
    startDate: '',
    endDate: '',
  };
}

export const ExpensesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, isTenantAdmin, isLabAdmin, loading: authLoading } = useAuth();
  const { activeModuleMode, enabledModules } = useModule();
  const toast = useToast();

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

  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [configuredPaymentMethods, setConfiguredPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [metrics, setMetrics] = useState<ExpenseMetrics>({
    totalExpenses: 0,
    averageExpense: 0,
    expenseCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Category pagination state
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(15);

  // Expanded categories accordion map
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Modal states
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    expenseDate: new Date().toISOString().split('T')[0],
    title: '',
    categoryId: '',
    subcategoryId: '',
    description: '',
    amount: '',
    paymentMethod: 'BBVA Crédito',
    branchId: '',
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    branchId: '',
  });

  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<ExpenseSubcategory | null>(null);
  const [subcategoryForm, setSubcategoryForm] = useState({
    categoryId: '',
    name: '',
    description: '',
  });

  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategory | null>(null);
  const [deletingSubcategory, setDeletingSubcategory] = useState<ExpenseSubcategory | null>(null);
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
    setSelectedSubcategory('all');
    setPage(1);
    setCategoryPage(1);
  }, [currentModuleKey]);

  // Paginated categories
  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * categoryPageSize;
    return categories.slice(start, start + categoryPageSize);
  }, [categories, categoryPage, categoryPageSize]);

  // Load categories
  const fetchCategories = useCallback(async () => {
    if (authLoading || !user) return;
    if (!isTenantAdmin && user.allowedModules && user.allowedModules.length > 0) {
      if (!user.allowedModules.includes(currentModuleKey)) {
        return; // Guard against premature fetching while module context is synchronizing
      }
    }
    try {
      const res = await api.get('/expenses/categories', {
        params: {
          branchId: selectedBranch !== 'all' ? selectedBranch : undefined,
          moduleKey: currentModuleKey,
        },
      });
      const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setCategories(list);
    } catch (err) {
      console.error('Failed to load expense categories:', err);
    }
  }, [authLoading, user, isTenantAdmin, selectedBranch, currentModuleKey]);

  // Load expenses & metrics
  const fetchExpenses = useCallback(async () => {
    if (authLoading || !user) return;
    if (!isTenantAdmin && user.allowedModules && user.allowedModules.length > 0) {
      if (!user.allowedModules.includes(currentModuleKey)) {
        return; // Guard against premature fetching while module context is synchronizing
      }
    }
    setLoading(true);
    try {
      const res = await api.get('/expenses', {
        params: {
          search: search.trim() || undefined,
          categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
          subcategoryId: selectedSubcategory !== 'all' ? selectedSubcategory : undefined,
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
          branchId: selectedBranch !== 'all' ? selectedBranch : undefined,
          moduleKey: currentModuleKey,
          page,
          limit: pageSize,
        },
      });

      const rawData = res.data?.data || res.data;
      setExpenses(rawData?.expenses || []);
      if (rawData?.metrics) {
        setMetrics(rawData.metrics);
      }
      if (rawData?.pagination) {
        setTotalPages(rawData.pagination.totalPages || 1);
        setTotalItems(rawData.pagination.total || 0);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
      toast.error(t('expenses.toast.errorExpense'));
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, isTenantAdmin, search, selectedCategory, selectedSubcategory, dateRange, selectedBranch, currentModuleKey, page, pageSize, toast, t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchPaymentMethods = useCallback(async (branchId?: string) => {
    try {
      const list = await paymentMethodService.getAll({
        branchId: branchId && branchId !== 'all' ? branchId : undefined,
        moduleKey: currentModuleKey,
        activeOnly: true,
        type: 'EXPENSE',
      });
      setConfiguredPaymentMethods(list);
    } catch (err) {
      console.error('Failed to load payment methods for expenses:', err);
    }
  }, [currentModuleKey]);

  useEffect(() => {
    const branchForPm = selectedBranch !== 'all' ? selectedBranch : (user?.activeBranchId || availableBranches[0]?.id);
    if (branchForPm) {
      fetchPaymentMethods(branchForPm);
    }
  }, [fetchPaymentMethods, selectedBranch, user?.activeBranchId, availableBranches]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedSubcategory('all');
    setSelectedBranch('all');
    setDateRange(getInitialDateRange());
    setPage(1);
  };

  // Open Add/Edit Expense Modal
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      expenseDate: new Date().toISOString().split('T')[0],
      title: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      subcategoryId: '',
      description: '',
      amount: '',
      paymentMethod: paymentMethodOptions.length > 0 ? paymentMethodOptions[0].value : (configuredPaymentMethods.find((pm) => !pm.type || pm.type === 'EXPENSE' || pm.type === 'BOTH')?.name || ''),
      branchId: user?.activeBranchId || availableBranches[0]?.id || '',
    });
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      expenseDate: expense.expenseDate ? expense.expenseDate.split('T')[0] : '',
      title: expense.title,
      categoryId: expense.categoryId,
      subcategoryId: expense.subcategoryId || '',
      description: expense.description || '',
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      branchId: expense.branchId,
    });
    setIsExpenseModalOpen(true);
  };

  // Submit Expense Form
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || !expenseForm.categoryId || !expenseForm.amount) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: expenseForm.title.trim(),
        categoryId: expenseForm.categoryId,
        subcategoryId: expenseForm.subcategoryId || undefined,
        amount: parseFloat(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        paymentMethod: expenseForm.paymentMethod,
        description: expenseForm.description.trim() || undefined,
        branchId: isTenantAdmin && expenseForm.branchId ? expenseForm.branchId : undefined,
        moduleKey: currentModuleKey,
      };

      if (editingExpense) {
        await api.patch(`/expenses/${editingExpense.id}`, payload);
        toast.success(t('expenses.toast.updatedExpense'));
      } else {
        await api.post('/expenses', payload);
        toast.success(t('expenses.toast.createdExpense'));
      }

      setIsExpenseModalOpen(false);
      fetchExpenses();
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('expenses.toast.errorExpense');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Expense (Tenant Admin only)
  const handleConfirmDeleteExpense = async () => {
    if (!deletingExpense) return;
    setSubmitting(true);
    try {
      await api.delete(`/expenses/${deletingExpense.id}`);
      toast.success(t('expenses.toast.deletedExpense'));
      setDeletingExpense(null);
      fetchExpenses();
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('expenses.toast.errorExpense');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Add/Edit Category Modal
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      description: '',
      branchId: user?.activeBranchId || availableBranches[0]?.id || '',
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ExpenseCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
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
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        branchId: isTenantAdmin && categoryForm.branchId ? categoryForm.branchId : undefined,
        moduleKey: currentModuleKey,
      };

      if (editingCategory) {
        await api.patch(`/expenses/categories/${editingCategory.id}`, payload);
        toast.success(t('expenses.toast.updatedCategory'));
      } else {
        await api.post('/expenses/categories', payload);
        toast.success(t('expenses.toast.createdCategory'));
      }

      setIsCategoryModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('expenses.toast.errorCategory');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Category (Tenant Admin only)
  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setSubmitting(true);
    try {
      await api.delete(`/expenses/categories/${deletingCategory.id}`);
      toast.success(t('expenses.toast.deletedCategory'));
      setDeletingCategory(null);
      fetchCategories();
      fetchExpenses();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('expenses.toast.errorCategory');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Subcategory Actions
  const toggleExpandCategory = (catId: string) => {
    setExpandedCategories((p) => ({ ...p, [catId]: !p[catId] }));
  };

  const handleOpenAddSubcategory = (preselectedCatId?: string) => {
    setEditingSubcategory(null);
    setSubcategoryForm({
      categoryId: preselectedCatId || (categories.length > 0 ? categories[0].id : ''),
      name: '',
      description: '',
    });
    setIsSubcategoryModalOpen(true);
  };

  const handleOpenEditSubcategory = (sub: ExpenseSubcategory) => {
    setEditingSubcategory(sub);
    setSubcategoryForm({
      categoryId: sub.categoryId,
      name: sub.name,
      description: sub.description || '',
    });
    setIsSubcategoryModalOpen(true);
  };

  const handleSubmitSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcategoryForm.name.trim() || !subcategoryForm.categoryId) return;

    setSubmitting(true);
    try {
      const payload = {
        name: subcategoryForm.name.trim(),
        categoryId: subcategoryForm.categoryId,
        description: subcategoryForm.description.trim() || undefined,
      };

      if (editingSubcategory) {
        await api.patch(`/expenses/subcategories/${editingSubcategory.id}`, payload);
        toast.success(t('expenses.toast.updatedSubcategory'));
      } else {
        await api.post('/expenses/subcategories', payload);
        toast.success(t('expenses.toast.createdSubcategory'));
        setExpandedCategories((p) => ({ ...p, [subcategoryForm.categoryId]: true }));
      }

      setIsSubcategoryModalOpen(false);
      fetchCategories();
      fetchExpenses();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('expenses.toast.errorSubcategory');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeleteSubcategory = async () => {
    if (!deletingSubcategory) return;
    setSubmitting(true);
    try {
      await api.delete(`/expenses/subcategories/${deletingSubcategory.id}`);
      toast.success(t('expenses.toast.deletedSubcategory'));
      setDeletingSubcategory(null);
      fetchCategories();
      fetchExpenses();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('expenses.toast.errorSubcategory');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Select Options
  const categoryFilterOptions = [
    { value: 'all', label: t('expenses.filters.categoryAll') },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const subcategoryFilterOptions = useMemo(() => {
    if (selectedCategory === 'all') {
      const allSubs = categories.flatMap((c) => c.subcategories || []);
      return [
        { value: 'all', label: t('expenses.filters.subcategoryAll') },
        ...allSubs.map((s) => ({ value: s.id, label: s.name })),
      ];
    }
    const cat = categories.find((c) => c.id === selectedCategory);
    const subs = cat?.subcategories || [];
    return [
      { value: 'all', label: t('expenses.filters.subcategoryAll') },
      ...subs.map((s) => ({ value: s.id, label: s.name })),
    ];
  }, [categories, selectedCategory, t]);

  const expenseFormSubcategoryOptions = useMemo(() => {
    if (!expenseForm.categoryId) return [];
    const cat = categories.find((c) => c.id === expenseForm.categoryId);
    return (cat?.subcategories || []).map((s) => ({ value: s.id, label: s.name }));
  }, [categories, expenseForm.categoryId]);

  const branchFilterOptions = [
    { value: 'all', label: t('expenses.filters.branchAll') },
    ...availableBranches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const categoryFormOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const paymentMethodOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const pm of configuredPaymentMethods) {
      if (pm.type && pm.type !== 'EXPENSE' && pm.type !== 'BOTH') {
        continue;
      }
      const cleanName = pm.name?.trim();
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        options.push({
          value: cleanName,
          label: cleanName,
        });
      }
    }
    return options;
  }, [configuredPaymentMethods]);

  const branchFormOptions = availableBranches.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  return (
    <div style={{ paddingBottom: '60px' }}>
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
              <Receipt size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('expenses.managementTitle')}
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('expenses.subtitle')}
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
            onClick={() => setActiveTab('expenses')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'expenses' ? 'var(--primary-600)' : 'transparent',
              color: activeTab === 'expenses' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <DollarSign size={15} />
            <span>{t('expenses.tabs.expenses')}</span>
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
            <span>{t('expenses.tabs.categories')}</span>
          </button>
        </div>
      </div>

      {/* Primary Action Button (Lab Admin only; Tenant Admin can only view and delete) */}
      {!isTenantAdmin && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {activeTab === 'expenses' ? (
            <button
              type="button"
              onClick={handleOpenAddExpense}
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
              <span>{t('expenses.addExpense')}</span>
            </button>
          ) : (
            <>
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
                <span>{t('expenses.addCategory')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddSubcategory()}
                className="btn btn-secondary"
                disabled={categories.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                }}
              >
                <FolderPlus size={16} />
                <span>{t('expenses.addSubcategory')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Filters Bar (Only on Expenses Tab) */}
      {activeTab === 'expenses' && (
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
          {/* Search Input */}
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
              placeholder={t('expenses.filters.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ width: '190px' }}>
            <SearchableSelect
              options={categoryFilterOptions}
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                setSelectedSubcategory('all');
                setPage(1);
              }}
              placeholder={t('expenses.filters.categoryAll')}
            />
          </div>

          {/* Subcategory Filter */}
          <div style={{ width: '190px' }}>
            <SearchableSelect
              options={subcategoryFilterOptions}
              value={selectedSubcategory}
              onChange={(val) => {
                setSelectedSubcategory(val);
                setPage(1);
              }}
              placeholder={t('expenses.filters.subcategoryAll')}
            />
          </div>

          {/* Date Range Picker */}
          <div>
            <DateRangePicker
              value={dateRange}
              onChange={(newRange) => {
                setDateRange(newRange);
                setPage(1);
              }}
            />
          </div>

          {/* Branch Filter (Tenant Admin Only) */}
          {isTenantAdmin && (
            <div style={{ width: '180px' }}>
              <SearchableSelect
                options={branchFilterOptions}
                value={selectedBranch}
                onChange={(val) => {
                  setSelectedBranch(val);
                  setPage(1);
                }}
                placeholder={t('expenses.filters.branchAll')}
              />
            </div>
          )}

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
            <span>{t('expenses.filters.reset')}</span>
          </button>
        </div>
      )}

      {/* Metric Cards (matching Screenshot 1) */}
      {activeTab === 'expenses' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          {/* Total Expenses */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '20px 24px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-danger-bg)',
                color: 'var(--rose-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {t('expenses.metrics.totalExpenses')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                {formatCurrency(metrics.totalExpenses)}
              </div>
            </div>
          </div>

          {/* Average Expense */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '20px 24px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-info-bg)',
                color: 'var(--blue-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TrendingDown size={24} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {t('expenses.metrics.averageExpense')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                {formatCurrency(metrics.averageExpense)}
              </div>
            </div>
          </div>

          {/* Expense Count */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '20px 24px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'var(--badge-success-bg)',
                color: 'var(--emerald-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={24} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {t('expenses.metrics.expenseCount')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                {metrics.expenseCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'expenses' ? (
        /* Expenses Table */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.date')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.title')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.category')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.subcategory')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.amount')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.paymentMethod')}
                  </th>
                  {isTenantAdmin && (
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {t('expenses.fields.branch')}
                    </th>
                  )}
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>
                    {t('expenses.fields.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isTenantAdmin ? 8 : 7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={isTenantAdmin ? 8 : 7} style={{ padding: '50px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            backgroundColor: 'var(--bg-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '22px',
                            fontWeight: 700,
                          }}
                        >
                          $
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {t('expenses.emptyState.noExpenses')}
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: 0 }}>
                          {t('expenses.emptyState.noExpensesDesc')}
                        </p>
                        {!isTenantAdmin && (
                          <button onClick={handleOpenAddExpense} className="btn btn-primary" style={{ marginTop: '10px' }}>
                            + {t('expenses.addExpense')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {formatDate(expense.expenseDate, { locale: i18n.language === 'es' ? 'es-MX' : 'en-US' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div
                          onClick={() => setViewingExpense(expense)}
                          style={{
                            fontWeight: 600,
                            fontSize: '13.5px',
                            color: 'var(--text-heading)',
                            cursor: 'pointer',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-heading)')}
                        >
                          {expense.title}
                        </div>
                        {expense.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {expense.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            backgroundColor: 'var(--badge-primary-bg)',
                            color: 'var(--primary-600)',
                          }}
                        >
                          {expense.category?.name || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {expense.subcategory?.name ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              alignSelf: 'flex-start',
                              gap: '5px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 500,
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary-500)',
                                display: 'inline-block',
                              }}
                            />
                            {expense.subcategory.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                        {formatCurrency(expense.amount)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {expense.paymentMethod}
                      </td>
                      {isTenantAdmin && (
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {expense.branch?.name || '—'}
                        </td>
                      )}
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {/* View Expense Button (BOTH Lab Admin and Tenant Admin) */}
                          <Tooltip content={t('expenses.viewExpense')}>
                            <button
                              type="button"
                              onClick={() => setViewingExpense(expense)}
                              className="btn-icon"
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

                          {/* Edit Expense Button (Lab Admin ONLY — Tenant Admin can only view and delete) */}
                          {!isTenantAdmin && (
                            <Tooltip content={t('expenses.editExpense')}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditExpense(expense)}
                                className="btn-icon"
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

                          {/* Delete Expense Button (Tenant Admin ONLY) */}
                          {isTenantAdmin && (
                            <Tooltip content={t('expenses.deleteModal.titleExpense')}>
                              <button
                                type="button"
                                onClick={() => setDeletingExpense(expense)}
                                className="btn-icon"
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

          {/* Pagination */}
          {expenses.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          )}
        </div>
      ) : (
        /* Categories Table */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ width: '40px', padding: '10px 8px 10px 14px' }}></th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.categoryName')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.categoryDescription')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.subcategoriesCount')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.metrics.expenseCount')}
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t('expenses.fields.totalAmount')}
                  </th>
                  {isTenantAdmin && (
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {t('expenses.fields.branch')}
                    </th>
                  )}
                  <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>
                    {t('expenses.fields.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={isTenantAdmin ? 8 : 7} style={{ padding: '50px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            backgroundColor: 'var(--bg-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <Layers size={24} />
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {t('expenses.emptyState.noCategories')}
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: 0 }}>
                          {t('expenses.emptyState.noCategoriesDesc')}
                        </p>
                        {!isTenantAdmin && (
                          <button onClick={handleOpenAddCategory} className="btn btn-primary" style={{ marginTop: '10px' }}>
                            + {t('expenses.addCategory')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCategories.map((cat) => {
                    const isExpanded = Boolean(expandedCategories[cat.id]);
                    const subCount = cat.subcategories?.length || 0;

                    return (
                      <React.Fragment key={cat.id}>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background-color 0.15s ease',
                            backgroundColor: isExpanded ? 'var(--bg-surface)' : 'transparent',
                          }}
                        >
                          {/* Accordion Expand/Collapse Trigger */}
                          <td style={{ padding: '10px 8px 10px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => toggleExpandCategory(cat.id)}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>

                          {/* Category Name */}
                          <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '13.5px', color: 'var(--text-heading)' }}>
                            <div
                              onClick={() => toggleExpandCategory(cat.id)}
                              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <span>{cat.name}</span>
                            </div>
                          </td>

                          {/* Description */}
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            {cat.description || '—'}
                          </td>

                          {/* Subcategories Count Badge */}
                          <td style={{ padding: '10px 14px', fontSize: '13px' }}>
                            <button
                              type="button"
                              onClick={() => toggleExpandCategory(cat.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                backgroundColor: subCount > 0 ? 'var(--badge-info-bg, rgba(59, 130, 246, 0.1))' : 'var(--bg-surface)',
                                color: subCount > 0 ? 'var(--blue-600, #2563eb)' : 'var(--text-muted)',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                              }}
                            >
                              <FolderPlus size={12} />
                              <span>{subCount} {t('expenses.fields.subcategoriesCount')}</span>
                            </button>
                          </td>

                          {/* Expense Count */}
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>
                            {cat._count?.expenses || 0}
                          </td>

                          {/* Total Amount Tracked */}
                          <td style={{ padding: '10px 14px', fontSize: '13.5px', fontWeight: 700, color: 'var(--primary-600)', whiteSpace: 'nowrap' }}>
                            {formatCurrency(cat.totalAmount || 0)}
                          </td>

                          {/* Branch Scoping */}
                          {isTenantAdmin && (
                            <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                              {cat.branch?.name || t('expenses.filters.branchAll')}
                            </td>
                          )}

                          {/* Category Actions */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              {/* Quick Add Subcategory (Non-tenant admin only) */}
                              {!isTenantAdmin && (
                                <Tooltip content={t('expenses.addSubcategory')}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddSubcategory(cat.id)}
                                    className="btn-icon"
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
                                    <FolderPlus size={14} />
                                  </button>
                                </Tooltip>
                              )}

                              {/* Edit Category */}
                              {!isTenantAdmin && (
                                <Tooltip content={t('expenses.editCategory')}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditCategory(cat)}
                                    className="btn-icon"
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

                              {/* Delete Category (Tenant Admin ONLY) */}
                              {isTenantAdmin && (
                                <Tooltip content={t('expenses.deleteModal.titleCategory')}>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingCategory(cat)}
                                    className="btn-icon"
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

                        {/* Nested Subcategories Expansion Row */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: 'var(--bg-surface)' }}>
                            <td colSpan={isTenantAdmin ? 8 : 7} style={{ padding: '12px 20px 16px 48px' }}>
                              <div
                                style={{
                                  borderRadius: '10px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-card)',
                                  padding: '14px 18px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Tag size={15} style={{ color: 'var(--primary-600)' }} />
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)' }}>
                                      {t('expenses.subcategories')} ({subCount})
                                    </span>
                                  </div>
                                  {!isTenantAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddSubcategory(cat.id)}
                                      className="btn btn-secondary"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 12px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      <Plus size={13} />
                                      <span>{t('expenses.addSubcategory')}</span>
                                    </button>
                                  )}
                                </div>

                                {!cat.subcategories || cat.subcategories.length === 0 ? (
                                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    {t('expenses.noSubcategoriesFound')}
                                  </div>
                                ) : (
                                  <div className="table-responsive">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('expenses.fields.subcategoryName')}</th>
                                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('expenses.fields.subcategoryDescription')}</th>
                                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('expenses.metrics.expenseCount')}</th>
                                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('expenses.fields.totalAmount')}</th>
                                          <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>{t('expenses.fields.actions')}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {cat.subcategories.map((sub) => (
                                          <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-heading)' }}>
                                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-500)' }} />
                                                <span>{sub.name}</span>
                                              </div>
                                            </td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                                              {sub.description || '—'}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-main)', fontWeight: 600 }}>
                                              {sub._count?.expenses || 0}
                                            </td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--primary-600)', whiteSpace: 'nowrap' }}>
                                              {formatCurrency(sub.totalAmount || 0)}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                                {!isTenantAdmin && (
                                                  <Tooltip content={t('expenses.editSubcategory')}>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenEditSubcategory(sub)}
                                                      className="btn-icon"
                                                      style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        border: '1px solid var(--border-color)',
                                                        backgroundColor: 'var(--bg-surface)',
                                                        color: 'var(--text-main)',
                                                        cursor: 'pointer',
                                                      }}
                                                    >
                                                      <Edit2 size={12} />
                                                    </button>
                                                  </Tooltip>
                                                )}

                                                {isTenantAdmin && (
                                                  <Tooltip content={t('expenses.deleteModal.titleSubcategory')}>
                                                    <button
                                                      type="button"
                                                      onClick={() => setDeletingSubcategory(sub)}
                                                      className="btn-icon"
                                                      style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        border: '1px solid var(--badge-danger-border, #fecdd3)',
                                                        backgroundColor: 'var(--badge-danger-bg)',
                                                        color: 'var(--badge-danger-text, var(--rose-600))',
                                                        cursor: 'pointer',
                                                      }}
                                                    >
                                                      <Trash2 size={12} />
                                                    </button>
                                                  </Tooltip>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Category Pagination */}
          {categories.length > 0 && (
            <Pagination
              currentPage={categoryPage}
              totalPages={Math.ceil(categories.length / categoryPageSize) || 1}
              totalItems={categories.length}
              pageSize={categoryPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={(p) => setCategoryPage(p)}
              onPageSizeChange={(newSize) => {
                setCategoryPageSize(newSize);
                setCategoryPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* Add / Edit Expense Modal (matching LabProcessesPage standard) */}
      {isExpenseModalOpen && (
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
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: 'var(--bg-modal)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '680px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {editingExpense ? t('expenses.modals.editExpenseTitle') : t('expenses.modals.addExpenseTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {editingExpense ? t('expenses.modals.editExpenseSubtitle') : t('expenses.modals.addExpenseSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitExpense} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Row 1: Date, Title, Category, Subcategory */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px' }}>
                  {/* Expense Date */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.date')} *
                    </label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={expenseForm.expenseDate}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, expenseDate: e.target.value }))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.title')} *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder={t('expenses.placeholders.title')}
                      value={expenseForm.title}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, title: e.target.value }))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.category')} *
                    </label>
                    <SearchableSelect
                      options={categoryFormOptions}
                      value={expenseForm.categoryId}
                      onChange={(val) => setExpenseForm((p) => ({ ...p, categoryId: val, subcategoryId: '' }))}
                      placeholder={t('expenses.placeholders.selectCategory')}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Subcategory */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.subcategory')}
                    </label>
                    <SearchableSelect
                      options={expenseFormSubcategoryOptions}
                      value={expenseForm.subcategoryId}
                      onChange={(val) => setExpenseForm((p) => ({ ...p, subcategoryId: val }))}
                      placeholder={
                        !expenseForm.categoryId
                          ? t('expenses.placeholders.selectCategoryFirst')
                          : expenseFormSubcategoryOptions.length === 0
                          ? t('expenses.noSubcategories')
                          : t('expenses.placeholders.selectSubcategoryOptional')
                      }
                      disabled={!expenseForm.categoryId || expenseFormSubcategoryOptions.length === 0}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('expenses.fields.description')}
                  </label>
                  <textarea
                    rows={3}
                    className="input"
                    placeholder={t('expenses.placeholders.description')}
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                    style={{
                      width: '100%',
                      minHeight: '75px',
                      padding: '10px 12px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {/* Row 2: Amount & Payment Method */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Amount */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.amount')} *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: '12px',
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
                        min="0.01"
                        required
                        className="input"
                        placeholder={t('expenses.placeholders.amount')}
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                        style={{
                          width: '100%',
                          paddingLeft: '48px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.paymentMethod')} *
                    </label>
                    <SearchableSelect
                      options={paymentMethodOptions}
                      value={expenseForm.paymentMethod}
                      onChange={(val) => setExpenseForm((p) => ({ ...p, paymentMethod: val }))}
                      placeholder={t('expenses.placeholders.selectPaymentMethod')}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Branch selector if Tenant Admin */}
                {isTenantAdmin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.branch')} *
                    </label>
                    <SearchableSelect
                      options={branchFormOptions}
                      value={expenseForm.branchId}
                      onChange={(val) => setExpenseForm((p) => ({ ...p, branchId: val }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '28px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  {t('expenses.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting
                    ? t('expenses.buttons.submitting')
                    : editingExpense
                    ? t('expenses.buttons.saveChanges')
                    : t('expenses.buttons.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal (matching LabProcessesPage standard) */}
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
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: 'var(--bg-modal)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '520px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {editingCategory ? t('expenses.modals.editCategoryTitle') : t('expenses.modals.addCategoryTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {editingCategory ? t('expenses.modals.editCategorySubtitle') : t('expenses.modals.addCategorySubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitCategory} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Category Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('expenses.fields.categoryName')} *
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder={t('expenses.placeholders.categoryName')}
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Category Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('expenses.fields.categoryDescription')}
                  </label>
                  <textarea
                    rows={3}
                    className="input"
                    placeholder={t('expenses.placeholders.categoryDescription')}
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '10px 12px',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {/* Branch selector if Tenant Admin */}
                {isTenantAdmin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                      {t('expenses.fields.branch')}
                    </label>
                    <SearchableSelect
                      options={[{ value: '', label: t('expenses.filters.branchAll') }, ...branchFormOptions]}
                      value={categoryForm.branchId}
                      onChange={(val) => setCategoryForm((p) => ({ ...p, branchId: val }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '28px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  {t('expenses.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting
                    ? t('expenses.buttons.submitting')
                    : editingCategory
                    ? t('expenses.buttons.saveChanges')
                    : t('expenses.buttons.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Modal (Tenant Admin ONLY) */}
      {deletingExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: 'var(--bg-modal)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                color: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 8px 0' }}>
              {t('expenses.deleteModal.titleExpense')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              {t('expenses.deleteModal.msgExpense')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                }}
              >
                {t('expenses.deleteModal.cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeleteExpense}
                className="btn btn-danger"
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                }}
              >
                {submitting ? t('expenses.deleteModal.deleting') : t('expenses.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Modal (Tenant Admin ONLY) */}
      {deletingCategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: 'var(--bg-modal)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                color: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 8px 0' }}>
              {t('expenses.deleteModal.titleCategory')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              {t('expenses.deleteModal.msgCategory')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                }}
              >
                {t('expenses.deleteModal.cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeleteCategory}
                className="btn btn-danger"
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                }}
              >
                {submitting ? t('expenses.deleteModal.deleting') : t('expenses.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Subcategory Modal */}
      {isSubcategoryModalOpen && (
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
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: 'var(--bg-modal)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '520px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                  {editingSubcategory ? t('expenses.modals.editSubcategoryTitle') : t('expenses.modals.addSubcategoryTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {editingSubcategory ? t('expenses.modals.editSubcategorySubtitle') : t('expenses.modals.addSubcategorySubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSubcategoryModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitSubcategory} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Parent Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('expenses.fields.parentCategory')} *
                  </label>
                  <SearchableSelect
                    options={categoryFormOptions}
                    value={subcategoryForm.categoryId}
                    onChange={(val) => setSubcategoryForm((p) => ({ ...p, categoryId: val }))}
                    placeholder={t('expenses.placeholders.selectCategory')}
                    disabled={Boolean(editingSubcategory)}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Subcategory Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('expenses.fields.subcategoryName')} *
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder={t('expenses.placeholders.subcategoryName')}
                    value={subcategoryForm.name}
                    onChange={(e) => setSubcategoryForm((p) => ({ ...p, name: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '6px' }}>
                    {t('expenses.fields.subcategoryDescription')}
                  </label>
                  <textarea
                    rows={3}
                    className="input"
                    placeholder={t('expenses.placeholders.subcategoryDescription')}
                    value={subcategoryForm.description}
                    onChange={(e) => setSubcategoryForm((p) => ({ ...p, description: e.target.value }))}
                    style={{
                      width: '100%',
                      minHeight: '75px',
                      padding: '10px 12px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '28px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsSubcategoryModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  {t('expenses.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting
                    ? t('expenses.buttons.submitting')
                    : editingSubcategory
                    ? t('expenses.buttons.saveChanges')
                    : t('expenses.buttons.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Subcategory Modal (Tenant Admin ONLY) */}
      {deletingSubcategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: 'var(--bg-modal)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                color: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 8px 0' }}>
              {t('expenses.deleteModal.titleSubcategory')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              {t('expenses.deleteModal.msgSubcategory')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeletingSubcategory(null)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                }}
              >
                {t('expenses.deleteModal.cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeleteSubcategory}
                className="btn btn-danger"
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                }}
              >
                {submitting ? t('expenses.deleteModal.deleting') : t('expenses.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Expense Modal (Both Lab Admin and Tenant Admin) */}
      <ViewExpenseModal
        expense={viewingExpense}
        isOpen={Boolean(viewingExpense)}
        onClose={() => setViewingExpense(null)}
        onEdit={(exp) => {
          handleOpenEditExpense(exp);
        }}
        onDelete={(exp) => {
          setDeletingExpense(exp);
        }}
        isTenantAdmin={isTenantAdmin}
      />
    </div>
  );
};
