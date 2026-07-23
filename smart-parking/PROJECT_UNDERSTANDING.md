# Project Understanding — Smart Parking Availability System

> Generated from a full read-through of every folder and file in the repo. No code was modified.

---

## 1. What This Project Does

A **real-time parking-slot visualization system** for a shopping mall (built as a BCA final-year project). It serves three distinct audiences from one app:

- **Drivers** (public, no login): see every parking floor, how many slots are available/occupied, and drill into a floor to see the live color-coded slot grid.
- **Security staff** (logged in): see only their assigned floor and tap a slot to toggle it between `available` and `occupied`.
- **Admins** (logged in): manage floors (create/edit/deactivate), manage security staff accounts, and view occupancy statistics across the whole facility.

The core value proposition is **real-time sync**: when a security guard taps a slot, every driver currently viewing that floor (or the homepage) sees the count/color change instantly, without refreshing — powered by Socket.IO.

---

## 2. Overall Architecture

Classic **decoupled client-server** web app, monorepo-style with two independent packages:

```
smart-parking/
├── client/   → React 19 SPA (Vite), talks to server over REST + WebSocket
└── server/   → Node.js/Express REST API + Socket.IO server, backed by MongoDB
```

- **Communication**: the client calls the server's REST API (Axios, `withCredentials: true` for cookie-based auth) for all reads/writes, and maintains a persistent Socket.IO connection for live push updates.
- **State authority**: MongoDB is the single source of truth. The server is the only thing that mutates data; it then broadcasts the change over Socket.IO so all connected clients patch their local state.
- **Auth model**: stateless JWT, delivered as an `httpOnly` cookie (with a token also returned in the body for non-browser/mobile clients). The server re-verifies the JWT on every protected request — there's no server-side session store.
- **Deployment shape**: two independently run Node processes in dev — `server` (port 5000) and `client` (Vite dev server, port 5173) — connected via `CLIENT_URL` / `VITE_API_URL` / `VITE_SOCKET_URL` env vars for CORS and endpoint discovery.

---

## 3. Folder Structure & Purpose

### Root (`smart-parking/`)
| Path | Purpose |
|---|---|
| [package.json](package.json) | Convenience scripts only (`install:all`, `seed`, `server`, `client`) — root itself has no dependencies or code. |
| [README.md](README.md) | Setup guide, feature list, API/socket reference, demo credentials. |

### `client/` — React + Vite frontend
| Path | Purpose |
|---|---|
| [src/main.jsx](client/src/main.jsx) | React DOM entry point, mounts `<App />`. |
| [src/App.jsx](client/src/App.jsx) | Route table (React Router v7) — defines all pages and which are protected/role-gated. |
| `src/context/` | [AuthContext.jsx](client/src/context/AuthContext.jsx) — global auth state (current user, login/logout, role flags), fetched via `/api/auth/me` on mount. |
| `src/hooks/` | [useFloor.js](client/src/hooks/useFloor.js) (single floor + its socket room), [useFloors.js](client/src/hooks/useFloors.js) (all-floors summary + socket summary updates) — data-fetching hooks that also own Socket.IO subscriptions. |
| `src/components/common/` | Cross-cutting UI: [Navbar.jsx](client/src/components/common/Navbar.jsx), [ProtectedRoute.jsx](client/src/components/common/ProtectedRoute.jsx) (route guard by auth+role), [Modal.jsx](client/src/components/common/Modal.jsx), [ConfirmDialog.jsx](client/src/components/common/ConfirmDialog.jsx). |
| `src/components/driver/` | [FloorCard.jsx](client/src/components/driver/FloorCard.jsx) (homepage summary card), [SlotGrid.jsx](client/src/components/driver/SlotGrid.jsx) (renders slots grouped by row; reused by both driver view (read-only) and security view (interactive)). |
| `src/pages/` | One folder per audience: `driver/` (HomePage, FloorDetailPage — public), `security/` (SecurityDashboard), `admin/` (AdminLayout + Overview/Floors/Staff), plus root-level `LoginPage.jsx`. |
| `src/services/` | [api.js](client/src/services/api.js) — Axios instance with a base URL and a global 401 interceptor; [socket.js](client/src/services/socket.js) — single shared Socket.IO client instance (manual `autoConnect: false`). |
| `src/styles/globals.css` | Design tokens/utility classes shared across the app (buttons, cards, badges, spinners, etc.). |
| `.env` | `VITE_API_URL`, `VITE_SOCKET_URL` — where the frontend finds the backend. |
| `vite.config.js` | Minimal Vite config with the React plugin. |

