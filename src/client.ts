import { getRegistryUrl } from "./registry.js";

export { getRegistryUrl };

let storedToken: string | undefined = process.env.VERDACCIO_TOKEN;

export function setToken(token: string): void {
  storedToken = token;
}

export function getToken(): string | undefined {
  return storedToken;
}

export function buildHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const bearer = token ?? storedToken;
  if (bearer) {
    headers["Authorization"] = `Bearer ${bearer}`;
  }
  return headers;
}

/**
 * Resolve an endpoint pattern from @verdaccio/middleware into a full URL.
 * Replaces :param tokens and strips optional segments like {/:version}.
 */
export async function resolveEndpoint(
  pattern: string,
  params: Record<string, string> = {}
): Promise<string> {
  const base = await getRegistryUrl();
  let path = pattern;

  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }

  // Unwrap filled optional segments, drop unfilled ones e.g. {/:version}
  path = path.replace(/\{([^}]*)\}/g, (_, segment: string) =>
    segment.includes(":") ? "" : segment
  );

  return `${base}${path}`;
}
