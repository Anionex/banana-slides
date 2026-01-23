# Deployment Guide - Banana Slides

This guide covers deploying Banana Slides to various platforms.

## Table of Contents
- [Quick Comparison](#quick-comparison)
- [Fly.io Deployment](#flyio-deployment-recommended-for-performance)
- [Render.com Deployment](#rendercom-deployment-simplest)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Comparison

| Platform | Cold Start | Setup Time | Credit Card | Best For |
|----------|------------|------------|-------------|----------|
| **Fly.io** | None | ~15 min | Required (verify only) | Production |
| **Render** | ~50s | ~5 min | Not required | Testing/Demo |

---

## Fly.io Deployment (Recommended for Performance)

### Prerequisites
- GitHub account with repo access
- Fly.io account (credit card required for verification, still free)
- Google API Key for Gemini (paid tier for image generation)

### Step 1: Install Fly CLI

**Windows (PowerShell):**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login to Fly.io
```bash
fly auth login
```

### Step 3: Deploy Backend

```bash
# Navigate to project root
cd banana-slides

# Launch backend app (first time only)
fly launch --config backend/fly.toml --no-deploy --name banana-slides-api

# Create persistent volume for SQLite database
fly volumes create banana_data --size 1 --region sin --app banana-slides-api

# Set secrets (REQUIRED)
fly secrets set GOOGLE_API_KEY=your-gemini-api-key --app banana-slides-api

# Optional: Set additional secrets
fly secrets set BAIDU_OCR_API_KEY=your-baidu-key --app banana-slides-api

# Deploy backend
fly deploy --config backend/fly.toml --app banana-slides-api
```

### Step 4: Deploy Frontend

```bash
# Update frontend fly.toml with your backend URL (already configured by default)
# VITE_API_BASE_URL = "https://banana-slides-api.fly.dev"

# Launch frontend app (first time only)
fly launch --config frontend/fly.toml --no-deploy --name banana-slides-web

# Deploy frontend
fly deploy --config frontend/fly.toml --app banana-slides-web
```

### Step 5: Verify Deployment

```bash
# Check backend health
curl https://banana-slides-api.fly.dev/health

# Check app status
fly status --app banana-slides-api
fly status --app banana-slides-web
```

**URLs after deployment:**
- Backend: `https://banana-slides-api.fly.dev`
- Frontend: `https://banana-slides-web.fly.dev`

### Step 6: View Logs

```bash
# Backend logs
fly logs --app banana-slides-api

# Frontend logs
fly logs --app banana-slides-web
```

### Updating Deployment

```bash
# Pull latest code
git pull origin main

# Redeploy backend
fly deploy --config backend/fly.toml --app banana-slides-api

# Redeploy frontend
fly deploy --config frontend/fly.toml --app banana-slides-web
```

### Fly.io Free Tier
- 3 shared-cpu-1x VMs with 256MB RAM
- 3GB persistent storage
- 160GB outbound bandwidth/month
- No cold starts (VMs stay running)

---

## Render.com Deployment (Simplest)

### Prerequisites
- GitHub account with repo access
- Render.com account (free tier available)
- Google API Key for Gemini

### One-Click Deploy with Blueprint

1. **Connect Repository**
   - Go to [render.com](https://render.com) → Dashboard
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select `render.yaml` file

2. **Configure Secrets**
   After blueprint deploys, set `GOOGLE_API_KEY`:
   - Go to banana-slides-backend service
   - Settings → Environment → Add `GOOGLE_API_KEY`

3. **Verify Deployment**
   - Backend: `https://banana-slides-backend.onrender.com/health`
   - Frontend: `https://banana-slides-frontend.onrender.com`

### Manual Deployment Steps

#### Backend Service

1. **Create Web Service**
   - "New" → "Web Service"
   - Connect repository
   - Configure:
     ```
     Name: banana-slides-backend
     Root Directory: (leave empty - uses repo root)
     Runtime: Docker
     Dockerfile Path: ./backend/Dockerfile
     Instance Type: Free
     ```

2. **Environment Variables**
   ```
   PORT=5000
   AI_PROVIDER_FORMAT=gemini
   TEXT_MODEL=gemini-2.0-flash
   IMAGE_MODEL=gemini-2.0-flash-preview-image-generation
   OUTPUT_LANGUAGE=vi
   GOOGLE_API_KEY=<your-api-key>
   CORS_ORIGINS=https://banana-slides-frontend.onrender.com
   ```

3. **Add Persistent Disk**
   - Settings → Disks → Add Disk
   - Mount Path: `/app/backend/instance`
   - Size: 1GB

#### Frontend Static Site

1. **Create Static Site**
   - "New" → "Static Site"
   - Connect same repository
   - Configure:
     ```
     Name: banana-slides-frontend
     Root Directory: (leave empty)
     Build Command: cd frontend && npm install && npm run build
     Publish Directory: ./frontend/dist
     ```

2. **Environment Variables**
   ```
   VITE_API_BASE_URL=https://banana-slides-backend.onrender.com
   ```

3. **Redirect Rules** (for SPA routing)
   - Add rewrite rule: `/*` → `/index.html`

### Render Free Tier Limitations
- Services spin down after 15 min inactivity
- ~50 seconds cold start time
- 750 hours/month (enough for 1 always-on service)
- 100GB bandwidth/month

---

## Environment Variables Reference

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | Yes | - | Gemini API key |
| `AI_PROVIDER_FORMAT` | No | gemini | AI provider format |
| `TEXT_MODEL` | No | gemini-2.0-flash | Text generation model |
| `IMAGE_MODEL` | No | gemini-2.0-flash-preview-image-generation | Image generation model |
| `OUTPUT_LANGUAGE` | No | vi | Output language |
| `PORT` | No | 5000 | Server port |
| `CORS_ORIGINS` | No | * | Allowed CORS origins |
| `BAIDU_OCR_API_KEY` | No | - | For editable PPTX export |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | Yes | - | Backend API URL |

---

## Troubleshooting

### Build Failures
- Check Dockerfile paths are correct
- Ensure `pyproject.toml` is in repo root
- Verify npm dependencies install correctly

### CORS Errors
- Update `CORS_ORIGINS` to match frontend URL
- Ensure protocol (https) matches

### API Connection Issues
- Verify `VITE_API_BASE_URL` points to backend
- Check backend health endpoint responds
- Review backend logs for errors

### Disk Storage
- SQLite database stored at `/app/backend/instance`
- Uploads stored at `/app/uploads`
- Ensure disk/volume is mounted correctly

### Fly.io Specific
```bash
# SSH into container for debugging
fly ssh console --app banana-slides-api

# Check volume mount
fly volumes list --app banana-slides-api

# Restart app
fly apps restart banana-slides-api
```

### Render Specific
- Check Render dashboard for build logs
- Verify disk is attached in Settings