### `server/` — Node.js + Express backend
| Path | Purpose |
|---|---|
| [index.js](server/index.js) | **Application entry point.** Boots Express, HTTP server, Socket.IO, MongoDB connection, mounts all routes and middleware. |
| `config/db.js` | [db.js](server/config/db.js) — Mongoose connection to MongoDB using `MONGODB_URI`. |
| `models/` | [Floor.js](server/models/Floor.js) (floor + embedded slot subdocuments, virtuals for counts), [User.js](server/models/User.js) (admin/security accounts, password hashing). |
| `controllers/` | Business logic per resource: [authController.js](server/controllers/authController.js), [floorController.js](server/controllers/floorController.js), [staffController.js](server/controllers/staffController.js), [statsController.js](server/controllers/statsController.js). |
| `routes/` | Express routers wiring URLs → controller functions with the appropriate auth/role middleware: [auth.js](server/routes/auth.js), [floors.js](server/routes/floors.js), [staff.js](server/routes/staff.js), [stats.js](server/routes/stats.js). |
| `middleware/` | [auth.js](server/middleware/auth.js) — `protect` (JWT verification) and `restrictTo` (role gate); [errorHandler.js](server/middleware/errorHandler.js) — centralized error formatting (Mongoose/JWT error translation). |
| `socket/socketHandler.js` | [socketHandler.js](server/socket/socketHandler.js) — Socket.IO connection handler; manages `join_floor`/`leave_floor` room membership. |
| `utils/seed.js` | [seed.js](server/utils/seed.js) — wipes and re-seeds the DB with 3 demo floors + 4 demo users (1 admin, 3 security). |
| `.env` / `.env.example` | Server config: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `NODE_ENV`. |

---

## 4. How the Frontend Works

- **Routing** ([App.jsx](client/src/App.jsx)): `BrowserRouter` wraps everything in `AuthProvider`. Public routes (`/`, `/floor/:id`, `/login`) render directly; `/security` and `/admin/*` are wrapped in `ProtectedRoute` with an `allowedRoles` prop. `/admin` uses nested routes (`AdminLayout` renders a sidebar + `<Outlet />` for `Overview`/`Floors`/`Staff`).
- **Auth state** ([AuthContext.jsx](client/src/context/AuthContext.jsx)): on mount, calls `GET /api/auth/me` to hydrate `user` from the existing cookie (if any). Exposes `login`/`logout`/`isAdmin`/`isSecurity`. Also listens for a custom `auth:unauthorized` window event (dispatched by the Axios interceptor on any 401) to clear user state reactively — a decoupled way for a low-level HTTP layer to talk to high-level auth state.
- **Route protection** ([ProtectedRoute.jsx](client/src/components/common/ProtectedRoute.jsx)): shows a spinner while auth is loading, redirects to `/login` (preserving `location.state.from` for post-login redirect) if unauthenticated, or to `/` if the role doesn't match.
- **Data fetching + real-time**: `useFloors` and `useFloor` both (a) fetch via REST on mount and (b) open/reuse the shared `socket` instance to listen for server-pushed events, patching React state directly rather than refetching — this is what makes updates feel instant. Sockets connect lazily (`autoConnect: false`) and only when a page needing live data mounts.
- **Slot interaction**: `SlotGrid` is a dumb, reusable component — it renders identically for drivers (read-only) and security staff (`interactive=true`, clickable, calls back to `onSlotClick`). `SecurityDashboard` owns the actual PATCH call and relies on the socket echo (not a refetch) to reflect the change, with a manual `refetch()` fallback on error.
- **Admin CRUD pages** (`AdminFloors`, `AdminStaff`) follow the same pattern: fetch list → open a shared `Modal` with a form for create/edit → `ConfirmDialog` for destructive (deactivate) actions → refetch list on success. No socket usage here — admin data isn't broadcast live, it's straightforward request/response.
- **Styling**: plain CSS files per component/page plus a shared `globals.css` for design tokens (no CSS framework/Tailwind).

---

## 5. How the Backend Works

