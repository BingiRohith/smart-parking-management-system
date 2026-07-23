# Bug Report — Smart Parking Availability System

> This report was originally produced by static + empirical audit with no code changes. **It is now being updated in place as each finding is fixed**, one commit at a time. Every finding below carries a `Status` line; anything marked `✅ FIXED` has a corresponding commit in git history, anything marked `⏳ PENDING` has not been touched yet. A small number of low-severity, non-bug recommendations will intentionally **not** be implemented because doing so would add new functionality/breaking API surface beyond a bug-fix pass — those are called out in [Intentionally Not Implemented](#intentionally-not-implemented) at the end.

**Severity scale:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## Summary Table

| # | Severity | Category | File | Short description | Status |
|---|---|---|---|---|---|
| 1 | 🔴 Critical | Production/Security | *(missing)* `.gitignore` | No root or `server/.gitignore` — `.env` secrets and `node_modules` are uncommitted-only by luck | ✅ FIXED |
| 2 | 🟠 High | Missing Dependency | `server/package.json:8` | `npm run dev` calls `nodemon`, which is never declared as a dependency | ✅ FIXED |
| 3 | 🟠 High | Async Bug/Production | `server/index.js:34,71` | Server starts accepting requests before `connectDB()` resolves | ✅ FIXED |
| 4 | 🟠 High | Security | `server/controllers/authController.js:10-18` | `sameSite: 'strict'` cookie will silently break auth on cross-domain production deploys | ✅ FIXED |
| 5 | 🟠 High | Security | `server/routes/auth.js`, whole API | No rate limiting anywhere — login is brute-forceable | ✅ FIXED |
| 6 | 🟡 Medium | Validation/Runtime | `server/controllers/authController.js:39` | Login username isn't lowercased before query, but stored usernames are forced lowercase | ✅ FIXED |
| 7 | 🟡 Medium | Security | `server/controllers/floorController.js:26` | Public unauthenticated endpoint leaks staff names via `populate` | ✅ FIXED |
| 8 | 🟡 Medium | Database | `server/controllers/floorController.js:38-91` | Read-modify-write on `Floor.save()` risks lost updates under concurrent slot edits | ✅ FIXED |
| 9 | 🟡 Medium | Validation | `server/controllers/floorController.js:96-127` | No bounds/type check on `rows`/`slotsPerRow` | ✅ FIXED |
| 10 | 🟡 Medium | Security | `server/controllers/authController.js:28` | JWT unnecessarily duplicated into the response body | ✅ FIXED |
| 11 | 🟡 Medium | Async Bug | `client/src/hooks/useFloor.js:14-26` | No guard against out-of-order responses when `floorId` changes quickly | ✅ FIXED |
| 12 | 🟡 Medium | Unhandled Exception | `server/index.js` (whole file) | No `process.on('unhandledRejection'/'uncaughtException')` safety net | ✅ FIXED |
| 13 | 🟡 Medium | Unhandled Exception | `server/middleware/errorHandler.js:6-10` | Assumes `err.keyValue` always exists; would itself throw if not | ✅ FIXED |
| 14 | 🟢 Low | Memory/Resource Leak | `client/src/services/socket.js` | Shared socket is connected lazily but never explicitly disconnected | ✅ FIXED |
| 15 | 🟢 Low | Dead Code | `server/utils/seed.js:2` | `mongoose` imported, never used | ✅ FIXED |
| 16 | 🟢 Low | Duplicate Code | `server/utils/seed.js:7-22` vs `server/controllers/floorController.js:104-117` | Slot-generation logic duplicated and drifted | ✅ FIXED |
| 17 | 🟢 Low | Duplicate Code | `client/src/pages/admin/AdminFloors.jsx` vs `AdminStaff.jsx` | Near-identical CRUD scaffolding, ~250 lines each | ⏳ PENDING |
| 18 | 🟢 Low | Performance | `server/controllers/statsController.js:6-30`, `floorController.js:7-9` | Full slot arrays loaded into memory just to count statuses | ✅ FIXED |
| 19 | 🟢 Low | Performance | `server/controllers/authController.js:56-58` | `getMe` re-queries a user already loaded by `protect` | ✅ FIXED |
| 20 | 🟢 Low | Security (dependency) | `server/package-lock.json` (transitive) | `body-parser < 1.20.6` — low-severity DoS advisory | ✅ FIXED |
| 21 | 🟢 Low | Production | `server/index.js:54-56` | `/api/health` reports "ok" even if MongoDB never connected | ✅ FIXED |

Full detail for every item follows, grouped exactly by the categories requested. Each entry's **Status** line records what was actually done.

---

## Build Errors

**Verified clean.** `npm install` completed without errors in both `client/` and `server/`. `cd client && npm run build` produced a working `dist/` bundle (759ms, no warnings). No compilation/bundling errors were found.

The one build-adjacent failure found is a missing-dependency issue in the dev script — see **Missing Dependencies #2** below, since that's its root cause, not a bundler/compiler defect.

---

## Runtime Errors

### R1 — Server accepts traffic before the database connection is established
- **Severity:** 🟠 High
- **File:** [server/index.js:34](server/index.js) (call site), [server/index.js:70-73](server/index.js) (listen), [server/config/db.js:3-12](server/config/db.js) (async connect)
- **Why it's a bug:** `connectDB()` is called without `await` and without blocking startup; `server.listen(PORT, ...)` runs immediately afterward regardless of whether Mongo has connected yet. Empirically confirmed: running `node index.js` with no reachable MongoDB printed `🚀 Server running...` immediately, with no connection error surfacing for many seconds (Mongo driver's default server-selection timeout is ~30s).
- **Impact:** For the first several seconds after boot (or indefinitely if Mongo is unreachable), the server responds to HTTP requests as if healthy, but every DB-backed route will hang (Mongoose buffers commands by default until `bufferTimeoutMS`, default 10s) or error out unpredictably. This is especially bad in orchestrated environments (Docker/K8s) where a readiness probe hitting `/api/health` (see **Production #P5**) would report healthy while the app is not actually usable.
- **Best fix:** `await connectDB()` before calling `server.listen(...)`, or expose a readiness flag that `/api/health` checks (`mongoose.connection.readyState === 1`).
- **Status:** ✅ **FIXED.** Wrapped startup in an async IIFE that `await connectDB()`s before calling `server.listen(...)`. Verified with a real in-memory MongoDB instance: a request fired 300ms after boot now gets connection-refused (server isn't listening yet) instead of a premature 200; once Mongo connects, `/api/health` and `/api/floors` both work correctly. Also verified that with an unreachable `MONGODB_URI`, the server no longer prints "Server running" at all (previously it did, immediately, regardless of DB state).

### R2 — Modal body-scroll lock can be prematurely released with nested modals
- **Severity:** 🟢 Low
- **File:** [client/src/components/common/Modal.jsx:14-17](client/src/components/common/Modal.jsx)
- **Why it's a bug:** `document.body.style.overflow` is set to `'hidden'` or `''` based solely on the *current* modal's `isOpen`, with no reference counting. If two `Modal` instances were ever open at once, closing the inner one clears `overflow` even though the outer modal is still open.
- **Impact:** Currently benign because the app never opens two modals simultaneously, but it's a latent bug that will resurface silently if that assumption changes (e.g., a confirm-dialog nested inside a form modal, which is a common pattern this app already uses elsewhere via `ConfirmDialog`).
- **Best fix:** Track a module-level open-modal counter, or manage the scroll lock at the app root instead of per-modal-instance.
- **Status:** ✅ **FIXED.** Added a module-level `openModalCount` shared across all `Modal` instances; the lock effect increments/sets `overflow:'hidden'` on mount-while-open and decrements on cleanup, only clearing `overflow` once the count reaches `0`. Verified the primary regression risk in a real browser: opened the "Add Floor" modal in the admin console (`overflow` correctly becomes `hidden`), then closed it (`overflow` correctly clears back to `''`) — identical behavior to before the change for the single-modal case, which is the only one that currently occurs in this app's UI. The nested-modal counting itself is simple, self-contained integer arithmetic verified by code inspection.

---

## Broken Imports

**None found.** All 132 client modules transformed successfully in the Vite build; the server booted without any `MODULE_NOT_FOUND` errors. Every `require()`/`import` path was cross-checked against the actual file tree.

---

## Missing Dependencies

### M1 — `nodemon` used in `npm run dev` but never declared
- **Severity:** 🟠 High
- **File:** [server/package.json:8](server/package.json) (`"dev": "nodemon index.js"`), compare to `dependencies` block at lines 14-24 (no `devDependencies` section exists at all)
- **Why it's a bug:** `nodemon` is not listed in `dependencies` or `devDependencies`, and isn't installed anywhere in the dependency tree.
- **Impact:** Confirmed empirically — `npm run dev` fails immediately with `'nodemon' is not recognized as an internal or external command`. Anyone following the natural `npm run dev` convention (rather than the README's `node index.js`) cannot start the server at all.
- **Best fix:** `npm install --save-dev nodemon` and commit the updated `package.json`/`package-lock.json`.
- **Status:** ✅ **FIXED.** Ran `npm install --save-dev nodemon` in `server/`, adding it to a new `devDependencies` block. Verified `npm run dev` now boots the server correctly (confirmed via a live run showing nodemon's startup banner and the app listening on port 5000), instead of failing with `'nodemon' is not recognized`.

---

## API Issues

### A1 — `DELETE /api/floors/:id` and `DELETE /api/staff/:id` don't delete anything
- **Severity:** 🟢 Low
- **File:** [server/controllers/floorController.js:145-151](server/controllers/floorController.js) (`deleteFloor`), [server/controllers/staffController.js:71-81](server/controllers/staffController.js) (`deleteStaff`)
- **Why it's a bug:** Both handlers perform a soft update (`isActive: false`) rather than an actual delete, despite being bound to the `DELETE` HTTP verb and named `delete*`.
- **Impact:** Not a functional defect (the frontend and docs are consistent about this being "deactivate"), but it's a REST semantics mismatch that will surprise any future API consumer expecting `DELETE` to be destructive/idempotent-removal.
- **Best fix:** Rename the functions/routes to something like `PATCH /api/floors/:id/deactivate`, or document the soft-delete semantics explicitly in the API contract (partially done in the README already — just not in the code/route naming).
- **Status:** ⏳ PENDING

### A2 — No pagination on list endpoints
- **Severity:** 🟢 Low
- **File:** [server/controllers/staffController.js:4-11](server/controllers/staffController.js) (`getAllStaff`), [server/controllers/floorController.js:154-157](server/controllers/floorController.js) (`getAllFloorsAdmin`)
- **Why it's a bug:** Both return the entire collection unconditionally.
- **Impact:** Fine at current demo scale (a handful of floors/staff); would degrade linearly as the org grows and become a real problem in a large multi-building deployment.
- **Best fix:** Add `?page`/`?limit` query params with sane defaults before this is used beyond a single small facility.
- **Status:** ⏳ PENDING — will be documented as intentionally not implemented (see end of report); adding paginated query params is new API surface, not a bug fix.

*(See also **Validation #V1** for the related lack of bounds-checking on floor creation, and **Security #S6** for the public-endpoint PII leak, which is also arguably an API design issue.)*

---

## Database Issues

### D1 — Lost-update race condition on concurrent slot toggles
- **Severity:** 🟡 Medium
- **File:** [server/controllers/floorController.js:38-91](server/controllers/floorController.js) (`updateSlotStatus`), specifically lines 46 (`Floor.findById`) and 63 (`floor.save()`)
- **Why it's a bug:** The handler reads the entire `Floor` document (including the full `slots` array), mutates one embedded subdocument in memory, then writes the *entire document* back with `.save()`. If two requests (e.g., a security guard and an admin, or two guards if a floor is ever assigned to more than one account) modify **different slots on the same floor** concurrently, whichever `.save()` completes last will overwrite the DB with its own stale in-memory copy of the slots array — silently reverting the other request's change. There is no optimistic-concurrency check (Mongoose's automatic `__v` versioning does not protect general subdocument field mutations like this) and no atomic `$set` targeting only the changed slot.
- **Impact:** Under real concurrent usage (multiple staff/admin sessions active on the same floor at once), slot status updates can be silently lost with no error to either client — the second writer's request appears to succeed, but a third party's earlier change vanishes.
- **Best fix:** Use an atomic positional update instead of load-mutate-save:
  ```js
  await Floor.updateOne(
    { _id: floorId, 'slots._id': slotId },
    { $set: { 'slots.$.status': status, 'slots.$.lastUpdated': new Date(), 'slots.$.lastUpdatedBy': req.user._id } }
  );
  ```
- **Status:** ✅ **FIXED.** `updateSlotStatus` now uses `Floor.findOneAndUpdate({_id, 'slots._id': slotId}, {$set: {...}}, {new: true})`, which MongoDB executes as a single atomic document write — the load-then-save round trip is gone entirely. The role-based 403 check was moved earlier (it only needs `req.user`, not the floor document), and a lightweight `Floor.exists()` check distinguishes a 404 "Floor not found" from a 404 "Slot not found" without re-introducing a read-before-write step for the actual mutation. Verified with a real in-memory MongoDB: fired 20 concurrent PATCH requests at 20 different slots on the same floor via `Promise.all` — all 20 persisted correctly with zero lost updates (this is guaranteed by construction, since MongoDB single-document writes are always atomic, rather than relying on timing to "get lucky"). Also re-verified all existing behavior is unchanged: security-role 403 on wrong floor, 404 on bad floor/slot id, 400 on invalid status, 200 on valid updates by both admin and assigned security staff.

### D2 — `totalSlots` sync only happens via `.save()`, not query-style updates
- **Severity:** 🟢 Low (upgraded in practice — see Status: this was already actively wrong, not just a latent risk)
- **File:** [server/models/Floor.js:83-86](server/models/Floor.js) (`pre('save')` hook)
- **Why it's a bug:** The hook that keeps `totalSlots` in sync with `slots.length` is a *document* middleware (`pre('save')`), which does **not** run for query-style updates like `Floor.findByIdAndUpdate(...)` or `Floor.updateOne(...)`. Currently no code path updates `slots` via those methods, so it hasn't manifested yet, but it's a latent trap.
- **Impact:** If a future change (e.g., adding/removing individual slots via `findByIdAndUpdate`, or the fix suggested in **D1** above) touches `slots` without going through `.save()`, `totalSlots` will silently desync from the real slot count.
- **Best fix:** Compute `totalSlots` as a virtual (like `availableCount`/`occupiedCount`) instead of a stored+synced field, removing the possibility of drift entirely.
- **Status:** ✅ **FIXED — and it turned out to already be actively broken, not just latent.** While implementing the fix, verified directly against a real MongoDB instance that `seed.js`'s `Floor.insertMany([...])` **never triggers `pre('save')` at all** (this is standard Mongoose behavior for `insertMany`, not a quirk of this app) — meaning every demo floor created by the seed script already had `totalSlots: 0` stored in the database despite having real slots, even before this bug-fix pass began. Removed the stored `totalSlots` field and its `pre('save')` sync hook entirely; `totalSlots` is now a virtual computed from `slots.length`, exactly like `availableCount`/`occupiedCount`, so it can never drift regardless of which write path touches `slots`. Also removed the now-meaningless `'totalSlots'` entry from the `.select(...)` string in `getAllFloors` (harmless as a no-op, but misleading to leave). Verified end-to-end against a freshly seeded database: `GET /api/floors`, `GET /api/floors/:id`, `POST /api/floors`, `GET /api/floors/admin/all`, and `GET /api/stats` all now report correct totals (30/35/24 for the seeded floors, 12 for a newly created 3×4 floor, 101 combined) instead of 0.

### D3 — No upper bound enforced anywhere on embedded array growth
- **Severity:** 🟡 Medium — see **Validation #V1** for full detail (same root cause: `createFloor` has no bounds check on `rows × slotsPerRow`, and MongoDB documents have a hard 16MB limit).
- **Status:** ✅ FIXED — see V1 above.

---

## Security Vulnerabilities

### S1 — No `.gitignore` at the project root or in `server/`
- **Severity:** 🔴 Critical
- **File:** *(absence of)* `smart-parking/.gitignore` and `smart-parking/server/.gitignore` — only [client/.gitignore](client/.gitignore) exists, and even it doesn't list `.env`
- **Why it's a bug:** There is currently no exclusion rule anywhere in the repo for `.env` files or `node_modules`. `client/.gitignore` excludes `node_modules`/`dist`/logs but has **no `.env` entry at all**. `server/` has no gitignore whatsoever.
- **Impact:** Given this project is about to be committed to git (per the user's stated next step), running a plain `git add .` right now would commit **both** `.env` files — including `server/.env`'s `JWT_SECRET` and `MONGODB_URI`, and both `server/` and (if not already installed-and-ignored) `client/`'s `node_modules` trees — directly into version control history, which is very difficult to fully scrub afterward.
- **Best fix:** Add a root-level `.gitignore` covering `node_modules/`, `.env`, `.env.*` (excluding `.env.example`), and `dist/` before the first commit. Rotate `JWT_SECRET` afterward regardless, since it's already been sitting unprotected on disk.
- **Status:** ✅ **FIXED.** This turned out to be worse than originally flagged: an `Initial commit` had already been made and pushed to `origin` (`https://github.com/BingiRohith/smart-parking-management-system.git`) with **both `.env` files tracked and committed**, before this fix pass began. Added a root-level `.gitignore` (covering `node_modules/`, `.env`/`.env.*` except `.env.example`, `dist/`) and updated `client/.gitignore` to also exclude `.env`. Ran `git rm --cached client/.env server/.env` so they stop being tracked going forward. **This does NOT remove them from prior git history**, which still contains the old secret on disk and (if already pushed before this session) potentially on GitHub. See the note at the end of this report and the chat response for required follow-up (secret rotation confirmed done in S2; history scrubbing requires a separate, explicit, destructive operation that was not performed without your approval).

### S2 — Placeholder-looking JWT secret checked out on disk with no protection
- **Severity:** 🔴 Critical (compounds S1)
- **File:** [server/.env:3](server/.env)
- **Why it's a bug:** `JWT_SECRET=your_super_secret_jwt_key_change_in_production` — this is the literal example value from `.env.example`, not a real random secret, and (per S1) has no gitignore protection.
- **Impact:** If ever deployed with this exact value (or committed to a public/shared repo), anyone can forge valid JWTs for any user ID, including `admin`.
- **Best fix:** Generate a long random secret (e.g., `openssl rand -hex 64`) per environment, and never let `.env` reach version control (see S1).
- **Status:** ✅ **FIXED.** Replaced the placeholder with a freshly generated 96-character random hex secret (`crypto.randomBytes(48).toString('hex')`) in the local, now-untracked `server/.env`. **Important:** since this secret was already committed to git history under the old placeholder value, any tokens ever signed with the old value should be considered compromised — this rotation invalidates them (all existing sessions will need to log in again), which is the correct outcome.

### S3 — `sameSite: 'strict'` cookie will break auth in typical production topologies
- **Severity:** 🟠 High
- **File:** [server/controllers/authController.js:13-18](server/controllers/authController.js)
- **Why it's a bug:** `sameSite: 'strict'` cookies are only sent on requests considered "same-site" (same registrable domain, i.e., same eTLD+1) — they work fine right now because `localhost:5173` and `localhost:5000` share the site `localhost`. If frontend and backend are deployed to genuinely different domains (e.g., a Vercel-hosted client and a Render-hosted API — an extremely common split-hosting pattern), the browser will **never** attach the cookie to cross-site XHR/fetch calls, no exceptions.
- **Impact:** Login would appear to succeed (the `Set-Cookie` header arrives), but every subsequent authenticated request would silently look logged-out, because the cookie is never sent back. This is the kind of bug that passes all local testing and only appears after deployment.
- **Best fix:** If frontend/backend will ever live on different domains, use `sameSite: 'none'` + `secure: true` (already conditionally set for production) and add CSRF protection (see S4) to compensate for the weaker SameSite policy.
- **Status:** ✅ **FIXED, together with S4.** `sameSite` is now `'none'` + `secure: true` in production (allows the cookie to be sent cross-site) and `'lax'` in development (unchanged practical behavior on localhost). See S4 immediately below for how CSRF exposure from relaxing `sameSite` was closed at the same time.

### S4 — No CSRF protection on any state-changing endpoint
- **Severity:** 🟡 Medium (would become 🟠 High if S3 is "fixed" by relaxing `sameSite`)
- **File:** All of [server/routes/floors.js](server/routes/floors.js), [server/routes/staff.js](server/routes/staff.js) — every `POST`/`PUT`/`PATCH`/`DELETE`
- **Why it's a bug:** Authentication relies entirely on an automatically-attached cookie with no CSRF token or double-submit check anywhere. This is currently only safe *because* of `sameSite: 'strict'` (S3) — the two issues are directly coupled.
- **Impact:** Currently low risk given S3's strict policy, but there is no independent defense-in-depth; fixing S3 for cross-domain deploys without also adding CSRF protection would open a real cross-site request forgery hole on every admin/security write endpoint.
- **Best fix:** Add a CSRF token (e.g., `csurf`/double-submit cookie pattern) as part of any change to the cookie's `sameSite` policy.
- **Status:** ✅ **FIXED.** Implemented the double-submit cookie pattern (no external CSRF library needed — `csurf` is deprecated/unmaintained):
  - Login now also sets a second, **non**-httpOnly `csrfToken` cookie (random 32-byte hex) alongside the existing httpOnly `token` cookie.
  - New `server/middleware/csrf.js`, applied globally to all requests: any non-safe method (anything but GET/HEAD/OPTIONS), except `POST /api/auth/login` itself (no session exists yet to forge), must send an `X-CSRF-Token` header matching the `csrfToken` cookie, or the request is rejected with `403`.
  - Client (`services/api.js`) gained a request interceptor that reads the `csrfToken` cookie via `document.cookie` and attaches it as the `X-CSRF-Token` header automatically — no call sites needed to change.
  - `logout` now clears both cookies.

  **Verified two ways:** (1) Raw HTTP tests against a live server confirmed a valid auth cookie *without* a CSRF header is rejected `403`, a *wrong* CSRF header is rejected `403`, the *correct* header succeeds `200`, GET requests are unaffected, and the protected `POST /api/auth/logout` route is correctly covered too. (2) A full real-browser end-to-end run (Vite dev client + Express server + a live MongoDB instance): logged in as a security user through the actual UI, clicked a slot to toggle it, and confirmed the `PATCH` request succeeded (`200`, correct response body, UI updated live) — proving the browser's own `document.cookie` read and the axios interceptor work correctly together, not just the server-side logic in isolation. Also confirmed via `document.cookie` inspection that `csrfToken` is JS-readable while `token` remains invisible to JS (still httpOnly), exactly as intended.

### S5 — No rate limiting anywhere, especially on login
- **Severity:** 🟠 High
- **File:** [server/routes/auth.js:6](server/routes/auth.js) (`POST /login`), and in fact the entire API surface
- **Why it's a bug:** `authController.login` has no attempt counter, lockout, or delay of any kind — an attacker can submit unlimited username/password combinations as fast as the network allows.
- **Impact:** Combined with the weak password policy (S7), this makes both targeted credential-guessing (e.g., against `admin`) and broad credential-stuffing fully unmitigated.
- **Best fix:** Add `express-rate-limit` (or similar) scoped at minimum to `/api/auth/login`, ideally with progressive backoff per IP/username.
- **Status:** ✅ **FIXED.** Added `express-rate-limit`, scoped to `POST /api/auth/login` only (10 attempts / 15 minutes per IP, standard `RateLimit-*` headers). Verified against a live server: 10 failed attempts return `401`, the 11th+ return `429` — and a *correct* password is also blocked once the limit is exhausted (confirming the limiter isn't accidentally scoped to failures only), while the unrelated public `/api/floors` endpoint remains unaffected.

### S6 — Public unauthenticated endpoint discloses staff names
- **Severity:** 🟡 Medium
- **File:** [server/controllers/floorController.js:25-33](server/controllers/floorController.js), specifically line 26: `Floor.findById(req.params.id).populate('slots.lastUpdatedBy', 'name')`
- **Why it's a bug:** `GET /api/floors/:id` has no `protect` middleware (by design — it's meant to serve anonymous drivers), yet it populates and returns the full `name` of whichever staff member last toggled *every single slot* on that floor. The frontend ([FloorDetailPage.jsx](client/src/pages/driver/FloorDetailPage.jsx)) never displays this field, but the raw JSON is fully accessible to anyone who calls the endpoint directly (curl, browser devtools network tab, etc.).
- **Impact:** Minor PII leak — reveals employee names and (indirectly, via which floor/slot they're associated with) shift/assignment patterns, to any anonymous internet user, with no legitimate product need for it on this endpoint.
- **Best fix:** Drop the `.populate('slots.lastUpdatedBy', ...)` on the public route entirely (it's unused by the client), or gate the populated field so it's only included for authenticated staff/admin requests.
- **Status:** ✅ **FIXED.** Removed `.populate('slots.lastUpdatedBy', 'name')` from `getFloorById` (confirmed unused by the client beforehand). Verified against a live server: after a real slot update (so `lastUpdatedBy` is genuinely set), the public `GET /api/floors/:id` response now returns it as a raw ObjectId string rather than a populated `{_id, name}` object — no staff name is exposed.

### S7 — Password policy is minimal
- **Severity:** 🟡 Medium
- **File:** [server/models/User.js:18-22](server/models/User.js) — `minlength: 6` is the only constraint
- **Why it's a bug:** No complexity requirement (no character-class mix, no common-password check), and 6 characters is short by modern standards.
- **Impact:** Weak passwords like `"123456"` pass validation; combined with S5's lack of rate limiting, accounts are realistically brute-forceable.
- **Best fix:** Raise `minlength` (8+) and/or validate complexity, and prioritize fixing S5 first since rate limiting matters more than password policy alone.
- **Status:** ✅ **FIXED.** Raised `minlength` from 6 to 8 (with a clearer validation message); did not add character-complexity rules, judging the length bump combined with the now-fixed rate limiting (S5) to be adequate hardening without adding UX friction beyond what this bug-fix pass calls for. Updated the matching client-side placeholder hint in `AdminStaff.jsx` from "Min. 6 characters" to "Min. 8 characters". Verified against a live database: the seeded demo passwords (`admin123`, `security123`, both already ≥8 chars) still work unchanged; creating staff with a 6-character password now correctly returns `400`, an 8-character one succeeds.

### S8 — JWT duplicated into the JSON response body
- **Severity:** 🟡 Medium
- **File:** [server/controllers/authController.js:20-29](server/controllers/authController.js), specifically line 28 (`token` in the JSON body) alongside line 20 (`res.cookie('token', token, ...)`)
- **Why it's a bug:** The code comment says this is "for mobile clients," but nothing in this codebase (the React SPA exclusively uses the httpOnly cookie) actually consumes the body token. Sending a sensitive bearer credential in a JSON response body — which is far more likely to be logged (browser devtools, proxies, API gateways, error-tracking tools that capture response payloads) than an httpOnly cookie — is an unnecessary widening of the token's exposure surface for a use case that doesn't exist yet.
- **Impact:** Increases the chance of the JWT leaking via logs/monitoring tooling for no current functional benefit.
- **Best fix:** Remove the body token until/unless a real non-cookie client (mobile app, etc.) actually needs it; add it back deliberately at that point with appropriate log-scrubbing safeguards.
- **Status:** ✅ **FIXED.** Confirmed (via grep) that no client code reads the response body's `token` field. Removed it from `sendTokenResponse`'s JSON payload — the httpOnly cookie remains the sole auth mechanism. Verified against a live server: login response body now contains only `{message, user}`, the `Set-Cookie` header is still present, and a subsequent `/api/auth/me` call using that cookie still succeeds.

### S9 — Known low-severity advisory in a transitive dependency
- **Severity:** 🟢 Low
- **File:** `server/package-lock.json` (transitive `body-parser` via `express@4.22.2`)
- **Why it's a bug:** `npm audit` reports `body-parser < 1.20.6` is vulnerable to a DoS where an invalid `limit` value silently disables body-size enforcement (GHSA-v422-hmwv-36x6).
- **Impact:** Low severity per npm's own classification; a fix is already available.
- **Best fix:** Run `npm audit fix` in `server/` (verified: a fix is available without a breaking major-version bump).
- **Status:** ✅ **FIXED.** Ran `npm audit fix` — resolved `body-parser` to `1.20.6` via `package-lock.json` only, no `package.json` version-range changes and no breaking bump. `npm audit` now reports 0 vulnerabilities. Verified the server still boots and serves requests correctly afterward.

*(No vulnerabilities were reported for the client — `npm audit` returned 0 findings.)*

---

## Validation Problems

### V1 — No bounds/type validation on floor creation dimensions
- **Severity:** 🟡 Medium
- **File:** [server/controllers/floorController.js:96-127](server/controllers/floorController.js) (`createFloor`)
- **Why it's a bug:** The only check is presence (`if (!name || level === undefined || !rows || !slotsPerRow)`). There's no check that `rows`/`slotsPerRow` are positive integers, nor any upper bound. The frontend ([AdminFloors.jsx:223](client/src/pages/admin/AdminFloors.jsx)) only sets an HTML `max="26"` attribute on the input, which is a UI hint, not an enforced constraint — a manually-crafted request (or a user editing the DOM/using devtools) can submit arbitrary values.
- **Impact:** A negative or zero value silently produces a floor with 0 slots (confusing, no error). A very large value (e.g., `rows: 10000, slotsPerRow: 10000`) would attempt to build a 100-million-element embedded array in a single document — likely to exceed MongoDB's 16MB per-document limit and throw an unhandled/unclear error, or in less extreme cases produce a legitimately huge, slow-to-load document.
- **Best fix:** Validate `rows`/`slotsPerRow` are positive integers within a sane range (e.g., 1–26 rows, 1–50 slots/row) server-side, returning a clear `400` otherwise.
- **Status:** ✅ **FIXED.** Added `Number.isInteger` + range checks (1–26 rows, 1–50 slots/row) right after the existing presence check, returning a clear `400` message. Verified against a live server with 8 cases: valid creation, zero rows, negative rows, rows > 26, slotsPerRow > 50, non-integer rows, the exact 10000×10000 DoS scenario called out above (now rejected instead of attempting a 100-million-slot document), and the new upper boundary (26×50) still succeeding — all passed as expected.

### V2 — Login username casing mismatch
- **Severity:** 🟡 Medium
- **File:** [server/controllers/authController.js:39](server/controllers/authController.js) vs [server/models/User.js:16](server/models/User.js)
- **Why it's a bug:** `User.username` has `lowercase: true`, so every stored username is lowercase regardless of how it was entered at creation (and the admin UI in [AdminStaff.jsx:76](client/src/pages/admin/AdminStaff.jsx) also lowercases client-side before creating). But `login`'s query — `User.findOne({ username, isActive: true })` — uses the raw, un-normalized `req.body.username` directly. MongoDB string equality is case-sensitive by default.
- **Impact:** A legitimate user who types `Admin` instead of `admin` at the login screen gets a generic "Invalid username or password" error, even with the exact correct password — a real, reproducible login failure for a plausible everyday input (capitalizing a name, autocapitalize on mobile keyboards, etc.).
- **Best fix:** Lowercase/trim `username` in `login` before the query: `User.findOne({ username: username.toLowerCase().trim(), isActive: true })`.
- **Status:** ✅ **FIXED.** `login` now normalizes (`.trim().toLowerCase()`) the incoming username before querying. Verified against a real seeded database: logging in as `admin`, `Admin`, and `  ADMIN  ` (padded + uppercase) all now succeed identically, while a wrong password still correctly returns 401.

### V3 — No username format constraints
- **Severity:** 🟢 Low
- **File:** [server/controllers/staffController.js:25-48](server/controllers/staffController.js) (`createStaff`)
- **Why it's a bug:** Only presence is checked; no restriction on length, characters, or whitespace.
- **Impact:** Usernames containing spaces or unusual characters could be created, leading to confusing login UX or edge cases in any future username-based lookups/URLs.
- **Best fix:** Add a simple regex constraint (e.g., alphanumeric + underscore, 3–30 chars) at the schema or controller level.
- **Status:** ⏳ PENDING

*(See also **Security #S7** for the related weak password-length-only policy.)*

---

## Performance Issues

### P1 — Full embedded slot arrays loaded into memory just to compute counts
- **Severity:** 🟢 Low (fine at current scale; won't scale)
- **File:** [server/controllers/floorController.js:6-22](server/controllers/floorController.js) (`getAllFloors`), [server/controllers/statsController.js:5-30](server/controllers/statsController.js) (`getStats`)
- **Why it's a bug:** Both handlers fetch entire `Floor` documents (including every embedded slot) and then filter the in-memory array in JavaScript (via the `availableCount`/`occupiedCount` virtuals or manual `.filter()`) purely to produce a count.
- **Impact:** At the current demo scale (~30-90 total slots across 3 floors) this is unnoticeable. At real mall scale (potentially thousands of slots per floor, many floors), this means transferring and holding the entire slot inventory in memory on every homepage load and every stats-panel refresh (which itself polls every 30s — see [AdminOverview.jsx:33](client/src/pages/admin/AdminOverview.jsx)), just to return a handful of integers.
- **Best fix:** Use a MongoDB aggregation pipeline (`$project` with `$size`/`$filter` on `slots`) to compute counts server-side without pulling the full array into Node.
- **Status:** ✅ **FIXED.** Both `getAllFloors` and `getStats` now use `Floor.aggregate([...])` with a shared `slotCountProjection` (`server/utils/slots.js`) that computes `totalSlots`/`availableCount`/`occupiedCount` via `$size`/`$filter` inside MongoDB — the full `slots` array (with every slot's number/row/position/timestamps) is never transferred for these two endpoints anymore, only the three counts per floor. (`getFloorById`, which genuinely needs the full slot grid for rendering, is unchanged.) Verified against a live server: floor summaries and stats totals match exactly as before, and after toggling 3 of Ground Floor's 30 slots occupied, `occupancyRate` correctly computes to `10` and all aggregate totals (`totalOccupied`, `totalFloors`, `totalStaff`, etc.) are correct.

### P2 — Redundant duplicate database query in `getMe`
- **Severity:** 🟢 Low
- **File:** [server/controllers/authController.js:56-59](server/controllers/authController.js) vs [server/middleware/auth.js:19](server/middleware/auth.js)
- **Why it's a bug:** `protect` middleware already runs `User.findById(decoded.id).select('-password')` and attaches the result to `req.user` on *every* request, including this one. `getMe` then runs a **second**, near-identical `User.findById(req.user._id)` (only difference: it adds `.populate('assignedFloor', ...)`), instead of just populating the already-fetched `req.user`.
- **Impact:** One entirely avoidable extra round-trip to MongoDB on every single call to `GET /api/auth/me` — which happens on every page load for every user (see [AuthContext.jsx:22](client/src/context/AuthContext.jsx)).
- **Best fix:** `await req.user.populate('assignedFloor', 'name level')` directly instead of re-querying by ID.
- **Status:** ✅ **FIXED.** `getMe` now calls `req.user.populate('assignedFloor', 'name level')` directly on the document `protect` already loaded, instead of a second `User.findById`. Verified against a live server: response shape is unchanged (populated `assignedFloor` with `name`/`level`, `password` still excluded) for a security user, and the admin edge case (`assignedFloor: null`) still resolves correctly without `.populate()` throwing on a null path.

### P3 — No route-based code splitting on the client
- **Severity:** 🟢 Low
- **File:** [client/src/App.jsx](client/src/App.jsx) (all pages statically imported)
- **Why it's a bug:** Every page component (driver, security, and the entire admin console) is bundled into a single JS chunk regardless of which route the user actually visits.
- **Impact:** Minor at this app's current size (measured build: 354KB JS / 110KB gzip) — a driver who never logs in still downloads the full admin dashboard code. Not urgent, but a cheap win.
- **Best fix:** Wrap route-level page imports in `React.lazy()` + `<Suspense>`, especially for the `/admin/*` subtree.
- **Status:** ⏳ PENDING — likely to be documented as intentionally deferred; see end of report.

### P4 — Verbose per-event console logging with no level control
- **Severity:** 🟢 Low
- **File:** [server/socket/socketHandler.js:3,8,14,18](server/socket/socketHandler.js)
- **Why it's a bug:** Every socket connect, `join_floor`, `leave_floor`, and disconnect is unconditionally logged via `console.log`, with no way to turn it off or route it through a real logger.
- **Impact:** Harmless at demo traffic; under real concurrent usage (many drivers opening the homepage, each opening a socket connection) this floods stdout, making production logs hard to search and potentially adding I/O overhead under load.
- **Best fix:** Route through a logging library (e.g., `pino`/`winston`) with a configurable level, and drop to `debug` level or remove entirely for connect/disconnect noise.
- **Status:** ⏳ PENDING

---

## Dead Code

### DC1 — Unused import
- **Severity:** 🟢 Low
- **File:** [server/utils/seed.js:2](server/utils/seed.js) — `const mongoose = require('mongoose');`
- **Why it's a bug:** Grepped the entire file for `mongoose.` usage — zero matches. The module is required but never referenced; `connectDB()` (imported separately) handles the actual Mongoose connection internally.
- **Impact:** Harmless, purely a cleanliness/clarity issue.
- **Best fix:** Delete the unused import.
- **Status:** ✅ **FIXED.** Removed the unused `require('mongoose')`. Verified `seed.js` still runs to completion successfully against a live database.

### DC2 — Redundant explicit schema option
- **Severity:** 🟢 Low
- **File:** [server/models/Floor.js:32](server/models/Floor.js) — `{ _id: true }` on `slotSchema`
- **Why it's a bug:** `_id: true` is Mongoose's default for subdocuments; setting it explicitly does nothing.
- **Impact:** None functionally — just noise that might mislead a reader into thinking it was deliberately toggled from a non-default.
- **Best fix:** Remove the option, or add a comment if it's meant to guard against a future default change.
- **Status:** ✅ **FIXED.** Removed the redundant `{ _id: true }` option. Verified against a live server: slot subdocuments still get a real `_id` (Mongoose's unaffected default), confirmed via a fresh seed + `GET /api/floors/:id` returning a proper ObjectId string per slot.

---

## Duplicate Code

### DUP1 — Slot-generation logic duplicated and drifted between seed and controller
- **Severity:** 🟢 Low
- **File:** [server/utils/seed.js:7-22](server/utils/seed.js) (`generateSlots`) vs [server/controllers/floorController.js:103-117](server/controllers/floorController.js) (inline in `createFloor`)
- **Why it's a bug:** Both implement the same "rows × slotsPerRow → array of `{slotNumber, row, position, status}`" logic independently, and they have already drifted: `floorController.createFloor` includes a fallback for rows beyond 26 (`rowLetters[r] || \`R${r + 1}\``), while `seed.js`'s version does not (`const rowLabel = rowLetters[r];`, no fallback — would silently produce `slotNumber: "undefined1"` etc. if ever called with >26 rows).
- **Impact:** Currently harmless since `seed.js` only ever requests 4-5 rows, but it's a textbook example of copy-paste duplication already causing behavioral drift — the next person to touch either copy is likely to fix only one of them, reintroducing an inconsistency.
- **Best fix:** Extract a single shared `generateSlots(rows, slotsPerRow)` utility (e.g., in a new `server/utils/slots.js`) and have both `seed.js` and `floorController.js` import it.
- **Status:** ✅ **FIXED.** Extracted `generateSlots(rows, slotsPerRow)` to `server/utils/slots.js` (using the more correct version with the >26-row fallback), and updated both `seed.js` and `floorController.createFloor` to import it — the drift between the two copies is now structurally impossible. Verified against a live server that seeded totals (30/35/24) and `createFloor`'s full bounds-validation test suite (8 cases, including the >26-row boundary) all still behave identically after the refactor.

### DUP2 — Near-identical CRUD scaffolding across two admin pages
- **Severity:** 🟢 Low
- **File:** [client/src/pages/admin/AdminFloors.jsx](client/src/pages/admin/AdminFloors.jsx) (262 lines) and [client/src/pages/admin/AdminStaff.jsx](client/src/pages/admin/AdminStaff.jsx) (238 lines)
- **Why it's a bug:** Both files independently implement the same shape of state machine: `list/loading/error` state, `modalOpen/editTarget/form/formError/saving` state for create-or-edit, and `deleteTarget/deleting` (or `deactivateTarget/deactivating`) state for a confirm-then-delete flow, each wired to `Modal`/`ConfirmDialog` in near-identical ways.
- **Impact:** Not a correctness bug, but a maintenance cost — any shared behavioral fix (e.g., better error formatting, optimistic UI, retry logic) has to be applied twice, and the two implementations can silently diverge over time exactly like DUP1 already did on the backend.
- **Best fix:** Extract a shared `useCrudResource(endpoint)` hook (or a generic `<AdminResourceTable>` component) encapsulating fetch/create/edit/delete/modal state, parameterized by resource-specific fields and columns.
- **Status:** ⏳ PENDING

---

## Memory Leaks

### ML1 — Shared Socket.IO client is never disconnected
- **Severity:** 🟢 Low
- **File:** [client/src/services/socket.js](client/src/services/socket.js) (module-level singleton, `autoConnect: false`), connected from [useFloor.js:36](client/src/hooks/useFloor.js) / [useFloors.js:33](client/src/hooks/useFloors.js)
- **Why it's a bug:** `socket.connect()` is called the first time a floor-related hook mounts, but there is no corresponding `socket.disconnect()` anywhere in the codebase — not on logout, not on navigating away to pages that don't need real-time data (e.g., `/admin`, `/login`), not ever.
- **Impact:** Not a JS heap memory leak in the traditional sense (the hooks do correctly clean up their individual event listeners with `socket.off(...)` on unmount), but it is a **lingering resource leak**: once any user visits the homepage or a floor page, an open WebSocket connection stays alive to the server for the rest of the browser tab's lifetime, even while the user is deep in the unrelated admin console or logged out entirely. At scale, this means the server holds open far more idle socket connections than there are actually "active" floor viewers.
- **Best fix:** Either disconnect the socket when the last consumer unmounts (e.g., a small reference-count wrapper around the shared instance), or explicitly `socket.disconnect()` in `AuthContext.logout()` and reconnect on next use.
- **Status:** ✅ **FIXED.** Added `acquireSocket()`/`releaseSocket()` to `socket.js`, backed by a module-level reference count: `socket.connect()` fires when the count goes 0→1, `socket.disconnect()` fires when it drops back to 0. `useFloors` calls acquire/release around its mount/unmount. `useFloor` needed a bit more care — its socket usage effect was originally keyed on `floorId`, and naively wiring acquire/release into that same effect would have caused a disconnect+reconnect *every time the user navigates between floors*, not just on mount/unmount. Split it into two effects: a mount/unmount-only effect owning the connection lifecycle, and a separate `floorId`-keyed effect owning only room `join_floor`/`leave_floor` membership. Verified in a real browser by watching the server's own connect/disconnect logs while navigating: leaving all floor/homepage pages for `/admin` (which needs no real-time data) correctly disconnects the socket with no new connection following, and navigating back to the homepage correctly reconnects it.

---

## Unhandled Exceptions

### UE1 — No process-level safety net for exceptions outside the Express request cycle
- **Severity:** 🟡 Medium
- **File:** [server/index.js](server/index.js) (entire file — no `process.on(...)` registered anywhere)
- **Why it's a bug:** `express-async-errors` only patches *Express route/middleware* handling — it does nothing for errors thrown inside Socket.IO event callbacks ([server/socket/socketHandler.js](server/socket/socketHandler.js)) or any other non-Express async code. Node's default behavior for an uncaught exception or unhandled promise rejection outside a caught context is to crash the entire process.
- **Impact:** Currently low-probability since the existing socket handler code is simple and unlikely to throw, but it's a structural gap: any future addition to socket event handling (or any other non-Express async code path) that throws will take down the **entire server process**, dropping every connected client's session and every in-flight request, not just the one that errored.
- **Best fix:** Add `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)` handlers that log the error (and, for `uncaughtException`, perform a controlled shutdown rather than leaving the process in an undefined state).
- **Status:** ✅ **FIXED.** Added both handlers near the top of `index.js`: `unhandledRejection` logs and lets the process continue running (matching Node's convention that a rejected promise alone shouldn't necessarily be fatal), `uncaughtException` logs and performs a controlled `process.exit(1)` rather than leaving the process in an undefined state. Verified in isolation (registering the identical handler code and triggering a simulated rejection and a simulated synchronous throw) that both are caught and logged as expected; also confirmed the real server still boots and serves requests normally with the handlers registered.

### UE2 — Error handler itself can throw on a malformed duplicate-key error
- **Severity:** 🟢 Low
- **File:** [server/middleware/errorHandler.js:6-10](server/middleware/errorHandler.js)
- **Why it's a bug:** `if (err.code === 11000) { const field = Object.keys(err.keyValue)[0]; ... }` assumes `err.keyValue` is always a populated object whenever `err.code === 11000`. This holds for the vast majority of MongoDB duplicate-key errors as thrown by the current Mongoose version, but is not a strictly guaranteed invariant across all write paths (e.g., certain bulk-write or driver-level error shapes omit `keyValue`).
- **Impact:** If ever triggered, this is especially bad because it happens **inside the last-resort error-handling middleware itself** — there's no further middleware to catch a secondary exception thrown here, so the original request would be left hanging or the process could be destabilized, and the *original* error that should have been reported to the client is lost entirely.
- **Best fix:** Guard defensively: `const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';` before using it.
- **Status:** ✅ **FIXED.** Added exactly that guard. Verified directly by invoking `errorHandler` with a synthetic `{code: 11000}` error deliberately missing `keyValue` — it now correctly returns `400 {"message":"A record with this field already exists."}` instead of throwing a secondary `TypeError` from `Object.keys(undefined)`.

---

## Async Bugs

### AB1 — Server startup race condition
- **Severity:** 🟠 High — see **Runtime Errors #R1** above for full detail (same issue: `connectDB()` not awaited before `server.listen()`).
- **Status:** ✅ FIXED — see R1 above.

### AB2 — Stale-response race condition in `useFloor`
- **Severity:** 🟡 Medium
- **File:** [client/src/hooks/useFloor.js:14-30](client/src/hooks/useFloor.js)
- **Why it's a bug:** `fetchFloor` is a `useCallback` keyed on `floorId`; the effect at line 28-30 re-invokes it whenever `floorId` changes (e.g., rapid client-side navigation between `/floor/A` and `/floor/B`). There is no cancellation token, `AbortController`, or "is this still the current floorId" guard before calling `setFloor(data.floor)` at line 20. If the request for floor A is still in flight when the user navigates to floor B (which starts a new, faster-resolving request), and A's response arrives *after* B's, `setFloor` will overwrite the correct floor-B data with stale floor-A data — while the URL and rest of the UI (breadcrumb, title) still say "floor B."
- **Impact:** A real, if narrow-window, data-correctness bug: the displayed slot grid can silently belong to the wrong floor for a moment (or indefinitely, until the next socket event or manual refetch nudges it back). More likely to manifest on slow/flaky networks where response ordering is less predictable.
- **Best fix:** Guard the `setFloor` call with a check that the response still corresponds to the current `floorId` (e.g., capture `floorId` in a ref, or use an `AbortController` per request and ignore aborted results), following the same pattern React's own docs recommend for this exact race.
- **Status:** ✅ **FIXED.** Added a monotonically-incrementing `requestIdRef`: each call to `fetchFloor` (whether from the effect on `floorId` change, or a manual `refetch()`) captures its own id, and the response handler discards the result if a newer call has since started (`requestIdRef.current !== requestId`). Verified two ways: (1) a direct simulation reproducing the exact race — floor A requested first but resolving slower (200ms) than floor B requested second (20ms) — confirmed the stale A response is discarded and final state correctly reflects floor B; (2) a real-browser regression check confirmed the normal single-navigation case (view Ground Floor's 30 slots) still renders correctly with no change in behavior.

### AB3 — Check-then-act race on username uniqueness
- **Severity:** 🟢 Low
- **File:** [server/controllers/staffController.js:32-36](server/controllers/staffController.js) (`createStaff`)
- **Why it's a bug:** `const existingUser = await User.findOne({ username }); if (existingUser) {...}` followed later by `User.create({...})` is a classic time-of-check-to-time-of-use race: two concurrent requests creating the same username could both pass the `findOne` check before either has inserted, then both proceed to `create`.
- **Impact:** Low practical risk (requires two near-simultaneous admin requests for the same new username) and is safety-netted by the schema's `unique: true` index on `username` — the second `create()` would fail with a Mongo duplicate-key error, correctly caught and formatted by `errorHandler`. So the failure mode is "confusing error on the loser" rather than actual data corruption, but the explicit pre-check gives a false sense of having fully prevented the race.
- **Best fix:** Rely on the unique index alone (remove the redundant pre-check, or keep it purely as a UX nicety for the *common* case while acknowledging the index — not the pre-check — is what actually guarantees correctness).
- **Status:** ⏳ PENDING

---

## Production Issues

### PR1 — Missing `.gitignore` before committing to version control
- **Severity:** 🔴 Critical — see **Security #S1**/**#S2** above; this is the single most time-sensitive item in this report given the user's stated intent to add this project to git next.
- **Status:** ✅ FIXED — see S1/S2 above for full detail.

### PR2 — `sameSite: 'strict'` breaks cross-domain production auth
- **Severity:** 🟠 High — see **Security #S3** above.
- **Status:** ✅ FIXED — see S3/S4 above.

### PR3 — No rate limiting
- **Severity:** 🟠 High — see **Security #S5** above.
- **Status:** ✅ FIXED — see S5 above.

### PR4 — No graceful shutdown handling
- **Severity:** 🟢 Low
- **File:** [server/index.js](server/index.js) (no `SIGTERM`/`SIGINT` handlers)
- **Why it's a bug:** The process has no hook to close the HTTP server, drain in-flight requests, or close the Mongoose connection cleanly before exiting.
- **Impact:** In any orchestrated environment (Docker, Kubernetes, PM2 restart, etc.) that sends `SIGTERM` on deploy/restart, in-flight requests can be abruptly cut off and the Mongo connection is left to the OS/driver to clean up rather than being closed deliberately.
- **Best fix:** Add a `SIGTERM` handler that calls `server.close()` and `mongoose.connection.close()` before exiting.
- **Status:** ⏳ PENDING

### PR5 — `/api/health` doesn't reflect actual health
- **Severity:** 🟡 Medium
- **File:** [server/index.js:54-56](server/index.js)
- **Why it's a bug:** The health check unconditionally returns `{ status: 'ok' }` — it never checks `mongoose.connection.readyState`, so it reports healthy even when the database is unreachable (directly compounding **R1**).
- **Impact:** Any deployment platform using this endpoint for liveness/readiness checks (load balancer, container orchestrator) would keep routing traffic to an instance that can't actually serve any real request.
- **Best fix:** Check `mongoose.connection.readyState === 1` and return a `503` if not connected.
- **Status:** ✅ **FIXED** — see R1 above; `/api/health` now checks `mongoose.connection.readyState` and returns `503`/`degraded` when not connected, `200`/`ok` when connected. Verified live against an in-memory MongoDB instance.

### PR6 — Console-only logging, no structured/leveled logger
- **Severity:** 🟢 Low — see **Performance #P4** above; same root cause, production-monitoring angle.
- **Status:** ⏳ PENDING

### PR7 — External Google Fonts dependency with no fallback
- **Severity:** 🟢 Low
- **File:** [client/index.html:8-10](client/index.html)
- **Why it's a bug:** Fonts are loaded from `fonts.googleapis.com`/`fonts.gstatic.com` with no `font-display` fallback strategy specified beyond the query string, and no self-hosted fallback.
- **Impact:** In network environments where Google Fonts is blocked or slow (some corporate/restricted networks), page text rendering can be delayed or use an unstyled fallback longer than necessary. Minor, cosmetic.
- **Best fix:** Self-host the font files, or accept the tradeoff consciously (it's a reasonable one for a project like this) — flagged for awareness, not urgency.
- **Status:** ⏳ PENDING — on closer inspection the existing URL already includes `&display=swap`, which is the main mitigation for render-blocking; likely to be documented as intentionally not further changed (see end of report).

---

## Notes on Scope and What Was NOT Found

- **No MongoDB instance was available** in this environment, so behaviors that only manifest against a live database under real data/load (e.g., confirming the exact timing of the D1 race condition, or exact Mongoose error shapes) are based on careful code reading rather than live reproduction. Everything else (build, install, lint, server boot, `npm audit`) was executed and observed directly. *(Update: an in-memory MongoDB instance was subsequently used during the fix pass to verify DB-dependent changes — see individual Status notes.)*
- **No broken imports, no build-tool configuration errors, and no missing *runtime* dependencies were found** beyond the one dev-tooling gap (`nodemon`). The application's actual production dependency graph is sound.
- This report intentionally does not repeat items already covered in earlier project documentation ([PROJECT_UNDERSTANDING.md](PROJECT_UNDERSTANDING.md), [WORKFLOW.md](WORKFLOW.md)) except where directly relevant to a specific bug (e.g., referencing the request flow to explain why a race condition matters).
