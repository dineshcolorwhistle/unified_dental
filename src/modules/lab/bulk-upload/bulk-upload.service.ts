import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MailService } from '../../../core/mail/mail.service';
import { AuthenticatedUser } from '../../../shared/common/decorators/current-user.decorator';
import { DoctorType, ProcessType, UserStatus } from '@prisma/client';
import {
  BulkUploadImportResponseDto,
  BulkUploadRowError,
  BulkUploadValidationResponseDto,
} from './dto/bulk-upload-result.dto';

interface ParsedTechnician {
  rowNum: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  formattedPhone: string | null;
  isExisting: boolean;
  existingUserId?: string;
}

interface ParsedDoctor {
  rowNum: number;
  name: string;
  clinicName?: string;
  email?: string;
  phone?: string;
  address?: string;
  type: DoctorType;
}

interface ParsedProcessArea {
  rowNum: number;
  name: string;
  description?: string;
  isExisting: boolean;
  existingId?: string;
}

interface ParsedProcess {
  rowNum: number;
  name: string;
  type: ProcessType;
  processAreaName: string;
  defaultTechnicianName?: string;
}

interface ValidatedWorkbookData {
  branchId: string;
  branchName: string;
  technicians: ParsedTechnician[];
  doctors: ParsedDoctor[];
  processAreas: ParsedProcessArea[];
  processes: ParsedProcess[];
}