- **Entry point** ([server/index.js](server/index.js)): loads env vars (`dotenv`), wraps Express in `express-async-errors` (so `async` route handlers throw straight into the error middleware instead of needing manual try/catch everywhere), creates a raw `http.Server` so Socket.IO can attach to the same port as Express, configures CORS (locked to `CLIENT_URL`, `credentials: true` for both Express and Socket.IO), connects to MongoDB, mounts the four route groups under `/api/*`, adds a `/api/health` check, a 404 catch-all, and the global error handler last.
- **`app.set('io', io)`** is the bridge that lets REST controllers (e.g. `floorController.updateSlotStatus`) emit Socket.IO events after a successful DB write — retrieved in controllers via `req.app.get('io')`.
- **Middleware chain**: `cors` → `express.json`/`urlencoded` → `cookieParser` → routes → 404 → `errorHandler`.
- **Auth middleware** ([middleware/auth.js](server/middleware/auth.js)): `protect` reads the JWT from the `token` httpOnly cookie (falling back to an `Authorization: Bearer` header), verifies it, loads the user (must exist and be active), and attaches `req.user`. `restrictTo(...roles)` is a factory returning middleware that 403s if `req.user.role` isn't in the allowed list — routes compose both (`protect, restrictTo('admin')`).
- **Error handling** ([middleware/errorHandler.js](server/middleware/errorHandler.js)): normalizes Mongoose duplicate-key errors (`11000`), validation errors, cast errors (bad ObjectId), and JWT errors into consistent `{ message }` JSON responses with proper status codes; includes `stack` only in development.
- **Controllers** are grouped by resource and each function maps 1:1 to a route. Notably `floorController.updateSlotStatus` is the one place where REST and Socket.IO intersect: it validates status, enforces that security staff can only touch their `assignedFloor`, mutates the embedded slot subdocument, saves, then emits both a room-scoped `slot_updated` event and a global `floor_summary_updated` event.
- **Socket handling** ([socket/socketHandler.js](server/socket/socketHandler.js)) is intentionally thin — it only manages room membership (`join_floor`/`leave_floor`); it does not itself do any DB writes. All state changes flow through the REST layer, and sockets are purely for broadcast/subscribe.

---

## 6. Database Schema & Relationships

Two Mongoose collections:

### `User` ([models/User.js](server/models/User.js))
| Field | Type | Notes |
|---|---|---|
| `name` | String | required |
| `username` | String | required, unique, lowercase, trimmed |
| `password` | String | required, min 6, `select: false` (hashed with bcrypt, 12 rounds, via `pre('save')` hook) |
| `role` | enum `admin` \| `security` | default `security` |
| `assignedFloor` | ObjectId → `Floor` | `null` for admins (implicit "access all floors"); required in practice for security to be useful |
| `isActive` | Boolean | default `true`; used for soft-delete/deactivation |
| timestamps | — | `createdAt`/`updatedAt` |

Instance method `comparePassword(candidate)` wraps `bcrypt.compare`.

### `Floor` ([models/Floor.js](server/models/Floor.js))
| Field | Type | Notes |
|---|---|---|
| `name` | String | required, unique (e.g. "Ground Floor") |
| `level` | Number | required, unique (0, -1, -2, …) |
| `totalSlots` | Number | auto-synced to `slots.length` via `pre('save')` hook — **not independently settable** |
| `slots` | Array of embedded `slotSchema` documents | see below |
| `isActive` | Boolean | default `true`; soft-delete flag |
| `displayOrder` | Number | default `0`; controls sort order in listings |
| timestamps | — | `createdAt`/`updatedAt` |

**Embedded `slotSchema`** (subdocuments of `Floor.slots`, each with its own `_id`):
| Field | Type | Notes |
|---|---|---|
| `slotNumber` | String | e.g. "A1" |
| `row` | String | e.g. "A" |
| `position` | Number | position within the row |
| `status` | enum `available` \| `occupied` | default `available` |
| `lastUpdated` | Date | default now |
| `lastUpdatedBy` | ObjectId → `User` | who last toggled it |

**Virtuals** `availableCount` / `occupiedCount` are computed on read (filtering `slots` in memory) — they are **not stored fields**, which is why the frontend recomputes these counts locally after a socket-pushed slot patch (the raw socket payload only carries the single changed slot, not a recomputed floor document).

