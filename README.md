# Unified Dental Platform (Lab + Clinic)

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/Frontend-React_TypeScript-blue.svg)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-darkblue.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/RealTime-Socket.IO-black.svg)](https://socket.io/)
[![BullMQ](https://img.shields.io/badge/Queues-BullMQ-orange.svg)](https://bullmq.io/)

A modern, **multi-tenant Dental Healthcare SaaS Platform** designed to power independent and unified operations for **Dental Clinics** and **Dental Laboratories**.

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Core Architecture](#-core-architecture)
- [Technology Stack](#-technology-stack)
- [Phased Implementation Roadmap](#-phased-implementation-roadmap)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Installation & Setup](#installation--setup)
  - [Running the Application](#running-the-application)
- [Development & Agent Rules](#-development--agent-rules)
- [Documentation References](#-documentation-references)

---

## 🌟 Overview

The platform is designed to operate as a single unified SaaS application where each tenant can independently subscribe to and run:
1. **Clinic Only**: Patient records, appointments, treatments, dental charts, prescriptions, and billing.
2. **Lab Only**: Work orders, prosthesis configurations, process workflows, verifications (internal/external), QR tracking, and deliveries.
3. **Clinic + Lab**: Seamless cross-module workflows (e.g., Clinic Doctor orders lab work directly into Lab module).
4. **Future Modules**: Extensible for future modules (e.g., Radiology) without re-architecting the core.

---

## 🏛 Core Architecture

### 1. Multi-Tenant Subdomain Routing
Each tenant is isolated and accessed via its unique subdomain:
```text
smile-dental.app.example.com  -->  Tenant: "smile-dental"
precision-lab.app.example.com -->  Tenant: "precision-lab"
```

### 2. Sibling Module Independence
Modules are independent siblings sharing a common core:
```text
                     Tenant
                       │
         ┌─────────────┼─────────────┐
         │             │             │
       Clinic         Lab        Radiology (future)
         │             │             │
         └─────────────┼─────────────┘
                       │
                  Shared Core
         (Tenancy, Auth, RBAC, Branches,
          Audit, Files, Notifications)
```

### 3. Native Authentication & Granular RBAC
- **Native NestJS Auth**: Passport.js + JWT + bcrypt (no third-party cloud auth lock-in).
- **Permission-Driven RBAC**: Enforces granular permissions (e.g. `can('work_order.create')`) alongside attribute-based authorization (e.g. Doctor `is_owner`).
- **Backend Enforced**: Subdomain, tenant, branch, module entitlement, and permissions are validated server-side for every request.

---

## 🛠 Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Backend** | NestJS | Modular Node.js framework with TypeScript |
| **Frontend** | React (TypeScript) | SPA monolith bundled & served directly via NestJS |
| **Database** | PostgreSQL | Relational database (Hostinger VPS) |
| **ORM** | Prisma | Type-safe query builder and database migrations |
| **Authentication** | Native NestJS | Passport.js, JWT tokens & bcrypt password hashing |
| **Real-time** | Socket.IO | Real-time events, status updates, and notifications |
| **Queue / Workers** | BullMQ + Redis | Background job processing (Hostinger Redis) |
| **Mail Service** | Nodemailer / `@nestjs-modules/mailer` | Transactional email engine with BullMQ async delivery |
| **File Storage** | In-App / Local FS | Secure local storage with metadata and access control |
| **SSL** | Let's Encrypt | Wildcard SSL for `*.app.example.com` |
| **i18n** | nestjs-i18n & react-i18next | Multi-language support (English & Spanish) |

---

## 🗺 Phased Implementation Roadmap

Development is organized into **6 sequential phases** (detailed in [project_scope.md](file:///d:/Projects/unified_dental/project_scope.md)):

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | **Shared Core & Platform Foundation**<br>• Tenancy (subdomains) & Branch management<br>• Native Auth (JWT, Passport.js, bcrypt)<br>• RBAC & Permission system<br>• Audit logging, In-App file uploads, Notifications<br>• Monolith layout (NestJS serving React SPA) | 🟡 *Ready to start* |
| **Phase 2** | **Lab Module**<br>• Prosthesis & Process master data<br>• Work Orders & Process State Machine<br>• Internal & External Verifications<br>• QR Public Tracking & Interest Collection<br>• Deliveries & Lab Dashboard | ⚪ *Planned* |
| **Phase 3** | **Clinic Module**<br>• Patient profiles & Medical history<br>• Appointment scheduling & Calendar views<br>• Dental charts & Treatment plans<br>• Prescriptions & Invoicing/Billing<br>• Clinic Dashboard | ⚪ *Planned* |
| **Phase 4** | **Cross-Module Integration**<br>• Shared patient linking<br>• Clinic → Lab Request workflow<br>• Doctor identity linking<br>• Cross-module notifications & unified dashboards | ⚪ *Planned* |
| **Phase 5** | **Internationalization & Multi-Region**<br>• Full English & Spanish translations (UI & API)<br>• Multi-region deployment configuration<br>• Tenant/User locale preferences | ⚪ *Planned* |
| **Phase 6** | **Production Hardening & Observability**<br>• Security audit & penetration testing<br>• Performance tuning & indexing<br>• Logging, monitoring, and health checks<br>• CI/CD pipeline & automated deployment | ⚪ *Planned* |

> 📌 **Rule for Agents & Developers:** Whenever a phase or module is implemented, update the status and details in this section!

---

## 📁 Project Directory Structure

```text
unified_dental/
├── .agents/                    # Workspace agent rules & customization
│   └── rules/
│       └── agent-rules.md
├── src/                        # NestJS Backend source
│   ├── core/                   # Shared Core Infrastructure
│   │   ├── auth/               # Passport.js, JWT, bcrypt
│   │   ├── tenancy/            # Subdomain resolution & tenant context
│   │   ├── users/              # User management & tenant memberships
│   │   ├── rbac/               # Roles, permissions, guards, decorators
│   │   ├── branches/           # Multi-branch management
│   │   ├── audit/              # Audit logging service
│   │   ├── files/              # In-app file storage & metadata
│   │   ├── mail/               # Email engine (SMTP, templates, queues)
│   │   └── notifications/      # Event-driven notification engine
│   ├── modules/                # Independent Business Modules
│   │   ├── lab/                # Dental Lab Domain
│   │   └── clinic/             # Dental Clinic Domain
│   ├── shared/                 # Shared DTOs, utilities, constants
│   ├── app.module.ts
│   └── main.ts
├── client/                     # React (TypeScript) Frontend SPA
│   ├── src/
│   │   ├── core/               # Auth, layout, navigation, tenant context
│   │   ├── modules/
│   │   │   ├── lab/            # Lab UI views & components
│   │   │   └── clinic/         # Clinic UI views & components
│   │   └── shared/             # Reusable UI components & hooks
│   └── vite.config.ts
├── prisma/
│   ├── schema.prisma           # Prisma schema & database models
│   └── migrations/             # Version-controlled DB migrations
├── AGENTS.md                   # Strict Agent Guidelines
├── project_scope.md            # Comprehensive Phased Project Scope
├── instructions.md             # Master Architecture Specification
└── README.md                   # Main Project Readme & Run Guide
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **Package Manager**: `npm` or `pnpm`
- **PostgreSQL**: `v15` or higher
- **Redis**: `v7` or higher

### Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example` once created):

```env
# Server
PORT=3000
NODE_ENV=development
BASE_DOMAIN=app.example.com

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/unified_dental?schema=public"

# Redis (BullMQ & Socket.IO)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets
JWT_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# File Storage
STORAGE_LOCAL_PATH=./uploads

# Mail / SMTP (Hostinger Mail or Custom SMTP)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notifications@yourdomain.com
SMTP_PASSWORD=your_smtp_password
MAIL_FROM_NAME="Unified Dental Platform"
MAIL_FROM_ADDRESS=notifications@yourdomain.com
```

### Installation & Setup
```bash
# 1. Install root & backend dependencies
npm install

# 2. Run Prisma migrations & generate Prisma client
npx prisma migrate dev --name init
npx prisma generate

# 3. Seed initial roles & permissions
npm run seed
```

### Running the Application
```bash
# Development (with hot-reload)
npm run start:dev

# Build (Backend + Frontend Monolith)
npm run build

# Production Start
npm run start:prod
```

---

## ⚠️ Development & Agent Rules

1. **Mandatory Scope Check**: Before writing any code, always check [project_scope.md](file:///d:/Projects/unified_dental/project_scope.md) to confirm current phase boundaries, data models, and requirements.
2. **Phase-by-Phase Discipline**: Never jump ahead or build out-of-scope modules without explicit user confirmation.
3. **Update Documentation**: Whenever a new module or feature is implemented, you **MUST** update this [README.md](file:///d:/Projects/unified_dental/README.md) file to reflect current progress, usage instructions, and configuration.
4. **Tenant Isolation**: Never bypass tenant validation. Always resolve the tenant from the subdomain and JWT context.
5. **Sibling Independence**: Never couple Clinic and Lab code directly. Use domain events and application service interfaces.

---

## 📚 Documentation References

- [project_scope.md](file:///d:/Projects/unified_dental/project_scope.md) — Phased specifications, entity checklists, and decision records.
- [AGENTS.md](file:///d:/Projects/unified_dental/AGENTS.md) — Mandatory agent & developer compliance guidelines.
- [instructions.md](file:///d:/Projects/unified_dental/instructions.md) — Master architectural & domain design document (80 sections).