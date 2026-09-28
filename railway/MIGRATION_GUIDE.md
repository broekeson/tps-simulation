# Migrating Risk & AML Database from Supabase to Railway

This guide walks through deploying the database and REST API on **Railway**, replacing Supabase.

---

## Architecture Overview

```
Railway Project
│
├── PostgreSQL Service (Port 5432)
│     └── Database: risk_aml
│
└── PostgREST Service (Docker: postgrest/postgrest:latest)
      ├── Connects to PostgreSQL internally via PGRST_DB_URI
      ├── Public Domain: https://api-risk-aml-production.up.railway.app
      └── Authenticates client requests using JWT
```

---

## Step 1: Deploy PostgreSQL on Railway

1. Go to [railway.com](https://railway.com) and create or open your project.
2. Click **+ New** → **Database** → **Add PostgreSQL**.
3. Under the Postgres service, open **Variables** and copy your `DATABASE_PUBLIC_URL`.
4. Connect with `psql` (or pgAdmin / TablePlus / DBeaver) and create the `risk_aml` database if using multiple databases:
   ```sql
   CREATE DATABASE risk_aml;
   ```
5. Apply the schema file [`railway/schema.sql`](./schema.sql):
   ```bash
   psql "$DATABASE_PUBLIC_URL/risk_aml" -f railway/schema.sql
   ```
   *(Be sure to replace `'railway_postgrest_pass'` with your desired authenticator password before executing!)*

---

## Step 2: Deploy PostgREST Service

1. In the same Railway project, click **+ New** → **Docker Image**.
2. Enter: `postgrest/postgrest:latest`.
3. In the new service, go to **Variables** and set:
   - `PGRST_DB_URI`: `postgres://authenticator:<YOUR_PASSWORD>@postgres.railway.internal:5432/risk_aml`
   - `PGRST_DB_SCHEMAS`: `public`
   - `PGRST_DB_ANON_ROLE`: `anon`
   - `PGRST_JWT_SECRET`: *(A random string of at least 32 characters, e.g. `openssl rand -hex 20`)*
   - `PGRST_SERVER_PORT`: `3000`
   - `PORT`: `3000`
4. Under **Settings** → **Networking**, click **Generate Domain**.
   *(e.g., `https://api-risk-aml-production.up.railway.app`)*

---

## Step 3: Mint the PostgREST JWT Token

Run the included Node.js script using the same `PGRST_JWT_SECRET` you set in Railway:

```bash
node railway/mint_jwt.js "your-32-char-minimum-jwt-secret-here"
```

Copy the generated JWT token.

---

## Step 4: Configure the Simulation Engine

In `index.html` (and `Risk and AML.html`):

Find the `BACKEND` block:

```javascript
const BACKEND = {
  url: "https://api-risk-aml-production.up.railway.app", // Your Railway PostgREST domain
  prefix: "", // Root path for PostgREST
  key: "YOUR_MINTED_JWT_TOKEN", // The token generated in Step 3
  on: false, probed: false, q: [], timer: null, shipped: 0
};
```

---

## Step 5: Verify

1. Test the REST endpoint directly:
   ```bash
   curl "https://YOUR-RAILWAY-DOMAIN/profiles?select=*&limit=5" \
     -H "Authorization: Bearer YOUR_MINTED_JWT"
   ```
2. Open `index.html` in your browser. The top bar cloud status should display **Cloud: synced** in green.
