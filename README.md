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
| **Loyalty & marketing** | Tiered points programme, earn on booking, redeem for credit, coupons (`WELCOME10`, `SAVE25`, `FIRSTTIMEBIG`). |
| **Itinerary & map** | Multi-day trip plans with geolocated stops, timezone-aware. |
| **Operations backend** | KPI dashboard, order/inventory tables, double-entry ledger (`GROSS_SALES`, `TAX_PAYABLE`, `PLATFORM_FEE`, `MERCHANT_PAYABLE`, `REFUNDS`, `MARKETING_FEE`), audit log. |

**34/34 smoke tests pass**, covering the full lifecycle: search → detail → calendar →
checkout → hold → pay → issue → scan → redeem → cancel → refund.

---

## Quickstart

```bash
cp .env.example .env          # defaults work as-is for local dev
pnpm install
pnpm setup                    # docker compose up + prisma push + seed
pnpm dev                      # API on :4000, web on :3000
```

Open **http://localhost:3000**.

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

The login page has one-click fill buttons for all four.

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
    src/routes/           9 route modules, ~60 endpoints
  web/                    Next.js 15 (App Router, RSC) + React 19
    src/lib/api.ts        fully typed API client
    src/lib/session.ts    token in localStorage *and* a readable cookie
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
**Artefacts** — `GET /media/tickets/:ticketNumber/{qr.png,ticket.pdf}`

Operations: `GET /health`, `GET /ready` (per-dependency readiness).

---

## Testing

```bash
bash scripts/smoke-test.sh    # 34 checks, requires both services running
pnpm typecheck                # strict TS across api + web
pnpm --filter @voyahub/web build
```

The smoke suite is end-to-end against a live stack — it books a real order, pays it,
redeems the ticket at the gate, and asserts the second scan is rejected.

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
