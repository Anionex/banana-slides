# Deployment Guide - Banana Slides

This guide covers deploying Banana Slides to Render.com (recommended for simplicity).

## Quick Deploy with Render Blueprint

### Prerequisites
- GitHub account with repo access
- Render.com account (free tier available)
- Google API Key for Gemini

### One-Click Deploy

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

---

## Manual Deployment Steps

### Backend Service

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

### Frontend Static Site

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
- Ensure disk is mounted correctly

---

## Free Tier Limitations

Render free tier has:
- Services spin down after 15 min inactivity
- ~50 seconds cold start time
- 750 hours/month (enough for 1 always-on service)
- 100GB bandwidth/month

For production, consider upgrading to Starter plan ($7/month).
