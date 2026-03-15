import { getRegistryUrl } from "./registry.js";

export { getRegistryUrl };

const VERDACCIO_TOKEN = process.env.VERDACCIO_TOKEN;

export function buildHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const bearer = token ?? VERDACCIO_TOKEN;
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

  // Remove unfilled optional segments e.g. {/:version}
  path = path.replace(/\{[^}]*\}/g, "");

  return `${base}${path}`;
}
