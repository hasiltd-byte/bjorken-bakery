# Pilot phases and verification

| Phase | Implemented in local pilot | Boundary |
| --- | --- | --- |
| Audit / foundations | Existing system inventory, feature branch, module store, licenses, employee roles, adapters and server guards | Fixed business deployment; no HASI main site or full multi-tenant bootstrap |
| 1 · Shop / PWA | Existing shop preserved, optional normal-delivery requests, nullable fee, branded manifest/icons, safe worker, install instructions, local QR/share | No automatic phone installation; HTTPS and physical-device checks needed before rollout |
| 2 · Orders / Food | Seller/baker boards, stock counts, reserved quantities including group orders, production batches, oven/ready transitions, shortage notes, customer tracking, manual payment records, polling | No recipes/materials automation, POS/fiscal receipts or automatic messaging |
| 3 · Group Delivery | Multiple stops, cutoff, minima/private thresholds, customer personal quote, pending/manual payment gate, atomic stock, collection code/delegate, no-show/return/reschedule, private cost calculator, refund ledger | No PSP, automatic refunds, route-distance API or automatic reminders; manual WhatsApp drafts only |
| 4 · Club / Reviews / reports | Separate marketing consent, optional birthday, duplicate-safe signup, self-service withdrawal, coupons redeemed atomically by shop, offers, moderated text reviews, universal Google review link, daily/monthly reports | No mass sending, Push transport or review-media upload; no invented net profit |

Checks are performed with isolated replica sets. Unit/integration suites include original stock races, idempotency and product/admin behavior as well as module expiry, role isolation, single batch completion, coupon races, payment gates, secure collection, capped/idempotent refunds, consent/withdrawal and tracking privacy. Browser suites exercise the original three designs and the new module flows. See `PILOT_PHASE_REPORT.md` for the final run.

Next rollout requires owner review of the concrete pilot, entitlement periods, manual-payment/refund/no-show policies, staff identities and privacy policy. Provider integration and production deployment are separate approval steps. No HASI Growth, `/start`, `/miluim`, sales funnel, Design Library platform or games were built here.
