import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_CLINIC_FEATURE_KEYS } from '../src/modules/clinic/types/constants/configurable-menus.constant';

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
  } else {
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

  // Ensure Default Dental Clinic Type exists
  console.log('🌱 Checking Default Clinic Type...');
  const existingClinicType = await prisma.clinicType.findFirst({
    where: {
      OR: [{ code: 'DENTAL' }, { isDefault: true }],
    },
  });

  if (!existingClinicType) {
    const defaultDental = await prisma.clinicType.create({
      data: {
        name: 'Dental Clinic',
        code: 'DENTAL',
        description: 'Default comprehensive dental healthcare clinic type with standard clinic operations.',
        icon: 'Stethoscope',
        features: DEFAULT_CLINIC_FEATURE_KEYS,
        isDefault: true,
        isActive: true,
      },
    });
    console.log(`✅ Default Dental Clinic type created: ${defaultDental.name} (${defaultDental.code})`);
  } else {
    if (!existingClinicType.isDefault) {
      await prisma.clinicType.update({
        where: { id: existingClinicType.id },
        data: { isDefault: true },
      });
      console.log(`✅ Marked ${existingClinicType.name} as default clinic type.`);
    } else {
      console.log(`ℹ️ Default clinic type already exists: ${existingClinicType.name} (${existingClinicType.code})`);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
