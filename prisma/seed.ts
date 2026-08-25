import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@unifieddental.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

  console.log('🌱 Checking Platform Super Admin...');

  // Check if a super admin or this specific admin user already exists in DB
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { isSuperAdmin: true },
      ],
    },
  });

  if (existingSuperAdmin) {
    console.log(`ℹ️ Platform Super Admin already exists in the database (${existingSuperAdmin.email}). Skipping creation.`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const platformAdmin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: 'Platform Super Admin',
      phone: '+1-800-555-0100',
      isSuperAdmin: true,
      status: UserStatus.ACTIVE,
      locale: 'en',
    },
  });

  console.log(`✅ Platform Super Admin created: ${platformAdmin.email}`);
  console.log('');
  console.log('📋 Platform Super Admin Credentials:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
