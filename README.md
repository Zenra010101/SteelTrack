# SteelTrack Enterprise Web Project

SteelTrack Enterprise is an industrial multi-branch steel inventory tracking, financial analytics, and logistics management system featuring a **Clean Architecture C# ASP.NET Core Web API backend** and a modern **React + TypeScript + Vite frontend** with **Role-Based Access Control (RBAC)**.

---

## 🚀 Key Features

- **🔐 Multi-Role Access Control (RBAC)**:
  - **Owner**: Full executive access across all operational branches, cross-branch revenue breakdown, LSTM demand forecasting, comprehensive staff management, and system configuration.
  - **Branch Manager**: Scoped strictly to assigned branch operations, branch staff account creation, local revenue reporting, inter-branch stock transfer approvals, and quality sign-offs.
  - **Cashier**: Scoped to assigned branch counter, Point of Sale (POS) checkout terminal, automatic BIR receipt generation, and transaction reprinting.

- **🏢 Operational Branch Facilities**:
  - **Davao Branch**
  - **Cagayan Branch**
  - **Mandaue Branch**
  - **Cebu Branch**

- **💰 Role-Based Revenue Breakdown & Timeframe Sorting**:
  - **Executive Owner Scope**: Real-time total revenue calculation alongside an itemized per-branch revenue dissemination with dynamic single-branch filtering.
  - **Branch Manager Privacy Scope**: Restricts financial visibility exclusively to the manager's assigned branch facility.
  - **Strict Month-Threshold Timeframe Scoping**:
    - **Daily**: Real-time day-to-day cashier sales.
    - **Monthly**: Current calendar month metrics.
    - **Trimester**: Exactly 3 months calendar scope.
    - **Semester**: Exactly 6 months calendar scope.
    - **Yearly**: Exactly 12 months calendar scope.

- **📦 Inventory & Stock Categorization**:
  - **Very Low Stock Threshold**: Stock count `< 10` (or minimum reorder threshold).
  - **Low Stock Threshold**: Stock count between `10` and `20`.
  - **Zero-Stock Visibility**: Includes zero-quantity items (`StockQuantity = 0`) in the "Low Stock Only" filter so stockouts are immediately addressable.
  - **Clean Table Presentation**: Clean default white table rows with no distracting row color fills or warning badges.
  - **Interactive Status Management**: Fully persistent batch status action control (`PUT /api/branchproducts/{id}/status` & `PUT /api/inventory/{id}/status`) updating `IsAvailable`, `IsActive`, and batch status with responsive layout (inline on desktop, dedicated row on constrained screens).

- **📄 Universal CSV & Formatted PDF Table Export**:
  - Standardized export utility across data tables (Inventory On-Hand, Stock Movements, Product Catalogs, Stock Transfers, Customer Receivables, and Sales).
  - Generates clean CSV files and professionally structured PDF documents.

- **🛒 Hardened Cashier POS & Automated Receipt Pipeline**:
  - Robust exception handling and ACID database transaction rollbacks for checkout operations to prevent inventory drift.
  - Automatic receipt modal and instant PDF download option upon checkout completion.
  - Reliable "Reprint Receipt" functionality for historical transactions.

- **🛡️ Session Security & Silent Invalidation**:
  - Ephemeral server instance tracking clears user session tokens upon system/server restart, enforcing clean re-authentication silently without intrusive UI alert banners.

- **🚚 Inter-Branch Stock Transfer Logistics**:
  - Request, approve, dispatch, and track stock transfers across branches with full audit status (`Pending` → `Approved` → `InTransit` → `Completed`).

- **📈 AI Demand Forecasting Engine**:
  - Interactive forecasting comparing historical steel demand against projected consumption with confidence intervals and reorder alerts.

---

## 📂 Project Structure

