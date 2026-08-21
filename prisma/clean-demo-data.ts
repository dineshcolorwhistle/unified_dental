import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up database to keep ONLY platform super admin...');

  // Delete all non-superadmin related records
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.userBranch.deleteMany({});
  await prisma.userModuleAccess.deleteMany({});
  await prisma.tenantMembership.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.tenantModule.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  
  // Delete all users except super admins
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      isSuperAdmin: false,
    },
  });

  console.log(`✅ Deleted ${deletedUsers.count} non-superadmin users.`);
  console.log('✅ Cleaned up all tenants, branches, memberships, and tenant-scoped data.');

  const remainingUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true,
    },
  });

  console.log('👥 Remaining platform users:');
  console.table(remainingUsers);
}

cleanup()
  .catch((e) => {
    console.error('❌ Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
