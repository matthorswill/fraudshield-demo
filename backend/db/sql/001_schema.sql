-- FraudShield banking-grade schema (PostgreSQL)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','Analyst','Auditor','Viewer')),
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entities (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('customer','company')),
  name TEXT NOT NULL,
  country TEXT,
  kyc_status TEXT,
  risk_score REAL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  src_entity_id INTEGER REFERENCES entities(id),
  dst_entity_id INTEGER REFERENCES entities(id),
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL,
  channel TEXT,
  src_country TEXT,
  dst_country TEXT,
  rule_hits TEXT[] DEFAULT '{}',
  anomaly_score REAL,
  label TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_ts ON transactions(ts);
CREATE INDEX IF NOT EXISTS idx_transactions_rule_hits ON transactions USING GIN (rule_hits);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  entity_id INTEGER REFERENCES entities(id),
  tx_id BIGINT,
  score REAL NOT NULL,
  band TEXT CHECK (band IN ('HIGH','MEDIUM','LOW')),
  desc TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_score_desc ON alerts (score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_details_gin ON alerts USING GIN (details);

DROP TABLE IF EXISTS cases;
CREATE TABLE cases (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('High','Medium','Low')),
  status TEXT NOT NULL CHECK (status IN ('Open','Investigating','Resolved','OnHold')),
  sla_due_at TIMESTAMPTZ,
  assignee_id INTEGER REFERENCES users(id),
  risk_band TEXT CHECK (risk_band IN ('HIGH','MEDIUM','LOW')),
  amount NUMERIC(18,2),
  currency TEXT,
  entity_id INTEGER REFERENCES entities(id),
  alert_ids INTEGER[] DEFAULT '{}',
  evidence_count INTEGER NOT NULL DEFAULT 0,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_status_priority ON cases(status, priority);
CREATE INDEX IF NOT EXISTS idx_cases_sla ON cases(sla_due_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB,
  hash TEXT,
  prev_hash TEXT
);
