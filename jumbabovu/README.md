# jumbabovu (MVP, Phase 1)
B2B marketplace for Tanzanian agricultural exporters. React + Vite + Tailwind client, Express + PostgreSQL API, JWT auth. Express serves the built client, so Render runs one web service.

## Included
Auth (buyer / exporter / admin), product and exporter listings with search, exporter profiles, admin verification, RFQs, quotations (accept/reject), role dashboards.
## Phase 2 (included)
Real-time chat (Socket.IO) with online and seen status, notification bell with live updates, dashboard statistic cards. Chat attachments are not built yet.

## Phase 3 (included)
Orders created when a buyer accepts a quotation, payment tracking (simulated; no real money moves), order status updates by the exporter, delivery confirmation by the buyer, admin payment release, and buyer reviews with star ratings on exporter pages.

## Phase 4 and escrow (included)
Escrow flow: buyer pays into the jumbabovu escrow bank account (never to the exporter), admin confirms the funds in the bank statement, exporter produces and ships, buyer confirms delivery, admin pays out and records the reference. Disputes freeze the funds until admin decides release, refund or partial settlement. Also: advertising (featured product, featured supplier, homepage banner; price 0 until an admin sets one) and analytics.

**Escrow account setup:** set `ESCROW_BANK_NAME`, `ESCROW_ACCOUNT_NAME`, `ESCROW_ACCOUNT_NO` and optionally `ESCROW_NOTE` in Render. The app records and tracks escrow; the money itself sits in that bank account and moves only when an admin pays out through the bank. **Before taking real buyer money**, get legal advice on licensing and on holding client funds in Tanzania (Bank of Tanzania rules), and consider a licensed bank escrow or trust arrangement.

## Chat attachments and Pesapal (included)
**Cloudinary** (chat images/PDFs and product photos): create a free account, then set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Render. Uploads go straight from the browser with a signed request. Limits: images 5 MB, PDFs 10 MB.

**Pesapal** (card and mobile money): get sandbox keys from developer.pesapal.com, then set `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `APP_URL` (your public site URL, e.g. https://jumbabovu.onrender.com, no trailing slash), keep `PESAPAL_ENV=sandbox` while testing, and `PESAPAL_CURRENCIES` (currencies your Pesapal account supports). The IPN address is registered automatically. For real money switch to `PESAPAL_ENV=live` with live keys. Funds settle into your Pesapal account, which is your escrow holding account. Ask Pesapal in writing that your merchant agreement allows holding funds for third-party sellers. Bank transfer to your own escrow account still works as a second option.

## Registration, email and Verified badge (included)
Buyers and sellers register with company, phone and country, accept the Terms, and verify their email before they can request quotes, send quotations, chat or pay. Sellers can start selling at once; they must add a payout account before sending quotations. The Verified badge is optional: the seller uploads BRELA, TIN, export licence and director ID (stored privately in Cloudinary), admin approves, the seller pays the yearly fee (default TZS 100,000, change it in Admin settings) online or by bank transfer, and the badge runs for one year with a renewal button.

**Email:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (any SMTP service works). Without them, verification and reset links are printed in the server logs only. **Verified fee account:** optionally set `FEE_BANK_NAME`, `FEE_ACCOUNT_NAME`, `FEE_ACCOUNT_NO` for your operating account. If left empty, the escrow account details are shown, so keep fee income separate in your books. The Terms page is a draft for your lawyer.

## Not yet built
Nothing from the PRD phases is outstanding. Chat attachments (Cloudinary) are still to do.

## Deploy on Render
1. Push this folder to GitHub.
2. Render > New > Blueprint > pick the repo. It creates the web service and Postgres from `render.yaml`.
3. When asked, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (creates your admin login on first start).
4. Open the service URL. Tables and categories are created automatically at startup.
Note: Render's free Postgres expires after 30 days; use a paid plan for real use.

## Run locally
Needs Postgres. Create `server/.env` values in your shell: `DATABASE_URL=postgres://user:pass@localhost/hub JWT_SECRET=x ADMIN_EMAIL=a@b.com ADMIN_PASSWORD=secret`
Then `npm --prefix server install && npm --prefix client install`, run `npm run dev:server` and `npm run dev:client` (client on :5173 proxies /api to :4000).
