# RFQ Automation Platform

Upload RFQ PDFs → automatically extract items → search the web for **exact**
part-number supplier matches → discover supplier contact emails → generate RFQ
emails → review → send through Outlook.

Built for **low-volume usage** (5–10 items/day) with a deliberately simple,
maintainable architecture. No paid AI services, no Redis/BullMQ, no
microservices.

---

## Tech Stack

| Layer        | Choice                                                |
| ------------ | ----------------------------------------------------- |
| Frontend     | Next.js 15 (App Router), TypeScript, Tailwind v4, Shadcn UI |
| Backend      | Next.js API Routes (Node runtime)                     |
| Database     | Supabase (Postgres)                                   |
| Storage      | Supabase Storage (RFQ PDFs)                            |
| Auth         | None — single-operator, private deployment            |
| PDF parsing  | `pdf-parse` → `pdfjs-dist` → `tesseract.js` (OCR fallback) |
| Web search   | Playwright (headless Chromium) + DuckDuckGo           |
| Email        | Outlook SMTP via Nodemailer (app password, no Azure)  |

---

## How it works

```
Upload RFQ → Extract Items → Search Suppliers → Find Emails
          → Generate Email Draft → User Reviews → User Clicks Send → Outlook Sends
```

- **Exact match only.** A supplier is accepted *only* if the exact part number
  appears on the page as a standalone token. `900063` matches `900063`, but
  **not** `900064` or `900063A`. No fuzzy / similarity / AI matching.
- **Confidence is binary.** Exact match = `100`. Anything else = `NOT_FOUND`.
- **Sending is always manual.** Nothing is ever sent automatically — the user
  reviews and edits every email, then clicks Send.

### Item statuses

`PENDING_SEARCH → FOUND / NOT_FOUND → READY_TO_SEND → EMAIL_SENT / EMAIL_FAILED`

---

## Quick start (local, zero external setup)

The app ships with mock modes so you can try the whole workflow immediately.

```bash
cp .env.example .env.local      # defaults: MOCK_EMAIL=true, no Supabase
npm install                     # also installs Playwright Chromium
npm run dev                     # http://localhost:3000
```

With no Supabase keys it uses an **in-memory store seeded with sample data**.
With `MOCK_EMAIL=true` (default) Outlook sending is simulated. Set
`MOCK_SEARCH=true` to skip Playwright and get deterministic fake suppliers.

> The mock switches are independent — turn each off as you wire up the real
> service.

---

## Full setup

### 1. Supabase

You already have a Supabase project. Wire it up:

1. Open **SQL Editor** and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates the `rfqs`, `rfq_items`, `suppliers`, `email_logs` and
   `ms_oauth_tokens` tables, the `rfq-pdfs` storage bucket, and RLS policies.