```text
SteelTrack/
├── SteelTrack.slnx                     # .NET Solution file
├── README.md                           # Main Project Documentation & Changelog
├── backend/                            # C# Backend (Clean Architecture)
│   ├── Domain/                         # Entities, Enums & Domain Rules
│   │   ├── Common/                     # BaseEntity, AuditableEntity
│   │   ├── Entities/                   # Product, Sale, BranchProduct, Customer, StockReceiving, etc.
│   │   └── Enums/                      # UserRole, BranchLocation, BatchStatus, PaymentMethod, etc.
│   ├── Application/                    # DTOs, Service Contracts & Use Cases
│   │   ├── DTOs/                       # Inventory, Sales, Transfers, Users, Reports DTOs
│   │   ├── Interfaces/                 # Repository and Service Interfaces
│   │   └── Services/                   # Application Service Implementations
│   ├── Infrastructure/                 # EF Core 10, PostgreSQL Persistence & Repositories
│   │   ├── Migrations/                 # EF Core Database Migrations
│   │   ├── Persistence/                # AppDbContext, Entity Configurations & Database Initializers
│   │   ├── Repositories/               # Data Access Implementations
│   │   └── Services/                   # Infrastructure Services (Export, Auth, ServerInstance)
│   └── API/                            # ASP.NET Core Web API Controllers & Middleware
│       ├── Controllers/                # BranchProducts, Inventory, Sales, Users, Reports, etc.
│       ├── Program.cs                  # Dependency Injection, Authentication & Startup Pipeline
│       └── appsettings.json            # Database Connections, JWT & Server Instance Config
└── frontend/                           # React + TypeScript + Vite Frontend
    ├── src/
    │   ├── components/                 # UI Views (Dashboard, InventoryTable, POS, System, Reports)
    │   ├── services/                   # Axios/Fetch API Integration & Session Handlers
    │   ├── types/                      # TypeScript Interfaces & Enums
    │   ├── App.tsx                     # App Shell, Authentication State & View Router
    │   └── index.css                   # Industrial Design System & Responsive Layouts
    └── vite.config.ts                  # Vite Server & API Reverse Proxy Configuration
```

---

## ⚙️ Getting Started & Database Setup

### 1. Database Migrations (PostgreSQL)

