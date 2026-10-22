export interface ConfigurableClinicMenu {
  key: string;
  name: string;
  description: string;
}

/**
 * Dedicated configurable menu options for Clinic Types (independent of sidebar menus)
 * Platform Admin selects which of these menus are active for each Clinic Type profile.
 */
export const DEFAULT_CONFIGURABLE_CLINIC_MENUS: ConfigurableClinicMenu[] = [
  {
    key: 'finance',
    name: 'Finance',
    description: 'Financial accounts, payment methods, and cash flow ledger',
  },
  {
    key: 'reminders',
    name: 'Reminder',
    description: 'Automated appointment reminders, recalls, and notifications',
  },
  {
    key: 'inventory',
    name: 'Inventory',
    description: 'Supplies, consumables, stock levels, and low-stock alerts',
  },
  {
    key: 'expenses',
    name: 'Expense',
    description: 'Operational practice expenses, vendor receipts, and category reports',
  },
  {
    key: 'clinic_users',
    name: 'Users',
    description: 'Management of Clinic Admins, Staff/Assistants, and Attending Doctors',
  },
  {
    key: 'patients',
    name: 'Patient',
    description: 'Patient demographics, medical history, clinical files, and emergency contacts',
  },
  {
    key: 'appointments',
    name: 'Appointment',
    description: 'Doctor chair calendar, slot booking, statuses, and front-desk check-in',
  },
  {
    key: 'income',
    name: 'Income',
    description: 'Procedure fees, consultation invoices, and collection receipts',
  },
];

/**
 * Base non-configurable features (Dashboard is always enabled for all clinic tenants)
 */
export const BASE_CLINIC_FEATURES = ['dashboard'];

/**
 * All configurable menu keys
 */
export const CONFIGURABLE_MENU_KEYS = DEFAULT_CONFIGURABLE_CLINIC_MENUS.map((m) => m.key);

/**
 * Default features enabled for the default Dental Clinic type
 */
export const DEFAULT_CLINIC_FEATURE_KEYS = [
  ...BASE_CLINIC_FEATURES,
  ...CONFIGURABLE_MENU_KEYS,
];