2. Copy your project URL, anon key and **service role** key into `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

The server reads/writes data with the service-role key (RLS-bypassing). As soon
as these are present, the in-memory fallback is no longer used.

### 2. Outlook email via SMTP (for real email sending)

No Azure / app registration required — a personal Outlook.com account with an
**app password** is all you need:

1. Enable **2-step verification** on your Microsoft account:
   <https://account.microsoft.com/security>
2. Create an **app password**: <https://account.live.com/proofs/AppPassword>
3. Put the values in `.env.local`:

   ```env
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_USER=your-address@outlook.com
   SMTP_PASS=your-app-password
   MOCK_EMAIL=false
   ```

4. Restart the app. **Settings** will show “Configured”. Emails are sent over
   SMTP from your Outlook address; each send is logged in `email_logs`.

> Note: basic-auth SMTP works for **personal** Outlook.com / Hotmail / Live
> accounts. Work / Microsoft 365 mailboxes have it disabled and would need the
> Microsoft Graph API instead.

### 3. Run

```bash
npm run dev          # development
npm run build && npm start   # production (Node)
```

---

## Docker

The image is built on the official Playwright base (Chromium + system libs for
OCR/canvas are preinstalled).

```bash
cp .env.example .env          # fill in real values
docker compose up --build     # http://localhost:3000
```

or plain Docker:

```bash
docker build -t rfq-automation-platform .
docker run --env-file .env -p 3000:3000 rfq-automation-platform
```

---

## Deployment

This is a **self-hosted Node application** (it must be — Playwright, `pdf-parse`
and Tesseract OCR cannot run on edge/serverless runtimes).

Recommended targets:

- **Any VPS / VM** (DigitalOcean, Hetzner, EC2, etc.): `docker compose up -d`
  behind a reverse proxy (Caddy/Nginx) terminating TLS.
- **Fly.io / Railway / Render**: deploy the Dockerfile directly.

Checklist:

1. Set all production env vars (`.env`), including a public `NEXT_PUBLIC_APP_URL`.
2. Set `SMTP_USER` / `SMTP_PASS` (Outlook app password) and `MOCK_EMAIL=false`.
3. Run the SQL migration against your Supabase project.
4. `docker compose up -d --build`.

---

## API routes

| Method | Route                              | Purpose                              |
| ------ | ---------------------------------- | ------------------------------------ |
| POST   | `/api/rfqs/upload`                 | Upload PDF, extract & store items    |
| GET    | `/api/rfqs`                        | List RFQs                            |
| GET    | `/api/dashboard`                   | Dashboard stats                      |
| GET    | `/api/items/[id]`                  | Item + suppliers                     |
| POST   | `/api/items/[id]/search`           | Run exact-match supplier search      |
| POST   | `/api/emails/preview`              | Generate the RFQ email draft         |
| POST   | `/api/emails/send`                 | Send via Outlook SMTP + log          |
| GET    | `/api/auth/outlook/status`         | Email (SMTP) configuration status    |

---

## Project structure

```
src/
  app/
    page.tsx                 Dashboard
    upload/                  Drag & drop upload + items table
    rfqs/[rfqId]/            RFQ detail
    items/[itemId]/          Item details + supplier search panel
    verification/            Verification queue
    emails/[itemId]/         Email preview & send
    progress/                Search progress
    settings/                Outlook SMTP status
    api/                     API routes (see table above)
  lib/
    env.ts                   Typed env + mock switches
    types.ts                 Domain model (mirrors DB)
    repo.ts                  Data access (Supabase OR in-memory fallback)
    storage.ts               PDF storage (Supabase Storage OR local)
    supabase/                Browser / server / admin clients
    pdf/                     extract.ts (+ OCR), parse-items.ts (10 fields)
    search/                  index.ts (Playwright), matching.ts (exact match)
    email/                   template.ts, graph.ts, token-store.ts
  components/                app-shell, status-badge, theme, ui/ (Shadcn)
supabase/migrations/0001_init.sql
Dockerfile, docker-compose.yml
```

---

## Email template

Emails follow the exact required format; **empty fields are omitted** (no blank
lines for missing data):

```
Dear Sales / Purchasing Team,

Please quote your lowest best prices for the following items with gross weight & dimensions.

ITEMS SHOULD BE BRAND NEW FACTORY PACKAGE

Our Ref. No. {referenceNumber}
Dated: {date}

Item {itemNumber}

Manufacturer part number: {partNumber}

{product}

BOX SIZE: {boxSize}
APPLICATION: {application}
ANALYZER MODEL: {analyzerModel}
TAG NO: {tagNumber}

MNFR: {manufacturer}

Qty: {quantity} {unit}

Best regards.
```

---

## Notes & limitations

- **Extraction is heuristic.** RFQ PDFs vary wildly; the parser is label-driven
  and tolerant, but unusual layouts may need tuning in
  `src/lib/pdf/parse-items.ts`.
- **Search depth** is capped by `SEARCH_MAX_RESULTS` to keep latency sane for a
  low-volume tool.
- **OCR** only runs when a PDF has no text layer (scanned documents).
