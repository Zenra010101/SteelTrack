# Plan & Implementation Record: honest forecasting errors + restart-scoped session tokens

**Status: implemented and verified on 2026-10-22.** This file records both the
design and the evidence that it works.

## Context

Two defects were reported:

1. **The forecast view showed a blanket lie.** When
   `GET /api/products/lstm-forecast` failed for *any* reason, the UI said
   *"The forecasting API did not respond. Check that the .NET API is running
   and reachable."* — which is only one of at least six distinct causes. The
   root cause was `fetchLstmForecast` in `frontend/src/services/api.ts`
   collapsing every failure — including a 401 and a 500 — into `null`.

2. **The session token was not tied to the backend process.** The JWT signing
   secret was a fixed literal, so a backend restart was completely invisible:
   the browser kept a token minted by a process that no longer existed. The
   frontend never validated a stored token at boot, never handled a 401
   anywhere outside the login screen, and logout left the token in
   localStorage.

**Required behaviour (user's wording):** *"restart the session token every
time the project is restarted, but don't do anything in the session token if
the projects only reloaded in browser."*

Decisions taken with the user on 2026-10-22:

| Question | Decision |
|---|---|
| Effect of a backend restart | **Force re-login** — the server rejects the old token (401), it is not merely ignored by the browser. |
| Where the behaviour applies | **Configurable, default on** — `Jwt:RotateOnStartup` (default `true`); production can pin `Jwt:InstanceId`. |
| Breadth of 401 handling | **Every API call**, not just the forecast view. |

---

## Part 1 — Backend

### 1.1 `ServerInstance` — one source of truth

**New:** `backend/Infrastructure/Services/ServerInstance.cs`

A singleton owning the process instance id plus the secret / issuer /
audience / expiry. It replaces two divergent reads of the `Jwt` config
section (`Program.cs` used `Get<JwtSettings>()` with an inline fallback
literal; `JwtTokenService` used `IOptions<JwtSettings>` with an empty
default) — a combination where a missing section would have made the API
validate against one secret while the token service signed with another, so
every login silently produced a token the API rejected.

Instance-id resolution, in priority order:

1. `Jwt:InstanceId` set → that value, pinned across restarts (multi-instance
   hosting behind a load balancer).
2. `Jwt:RotateOnStartup` false → the constant `"static"`, also pinned.
3. otherwise → a fresh GUID per process, so a restart ends every session.

A missing `Jwt:Secret` now throws at startup with a clear message rather than
producing a token nobody can use.

Registered once, in `backend/API/Program.cs`, so the token service signs with
the very same instance id the validation path checks against.

### 1.2 The token carries the instance

`backend/Infrastructure/Services/JwtTokenService.cs` now takes `ServerInstance`
instead of `IOptions<JwtSettings>`, and adds a `stt_instance` claim alongside
the existing four.

### 1.3 The restart is rejected, and the reason is reported

`backend/API/Program.cs` — `AddJwtBearer` gains `JwtBearerEvents`:

- `OnTokenValidated` — a token whose `stt_instance` is missing or does not
  match this process is failed, and the reason `server_restarted` is stashed
  on the request.
- `OnChallenge` — writes a JSON body. **A 401 previously had an empty body**,
  which is exactly why the frontend could not tell the causes apart:

  ```json
  { "success": false, "message": "The server was restarted, so your session ended. Please sign in again.", "reason": "server_restarted" }
  ```

  `reason` ∈ `server_restarted` | `token_expired` | `invalid_token` |
  `missing_token`.
- `OnForbidden` — the same shape for a 403.

New `backend/API/Common/SessionEndReasons.cs` holds the reason constants.

### 1.4 A session endpoint the SPA can reach

**New:** `backend/API/Controllers/SessionController.cs` — `GET
/api/session/instance` → `{ instanceId, startedAtUtc, rotatesOnStartup }`,
anonymous.

It lives under `/api/**` deliberately: `frontend/vite.config.ts` proxies only
the `/api` prefix, so the existing `GET /health` at the root is unreachable
from the SPA in dev. This one must not repeat that mistake.

---

## Part 2 — Frontend

### 2.1 `frontend/src/services/session.ts` (new)

The single place that owns the token: storage-key constants, a JWT-payload
decoder that reads the `stt_instance` claim without a round trip,
`clearAuthState()` (removes the token, the stored user **and** the session
marker — logout previously left the first two behind), a tiny listener set,
and `messageForReason()`.

### 2.2 `frontend/src/services/apiClient.ts` (new)

One `window.fetch` wrapper, installed in `frontend/src/main.tsx` before the
first render. Any **401** from an `/api/` URL that is not the login endpoint
reads the `reason` from a **clone** of the body (so the caller can still read
the original), clears the auth state, and notifies the app.

A wrapper rather than per-call-site checks: `api.ts` alone has ~30 `fetch`
calls and two components fetch outside it.

### 2.3 Boot validation — `frontend/src/App.tsx`

The app now boots into a three-state machine (`checking` / `ready` / `ended`)
instead of restoring the session blindly.

On mount, **only if a token exists**:

1. `GET /api/session/instance` → `instanceId`.
2. Compare with the token's `stt_instance` claim.
   - **Mismatch** → the backend restarted → clear the token → login screen
     saying *"The server was restarted, so your session ended."*
   - **Match** → restore the stored session **exactly as it was**. The token
     is not re-issued, not mutated, not written back. *This is the
     browser-reload case.*
3. **Network failure** → the token is **not** cleared. Only an explicit 401 or
   an instance mismatch ends a session; a connectivity problem is not a
   session problem.

The login screen is held back while the check is in flight, so a page reload
does not flash the login form at somebody who is already signed in.

`handleLogout` now also calls `POST /api/auth/logout` (best effort — the
endpoint already existed and only writes an audit row) and clears the token
and the stored user.

### 2.4 The login screen says why — `frontend/src/components/LoginScreen.tsx`

New optional `notice` prop, rendered in the existing notice box.

---

## Part 3 — Honest forecasting errors

### 3.1 A discriminated result — `frontend/src/services/api.ts`

`fetchLstmForecast` returns `LstmForecastResult` instead of `| null`:

| condition | kind | message |
|---|---|---|
| 401 | `unauthorized` | "Your session has ended. Sign in again to view the demand forecast." |
| 403 | `forbidden` | "Your account does not have permission to view the demand forecast." |
| 404 | `not_found` | "The forecast endpoint was not found (HTTP 404). The frontend and the .NET API are out of sync." |
| 400 | `bad_request` | "The API rejected the forecast request (HTTP 400). {server message}" |
| other 4xx | `bad_request` | "The API rejected the forecast request (HTTP {status})." |
| 5xx | `server_error` | "The .NET API failed while building the forecast (HTTP {status}). Check the API logs." |
| `fetch` threw | `network` | "Could not reach the .NET API. The browser could not complete the request — confirm the API is running and reachable." |
| no `data` | `malformed` | "The .NET API returned no forecast data." |

The server's message is read from `json.message` (the `ApiResponse` field
name — the middleware writes `message`, not `error`).

