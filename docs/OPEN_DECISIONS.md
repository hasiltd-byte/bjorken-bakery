# Open decisions before a live pilot

1. Which optional modules may enter trial/active mode, for how long, and who is allowed to grant them? The code defaults them off; local demo grants do not authorize real activity.
2. Approve the bakery's normal-delivery fee and coverage, group stops/cutoffs, manual payment evidence, refund ownership, safe-return/late-collection policy and agreed redelivery cost. The software does not invent routing distances or product safety judgments.
3. Choose PSP credentials and verified webhook/refund contracts if automatic collection is wanted. Until then the supported group flow waits for actual manual payment verification. No card data is requested or stored.
4. Choose notification transport/VAPID setup and approve opt-in wording before enabling Push or automated WhatsApp/SMS. No such transport is active now.
5. Approve employee identities/roles, privacy/retention/deletion policy, duplicate-contact recovery procedure, media rights/moderation and any Google review link. Existing member management tokens are never handed to someone repeating a phone number; recovery currently needs business assistance.
6. Before rollout, test installation on physical Safari/iPhone and Chrome/Android over HTTPS, add distributed rate limiting/monitoring/backups, and agree on production migration/rollback. The local pilot uses a separate MongoDB process; Atlas data was not migrated or seeded.

No production deployment, provider purchase, actual payment verification or external message was performed during development.