### Relationships
- `User.assignedFloor` → `Floor._id` (many-to-one: many security users could reference one floor, though in practice it's 1:1 in the seed data).
- `Floor.slots[].lastUpdatedBy` → `User._id` (audit trail of who last changed a slot).
- Slots are **embedded**, not a separate collection — there is no independent "Slot" model; slots only exist as subdocuments of a `Floor`.

---

## 7. Authentication Flow

1. **Login**: `POST /api/auth/login` with `{ username, password }` → [authController.login](server/controllers/authController.js). Looks up `User` by username (must be `isActive`), explicitly `.select('+password')` since it's excluded by default, compares via bcrypt.
2. **Token issuance**: on success, `signToken` creates a JWT (`{ id: user._id }`, signed with `JWT_SECRET`, expiry from `JWT_EXPIRES_IN`, default `7d`). `sendTokenResponse` sets it as an `httpOnly`, `sameSite: strict` cookie named `token` (also `secure` in production), **and** returns the raw token in the JSON body (for non-browser/mobile clients that can't use cookies), plus the sanitized user object (password stripped).
3. **Session check on load**: the client's `AuthContext` calls `GET /api/auth/me` on mount; the `protect` middleware validates the cookie and returns the current user, letting the SPA "remember" login across refreshes without storing anything in localStorage.
4. **Authorization on requests**: `protect` middleware extracts the JWT (cookie first, then `Authorization: Bearer` header fallback), verifies signature/expiry, loads the user fresh from DB (catches deactivated/deleted users even with a still-valid token), attaches `req.user`.
5. **Role-based access**: `restrictTo('admin')`, `restrictTo('admin', 'security')` etc. gate specific routes/actions (e.g. only admins manage staff/floors; both admin+security can toggle slots, but a security user is further restricted in the controller to *only their assigned floor*).
6. **Logout**: `POST /api/auth/logout` clears the cookie by setting it to an empty value with an already-expired date.
7. **Client-side reactivity to expiry**: the Axios response interceptor ([services/api.js](client/src/services/api.js)) watches for any `401`, and dispatches a `window` `auth:unauthorized` CustomEvent; `AuthContext` listens for it and clears `user`, which cascades into `ProtectedRoute` redirecting to `/login`. This avoids each hook/page having to individually handle auth expiry.

---

## 8. API Request Flow (example: security guard toggles a slot)

1. **UI event**: guard taps a slot in `SlotGrid` (rendered from `SecurityDashboard`) → `handleSlotClick`.
2. **HTTP request**: `SecurityDashboard` calls `api.patch('/floors/:floorId/slots/:slotId', { status })` — Axios attaches the `token` cookie automatically (`withCredentials: true`).
3. **Middleware**: Express route `PATCH /api/floors/:floorId/slots/:slotId` ([routes/floors.js](server/routes/floors.js)) runs `protect` (must be logged in) then `restrictTo('admin', 'security')`.
4. **Controller** ([floorController.updateSlotStatus](server/controllers/floorController.js)): validates `status` is one of the allowed enum values; loads the `Floor`; if the caller is `security`, checks `req.user.assignedFloor` matches the floor in the URL (403 otherwise); finds the embedded slot subdocument by `_id`, mutates `status`/`lastUpdated`/`lastUpdatedBy`, and `floor.save()`.
5. **Persistence**: Mongoose writes the whole `Floor` document back to MongoDB (embedded slot array included).
6. **Broadcast**: controller grabs `io` off `req.app`, emits `slot_updated` to the room `floor_<floorId>` (anyone currently viewing that floor's detail page) and a global `floor_summary_updated` to all connected sockets (so the homepage's summary counts update too).
7. **HTTP response**: controller also returns the updated slot + floor summary directly in the JSON response to the caller (the guard's own browser), so their own UI updates even without relying on the socket echo.
8. **Client-side socket consumers**: `useFloor` (on the floor detail page) and `useFloors` (on the homepage) have `socket.on(...)` listeners that patch local React state in place — no refetch, no polling.
9. **Error path**: if anything fails (validation, 403, 404, DB error), `express-async-errors` routes the thrown/rejected error to `errorHandler`, which formats a consistent JSON error response; the client's `catch` block shows an `alert` and calls `refetch()` to resync.

---

## 9. How Data Moves from Frontend to Database (End-to-End)

```
User action (click/tap in React component)
   → Axios call via services/api.js (cookie auto-attached)
   → Express route (routes/*.js)
   → Middleware: protect (JWT verify) → restrictTo (role check)
   → Controller (controllers/*.js): validates input, business rules
   → Mongoose model (models/*.js): schema validation, hooks (bcrypt hash / totalSlots sync)
   → MongoDB: actual persistence
   → Controller: builds response, optionally emits Socket.IO event via req.app.get('io')
   → HTTP response → original caller's React state updates directly
   → Socket.IO broadcast → all *other* subscribed clients' hooks (useFloor/useFloors) patch state
   → React re-renders (SlotGrid, FloorCard, etc.) reflecting new data
```

Read-only data (e.g. loading the homepage) skips the write/broadcast steps: it's just Axios GET → controller query → Mongoose `.find()` → MongoDB → JSON response → `useState` in the hook → render.

---

## 10. Application Entry Points

- **Backend**: [server/index.js](server/index.js) — started via `node index.js` (or `npm run dev` with `nodemon` for auto-restart). This single file bootstraps Express, HTTP server, Socket.IO, DB connection, and all routes.
- **Frontend**: [client/src/main.jsx](client/src/main.jsx) — Vite's entry, renders `<App />` ([client/src/App.jsx](client/src/App.jsx)) into `#root` (see [client/index.html](client/index.html)). Started via `npm run dev` (Vite dev server).
- **Database seeding** (one-off, not part of normal runtime): [server/utils/seed.js](server/utils/seed.js), run via `node utils/seed.js`.
- **Root convenience**: [package.json](package.json) scripts (`server`, `client`, `seed`, `install:all`) just shell out to the above — the root itself is not "run".

---

## 11. Environment Variables Required

### `server/.env` (see [server/.env.example](server/.env.example))
| Variable | Purpose | Example / Default |
|---|---|---|
| `PORT` | Port the Express/Socket.IO server listens on | `5000` |
| `MONGODB_URI` | MongoDB connection string (local or Atlas) | `mongodb://localhost:27017/smart_parking` |
| `JWT_SECRET` | Secret used to sign/verify JWTs — **must be changed for production** | placeholder string in repo |
| `JWT_EXPIRES_IN` | JWT lifetime | `7d` |
| `CLIENT_URL` | Frontend origin, used for CORS (both Express and Socket.IO) | `http://localhost:5173` |
| `NODE_ENV` | Toggles cookie `secure` flag, error verbosity, dev logging | `development` |

### `client/.env`
| Variable | Purpose | Example / Default |
|---|---|---|
| `VITE_API_URL` | Base URL the Axios instance targets | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | URL the Socket.IO client connects to | `http://localhost:5000` |

⚠️ Both `server/.env` and `client/.env` currently exist **with real (dev) values checked into the working tree** — the `.env` files are present in the folder, not just `.env.example`. Worth confirming they're gitignored before any commit (client has a `.gitignore`; verify server's `.env` is excluded too).

---

## 12. Third-Party Libraries Used & Why

### Backend ([server/package.json](server/package.json))
| Library | Why |
|---|---|
| `express` | Core HTTP server/routing framework. |
| `express-async-errors` | Lets `async` route handlers/controllers throw naturally, forwarding to Express's error middleware instead of requiring manual try/catch in every controller. |
| `mongoose` | ODM for MongoDB — schemas, validation, virtuals, hooks (bcrypt hashing, totalSlots sync), population (`assignedFloor`, `lastUpdatedBy`). |
| `socket.io` | Real-time bidirectional events (slot/floor updates) layered over the same HTTP server. |
| `jsonwebtoken` | Signs/verifies the JWTs used for stateless auth. |
| `bcryptjs` | Password hashing (12 salt rounds) and comparison — pure-JS implementation, avoids native-binding install issues. |
| `cookie-parser` | Parses the `token` httpOnly cookie off incoming requests. |
| `cors` | Restricts cross-origin requests to `CLIENT_URL` with credentials support (needed since the frontend runs on a different port/origin in dev). |
| `dotenv` | Loads `.env` into `process.env`. |

### Frontend ([client/package.json](client/package.json))
| Library | Why |
|---|---|
| `react` / `react-dom` (v19) | UI rendering. |
| `react-router-dom` (v7) | Client-side routing, nested routes (`AdminLayout`/`Outlet`), route guarding, navigation state (`location.state.from`). |
| `axios` | HTTP client with interceptors (global 401 handling) and `withCredentials` for cookie-based auth — cleaner than raw `fetch` for this. |
| `socket.io-client` | Counterpart to the server's Socket.IO — receives `slot_updated`/`floor_summary_updated` events for live UI updates. |
| `vite` + `@vitejs/plugin-react` | Dev server/build tool with React fast-refresh. |
| `oxlint` | Fast Rust-based linter (dev-only) for basic code-quality checks. |

---

## Summary

This is a tightly-scoped, well-organized MERN-adjacent (Mongo/Express/React/Node) app with Socket.IO layered in for real-time UX. The architecture cleanly separates concerns: REST for all state mutation and initial loads, JWT cookies for stateless auth with role-based access control, and Socket.IO purely as a broadcast layer that never itself touches the database. The embedded-slots-in-floor schema design keeps floor+slot reads to a single query at the cost of the whole floor document being rewritten on every single slot toggle — a reasonable tradeoff at this scale (a handful of floors, dozens of slots each).
