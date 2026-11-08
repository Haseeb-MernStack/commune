export interface Config {
  port: number;
  /** The web app's origin. Browsers from any other origin are refused. */
  clientOrigin: string;
  /** Same value as the API's JWT_ACCESS_SECRET: access tokens are verified here. */
  jwtSecret: string;
  /** Shared with the API. Lets the API push events here and this service ask the API questions. */
  internalSecret: string;
  /** Base address of the API, for membership lookups, e.g. https://commune-8im5.vercel.app */
  apiUrl: string;
  maxConnectionsPerUser: number;
}

const clean = (v: string | undefined) => (v ?? "").trim();

function origin(value: string, name: string, errors: string[]): string {
  try {
    const u = new URL(value);
    return u.origin;
  } catch {
    errors.push(`${name} must be a full URL such as https://example.com`);
    return "";
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const errors: string[] = [];
  const jwtSecret = clean(env.JWT_ACCESS_SECRET);
  if (jwtSecret.length < 32)
    errors.push("JWT_ACCESS_SECRET must be at least 32 characters (the same value as the API)");
  const internalSecret = clean(env.REALTIME_SECRET);
  if (internalSecret.length < 32)
    errors.push("REALTIME_SECRET must be at least 32 characters (the same value as the API)");
  const clientOrigin = origin(clean(env.CLIENT_ORIGIN), "CLIENT_ORIGIN", errors);
  const apiUrl = origin(clean(env.API_URL), "API_URL", errors);
  const port = Number(env.PORT ?? 4100);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    errors.push("PORT must be a valid port number");
  if (errors.length > 0)
    throw new Error(`Invalid realtime configuration:\n  ${errors.join("\n  ")}`);
  return { port, clientOrigin, jwtSecret, internalSecret, apiUrl, maxConnectionsPerUser: 8 };
}
