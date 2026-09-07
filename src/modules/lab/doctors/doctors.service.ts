import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import {
  CreateDoctorDto,
  UpdateDoctorDto,
  CreateDoctorListDto,
  UpdateDoctorListDto,
  DoctorTypeDto,
} from './dto';
import { DoctorType } from '@prisma/client';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check whether an authenticated actor is a Tenant Administrator or Platform Super Admin
   */
  async isTenantAdminUser(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (actor.isSuperAdmin) return true;

    const isOwnerMem = (actor as any).memberships?.some(
      (m: any) => m.tenantId === tenantId && m.isOwner,
    );
    if (isOwnerMem) return true;

    const hasAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return (
        lower === 'tenant-admin' ||
        lower.includes('tenant administrator') ||
        lower.includes('tenant admin')
      );
    });
    if (hasAdminRole) return true;

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: actor.id, tenantId } },
    });
    if (membership?.isOwner) return true;

    const userAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: { in: ['tenant-admin', 'admin', 'administrator'] } },
      },
    });

    return Boolean(userAdminRole);
  }

  /**
   * Check whether an authenticated actor is a Lab Administrator
   */
  async isLabAdminUser(actor: AuthenticatedUser, tenantId: string): Promise<boolean> {
    const hasLabAdminRole = actor.roles?.some((r: string) => {
      const lower = r.toLowerCase();
      return lower === 'lab admin' || lower === 'lab-admin';
    });
    if (hasLabAdminRole) return true;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-admin' },
      },
    });

    return Boolean(userRole);
  }

  /**
   * Resolve branch for Lab Admin
   */
  async resolveLabAdminBranch(actor: AuthenticatedUser, tenantId: string): Promise<string> {
    const labAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-admin' },
      },
    });

    if (labAdminRole?.branchId) {
      return labAdminRole.branchId;
    }

    const defaultUserBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: { tenantId, moduleKey: 'LAB', status: 'ACTIVE' },
      },
      include: { branch: true },
    });

    if (defaultUserBranch) {
      return defaultUserBranch.branchId;
    }

    throw new BadRequestException(
      'Your Lab Administrator account is not assigned to an active Dental Lab branch.',
    );
  }

  // ══════════════════════════════════════════════════════════════
  // DOCTORS CRUD
  // ══════════════════════════════════════════════════════════════

  /**
   * List all doctors for tenant.
   * Scoped to branch for Lab Admin; cross-branch or filtered by branch for Tenant Admin.
   */
  async findAll(
    tenantId: string,
    actor: AuthenticatedUser,
    branchId?: string,
    search?: string,
    status?: string,
    type?: string,
  ) {
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    let effectiveBranchId: string | undefined = undefined;

    if (!isTenantAdmin) {
      const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
      if (isLabAdmin) {
        effectiveBranchId = await this.resolveLabAdminBranch(actor, tenantId);
      }
    } else if (branchId && branchId !== 'all') {
      effectiveBranchId = branchId;
    }

    const whereClause: any = {
      tenantId,
      moduleKey: 'LAB',
    };

    if (effectiveBranchId) {
      whereClause.branchId = effectiveBranchId;
    }

    if (status && status !== 'ALL') {
      whereClause.isActive = status === 'ACTIVE';
    }

    if (type && type !== 'ALL') {
      whereClause.type = type.toUpperCase() as DoctorType;
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { clinicName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { specialization: { contains: q, mode: 'insensitive' } },
      ];
    }

    const doctors = await this.prisma.doctor.findMany({
      where: whereClause,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        listMembers: {
          include: {
            doctorList: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return doctors;
  }

  /**
   * Get single doctor by ID
   */
  async findOne(tenantId: string, id: string, actor: AuthenticatedUser) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        listMembers: {
          include: {
            doctorList: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${id}" was not found.`);
    }

    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    if (!isTenantAdmin) {
      const labBranchId = await this.resolveLabAdminBranch(actor, tenantId);
      if (doctor.branchId && doctor.branchId !== labBranchId) {
        throw new ForbiddenException('You do not have permission to view doctors outside your branch.');
      }
    }

    return doctor;
  }

  /**
   * Create Doctor — RESTRICTED TO LAB ADMIN ONLY.
   * Tenant Admins are not permitted to create doctors.
   */
  async create(dto: CreateDoctorDto, tenantId: string, actor: AuthenticatedUser) {
    const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);

    if (!isLabAdmin) {
      if (isTenantAdmin) {
        throw new ForbiddenException(
          'Tenant Administrators cannot create Doctor records directly. Doctors must be created by a Lab Administrator assigned to a Dental Lab branch.',
        );
      }
      throw new ForbiddenException('Only Lab Administrators can create new doctor records.');
    }

    const branchId = await this.resolveLabAdminBranch(actor, tenantId);

    const doctor = await this.prisma.doctor.create({
      data: {
        tenantId,
        branchId,
        moduleKey: 'LAB',
        name: dto.name.trim(),
        clinicName: dto.clinicName?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        specialization: dto.specialization?.trim() || null,
        type: (dto.type as unknown as DoctorType) || DoctorType.LOCAL,
        isActive: true,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    this.logger.log(`Doctor created: "${doctor.name}" in branch "${branchId}" for tenant "${tenantId}"`);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId,
        moduleKey: 'LAB',
        userId: actor.id,
        action: 'CREATE',
        resourceType: 'DOCTOR',
        resourceId: doctor.id,
        newValues: {
          name: doctor.name,
          clinicName: doctor.clinicName,
          type: doctor.type,
        },
      },
    });

    return doctor;
  }

  /**
   * Update Doctor — Lab Admin (scoped to branch) or Tenant Admin
   */
  async update(id: string, dto: UpdateDoctorDto, tenantId: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.doctor.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
    });

    if (!existing) {
      throw new NotFoundException(`Doctor with ID "${id}" was not found.`);
    }

    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    if (!isTenantAdmin) {
      const labBranchId = await this.resolveLabAdminBranch(actor, tenantId);
      if (existing.branchId && existing.branchId !== labBranchId) {
        throw new ForbiddenException('You cannot modify doctors belonging to another branch.');
      }
    }

    const updated = await this.prisma.doctor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.clinicName !== undefined && { clinicName: dto.clinicName?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
        ...(dto.specialization !== undefined && { specialization: dto.specialization?.trim() || null }),
        ...(dto.type !== undefined && { type: dto.type as unknown as DoctorType }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        listMembers: {
          include: {
            doctorList: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId: existing.branchId,
        moduleKey: 'LAB',
        userId: actor.id,
        action: 'UPDATE',
        resourceType: 'DOCTOR',
        resourceId: updated.id,
        newValues: {
          name: updated.name,
          clinicName: updated.clinicName,
          isActive: updated.isActive,
        },
        oldValues: {
          name: existing.name,
          clinicName: existing.clinicName,
          isActive: existing.isActive,
        },
      },
    });

    return updated;
  }

  /**
   * Delete Doctor — Only Tenant Admin can delete
   */
  async delete(id: string, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    if (!isTenantAdmin) {
      throw new ForbiddenException('Only tenant administrators can delete doctors.');
    }

    const existing = await this.prisma.doctor.findFirst({
      where: { id, tenantId, moduleKey: 'LAB' },
    });

    if (!existing) {
      throw new NotFoundException(`Doctor with ID "${id}" was not found.`);
    }

    await this.prisma.doctor.delete({
      where: { id },
    });

    this.logger.log(`Doctor deleted: "${existing.name}" (${id}) for tenant "${tenantId}"`);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId: existing.branchId,
        moduleKey: 'LAB',
        userId: actor.id,
        action: 'DELETE',
        resourceType: 'DOCTOR',
        resourceId: id,
        oldValues: {
          name: existing.name,
          clinicName: existing.clinicName,
          type: existing.type,
        },
      },
    });

    return { success: true, message: 'Doctor deleted successfully.' };
  }

  // ══════════════════════════════════════════════════════════════
  // DOCTOR LISTS / GROUPS MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  /**
   * List all doctor groups
   */
  async findAllLists(tenantId: string, actor: AuthenticatedUser, branchId?: string) {
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    let effectiveBranchId: string | undefined = undefined;

    if (!isTenantAdmin) {
      const isLabAdmin = await this.isLabAdminUser(actor, tenantId);
      if (isLabAdmin) {
        effectiveBranchId = await this.resolveLabAdminBranch(actor, tenantId);
      }
    } else if (branchId && branchId !== 'all') {
      effectiveBranchId = branchId;
    }

    const whereClause: any = {
      tenantId,
      moduleKey: 'LAB',
    };

    if (effectiveBranchId) {
      whereClause.OR = [{ branchId: effectiveBranchId }, { branchId: null }];
    }

    const lists = await this.prisma.doctorList.findMany({
      where: whereClause,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { members: true },
        },
        members: {
          take: 5,
          include: {
            doctor: {
              select: { id: true, name: true, clinicName: true, type: true },
            },
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return lists;
  }

  /**
   * Get single doctor group with all members
   */
  async findOneList(tenantId: string, listId: string, actor: AuthenticatedUser) {
    const list = await this.prisma.doctorList.findFirst({
      where: { id: listId, tenantId, moduleKey: 'LAB' },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        members: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                clinicName: true,
                email: true,
                phone: true,
                specialization: true,
                type: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Doctor group with ID "${listId}" was not found.`);
    }

    return list;
  }

  /**
   * Create doctor group
   */
  async createList(dto: CreateDoctorListDto, tenantId: string, actor: AuthenticatedUser) {
    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    let finalBranchId: string | null = null;

    if (!isTenantAdmin) {
      finalBranchId = await this.resolveLabAdminBranch(actor, tenantId);
    } else if (dto.branchId && dto.branchId !== 'all') {
      finalBranchId = dto.branchId;
    }

    const existing = await this.prisma.doctorList.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A doctor group named "${dto.name}" already exists in this branch/organization.`,
      );
    }

    const createdList = await this.prisma.doctorList.create({
      data: {
        tenantId,
        branchId: finalBranchId,
        moduleKey: 'LAB',
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        ...(dto.doctorIds && dto.doctorIds.length > 0 && {
          members: {
            create: dto.doctorIds.map((docId) => ({
              doctor: { connect: { id: docId } },
            })),
          },
        }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return createdList;
  }

  /**
   * Update doctor group name/description
   */
  async updateList(
    listId: string,
    dto: UpdateDoctorListDto,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.doctorList.findFirst({
      where: { id: listId, tenantId, moduleKey: 'LAB' },
    });

    if (!existing) {
      throw new NotFoundException(`Doctor group with ID "${listId}" was not found.`);
    }

    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    if (!isTenantAdmin) {
      const labBranchId = await this.resolveLabAdminBranch(actor, tenantId);
      if (existing.branchId && existing.branchId !== labBranchId) {
        throw new ForbiddenException('You cannot modify doctor groups belonging to another branch.');
      }
    }

    if (dto.doctorIds !== undefined) {
      await this.prisma.doctorListMember.deleteMany({
        where: { doctorListId: listId },
      });
      if (dto.doctorIds.length > 0) {
        await this.prisma.doctorListMember.createMany({
          data: dto.doctorIds.map((docId) => ({
            doctorListId: listId,
            doctorId: docId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await this.prisma.doctorList.update({
      where: { id: listId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return updated;
  }

  /**
   * Delete doctor group
   */
  async deleteList(listId: string, tenantId: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.doctorList.findFirst({
      where: { id: listId, tenantId, moduleKey: 'LAB' },
    });

    if (!existing) {
      throw new NotFoundException(`Doctor group with ID "${listId}" was not found.`);
    }

    const isTenantAdmin = await this.isTenantAdminUser(actor, tenantId);
    if (!isTenantAdmin) {
      const labBranchId = await this.resolveLabAdminBranch(actor, tenantId);
      if (existing.branchId && existing.branchId !== labBranchId) {
        throw new ForbiddenException('You cannot delete doctor groups belonging to another branch.');
      }
    }

    await this.prisma.doctorList.delete({
      where: { id: listId },
    });

    return { success: true, message: 'Doctor group deleted successfully.' };
  }

  /**
   * Add members to group
   */
  async addMembers(
    listId: string,
    doctorIds: string[],
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const list = await this.prisma.doctorList.findFirst({
      where: { id: listId, tenantId, moduleKey: 'LAB' },
    });

    if (!list) {
      throw new NotFoundException(`Doctor group with ID "${listId}" was not found.`);
    }

    // Verify all doctors belong to the tenant
    const validDoctors = await this.prisma.doctor.findMany({
      where: {
        id: { in: doctorIds },
        tenantId,
      },
      select: { id: true },
    });

    const validIds = validDoctors.map((d) => d.id);

    // Upsert or create members ignoring duplicates
    for (const docId of validIds) {
      await this.prisma.doctorListMember.upsert({
        where: {
          doctorListId_doctorId: {
            doctorListId: listId,
            doctorId: docId,
          },
        },
        create: {
          doctorListId: listId,
          doctorId: docId,
        },
        update: {},
      });
    }

    return this.findOneList(tenantId, listId, actor);
  }

  /**
   * Remove doctor from group
   */
  async removeMember(
    listId: string,
    doctorId: string,
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const list = await this.prisma.doctorList.findFirst({
      where: { id: listId, tenantId, moduleKey: 'LAB' },
    });

    if (!list) {
      throw new NotFoundException(`Doctor group with ID "${listId}" was not found.`);
    }

    await this.prisma.doctorListMember.deleteMany({
      where: {
        doctorListId: listId,
        doctorId,
      },
    });

    return { success: true, message: 'Doctor removed from group successfully.' };
  }
}