@Injectable()
export class BulkUploadService {
  private readonly logger = new Logger(BulkUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Enforce that the actor is a Lab Admin and return their assigned branch ID.
   */
  async assertLabAdmin(actor: AuthenticatedUser, tenantId: string): Promise<string> {
    const labAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: actor.id,
        tenantId,
        role: { slug: 'lab-admin' },
      },
      include: { branch: true },
    });

    if (labAdminRole?.branchId) {
      return labAdminRole.branchId;
    }

    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        userId: actor.id,
        branch: { tenantId, moduleKey: 'LAB', status: 'ACTIVE' },
      },
    });

    if (userBranch?.branchId) {
      return userBranch.branchId;
    }

    if (actor.isSuperAdmin) {
      if (actor.activeBranchId && actor.activeBranchId !== 'all') {
        return actor.activeBranchId;
      }
      const firstBranch = await this.prisma.branch.findFirst({
        where: { tenantId, moduleKey: 'LAB', status: 'ACTIVE' },
      });
      if (firstBranch) return firstBranch.id;
      throw new BadRequestException('No active Lab branch found in organization.');
    }

    throw new ForbiddenException(
      'Only Lab Administrators assigned to a Dental Lab branch can access bulk upload.',
    );
  }

  /**
   * Auto-provision or retrieve the system role for Lab Technician.
   */
  async ensureLabTechnicianRole() {
    let role = await this.prisma.role.findFirst({
      where: { slug: 'lab-technician' },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: 'Lab Technician',
          slug: 'lab-technician',
          description: 'Technician for Dental Lab process execution and work orders',
          moduleKey: 'LAB',
          isSystem: true,
          tenantId: null,
        },
      });
    }

    return role;
  }

  /**
   * Generates a 4-sheet Excel (.xlsx) template with named ranges and cross-sheet dropdowns.
   */
  async generateTemplate(
    tenantId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buffer: ExcelJS.Buffer; fileName: string }> {
    const branchId = await this.assertLabAdmin(actor, tenantId);

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Unified Dental Platform';
    workbook.lastModifiedBy = actor.email;
    workbook.created = new Date();
    workbook.modified = new Date();

    // ─────────────────────────────────────────────────────────────
    // COMMON STYLES
    // ─────────────────────────────────────────────────────────────
    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    const headerAlignment: Partial<ExcelJS.Alignment> = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    const instructionFont: Partial<ExcelJS.Font> = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: 'FF475569' },
    };

    const exampleFont: Partial<ExcelJS.Font> = {
      name: 'Calibri',
      size: 10,
      color: { argb: 'FF64748B' },
      italic: true,
    };

    // ─────────────────────────────────────────────────────────────
    // SHEET 1: Technician
    // ─────────────────────────────────────────────────────────────
    const wsTech = workbook.addWorksheet('Technician', {
      properties: { tabColor: { argb: 'FF107C41' } }, // Green
    });

    wsTech.columns = [
      { header: 'First Name *', key: 'firstName', width: 20 },
      { header: 'Last Name *', key: 'lastName', width: 20 },
      { header: 'Email *', key: 'email', width: 32 },
      { header: 'Phone Country Code', key: 'phoneCountryCode', width: 18 },
      { header: 'Phone Number', key: 'phoneNumber', width: 20 },
    ];

    const techHeaderRow = wsTech.getRow(1);
    techHeaderRow.height = 26;
    techHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF15803D' }, // Emerald 700
      };
      cell.font = headerFont;
      cell.alignment = headerAlignment;
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF166534' } },
      };
    });

    // ─────────────────────────────────────────────────────────────
    // SHEET 2: Doctor
    // ─────────────────────────────────────────────────────────────
    const wsDoc = workbook.addWorksheet('Doctor', {
      properties: { tabColor: { argb: 'FF1D4ED8' } }, // Blue
    });

    wsDoc.columns = [
      { header: 'Doctor Name *', key: 'name', width: 26 },
      { header: 'Clinic Name', key: 'clinicName', width: 26 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Address', key: 'address', width: 34 },
    ];

    const docHeaderRow = wsDoc.getRow(1);
    docHeaderRow.height = 26;
    docHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1D4ED8' }, // Blue 700
      };
      cell.font = headerFont;
      cell.alignment = headerAlignment;
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF1E40AF' } },
      };
    });

    // ─────────────────────────────────────────────────────────────
    // SHEET 3: Process Area
    // ─────────────────────────────────────────────────────────────
    const wsArea = workbook.addWorksheet('Process Area', {
      properties: { tabColor: { argb: 'FFD97706' } }, // Amber
    });

    wsArea.columns = [
      { header: 'Process Area Name *', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 45 },
    ];

    const areaHeaderRow = wsArea.getRow(1);
    areaHeaderRow.height = 26;
    areaHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD97706' }, // Amber 600
      };
      cell.font = headerFont;
      cell.alignment = headerAlignment;
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FFB45309' } },
      };
    });

    // ─────────────────────────────────────────────────────────────
    // SHEET 4: Process (Dependent Sheet)
    // ─────────────────────────────────────────────────────────────
    const wsProc = workbook.addWorksheet('Process', {
      properties: { tabColor: { argb: 'FF7C3AED' } }, // Purple
    });

    wsProc.columns = [
      { header: 'Process Name *', key: 'name', width: 28 },
      { header: 'Process Type *', key: 'type', width: 26 },
      { header: 'Process Area *', key: 'processArea', width: 30 },
      { header: 'Default Technician *', key: 'technician', width: 28 },
    ];

    const procHeaderRow = wsProc.getRow(1);
    procHeaderRow.height = 26;
    procHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C3AED' }, // Violet 600
      };
      cell.font = headerFont;
      cell.alignment = headerAlignment;
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF6D28D9' } },
      };
    });

    // Populate hidden mirror columns on Process sheet (Cols J & K) so Google Sheets & Excel
    // can create native dropdowns from a same-sheet range reliably
    wsProc.getColumn('J').hidden = true;
    wsProc.getColumn('K').hidden = true;
    wsProc.getCell('J1').value = '_HelperProcessArea';
    wsProc.getCell('K1').value = '_HelperTechnician';

    for (let r = 2; r <= 300; r++) {
      wsProc.getCell(`J${r}`).value = { formula: `='Process Area'!A${r}` };
      wsProc.getCell(`K${r}`).value = { formula: `='Technician'!A${r}` };
    }

    // Keep workbook-level defined names for Excel
    workbook.definedNames.add("'Process Area'!$A$2:$A$300", 'ProcessAreaList');
    workbook.definedNames.add("'Technician'!$A$2:$A$300", 'TechnicianList');

    // Range-level data validations for Sheet 4
    (wsProc as any).dataValidations.add('B2:B300', {
      type: 'list',
      allowBlank: false,
      formulae: ['"PRODUCTION,INTERNAL_VERIFICATION,EXTERNAL_VERIFICATION"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Process Type',
      error: 'Choose PRODUCTION, INTERNAL_VERIFICATION, or EXTERNAL_VERIFICATION.',
    });

    (wsProc as any).dataValidations.add('C2:C300', {
      type: 'list',
      allowBlank: false,
      formulae: ['=$J$2:$J$300'],
      showErrorMessage: true,
      errorTitle: 'Invalid Process Area',
      error: 'Please select a Process Area entered in the Process Area sheet.',
    });

    (wsProc as any).dataValidations.add('D2:D300', {
      type: 'list',
      allowBlank: false,
      formulae: ['=$K$2:$K$300'],
      showErrorMessage: true,
      errorTitle: 'Invalid Technician',
      error: 'Please select a Technician entered in the Technician sheet. Default Technician is mandatory.',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const safeBranchName = (branch?.name || 'Lab')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    const fileName = `Dental_Lab_Bulk_Upload_Template_${safeBranchName}.xlsx`;

    return { buffer, fileName };
  }

  /**
   * Validate and parse an uploaded Excel workbook.
   */
  async parseAndValidate(
    fileBuffer: Buffer,
    tenantId: string,
    branchId: string,
    actor: AuthenticatedUser,
  ): Promise<{
    valid: boolean;
    errors: BulkUploadRowError[];
    data?: ValidatedWorkbookData;
  }> {
    const errors: BulkUploadRowError[] = [];

    // Read with xlsx to support both .xlsx and .xls seamlessly
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to parse the uploaded Excel file. Please ensure it is a valid .xlsx or .xls file. Error: ${err.message}`,
      );
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Assigned lab branch was not found.');
    }

    // Check required sheets
    const requiredSheets = ['Technician', 'Doctor', 'Process Area', 'Process'];
    const sheetMap: Record<string, string> = {};
    for (const req of requiredSheets) {
      const match = wb.SheetNames.find(
        (s) => s.trim().toLowerCase() === req.toLowerCase(),
      );
      if (!match) {
        errors.push({
          sheet: req as any,
          row: 1,
          column: 'Sheet',
          message: `Required sheet "${req}" is missing from the Excel workbook.`,
        });
      } else {
        sheetMap[req] = match;
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // ─────────────────────────────────────────────────────────────
    // 1. PARSE SHEET: Technician
    // ─────────────────────────────────────────────────────────────
    const techSheet = wb.Sheets[sheetMap['Technician']];
    const techRows: any[][] = XLSX.utils.sheet_to_json(techSheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    const parsedTechs: ParsedTechnician[] = [];
    const seenTechEmails = new Set<string>();

    // Row 0 is header. Data starts from index 1 (Row 2).
    for (let i = 1; i < techRows.length; i++) {
      const row = techRows[i];
      const rowNum = i + 1;

      const firstName = String(row[0] || '').trim();
      const lastName = String(row[1] || '').trim();
      const email = String(row[2] || '').trim().toLowerCase();
      const phoneCountryCode = String(row[3] || '+52').trim() || '+52';
      const phoneNumber = String(row[4] || '').trim();

      // Skip empty or placeholder rows
      if (!firstName && !lastName && !email) continue;

      if (!firstName) {
        errors.push({
          sheet: 'Technician',
          row: rowNum,
          column: 'First Name',
          message: 'First Name is required.',
        });
      }

      if (!lastName) {
        errors.push({
          sheet: 'Technician',
          row: rowNum,
          column: 'Last Name',
          message: 'Last Name is required.',
        });
      }

      if (!email) {
        errors.push({
          sheet: 'Technician',
          row: rowNum,
          column: 'Email',
          message: 'Email address is required.',
        });
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push({
            sheet: 'Technician',
            row: rowNum,
            column: 'Email',
            value: email,
            message: 'Invalid email address format.',
          });
        } else if (seenTechEmails.has(email)) {
          errors.push({
            sheet: 'Technician',
            row: rowNum,
            column: 'Email',
            value: email,
            message: `Duplicate email "${email}" entered more than once in the Technician sheet.`,
          });
        } else {
          seenTechEmails.add(email);
        }
      }

      const fullName = `${firstName} ${lastName}`.trim();
      let formattedPhone: string | null = null;
      if (phoneNumber) {
        formattedPhone = `${phoneCountryCode} ${phoneNumber}`.trim();
      }

      parsedTechs.push({
        rowNum,
        firstName,
        lastName,
        fullName,
        email,
        phoneCountryCode,
        phoneNumber,
        formattedPhone,
        isExisting: false,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PARSE SHEET: Doctor
    // ─────────────────────────────────────────────────────────────
    const docSheet = wb.Sheets[sheetMap['Doctor']];
    const docRows: any[][] = XLSX.utils.sheet_to_json(docSheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    const parsedDocs: ParsedDoctor[] = [];

    for (let i = 1; i < docRows.length; i++) {
      const row = docRows[i];
      const rowNum = i + 1;

      const name = String(row[0] || '').trim();
      const clinicName = String(row[1] || '').trim();
      const email = String(row[2] || '').trim().toLowerCase();
      const phone = String(row[3] || '').trim();
      const address = String(row[4] || '').trim();

      if (!name && !clinicName && !email) continue;

      if (!name) {
        errors.push({
          sheet: 'Doctor',
          row: rowNum,
          column: 'Doctor Name',
          message: 'Doctor Name is required.',
        });
      } else if (name.length < 2 || name.length > 100) {
        errors.push({
          sheet: 'Doctor',
          row: rowNum,
          column: 'Doctor Name',
          value: name,
          message: 'Doctor Name must be between 2 and 100 characters.',
        });
      }

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push({
            sheet: 'Doctor',
            row: rowNum,
            column: 'Email',
            value: email,
            message: 'Invalid email address format.',
          });
        }
      }

      parsedDocs.push({
        rowNum,
        name,
        clinicName: clinicName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        type: DoctorType.LOCAL,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PARSE SHEET: Process Area
    // ─────────────────────────────────────────────────────────────
    const areaSheet = wb.Sheets[sheetMap['Process Area']];
    const areaRows: any[][] = XLSX.utils.sheet_to_json(areaSheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    const parsedAreas: ParsedProcessArea[] = [];
    const seenAreaNames = new Set<string>();

    for (let i = 1; i < areaRows.length; i++) {
      const row = areaRows[i];
      const rowNum = i + 1;

      const name = String(row[0] || '').trim();
      const description = String(row[1] || '').trim();

      if (!name && !description) continue;
      // Skip example rows if untouched
      if (
        (name.toLowerCase() === 'cad / cam design' || name.toLowerCase() === 'ceramics & layering') &&
        description.toLowerCase().includes('station')
      ) {
        // Keep them if they are genuinely entered, or let user create them
      }

      if (!name) {
        errors.push({
          sheet: 'Process Area',
          row: rowNum,
          column: 'Process Area Name',
          message: 'Process Area Name is required.',
        });
      } else if (name.length > 100) {
        errors.push({
          sheet: 'Process Area',
          row: rowNum,
          column: 'Process Area Name',
          value: name,
          message: 'Process Area Name cannot exceed 100 characters.',
        });
      } else {
        const lower = name.toLowerCase();
        if (seenAreaNames.has(lower)) {
          errors.push({
            sheet: 'Process Area',
            row: rowNum,
            column: 'Process Area Name',
            value: name,
            message: `Duplicate Process Area "${name}" entered in sheet.`,
          });
        } else {
          seenAreaNames.add(lower);
        }
      }

      parsedAreas.push({
        rowNum,
        name,
        description: description || undefined,
        isExisting: false,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. PARSE SHEET: Process
    // ─────────────────────────────────────────────────────────────
    const procSheet = wb.Sheets[sheetMap['Process']];
    const procRows: any[][] = XLSX.utils.sheet_to_json(procSheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    const parsedProcesses: ParsedProcess[] = [];
    const seenProcessNames = new Set<string>();

    for (let i = 1; i < procRows.length; i++) {
      const row = procRows[i];
      const rowNum = i + 1;

      const name = String(row[0] || '').trim();
      const rawType = String(row[1] || 'PRODUCTION').trim().toUpperCase();
      const processAreaName = String(row[2] || '').trim();
      const defaultTechnicianName = String(row[3] || '').trim();

      if (!name && !processAreaName && !defaultTechnicianName) continue;

      if (!name) {
        errors.push({
          sheet: 'Process',
          row: rowNum,
          column: 'Process Name',
          message: 'Process Name is required.',
        });
      } else if (name.length > 100) {
        errors.push({
          sheet: 'Process',
          row: rowNum,
          column: 'Process Name',
          value: name,
          message: 'Process Name cannot exceed 100 characters.',
        });
      } else {
        const lower = name.toLowerCase();
        if (seenProcessNames.has(lower)) {
          errors.push({
            sheet: 'Process',
            row: rowNum,
            column: 'Process Name',
            value: name,
            message: `Duplicate Process Name "${name}" entered in sheet.`,
          });
        } else {
          seenProcessNames.add(lower);
        }
      }

      let procType: ProcessType = ProcessType.PRODUCTION;
      if (rawType) {
        if (
          rawType === 'PRODUCTION' ||
          rawType === 'INTERNAL_VERIFICATION' ||
          rawType === 'EXTERNAL_VERIFICATION'
        ) {
          procType = rawType as ProcessType;
        } else {
          errors.push({
            sheet: 'Process',
            row: rowNum,
            column: 'Process Type',
            value: rawType,
            message:
              'Process Type must be PRODUCTION, INTERNAL_VERIFICATION, or EXTERNAL_VERIFICATION.',
          });
        }
      }

      if (!processAreaName) {
        errors.push({
          sheet: 'Process',
          row: rowNum,
          column: 'Process Area',
          message: 'Process Area is required for every Process.',
        });
      }

      // Check technician requirement (mandatory for every Process)
      if (!defaultTechnicianName) {
        errors.push({
          sheet: 'Process',
          row: rowNum,
          column: 'Default Technician',
          message: 'Default Technician is required for every Process.',
        });
      }

      parsedProcesses.push({
        rowNum,
        name,
        type: procType,
        processAreaName,
        defaultTechnicianName: defaultTechnicianName || undefined,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. DATABASE CROSS-VALIDATION & DEPENDENCY MATCHING
    // ─────────────────────────────────────────────────────────────

    // A. Tenant Member limit check
    if (parsedTechs.length > 0) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      });

      const effectiveMaxMembers =
        tenant?.maxMembers !== null && tenant?.maxMembers !== undefined
          ? Number(tenant.maxMembers)
          : tenant?.plan?.memberCount !== null && tenant?.plan?.memberCount !== undefined
          ? Number(tenant.plan.memberCount)
          : 10;

      const currentMemberCount = await this.prisma.tenantMembership.count({
        where: { tenantId },
      });

      // Filter which technicians are truly new emails
      const existingUsersInDb = await this.prisma.user.findMany({
        where: {
          email: { in: parsedTechs.map((t) => t.email) },
        },
        include: {
          memberships: { where: { tenantId } },
          userBranches: { where: { branchId } },
        },
      });

      const existingEmailsMap = new Map<string, any>();
      existingUsersInDb.forEach((u) => existingEmailsMap.set(u.email.toLowerCase(), u));

      let newMembersCount = 0;
      for (const tech of parsedTechs) {
        const dbUser = existingEmailsMap.get(tech.email);
        if (dbUser) {
          if (dbUser.memberships.length > 0) {
            // Already member of tenant
            tech.isExisting = true;
            tech.existingUserId = dbUser.id;
          } else {
            newMembersCount++;
          }
        } else {
          newMembersCount++;
        }
      }

      if (currentMemberCount + newMembersCount > effectiveMaxMembers) {
        errors.push({
          sheet: 'Technician',
          row: 1,
          column: 'Member Limit',
          message: `Uploading ${newMembersCount} new technician(s) exceeds the organization member limit of ${effectiveMaxMembers} (Current active: ${currentMemberCount}).`,
        });
      }
    }

    // B. Existing Process Areas in this branch
    const existingBranchAreas = await this.prisma.processArea.findMany({
      where: { tenantId, branchId, moduleKey: 'LAB' },
      select: { id: true, name: true },
    });

    const areaNameMap = new Map<string, string>(); // lowerName -> id
    existingBranchAreas.forEach((a) => {
      areaNameMap.set(a.name.toLowerCase().trim(), a.id);
    });

    // Mark parsed areas that already exist in DB
    for (const area of parsedAreas) {
      const lower = area.name.toLowerCase();
      if (areaNameMap.has(lower)) {
        area.isExisting = true;
        area.existingId = areaNameMap.get(lower);
      }
    }

    // C. Existing Technicians & Staff in this branch
    const existingBranchUsers = await this.prisma.userBranch.findMany({
      where: {
        branchId,
        user: { memberships: { some: { tenantId } } },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const technicianLookup = new Map<string, string>(); // identifier (lower name, first name, or email) -> userId
    existingBranchUsers.forEach((ub) => {
      if (ub.user.name) {
        technicianLookup.set(ub.user.name.toLowerCase().trim(), ub.user.id);
        const firstName = ub.user.name.split(' ')[0].toLowerCase().trim();
        if (firstName) technicianLookup.set(firstName, ub.user.id);
      }
      if (ub.user.email) {
        technicianLookup.set(ub.user.email.toLowerCase().trim(), ub.user.id);
      }
    });

    // Also include technicians in the sheet into the lookup
    const sheetTechNames = new Set<string>();
    parsedTechs.forEach((t) => {
      sheetTechNames.add(t.fullName.toLowerCase());
      sheetTechNames.add(t.firstName.toLowerCase());
      sheetTechNames.add(t.email.toLowerCase());
    });

    // D. Validate Process Sheet Dependencies:
    // Every process area referenced must be in parsedAreas OR existing in DB
    for (const proc of parsedProcesses) {
      const areaLower = proc.processAreaName.toLowerCase();
      const inSheet = parsedAreas.some((a) => a.name.toLowerCase() === areaLower);
      const inDb = areaNameMap.has(areaLower);

      if (!inSheet && !inDb) {
        errors.push({
          sheet: 'Process',
          row: proc.rowNum,
          column: 'Process Area',
          value: proc.processAreaName,
          message: `Process Area "${proc.processAreaName}" does not exist in the Process Area sheet or in your branch.`,
        });
      }

      // Check technician dependency
      if (proc.defaultTechnicianName) {
        const techLower = proc.defaultTechnicianName.toLowerCase();
        const inTechSheet = sheetTechNames.has(techLower);
        const inBranchStaff = technicianLookup.has(techLower);

        if (!inTechSheet && !inBranchStaff) {
          errors.push({
            sheet: 'Process',
            row: proc.rowNum,
            column: 'Default Technician',
            value: proc.defaultTechnicianName,
            message: `Default Technician "${proc.defaultTechnicianName}" does not exist in the Technician sheet or among active branch staff.`,
          });
        }
      }

      // Check process name uniqueness against DB
      const existingProcInDb = await this.prisma.process.findFirst({
        where: {
          tenantId,
          branchId,
          name: { equals: proc.name, mode: 'insensitive' },
        },
      });

      if (existingProcInDb) {
        errors.push({
          sheet: 'Process',
          row: proc.rowNum,
          column: 'Process Name',
          value: proc.name,
          message: `A Process with the name "${proc.name}" already exists in your branch.`,
        });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: [],
      data: {
        branchId,
        branchName: branch.name,
        technicians: parsedTechs,
        doctors: parsedDocs,
        processAreas: parsedAreas,
        processes: parsedProcesses,
      },
    };
  }

  /**
   * Execute atomic database transaction for validated data.
   */
  async executeImport(
    validatedData: ValidatedWorkbookData,
    tenantId: string,
    actor: AuthenticatedUser,
  ): Promise<BulkUploadImportResponseDto> {
    const { branchId, branchName, technicians, doctors, processAreas, processes } =
      validatedData;

    const labTechRole = await this.ensureLabTechnicianRole();

    const result = await this.prisma.$transaction(async (tx) => {
      // ─────────────────────────────────────────────────────────
      // 1. IMPORT TECHNICIANS
      // ─────────────────────────────────────────────────────────
      const techNameToId = new Map<string, string>(); // lowerFullName / lowerEmail -> userId

      for (const tech of technicians) {
        let userId: string;

        if (tech.isExisting && tech.existingUserId) {
          userId = tech.existingUserId;

          // Ensure user has branch mapping
          await tx.userBranch.upsert({
            where: {
              userId_branchId: { userId, branchId },
            },
            update: {},
            create: { userId, branchId, isDefault: false },
          });
        } else {
          // Check if user exists by email across platform
          const existingUser = await tx.user.findUnique({
            where: { email: tech.email },
          });

          if (existingUser) {
            userId = existingUser.id;
            await tx.user.update({
              where: { id: userId },
              data: {
                name: tech.fullName,
                phone: tech.formattedPhone || existingUser.phone,
              },
            });
          } else {
            const temporaryPassword = `Tech@${uuidv4().substring(0, 8)}!2026`;
            const passwordHash = await bcrypt.hash(temporaryPassword, 10);

            const newUser = await tx.user.create({
              data: {
                email: tech.email,
                name: tech.fullName,
                phone: tech.formattedPhone,
                passwordHash,
                status: UserStatus.ACTIVE,
                locale: actor.locale || 'en',
              },
            });
            userId = newUser.id;
          }

          // Ensure Tenant Membership
          await tx.tenantMembership.upsert({
            where: {
              userId_tenantId: { userId, tenantId },
            },
            update: { status: UserStatus.ACTIVE },
            create: {
              userId,
              tenantId,
              status: UserStatus.ACTIVE,
              isOwner: false,
            },
          });

          // Ensure UserBranch
          await tx.userBranch.upsert({
            where: {
              userId_branchId: { userId, branchId },
            },
            update: {},
            create: {
              userId,
              branchId,
              isDefault: true,
            },
          });

          // Assign Lab Module Access
          await tx.userModuleAccess.upsert({
            where: {
              userId_tenantId_moduleKey: {
                userId,
                tenantId,
                moduleKey: 'LAB',
              },
            },
            update: { isActive: true },
            create: {
              userId,
              tenantId,
              moduleKey: 'LAB',
              isActive: true,
            },
          });

          // Assign Lab Technician Role in this branch
          const existingUserRole = await tx.userRole.findFirst({
            where: {
              userId,
              tenantId,
              branchId,
              roleId: labTechRole.id,
            },
          });

          if (!existingUserRole) {
            await tx.userRole.create({
              data: {
                userId,
                tenantId,
                branchId,
                roleId: labTechRole.id,
              },
            });
          }
        }

        techNameToId.set(tech.fullName.toLowerCase(), userId);
        techNameToId.set(tech.firstName.toLowerCase(), userId);
        techNameToId.set(tech.email.toLowerCase(), userId);
      }

      // ─────────────────────────────────────────────────────────
      // 2. IMPORT DOCTORS
      // ─────────────────────────────────────────────────────────
      let doctorsCreated = 0;
      for (const doc of doctors) {
        await tx.doctor.create({
          data: {
            tenantId,
            branchId,
            moduleKey: 'LAB',
            name: doc.name,
            clinicName: doc.clinicName || null,
            email: doc.email || null,
            phone: doc.phone || null,
            address: doc.address || null,
            specialization: null,
            type: DoctorType.LOCAL,
            isActive: true,
          },
        });
        doctorsCreated++;
      }

      // ─────────────────────────────────────────────────────────
      // 3. IMPORT PROCESS AREAS
      // ─────────────────────────────────────────────────────────
      const areaNameToId = new Map<string, string>(); // lowerName -> areaId
      let processAreasCreated = 0;

      for (const area of processAreas) {
        if (area.isExisting && area.existingId) {
          areaNameToId.set(area.name.toLowerCase(), area.existingId);
        } else {
          // Check if already created or in DB
          let pa = await tx.processArea.findFirst({
            where: {
              tenantId,
              branchId,
              name: { equals: area.name, mode: 'insensitive' },
            },
          });

          if (!pa) {
            pa = await tx.processArea.create({
              data: {
                tenantId,
                branchId,
                moduleKey: 'LAB',
                name: area.name,
                description: area.description || null,
              },
            });
            processAreasCreated++;
          }

          areaNameToId.set(area.name.toLowerCase(), pa.id);
        }
      }

      // ─────────────────────────────────────────────────────────
      // 4. IMPORT PROCESSES
      // ─────────────────────────────────────────────────────────
      let processesCreated = 0;

      // Existing DB staff map fallback
      const branchUsers = await tx.userBranch.findMany({
        where: { branchId },
        include: { user: true },
      });
      branchUsers.forEach((bu) => {
        if (bu.user.name) {
          techNameToId.set(bu.user.name.toLowerCase().trim(), bu.user.id);
          const fn = bu.user.name.split(' ')[0].toLowerCase().trim();
          if (fn) techNameToId.set(fn, bu.user.id);
        }
        if (bu.user.email) techNameToId.set(bu.user.email.toLowerCase().trim(), bu.user.id);
      });

      // Existing Process Areas fallback
      const branchAreas = await tx.processArea.findMany({
        where: { tenantId, branchId },
      });
      branchAreas.forEach((ba) => {
        areaNameToId.set(ba.name.toLowerCase().trim(), ba.id);
      });

      for (const proc of processes) {
        const areaId = areaNameToId.get(proc.processAreaName.toLowerCase());
        if (!areaId) {
          throw new BadRequestException(
            `Unable to resolve Process Area ID for "${proc.processAreaName}".`,
          );
        }

        let defaultTechnicianId: string | null = null;
        if (
          proc.type === ProcessType.PRODUCTION ||
          proc.type === ProcessType.INTERNAL_VERIFICATION
        ) {
          if (proc.defaultTechnicianName) {
            defaultTechnicianId =
              techNameToId.get(proc.defaultTechnicianName.toLowerCase()) || null;
          }
        }

        await tx.process.create({
          data: {
            tenantId,
            branchId,
            moduleKey: 'LAB',
            name: proc.name,
            type: proc.type,
            processAreaId: areaId,
            defaultTechnicianId,
          },
        });
        processesCreated++;
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          branchId,
          moduleKey: 'LAB',
          userId: actor.id,
          action: 'LAB_BULK_UPLOAD_COMPLETED',
          resourceType: 'DentalLab',
          resourceId: branchId,
          newValues: {
            branchId,
            branchName,
            counts: {
              technicians: technicians.length,
              doctors: doctorsCreated,
              processAreas: processAreasCreated,
              processes: processesCreated,
            },
          },
        },
      });

      return {
        techniciansCreated: technicians.length,
        doctorsCreated,
        processAreasCreated,
        processesCreated,
      };
    });

    // Asynchronously dispatch welcome emails for newly created technicians
    this.dispatchWelcomeEmails(technicians, tenantId, actor).catch((err) => {
      this.logger.warn(`Failed async welcome email dispatch: ${err.message}`);
    });

    return {
      success: true,
      message: `Bulk import completed successfully for branch "${branchName}".`,
      imported: {
        technicians: result.techniciansCreated,
        doctors: result.doctorsCreated,
        processAreas: result.processAreasCreated,
        processes: result.processesCreated,
      },
      branchId,
      branchName,
    };
  }

  /**
   * Helper to dispatch welcome emails in background after transaction.
   */
  private async dispatchWelcomeEmails(
    technicians: ParsedTechnician[],
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) return;

    for (const tech of technicians) {
      if (tech.isExisting) continue;

      try {
        const user = await this.prisma.user.findUnique({
          where: { email: tech.email },
        });
        if (!user) continue;

        let resetToken: string | undefined;
        try {
          resetToken = await this.authService.generatePasswordResetToken(user.id);
        } catch {
          // Continue without token
        }

        const isSpanish = (user.locale || actor.locale || 'en')
          .toLowerCase()
          .startsWith('es');
        const roleDisplayName = isSpanish
          ? 'Técnico de Laboratorio'
          : 'Lab Technician';

        await this.mailService.sendWelcomeInvite(
          user.email,
          user.name,
          tenant.name,
          resetToken,
          user.locale || actor.locale || 'en',
          tenant.slug,
          roleDisplayName,
        );
        this.logger.log(`📧 Bulk welcome email sent to: ${user.email}`);
      } catch (err: any) {
        this.logger.warn(
          `Could not send welcome email to ${tech.email}: ${err.message}`,
        );
      }
    }
  }
}
