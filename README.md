# 🎉 EventVault — Event Scheduling & Volunteer Sign-up App

A full-stack web application for managing events, volunteer sign-ups, and participation tracking.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Server runs at: http://localhost:3000
```

## 🔐 Admin Credentials
Admin credentials are managed via environment variables in your `.env` file. 

- **URL**: `http://localhost:3000/admin`
- **Default (if not set)**: `admin` / `ViratAbd$&1718`

See `.env` for:
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`
- `ADMIN_USERNAME` (for secondary login)
- `ADMIN_PASSWORD`

## 📋 Features

### Organizer Panel (`/admin`)
- ✅ Secure JWT login authentication
- ✅ Create/edit/delete events with full details
- ✅ Define volunteer roles with fixed slot counts
- ✅ View all registrations in table format
- ✅ Export registrations to CSV
- ✅ Check-in volunteers and mark no-shows
- ✅ Approve shift swap requests
- ✅ Analytics dashboard (volunteer coverage %, no-shows, hours)
- ✅ Top volunteers leaderboard
- ✅ Generate participation certificates (opens printable page)

### Volunteer & Participant Panel (`/`)
- ✅ Browse all events with category filters
- ✅ Sign up as volunteer (choose role) or participant
- ✅ Real-time slot availability display
- ✅ View and manage personal registrations by email
- ✅ Cancel registrations
- ✅ Request shift swaps (notifies organizer)

### Notifications
- ✅ Email confirmation on registration
- ✅ Broadcast messages to registered users

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | NeDB (embedded, file-based) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Scheduling | node-cron |
| CSV Export | csv-stringify |
| Frontend | Vanilla HTML/CSS/JS |

## 📁 Project Structure

```
event-app/
├── server.js              # Express server entry point
├── routes/
│   ├── auth.js            # Login/verify endpoints
│   ├── events.js          # Event CRUD + CSV
│   ├── registrations.js   # Sign-up, cancel, swap, check-in
│   └── analytics.js       # Dashboard stats
├── middleware/
│   └── auth.js            # JWT middleware
├── utils/
│   ├── database.js        # NeDB setup + helpers
│   ├── email.js           # Email service
│   └── reminders.js       # Scheduled reminder logic
├── public/
│   ├── index.html         # Volunteer & Participant Panel
│   ├── admin.html         # Organizer Dashboard
├── data/                  # NeDB database files (auto-created)
└── .env                   # Environment variables
```

## 🌐 API Endpoints

### Auth
- `POST /api/auth/login` — Admin login
- `GET /api/auth/verify` — Verify JWT token

### Events
- `GET /api/events` — List all events (public)
- `GET /api/events/:id` — Get single event (public)
- `POST /api/events` — Create event (admin)
- `PUT /api/events/:id` — Update event (admin)
- `DELETE /api/events/:id` — Delete event (admin)
- `GET /api/events/:id/registrations` — Get event registrations (admin)
- `GET /api/events/:id/registrations/csv` — Export CSV (admin)

### Registrations
- `POST /api/registrations` — Sign up
- `GET /api/registrations/my?email=` — My registrations
- `GET /api/registrations/all` — All registrations (admin)
- `PATCH /api/registrations/:id/cancel` — Cancel
- `PATCH /api/registrations/:id/swap-request` — Request swap
- `PATCH /api/registrations/:id/swap-approve` — Approve swap (admin)
- `PATCH /api/registrations/:id/checkin` — Check-in (admin)
- `PATCH /api/registrations/:id/noshow` — Mark no-show (admin)
- `GET /api/registrations/swap-requests` — Pending swaps (admin)

### Analytics
- `GET /api/analytics/overview` — Dashboard stats (admin)
- `GET /api/analytics/events` — Per-event stats (admin)
- `GET /api/analytics/top-volunteers` — Top volunteers (admin)
