# Risk & AML in Acquiring · Training Simulation

A three-day cohort simulation for payments professionals, built by **The Payment School · intreensic**. Participants run the risk desk at a fictional acquirer: ten decision calls each morning, real capital moving on every one, daily standings, and a cumulative podium after Day 3.

**Live simulation:** https://otoebe.github.io/Risk-and-AML-in-Acquiring/

## What is in this repository

| Path | Purpose |
|---|---|
| `index.html` | The entire simulation engine, a single self-contained file (no build step, no dependencies). Served by GitHub Pages. |
| `supabase/migrations/` | The database schema as code, matching the live Supabase project exactly: tables, row-level security policies, grants and leaderboard views. |
| `supabase/config.toml` | Supabase CLI configuration for local development and dashboard integration. |
| `.nojekyll` | Tells GitHub Pages to serve the file as-is. |

## Architecture

The engine runs entirely in the browser. Participants register with real names and teams; progress, scores and telemetry sync to a Supabase backend (project: Risk and AML in Acquiring) through its REST API, guarded by row-level security. If the network drops, the simulation continues locally on the device. Facilitators have a gated console for cohort standings, programme records and final training reports.

Content covers the acquiring risk curriculum: the economics of acquiring, phygital acceptance, four-party and payment facilitator models, KYC and AML pipelines, PCI DSS v4, Visa VIRP and VAMP thresholds (April 2026), Mastercard BRAM, MRP, MATCH, ECM and HECM, transaction laundering detection, and the prevent, monitor, respond operating model. Scheme figures are verified against 2025 and 2026 programme updates; reverify against live scheme manuals before acting on a real merchant.

## Updating the deployment

Replace `index.html` on the `main` branch and commit. GitHub Pages redeploys automatically within a minute or two. Hard-refresh the live URL after deploying (Ctrl+F5) to bypass the browser cache.

## Database changes

Schema changes are applied to the Supabase project as migrations and mirrored in `supabase/migrations/`. The migration files in this repository correspond one-to-one with the applied migration history.

---

© The Payment School · intreensic. Training content for facilitated delivery.
