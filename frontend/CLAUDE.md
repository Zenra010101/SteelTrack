# Project: SteelTrack — Multi-Branch Steel Inventory Management System

Full Capstone project at D:\It_Project\Capstone\SteelTrack (frontend sibling of backend\API). Do not modify parent directories. Run Python with `-I` flag.

## Architecture & Workflow

Backend (C# ASP.NET Core, Clean Architecture) serves JSON: `GET /api/health`, `/api/health/db`, controllers under `backend\API`. Frontend is a React 19 + TypeScript + Vite SPA serving its own dev server on port 5173; backend on port 5000 — both must run in parallel for local dev. Auth: JWT Bearer with per-process instance id claim and a `ServerInstance` singleton to detect restarts; OnChallenge writes reason codes into the response body (`SessionEndReasons`), OnForbidden does the same, login endpoint under rate limiter 15/min.

## Local development

```
cd D:\It_Project\Capstone\SteelTrack\backend\API
dotnet run --project backend\API\SteelTrack.Api.csproj
```
Frontend: `cd frontend && npm i && npm run dev` (Vite proxies /api to localhost:5000).
Do NOT push to GitHub unless explicitly asked. Servers killed and ports confirmed free when done.

## Task runner

Runs `npm run lint` inside the frontend directory at the start of every session to verify the recent UI edits type-check cleanly, then re-tests against feedback to confirm acceptance. Starts both servers in parallel for a final smoke test.
