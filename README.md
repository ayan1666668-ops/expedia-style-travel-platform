# Voyahub

An Expedia-style, **self-owned product** travel marketplace. Attractions, tours, hotel
rooms and transfers — all sold, priced, ticketed and redeemed through one in-house
platform.

> **Scope, deliberately.** This connects to the *data layer only*. There are no GDS/NDC
> feeds, no hotel CRS or channel-manager contracts, no fleet/car-rental vendor
> interfaces, and no supplier price or inventory synchronisation. Products, inventory,
> prices and availability are first-party records. That constraint is what makes the
> booking, pricing and ticketing engines meaningful here — every rule is exercised
> end-to-end instead of being proxied to somebody else's API.
>
> Target markets are **Europe and North America**, so the seed catalogue, pricing
> currencies, locales and destinations are all USD/EUR and EN-first.

---

## What's implemented

All eight domains are live, not sketched:

| Domain | Highlights |
| --- | --- |
| **Products & pricing** | `Product → TicketType` uniform model. Nine rule types (date range, day-of-week, season, lead time, length of stay, occupancy, quantity break, flash sale, early bird) with percent/fixed/multiply/set adjustments. `admin/pricing/simulate` explains any quote. |
| **Inventory & availability** | `(ticketType, serviceDate, timeSlot)` rows with `capacityTotal / Held / Sold`, optimistic `version` column, hold→consume→release lifecycle, TTL sweeper, and a 90-day availability calendar. |
| **Booking & payment** | Held-inventory checkout, idempotent payment intents, `PaymentGateway` interface with a deterministic `mock` adapter and a real Hyperswitch adapter. Tiered cancellation quoting and refunds. |
| **Ticketing & redemption** | Signed QR payloads, printable A4 PDF passes, S3/MinIO or local-disk persistence, gate scanner with dry-run vs. admit modes, double-scan rejection. |
| **Reviews & social** | Verified-purchase reviews, rating breakdown, merchant replies, helpful votes, wishlist. |
| **Loyalty & marketing** | Tiered points programme, earn on booking, redeem for credit, coupons (`WELCOME10`, `SAVE25`, `FIRSTTIMEBIG`), and **bilingual promo banners** an operator can create, schedule and place on the storefront without a deploy. |
| **Itinerary & map** | Multi-day trip plans with geolocated stops, timezone-aware. |
| **Operations backend** | Three separate surfaces (customer / operations / support), KPI dashboard, order/inventory tables, double-entry ledger (`GROSS_SALES`, `TAX_PAYABLE`, `PLATFORM_FEE`, `MERCHANT_PAYABLE`, `REFUNDS`, `MARKETING_FEE`), audit log. |

**34/34 smoke tests pass** and **36/36 mobile checks pass**, covering the full lifecycle:
search → detail → calendar → checkout → hold → pay → issue → scan → redeem → cancel →
refund.

---

## Quickstart

```bash
cp .env.example .env          # defaults work as-is for local dev
pnpm install
pnpm setup                    # docker compose up + prisma push + seed
pnpm dev                      # API on :4000, web on :3000
```

Open **http://localhost:3000**.

### Public preview

In a GitHub Codespace only **one** forwarded port is needed:

```bash
bash scripts/preview.sh          # print the URL, verify both services answer
bash scripts/preview.sh --open   # ...and open the storefront

gh codespace ports visibility 3000:public -c "$CODESPACE_NAME"
```

The storefront proxies `/api/v1`, `/media` and `/health` to the API
(`apps/web/next.config.ts`), so the browser stays on a single origin.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | *(empty)* | The **browser** calls its own origin. Only set this when the API genuinely lives elsewhere — doing so re-introduces CORS. |
| `API_INTERNAL_URL` | `http://localhost:4000` | Server-side API origin, used by SSR *and* as the proxy target. |
| `API_PUBLIC_URL` | — | Public **storefront** origin, added to the API's CORS allowlist. Only relevant if you bypass the proxy. |

**Why same-origin rather than two tunnels.** A second forwarded port is one more
thing that can silently drop, and it forces CORS to be correct forever.
Proxying keeps SSR on the internal network (no round-trip through the tunnel),
keeps the browser on one origin, and makes the allowlist a non-issue.

> The API still enforces CORS for direct callers: an unlisted origin gets no
> `access-control-allow-origin` header, so the browser blocks the response even
> when the request itself succeeds. Ports 5432 (Postgres) and 6379 (Redis) must
> stay **private** — never expose them.

### Individual steps

```bash
pnpm infra:up                # postgres + redis
pnpm db:generate             # generate the Prisma client
pnpm db:push                 # sync the schema
pnpm db:seed                 # catalogue, inventory, demo orders, staff accounts
pnpm dev:api                 # Fastify on :4000
pnpm dev:web                 # Next.js on :3000
pnpm smoke                   # end-to-end API test suite
pnpm typecheck               # both packages
```

