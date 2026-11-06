import type { Env } from '../env';
import type { User } from '../../src/types';
import type { AccountRow } from './accounts';

/**
 * The contract every design-tool provider implements. Mika's assignment and deliverable workflow
 * (resources.ts, events.ts, the routes and the UI) only ever talks to this interface, so it does not
 * care whether a linked file came from Figma, Canva or something added later.
 * Provider specifics (URLs, scopes, payload shapes, quirks) stay inside the adapter files.
 *
 * OAuth connect/callback are browser redirects with provider-specific parameters, so they remain
 * exported functions in each provider file and are wired as routes; everything after "connected" goes through here.
 */
export type DesignProvider = 'figma' | 'canva';
export const DESIGN_PROVIDERS: DesignProvider[] = ['figma', 'canva'];

/** What a provider can really do. The UI shows these limits as they are instead of implying more. */
export type Support = 'yes' | 'plan_required' | 'preview_only' | 'no';
export interface ProviderCapabilities {
  provider: DesignProvider;
  label: string;
  thumbnails: boolean;
  /** A provider revision id exists and can be read. */
  versions: boolean;
  comments: Support;
  /** Provider pushes events to Mika. When not 'yes', manual refresh is the way to see new activity. */
  webhooks: Support;
  exportPreview: boolean;
  /** Plain-language limits, shown to people. */
  notes: string[];
}

export interface ResourceRef {
  provider: DesignProvider;
  externalId: string;        // Figma file key / Canva design id
  nodeId?: string;           // Figma frame
  url: string;
  type: string;              // design | prototype | board | ...
}

export interface ResourceSnapshot {
  title: string;
  type: string;
  version: string | null;        // provider revision id, when the provider has one
  modifiedAt: number | null;     // ms epoch
  thumbnailUrl: string | null;
  viewUrl?: string | null;
}

/** An event as the provider reported it, before Mika attaches it to an assignment. */
export type ActivityType = 'resource_updated' | 'version_created' | 'comment_added';
export interface NormalizedActivity {
  sourceEventId: string;         // stable across webhook delivery and polling, which is what makes both idempotent
  type: ActivityType;
  occurredAt: number;
  actorExternalId?: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface SyncState { version: string | null; modifiedAt: number | null; cursor: string | null; linkedAt: number }
export interface SyncResult {
  snapshot: ResourceSnapshot;
  activity: NormalizedActivity[];
  cursor: string | null;
  /** Capabilities refused on this sync (for instance a missing scope), shown as "reconnect to enable". */
  limits: string[];
}

export interface PreviewFile { name: string; type: string; bytes: ArrayBuffer; viewUrl: string }

export type SubscribeResult = { status: 'active' | 'unavailable' | 'unsupported'; reason?: string };

export interface IntegrationAdapter {
  readonly key: DesignProvider;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;

  /** Turns a pasted link (or id) into a resource reference. Throws a 400 for anything that is not this provider's. */
  parseResource(input: string): ResourceRef;
  /** Reads basic metadata with the linking person's own account. Also proves that account can open the resource. */
  fetchSnapshot(env: Env, account: AccountRow, ref: ResourceRef): Promise<ResourceSnapshot>;
  /** Snapshot plus any new provider activity since the last sync. Must be safe to repeat. */
  sync(env: Env, account: AccountRow, ref: ResourceRef, prev: SyncState): Promise<SyncResult>;
  /** A rendering of the work, attached as evidence when the assignee submits. */
  exportPreview(env: Env, account: AccountRow, ref: ResourceRef, opts: { format?: string }): Promise<PreviewFile>;
  /** Asks the provider to push events about this resource, if it can. Never throws for "not available". */
  subscribe(env: Env, account: AccountRow, ref: ResourceRef, ctx: { orgId: string; userId: string }): Promise<SubscribeResult>;
  /** Stops pushed events for a resource nobody has linked any more. Best effort. */
  unsubscribe(env: Env, ctx: { orgId: string; externalId: string }): Promise<void>;
  /** Stops all future sync for this person and revokes what the provider lets us revoke. */
  disconnect(env: Env, user: User, orgId: string): Promise<void>;
}
