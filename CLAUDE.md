# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also `AGENTS.md` (NestJS version notes, first-party `@nestjs/*` packages to prefer, Observe telemetry). Its rules apply here too.

## Project

Horologe server: the backend for a watch store e-commerce app. It covers catalog, cart, wishlist/compare, coupons, orders, payments, shipping, reviews, admin reports and real-time notifications. Stack: NestJS 12 (ESM-only), TypeScript 6, Postgres via TypeORM, Redis via ioredis, Socket.IO.

The product spec is in `public/design/`:
- `watch-store-api.txt` lists every REST route with its role, the Socket.IO `/realtime` events, and the security rules. Every route in it is implemented.
- `class/`, `activity/` and `usecase/` hold UML diagrams. The DB schema follows the class diagram.

## Commands

```bash
npm run start:dev                  # watch mode (needs Postgres + Redis, see .env.example)
npm run build                      # nest build -> distribution/
npm run migration:run              # apply migrations (source/database/migration/)
npm run migration:generate -- source/database/migration/<Name>   # after changing entities
npm run lint                       # oxlint --type-aware source/ test/
npm run format                     # prettier (printWidth 160, single quotes, trailing commas)
npm test                           # vitest, unit tests (**/*.spec.ts)
npx vitest run source/application/coupon/coupon.rules.spec.ts    # one file
node scripts/mock-webhook.mjs payment payment.succeeded <txId> <orderId> <amount> [currency]
node scripts/mock-webhook.mjs shipping <trackingNumber> <status> [location]
npm run docs:openapi               # write public/documentation/swagger.json (no DB/Redis needed)
```

The source root is `source/` (not `src/`) and build output goes to `distribution/`. Vitest runs with `globals: true`. Startup seeds the super admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and the default shipping methods.

## Conventions

- Relative imports end in `.js`. Use `import.meta.dirname`, never `__dirname`.
- Each folder under `source/dependency/` and `source/database/` has an `_INDEX.ts` barrel. Keep it updated.
- Oxlint treats `typescript/no-floating-promises` as an error.
- Repository methods take one object argument: `{ where, data, options, manager }`. Pass `manager` to run inside a transaction.
- **Validation:** class-validator DTOs with a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). Unknown fields return 400. Shared decorators (`RequiredText`, `Money`, `Int`, …) are in `dependency/dto/validators.ts`, and `PaginationQueryDto` is in `dependency/dto/`.
- Never take userId, role, price, totals or stock from the client. Use `@CurrentUser('id')` and server-side prices.
- Throw exceptions with plain English messages. `Localize` translates them through `source/i18n/*/errors.json`. Business errors also carry a `code` (e.g. `OUT_OF_STOCK`, `INVALID_ORDER_TRANSITION`).
- Money is `numeric(12,2)` (`MoneyColumn`) read back as a number. Do the maths through `dependency/util/money.ts`.

## Architecture

`AppModule` has two lists:
- **INFRASTRUCTURE** (all global): config, TypeORM, `RepositoryModule` (every repository), Redis `CacheModule`, `SecurityModule`, `ProviderModule` (payment/shipping adapters), `RealtimeModule` and the throttler.
- **FEATURES**: one module per area of the spec under `source/application/<area>/`. Each module has a controller (public plus `admin-*.controller.ts` where needed), a service, `dto/`, and a `*.presenter.ts` that shapes responses.

Global providers: `ThrottlerGuard`, `TransformInterceptor` (wraps responses as `{ message, data }`), `AuditInterceptor` (writes `audit_logs` for handlers marked `@Audit(action, resource)`), and `MaintenanceMiddleware`.

### Auth

- `@Auth(...roles)`, `@AdminOnly()` and `@SuperAdminOnly()` (`dependency/decorator/auth.decorator.ts`) combine `AuthGuard` and `RolesGuard`.
- Access and refresh JWTs carry a `jti`, and that jti's session lives in Redis. Disabling a user or signing out deletes the session, so their token is rejected straight away.
- Roles are `customer`, `admin` and `super_admin`.

### Redis is only for sessions and user interaction

`CacheService` / `RedisKeys` hold:
- sessions (jti)
- OTP and password-reset tokens
- socket presence
- the unread-notification count, cached and invalidated on write

**Redis does not do rate limiting or HTTP caching.** Rate limiting is the in-memory `@nestjs/throttler`. It has a global default plus stricter `RateLimit.*()` decorators, and is configured by `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX` and `RATE_LIMIT_TTL_SECONDS`.

