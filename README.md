# SteelTrack Enterprise Web Project

SteelTrack Enterprise is an industrial multi-branch steel inventory tracking, financial analytics, logistics management, and deep learning demand forecasting system. It features a **Clean Architecture C# ASP.NET Core 10 Web API backend**, a modern **React 19 + TypeScript + Vite frontend** with **Role-Based Access Control (RBAC)**, and a dedicated **Keras 3 & TensorFlow 2.21 LSTM Demand Forecasting Microservice**.

---

## 🚀 Key Features

- **🔐 Multi-Role Access Control (RBAC)**:
  - **Owner**: Full executive access across all operational branches, cross-branch revenue breakdown, Keras LSTM demand forecasting, comprehensive staff management, and system configuration.
  - **Branch Manager**: Scoped strictly to assigned branch operations, branch staff account creation, local revenue reporting, inter-branch stock transfer approvals, and quality sign-offs.
  - **Cashier**: Scoped to assigned branch counter, Point of Sale (POS) checkout terminal, automatic BIR receipt generation, and transaction reprinting.

- **🏢 Operational Branch Facilities**:
  - **Davao Branch**
  - **Cagayan De Oro Branch**
  - **Mandaue Branch**
  - **Cebu Branch**

- **🤖 Keras 3 & TensorFlow 2.21 LSTM Demand Forecasting Engine**:
  - **Architecture**: Multi-layer stacked LSTM (`keras.layers.LSTM(64)` $\rightarrow$ `LSTM(32)` $\rightarrow$ `Dense(32, relu)` $\rightarrow$ `Dropout(0.1)` $\rightarrow$ `Dense(3, linear)`) built directly with Keras 3 RNN layers.
  - **Training Dataset**: Trained on a 10-year historical dataset (`CSV_for_LSTM/monthly_series_cache.sqlite` with 128,939 records) across all 4 branches.
  - **Full Catalog Coverage**: Generates forward predictions for **all 646 steel products** in the system database (Bars, Plates, Pipes, Structural Steel, Stainless Steel, Accessories).
  - **Multi-Step Horizon**: Forecasts a 3-month forward consumption demand curve with 95% confidence intervals and multi-month trend analysis (`Rising`, `Stable`, `Declining`).
  - **Clean 4-Month Forecast Graph**: Scoped strictly to the **current month and the 3-month forward projection window** (no distracting past historical months on the forecast line chart).
  - **FastAPI Microservice**: High-throughput inference server (`/health`, `/models`, `/predict`, `/train`, `/metrics`) operating on port 8000 with sub-second single product predictions and batched branch-wide inference.

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
  - **Interactive Status Management**: Fully persistent batch status action control (`PUT /api/branchproducts/{id}/status` & `PUT /api/inventory/{id}/status`) updating `IsAvailable`, `IsActive`, and batch status with responsive layout.

- **📄 Universal CSV & Formatted PDF Table Export**:
  - Standardized export utility across data tables (Inventory On-Hand, Stock Movements, Product Catalogs, Stock Transfers, Customer Receivables, and Sales).
  - Generates clean CSV files and professionally structured PDF documents.

- **🛒 Hardened Cashier POS & Automated Receipt Pipeline**:
  - Robust exception handling and ACID database transaction rollbacks for checkout operations to prevent inventory drift.
  - Automatic receipt modal and instant PDF download option upon checkout completion.
  - Reliable "Reprint Receipt" functionality for historical transactions.

- **🚚 Inter-Branch Stock Transfer Logistics**:
  - Request, approve, dispatch, and track stock transfers across branches with full audit status (`Pending` $\rightarrow$ `Approved` $\rightarrow$ `InTransit` $\rightarrow$ `Completed`).

- **🛡️ Ephemeral Session Security & Silent Invalidation**:
  - Ephemeral server instance tracking clears user session tokens upon system/server restart, enforcing clean re-authentication silently without intrusive UI alert banners.

---

## 📂 Project Structure

