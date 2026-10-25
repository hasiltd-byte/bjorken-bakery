# Björken pilot audit — 2026-10-24

Scope follows the opening instructions in `HASI_BJORKEN_COMPLETE_CODEX_2026-10-24.md`. Its HASI master-site appendix is background only. No changes to HASI, Cotta, `/miluim`, sales funnels or production deployment.

Baseline: clean `main`, commit `33f7470`. Work isolated on `feature/bjorken-hasi-pilot`; no reset or overwrite. Next.js 16.4.2 / React 19 / TypeScript, Mongoose 9, Atlas replica-set transactions, Cloudinary URLs, npm, Playwright and isolated MongoDB tests. Read-only existing menu check: connected, 10 products, seven-day pickup configuration, requests enabled. No customer data copied.

Existing: three bakery designs, catalog/categories, product CRUD/images/gallery/prices/stock, hide without deletion, weekly pickup/events, cart, nullable prices, separate-tab WhatsApp handoff, idempotent pending requests, transactional stock reservation/release, authenticated owner admin, status transitions, configuration revisions, per-process rate limiting.

Missing at audit: normal delivery coordination, PWA/installation/QR, feature licenses, employee roles, separate seller/baker dashboards, production batches/shortages, customer tracking, group delivery/payment gate/collection authorization, club/consents/unsubscribe/coupons, moderated reviews, verified-revenue reports.

External: live PSP/refunds, automated WhatsApp/SMS, push delivery credentials, licensed routing distances, legal review. None will be represented as connected or activated. Pilot tests use an isolated local replica set; optional modules default disabled for the existing bakery. No automatic subscription billing, external messages or production deployment.
