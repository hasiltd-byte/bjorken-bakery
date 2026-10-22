# Björken

A single **Next.js 16.4.2 App Router** application with React, TypeScript and **MongoDB / Mongoose**. There is no separate backend server or Express application. All API requests run in Next.js Route Handlers using the Node.js runtime.

The current workspace is configured through the ignored `.env` file to use **Atlas `bjorken_dev`** and **Cloudinary for new image uploads**. Mongoose models store product data and image URLs; image bytes are sent to Cloudinary, not MongoDB. The admin login and WhatsApp verification are preserved. Public ordering remains in Preview.

```text
app/                            Next.js pages, components and styles
app/order/api/[...path]/route.js Next.js API Route Handler
app/order/media/[file]/route.js  Next.js image Route Handler
lib/server/                     MongoDB models, transactions, authentication and server utilities
shared/                         Browser-safe catalog, schedule and message helpers
tests/                          Isolated MongoDB integration tests
public/                         Images and static assets
```

## Run with MongoDB

For another installation, copy `.env.example` to `.env.local` and configure a dedicated Bjorken MongoDB replica-set database, admin username and a unique password of at least 16 characters. Database names must be `bjorken` or start with `bjorken_` / `bjorken-`, such as `bjorken_dev`. MongoDB Atlas supports the transactions used for inventory and order deduplication. Never use Cotta's database.

```sh
npm install
npm run dev
```

Open http://localhost:3030 and http://localhost:3030/admin. Next.js loads `.env` and `.env.local`; no custom environment loader is needed. `MONGO_URI` and `MONGODB_URI` are supported; configure one, as `MONGODB_URI` takes precedence if both exist. `MONGO_DB_NAME` selects the database explicitly, otherwise the database path in the URI is used, defaulting to `bjorken` only when no path exists. Other application database names are rejected.

```sh
npm run build
npm start
npm test
npm run test:browser
```

`npm start` starts only Next.js. An optional `npm run preview:local` helper starts an isolated disk-backed development MongoDB instance alongside Next.js on this computer; it is not a separate application backend or a production database service. Its existing admin credentials and data remain in `.local/`.

`START-BJORKEN.cmd` starts the normal Next.js app using the configured Atlas database. `node scripts/check-database.mjs` checks connectivity without printing credentials. `node scripts/verify-atlas-app.mjs` checks admin/catalog persistence without changing products. Automated `npm test` and `npm run test:browser` use isolated test databases and mock external image storage, not your real Cloudinary account.

## Cloudinary images

Set `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` in `.env` or the deployment environment. With these two variables, the preset must be **Unsigned**. These settings stay server-side. No SDK or extra server is required: the authenticated Next.js image Route Handler validates and downsizes the file, uploads it through Cloudinary's HTTPS Upload API, and returns `secure_url`. The product editor saves that URL through the existing Mongoose `MenuItem.image` field. Cloudinary URLs from other clouds and arbitrary external image URLs are rejected.

Admins can upload or replace product images; saved images reopen correctly in the editor and display in the public catalog. Existing local files and legacy GridFS URLs remain readable. No new images are written to GridFS. Existing static reference photos are not bulk-uploaded automatically. Replacement creates a new Cloudinary asset; old assets remain available rather than being deleted behind the admin's back. Programmatic asset deletion would require additional Cloudinary credentials.

See [Cloudinary implementation and verification](docs/CLOUDINARY.md). An explicitly invoked `node scripts/verify-cloudinary-admin.mjs --upload-cinnamon` uploads the existing cinnamon photograph and updates that actual product; it is not part of the automatic tests.

Preview protections, WhatsApp verification and business approvals are preserved. Keep `BJORKEN_ENABLE_LIVE=false` until public ordering is approved. Do not deploy `.local/`, `.env.local` or test databases.

See [Hebrew instructions](README_HE.md) and [weekly orders and contact](docs/CONTACT_AND_WEEKLY_HE.md).
