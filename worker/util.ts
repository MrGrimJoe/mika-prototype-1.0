import { HttpError } from './env';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

export function randomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `${prefix}_${Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('')}`;
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

/** Tiny pattern router: "/api/orgs/:orgId/links" -> { orgId }. */
export type Handler = (ctx: { req: Request; url: URL; params: Record<string, string> }) => Promise<Response>;

export class Router {
  private routes: { method: string; parts: string[]; handler: Handler }[] = [];

  add(method: string, pattern: string, handler: Handler) {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });
  }

  async handle(req: Request, url: URL): Promise<Response | null> {
    const segs = url.pathname.split('/').filter(Boolean);
    for (const r of this.routes) {
      if (r.method !== req.method || r.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(segs[i]);
        else if (r.parts[i] !== segs[i]) { ok = false; break; }
      }
      if (ok) return r.handler({ req, url, params });
    }
    return null;
  }
}
