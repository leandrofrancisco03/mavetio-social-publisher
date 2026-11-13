import { env } from "cloudflare:workers";
export type Database = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta: { changes: number } }>;
      first<T>(): Promise<T | null>;
    };
  };
};
export type Config = {
  APP_URL?: string;
  POSTIZ_API_URL?: string;
  POSTIZ_API_KEY?: string;
  POSTIZ_WEB_URL?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  MEDIA_SIGNING_SECRET?: string;
  TIKTOK_SANDBOX?: string;
  TIKTOK_DIRECT_POST_ENABLED?: string;
  PRIVACY_URL?: string;
  TERMS_URL?: string;
  DELETION_URL?: string;
  DB?: Database;
};
export const config = () => env as unknown as Config;
