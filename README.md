# SteelTrack Enterprise Web Project

SteelTrack Enterprise is an industrial multi-branch steel inventory tracking and logistics management system featuring a **Clean Architecture C# ASP.NET Core Web API backend** and a modern **React + TypeScript + Vite frontend** with **Role-Based Access Control (RBAC)**.

---

## 🚀 Key Features

- **🔐 Multi-Role Access Control (RBAC)**:
  - **Owner**: Full access across all 4 branches, LSTM demand forecasting, cross-branch analytics, system administration.
  - **Branch Manager**: Scoped to assigned branch operations, inter-branch stock transfer approvals, quality sign-offs.
  - **Cashier**: Scoped to assigned branch counter, Point of Sale (POS) checkout terminal, official invoice/receipt generation.

- **🏢 Multi-Branch Support**:
  - **Davao Branch** (Yard South)
  - **Makati Branch** (Capital Hub)
  - **Mandaue Branch** (Visayas Logistics)
  - **Cebu Branch** (Port Yard)

- **📈 Mock LSTM Demand Forecasting Engine**:
  - Visual interactive forecasting chart comparing 6-month historical steel batch demand against 3-month AI projected demand with 95% confidence bounds and reorder alerts (ready for Python PyTorch/TensorFlow backend connection).

- **🚚 Inter-Branch Stock Transfer Logistics**:
  - Request, approve, dispatch, and track stock transfers across branches with full audit status (`Pending` → `Approved` → `InTransit` → `Completed`).

- **🛒 Cashier POS & Printable Receipt Terminal**:
  - Daily counter checkout terminal for selling inventory batches, calculating unit rates ($/Ton), and printing itemized industrial invoices.

---

## 📂 Project Structure

```text
SteelTrack/
├── SteelTrack.slnx                     # .NET Solution file
├── README.md                           # Main Project Documentation & Changelog
├── backend/                            # C# Backend (Clean Architecture)
│   ├── Domain/                         # Entities & Enums
│   │   ├── Entities/SteelBatch.cs
│   │   └── Enums/
│   │       ├── BatchStatus.cs
│   │       ├── SteelGrade.cs
│   │       ├── UserRole.cs             # (Owner, BranchManager, Cashier)
│   │       └── BranchLocation.cs       # (Davao, Makati, Mandaue, Cebu)
│   ├── Application/                    # DTOs, Service Contracts & Use Cases
│   │   ├── DTOs/SteelBatchDto.cs
│   │   ├── Interfaces/IInventoryService.cs
│   │   └── Services/InventoryService.cs
│   ├── Infrastructure/                 # EF Core, PostgreSQL DbContext & Repositories
│   └── API/                            # ASP.NET Core Web API Controllers & OpenAPI
└── frontend/                           # React + TypeScript + Vite Frontend
    ├── src/
    │   ├── components/                 # UI Component Library
    │   │   ├── Sidebar.tsx             # Collapsible Role-Specific Navigation Sidebar
    │   │   ├── Header.tsx              # Sticky Topbar Breadcrumb & Status Indicator
    │   │   ├── LoginScreen.tsx         # Dark Glassmorphic Login & Demo Role Presets
    │   │   ├── MetricsOverview.tsx     # Inventory KPI Cards
    │   │   ├── InventoryTable.tsx      # Batch Inventory Data Grid
    │   │   ├── OwnerForecastView.tsx   # LSTM Demand Forecasting Engine
    │   │   ├── InterBranchTransferView.tsx # Inter-Branch Stock Transfers
    │   │   ├── CashierPosView.tsx      # Cashier POS Checkout & Invoice Generator
    │   │   ├── OwnerAnalyticsView.tsx  # Executive Cross-Branch Reporting
    │   │   ├── BranchApprovalsView.tsx # Branch Quality Control & Sign-offs
    │   │   └── SystemManagementView.tsx# User Roles & System Access Control
    │   ├── services/
    │   │   └── api.ts                  # API Integration & Mock State Layer
    │   ├── types/
    │   │   ├── auth.ts                 # UserRole & BranchLocation Enums
    │   │   ├── steel.ts                # SteelBatch & DTO Types
    │   │   └── transfer.ts             # StockTransferRequest & PosTransaction Types
    │   ├── App.tsx                     # Main App Shell & RBAC View Router
    │   └── index.css                   # Industrial Dark Theme Design System
    └── vite.config.ts                  # Vite Dev Server & API Proxy Configuration
```

---

## ⚙️ Getting Started

### 1. Run Backend (C# ASP.NET Core Web API)

> **Database Configuration**: Default connection string in `backend/API/appsettings.json` is configured for PostgreSQL (`Host=localhost;Port=5432;Database=SteelTrackDb;Username=postgres;Password=12345`).

```bash
cd backend/API
dotnet run --urls "http://localhost:5000"
```
The Web API will start at:
- **Swagger Interactive API Docs**: [`http://localhost:5000/swagger`](http://localhost:5000/swagger)

### 2. Run Frontend (React + TypeScript + Vite)

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

- **v1.2.1**: Updated PostgreSQL connection string in [`appsettings.json`](file:///d:/It_Project/Capstone/SteelTrack/backend/API/appsettings.json) and [`appsettings.Development.json`](file:///d:/It_Project/Capstone/SteelTrack/backend/API/appsettings.Development.json) with `Password=12345`.
- **v1.2.0**: Added **Role-Specific Collapsible Sidebars** ([`Sidebar.tsx`](file:///d:/It_Project/Capstone/SteelTrack/frontend/src/components/Sidebar.tsx)) with App Shell layout, role badge indicators, branch context switcher, and tab protection. Added `OwnerAnalyticsView`, `BranchApprovalsView`, and `SystemManagementView`.
- **v1.1.0**: Added **Multi-Role Login System** (**Owner**, **Branch Manager**, **Cashier**), **4 Branch Locations** (**Davao**, **Makati**, **Mandaue**, **Cebu**), C# & TypeScript `UserRole` and `BranchLocation` enums, **Mock LSTM Demand Forecasting**, **Inter-Branch Transfers**, and **Cashier POS Terminal**.
- **v1.0.0**: Initial Clean Architecture ASP.NET Core Web API + React Vite dashboard baseline.
