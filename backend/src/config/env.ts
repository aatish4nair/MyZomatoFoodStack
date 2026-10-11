import { z } from 'zod';

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.string().refine(isOrigin, 'Each entry must be a bare origin like https://example.com'),
      )
      .min(1, 'At least one origin is required'),
  );

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

/** Hosts the API may bind to by default: this computer only. */
export const LOOPBACK_HOSTS = ['127.0.0.1', '::1', 'localhost'] as const;

/**
 * "All interfaces", as a hosting platform such as Render requires. Accepted ONLY with
 * NODE_ENV=production and an explicit list of hostnames the API answers to (see superRefine).
 */
export const PUBLIC_BIND_HOSTS = ['0.0.0.0', '::'] as const;

/** A bare hostname such as my-api.onrender.com (no scheme, port or path). */
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

const hostnameList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(
    z.array(
      z.string().regex(HOSTNAME, 'Each entry must be a bare hostname like my-api.onrender.com'),
    ),
  );

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z
      .string()
      .min(1)
      .default('127.0.0.1')
      .refine(
        (host) => ([...LOOPBACK_HOSTS, ...PUBLIC_BIND_HOSTS] as readonly string[]).includes(host),
        'Must be 127.0.0.1, ::1 or localhost (or 0.0.0.0 / :: for a production deployment)',
      ),
    /**
     * Hostnames (besides localhost) the API answers to, e.g. the Render service and static-site
     * hostnames. Requests addressed to any other hostname are refused.
     */
    ALLOWED_HOSTS: hostnameList.default([]),
    /** Set automatically by Render to the service's public hostname; added to ALLOWED_HOSTS. */
    RENDER_EXTERNAL_HOSTNAME: optionalText.pipe(
      z.string().toLowerCase().regex(HOSTNAME, 'Expected a bare hostname').optional(),
    ),
    /**
     * How many reverse proxies in front of the API to trust for the client address
     * (X-Forwarded-For), so rate limiting applies per visitor. 0 = trust none (local default).
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: originList.default(['http://localhost:5173']),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

    // --- Google Sheets (all optional; without GOOGLE_SHEET_ID the data endpoints report NOT_CONFIGURED)
    GOOGLE_SHEET_ID: optionalText.pipe(
      z
        .string()
        .regex(/^[A-Za-z0-9_-]{20,100}$/, 'Expected the ID part of the spreadsheet URL')
        .optional(),
    ),
    GOOGLE_SHEET_RANGE: z
      .string()
      .trim()
      .regex(
        /^(?:'[^']+'|[A-Za-z0-9 _-]+)!\$?[A-Z]{1,2}\$?\d*:\$?[A-Z]{1,2}\$?\d*$/,
        "Expected a column-bounded range such as 'Formatted Data'!A:J",
      )
      .default("'Formatted Data'!A:J"),
    GOOGLE_SERVICE_ACCOUNT_KEY_FILE: optionalText.pipe(
      z
        .string()
        .refine((p) => p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p), 'Must be an absolute path')
        .optional(),
    ),
    GOOGLE_SERVICE_ACCOUNT_JSON: optionalText.pipe(
      z
        .string()
        .refine(isServiceAccountJson, 'Must be a service-account key in JSON form')
        .optional(),
    ),
    SHEET_CACHE_TTL_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
    SHEET_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
    SHEET_MAX_ROWS: z.coerce.number().int().min(1).max(100_000).default(20_000),
  })
  .superRefine((env, ctx) => {
    const publicBind = (PUBLIC_BIND_HOSTS as readonly string[]).includes(env.HOST);
    if (publicBind && env.NODE_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['HOST'],
        message: `${env.HOST} is only allowed with NODE_ENV=production; use 127.0.0.1 for local development`,
      });
    }
    if (
      publicBind &&
      env.ALLOWED_HOSTS.length === 0 &&
      env.RENDER_EXTERNAL_HOSTNAME === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ALLOWED_HOSTS'],
        message: `HOST=${env.HOST} needs ALLOWED_HOSTS (or Render's RENDER_EXTERNAL_HOSTNAME): the hostnames the API answers to`,
      });
    }
    if (env.TRUST_PROXY_HOPS > 0 && env.NODE_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY_HOPS'],
        message: 'Only trust proxy headers in production, behind a known proxy',
      });
    }
    const credentialCount =
      Number(env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE !== undefined) +
      Number(env.GOOGLE_SERVICE_ACCOUNT_JSON !== undefined);
    if (env.GOOGLE_SHEET_ID !== undefined && credentialCount === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_SERVICE_ACCOUNT_KEY_FILE'],
        message:
          'GOOGLE_SHEET_ID is set, so set GOOGLE_SERVICE_ACCOUNT_KEY_FILE (recommended) or GOOGLE_SERVICE_ACCOUNT_JSON',
      });
    }
    if (credentialCount === 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_SERVICE_ACCOUNT_JSON'],
        message: 'Set only one of GOOGLE_SERVICE_ACCOUNT_KEY_FILE and GOOGLE_SERVICE_ACCOUNT_JSON',
      });
    }
    if (env.GOOGLE_SHEET_ID === undefined && credentialCount > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_SHEET_ID'],
        message: 'Credentials are set but GOOGLE_SHEET_ID is missing',
      });
    }
  });

function isServiceAccountJson(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      parsed.type === 'service_account' &&
      'client_email' in parsed &&
      'private_key' in parsed
    );
  } catch {
    return false;
  }
}

export type Env = z.infer<typeof EnvSchema>;

export type SheetCredentials = { kind: 'key-file'; path: string } | { kind: 'json'; json: string };

export interface SheetsConfig {
  spreadsheetId: string;
  range: string;
  credentials: SheetCredentials;
  timeoutMs: number;
  cacheTtlMs: number;
  maxRows: number;
}

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Hostnames requests may be addressed to (Host header): always localhost, plus ALLOWED_HOSTS and
 * Render's own service hostname. Anything else is refused (see middleware/local-only.ts).
 */
export function allowedHostnames(env: Env): string[] {
  return [
    ...new Set([
      ...LOCAL_HOSTNAMES,
      ...env.ALLOWED_HOSTS,
      ...(env.RENDER_EXTERNAL_HOSTNAME ? [env.RENDER_EXTERNAL_HOSTNAME] : []),
    ]),
  ];
}

/** The Google Sheets settings, or null when the data source is not configured at all. */
export function sheetsConfig(env: Env): SheetsConfig | null {
  if (env.GOOGLE_SHEET_ID === undefined) return null;
  const credentials: SheetCredentials | null =
    env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE !== undefined
      ? { kind: 'key-file', path: env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE }
      : env.GOOGLE_SERVICE_ACCOUNT_JSON !== undefined
        ? { kind: 'json', json: env.GOOGLE_SERVICE_ACCOUNT_JSON }
        : null;
  if (!credentials) return null;
  return {
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: env.GOOGLE_SHEET_RANGE,
    credentials,
    timeoutMs: env.SHEET_REQUEST_TIMEOUT_MS,
    cacheTtlMs: env.SHEET_CACHE_TTL_SECONDS * 1000,
    maxRows: env.SHEET_MAX_ROWS,
  };
}

/**
 * Validates configuration at startup. On failure it throws an error naming the
 * offending variables, never their values (they may be secrets).
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return result.data;
}