### Commerce flow (the parts that must stay correct)

- **Stock** (`inventory/`, `InventoryRepository`): every change is one conditional `UPDATE … RETURNING` (`reserve`, `release`, `confirm`, `adjustAvailable`) plus an `inventory_movements` ledger row. Lines are processed in variantId order to avoid deadlocks. `InventoryService.publish()` emits stock socket events after commit. Note that TypeORM `.returning([...])` takes entity property names, not column names.
- **Checkout** (`order/checkout.service.ts`) runs in one transaction:
  1. Read the cart lines and price them on the server.
  2. Lock the coupon row and reserve its usage.
  3. Reserve stock.
  4. Create the order and its item snapshots, then empty the cart.

  The `Idempotency-Key` header is backed by a partial unique index on `(user_id, idempotency_key)`. The order expires after `PAYMENT_WINDOW_MINUTES`; `order-expiry.service.ts` sweeps expired orders with `FOR UPDATE SKIP LOCKED`.
- **Order status**: every transition goes through `order.state.ts` (`canTransition`) and `OrderLifecycleService`. Lifecycle methods run inside the caller's transaction and return `OrderEffects`. The caller calls `publish(effects)` **after commit**, which saves the notification and then emits the socket events. Cancelling or returning a paid order sets `refundRequired`, and an admin refunds it through `POST /admin/payments/:id/refund`.
- **Payments / shipping**: providers sit behind the `PaymentProvider` / `ShippingProvider` interfaces (`dependency/provider/`). Only mock providers exist; they sign webhooks with HMAC-SHA256 over the raw body in the `x-mock-signature` header (`rawBody: true` in `main.ts`). Webhooks are deduplicated through `webhook_events` (unique `(source, event_id)`), written in the same transaction as the change. A payment webhook must match the payment's amount, currency and order. A successful payment confirms the order and creates the shipment. Shipment updates move the order forward (`followShipment`).
- **Coupons**: pure rules are in `coupon/coupon.rules.ts` (unit-tested). The checkout reservation is confirmed on payment and released on cancel or expiry.

### Realtime

The `/realtime` namespace:
- authenticates with a JWT in `auth.token`;
- puts each socket in `user:<id>`, and admins also in the admins room;
- allows subscribing to `order:<id>` (owner or admin), `watch:<id>` (anyone) and `inventory` (admin);
- validates payloads with a WS `ValidationPipe`, and sends errors as `realtime:error`.

`RealtimeService` is the only emitter. All event and room names are in `realtime/realtime.event.ts`.

### API docs (Swagger)

- **Where:** Swagger UI is at `/api/v1/docs` and the OpenAPI JSON at `/api/v1/docs/json`. Both are on by default outside production; set `SWAGGER_ENABLED` to override.
- **Setup:** `dependency/swagger/swagger.setup.ts`. It also lists the realtime events in the description and wraps 2xx schemas in `{ message, data }`.
- **Schemas are generated** by the `@nestjs/swagger` CLI plugin (`nest-cli.json`, `classValidatorShim`, `introspectComments`). It reads every `*.dto.ts` and `*.model.ts`, so new DTO fields are documented automatically, and a method's JSDoc becomes its summary.
- **When writing new code:**
  - Use `PartialType`/`OmitType` from `@nestjs/swagger`, not `@nestjs/mapped-types`; otherwise the derived DTO's schema is empty.
  - Every controller needs `@ApiTags(...)`.
  - `@Auth()` already adds bearer-auth docs. Use `@ApiAuth()` on routes that apply `AuthGuard` directly.
  - Mark internal entity columns with `@ApiHideProperty()`.

### Files

`StorageService` stores files AES-encrypted under `storage/`. They are served by `GET /api/v1/files/:kind/:id?exp&sig` using HMAC-signed URLs (`SignedUrl.sign`).

## Configuration

All keys are read in `source/app.configuration.ts`, and `.env.example` lists them. Env files load in this order: `.env.<NODE_ENV>.local`, then `.env.<NODE_ENV>`, then `.env`.

Gotchas:
- Setting an env var to an empty string does **not** override a value in the env file. To disable mail locally, set `MAIL_FROM=` (unset `mail.from` means codes are logged instead of emailed).
- Leaving the throttler on breaks scripted smoke tests (5 logins per minute). Run them with `RATE_LIMIT_ENABLED=false`.