### 3.2 The view renders it — `frontend/src/components/OwnerForecastView.tsx`

The blanket string is gone. The red banner now has an icon, a title
("Could not load the demand forecast") and the specific cause.

### 3.3 The downstream service gets its own diagnostics

`backend/Infrastructure/Services/LstmForecastClient.cs` returned `null` for
*both* a transport failure and an HTTP 401/503/500 — so "the service is down"
and "the service rejected our API key" were the same event to the caller.
This is exactly the class of bug that made the API-key failure invisible
earlier.

`GetPredictionsAsync` now returns an `LstmPredictOutcome` carrying
`Response`, `TransportFailure`, `StatusCode` and `ErrorMessage`. These reach
the client through two new fields on `LstmForecastResponse`:
`ServiceStatusCode` and `ServiceError`.

`serviceBanner` gained branches for each cause, checked before the existing
"partly served" branch:

| condition | banner |
|---|---|
| unreachable (`statusCode == null`) | *Forecasting service unreachable* — check `Lstm:BaseUrl` |
| 401 | *Forecasting service rejected the shared API key* — check `Lstm:ApiKey` |
| 503 | *No trained model available yet* — run `POST /train` |
| 5xx | *Forecasting service error (HTTP {status})* |

### 3.4 The misleading coverage percentage

