**Overview**
- **Backend API (Render)**: Express server serving `/` and `/api/alerts[/:id]`.
- **Frontend (Vercel/Next.js)**: SSR pages read API via `NEXT_PUBLIC_API_BASE`.
- **Search + Risk Colors**: Dashboard supports search and consistent risk badges.
- **Detail Pages (SSR)**: `/alert/[id]` rendered server-side and shows graphs.
- **Keep-Alive (optional)**: Small ping script to prevent API idling.

**Production**
- **Frontend URL**: https://fraudshield.vercel.app/
- **API URL**: https://fraudshield-demo.onrender.com
- In Vercel, set `NEXT_PUBLIC_API_BASE` to the Render API URL.

**Local Dev**
- **Prereqs**: Node 18+, Python 3 (for generating example images).
- **Install**: `npm ci`
- **Run API**: `npm run start:api` (listens on `http://localhost:4000`)
- **Run Web (dev)**: `npm run dev` (Next dev on `http://localhost:3000`)
- **Run Web (prod mode)**:
  - Build: `npm run build`
  - Start: `npm run start:web`
- **Images**: Generate demo graphs once: `python generate_images.py` (outputs to `frontend/public`).

**API Endpoints**
- `/`: Health check, returns `OK`.
- `/api/alerts`: Returns all alerts as JSON.
- `/api/alerts/:id`: Returns a single alert by ID.

**Environment**
- `NEXT_PUBLIC_API_BASE`: Base URL of the API (e.g. `https://fraudshield-api.onrender.com`).
- Optional `KEEPALIVE_URL`: If set, `npm run ping` pings this URL; otherwise falls back to `NEXT_PUBLIC_API_BASE`.

**Deployment**
- **Render (API)**: `render.yaml` defines service `fraudshield-api` with `start: node backend/server.js`.
- **Vercel (Web)**: Deploy `frontend` as a Next.js app; set `NEXT_PUBLIC_API_BASE` env var to the Render API URL.
- Optional: `render.yaml` includes a `fraudshield-web` service using `npm run start:web` if you also choose to host the web on Render.

**Keep-Alive (optional)**
- Start ping locally or as a lightweight worker: `npm run ping` (uses `KEEPALIVE_URL` or `NEXT_PUBLIC_API_BASE`).
- Production API keep-alive: `npm run ping:prod` (pings Render at https://fraudshield-demo.onrender.com every ~14 minutes).

**Déploiement live (FR)**
- Backend (Render)
  - Dossier racine: `/`
  - Build: `npm ci`
  - Start: `node backend/server.js`
  - Node: `18+`
  - Teste: `https://<ton-service>.onrender.com/` et `https://<ton-service>.onrender.com/api/alerts`
- Frontend (Vercel)
  - Dossier racine: `./frontend`
  - Install: `npm ci`
  - Build: `npm run build`
  - Env: `NEXT_PUBLIC_API_BASE = https://<ton-service>.onrender.com`
  - Ouvre l’URL Vercel: la liste doit s’afficher
- Astuce Render (free): premier appel lent (cold start). Ajoute un ping (UptimeRobot) toutes les 15 min sur `/`.
**Demo Links**
- Frontend: https://fraudshield.vercel.app/
- API: https://fraudshield-demo.onrender.com
