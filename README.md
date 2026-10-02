# SteelTrack Enterprise Web Project

SteelTrack Enterprise is an industrial multi-branch steel inventory tracking and logistics management system featuring a **Clean Architecture C# ASP.NET Core Web API backend** and a modern **React + TypeScript + Vite frontend** with **Role-Based Access Control (RBAC)**.

---

## 🚀 Key Features

- **🔐 Multi-Role Access Control (RBAC)**:
  - **Owner**: Full access across all 4 branches, LSTM demand forecasting, cross-branch analytics, system administration.
  - **Branch Manager**: Scoped to assigned branch operations, inter-branch stock transfer approvals, quality sign-offs.
  - **Cashier**: Scoped to assigned branch counter, Point of Sale (POS) checkout terminal, official invoice/receipt generation.

- **🏢 Multi-Branch Support**:
  - **Davao Branch** 
  - **Makati Branch** 
  - **Mandaue Branch** 
  - **Cebu Branch**

- **📊 Complete 30-Table Data Dictionary Schema**:
  - Full relational PostgreSQL database covering **Audit Logs**, **Categories**, **Customers**, **Roles**, **Store Settings**, **Suppliers**, **Products**, **Users**, **Inventory Adjustments**, **Sales**, **Stock Receivings**, **Customer Receivables**, **Goods Return Slips**, **Sale Cheques**, **Sale Items**, **Sale Payments**, **Inventory Transactions**, **Receivable Payments**, **Return Slip Items**, **Sales Return Deductions**, **Bounced Cheques**, **Goods Exchanges**, **Product Batches**, and **Sales Report Verifications**.

- **📈 LSTM Demand Forecasting Engine**:
  - Visual interactive forecasting chart comparing historical steel batch demand against AI projected demand with confidence bounds and reorder alerts.

- **🚚 Inter-Branch Stock Transfer Logistics**:
  - Request, approve, dispatch, and track stock transfers across branches with full audit status (`Pending` → `Approved` → `InTransit` → `Completed`).

- **🛒 Cashier POS & Printable Receipt Terminal**:
  - Daily counter checkout terminal for selling inventory batches, calculating unit rates, and printing itemized industrial invoices.

---

## 📂 Project Structure

```text
SteelTrack/
├── SteelTrack.slnx                     # .NET Solution file
├── README.md                           # Main Project Documentation & Changelog
├── backend/                            # C# Backend (Clean Architecture)
│   ├── Domain/                         # Entities & Enums (30 Data Dictionary Entities)
│   │   ├── Entities/                   # Product, Sale, Customer, User, StockReceiving, etc.
│   │   └── Enums/                      # UserRole, PaymentMethod, TaxMode, AdjustmentType, etc.
│   ├── Application/                    # DTOs, Service Contracts & Use Cases
│   │   ├── DTOs/
│   │   ├── Interfaces/
│   │   └── Services/
│   ├── Infrastructure/                 # EF Core 10, PostgreSQL DbContext, Migrations & Configurations
│   │   ├── Migrations/                 # Consolidated EF Core Migration (InitialDataDictionarySchema)
│   │   ├── Persistence/
│   │   │   ├── Configurations/         # Entity Fluent API Configurations (varchar & numeric(18,2))
│   │   │   └── SteelTrackDbContext.cs  # DbContext with global varchar convention
│   │   └── Repositories/
│   └── API/                            # ASP.NET Core Web API Controllers & OpenAPI
└── frontend/                           # React + TypeScript + Vite Frontend
    ├── src/
    │   ├── components/                 # UI Component Library (Sidebar, Header, POS, Analytics, etc.)
    │   ├── services/                   # API Integration & Service Layer
    │   ├── types/                      # TypeScript Interfaces & Enums
    │   ├── App.tsx                     # Main App Shell & RBAC View Router
    │   └── index.css                   # Industrial Dark Theme Design System
    └── vite.config.ts                  # Vite Dev Server & API Proxy Configuration
```

---

## ⚙️ Getting Started & Database Setup

### 1. Database Migrations (PostgreSQL)

> **Database Configuration**: The connection string is configured in `backend/API/appsettings.json` for PostgreSQL (`Host=localhost;Port=5432;Database=SteelTrackDb;Username=postgres;Password=12345`).

To create and update the PostgreSQL database schema:

```powershell
cd backend

# Apply the consolidated 30-table migration to PostgreSQL
dotnet ef database update --project Infrastructure --startup-project API
```

*(Optional)* To reset or re-generate migrations from scratch:
```powershell
# Generate a new migration
dotnet ef migrations add InitialDataDictionarySchema --project Infrastructure --startup-project API
```

### 2. Run Backend (C# ASP.NET Core Web API)

```bash
cd backend/API
dotnet run --urls "http://localhost:5000"
```
The Web API will start at:
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
| **Inventory View** | Full Access (All Branches) | Branch Stock Only | Available Stock Lookup Only |
| **Log New Steel Batch** | ✅ Allowed | ✅ Allowed (Assigned Branch) | ❌ Restricted |
| **Update Batch Status** | ✅ Allowed | ✅ Allowed | ❌ Restricted |
| **Inter-Branch Transfers** | ✅ Full Control | ✅ Request / Approve for Branch | ❌ Restricted |
| **LSTM Demand Forecasting** | ✅ Full Access (AI Engine) | ❌ Restricted | ❌ Restricted |
| **Cross-Branch Analytics** | ✅ Full Access | ❌ Restricted | ❌ Restricted |
| **Point of Sale (POS)** | ✅ View & Test | ❌ Restricted | ✅ Primary Counter Function |
| **System Management** | ✅ Full Control | ❌ Restricted | ❌ Restricted |

---

## 📝 Recent Change History

- **v1.3.0**:
  - **Full 30-Table Data Dictionary Migration**: Implemented all entities, enums, and EF Core configurations for Tables 4–33 in the specification.
  - **PostgreSQL Data Type Conventions**: Configured global `varchar` string data type mapping convention and explicit `numeric(18,2)` currency precision across all financial columns.
  - **Clean Consolidated Migration**: Consolidated all migrations into a single clean migration `InitialDataDictionarySchema` in [`backend/Infrastructure/Migrations`](file:///d:/It_Project/Capstone/SteelTrack/backend/Infrastructure/Migrations).
- **v1.2.1**: Updated PostgreSQL connection string in [`appsettings.json`](file:///d:/It_Project/Capstone/SteelTrack/backend/API/appsettings.json) and [`appsettings.Development.json`](file:///d:/It_Project/Capstone/SteelTrack/backend/API/appsettings.Development.json) with `Password=12345`.
- **v1.2.0**: Added **Role-Specific Collapsible Sidebars** with App Shell layout, role badge indicators, branch context switcher, and tab protection. Added `OwnerAnalyticsView`, `BranchApprovalsView`, and `SystemManagementView`.
- **v1.1.0**: Added **Multi-Role Login System** (**Owner**, **Branch Manager**, **Cashier**), **4 Branch Locations** (**Davao**, **Makati**, **Mandaue**, **Cebu**), C# & TypeScript `UserRole` and `BranchLocation` enums, **Mock LSTM Demand Forecasting**, **Inter-Branch Transfers**, and **Cashier POS Terminal**.
- **v1.0.0**: Initial Clean Architecture ASP.NET Core Web API + React Vite dashboard baseline.
