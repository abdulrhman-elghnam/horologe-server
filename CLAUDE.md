# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also `AGENTS.md` (NestJS version notes, first-party `@nestjs/*` packages to prefer, Observe telemetry). Its rules apply here too.

## Project

Horologe server: the backend for a watch store e-commerce app (catalog, cart, orders, payments, shipping, reviews, real-time notifications). It's built on NestJS 12, is ESM-only, and uses TypeScript 6.

The product spec is in `public/design/`:
- `watch-store-api.txt` lists every REST route with its role (`PUBLIC`/`AUTH`/`ADMIN`), the Socket.IO `/realtime` namespace events, and the security rules: never trust client-supplied userId, role, price or stock; use idempotency keys for checkout and payment webhooks; update stock atomically; save notifications before emitting them.
- `class/`, `activity/` and `usecase/` hold UML diagrams.
- `public/documentation/` has empty placeholders for Swagger and Postman.

Read the spec before you add a feature module.

## Commands

```bash
npm run start:dev        # watch mode
npm run build            # nest build -> distribution/
npm run start:prod       # node distribution/main
npm run lint             # oxlint --type-aware source/ test/
npm run format           # prettier (printWidth 160, single quotes, trailing commas)
npm test                 # vitest, unit tests (**/*.spec.ts)
npm run test:e2e         # vitest with vitest.config.e2e.ts (**/*.e2e-spec.ts)
npx vitest run source/app.controller.spec.ts   # one file
npx vitest run -t "should return"              # by test name
```

Some paths differ from the Nest defaults. The source root is `source/` (not `src/`), and the build output goes to `distribution/` (not `dist/`). Vitest runs with `globals: true`.

## Conventions

- Relative imports must end in `.js`. Use `import.meta.dirname`, never `__dirname`.
- Each folder under `source/dependency/` and `source/database/` has an `_INDEX.ts` barrel. Several barrels are still empty. Keep a barrel up to date when you add files to its folder.
- Oxlint treats `typescript/no-floating-promises` as an error, so every promise must be awaited or handled.
- Repository and service methods take one object argument (`{ filter, update, options }`, `{ key, value }`), not positional arguments.
- Validation uses Zod 4. Today that runs through the custom `CustomValidationPipe(schema)` in `dependency/pipe/`; AGENTS.md also points to Nest's `StandardSchemaValidationPipe`.

## Architecture

The code is mostly infrastructure scaffolding at this stage. `AppModule` currently imports only `RealtimeModule` (an empty Socket.IO gateway in `source/application/`). Most of `source/dependency/` is written but **not yet registered** in any module, so wiring it up is usually part of a task.

- `source/dependency/` holds cross-cutting building blocks:
  - `guard/`: `AuthGuard` reads a Bearer token from HTTP headers or the Socket.IO handshake. It verifies the token through `TokenService` and attaches `req.credentials = { user, decoded }`. `RolesGuard` checks the result. You pick the token type with `@Token(TokenEnum.REFRESH)` and the roles with `@Role([...])`, both from `decorator/`.
  - `service/`:
    - `TokenService` handles JWT access and refresh tokens; it tracks a token's `jti` in Redis.
    - `CacheService` wraps ioredis, which it gets injected as `'REDIS_CLIENT'`. It also does Lua-based rate limiting, and its `RedisKeys` builders define the key naming.
    - `StorageService` stores files AES-encrypted on local disk under `storage/` and serves them through HMAC-signed URLs (`SignedUrl` in `presenter.ts`, `API_PREFIX = /api/v1`).
    - There are also security, logger and util services.
  - `interceptor/`: `TransformInterceptor` wraps every HTTP response as `{ message, data }` (it skips `StreamableFile`). There are also timeout, logging and cache interceptors.
  - `language/`: i18n (`en`/`ar`) through `@nestjs/i18n`. `Localize.text('english message')` reverse-looks-up the English string in `source/i18n/en/errors.json` (including `{param}` templates) and translates it. So throw exceptions with plain English messages that match that file.
  - `value/`: enums. **Watch out:** `SystemRoleEnum` still holds `doctor`/`patient`, left over from another project. The spec's roles are GUEST, CUSTOMER, ADMIN and SUPER_ADMIN.
- `source/database/`: `model/` holds entities and `repository/` holds data access. Each repository extends the generic `DatabaseRepository<T>` in `base.repository.ts`.

### In-progress database migration

The project is moving from Mongoose to **TypeORM + Postgres** (`@nestjs/typeorm`, `typeorm`, `pg`); the API spec's mention of MongoDB is outdated. Already migrated:
- `base.repository.ts`: generic `DatabaseRepository<T extends { id: string }>` wrapping a TypeORM `Repository<T>`. Methods take `{ where, data, options, manager }`, where `manager` is an `EntityManager` used to run the call inside a transaction.
- `user.model.ts` (the `User` entity: uuid `id`, snake_case columns, `@VersionColumn` in place of `__v`) and `user.repository.ts`.

Entities use uuid string ids (`id`, not `_id`/`ObjectId`). These files still import `mongoose` or `HUserDocument` and don't compile yet: `token.service.ts`, `util.service.ts`, `ctx.interface.ts`, `user.decorator.ts` and `object-id.pipe.ts`. `TypeOrmModule.forRoot`/`forFeature` isn't wired up yet either.

## Configuration

`ConfigService` keys used so far:
- `ACCESS_TOKEN_EXPIRES_IN` and `REFRESH_TOKEN_EXPIRES_IN` (seconds)
- `ACCESS_USER_TOKEN_SIGNATURE` and `REFRESH_USER_TOKEN_SIGNATURE`
- `encryption.key`
- `storage.directory`

`ConfigModule` isn't registered yet, and `source/app.configuration.ts` is empty. The server listens on `PORT`, which defaults to 3000.