```text
SteelTrack/
├── SteelTrack.slnx                     # .NET Solution file
├── README.md                           # Main Project Documentation & Changelog
├── Dockerfile.lstm                     # Production Dockerfile for Keras LSTM Service
├── docker-compose.yml                  # Full stack orchestration (PostgreSQL, LSTM, API, Web)
├── requirements-ml.txt                 # Python dependencies for ML/LSTM service
├── start_keras_lstm.bat                # Windows batch launcher for LSTM FastAPI service
├── start_keras_lstm.ps1                # PowerShell launcher for LSTM FastAPI service
├── pyrightconfig.json                  # Python language server & type checker configuration
│
├── ml/                                 # Keras 3 & TensorFlow LSTM Demand Forecasting Service
│   ├── model.py                        # Stacked LSTM network definition (keras.layers.LSTM)
│   ├── dataset.py                      # Historical SQLite ingestion, log scaling & sliding windows
│   ├── train.py                        # Model training pipeline, early stopping & weight export
│   ├── predictor.py                    # Batched inference engine with 95% CI & trend classifier
│   ├── server.py                       # FastAPI REST service (/predict, /train, /models, /health)
│   ├── check_data.py                   # Catalog extraction & SKU mapping utility
│   └── products_catalog.json           # Catalog metadata for all 646 steel SKUs
│
├── models/                             # Serialized ML artifacts & model versions
│   ├── steeltrack_keras_lstm.keras     # Trained Keras 3 native model format
│   ├── scaler.json                     # Log-transform normalization parameters
│   ├── recent_history.json             # 24-month sliding feature tensor cache
│   └── manifest.json                   # Versioning, training metrics & SKU counts
│
├── CSV_for_LSTM/                       # Historical sales & withdrawal dataset
│   ├── monthly_series_cache.sqlite     # 128,939 historical monthly transaction records
│   └── withdrawal_*.csv                # Multi-year historical raw branch data
│
├── backend/                            # C# Backend (Clean Architecture ASP.NET Core 10)
│   ├── Domain/                         # Entities, Enums & Domain Rules
│   │   ├── Common/                     # BaseEntity, AuditableEntity
│   │   ├── Entities/                   # Product, Sale, BranchProduct, Customer, StockReceiving, etc.
│   │   └── Enums/                      # UserRole, BranchLocation, BatchStatus, PaymentMethod, etc.
│   ├── Application/                    # DTOs, Service Contracts & Use Cases
│   │   ├── DTOs/                       # Inventory, Sales, Transfers, Users, Reports DTOs
│   │   ├── Interfaces/                 # Repository, Service & ILstmPredictorClient Interfaces
│   │   └── Services/                   # Application Service Implementations
│   ├── Infrastructure/                 # EF Core 10, PostgreSQL Persistence & Repositories
│   │   ├── Migrations/                 # EF Core Database Migrations
│   │   ├── Persistence/                # AppDbContext, Entity Configurations & Database Initializers
│   │   ├── Repositories/               # Data Access Implementations
│   │   └── Services/                   # Infrastructure Services (Export, Auth, ServerInstance)
│   └── API/                            # ASP.NET Core Web API Controllers & Middleware
│       ├── Controllers/                # BranchProducts, Inventory, Sales, Users, Reports, etc.
│       ├── Program.cs                  # Dependency Injection, Authentication & Startup Pipeline
│       ├── appsettings.json            # Database Connections, JWT, LSTM Microservice Config
│       └── appsettings.Production.json # Production Database & Service Config
│
└── frontend/                           # React 19 + TypeScript + Vite Frontend
    ├── src/
    │   ├── components/                 # UI Views (OwnerForecastView, Dashboard, POS, System, etc.)
    │   ├── services/                   # Axios/Fetch API Integration & Session Handlers
    │   ├── types/                      # TypeScript Interfaces & Enums
    │   ├── App.tsx                     # App Shell, Authentication State & View Router
    │   └── index.css                   # Industrial Design System & Responsive Layouts
    └── vite.config.ts                  # Vite Server & API Reverse Proxy Configuration
```

---

## 💻 Prerequisites

Ensure you have the following installed on your machine:

1. **.NET SDK**: Version **10.0** (or compatible .NET 8/9 runtime).
2. **Node.js**: Version **18.x** or higher (with `npm`).
3. **Python**: Version **3.11 - 3.15** (64-bit).
4. **PostgreSQL**: Version **15+** (or use the provided Docker Compose PostgreSQL service).

---

## 🛠️ How to Run Locally

### Option A: Standard Local Multi-Terminal Startup (Recommended for Development)

Running the project locally involves three lightweight services: the **Keras LSTM AI Service**, the **C# Web API**, and the **React Frontend**.

#### Step 1: Database Setup (PostgreSQL)

