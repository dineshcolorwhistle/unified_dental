import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Percent,
  TrendingDown,
  Users,
  Building2,
  FileText,
  Search,
  List,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../core/context/AuthContext';
import { useModule } from '../core/context/ModuleContext';
import { useToast } from '../core/context/ToastContext';
import { formatCurrency } from '../core/utils/dateUtils';
import {
  financeService,
  type FinanceOverviewResponse,
  type DoctorBalancesResponse,
  type DoctorListsResponse,
} from '../services/finance.service';
import { MonthlyTrendChart } from '../components/finance/MonthlyTrendChart';
import { PaymentStatusDonut } from '../components/finance/PaymentStatusDonut';
import { DoctorOrdersModal } from '../components/finance/DoctorOrdersModal';
import { DoctorListBreakdownModal } from '../components/finance/DoctorListBreakdownModal';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { DateRangePicker, type DateRange } from '../components/common/DateRangePicker';
import api from '../services/api';

type TabKey = 'overview' | 'doctorBalances' | 'doctorLists';

interface BranchOption {
  id: string;
  name: string;
}

function getInitialDateRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return {
    startDate: toYMD(start),
    endDate: toYMD(end),
  };
}

export const FinancePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isTenantAdmin } = useAuth();
  const { activeModuleMode } = useModule();
  const toast = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Common Filters: Branch & Date Range (shared by all 3 tabs)
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange);

  const startDate = dateRange.startDate;
  const endDate = dateRange.endDate;

  // Overview data
  const [overviewData, setOverviewData] = useState<FinanceOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Doctor Balances data
  const [doctorData, setDoctorData] = useState<DoctorBalancesResponse | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorOnlyPending, setDoctorOnlyPending] = useState(false);
  const [doctorPage, setDoctorPage] = useState(1);

  // Doctor Lists data
  const [listsData, setListsData] = useState<DoctorListsResponse | null>(null);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsSearch, setListsSearch] = useState('');
  const [listsPage, setListsPage] = useState(1);

  // Modals
  const [viewOrdersDoctor, setViewOrdersDoctor] = useState<{ id: string; name: string; clinicName: string | null } | null>(null);
  const [viewBreakdownList, setViewBreakdownList] = useState<{ id: string; name: string; description: string | null } | null>(null);

  const moduleKey = activeModuleMode === 'PLATFORM' ? 'LAB' : activeModuleMode || 'LAB';

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const { data } = await api.get('/branches', { params: { moduleKey } });
        const list = (data?.branches || data || []).filter((b: any) => b.status === 'ACTIVE');
        setBranches(list.map((b: any) => ({ id: b.id, name: b.name })));
      } catch {
        // ignore
      }
    };
    loadBranches();
  }, [moduleKey]);

  // Resolve assigned branch name cleanly (guaranteed to never show raw UUID)
  const assignedBranchName = useMemo(() => {
    if (user?.availableBranches && user.availableBranches.length > 0) {
      const match = user.availableBranches.find(
        (b) => b.id === user.activeBranchId || b.id === selectedBranchId
      );
      if (match?.name) return match.name;
      if (user.availableBranches[0]?.name) return user.availableBranches[0].name;
    }
    const fromBranches = branches.find((b) => b.id === selectedBranchId || b.id === user?.activeBranchId);
    if (fromBranches?.name) return fromBranches.name;
    if (branches.length > 0 && branches[0]?.name) return branches[0].name;
    return t('finance.controls.myBranch', 'Main Branch');
  }, [user, branches, selectedBranchId, t]);

  // Fetch Overview
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const result = await financeService.getOverview({
        branchId: selectedBranchId,
        moduleKey,
        startDate,
        endDate,
      });
      setOverviewData(result);
    } catch {
      toast.error(t('finance.overview.loadFailed'));
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedBranchId, moduleKey, startDate, endDate]);

  // Fetch Doctor Balances
  const fetchDoctorBalances = useCallback(async () => {
    setDoctorLoading(true);
    try {
      const result = await financeService.getDoctorBalances({
        branchId: selectedBranchId,
        moduleKey,
        startDate,
        endDate,
        search: doctorSearch || undefined,
        onlyPending: doctorOnlyPending || undefined,
        page: doctorPage,
        pageSize: 20,
      });
      setDoctorData(result);
    } catch {
      toast.error(t('finance.doctorBalances.loadFailed'));
    } finally {
      setDoctorLoading(false);
    }
  }, [selectedBranchId, moduleKey, startDate, endDate, doctorSearch, doctorOnlyPending, doctorPage]);

  // Fetch Doctor Lists
  const fetchDoctorLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const result = await financeService.getDoctorLists({
        branchId: selectedBranchId,
        moduleKey,
        startDate,
        endDate,
        search: listsSearch || undefined,
        page: listsPage,
        pageSize: 20,
      });
      setListsData(result);
    } catch {
      toast.error(t('finance.doctorLists.loadFailed'));
    } finally {
      setListsLoading(false);
    }
  }, [selectedBranchId, moduleKey, startDate, endDate, listsSearch, listsPage]);

  // Load data when tab changes or when common filters change
  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'doctorBalances') fetchDoctorBalances();
    else if (activeTab === 'doctorLists') fetchDoctorLists();
  }, [activeTab, fetchOverview, fetchDoctorBalances, fetchDoctorLists]);

  // Branch options for selector
  const branchOptions = useMemo(() => {
    const opts = [{ value: 'all', label: t('finance.controls.allBranches') }];
    branches.forEach((b) => opts.push({ value: b.id, label: b.name }));
    return opts;
  }, [branches, t]);

  // Reset Common & Tab Filters
  const handleResetFilters = () => {
    setSelectedBranchId('all');
    setDateRange(getInitialDateRange());
    setDoctorSearch('');
    setDoctorOnlyPending(false);
    setDoctorPage(1);
    setListsSearch('');
    setListsPage(1);
  };

  // ──────── KPI Card Helper ────────
  const KpiCard = ({
    label,
    value,
    icon,
    color,
    bg,
  }: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    bg: string;
  }) => (
    <div
      className="card"
      style={{
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flex: '1 1 0',
        minWidth: '160px',
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          backgroundColor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
          {value}
        </div>
      </div>
    </div>
  );

  // ──────── Branch Bar Chart Helper (SVG) ────────
  const BranchBarChart = ({
    data,
    title,
    icon,
    mode,
  }: {
    data: { branchName: string; revenue?: number; collected?: number; outstanding?: number }[];
    title: string;
    icon: React.ReactNode;
    mode: 'revenue' | 'collectionsVsOutstanding';
  }) => {
    const width = 460;
    const height = 230;
    const pad = { top: 20, right: 20, bottom: mode === 'collectionsVsOutstanding' ? 52 : 36, left: 70 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const baselineY = pad.top + chartH;
    const barW = Math.min(48, Math.max(16, (chartW / Math.max(data.length, 1)) * 0.45));

    let maxVal = 1;
    if (mode === 'revenue') {
      maxVal = Math.max(...data.map((d) => d.revenue || 0), 1);
    } else {
      maxVal = Math.max(...data.flatMap((d) => [d.collected || 0, d.outstanding || 0]), 1);
    }

    const yTicks = 4;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
      const val = (maxVal / yTicks) * i;
      const y = baselineY - (val / maxVal) * chartH;
      return { val, y };
    });

    return (
      <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ color: 'var(--primary-600)' }}>{icon}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>{title}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {yLabels.map((yl, i) => (
              <g key={i}>
                <line
                  x1={pad.left}
                  y1={yl.y}
                  x2={width - pad.right}
                  y2={yl.y}
                  stroke="var(--border-subtle, #e2e8f0)"
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                />
                <text x={pad.left - 8} y={yl.y + 3.5} textAnchor="end" fontSize="8.5" fill="var(--text-muted)">
                  {formatCurrency(yl.val)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const slotW = chartW / Math.max(data.length, 1);
              const groupCenterX = pad.left + slotW * i + slotW / 2;
              const displayName = d.branchName.length > 14 ? d.branchName.slice(0, 13) + '…' : d.branchName;

              if (mode === 'revenue') {
                const barH = ((d.revenue || 0) / maxVal) * chartH;
                const barX = groupCenterX - barW / 2;
                return (
                  <g key={i}>
                    <rect
                      x={barX}
                      y={baselineY - barH}
                      width={barW}
                      height={barH}
                      rx={3}
                      fill="#3b82f6"
                    />
                    <text
                      x={groupCenterX}
                      y={baselineY + 16}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight={500}
                      fill="var(--text-muted)"
                    >
                      {displayName}
                    </text>
                  </g>
                );
              }

              const collH = ((d.collected || 0) / maxVal) * chartH;
              const outH = ((d.outstanding || 0) / maxVal) * chartH;
              const halfBar = barW * 0.9;
              const groupLeft = groupCenterX - halfBar - 2;

              return (
                <g key={i}>
                  <rect
                    x={groupLeft}
                    y={baselineY - collH}
                    width={halfBar}
                    height={collH}
                    rx={2.5}
                    fill="#10b981"
                  />
                  <rect
                    x={groupLeft + halfBar + 4}
                    y={baselineY - outH}
                    width={halfBar}
                    height={outH}
                    rx={2.5}
                    fill="#f59e0b"
                  />
                  <text
                    x={groupCenterX}
                    y={baselineY + 16}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={500}
                    fill="var(--text-muted)"
                  >
                    {displayName}
                  </text>
                </g>
              );
            })}

            {mode === 'collectionsVsOutstanding' && (
              <g transform={`translate(${pad.left}, ${height - 12})`}>
                <rect x={0} y={-7} width={8} height={8} rx={2} fill="#10b981" />
                <text x={12} y={0} fontSize="8.5" fontWeight={500} fill="var(--text-muted)">
                  {t('finance.overview.paidCollections')}
                </text>
                <rect x={155} y={-7} width={8} height={8} rx={2} fill="#f59e0b" />
                <text x={167} y={0} fontSize="8.5" fontWeight={500} fill="var(--text-muted)">
                  {t('finance.overview.outstandingLabel')}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    );
  };

  // ──────── Tab Badge Count ────────
  const doctorBadgeCount = doctorData?.kpis?.doctorsWithPending || 0;
  const listsBadgeCount = listsData?.pagination?.totalItems ?? listsData?.items?.length ?? 0;

  return (
    <div>
      {/* ────── Page Header & Tab Navigation in Top Row ────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'var(--badge-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600)',
            }}
          >
            <CreditCard size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', margin: 0, letterSpacing: '-0.02em' }}>
              {t('finance.pageTitle', 'Finance & Accounts')}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t('finance.pageSubtitle', 'Monitor revenue, collections, outstanding balances, and doctor payment analytics.')}
            </p>
          </div>
        </div>

        {/* Tab Switcher Segmented Control */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            gap: '4px',
          }}
        >
          {[
            { key: 'overview' as TabKey, label: t('finance.tabs.overview'), icon: <TrendingUp size={14} />, badge: null },
            { key: 'doctorBalances' as TabKey, label: t('finance.tabs.doctorBalances'), icon: <Users size={14} />, badge: doctorBadgeCount > 0 ? doctorBadgeCount : null },
            { key: 'doctorLists' as TabKey, label: t('finance.tabs.doctorLists'), icon: <List size={14} />, badge: listsBadgeCount > 0 ? listsBadgeCount : null },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 15px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: activeTab === tab.key ? 'var(--primary-600)' : 'transparent',
                color: activeTab === tab.key ? '#ffffff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span
                  style={{
                    backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--badge-danger-bg)',
                    color: activeTab === tab.key ? '#fff' : 'var(--badge-danger-text, #ef4444)',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ────── Unified Common Filter Bar (Branch + Date Range + Reset + Tab Search) ────── */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: '22px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Branch Filter (Tenant Admin: Dropdown; Lab Admin: Clean Branch Badge) */}
          {isTenantAdmin ? (
            <div style={{ width: '220px' }}>
              <SearchableSelect
                options={branchOptions}
                value={selectedBranchId}
                onChange={(val) => {
                  setSelectedBranchId(val);
                  setDoctorPage(1);
                  setListsPage(1);
                }}
                icon={<Building2 size={15} style={{ color: 'var(--primary-600)' }} />}
                placeholder={t('finance.controls.allBranches')}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-muted, rgba(0, 0, 0, 0.02))',
                border: '1px solid var(--border-color)',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-main)',
              }}
            >
              <Building2 size={15} style={{ color: 'var(--primary-600)' }} />
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                {t('common.branch', 'Branch')}:
              </span>
              <span style={{ color: 'var(--text-heading)', fontWeight: 700 }}>
                {assignedBranchName}
              </span>
            </div>
          )}

          {/* Date Range Picker (Exact Expense Module Component) */}
          <div>
            <DateRangePicker
              value={dateRange}
              onChange={(newRange) => {
                setDateRange(newRange);
                setDoctorPage(1);
                setListsPage(1);
              }}
            />
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={13} />
            <span>{t('finance.controls.reset')}</span>
          </button>
        </div>

        {/* Right side tab-specific quick search & filters */}
        {activeTab === 'overview' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: isTenantAdmin && selectedBranchId === 'all' ? 'var(--primary-600)' : 'var(--text-muted)',
              backgroundColor: isTenantAdmin && selectedBranchId === 'all' ? 'var(--badge-primary-bg)' : 'transparent',
              padding: isTenantAdmin && selectedBranchId === 'all' ? '4px 12px' : '0',
              borderRadius: '20px',
              border: isTenantAdmin && selectedBranchId === 'all' ? '1px solid rgba(13, 148, 136, 0.2)' : 'none',
            }}
          >
            {isTenantAdmin && selectedBranchId === 'all' ? (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-600)' }} />
                <span>{t('finance.overview.allBranchesConsolidated')}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                {t('finance.overview.activeBranchFilter')}
              </span>
            )}
          </div>
        )}

        {activeTab === 'doctorBalances' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                placeholder={t('finance.doctorBalances.searchPlaceholder')}
                value={doctorSearch}
                onChange={(e) => { setDoctorSearch(e.target.value); setDoctorPage(1); }}
                style={{ paddingLeft: '32px', fontSize: '12px', width: '220px' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={doctorOnlyPending}
                onChange={(e) => { setDoctorOnlyPending(e.target.checked); setDoctorPage(1); }}
                style={{ cursor: 'pointer' }}
              />
              {t('finance.doctorBalances.onlyPending')}
            </label>
          </div>
        )}

        {activeTab === 'doctorLists' && (
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              placeholder={t('finance.doctorLists.searchPlaceholder')}
              value={listsSearch}
              onChange={(e) => { setListsSearch(e.target.value); setListsPage(1); }}
              style={{ paddingLeft: '32px', fontSize: '12px', width: '240px' }}
            />
          </div>
        )}
      </div>

      {/* ────── TAB 1: OVERVIEW ────── */}
      {activeTab === 'overview' && (
        <div>
          {overviewLoading && !overviewData ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
          ) : overviewData ? (
            <>
              {/* 5 KPI Cards */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <KpiCard label={t('finance.overview.totalRevenue')} value={formatCurrency(overviewData.kpis.totalRevenue)} icon={<TrendingUp size={20} />} color="var(--primary-600)" bg="var(--badge-primary-bg)" />
                <KpiCard label={t('finance.overview.totalCollected')} value={formatCurrency(overviewData.kpis.totalCollected)} icon={<DollarSign size={20} />} color="#10b981" bg="var(--badge-success-bg)" />
                <KpiCard label={t('finance.overview.outstanding')} value={formatCurrency(overviewData.kpis.outstanding)} icon={<AlertTriangle size={20} />} color="#f59e0b" bg="var(--badge-warning-bg)" />
                <KpiCard label={t('finance.overview.collectionPercent')} value={`${overviewData.kpis.collectionPercentage}%`} icon={<Percent size={20} />} color="#8b5cf6" bg="rgba(139, 92, 246, 0.1)" />
                <KpiCard label={t('finance.overview.pendingPayments')} value={overviewData.kpis.pendingPayments} icon={<TrendingDown size={20} />} color="#ef4444" bg="var(--badge-danger-bg)" />
              </div>

              {/* Charts */}
              {overviewData.isAllBranches && overviewData.branchCharts ? (
                <>
                  {/* 2x2 Analytics Grid for Tenant Admin All Branches */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '16px',
                      marginBottom: '24px',
                    }}
                  >
                    {/* Card 1: Monthly Revenue & Collections Trend */}
                    <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <TrendingUp size={16} style={{ color: 'var(--primary-600)' }} />
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {t('finance.overview.monthlyTrend')}
                        </span>
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MonthlyTrendChart data={overviewData.monthlyTrend} />
                      </div>
                    </div>

                    {/* Card 2: Revenue by Branch */}
                    <BranchBarChart
                      data={overviewData.branchCharts.revenueByBranch}
                      title={t('finance.overview.revenueByBranch')}
                      icon={<Building2 size={16} />}
                      mode="revenue"
                    />

                    {/* Card 3: Collections vs Outstanding by Branch */}
                    <BranchBarChart
                      data={overviewData.branchCharts.collectionsVsOutstandingByBranch}
                      title={t('finance.overview.collectionsVsOutstanding')}
                      icon={<BarChart3 size={16} />}
                      mode="collectionsVsOutstanding"
                    />

                    {/* Card 4: % Payment Status Distribution */}
                    <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Percent size={16} style={{ color: 'var(--primary-600)' }} />
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {t('finance.overview.paymentStatusDist')}
                        </span>
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px' }}>
                        <PaymentStatusDonut data={overviewData.paymentDistribution} />
                      </div>
                    </div>
                  </div>

                  {/* Branch Financial Performance Table */}
                  {overviewData.branchPerformance.length > 0 && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} style={{ color: 'var(--primary-600)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>{t('finance.overview.branchFinancialPerf')}</span>
                      </div>
                      <div className="table-responsive">
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                              {[t('finance.overview.branch'), t('finance.overview.quotedRevenue'), t('finance.overview.collectedPaid'), t('finance.overview.outstandingLabel'), t('finance.overview.collectionPercentCol'), t('finance.overview.paidWO'), t('finance.overview.pendingWO')].map((h, i) => (
                                <th key={i} style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {overviewData.branchPerformance.map((bp) => (
                              <tr key={bp.branchId} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                                <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, verticalAlign: 'middle' }}>{bp.branchName}</td>
                                <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>{formatCurrency(bp.quoted)}</td>
                                <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: '#10b981' }}>{formatCurrency(bp.collected)}</td>
                                <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: bp.outstanding > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(bp.outstanding)}</td>
                                <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: bp.collectionPercentage > 50 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{bp.collectionPercentage}%</td>
                                <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>{bp.paidCount}</td>
                                <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>{bp.pendingCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Single Branch Mode (Lab Admin or Tenant Admin viewing specific branch) */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                  }}
                >
                  <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <TrendingUp size={16} style={{ color: 'var(--primary-600)' }} />
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>{t('finance.overview.monthlyTrend')}</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MonthlyTrendChart data={overviewData.monthlyTrend} />
                    </div>
                  </div>
                  <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Percent size={16} style={{ color: 'var(--primary-600)' }} />
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>{t('finance.overview.paymentStatusDist')}</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px' }}>
                      <PaymentStatusDonut data={overviewData.paymentDistribution} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ────── TAB 2: DOCTOR BALANCES ────── */}
      {activeTab === 'doctorBalances' && (
        <div>
          {/* 4 KPI Cards */}
          {doctorData && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <KpiCard label={t('finance.doctorBalances.totalOutstandingBalance')} value={formatCurrency(doctorData.kpis.totalOutstandingBalance)} icon={<AlertTriangle size={20} />} color="#ef4444" bg="var(--badge-danger-bg)" />
              <KpiCard label={t('finance.doctorBalances.doctorsWithPendingBalance')} value={`${doctorData.kpis.doctorsWithPending} / ${doctorData.kpis.totalDoctors}`} icon={<Users size={20} />} color="#f59e0b" bg="var(--badge-warning-bg)" />
              <KpiCard label={t('finance.doctorBalances.quotedRevenue')} value={formatCurrency(doctorData.kpis.quotedRevenue)} icon={<TrendingUp size={20} />} color="#3b82f6" bg="rgba(59, 130, 246, 0.1)" />
              <KpiCard label={t('finance.doctorBalances.totalCollected')} value={formatCurrency(doctorData.kpis.totalCollected)} icon={<DollarSign size={20} />} color="#10b981" bg="var(--badge-success-bg)" />
            </div>
          )}

          {/* Table Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>{t('finance.doctorBalances.sectionTitle')}</span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{t('finance.doctorBalances.sectionSubtitle')}</p>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    {[t('finance.doctorBalances.doctor'), t('finance.doctorBalances.clinic'), t('finance.doctorBalances.totalOrders'), t('finance.doctorBalances.quoted'), t('finance.doctorBalances.collected'), t('finance.doctorBalances.outstandingCol'), t('finance.doctorBalances.status')].map((h, i) => (
                      <th key={i} style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                    ))}
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>{t('finance.doctorBalances.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorLoading ? (
                    <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</td></tr>
                  ) : !doctorData || doctorData.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>{t('finance.doctorBalances.noData')}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('finance.doctorBalances.noDataDesc')}</div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {doctorData.items.map((doc) => (
                        <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                          <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, verticalAlign: 'middle', color: 'var(--text-heading)' }}>{doc.name}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: 'var(--text-muted)' }}>{doc.clinicName || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>{doc.totalOrders}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>{formatCurrency(doc.quoted)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: '#10b981' }}>{formatCurrency(doc.collected)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: doc.outstanding > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{formatCurrency(doc.outstanding)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                            {doc.status === 'PENDING' ? (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: 'var(--badge-warning-bg)',
                                color: 'var(--badge-warning-text, #f59e0b)',
                              }}>
                                {t('finance.doctorBalances.pendingBadge', { count: doc.pendingCount })}
                              </span>
                            ) : (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: 'var(--badge-success-bg)',
                                color: 'var(--badge-success-text, #10b981)',
                              }}>
                                {t('finance.doctorBalances.settledBadge')}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              onClick={() => setViewOrdersDoctor({ id: doc.id, name: doc.name, clinicName: doc.clinicName })}
                            >
                              <FileText size={13} />
                              {t('finance.doctorBalances.viewOrders')}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Subtotal Row */}
                      <tr style={{ backgroundColor: 'var(--bg-surface, #f8fafc)', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle' }}>{t('finance.doctorBalances.subtotal')}</td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: 'var(--text-muted)' }}>—</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle' }}>{doctorData.subtotal.totalOrders}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle' }}>{formatCurrency(doctorData.subtotal.quoted)}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle', color: '#10b981' }}>{formatCurrency(doctorData.subtotal.collected)}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle', color: doctorData.subtotal.outstanding > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(doctorData.subtotal.outstanding)}</td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: 'var(--text-muted)' }}>—</td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: 'var(--text-muted)' }}>—</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {doctorData && doctorData.pagination.totalPages > 1 && (
              <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>
                  Showing {((doctorData.pagination.page - 1) * doctorData.pagination.pageSize) + 1} to {Math.min(doctorData.pagination.page * doctorData.pagination.pageSize, doctorData.pagination.totalItems)} of {doctorData.pagination.totalItems} entries
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: doctorData.pagination.totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setDoctorPage(p)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: p === doctorPage ? 'var(--primary-600)' : 'var(--bg-card)',
                        color: p === doctorPage ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────── TAB 3: DOCTOR LISTS ────── */}
      {activeTab === 'doctorLists' && (
        <div>
          {/* 4 KPI Cards */}
          {listsData && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <KpiCard label={t('finance.doctorLists.totalOutstandingBalance')} value={formatCurrency(listsData.kpis.totalOutstandingBalance)} icon={<AlertTriangle size={20} />} color="#ef4444" bg="var(--badge-danger-bg)" />
              <KpiCard label={t('finance.doctorLists.doctorsWithPendingBalance')} value={`${listsData.kpis.listsWithPending} / ${listsData.kpis.totalLists}`} icon={<List size={20} />} color="#f59e0b" bg="var(--badge-warning-bg)" />
              <KpiCard label={t('finance.doctorLists.quotedRevenue')} value={formatCurrency(listsData.kpis.quotedRevenue)} icon={<TrendingUp size={20} />} color="#3b82f6" bg="rgba(59, 130, 246, 0.1)" />
              <KpiCard label={t('finance.doctorLists.totalCollected')} value={formatCurrency(listsData.kpis.totalCollected)} icon={<DollarSign size={20} />} color="#10b981" bg="var(--badge-success-bg)" />
            </div>
          )}

          {/* Table Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>{t('finance.doctorLists.sectionTitle')}</span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{t('finance.doctorLists.sectionSubtitle')}</p>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    {[t('finance.doctorLists.listName'), t('finance.doctorLists.members'), t('finance.doctorLists.totalOrders'), t('finance.doctorLists.quoted'), t('finance.doctorLists.collected'), t('finance.doctorLists.outstandingCol'), t('finance.doctorLists.status')].map((h, i) => (
                      <th key={i} style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                    ))}
                    <th style={{ padding: '10px 14px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>{t('finance.doctorLists.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {listsLoading ? (
                    <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</td></tr>
                  ) : !listsData || listsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>{t('finance.doctorLists.noData')}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('finance.doctorLists.noDataDesc')}</div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {listsData.items.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}>
                          <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>{item.name}</div>
                            {item.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.description}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: 'rgba(139, 92, 246, 0.1)',
                              color: '#8b5cf6',
                            }}>
                              {t('finance.doctorLists.membersBadge', { count: item.memberCount })}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>{item.totalOrders}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>{formatCurrency(item.quoted)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: '#10b981' }}>{formatCurrency(item.collected)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle', color: item.outstanding > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{formatCurrency(item.outstanding)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', verticalAlign: 'middle' }}>
                            {item.status === 'PENDING' ? (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: 'var(--badge-warning-bg)',
                                color: 'var(--badge-warning-text, #f59e0b)',
                              }}>
                                {t('finance.doctorLists.pendingBadge', { count: item.pendingCount })}
                              </span>
                            ) : (
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: 'var(--badge-success-bg)',
                                color: 'var(--badge-success-text, #10b981)',
                              }}>
                                {t('finance.doctorLists.settledBadge')}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              onClick={() => setViewBreakdownList({ id: item.id, name: item.name, description: item.description })}
                            >
                              <FileText size={13} />
                              {t('finance.doctorLists.viewBreakdown')}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Subtotal Row */}
                      <tr style={{ backgroundColor: 'var(--bg-surface, #f8fafc)', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle' }}>{t('finance.doctorLists.subtotal')}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle' }}>{listsData.subtotal.totalMembers}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle' }}>{listsData.subtotal.totalOrders}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle' }}>{formatCurrency(listsData.subtotal.quoted)}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle', color: '#10b981' }}>{formatCurrency(listsData.subtotal.collected)}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, verticalAlign: 'middle', color: listsData.subtotal.outstanding > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(listsData.subtotal.outstanding)}</td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: 'var(--text-muted)' }}>—</td>
                        <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: 'var(--text-muted)' }}>—</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {listsData && listsData.pagination.totalPages > 1 && (
              <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>
                  Showing {((listsData.pagination.page - 1) * listsData.pagination.pageSize) + 1} to {Math.min(listsData.pagination.page * listsData.pagination.pageSize, listsData.pagination.totalItems)} of {listsData.pagination.totalItems} entries
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: listsData.pagination.totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setListsPage(p)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: p === listsPage ? 'var(--primary-600)' : 'var(--bg-card)',
                        color: p === listsPage ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────── Modals ────── */}
      {viewOrdersDoctor && (
        <DoctorOrdersModal
          doctorId={viewOrdersDoctor.id}
          doctorName={viewOrdersDoctor.name}
          clinicName={viewOrdersDoctor.clinicName}
          branchId={selectedBranchId !== 'all' ? selectedBranchId : undefined}
          moduleKey={moduleKey}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setViewOrdersDoctor(null)}
          onRefresh={() => { if (activeTab === 'doctorBalances') fetchDoctorBalances(); }}
        />
      )}

      {viewBreakdownList && (
        <DoctorListBreakdownModal
          listId={viewBreakdownList.id}
          listName={viewBreakdownList.name}
          listDescription={viewBreakdownList.description}
          branchId={selectedBranchId !== 'all' ? selectedBranchId : undefined}
          moduleKey={moduleKey}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setViewBreakdownList(null)}
          onRefresh={() => { if (activeTab === 'doctorLists') fetchDoctorLists(); }}
        />
      )}
    </div>
  );
};
