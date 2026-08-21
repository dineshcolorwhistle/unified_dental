import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding (Platform Super Admin Only)...');

  // 1. Seed Permissions
  const permissionsData = [
    // Platform / Tenant Core
    { key: 'tenant.view', name: 'View Tenant Details', group: 'Tenancy', moduleKey: null },
    { key: 'tenant.manage', name: 'Manage Tenant Settings', group: 'Tenancy', moduleKey: null },
    { key: 'module.manage', name: 'Enable/Disable Modules', group: 'Tenancy', moduleKey: null },

    // Branch Management
    { key: 'branch.view', name: 'View Branches', group: 'Branches', moduleKey: null },
    { key: 'branch.manage', name: 'Create/Edit Branches', group: 'Branches', moduleKey: null },

    // User & Access Management
    { key: 'user.view', name: 'View Users', group: 'Users', moduleKey: null },
    { key: 'user.invite', name: 'Invite/Create Users', group: 'Users', moduleKey: null },
    { key: 'user.manage', name: 'Edit/Deactivate Users', group: 'Users', moduleKey: null },
    { key: 'role.manage', name: 'Manage Roles and Permissions', group: 'RBAC', moduleKey: null },

    // Audit & Logs
    { key: 'audit.view', name: 'View Audit Logs', group: 'Audit', moduleKey: null },
    { key: 'file.upload', name: 'Upload Files', group: 'Files', moduleKey: null },
    { key: 'file.view', name: 'View Files', group: 'Files', moduleKey: null },

    // Lab Operations Permissions
    { key: 'work_order.view', name: 'View Work Orders', group: 'Lab Operations', moduleKey: 'LAB' },
    { key: 'work_order.create', name: 'Create Work Order', group: 'Lab Operations', moduleKey: 'LAB' },
    { key: 'work_order.process', name: 'Update Process Stages', group: 'Lab Operations', moduleKey: 'LAB' },
    { key: 'work_order.verify', name: 'Verify Quality Control', group: 'Lab Operations', moduleKey: 'LAB' },
    { key: 'lab.catalog.manage', name: 'Manage Prosthesis Catalog', group: 'Lab Settings', moduleKey: 'LAB' },

    // Clinic Operations Permissions
    { key: 'patient.view', name: 'View Patient Profiles', group: 'Clinic Records', moduleKey: 'CLINIC' },
    { key: 'patient.create', name: 'Create/Edit Patients', group: 'Clinic Records', moduleKey: 'CLINIC' },
    { key: 'appointment.view', name: 'View Appointments', group: 'Clinic Schedule', moduleKey: 'CLINIC' },
    { key: 'appointment.manage', name: 'Schedule/Reschedule Appointments', group: 'Clinic Schedule', moduleKey: 'CLINIC' },
    { key: 'treatment.manage', name: 'Manage Treatment Plans & Charts', group: 'Clinic Operations', moduleKey: 'CLINIC' },
    { key: 'billing.manage', name: 'Manage Clinic Invoices & Payments', group: 'Clinic Billing', moduleKey: 'CLINIC' },
  ];

  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, group: perm.group, moduleKey: perm.moduleKey },
      create: perm,
    });
  }
  console.log(`✅ Seeded ${permissionsData.length} permissions`);

  // 2. Seed System Roles
  const systemRoles = [
    {
      name: 'Tenant Admin',
      slug: 'tenant-admin',
      isSystem: true,
      description: 'Full administrative control over tenant branches, staff, and enabled modules',
      moduleKey: null,
      permissionKeys: permissionsData.map((p) => p.key),
    },
    {
      name: 'Staff Member',
      slug: 'staff',
      isSystem: true,
      description: 'Standard staff member with view access to tenant and branch operations',
      moduleKey: null,
      permissionKeys: ['tenant.view', 'branch.view', 'user.view', 'file.view'],
    },
    {
      name: 'Lab Admin',
      slug: 'lab-admin',
      isSystem: true,
      description: 'Manages dental lab workflows, technician assignments, and catalog',
      moduleKey: 'LAB',
      permissionKeys: ['branch.view', 'user.view', 'file.upload', 'file.view', 'work_order.view', 'work_order.create', 'work_order.process', 'work_order.verify', 'lab.catalog.manage'],
    },
    {
      name: 'Lab Technician',
      slug: 'lab-technician',
      isSystem: true,
      description: 'Executes prosthesis production and updates stage checkpoints',
      moduleKey: 'LAB',
      permissionKeys: ['branch.view', 'file.upload', 'file.view', 'work_order.view', 'work_order.process'],
    },
    {
      name: 'Clinic Admin',
      slug: 'clinic-admin',
      isSystem: true,
      description: 'Manages dental clinic operations, staff schedules, and billing',
      moduleKey: 'CLINIC',
      permissionKeys: ['branch.view', 'user.view', 'file.upload', 'file.view', 'patient.view', 'patient.create', 'appointment.view', 'appointment.manage', 'treatment.manage', 'billing.manage'],
    },
    {
      name: 'Clinic Doctor',
      slug: 'clinic-doctor',
      isSystem: true,
      description: 'Handles patient examinations, dental charting, treatment plans, and prescriptions',
      moduleKey: 'CLINIC',
      permissionKeys: ['branch.view', 'file.upload', 'file.view', 'patient.view', 'patient.create', 'appointment.view', 'appointment.manage', 'treatment.manage'],
    },
  ];

  for (const roleDef of systemRoles) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_slug: {
          tenantId: 'system-placeholder',
          slug: roleDef.slug,
        },
      },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
        moduleKey: roleDef.moduleKey,
      },
      create: {
        tenantId: null,
        name: roleDef.name,
        slug: roleDef.slug,
        isSystem: true,
        description: roleDef.description,
        moduleKey: roleDef.moduleKey,
      },
    }).catch(async () => {
      // In case null tenantId unique constraint
      return prisma.role.findFirst({ where: { slug: roleDef.slug, tenantId: null } }) ||
        prisma.role.create({
          data: {
            tenantId: null,
            name: roleDef.name,
            slug: roleDef.slug,
            isSystem: true,
            description: roleDef.description,
            moduleKey: roleDef.moduleKey,
          },
        });
    });

    // Link permissions
    const perms = await prisma.permission.findMany({
      where: { key: { in: roleDef.permissionKeys } },
    });
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      });
    }
  }
  console.log(`✅ Seeded ${systemRoles.length} system roles & mapped permissions`);

  // 3. Seed Platform Super Admin User
  const passwordHashAdmin = await bcrypt.hash('Admin@123456', 10);
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@unifieddental.com' },
    update: { passwordHash: passwordHashAdmin, isSuperAdmin: true, status: UserStatus.ACTIVE },
    create: {
      email: 'admin@unifieddental.com',
      passwordHash: passwordHashAdmin,
      name: 'Platform Super Admin',
      phone: '+1-800-555-0100',
      isSuperAdmin: true,
      status: UserStatus.ACTIVE,
      locale: 'en',
    },
  });
  console.log(`✅ Seeded Platform Super Admin: ${platformAdmin.email}`);

  console.log('🎉 Database seeding completed (Super Admin & System RBAC only - No pre-seeded modules or plans)!');
  console.log('');
  console.log('📋 Login Credentials:');
  console.log('   Platform Admin: admin@unifieddental.com / Admin@123456');
  console.log('   Login URL: http://localhost:5173/login');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
