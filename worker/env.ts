export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID?: string;
  GEMINI_API_KEY?: string;
  DEV_AUTH?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}
