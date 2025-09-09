**1.1.0 — FR Rules + Security + UX**
- FR detection: KBK_HIGH_AMOUNT_NON_URGENT, FONDS_SEIN_PAYS_TIER, VIREMENT_IRREGULIER, UTILISATION_CONNECTE, KYC_OBSOLE, PBR_ATTACHED; weighted scoring.
- Data context: kyc_age_days derivation, history-based velocity, ip_country and crypto flags support.
- Alerts service: full names (entity_name), prior-flag count, audit logs, AI suggestions (multi-action), richer details.
- API: server-side rule filters (`rule=`), pagination, input validation, `/_status`.
- Security: helmet, rate limiting, compression, restricted CORS, admin API key on `/api/recompute`, centralized error handler.
- Frontend (Bootstrap): SSR filters, pagination + page size + jump-to-page, KYC column, entity_name, alert detail with colored rule badges and Chart.js visualization.

Notes
- Set env vars: `FRONTEND_ORIGIN`, `ADMIN_API_KEY`; optionally `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`.
- On Vercel, set `NEXT_PUBLIC_API_BASE` to the Render API URL.