`HISTORY_MONTHS = 6` means the requested window contains six months the
service can never forecast, so `fallbackCount` was never 0, `ServiceFallback`
was always true, and the "partly served" banner was permanently amber over a
percentage that counted rows which were never model-eligible.

New `ForecastWindowCount` / `ForecastFallbackCount` on the response count
**only the forecast region** (the months from the current one on). The banner
percentage is computed from those.

---

## Verification

### Automated

**New:** `backend/API/verify_session_lifecycle.py` — carries a token across a
restart in a file, so the "after restart" run presents the token the *old*
process issued to the *new* one. It reads the credentials from the tracked
`DataSeeder.cs` and prints nothing sensitive.

```
$ python verify_session_lifecycle.py
[PASS] login returns a token
[PASS] token carries the server instance claim — stt_instance=320d48fed14746d5b929a7929e8cb54e
[PASS] session endpoint reports the same instance as the token
[PASS] stored token still works against the same API — HTTP 200
[PASS] forecast endpoint accepts the stored token — HTTP 200
[PASS] token is stable across reads

$ # restart the API, then:
$ python verify_session_lifecycle.py --after-restart
[PASS] the pre-restart token was carried over
[PASS] old token is rejected after a restart — HTTP 401
[PASS] rejection names the reason — reason=server_restarted
[PASS] rejection carries a human-readable message — The server was restarted, so your session ended. Please sign in again.
[PASS] a fresh login works after the restart
[PASS] the new token belongs to the new instance — stt_instance=47dac50a2e034787b33af43817640e88
[PASS] the new token differs from the old one
```

**Extended:** `backend/API/verify_forecast_endpoint.py` now also prints the
new diagnostic fields.

### Observed behaviour

| Scenario | Result |
|---|---|
| Browser reload, backend untouched | Session restored, token byte-identical, HTTP 200 |
| Backend restarted | Old token → **HTTP 401**, `reason: "server_restarted"`; fresh login works |
| Python service **down** | HTTP 200, `serviceReachable: false`, `serviceStatusCode: null` → *"unreachable"* banner |
| Python service up | HTTP 200, `serviceReachable: true`, 846 `lstm` rows, `serviceStatusCode: null` |
| Python service **401** (wrong key) | HTTP 200, `serviceStatusCode: 401`, `serviceError: {"detail":"Invalid or missing API key"}` → *"rejected the shared API key"* banner |
| No token supplied | HTTP 401 with `reason: "missing_token"` and a readable message |

### Builds

```
dotnet build SteelTrack.slnx   → Build succeeded. 0 Error(s)
npx tsc -b                     → clean
npm run lint                   → warnings only, all pre-existing patterns
```

---

## Files changed

**Backend (new):** `Infrastructure/Services/ServerInstance.cs`,
`API/Common/SessionEndReasons.cs`, `API/Controllers/SessionController.cs`,
`API/verify_session_lifecycle.py`

**Backend (modified):** `API/Program.cs`,
`Infrastructure/Services/JwtTokenService.cs`,
`Infrastructure/Services/LstmForecastClient.cs`,
`Infrastructure/Services/LstmForecastService.cs`,
`Infrastructure/Settings/JwtSettings.cs`,
`Application/DTOs/Products/LstmForecastResponse.cs`,
`API/verify_forecast_endpoint.py`

**Frontend (new):** `src/services/session.ts`, `src/services/apiClient.ts`

**Frontend (modified):** `src/main.tsx`, `src/App.tsx`,
`src/services/api.ts`, `src/components/LoginScreen.tsx`,
`src/components/OwnerForecastView.tsx`

## Known limitations (deliberately out of scope)

- **Server-side token revocation on logout.** `POST /api/auth/logout` writes an
  audit row and nothing else — the token stays valid until it expires. The
  client now discards it, which is what actually ends the browser session.
- **Multi-instance hosting.** With `Jwt:RotateOnStartup` at its default, a
  load balancer routing to a second instance would 401 users. Set
  `Jwt:InstanceId` to a fixed value for that deployment.
- **`Jwt:Secret` is still a literal in `appsettings.json`.** It should come
  from a secret store before this goes to production.
