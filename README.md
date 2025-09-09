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
- Legacy: `/api/*` still available for existing pages.
- Banking‑grade v1 (new):
  - `GET /v1/_status` → `{ ok, version, time }`
  - `GET /v1/alerts`, `GET /v1/alerts/:id`, `POST /v1/alerts/:id/escalate` (JWT Analyst+)
  - `GET /v1/transactions`, `GET /v1/transactions/stream` (SSE)
  - `GET /v1/entities`, `GET /v1/entities/:id`
  - `POST /v1/ai/explain-alert`, `POST /v1/ai/nl-search`, `POST /v1/ai/generate-tracfin-report`
  - `GET /v1/alerts.csv`, `GET /v1/transactions.csv`

**Datasets (CSV) – Enriched**
- The CSVs under `data/` have been enriched with realistic banking fields (IBAN/BIC, KYC review dates, auth methods, MCC, fees, etc.).
- A generator script keeps them consistent and reproducible.
  - Regenerate: `node scripts/enrich-datasets.js`
  - Also enriches `data/synth-fr/*` if present.
  - Backend loaders are backward compatible and read new columns automatically.

**Reports, Exports & Teams**
- Reports UI at `/reports` shows analytics, predictions, real-time metrics and a priority table.
- Export buttons: PDF (jsPDF + html2canvas) and Excel (SheetJS/xlsx).
- Share to Teams: configure an Incoming Webhook URL in the target channel, then set `TEAMS_WEBHOOK_URL` in the API environment. The frontend will POST to `/api/share/teams` (on the API base) with a formatted summary message.
  - Render example: add env var `TEAMS_WEBHOOK_URL` to the API service settings.
  - Local test: `set TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...` then `npm run start:api` and click “Partager Teams” on `/reports`.

**Environment**
- Copy `.env.example` to configure local/dev/prod vars.
- `NEXT_PUBLIC_API_BASE`: Base URL of the API (e.g. `https://fraudshield-api.onrender.com`).
- Backend: `PORT`, `FRONTEND_ORIGIN`, `ADMIN_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`.
- Optional `KEEPALIVE_URL`: If set, `npm run ping` pings this URL; otherwise falls back to `NEXT_PUBLIC_API_BASE`.

**Deployment**
- **Render (API)**: `render.yaml` defines service `fraudshield-api` with `start: node backend/server.js`.
- **Vercel (Web)**: Deploy `frontend` as a Next.js app; set `NEXT_PUBLIC_API_BASE` env var to the Render API URL.
- Optional: `render.yaml` includes a `fraudshield-web` service using `npm run start:web` if you also choose to host the web on Render.

**Keep-Alive (optional)**
- Start ping locally or as a lightweight worker: `npm run ping` (uses `KEEPALIVE_URL` or `NEXT_PUBLIC_API_BASE`).
- Production API keep-alive: `npm run ping:prod` (pings Render at https://fraudshield-demo.onrender.com every ~14 minutes).

**Docker**
- Build images:
  - Backend: `docker build -f backend/Dockerfile -t fraudshield-api:local .`
  - Frontend: `docker build -f frontend/Dockerfile -t fraudshield-web:local .`
- Compose (local): `docker-compose up --build`
  - Web: http://localhost:3000
  - API: http://localhost:4000
-- Dev stack (with Postgres+Redis): `docker-compose -f docker-compose.dev.yml up --build`
  - DB: `postgres://postgres:postgres@localhost:5432/fraudshield`
  - Seed: `DATABASE_URL=postgres://... npm run seed`

**Kubernetes**
- Namespace: `kubectl apply -f k8s/namespace.yaml`
- API: `kubectl apply -f k8s/api-deployment.yaml`
- Web: `kubectl apply -f k8s/web-deployment.yaml`
- Ingress (NGINX): `kubectl apply -f k8s/ingress.yaml`
  - Edit host `demo.fraudshield.local` to your domain
  - Point DNS (or /etc/hosts) to your Ingress controller IP


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
