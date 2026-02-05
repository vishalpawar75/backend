# Backend

[![Backend CI & Deploy](https://github.com/vishalpawar75/backend/actions/workflows/ci-deploy.yml/badge.svg?branch=dev)](https://github.com/vishalpawar75/backend/actions/workflows/ci-deploy.yml)
[![Render Deploy](https://img.shields.io/badge/Render-Deployed-46E3B7)](https://dashboard.render.com/)

Node.js API for Vakratund Hybrid Seeds: partner auth, analytics, and ingestion pipeline.

## Local development

1. Install dependencies:
   - `npm install`
2. Run migrations (requires Postgres):
   - `npm run db:migrate`
3. Start server:
   - `npm run dev`

## Deployment (Render)

- `render.yaml` is included with a free web service definition.
- Update `CORS_ORIGIN` to your frontend URL.
- Set `DATABASE_URL` in Render if you use a managed Postgres database.
