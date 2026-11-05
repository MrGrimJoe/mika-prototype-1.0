export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_APP_ID?: string;
  DEV_AUTH?: string;

  // ---- Integrations (see INTEGRATION_SECRETS.md). All optional: an unset or REPLACE_ME value
  // just means that integration answers 501 "not_configured" instead of working.
  APP_URL?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  OAUTH_STATE_SECRET?: string;
  GITHUB_APP_SLUG?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  FIGMA_CLIENT_ID?: string;
  FIGMA_CLIENT_SECRET?: string;
  CANVA_CLIENT_ID?: string;
  CANVA_CLIENT_SECRET?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}
