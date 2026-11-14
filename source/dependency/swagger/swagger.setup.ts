import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import { RealtimeEvent } from '../../application/realtime/realtime.event.js';

/** Security scheme names used by `@ApiBearerAuth(...)`. */
export const BEARER = { access: 'access-token', refresh: 'refresh-token' } as const;

/** Swagger UI is served at `/api/v1/docs`, the raw OpenAPI JSON at `/api/v1/docs/json`. */
export const SWAGGER_PATH = 'docs';

/** Socket.IO can't be described in OpenAPI, so the event list is rendered into the description (always in sync with the code). */
const realtimeEvents = () =>
  Object.values(RealtimeEvent)
    .map((event) => `\`${event}\``)
    .join(' · ');

const DESCRIPTION = `
REST API of the Horologe watch store.

### Responses
Every successful response is wrapped as \`{ "message": string, "data": <payload> }\`. The schemas below describe \`data\`.
Errors look like \`{ "statusCode": number, "message": string | string[], "error": string, "code"?: string }\`.
\`code\` is a stable machine-readable reason, for example \`OUT_OF_STOCK\`, \`CART_EMPTY\`, \`COUPON_EXPIRED\` or \`INVALID_ORDER_TRANSITION\`.

### Authentication
1. \`POST /auth/login\` returns \`accessToken\` and \`refreshToken\`.
2. Click **Authorize** and paste the access token into **${BEARER.access}**.
3. \`POST /auth/refresh\` takes the refresh token under **${BEARER.refresh}**.

Roles: **customer**, **admin** (\`/admin/*\`) and **super_admin** (\`/super-admin/*\`, and everything an admin can do).

### Validation and limits
- Request bodies are validated. Unknown fields are rejected with \`400\`.
- Prices, totals, stock and user ids are never taken from the client.
- Rate limits are per IP. A limited request gets \`429\`.

### Checkout and webhooks
- \`POST /orders/checkout\` accepts an \`Idempotency-Key\` header. Retrying with the same key returns the same order.
- Payment and shipping webhooks (\`POST /payments/webhooks/:provider\`, \`POST /shipping/webhooks/:provider\`) are authenticated by an HMAC-SHA256 signature over the raw body, sent in \`x-mock-signature\` for the mock provider. See \`scripts/mock-webhook.mjs\`.

### Realtime (Socket.IO)
Connect to the \`/realtime\` namespace with \`io(origin + '/realtime', { auth: { token: accessToken } })\`.
Join rooms with \`order:subscribe { orderId }\`, \`watch:subscribe { watchId }\` or \`inventory:subscribe\` (admins only).
Errors arrive as \`realtime:error { code, message }\`.

Events: ${realtimeEvents()}
`;

export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('Horologe API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token from /auth/login' }, BEARER.access)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Refresh token, only for /auth/refresh' }, BEARER.refresh)
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // `UserController.updateProfile` -> `User_updateProfile`: short, and unique across controllers.
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
  return wrapSuccessResponses(document);
};

/** TransformInterceptor wraps every JSON success body as `{ message, data }`; make the documented schemas say so too. */
const wrapSuccessResponses = (document: OpenAPIObject): OpenAPIObject => {
  for (const operations of Object.values(document.paths)) {
    for (const operation of Object.values(operations) as { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }[]) {
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        const json = response.content?.['application/json'];
        if (!status.startsWith('2') || !json?.schema) continue;
        json.schema = { type: 'object', properties: { message: { type: 'string', example: 'request accepted' }, data: json.schema } };
      }
    }
  }
  return document;
};

/** Mounts Swagger UI and the JSON document on the running app. */
export const setupSwagger = (app: INestApplication): void => {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
    customSiteTitle: 'Horologe API docs',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      displayRequestDuration: true,
    },
  });
};
