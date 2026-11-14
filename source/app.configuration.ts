export const NODE_ENV = process.env.NODE_ENV ?? 'development';

const toInt = (value: string | undefined, fallback: number) => parseInt(value ?? '', 10) || fallback;

export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'Horologe',
    port: toInt(process.env.PORT, 3000),
    corsOrigin: (process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    maintenance: ['1', 'true'].includes(process.env.MAINTENANCE_MODE?.toLowerCase() ?? ''),
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  redis: {
    uri: process.env.REDIS_URI,
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: toInt(process.env.REDIS_PORT, 6379),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.OAUTH_GOOGLE_CLIENT_ID,
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME ?? 'Super Admin',
    city: process.env.ADMIN_CITY ?? 'Cairo',
  },
  auth: {
    issuer: process.env.AUTH_ISSUER,
  },
  mail: {
    host: process.env.SMTP_HOST ?? (process.env.APP_MAIL ? 'smtp.gmail.com' : undefined),
    port: toInt(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? process.env.APP_MAIL,
    password: process.env.SMTP_PASSWORD ?? process.env.APP_PASSWORD,
    from: process.env.MAIL_FROM ?? (process.env.APP_MAIL ? `"${process.env.APP_NAME ?? 'Horologe'}" <${process.env.APP_MAIL}>` : undefined),
  },
  storage: {
    directory: process.env.STORAGE_DIR ?? 'storage',
    maxImageSizeMb: toInt(process.env.MAX_IMAGE_SIZE_MB, 10),
  },
  docs: {
    /** Swagger UI at /api/v1/docs. On by default outside production; force with SWAGGER_ENABLED=true|false. */
    enabled: process.env.SWAGGER_ENABLED ? process.env.SWAGGER_ENABLED === 'true' : NODE_ENV !== 'production',
  },
  rateLimit: {
    /** In-memory Nest throttler. Set RATE_LIMIT_ENABLED=false for local load/smoke tests. */
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    /** Default per-IP budget for routes without a stricter @RateLimit.*() decorator. */
    limit: toInt(process.env.RATE_LIMIT_MAX, 100),
    ttlSeconds: toInt(process.env.RATE_LIMIT_TTL_SECONDS, 60),
  },
  commerce: {
    currency: (process.env.STORE_CURRENCY ?? 'USD').toUpperCase(),
    /** Minutes a pending order keeps its reserved stock before it expires. */
    paymentWindowMinutes: toInt(process.env.PAYMENT_WINDOW_MINUTES, 30),
    /** Days after delivery during which a customer can request a return. */
    returnWindowDays: toInt(process.env.RETURN_WINDOW_DAYS, 14),
  },
  payment: {
    defaultProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
    mockWebhookSecret: process.env.PAYMENT_MOCK_WEBHOOK_SECRET,
  },
  shipping: {
    provider: process.env.SHIPPING_PROVIDER ?? 'mock',
    mockWebhookSecret: process.env.SHIPPING_MOCK_WEBHOOK_SECRET,
    /** ISO country (or name) the store ships from; other countries pay the international surcharge. */
    homeCountry: (process.env.SHIPPING_HOME_COUNTRY ?? 'Egypt').trim().toLowerCase(),
  },
  ai: {
    mode: (process.env.AI_MODE ?? 'disabled').toLowerCase() as 'disabled' | 'mock' | 'remote',
    url: process.env.AI_SERVICE_URL,
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 20_000),
    apiKey: process.env.AI_SERVICE_API_KEY,
  },
});