> **Database Configuration**: The connection string is configured in [`backend/API/appsettings.json`](file:///d:/It_Project/Capstone/SteelTrack/backend/API/appsettings.json) for PostgreSQL.

To apply database schema migrations:

```powershell
cd backend

# Apply EF Core migrations to PostgreSQL
dotnet ef database update --project Infrastructure --startup-project API
```

### 2. Run Backend (C# ASP.NET Core Web API)

```bash
cd backend/API
dotnet run --urls "http://localhost:5000"
```

The Web API will be available at:
- **Swagger Interactive API Docs**: [`http://localhost:5000/swagger`](http://localhost:5000/swagger)

### 3. Run Frontend (React + TypeScript + Vite)

```bash
cd frontend
npm install    # (First run only)
npm run dev
```

The React development server will start at:
- **Frontend Workspace UI**: [`http://localhost:5173`](http://localhost:5173)

---

## 🔒 RBAC Permission Matrix

| Feature / Action | Owner | Branch Manager | Cashier |
| :--- | :--- | :--- | :--- |
| **Branch Scope** | All 4 Branches (Switchable) | Assigned Branch Only | Assigned Branch Counter Only |
| **Dashboard Welcome Card** | Executive Overview & Branch Switcher | Centered Local Actions (Approvals & Inventory) | Counter Welcome & POS Launch |
| **Revenue Analytics** | Enterprise Total + Branch Dissemination | Scoped to Assigned Branch Only | Shift Sales Summary |
| **Timeframe Scoping** | Daily, Monthly, Trimester, Semester, Yearly | Daily, Monthly, Trimester, Semester, Yearly | Daily Counter Shift |
| **Inventory View** | Full Access (All Branches) | Branch Stock Only | Available Stock Lookup Only |
| **Stock Status Action** | ✅ Update (Available/Reserved/QC/Shipped) | ✅ Update (Assigned Branch) | ❌ Restricted |
| **Low-Stock Query** | Includes 0-Stock Items + Thresholds | Includes 0-Stock Items + Thresholds | Stockout Indicators |
| **Universal Export (CSV/PDF)** | ✅ Full Tables Across All Branches | ✅ Scoped Branch Tables | ❌ Restricted (Receipts Only) |
| **Log New Steel Batch** | ✅ Allowed | ✅ Allowed (Assigned Branch) | ❌ Restricted |
| **Inter-Branch Transfers** | ✅ Full Control | ✅ Request / Approve for Branch | ❌ Restricted |
| **POS Checkout Terminal** | ✅ View & Test | ❌ Restricted | ✅ Primary Counter Function |
| **Receipt Generation & Reprint** | ✅ Allowed | ❌ Restricted | ✅ Automatic Modal + PDF Download |
| **Staff & User Management** | ✅ All Branches & All Roles | ✅ Create Accounts for Own Branch Only | ❌ Restricted |

---

## 📝 Recent Change History

- **v1.6.0**:
  - **Dashboard Welcome Card UI Redesign**: Updated welcome card background to clean white (`#FFFFFF`) with border (`#E2E8F0`) and subtle shadow; removed all legacy "Branch Workspace" badges/labels; center-aligned **Quality Approvals** and **Branch Products** buttons for Branch Managers.
  - **Branch Products Table Styling Clean-Up**: Removed "Very Low" and "Low" colored badge chips and warning row highlights; all rows now render with a clean, default white background regardless of stock levels.
  - **Status Action Button Fix & Persistence**: Added `PUT /api/branchproducts/{id}/status` and `PUT /api/inventory/{id}/status` endpoints supporting `IsAvailable`, `IsActive`, and batch status updates in PostgreSQL; styled status control to a compact 88px inline width on desktop with responsive fallback to a dedicated row below action buttons when space is constrained.

- **v1.5.0**:
  - **Silent Session Invalidation on Server Restart**: Integrated ephemeral runtime GUID instance tracking in [`ServerInstance.cs`](file:///d:/It_Project/Capstone/SteelTrack/backend/Infrastructure/Services/ServerInstance.cs) and silent clearing of tokens in [`App.tsx`](file:///d:/It_Project/Capstone/SteelTrack/frontend/src/App.tsx) without disruptive alert banners.
  - **Branch Manager User Creation Scoping**: Enforced frontend UI and backend authorization rules restricting Branch Managers to creating staff accounts strictly assigned to their own branch facility.
  - **Zero-Stock Products in Low Stock Filter**: Updated repository queries and UI filters so that products with `StockQuantity = 0` are explicitly included when toggling "Low Stock Only".

- **v1.4.0**:
  - **Revenue Timeframe Thresholds**: Standardized financial date ranges to exact month thresholds (Trimester = 3 months, Semester = 6 months, Yearly = 12 months) with role-based scoping (Owner enterprise dissemination vs. Branch Manager local scope).
  - **Database Entity Clean-up**: Completely removed unused models, configurations, and database tables (`Subscriptions`, `SubscriptionRenewalHistories`, `StoreCredits`, `StoreCreditUses`).
  - **Universal CSV & Formatted PDF Export**: Implemented structured export utilities across tables with clean columnar formats.
  - **POS Receipt Pipeline & Error Handling**: Added transaction rollbacks on checkout errors, automatic receipt display with one-click PDF download, and resolved the blank screen receipt reprinting bug.

- **v1.3.0**:
  - **Relational Data Dictionary Migration**: Implemented entities, enums, and EF Core configurations for data dictionary tables in PostgreSQL with `varchar` string conventions and `numeric(18,2)` currency precision.
- **v1.2.0**: Added role-specific collapsible sidebars, branch switcher, tab protection, and dedicated views for analytics, approvals, and system management.
- **v1.1.0**: Added multi-role login system, 4 branch locations, demand forecasting, inter-branch transfers, and POS terminal.
- **v1.0.0**: Initial Clean Architecture ASP.NET Core Web API + React Vite dashboard baseline.
