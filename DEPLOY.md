# Deploying Karmamitra (free tier)

End-to-end guide for running the whole stack without paying anything.

## Architecture

| Piece | Host | Free-tier behavior |
|---|---|---|
| API (Express) | Render **Web Service** `karmamitra-api` | sleeps after ~15 min idle |
| Web (Vite React) | Render **Static Site** `karmamitra-web` | never sleeps |
| Database | MongoDB **Atlas M0** | 512 MB storage |
| Mobile | **Expo EAS Build** → Android APK | limited free builds/month |

Both Render resources are declared in [`render.yaml`](render.yaml) at the repo
root (a Render *Blueprint*), so they deploy together in one flow.

Expected URLs (Render derives them from the service names):

- API: `https://karmamitra-api.onrender.com`
- Web: `https://karmamitra-web.onrender.com`

> If Render assigns a different subdomain (name already taken), update
> `CLIENT_ORIGINS` on the API and `VITE_API_URL` on the static site, then
> redeploy both — see [Troubleshooting](#troubleshooting).

## 1. Push to GitHub

The repo already has `origin` → `https://github.com/sreerakshaksamala13/karmamitra.git`:

```bash
git push origin main
```

## 2. Create the MongoDB Atlas database (one-time)

1. https://cloud.mongodb.com → **Build a Database** → **M0 (Free)** → pick a region.
2. **Database Access** → **Add New Database User** → username/password → role `readWriteAnyDatabase`.
3. **Network Access** → **Add IP Address** → `0.0.0.0/0`
   (Render's outbound IPs aren't fixed on the free plan; open access is the
   standard free-tier trade-off — use a strong password.)
4. **Connect** → **Drivers** → Node → copy the connection string and append
   the database name:

```
mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/karmamitra?retryWrites=true&w=majority
```

Keep this string — Render prompts for it next.

## 3. Deploy both Render services (one-time)

1. https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect GitHub → select the `karmamitra` repo. Render reads `render.yaml`
   and shows both services.
3. When prompted, fill in:
   - **MONGO_URI** — the Atlas string from step 2
   - **JWT_SECRET** — a long random string, e.g. `openssl rand -hex 32`
4. Click **Apply / Create Blueprint** and wait for both builds.

## 4. Verify

```bash
curl https://karmamitra-api.onrender.com/api/health
# -> {"status":"ok","time":"..."}
```

Open `https://karmamitra-web.onrender.com`, register, log in, create a worker.
In DevTools → Network you should see requests going to
`https://karmamitra-api.onrender.com/api/...`.

> **Cold starts:** the free API sleeps after ~15 min without traffic; the first
> request after idle takes 30–60 s. Render's health check pings
> `/api/health`, which periodically wakes it. Static sites never sleep.

## 5. Seed demo data (optional)

```bash
# create server/.env (gitignored) containing:
#   MONGO_URI=mongodb+srv://.../karmamitra?retryWrites=true&w=majority
#   JWT_SECRET=...
npm run seed
```

## 6. Mobile app (Expo EAS)

`mobile/eas.json` bakes `EXPO_PUBLIC_API_URL` into the `preview` and
`production` build profiles (it's a build-time variable — the URL is inlined
into the JS bundle).

```bash
cd mobile
npx eas-cli login          # once per machine
npm run build:apk          # = eas build -p android --profile preview
```

When the build finishes, EAS emails a link to the **APK** — sideload it on any
Android device (also available at https://expo.dev under your account → Builds).

Notes:

- Free EAS quota allows a limited number of cloud builds/month. If you run out,
  build locally instead: `npx eas build -p android --profile preview --local`
  (requires Android SDK/NDK installed).
- The `production` profile builds an `.aab` for Google Play submission.

## 7. How the pieces fit together

```
Browser ──► karmamitra-web.onrender.com (static HTML/JS)
                │
                └─ axios ──► karmamitra-api.onrender.com/api/... ──► Atlas
                                ▲
Phone app (EAS APK) ────────────┘   (EXPO_PUBLIC_API_URL)
```

- The web bundle is built with
  `VITE_API_URL=https://karmamitra-api.onrender.com/api` (set in `render.yaml`),
  so it calls the API cross-origin.
- The API allows that exact origin via `CLIENT_ORIGINS` (CORS).
- `render.yaml` installs an SPA rewrite (`/* → /index.html`) so deep links like
  `/login` survive a hard refresh.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Web app loads, every request fails with a CORS error | `CLIENT_ORIGINS` on the API must be exactly `https://<web-subdomain>` (no trailing slash). Update the env var → **Manual Deploy → Clear build cache & deploy**. |
| Refreshing `/login` returns 404 | SPA rewrite missing — Dashboard → *karmamitra-web* → **Routes** should show `/* → /index.html` (declared in `render.yaml`). |
| API health check fails / won't start | Dashboard → *karmamitra-api* → **Logs**. Usual causes: malformed `MONGO_URI` (must include the `/karmamitra` DB name) or Atlas **Network Access** not allowing `0.0.0.0/0`. |
| Changing `VITE_API_URL` has no effect | It's **build-time** — trigger a redeploy of the static site after changing it. |
| Edited `render.yaml` but nothing changed | Blueprint files apply when the repo is connected. For day-to-day changes, edit env vars in the Render Dashboard directly. |
| First load after idle is slow | Expected free-plan behavior (see cold starts above). |

## Costs

Everything above runs on free tiers: Render free web service + static site,
MongoDB Atlas M0, Expo EAS free plan. Free tiers change over time — check each
provider's pricing page if something in this doc goes stale.

