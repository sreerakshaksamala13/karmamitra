# Karmamitra

A workforce management platform for a manpower-supply business (house
construction). It stores worker details, records **daily attendance**, tracks
**daily wages**, and manages **weekly (Wednesday) payments** — with the ability
to update payment information at any time.

It is a **MERN** stack project with three parts:

| Part     | Folder    | Tech                                | Runs on                 |
| -------- | --------- | ----------------------------------- | ----------------------- |
| API      | `server/` | Node + Express + MongoDB (Mongoose) | http://localhost:5005   |
| Web app  | `web/`    | React + Vite                        | http://localhost:5173   |
| Android  | `mobile/` | Expo (React Native)                 | Phone via Expo Go / APK |

---

## 1. What the app does

- **Workers** – name, role (Mason, Helper, …), daily wage, phone, site, ID, notes. Add / edit / deactivate / delete.
- **Sites** – construction sites with client name and the rate billed to the client.
- **Daily attendance** – open *Attendance*, pick the date, mark each worker **Present / Half day / Absent**, then Save. Wage for the day is computed automatically.
- **Payments (Wednesday)** – open *Payments → To pay*. It shows exactly how much is owed to every worker (all unpaid days). Tap **Pay**, adjust deduction/bonus/method, and record it.
- **Update payments** – *Payments → History* lets you **edit** any payment (deduction, bonus, method, status, notes, date) or **reverse** it (which releases those days back to "owed").
- **Reports** – attendance and wage totals per worker for any date range.
- **Accounts** – sign up or log in. Each account sees and manages only its own workers, sites, attendance, and payments.
- New workers default to the **Mason** role; you can change it while adding or editing.

### How the Wednesday payout works (important)

Every attendance row stores the money the worker earned that day (`wageAmount`).

> **Amount owed to a worker = sum of `wageAmount` for days not yet linked to a payment.**

When you record a payment, those days get linked to it, so **the same day can
never be paid twice**. Reversing a payment unlinks them, and they become owed
again. The "week" is simply *all unpaid days up to the pay date* — so it works
even if you skip a Wednesday or pay late.

---

## 2. Prerequisites

- **Node.js 20.19.4+ or 22.13.0+** and npm (required by the mobile Expo SDK 57 toolchain)
- **Docker** (for the local MongoDB) — or a MongoDB connection string of your own
- For the Android app: the **Expo Go** app on your phone (free, Play Store)

> macOS note: this project uses port **5005** for the API because macOS reserves
> port 5000 for AirPlay. Change `PORT` in `server/.env` if you prefer another port.

---

## 3. Setup (first time)

```bash
# 1. Install every part's dependencies
npm run install:all

# 2. Start MongoDB in Docker
npm run db:up

# 3. Create the env file and optionally load demo data
cp server/.env.example server/.env
npm run seed
```

`npm run seed` clears the database, including all accounts and business data,
then creates demo data and prints its login. Skip it to start with an empty
database and create your own account.

```
phone: 9999999999   password: admin123
```

---

## 4. Running it

Open three terminals (or run the pieces you need):

```bash
# Terminal 1 – API
npm run server            # http://localhost:5005

# Terminal 2 – Web dashboard
npm run web               # http://localhost:5173

# Terminal 3 – Android app (Expo)
npm run mobile            # then scan the QR code with Expo Go
```

The Expo app automatically discovers your computer's LAN IP, so the phone talks
to the API on `http://<your-ip>:5005` with no configuration. Make sure the phone
and the computer are on the **same Wi-Fi**.

---

## 5. Using the API directly

```
GET    /api/health
POST   /api/auth/register         { name, phone, password }   # creates an isolated account
POST   /api/auth/login            { phone, password } -> { token }
GET    /api/auth/me

GET    /api/dashboard?date=YYYY-MM-DD

GET    /api/workers               ?search=&active=&site=
POST   /api/workers               { name, role, dailyWage, phone, site, ... } # role defaults to Mason
PUT    /api/workers/:id
PATCH  /api/workers/:id/status    { active: false }
DELETE /api/workers/:id           ?force=true to also delete records

GET    /api/sites   POST /api/sites   PUT /api/sites/:id   DELETE /api/sites/:id

GET    /api/attendance/sheet?date=&site=       # daily marking sheet
GET    /api/attendance/summary?from=&to=&site= # report totals
POST   /api/attendance                         # one worker
POST   /api/attendance/bulk                    { date, entries:[{worker,status,wageRate}] }
DELETE /api/attendance/:id

GET    /api/payments/dues?to=&site=            # what is owed (Wednesday list)
GET    /api/payments                           # history
POST   /api/payments                           { worker, toDate, deduction, bonus, method, status, notes }
PUT    /api/payments/:id                       # update payment info
DELETE /api/payments/:id                       # reverse a payment
```

Registration is available whenever you need to create a separate account. Each
account's records are isolated from other accounts; the demo seed account
continues to manage the seeded demo records.

All routes except `/api/health` and `/api/auth/*` require an
`Authorization: Bearer <token>` header.

---

## 6. Building the Android APK

No Android SDK is needed — Expo builds in the cloud.

```bash
npm install -g eas-cli                   # once
cd mobile
eas login
eas build -p android --profile preview   # produces an installable APK
```

`mobile/eas.json` defines the `preview` profile as an APK. For the Play Store
use `--profile production` (Android App Bundle).

You can also just run it instantly in **Expo Go** with `npm run mobile`.

---

## 7. Project structure

```
karmamitra/
├── server/                     # Express API
│   └── src/
│       ├── models/             # User, Site, Worker, Attendance, Payment
│       ├── controllers/        # business logic
│       ├── routes/             # /api/* endpoints
│       ├── middleware/         # auth (JWT), error handling
│       ├── app.js  index.js    # express app + bootstrap
│       └── seed.js             # demo data
├── web/                        # React (Vite) dashboard
│   └── src/
│       ├── pages/              # Login, Dashboard, Attendance, Payments, Workers, Sites, Reports
│       ├── components/         # Layout, Modal, PaymentModal, WorkerModal, ...
│       ├── context/            # AuthContext
│       └── api/client.js       # axios + token
├── mobile/                     # Expo (React Native) Android app
│   ├── App.js                  # navigation (tabs + login)
│   └── src/
│       ├── screens/            # Login, Dashboard, Attendance, Payments, Workers, Sites, Reports
│       ├── components/         # UI kit, PaymentModal, WorkerModal
│       └── api/client.js       # axios + token (AsyncStorage)
├── docker-compose.yml          # local MongoDB
└── package.json                # convenience scripts
```

---

## 8. Configuration

`server/.env`

```
PORT=5005
MONGO_URI=mongodb://127.0.0.1:27017/karmamitra
JWT_SECRET=change-me-to-a-long-random-secret
JWT_EXPIRES_IN=30d
CLIENT_ORIGINS=http://localhost:5173
```

- **Deploying?** Set `MONGO_URI` to your MongoDB Atlas URI, set a strong
  `JWT_SECRET`, and add your web URL to `CLIENT_ORIGINS`.
- **Mobile API URL** is auto-detected in development. For a published app, set
  `expo.extra.apiUrl` in `mobile/app.json` (e.g. `https://api.example.com/api`).

---

## 9. Assumptions made (change if needed)

1. Each account must log in and can access only its own business records.
2. A day's wage = `dailyWage × (Present 1 / Half day 0.5 / Absent 0)`.
3. The pay week is *"everything unpaid up to the pay date"* — no fixed
   Thursday→Wednesday boundary, so late payments still work correctly.
4. One attendance record per worker per day.
