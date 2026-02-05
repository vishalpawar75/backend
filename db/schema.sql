-- Initial schema for Vakratund trade analytics + partner portal

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('partner', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  interest TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hs_codes (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  sector TEXT
);

CREATE TABLE IF NOT EXISTS countries (
  iso TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT
);

CREATE TABLE IF NOT EXISTS trade_records (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('export', 'import')),
  hs_code TEXT NOT NULL,
  commodity TEXT NOT NULL,
  country TEXT NOT NULL,
  value_usd NUMERIC NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  record_hash TEXT UNIQUE,
  source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hs_code) REFERENCES hs_codes(code),
  FOREIGN KEY (country) REFERENCES countries(iso)
);

CREATE TABLE IF NOT EXISTS aggregates_monthly (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('export', 'import')),
  hs_code TEXT NOT NULL,
  country TEXT NOT NULL,
  value_usd NUMERIC NOT NULL,
  quantity NUMERIC,
  source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
