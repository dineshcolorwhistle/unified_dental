export interface ClinicMenuItem {
  key: string;
  name: string;
  i18nKey: string;
  description: string;
  path: string;
  icon: string;
  isBase?: boolean;
}

/**
 * Base menus available by default to every tenant owner (not configurable in clinic types)
 */
export const BASE_CLINIC_MENUS: ClinicMenuItem[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    i18nKey: 'nav.dashboard',
    description: 'Clinic performance metrics, KPI charts, and operational summary',
    path: '/',
    icon: 'LayoutDashboard',
    isBase: true,
  },
  {
    key: 'branches',
    name: 'Branch Management',
    i18nKey: 'nav.branches',
    description: 'Multi-branch clinic locations, operatories, and assigned personnel',
    path: '/branches',
    icon: 'Building2',
    isBase: true,
  },
];

/**
 * Configurable menus for the Clinic module in the sidebar
 */
export const CONFIGURABLE_CLINIC_MENUS: ClinicMenuItem[] = [
  {
    key: 'finance',
    name: 'Finance',
    i18nKey: 'nav.finance',
    description: 'Financial accounts, payment methods, and cash flow ledger',
    path: '/finance',
    icon: 'CreditCard',
  },
  {
    key: 'reminders',
    name: 'Reminder',
    i18nKey: 'nav.reminder',
    description: 'Automated appointment reminders, recalls, and notifications',
    path: '/reminders',
    icon: 'Bell',
  },
  {
    key: 'inventory',
    name: 'Inventory',
    i18nKey: 'nav.inventory',
    description: 'Supplies, consumables, stock levels, and low-stock alerts',
    path: '/inventory',
    icon: 'Package',
  },
  {
    key: 'expenses',
    name: 'Expense',
    i18nKey: 'nav.expenses',
    description: 'Operational practice expenses, vendor receipts, and category reports',
    path: '/expenses',
    icon: 'Receipt',
  },
  {
    key: 'clinic_users',
    name: 'Users',
    i18nKey: 'nav.clinicUsers',
    description: 'Management of Clinic Admins, Staff/Assistants, and Attending Doctors',
    path: '/clinic/users/admin',
    icon: 'Users',
  },
  {
    key: 'patients',
    name: 'Patient',
    i18nKey: 'nav.patient',
    description: 'Patient demographics, medical history, clinical files, and emergency contacts',
    path: '/clinic/patients',
    icon: 'UserRound',
  },
  {
    key: 'appointments',
    name: 'Appointment',
    i18nKey: 'nav.appointment',
    description: 'Doctor chair calendar, slot booking, statuses, and front-desk check-in',
    path: '/clinic/appointments',
    icon: 'CalendarCheck',
  },
  {
    key: 'income',
    name: 'Income',
    i18nKey: 'nav.income',
    description: 'Procedure fees, consultation invoices, and collection receipts',
    path: '/clinic/income',
    icon: 'TrendingUp',
  },
];

export const ALL_CLINIC_MENUS: ClinicMenuItem[] = [
  ...BASE_CLINIC_MENUS,
  ...CONFIGURABLE_CLINIC_MENUS,
];

/**
 * Returns all clinic feature keys including base features like 'dashboard'
 */
export function getAllClinicFeatureKeys(): string[] {
  return ALL_CLINIC_MENUS.map((m) => m.key);
}

/**
 * Returns the configurable menu keys displayed in the Clinic Type management modal
 */
export function getConfigurableClinicMenuKeys(): string[] {
  return CONFIGURABLE_CLINIC_MENUS.map((m) => m.key);
}

/**
 * Returns all feature keys enabled by default for Dental Clinic
 */
export function getDefaultDentalClinicFeatures(): string[] {
  return Array.from(new Set(['dashboard', ...CONFIGURABLE_CLINIC_MENUS.map((m) => m.key)]));
}
