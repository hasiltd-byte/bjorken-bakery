# Björken modular pilot architecture

Branch: `feature/bjorken-hasi-pilot`. Existing Next.js App Router and MongoDB/Mongoose remain the host. No separate backend process, HASI main-site code or tenant-routing platform was added.

The compatibility service in `lib/server/service.mjs` preserves existing catalog/cart/admin contracts, delegates status changes to reusable Orders Core, and dispatches `/order/api/modules/*` to the modular host. The base shop does not require an optional module license. Normal coordinated delivery is separately enabled by the business and uses server-owned fees.

`ModuleRecord` scopes every module document by trusted businessId, live/demo space, kind and key. A compound unique index and the existing transactional mutation lock protect invariants. The pilot is a single-business deployment: existing MenuItem/Config bootstrap must be replaced by tenant-aware adapters before using a shared HASI database. Domain records, employee accounts and customer tracking are not public tenant selectors.

Owner auth remains compatible. New employee passwords use scrypt with individual random salts. Sessions carry business/role/user; employee deactivation atomically invalidates their sessions. Cashier/kitchen cannot use the owner CMS API; kitchen DTOs omit name, phone, address, item prices and payment records. Drivers see only explicitly assigned group routes, without financial thresholds or calculator inputs.

New licenses support demo/trial/active/expired/disabled. Activation is an owner action with an expiry, reference and explicit acknowledgment; it does not charge money. Food Pro includes Orders Pro. Group Delivery uses internal order storage without requiring Orders Pro or Food Pro. Expiry blocks new protected activity but preserves stored data, customer tracking and marketing withdrawal.

PWA uses Next.js native manifest support and a small service worker. Only icons and the offline fallback are precached; public navigation is network-first without storing HTML. APIs, admin, order/club/tracking pages and POST requests bypass the worker. See [Next.js PWA guidance](https://nextjs.org/docs/app/guides/progressive-web-apps). QR images are generated locally using [node-qrcode](https://github.com/soldair/node-qrcode), without an external QR service.

Orders use random bearer tracking tokens and hash-based lookup, server snapshots, event timelines and serialized stock reservations. UI refreshes every five seconds while visible and shows last-refresh/error state; it does not pretend to have WebSocket delivery. Group customer pages expose only personal costs, public stops and coarse progress states, never route targets, revenue totals or profitability.

Payment and notification adapters deliberately have no live implementation. Manual payment/refund confirmation requires an authenticated authorized operator, matching amount, explicit verification and reference. Refund records reserve a cumulative maximum of the money actually paid and are idempotent. No external messages, automatic subscription charges or live PSP webhooks are enabled.

Known production work: shared rate-limit storage across serverless instances; provider onboarding/signatures/retry policy; retention/erasure legal policy; monitoring/backups; review-media moderation; physical iOS/Android installation checks. None is described as already delivered.
