export type Scope = "read" | "write";

export interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string;
  scopes: Scope[];
  rate_limit_per_day: number;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ApiKeyFormState {
  name: string;
  scopes: { read: boolean; write: boolean };
  rate_limit_per_day: string;
}
