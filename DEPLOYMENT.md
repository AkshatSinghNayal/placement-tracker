# Deployment Guide

Step-by-step guide to deploy OfferForge (MERN stack) to production:
- **Backend** → Render (Docker web service)
- **Frontend** → Vercel
- **Database** → MongoDB Atlas

Follow the steps in order — each one depends on values from the previous.

---

## Prerequisites

- GitHub repo pushed to `main`
- [Render](https://render.com) account (free tier works)
- [Vercel](https://vercel.com) account (free tier works)
- [MongoDB Atlas](https://cloud.mongodb.com) account (free M0 cluster works)
- Google Cloud Console project with OAuth 2.0 credentials
- [Cloudinary](https://cloudinary.com) account (free tier, for resume PDF uploads)

---

## Step 1 — Create MongoDB Atlas cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **Create a deployment** → **M0 Free**
2. Choose a region close to your Render region (e.g. AWS us-west-2 for Render Oregon)
3. Create a **Database User** (username + password — save these)
4. Under **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
5. Go to **Database** → **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<user>` and `<password>` and append the database name:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/placement_tracker?retryWrites=true&w=majority
   ```
   Save this — it's your `MONGODB_URI`.

---

## Step 2 — Deploy backend on Render

### Option A — Blueprint (recommended, uses render.yaml)

1. Render Dashboard → **New** → **Blueprint**
2. Connect your GitHub repo (`AkshatSinghNayal/placement-tracker`)
3. Render reads `render.yaml` and creates the `placement-tracker-api` service
4. In the **Environment** tab, set the `sync: false` variables:

| Key | Value |
|---|---|
| `MONGODB_URI` | Your Atlas URI from Step 1 |
| `FRONTEND_URL` | `https://your-app.vercel.app` ← placeholder, update after Step 3 |
| `BACKEND_URL` | `https://placement-tracker-api.onrender.com` ← your Render URL |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |

5. Click **Deploy** → wait for green

### Option B — Manual web service

1. Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repo, set:
   - **Root Directory**: *(leave blank — uses repo root)*
   - **Runtime**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Docker Context**: `./backend`
3. Set all env vars from the table above
4. **Health Check Path**: `/api/v1/health`
5. Deploy

---

## Step 3 — Verify the backend

```bash
curl https://placement-tracker-api.onrender.com/api/v1/health
# Expected: {"status":"ok","db":"ok"}
```

If `db` shows `"unreachable"`, the `MONGODB_URI` is wrong — check the Atlas connection string, network access rules, and database user credentials.

> **Note:** The free Render tier spins down after 15 min of inactivity. The first request after sleep takes ~30s (cold start). Upgrade to Starter ($7/mo) for always-on.

---

## Step 4 — Deploy frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Set the configuration:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (or Other)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variable:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://placement-tracker-api.onrender.com` |

5. Click **Deploy** → wait for the green checkmark
6. Copy your Vercel URL (e.g. `https://placement-tracker-xyz.vercel.app`)

---

## Step 5 — Update FRONTEND_URL on Render

1. Render Dashboard → `placement-tracker-api` → **Environment**
2. Update `FRONTEND_URL` to your exact Vercel URL:
   ```
   https://placement-tracker-xyz.vercel.app
   ```
   No trailing slash. This must match exactly — it's used for CORS and the OAuth redirect.
3. **Save Changes** → Render auto-redeploys

---

## Step 6 — Update Google OAuth authorized URIs

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth 2.0 Client ID:

**Authorized JavaScript origins** — add:
```
https://placement-tracker-xyz.vercel.app
```

**Authorized redirect URIs** — add:
```
https://placement-tracker-api.onrender.com/api/v1/auth/google/callback
```

Click **Save**. Without this step Google login returns `redirect_uri_mismatch`.

---

## Step 7 — Smoke test

```bash
BACKEND=https://placement-tracker-api.onrender.com

# Health
curl $BACKEND/api/v1/health

# Signup
curl -s -X POST $BACKEND/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"test1234","full_name":"Smoke Test"}'

# Login
TOKEN=$(curl -s -X POST $BACKEND/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"test1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Companies (seeded data)
curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND/api/v1/companies?limit=3" | python3 -m json.tool
```

Then open the Vercel URL and verify:
- [ ] Login / signup page loads
- [ ] Sign up with email/password works
- [ ] Dashboard loads (no CORS errors in devtools Network tab)
- [ ] Companies list shows 25 seeded companies
- [ ] Google login redirects correctly (if OAuth creds are set)
- [ ] `⌘K` command palette opens

---

## CORS troubleshooting

1. Open browser devtools → Network → filter XHR/Fetch
2. Check any API response for these headers:
   ```
   Access-Control-Allow-Origin: https://your-vercel-url.vercel.app
   Access-Control-Allow-Credentials: true
   ```
3. If `Access-Control-Allow-Origin` is missing or wrong → `FRONTEND_URL` on Render is incorrect
4. Check exact URL match — protocol, subdomain, no trailing slash

---

## Local development

```bash
# 1. Copy and fill env
cp backend/.env.example .env
# Minimum required: JWT_SECRET
# Optional: GOOGLE_CLIENT_ID/SECRET, CLOUDINARY_* for those features

# 2. Start everything with Docker
docker compose up --build
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# MongoDB:  mongodb://localhost:27017

# Without Docker (requires local MongoDB on port 27017):
cd backend && npm install && node src/server.js  # terminal 1
cd frontend && npm install && npm run dev        # terminal 2
```

---

## Environment variable reference

| Variable | Required | Set in | Notes |
|---|---|---|---|
| `MONGODB_URI` | Yes | Render / `.env` | Atlas URI in prod; `mongodb://mongodb:27017/placement_tracker` in Docker |
| `JWT_SECRET` | Yes | Render (auto-generated) / `.env` | Min 32 chars in prod |
| `JWT_EXPIRES_IN` | No | Render / `.env` | Default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | No | Render / `.env` | Default `7` |
| `APP_ENV` | No | Render | `prod` in production, `dev` locally |
| `PORT` | No | Render | Default `8000` |
| `FRONTEND_URL` | Yes | Render | Exact Vercel URL, no trailing slash |
| `BACKEND_URL` | Yes | Render / `.env` | Exact Render URL, no trailing slash |
| `GOOGLE_CLIENT_ID` | OAuth only | Render / `.env` | Leave empty to disable Google login |
| `GOOGLE_CLIENT_SECRET` | OAuth only | Render / `.env` | |
| `CLOUDINARY_CLOUD_NAME` | Uploads only | Render / `.env` | Leave empty — PDFs stored in MongoDB binary locally |
| `CLOUDINARY_API_KEY` | Uploads only | Render / `.env` | |
| `CLOUDINARY_API_SECRET` | Uploads only | Render / `.env` | |
| `VITE_API_URL` | Yes (Vercel) | Vercel env vars | Baked in at build time; set to your Render URL |
