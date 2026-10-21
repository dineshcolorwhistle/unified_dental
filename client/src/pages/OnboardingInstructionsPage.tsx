import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/context/AuthContext';
import {
  Compass,
  Building2,
  KeyRound,
  GitBranch,
  Layers,
  Users,
  ClipboardCheck,
  ArrowRight,
  Circle,
  Search,
  Sparkles,
  Plus,
  HelpCircle,
  RotateCcw,
  BookOpen,
  Info,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';

export type RoleFilter = 'ALL' | 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'LAB_ADMIN' | 'TECHNICIAN';

export interface OnboardingStep {
  id: string;
  stepNumber: number;
  role: RoleFilter;
  roleBadgeText: string;
  roleBadgeColor: {
    bg: string;
    text: string;
    border: string;
  };
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  prerequisites: string;
  requiredFields: string[];
  whatHappensNext: string;
  actionText: string;
  actionRoute: string;
  tip?: string;
  primaryAction?: {
    label: string;
    route: string;
  };
}

export const OnboardingInstructionsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isTenantAdmin, isLabAdmin, isLabTechnician } = useAuth();

  // Platform Admin determination: only platform admin can see all tabs
  const isPlatformAdmin = Boolean(user?.isSuperAdmin);

  // Tenant / Lab specific roles
  const isOwner = Boolean(
    isTenantAdmin ||
    user?.tenants?.find((ten) => ten.id === user.activeTenant?.id)?.isOwner ||
    user?.roles?.some((r) => {
      const lower = r.toLowerCase();
      return lower.includes('owner') || lower.includes('tenant-admin') || lower === 'admin';
    })
  );

  const isLabAdministrator = Boolean(
    isLabAdmin ||
    user?.roles?.some((r) => {
      const lower = r.toLowerCase();
      return lower.includes('lab-admin') || lower.includes('lab admin') || lower.includes('lab administrator');
    })
  );

  const isTechnician = Boolean(
    isLabTechnician ||
    user?.roles?.some((r) => r.toLowerCase().includes('technician'))
  );

  // Visible role tabs: Platform Admin sees all tabs; other roles only see their own tabs
  const visibleRoleTabs: RoleFilter[] = useMemo(() => {
    if (isPlatformAdmin) {
      return ['ALL', 'PLATFORM_ADMIN', 'TENANT_ADMIN', 'LAB_ADMIN', 'TECHNICIAN'];
    }
    const tabs: RoleFilter[] = [];
    if (isOwner) tabs.push('TENANT_ADMIN');
    if (isLabAdministrator) tabs.push('LAB_ADMIN');
    if (isTechnician) tabs.push('TECHNICIAN');
    if (tabs.length === 0) tabs.push('TENANT_ADMIN');
    return tabs;
  }, [isPlatformAdmin, isOwner, isLabAdministrator, isTechnician]);

  // Determine initial role filter based on authenticated user context
  const getInitialRoleFilter = (): RoleFilter => {
    if (isPlatformAdmin) return 'ALL';
    if (isOwner) return 'TENANT_ADMIN';
    if (isLabAdministrator) return 'LAB_ADMIN';
    if (isTechnician) return 'TECHNICIAN';
    return 'TENANT_ADMIN';
  };

  const [selectedRole, setSelectedRole] = useState<RoleFilter>(getInitialRoleFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGlossary, setShowGlossary] = useState(false);
  const [expandedTips, setExpandedTips] = useState<Record<string, boolean>>({});

  // Ensure non-platform admin users always stay within their permitted tabs
  useEffect(() => {
    if (!isPlatformAdmin && !visibleRoleTabs.includes(selectedRole)) {
      if (visibleRoleTabs.length > 0) {
        setSelectedRole(visibleRoleTabs[0]);
      }
    }
  }, [isPlatformAdmin, visibleRoleTabs, selectedRole]);

  // LocalStorage key for persisting completed onboarding steps per tenant/user
  const storageKey = `ud_onboarding_completed_${user?.activeTenant?.id || 'platform'}_${user?.id || 'guest'}`;

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(completedSteps));
    } catch (e) {
      console.error('Failed to save onboarding progress', e);
    }
  }, [completedSteps, storageKey]);

  const toggleStepCompleted = (stepId: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const resetAllProgress = () => {
    if (window.confirm(t('onboarding.progress.resetConfirm', 'Reset all completed step progress?'))) {
      setCompletedSteps({});
    }
  };

  const toggleTip = (stepId: string) => {
    setExpandedTips((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Helper to safely retrieve array of required fields from i18n
  const getFields = (stepKey: string, fallback: string[]): string[] => {
    const res = t(`onboarding.steps.${stepKey}.requiredFields`, { returnObjects: true });
    return Array.isArray(res) ? (res as string[]) : fallback;
  };

  // Complete definition of the 10 sequential workflow steps, reactive to language changes
  const steps: OnboardingStep[] = useMemo(() => [
    {
      id: 'step-1',
      stepNumber: 1,
      role: 'PLATFORM_ADMIN',
      roleBadgeText: t('onboarding.roles.superAdmin', 'Super Admin'),
      roleBadgeColor: {
        bg: 'rgba(99, 102, 241, 0.12)',
        text: '#6366f1',
        border: 'rgba(99, 102, 241, 0.28)',
      },
      icon: <Building2 size={24} />,
      iconBg: 'rgba(99, 102, 241, 0.12)',
      iconColor: '#6366f1',
      title: t('onboarding.steps.step1.title', 'Super Admin creates Tenant'),
      subtitle: t(
        'onboarding.steps.step1.subtitle',
        'Super Admin registers the new dental laboratory on the platform and assigns initial user limits.'
      ),
      prerequisites: t('onboarding.steps.step1.prerequisites', 'None (initial platform step).'),
      requiredFields: getFields('step1', [
        'Lab Name',
        'Owner Full Name',
        'Owner Email',
        'User Quotas (Owners, Admins, Techs)',
      ]),
      whatHappensNext: t(
        'onboarding.steps.step1.whatHappensNext',
        'System creates the tenant database boundary and automatically sends an invitation / password reset email to the owner.'
      ),
      actionText: t('onboarding.steps.step1.actionText', 'Go to Tenants'),
      actionRoute: '/tenants',
      tip: t(
        'onboarding.steps.step1.tip',
        'The slug creates a dedicated web address for the lab. For example, "apex-dental" becomes apex-dental.unifieddental.com.'
      ),
      primaryAction: {
        label: t('onboarding.steps.step1.primaryAction', '+ Create Tenant'),
        route: '/tenants',
      },
    },
    {
      id: 'step-2',
      stepNumber: 2,
      role: 'TENANT_ADMIN',
      roleBadgeText: t('onboarding.roles.labOwner', 'Lab Owner'),
      roleBadgeColor: {
        bg: 'rgba(59, 130, 246, 0.12)',
        text: '#3b82f6',
        border: 'rgba(59, 130, 246, 0.28)',
      },
      icon: <KeyRound size={24} />,
      iconBg: 'rgba(168, 85, 247, 0.12)',
      iconColor: '#a855f7',
      title: t('onboarding.steps.step2.title', 'Owner resets password & logs in'),
      subtitle: t(
        'onboarding.steps.step2.subtitle',
        'The lab owner opens the invitation email, clicks the secure link to set their master password, and logs into the platform.'
      ),
      prerequisites: t('onboarding.steps.step2.prerequisites', 'Tenant created by Super Admin (Step 1).'),
      requiredFields: getFields('step2', ['New Password', 'Confirm Password']),
      whatHappensNext: t(
        'onboarding.steps.step2.whatHappensNext',
        'Account is activated and the owner is redirected to the Owner Dashboard.'
      ),
      actionText: t('onboarding.steps.step2.actionText', 'Go to Login'),
      actionRoute: '/login',
      tip: t(
        'onboarding.steps.step2.tip',
        'Use a strong master passphrase with at least 8 characters, combining uppercase, lowercase, numbers, and symbols.'
      ),
    },
    {
      id: 'step-3',
      stepNumber: 3,
      role: 'TENANT_ADMIN',
      roleBadgeText: t('onboarding.roles.labOwner', 'Lab Owner'),
      roleBadgeColor: {
        bg: 'rgba(59, 130, 246, 0.12)',
        text: '#3b82f6',
        border: 'rgba(59, 130, 246, 0.28)',
      },
      icon: <GitBranch size={24} />,
      iconBg: 'rgba(14, 165, 233, 0.12)',
      iconColor: '#0284c7',
      title: t('onboarding.steps.step3.title', 'Owner creates first Branch'),
      subtitle: t(
        'onboarding.steps.step3.subtitle',
        'The owner creates at least one physical branch/facility. Staff, technicians, and work orders must belong to a branch.'
      ),
      prerequisites: t('onboarding.steps.step3.prerequisites', 'Logged in as Tenant Admin (Step 2).'),
      requiredFields: getFields('step3', ['Branch Name', 'Branch Code', 'Physical Address', 'Contact Phone']),
      whatHappensNext: t(
        'onboarding.steps.step3.whatHappensNext',
        'The branch workspace is initialized. All work orders, team members, and inventory items can now be attached to this branch.'
      ),
      actionText: t('onboarding.steps.step3.actionText', 'Go to Branches'),
      actionRoute: '/branches',
      tip: t(
        'onboarding.steps.step3.tip',
        'Even single-location laboratories must register their primary facility as their first Branch so recipes and cases can be dispatched.'
      ),
      primaryAction: {
        label: t('onboarding.steps.step3.primaryAction', '+ Create Branch'),
        route: '/branches',
      },
    },
    {
      id: 'step-4',
      stepNumber: 4,
      role: 'TENANT_ADMIN',
      roleBadgeText: t('onboarding.roles.labOwner', 'Lab Owner'),
      roleBadgeColor: {
        bg: 'rgba(59, 130, 246, 0.12)',
        text: '#3b82f6',
        border: 'rgba(59, 130, 246, 0.28)',
      },
      icon: <Users size={24} />,
      iconBg: 'rgba(20, 184, 166, 0.12)',
      iconColor: '#0d9488',
      title: t('onboarding.steps.step4.title', 'Owner creates Lab Admin & assigns Branch'),
      subtitle: t(
        'onboarding.steps.step4.subtitle',
        'The lab owner registers the Lab Administrator and assigns them to their physical lab branch. This grants the Lab Admin management access over daily branch operations.'
      ),
      prerequisites: t('onboarding.steps.step4.prerequisites', 'First Branch created (Step 3).'),
      requiredFields: getFields('step4', ['Lab Admin Name', 'Email Address', 'Assigned Branch', 'Contact Phone']),
      whatHappensNext: t(
        'onboarding.steps.step4.whatHappensNext',
        'System creates the Lab Admin user profile and automatically dispatches an invitation email with a secure password reset link to their inbox.'
      ),
      actionText: t('onboarding.steps.step4.actionText', 'Go to Lab Admins'),
      actionRoute: '/lab/users/admin',
      tip: t(
        'onboarding.steps.step4.tip',
        'Assigning a Lab Admin gives them authority to manage technicians, recipes, and work orders specifically for that branch.'
      ),
      primaryAction: {
        label: t('onboarding.steps.step4.primaryAction', '+ Create Lab Admin'),
        route: '/lab/users/admin',
      },
    },
    {
      id: 'step-5',
      stepNumber: 5,
      role: 'LAB_ADMIN',
      roleBadgeText: t('onboarding.roles.labAdmin', 'Lab Admin'),
      roleBadgeColor: {
        bg: 'rgba(13, 148, 136, 0.12)',
        text: '#0d9488',
        border: 'rgba(13, 148, 136, 0.28)',
      },
      icon: <KeyRound size={24} />,
      iconBg: 'rgba(168, 85, 247, 0.12)',
      iconColor: '#a855f7',
      title: t('onboarding.steps.step5.title', 'Lab Admin resets password & logs in'),
      subtitle: t(
        'onboarding.steps.step5.subtitle',
        'The newly invited Lab Admin opens the welcome email, clicks the password reset link to choose their password, and logs into their branch portal.'
      ),
      prerequisites: t('onboarding.steps.step5.prerequisites', 'Lab Admin created by Owner (Step 4).'),
      requiredFields: getFields('step5', ['New Password', 'Confirm Password']),
      whatHappensNext: t(
        'onboarding.steps.step5.whatHappensNext',
        'Account is activated and the Lab Admin is redirected to the Dental Lab Dashboard for their assigned branch.'
      ),
      actionText: t('onboarding.steps.step5.actionText', 'Go to Login'),
      actionRoute: '/login',
      tip: t(
        'onboarding.steps.step5.tip',
        'The invitation link is valid for 24 hours. If it expires, the Owner can resend the invite from the Lab Admin table.'
      ),
    },
    {
      id: 'step-6',
      stepNumber: 6,
      role: 'LAB_ADMIN',
      roleBadgeText: t('onboarding.roles.labAdmin', 'Lab Admin'),
      roleBadgeColor: {
        bg: 'rgba(13, 148, 136, 0.12)',
        text: '#0d9488',
        border: 'rgba(13, 148, 136, 0.28)',
      },
      icon: <Users size={24} />,
      iconBg: 'rgba(59, 130, 246, 0.12)',
      iconColor: '#2563eb',
      title: t('onboarding.steps.step6.title', 'Lab Admin creates Technician (sends reset email)'),
      subtitle: t(
        'onboarding.steps.step6.subtitle',
        'The Lab Admin registers dental technicians who fabricate cases. When created, the system immediately emails each technician an invite with a secure password reset link.'
      ),
      prerequisites: t('onboarding.steps.step6.prerequisites', 'Lab Admin logged in (Step 5).'),
      requiredFields: getFields('step6', [
        'Technician Full Name',
        'Email Address',
        'Assigned Branch',
        'Specialty Area',
      ]),
      whatHappensNext: t(
        'onboarding.steps.step6.whatHappensNext',
        'The technician is registered and an invitation email with a secure password reset link is sent to their inbox to activate their account.'
      ),
      actionText: t('onboarding.steps.step6.actionText', 'Go to Technicians'),
      actionRoute: '/lab/users/technicians',
      tip: t(
        'onboarding.steps.step6.tip',
        "Setting the technician's specialty area (e.g. CAD/CAM, Ceramics) makes recipe task assignment faster and clearer."
      ),
      primaryAction: {
        label: t('onboarding.steps.step6.primaryAction', '+ Create Technician'),
        route: '/lab/users/technicians',
      },
    },
    {
      id: 'step-7',
      stepNumber: 7,
      role: 'LAB_ADMIN',
      roleBadgeText: t('onboarding.roles.labAdmin', 'Lab Admin'),
      roleBadgeColor: {
        bg: 'rgba(13, 148, 136, 0.12)',
        text: '#0d9488',
        border: 'rgba(13, 148, 136, 0.28)',
      },
      icon: <Layers size={24} />,
      iconBg: 'rgba(245, 158, 11, 0.12)',
      iconColor: '#d97706',
      title: t(
        'onboarding.steps.step7.title',
        'Configure Basic Details (Doctors, Process Areas, Processes, Prosthesis Types)'
      ),
      subtitle: t(
        'onboarding.steps.step7.subtitle',
        "The Lab Admin configures the lab's core operational catalog: partner Doctors/Clinics, physical Process Areas (workstations), fabrication Processes (stages), and Prosthesis Types with step-by-step recipes."
      ),
      prerequisites: t('onboarding.steps.step7.prerequisites', 'Lab Admin logged in (Step 5).'),
      requiredFields: getFields('step7', [
        'Doctors & Clinics',
        'Process Areas (CAD/CAM, Ceramics)',
        'Processes (Milling, Sintering)',
        'Prosthesis Types & Recipes',
      ]),
      whatHappensNext: t(
        'onboarding.steps.step7.whatHappensNext',
        'Your catalog and automated recipes are ready. When a new case is received, selecting the prosthesis automatically loads all stages with zero manual work.'
      ),
      actionText: t('onboarding.steps.step7.actionText', 'Go to Process Areas'),
      actionRoute: '/lab/process-areas',
      tip: t(
        'onboarding.steps.step7.tip',
        'Recommended order: 1) Add Doctors, 2) Add Process Areas, 3) Add Processes, 4) Create Prosthesis Types and link the processes into a recipe sequence.'
      ),
    },
    {
      id: 'step-8',
      stepNumber: 8,
      role: 'LAB_ADMIN',
      roleBadgeText: t('onboarding.roles.labAdmin', 'Lab Admin'),
      roleBadgeColor: {
        bg: 'rgba(13, 148, 136, 0.12)',
        text: '#0d9488',
        border: 'rgba(13, 148, 136, 0.28)',
      },
      icon: <ClipboardCheck size={24} />,
      iconBg: 'rgba(99, 102, 241, 0.12)',
      iconColor: '#6366f1',
      title: t('onboarding.steps.step8.title', 'Lab Admin creates Work Order (WO)'),
      subtitle: t(
        'onboarding.steps.step8.subtitle',
        'The Lab Admin inputs a new dental prescription order, chooses the prescribing doctor, selects the prosthesis type (recipe auto-loads), assigns the technician, and saves.'
      ),
      prerequisites: t(
        'onboarding.steps.step8.prerequisites',
        'Catalog details and technicians configured (Steps 6 & 7).'
      ),
      requiredFields: getFields('step8', [
        'Doctor Selection',
        'Patient Name / Case ID',
        'Prosthesis Type',
        'Target Delivery Date',
        'Assigned Technician',
      ]),
      whatHappensNext: t(
        'onboarding.steps.step8.whatHappensNext',
        "Work Order is created with an auto-generated folio number, changes status to ASSIGNED, and appears immediately on the technician's workbench."
      ),
      actionText: t('onboarding.steps.step8.actionText', 'Go to Work Orders'),
      actionRoute: '/lab/work-orders',
      tip: t(
        'onboarding.steps.step8.tip',
        'Use "Save & Assign" when you want Step 1 to immediately start. The assigned technician receives a notification right away.'
      ),
      primaryAction: {
        label: t('onboarding.steps.step8.primaryAction', '+ Create Work Order'),
        route: '/lab/work-orders',
      },
    },
    {
      id: 'step-9',
      stepNumber: 9,
      role: 'TECHNICIAN',
      roleBadgeText: t('onboarding.roles.technician', 'Technician'),
      roleBadgeColor: {
        bg: 'rgba(245, 158, 11, 0.12)',
        text: '#d97706',
        border: 'rgba(245, 158, 11, 0.28)',
      },
      icon: <KeyRound size={24} />,
      iconBg: 'rgba(168, 85, 247, 0.12)',
      iconColor: '#a855f7',
      title: t('onboarding.steps.step9.title', 'Lab Technician resets password & logs in'),
      subtitle: t(
        'onboarding.steps.step9.subtitle',
        'The dental technician opens the invitation email, clicks the password reset link to create their personal password, and logs into the platform.'
      ),
      prerequisites: t('onboarding.steps.step9.prerequisites', 'Technician created by Lab Admin (Step 6).'),
      requiredFields: getFields('step9', ['New Password', 'Confirm Password']),
      whatHappensNext: t(
        'onboarding.steps.step9.whatHappensNext',
        'Technician account is activated and they are redirected to their personalized Workbench displaying their assigned work orders.'
      ),
      actionText: t('onboarding.steps.step9.actionText', 'Go to Login'),
      actionRoute: '/login',
      tip: t(
        'onboarding.steps.step9.tip',
        'Technicians can log in from lab tablets or benchtop workstations to view case details and tooth numbers without handling paper slips.'
      ),
    },
    {
      id: 'step-10',
      stepNumber: 10,
      role: 'TECHNICIAN',
      roleBadgeText: t('onboarding.roles.technician', 'Technician'),
      roleBadgeColor: {
        bg: 'rgba(245, 158, 11, 0.12)',
        text: '#d97706',
        border: 'rgba(245, 158, 11, 0.28)',
      },
      icon: <ClipboardCheck size={24} />,
      iconBg: 'rgba(16, 185, 129, 0.12)',
      iconColor: '#059669',
      title: t('onboarding.steps.step10.title', 'Technician performs Work Order related tasks'),
      subtitle: t(
        'onboarding.steps.step10.subtitle',
        'The technician opens their assigned work order, starts the active stage timer, performs the fabrication work (designing, milling, glazing), pauses/resumes as needed, uploads photos, and completes the stage.'
      ),
      prerequisites: t(
        'onboarding.steps.step10.prerequisites',
        'Work Order assigned (Step 8) and Technician logged in (Step 9).'
      ),
      requiredFields: getFields('step10', [
        'Work Order Folio',
        'Timer Start / Pause / Finish',
        'Inspection & Verification Approval',
      ]),
      whatHappensNext: t(
        'onboarding.steps.step10.whatHappensNext',
        'The platform updates case status in real-time on the lab dashboard, automatically notifies the next technician in line, and prepares the case for delivery.'
      ),
      actionText: t('onboarding.steps.step10.actionText', 'Go to My Work Orders'),
      actionRoute: '/lab/work-orders/my',
      tip: t(
        'onboarding.steps.step10.tip',
        'Timers can be paused for curing or oven cycles and resumed when handling the case again, giving your lab precise manufacturing labor metrics.'
      ),
    },
  ], [t, i18n.language]);

  // Filter counts
  const counts = useMemo(() => {
    return {
      ALL: steps.length,
      PLATFORM_ADMIN: steps.filter((s) => s.role === 'PLATFORM_ADMIN').length,
      TENANT_ADMIN: steps.filter((s) => s.role === 'TENANT_ADMIN').length,
      LAB_ADMIN: steps.filter((s) => s.role === 'LAB_ADMIN').length,
      TECHNICIAN: steps.filter((s) => s.role === 'TECHNICIAN').length,
    };
  }, [steps]);

  // Relevant steps for this user's role (Platform Admin sees all 10, other roles only see their own)
  const relevantSteps = useMemo(() => {
    if (isPlatformAdmin) return steps;
    return steps.filter((s) => visibleRoleTabs.includes(s.role));
  }, [steps, isPlatformAdmin, visibleRoleTabs]);

  // Filtered steps for display
  const filteredSteps = useMemo(() => {
    return steps.filter((step) => {
      // Permission check: non-platform admin can ONLY see steps for their visible roles
      if (!isPlatformAdmin && !visibleRoleTabs.includes(step.role)) {
        return false;
      }

      // Role filter check (from active tab)
      if (selectedRole !== 'ALL' && step.role !== selectedRole) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = step.title.toLowerCase().includes(q);
        const matchesSubtitle = step.subtitle.toLowerCase().includes(q);
        const matchesFields = step.requiredFields.some((f) => f.toLowerCase().includes(q));
        const matchesRole = step.roleBadgeText.toLowerCase().includes(q);
        return matchesTitle || matchesSubtitle || matchesFields || matchesRole;
      }
      return true;
    });
  }, [steps, isPlatformAdmin, visibleRoleTabs, selectedRole, searchQuery]);

  // Overall completion metrics based on relevant steps for this user
  const completedCount = useMemo(() => {
    return relevantSteps.filter((s) => Boolean(completedSteps[s.id])).length;
  }, [relevantSteps, completedSteps]);

  const totalRelevantCount = relevantSteps.length;
  const completionPercentage =
    totalRelevantCount > 0 ? Math.round((completedCount / totalRelevantCount) * 100) : 0;

  // Dynamic header button based on active role context
  const headerAction = useMemo(() => {
    if (user?.isSuperAdmin && !user.activeTenant) {
      return {
        label: t('onboarding.header.createTenant', 'Create Tenant'),
        onClick: () => navigate('/tenants'),
      };
    }
    if (isTenantAdmin) {
      return {
        label: t('onboarding.header.createBranch', 'Create Branch'),
        onClick: () => navigate('/branches'),
      };
    }
    if (isLabAdmin) {
      return {
        label: t('onboarding.header.createWorkOrder', 'Create Work Order'),
        onClick: () => navigate('/lab/work-orders'),
      };
    }
    return null;
  }, [user, isTenantAdmin, isLabAdmin, navigate, t, i18n.language]);

  return (
    <div className="onboarding-instructions-page" style={{ maxWidth: '1180px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* ──────────────── Top Header Bar ──────────────── */}
      <div
        className="onboarding-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              border: '2px solid rgba(13, 148, 136, 0.4)',
              background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12), rgba(6, 182, 212, 0.18))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600)',
              flexShrink: 0,
            }}
          >
            <Compass size={26} strokeWidth={2.2} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text-heading)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {t('onboarding.header.title', 'Tenant Onboarding Guide')}
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-muted)',
                margin: '4px 0 0',
                lineHeight: 1.4,
              }}
            >
              {t(
                'onboarding.header.subtitle',
                'Step-by-step prerequisite and workflow guide for onboarding a new dental lab tenant onto the platform.'
              )}
            </p>
          </div>
        </div>

        {/* Top Action CTAs */}
        <div className="onboarding-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowGlossary((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '9px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--theme-transition)',
            }}
          >
            <BookOpen size={15} style={{ color: 'var(--primary-600)' }} />
            <span>{t('onboarding.header.glossaryBtn', 'Plain-English Glossary')}</span>
          </button>

          {headerAction && (
            <button
              type="button"
              onClick={headerAction.onClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '9px',
                border: 'none',
                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(13, 148, 136, 0.35)',
                transition: 'all 0.2s ease',
              }}
            >
              <Plus size={16} />
              <span>{headerAction.label}</span>
            </button>
          )}
        </div>
      </div>

      {/* ──────────────── Progress Tracker Bar ──────────────── */}
      <div
        className="onboarding-progress-card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('onboarding.progress.label', 'Your Setup Progress:')}
              </span>{' '}
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-600)' }}>
                {t('onboarding.progress.completedText', {
                  completed: completedCount,
                  total: totalRelevantCount,
                  percent: completionPercentage,
                  defaultValue: `${completedCount} of ${totalRelevantCount} steps completed (${completionPercentage}%)`,
                })}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={resetAllProgress}
                title={t('onboarding.progress.resetTooltip', 'Reset completed checklist')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                <RotateCcw size={12} />
                <span>{t('onboarding.progress.reset', 'Reset Progress')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress track */}
        <div
          style={{
            width: '100%',
            height: '8px',
            background: 'var(--border-subtle)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${completionPercentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0d9488, #2dd4bf, #3b82f6)',
              borderRadius: '999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* ──────────────── Filter Tabs & Search Controls ──────────────── */}
      <div
        className="onboarding-filter-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Role Pills matching permissions: Platform Admin sees all tabs; each role only sees their own tabs */}
        <div
          className="onboarding-role-pills tabs-header-scrollable"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {/* All Steps Pill: ONLY visible to Platform Admin */}
          {isPlatformAdmin && (
            <button
              type="button"
              onClick={() => setSelectedRole('ALL')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '999px',
                border: selectedRole === 'ALL' ? 'none' : '1px solid var(--border-color)',
                background: selectedRole === 'ALL' ? 'var(--primary-600)' : 'var(--bg-card)',
                color: selectedRole === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: selectedRole === 'ALL' ? '0 2px 6px rgba(13, 148, 136, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('onboarding.tabs.all', 'All Steps')}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: selectedRole === 'ALL' ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)',
                  color: selectedRole === 'ALL' ? '#ffffff' : 'var(--text-subtle)',
                  fontWeight: 700,
                }}
              >
                {counts.ALL}
              </span>
            </button>
          )}

          {/* Super Admin Pill: ONLY visible to Platform Admin */}
          {isPlatformAdmin && (
            <button
              type="button"
              onClick={() => setSelectedRole('PLATFORM_ADMIN')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '999px',
                border: selectedRole === 'PLATFORM_ADMIN' ? 'none' : '1px solid var(--border-color)',
                background: selectedRole === 'PLATFORM_ADMIN' ? '#6366f1' : 'var(--bg-card)',
                color: selectedRole === 'PLATFORM_ADMIN' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: selectedRole === 'PLATFORM_ADMIN' ? '0 2px 6px rgba(99, 102, 241, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('onboarding.tabs.superAdmin', 'Super Admin')}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background:
                    selectedRole === 'PLATFORM_ADMIN' ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)',
                  color: selectedRole === 'PLATFORM_ADMIN' ? '#ffffff' : 'var(--text-subtle)',
                  fontWeight: 700,
                }}
              >
                {counts.PLATFORM_ADMIN}
              </span>
            </button>
          )}

          {/* Lab Owner Pill: visible to Platform Admin OR Lab Owner */}
          {(isPlatformAdmin || visibleRoleTabs.includes('TENANT_ADMIN')) && (
            <button
              type="button"
              onClick={() => setSelectedRole('TENANT_ADMIN')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '999px',
                border: selectedRole === 'TENANT_ADMIN' ? 'none' : '1px solid var(--border-color)',
                background: selectedRole === 'TENANT_ADMIN' ? '#3b82f6' : 'var(--bg-card)',
                color: selectedRole === 'TENANT_ADMIN' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: selectedRole === 'TENANT_ADMIN' ? '0 2px 6px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('onboarding.tabs.labOwner', 'Lab Owner')}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background:
                    selectedRole === 'TENANT_ADMIN' ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)',
                  color: selectedRole === 'TENANT_ADMIN' ? '#ffffff' : 'var(--text-subtle)',
                  fontWeight: 700,
                }}
              >
                {counts.TENANT_ADMIN}
              </span>
            </button>
          )}

          {/* Lab Admin Pill: visible to Platform Admin OR Lab Admin */}
          {(isPlatformAdmin || visibleRoleTabs.includes('LAB_ADMIN')) && (
            <button
              type="button"
              onClick={() => setSelectedRole('LAB_ADMIN')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '999px',
                border: selectedRole === 'LAB_ADMIN' ? 'none' : '1px solid var(--border-color)',
                background: selectedRole === 'LAB_ADMIN' ? '#0d9488' : 'var(--bg-card)',
                color: selectedRole === 'LAB_ADMIN' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: selectedRole === 'LAB_ADMIN' ? '0 2px 6px rgba(13, 148, 136, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('onboarding.tabs.labAdmin', 'Lab Admin')}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: selectedRole === 'LAB_ADMIN' ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)',
                  color: selectedRole === 'LAB_ADMIN' ? '#ffffff' : 'var(--text-subtle)',
                  fontWeight: 700,
                }}
              >
                {counts.LAB_ADMIN}
              </span>
            </button>
          )}

          {/* Technician Pill: visible to Platform Admin OR Technician */}
          {(isPlatformAdmin || visibleRoleTabs.includes('TECHNICIAN')) && (
            <button
              type="button"
              onClick={() => setSelectedRole('TECHNICIAN')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '999px',
                border: selectedRole === 'TECHNICIAN' ? 'none' : '1px solid var(--border-color)',
                background: selectedRole === 'TECHNICIAN' ? '#d97706' : 'var(--bg-card)',
                color: selectedRole === 'TECHNICIAN' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: selectedRole === 'TECHNICIAN' ? '0 2px 6px rgba(217, 119, 6, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('onboarding.tabs.technician', 'Technician')}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: selectedRole === 'TECHNICIAN' ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)',
                  color: selectedRole === 'TECHNICIAN' ? '#ffffff' : 'var(--text-subtle)',
                  fontWeight: 700,
                }}
              >
                {counts.TECHNICIAN}
              </span>
            </button>
          )}
        </div>

        {/* Live Search Input */}
        <div className="onboarding-search-wrap" style={{ position: 'relative', minWidth: '220px' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-subtle)',
            }}
          />
          <input
            type="text"
            placeholder={t('onboarding.search.placeholder', 'Search instructions...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '999px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ──────────────── Plain-English Glossary Accordion (Jargon Buster) ──────────────── */}
      {showGlossary && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(13, 148, 136, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '28px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={20} style={{ color: 'var(--primary-600)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)' }}>
                {t('onboarding.glossary.title', 'Plain-English Jargon Buster (For Non-Technical Users)')}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowGlossary(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {t('onboarding.glossary.close', 'Close Glossary ✕')}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary-600)', fontSize: '13px' }}>
                {t('onboarding.glossary.tenantTitle', '🏢 Tenant')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                {t(
                  'onboarding.glossary.tenantDesc',
                  'Your private laboratory organization. All your doctor accounts, case files, recipes, and invoices are completely isolated and private to your business.'
                )}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary-600)', fontSize: '13px' }}>
                {t('onboarding.glossary.branchTitle', '📍 Branch')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                {t(
                  'onboarding.glossary.branchDesc',
                  'A physical facility or building where your team produces dental pieces. If you have multiple locations, each location is a separate Branch.'
                )}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary-600)', fontSize: '13px' }}>
                {t('onboarding.glossary.processAreaTitle', '🏭 Process Area')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                {t(
                  'onboarding.glossary.processAreaDesc',
                  'A department or workbench zone inside your lab (e.g. CAD/CAM, Ceramics, Casting, Model Pouring, or QC).'
                )}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary-600)', fontSize: '13px' }}>
                {t('onboarding.glossary.recipeTitle', '📋 Recipe (Workflow Steps)')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                {t(
                  'onboarding.glossary.recipeDesc',
                  'The ordered sequence of steps required to manufacture an item. For example: Scan → Design → Mill → Sinter → Glaze.'
                )}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary-600)', fontSize: '13px' }}>
                {t('onboarding.glossary.workOrderTitle', '📦 Work Order')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                {t(
                  'onboarding.glossary.workOrderDesc',
                  'A specific dental prescription ticket for a patient sent by a dentist. It tracks stage timers, photos, and delivery status.'
                )}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primary-600)', fontSize: '13px' }}>
                {t('onboarding.glossary.verificationTitle', '🔍 Verification Checkpoint')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                {t(
                  'onboarding.glossary.verificationDesc',
                  'A quality inspection step where a lead technician or the prescribing dentist reviews digital fit before final fabrication.'
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── Step Cards List (Matching Reference Screenshot) ──────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredSteps.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px dashed var(--border-color)',
            }}
          >
            <Compass size={36} style={{ color: 'var(--text-subtle)', marginBottom: '12px' }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-heading)' }}>
              {t('onboarding.search.noResultsTitle', {
                query: searchQuery,
                defaultValue: `No onboarding steps found matching "${searchQuery}"`,
              })}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              {t(
                'onboarding.search.noResultsSubtitle',
                'Try clearing your search term or switching to the "All Steps" tab.'
              )}
            </p>
          </div>
        ) : (
          filteredSteps.map((step) => {
            const isCompleted = Boolean(completedSteps[step.id]);
            const isTipOpen = Boolean(expandedTips[step.id]);

            return (
              <div
                key={step.id}
                style={{
                  background: 'var(--bg-card)',
                  border: isCompleted
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid var(--border-color)',
                  borderRadius: '18px',
                  padding: '24px 26px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Step Row Layout */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '20px',
                  }}
                >
                  {/* Left Icon Badge (In soft rounded box) */}
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: step.iconBg,
                      color: step.iconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    {step.icon}
                  </div>

                  {/* Card Content Area */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header Row: STEP Number + Title + Role Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            color: 'var(--primary-600)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {t('onboarding.card.step', 'STEP')} {step.stepNumber}
                        </span>
                        <h2
                          style={{
                            fontSize: '17px',
                            fontWeight: 800,
                            color: 'var(--text-heading)',
                            margin: 0,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {step.title}
                        </h2>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Role Badge pill */}
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: step.roleBadgeColor.bg,
                            color: step.roleBadgeColor.text,
                            border: `1px solid ${step.roleBadgeColor.border}`,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {step.roleBadgeText}
                        </span>

                        {/* Interactive Mark As Done Button */}
                        <button
                          type="button"
                          onClick={() => toggleStepCompleted(step.id)}
                          title={
                            isCompleted
                              ? t('onboarding.card.markIncompleteTitle', 'Mark as incomplete')
                              : t('onboarding.card.markDoneTitle', 'Mark step as completed')
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            border: isCompleted
                              ? '1px solid rgba(16, 185, 129, 0.4)'
                              : '1px solid var(--border-color)',
                            background: isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            color: isCompleted ? '#10b981' : 'var(--text-subtle)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isCompleted ? (
                            <>
                              <Check size={12} strokeWidth={3} />
                              <span>{t('onboarding.card.completed', 'Completed')}</span>
                            </>
                          ) : (
                            <>
                              <Circle size={12} />
                              <span>{t('onboarding.card.markDone', 'Mark Done')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Subtitle / Plain-English Summary */}
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-main)',
                        margin: '0 0 14px 0',
                        lineHeight: 1.5,
                      }}
                    >
                      {step.subtitle}
                    </p>

                    {/* Prerequisites */}
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-main)',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                      }}
                    >
                      <strong style={{ color: 'var(--text-heading)', fontWeight: 700, minWidth: '95px' }}>
                        {t('onboarding.card.prerequisites', 'Prerequisites:')}
                      </strong>
                      <span style={{ color: 'var(--text-muted)' }}>{step.prerequisites}</span>
                    </div>

                    {/* Required Fields Badges */}
                    <div
                      style={{
                        fontSize: '13px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong
                        style={{
                          color: 'var(--text-heading)',
                          fontWeight: 700,
                          minWidth: '95px',
                          paddingTop: '3px',
                        }}
                      >
                        {t('onboarding.card.requiredFields', 'Required Fields:')}
                      </strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {step.requiredFields.map((field, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '2px 9px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 500,
                              background: 'var(--bg-surface-muted)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* What Happens Next */}
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-main)',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                      }}
                    >
                      <strong
                        style={{
                          color: 'var(--text-heading)',
                          fontWeight: 700,
                          minWidth: '95px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t('onboarding.card.whatHappensNext', 'What Happens Next:')}
                      </strong>
                      <span style={{ color: 'var(--text-muted)' }}>{step.whatHappensNext}</span>
                    </div>

                    {/* Expandable Pro-Tip */}
                    {step.tip && (
                      <div style={{ marginBottom: '16px' }}>
                        <button
                          type="button"
                          onClick={() => toggleTip(step.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-600)',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <Info size={13} />
                          <span>
                            {isTipOpen
                              ? t('onboarding.card.hideTip', 'Hide Tip')
                              : t('onboarding.card.showTip', 'Show Helpful Tip')}
                          </span>
                          {isTipOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {isTipOpen && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: 'rgba(13, 148, 136, 0.08)',
                              border: '1px solid rgba(13, 148, 136, 0.2)',
                              fontSize: '12px',
                              color: 'var(--text-main)',
                              lineHeight: 1.45,
                            }}
                          >
                            💡 <strong>{t('onboarding.card.tipLabel', 'Tip:')}</strong> {step.tip}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Button Row Aligned Right */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => navigate(step.actionRoute)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid var(--primary-600)',
                          background: 'transparent',
                          color: 'var(--primary-600)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--primary-600)';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--primary-600)';
                        }}
                      >
                        <span>{step.actionText}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OnboardingInstructionsPage;
