# Smart Parking Availability System
**BCA Final Year Project** — Real-time parking slot visualization for shopping malls

---

## Features
- 🚗 **Drivers** — View all floors + available/occupied counts. No login required.
- 📍 **Floor Layout** — Color-coded slot grid (green = available, red = occupied).
- ⚡ **Real-time** — Slot updates pushed instantly via Socket.IO to all viewers.
- 🔐 **Security Staff** — Login, view assigned floor, toggle slot status with one tap.
- 🛠️ **Admin Dashboard** — Manage floors, staff, view occupancy statistics.

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router v7 |
| State | React Context + custom hooks |
| HTTP | Axios |
| Real-time | Socket.IO (client) |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (httpOnly cookies) + bcryptjs |
| Real-time | Socket.IO (server) |

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas)

### 1. Clone & Install
```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure Environment
```bash
cd server
cp .env.example .env
# Edit .env and set your MONGODB_URI
```

**.env fields:**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_parking
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Seed the Database
```bash
cd server
node utils/seed.js
```
This creates 3 floors and demo login credentials.

### 4. Run the Application
```bash
# Terminal 1 — Backend
cd server && node index.js

# Terminal 2 — Frontend
cd client && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Demo Credentials

| Role | Username | Password | Access |
|---|---|---|---|
| Admin | `admin` | `admin123` | Full access |
| Security | `security_g` | `security123` | Ground Floor |
| Security | `security_b1` | `security123` | -1 Floor |
| Security | `security_b2` | `security123` | -2 Floor |

---

## Project Structure
```
smart-parking/
├── client/                     # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── common/         # Navbar, ProtectedRoute, Modal, ConfirmDialog
│       │   └── driver/         # FloorCard, SlotGrid
│       ├── context/            # AuthContext (global auth state)
│       ├── hooks/              # useFloor, useFloors (with Socket.IO)
│       ├── pages/
│       │   ├── driver/         # HomePage, FloorDetailPage
│       │   ├── security/       # SecurityDashboard
│       │   ├── admin/          # AdminLayout, AdminOverview, AdminFloors, AdminStaff
│       │   └── LoginPage.jsx
│       ├── services/           # api.js (Axios), socket.js (Socket.IO)
│       └── styles/             # globals.css (design tokens)
│
└── server/                     # Node.js + Express backend
    ├── config/                 # db.js (MongoDB connection)
    ├── controllers/            # auth, floor, staff, stats
    ├── middleware/             # auth.js (JWT), errorHandler.js
    ├── models/                 # User.js, Floor.js (with embedded slots)
    ├── routes/                 # auth, floors, staff, stats
    ├── socket/                 # socketHandler.js (Socket.IO rooms)
    └── utils/                  # seed.js (database seeder)
```

---

## API Endpoints

### Public (no auth)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/floors` | All active floors summary |
| GET | `/api/floors/:id` | Floor detail with slots |

### Security + Admin
| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/api/floors/:floorId/slots/:slotId` | Update slot status |

### Admin Only
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/floors` | Create floor |
| PUT | `/api/floors/:id` | Update floor |
| DELETE | `/api/floors/:id` | Deactivate floor |
| GET/POST | `/api/staff` | List / create staff |
| PUT/DELETE | `/api/staff/:id` | Update / deactivate staff |
| GET | `/api/stats` | Occupancy statistics |

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (sets httpOnly cookie) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |

---

## Socket.IO Events

| Event | Direction | Payload |
|---|---|---|
| `join_floor` | Client → Server | `floorId` |
| `leave_floor` | Client → Server | `floorId` |
| `slot_updated` | Server → Client (floor room) | `{ floorId, slotId, status, updatedAt }` |
| `floor_summary_updated` | Server → All clients | `{ floorId, availableCount, occupiedCount }` |
