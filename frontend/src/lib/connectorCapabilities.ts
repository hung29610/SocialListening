export const CAPABILITY_STATES = [
  'READY',
  'CONFIG_REQUIRED',
  'OAUTH_REQUIRED',
  'BEST_EFFORT_UNSUPPORTED',
  'NOT_IMPLEMENTED',
] as const;

export type CapabilityState = (typeof CAPABILITY_STATES)[number];
export type ConnectorId =
  | 'rss'
  | 'website'
  | 'google_news_rss'
  | 'newsapi'
  | 'youtube'
  | 'facebook_page'
  | 'instagram_business'
  | 'twitter'
  | 'reddit'
  | 'tiktok';

export interface ConnectorCapability {
  state: CapabilityState;
  production_ready: boolean;
  action_enabled: boolean;
  action: 'ADD_SOURCE' | 'META_OAUTH' | null;
  reason_code: string;
  missing_prerequisites: string[];
  preview_only: boolean;
}

export interface ConnectorCapabilitiesResponse {
  contract_version: string;
  connectors: Record<ConnectorId, ConnectorCapability>;
  exports: { infographic: ConnectorCapability };
}