### Optional services

OpenSearch and MinIO are behind compose profiles, because they aren't needed to run the
platform — the API degrades gracefully without them:

```bash
docker compose --profile search  up -d    # OpenSearch  → real faceted search
docker compose --profile storage up -d    # MinIO        → real object storage
```

Without OpenSearch, search falls back to Postgres full-text. Without MinIO, ticket
artefacts are written to `apps/api/storage/` and served by the API's `/media` route.

---

## Demo accounts

All use the password **`Password123!`**.

| Email | Role | What they can see |
| --- | --- | --- |
| `traveler@voyahub.test` | Customer | Bookings, e-tickets, points, reviews |
| `admin@voyahub.test` | Admin | Dashboard, ledger, coupons, audit, staff tools |
| `operator@voyahub.test` | Operator | Gate scanner at `/admin/scan` |
| `merchant@voyahub.test` | Merchant | Own products and payouts |
| `support@voyahub.test` | Support | Customer lookup, wallet adjustments, goodwill refunds, coupon verification |

The login page has one-click fill buttons for the customer and staff accounts.

> **Support sits *below* admin on purpose.** The cheapest way to stop an agent from
> breaking pricing is to never let them reach it: `SUPPORT` cannot touch the catalogue,
> pricing rules, inventory or staff accounts. Every support mutation writes an
> `AuditLog` row, and money movement additionally writes a `WalletTransaction` — so
> support activity stays reconstructable after the fact.

## Test cards

The mock gateway is deterministic, so checkout can be exercised without a processor:

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Approved |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 0119` | Processing failure |
| `4000 0000 0000 3220` | Requires 3-D Secure |

---

## Architecture

```
apps/
  api/                    Fastify 5 + Prisma 5 + PostgreSQL
    prisma/schema.prisma  ~60 models
    src/modules/
      pricing/            rule engine → Quote
      inventory/          hold / consume / release / expire
      booking/            order lifecycle, refunds
      payments/           PaymentGateway (mock | hyper)
      ticketing/          QR, PDF, S3-or-disk persistence
      search/             Postgres FTS ⇄ OpenSearch
    src/routes/           11 route modules, ~75 endpoints
  web/                    Next.js 15 (App Router, RSC) + React 19
    src/app/              storefront routes + (console)/admin + (console)/support
    src/lib/api.ts        fully typed API client
    src/lib/session.ts    token in localStorage *and* a readable cookie
    src/lib/i18n/         locale config + EN/ZH dictionaries
    src/components/       booking panel, calendar, checkout, ticket wallet, consoles