1. Verify or edit your PostgreSQL connection string in [`backend/API/appsettings.json`](file:///d:/It_Project/Capstone/SteelTrack/backend/API/appsettings.json):
   ```json
   "ConnectionStrings": {
     "PostgreSQLConnection": "Server=localhost;Port=5432;Database=SteelTrackDb;User Id=postgres;Password=your_password;Ssl Mode=Prefer;"
   }
   ```
2. Apply Entity Framework Core database migrations:
   ```powershell
   cd backend
   dotnet ef database update --project Infrastructure --startup-project API
   ```
   *(Optional: If seeding from SQL dump, execute `backend/sql/03_data_insertions.sql` into your database).*

---

#### Step 2: Start the Keras LSTM Demand Forecasting Service (Python / FastAPI)

1. Open a terminal in the project root and activate the Python virtual environment:
   ```powershell
   # If setting up venv for the first time:
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements-ml.txt
   ```
2. Launch the FastAPI service:
   ```powershell
   .\start_keras_lstm.bat
   ```
   *or run directly with Python:*
   ```powershell
   .\venv\Scripts\python.exe -m uvicorn ml.server:app --host 0.0.0.0 --port 8000
   ```

> [!IMPORTANT]
> **Accessing the Service in your Browser**:
> Uvicorn binds to `0.0.0.0:8000` to accept connections on all network interfaces. However, web browsers on Windows do not accept `0.0.0.0` as a client address (causing `ERR_ADDRESS_INVALID`). Always navigate to:
> - **Service Info**: [`http://localhost:8000/models`](http://localhost:8000/models) or [`http://127.0.0.1:8000/models`](http://127.0.0.1:8000/models)
> - **Interactive Swagger Docs**: [`http://localhost:8000/docs`](http://localhost:8000/docs)
> - **Health Status**: [`http://localhost:8000/health`](http://localhost:8000/health)

*(Optional) Retraining the Model:*
If you wish to retrain the LSTM network on updated dataset CSVs:
```powershell
.\venv\Scripts\python.exe -m ml.train
```

---

#### Step 3: Start the Backend Web API (C# ASP.NET Core)

1. Open a new terminal in `backend/API`:
   ```powershell
   cd backend/API
   dotnet run --urls "http://localhost:5000"
   ```
2. The Web API will be available at:
   - **Interactive API Swagger**: [`http://localhost:5000/swagger`](http://localhost:5000/swagger)
   - **Health Check**: [`http://localhost:5000/health`](http://localhost:5000/health)

---

#### Step 4: Start the Frontend UI (React + TypeScript + Vite)

1. Open a new terminal in `frontend`:
   ```powershell
   cd frontend
   npm install        # (Only required on first run)
   npm run dev
   ```
2. The React application will start at:
   - **Web Application Workspace**: [`http://localhost:5173`](http://localhost:5173)

---

### Option B: Docker Compose Full-Stack Startup

To spin up the entire system including PostgreSQL, Keras LSTM service, C# API, and Frontend with a single command:

```powershell
docker compose up --build
```

The services will be exposed at:
- Frontend: `http://localhost:5173`
- ASP.NET Core Web API: `http://localhost:5000`
- Keras LSTM Service: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

---

## 👥 Default Demo Accounts

| Role | Email | Default Branch | Capabilities |
| :--- | :--- | :--- | :--- |
| **Owner** | `ericabalit08@gmail.com` | Enterprise (All Branches) | Executive cross-branch analytics, full Keras LSTM demand forecasting, system config |
| **Branch Manager** | `manager.davao@steeltrack.com` | Davao Branch | Branch inventory management, local revenue, stock transfer approvals, staff creation |
| **Branch Manager** | `manager.cebu@steeltrack.com` | Cebu Branch | Branch operations, stock sign-offs |
| **Cashier** | `testdavao@gmail.com` | Davao Branch Counter | Point of Sale (POS) checkout terminal, official receipt printing |
| **Cashier** | `testcebu@gmail.com` | Cebu Branch Counter | POS checkout, cashier shift sales |

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
| **Keras LSTM AI Forecasting** | ✅ Full Catalog Projections (646 SKUs) | ❌ Restricted | ❌ Restricted |
| **POS Checkout Terminal** | ✅ View & Test | ❌ Restricted | ✅ Primary Counter Function |
| **Receipt Generation & Reprint** | ✅ Allowed | ❌ Restricted | ✅ Automatic Modal + PDF Download |
| **Staff & User Management** | ✅ All Branches & All Roles | ✅ Create Accounts for Own Branch Only | ❌ Restricted |

---

## 📝 Recent Change History

- **v1.7.0**:
  - **Keras 3 / TensorFlow 2.21 LSTM Demand Forecasting Microservice**:
    - Implemented production LSTM network directly utilizing `keras.layers.LSTM` from `keras.src.layers.rnn.lstm`.
    - Trained on 10-year historical dataset (`monthly_series_cache.sqlite` with 128,939 records) covering all 4 operational branches (`Davao`, `Cagayan De Oro`, `Cebu`, `Mandaue`).
    - Extended predictions to cover **all 646 catalog steel products** across all product categories.
    - Added batched inference engine generating forward predictions with 95% confidence intervals and multi-month consumption trend classification.
    - Delivered FastAPI HTTP endpoints (`/health`, `/models`, `/predict`, `/train`, `/metrics`) on port 8000.
  - **Frontend Forecast Graph Refinement**:
    - Scoped the demand forecast line chart strictly to the **current month and 3 forward projection months** (no historical past months rendered in the forecast curve).
    - Expanded product selector to support the full catalog of 646 steel SKUs with interactive search and category filtering.
  - **Type Checking & Tooling Hardening**:
    - Fixed Python type invariance and NoneType narrowing issues in `ml/predictor.py` and `ml/server.py`.
    - Configured `pyrightconfig.json` and `.vscode/settings.json` to reference the active project `venv`.
  - **Production Environment Configuration**:
    - Created and populated [`backend/API/appsettings.Production.json`](file:///d:/It_Project/Capstone/SteelTrack/backend/API/appsettings.Production.json) with production connection strings, JWT policies, and LSTM microservice URLs.

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
