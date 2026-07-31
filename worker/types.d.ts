declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    APP_BASE_URL?: string;
    AUTH_DEV_SHOW_VERIFICATION_LINK?: string;
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

type D1Database = Record<string, unknown>;