```

### Decisions worth knowing about

**Money is always integer minor units.** Every amount is `number` cents plus an ISO
currency code. Percentages are basis points. `allocate()` splits a total across lines
without ever creating or losing a cent, so a $100.00 order divided three ways still sums
to exactly $100.00.

**Prices never mutate.** An `OrderItem` snapshots the full pricing decision — base price,
each rule that fired, markup, tax, fee — plus a `ruleTrace` JSON blob. A price change
tomorrow can never alter what someone paid today, and support can always explain a
number.

**Holds, not reservations-at-payment.** Checkout places a TTL hold (15 min by default).
Payment consumes it; abandonment or a background sweep releases it. A sweeper runs every
60 s, so abandoned carts don't leak inventory.

**One product shape for everything sellable.** Attraction tickets, hotel rooms, tours and
transfers are all `Product → TicketType`. The booking engine has exactly one code path,
which is why adding a category doesn't mean adding a subsystem.

**Graceful degradation everywhere.** Redis → in-memory; OpenSearch → Postgres; S3 → local
disk. The platform boots and works with only Postgres running, which keeps onboarding and
CI honest.

**Auth uses a readable cookie as well as localStorage.** Server components can then
pre-render `/orders/[id]` with real content instead of a skeleton. The client component
re-fetches on mount, so a stale cookie can't strand anyone.

---

## Three surfaces, one app

The platform ships as three visually and logically distinct surfaces:

| Surface | Route | Who | Cannot see |
| --- | --- | --- | --- |
| **Storefront** | `/`, `/search`, `/products/*`, `/checkout`, `/orders`, `/tickets`, `/loyalty` | Customers | Anything staff-related |
| **Operations** | `/admin`, `/admin/finance`, `/admin/scan`, `/admin/promo` | Admin, Operator, Merchant | — |
| **Support** | `/support`, `/support/orders`, `/support/coupons`, `/support/audit` | Support, Admin | Catalogue, pricing rules, inventory, staff accounts |

Each console gets its own colour identity (admin = brand blue, support = teal) so an
operator working across a handover can tell at a glance which surface they are in — the
cheapest possible guard against acting in the wrong system.

**A customer never sees a staff entry point.** This is enforced in three places, because
one is not enough:

1. `Header.tsx` gates its links through a `STAFF_ROUTES` role map.
2. `Footer.tsx` has no staff column at all (it used to leak `/admin`, `/admin/scan` and
   `/admin/finance`).
3. Every console route is guarded server-side by `requireRole(...)`, and `ConsoleShell`
   re-checks the role before rendering any data view.

> **Note on isolation.** `/admin` and `/support` are routes inside the same Next.js app,
> so a *signed-in staff member* navigating directly by URL will reach the console — that
> is intended. What is guaranteed is that a customer account cannot (`403`), and that no
> customer-visible page advertises the URL. True network-level separation — separate
> hostnames, separate deploys, no shared bundle — is a different architecture.

---

## Internationalisation

The UI ships in **English and Chinese**, switchable from the header on every page and
from inside each console.

**Server-rendered locale, not a client context.** `resolveServerLocale()` reads a
`voyahub_lang` cookie and falls back to `Accept-Language`. Most of this site is
server-rendered, so a client-side locale provider would leave the *common* case rendering
in the previous language until the next navigation. Switching locale writes the cookie and
calls `router.refresh()`, which re-renders on the server in the new language.

**English is the source of truth.** The `en` object defines the shape; `zh` is validated
against it with `satisfies Record<LocaleCode, typeof en>`. A missing or misspelled Chinese
key is therefore a **compile error**, not a blank string in production. Values may be
functions, so counts and currency interpolate per language rather than concatenating
English grammar.

**Dates, money and weekday names go through `Intl`.** `formatMoney`, `formatDate` and
`relativeDay` all take a locale; the availability calendar derives its weekday headers and
month names from `Intl.DateTimeFormat` instead of a hard-coded array.

**Content is localised at the edge, not in the client.** `GET /promo/banners?locale=zh`
resolves the language server-side and returns one `title` / `body` / `ctaLabel`, so the
component renders what it is given and never has to know a fallback exists.

---

## Promotional banners

Operators place merchandising on the storefront without a deploy:

- `/admin/promo` — bilingual editor (separate EN and ZH title, body and CTA), theme
  picker, start/end schedule, active toggle, sort order, market and locale targeting.
- The homepage renders an eligible banner via `<PromoStrip slot="home" />`, revalidating
  every 5 minutes rather than reading through on every request.
- Clicks are counted with a fire-and-forget `POST /promo/banners/:id/click`.

Seed data ships three banners so the strip is visible immediately after `pnpm db:seed`.

---

## Support tooling

The support console is deliberately narrower than admin:

- **Customer lookup** by name, email or phone, plus a full profile view (orders, wallet
  ledger, loyalty).
- **Profile corrections** — name, phone, locale, country, marketing opt-in, wallet
  enablement, points and tier. `email`, `password` and `role` are **excluded**: those are
  account-takeover and privilege-escalation vectors, and belong in a separate, audited flow.
- **Wallet adjustments** with a mandatory reason. Signed amounts, and a debit that would
  take a balance negative is refused.
- **Goodwill refunds** against a paid order. The refund lands as wallet credit, writes a
  `REFUNDS`/`DEBIT` ledger pair and a `Refund` row. Guest orders (`userId: null`) are
  rejected, because there is no account to credit.
- **Coupon verification** (read-only — creating coupons changes revenue, so that stays in
  admin).
- **Audit trail** for every support action.

---

## API reference

Base URL `/api/v1`. Auth via `Authorization: Bearer <token>`.

**Discovery** — `GET /search`, `/destinations`, `/collections/:slug`
**Products** — `GET /products/:slug`, `/products/:slug/availability`, `/products/:slug/nearby`
**Auth** — `POST /auth/register`, `/auth/login`; `GET|PATCH /auth/me`; `POST /auth/travelers`
**Orders** — `POST /orders`, `GET /orders`, `/orders/:id`, `/orders/lookup`,
`POST /orders/:id/pay`, `GET /orders/:id/cancellation-quote`, `POST /orders/:id/cancel`
**Payments** — `POST /webhooks/payment`
**Tickets** — `GET /tickets`, `/tickets/:ticketNumber`, `POST /tickets/:ticketNumber/transfer`,
`/tickets/transfer/:token/accept`, `/tickets/recover`
**Gate** — `POST /scan/verify`, `/scan/redeem`; `GET /scan/stats`
**Social** — `GET|POST /products/:slug/reviews`, `POST /reviews/:id/helpful`,
`GET|POST /wishlist`, `DELETE /wishlist/:productId`
**Loyalty** — `GET /loyalty/program`, `/loyalty/account`; `POST /loyalty/redeem`
**Itinerary** — `GET|POST /itineraries`, `POST /itineraries/:id/items`
**Admin** — `GET /admin/dashboard`, `/admin/products`, `/admin/orders`, `/admin/inventory`,
`/admin/finance/ledger`, `/admin/coupons`, `/admin/merchants`, `/admin/reviews`,
`/admin/audit`; `POST /admin/inventory/adjust`, `/admin/pricing/simulate`,
`/admin/search/reindex`, `/admin/finance/settle`, `/admin/bootstrap`
**Promotions** — `GET /promo/banners` (public, locale-resolved), `POST /promo/banners/:id/click`;
`GET|POST|PATCH|DELETE /admin/promo/banners[/:id]`
**Support** — `GET /support/customers`, `/support/customers/:id`,
`GET /support/orders/lookup`, `GET /support/coupons/:code/verify`, `GET /support/audit`;
`PATCH /support/customers/:id`, `POST /support/customers/:id/wallet`,
`POST /support/orders/:id/refund`
**Artefacts** — `GET /media/tickets/:ticketNumber/{qr.png,ticket.pdf}`

Every route accepts a `locale` query parameter (`en`, `zh`) and falls back to
`Accept-Language`, then the user's stored locale, then `en-US`.

Operations: `GET /health`, `GET /ready` (per-dependency readiness).

---

## Testing

```bash
bash scripts/smoke-test.sh    # 34 checks, requires both services running
bash scripts/mobile-check.sh  # 36 checks, responsive layer regression guard
pnpm typecheck                # strict TS across api + web
pnpm --filter @voyahub/web build
pnpm verify                   # typecheck + smoke + mobile, one command
```

The smoke suite is end-to-end against a live stack — it books a real order, pays it,
redeems the ticket at the gate, and asserts the second scan is rejected.

`mobile-check.sh` reads the **built** CSS at `apps/web/.next/static/css/*.css`, so run
`pnpm --filter @voyahub/web build` first. `next dev` deletes that directory, which is why
the check fails with "no built CSS found" if the dev server is the last thing that ran —
run the build, then `next start`.

---

## Mobile

The storefront is built mobile-first and targets iOS Safari and Chrome on Android.
`pnpm check:mobile` asserts the responsive layer survives future edits.

**One breakpoint scale.** 960 / 860 / 640 / 400 / 380px. Layout shells collapse at
**860px**, which is where a rail can no longer sit beside content without squeezing it.

**Page shells use `.with-rail`, not inline widths.** Every page pairs a main column with a
rail (filters, booking panel, order summary). The rail drops below the content on narrow
screens, defined in exactly one place.

**Cards stack rather than shrink.** Ticket passes put the QR above the details on a phone
and widen it to 160px — a gate scanner needs a big, high-contrast target.

**Touch targets are ≥44px.** Filter disclosure, tab rows and the mobile nav are all sized
for a thumb, not a cursor.

**16px inputs.** Anything smaller makes iOS Safari zoom the viewport on focus, which
strands the shopper mid-form.

**Zoom stays available** (`maximum-scale=5`). Pinching to read a booking reference is a
real need; accidental zoom is prevented with `touch-action` instead of by blocking pinch.

**Notched devices.** The sticky booking CTA adds `env(safe-area-inset-bottom)` padding, so
the primary action never sits under the home indicator.

**No sideways scroll.** `overflow-x: hidden` is a backstop only — wide tables scroll inside
`.table-scroll` and long strings use `overflow-wrap: anywhere`, so content is never
trapped off-screen.

**Accessible.** Skip link, `:focus-visible` rings, `aria-expanded` on both disclosures,
and full `prefers-reduced-motion` support.

**JS stays optional where it can.** The filter form is a plain server-rendered
`<form method="get">`; only the collapse behaviour needs JavaScript, and it degrades to
always-open if the script never loads.

---

## Configuration

Everything is environment-driven with working defaults; see `.env.example`.

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://voyahub:voyahub@localhost:5432/voyahub` | |
| `REDIS_URL` | `redis://localhost:6379` | Falls back to memory if absent |
| `PAYMENT_PROVIDER` | `mock` | `hyper` for Hyperswitch |
| `INVENTORY_HOLD_MINUTES` | `15` | Checkout hold TTL |
| `MARKUP_BPS` | `1200` | Platform markup, in basis points |
| `OPENSEARCH_URL` | — | Empty ⇒ Postgres FTS |
| `S3_ENDPOINT` / `S3_BUCKET` | — | Empty ⇒ local disk |
| `JWT_SECRET` | dev value | **Must** be set in production |

---

## License

MIT.
