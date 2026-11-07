import { api } from './api';

export interface StorageSettings {
  storageType: string;
  configured: boolean;
  /** Only the organisation root receives this. The secret is never returned to anyone. */
  selfHost: { endpoint: string; bucket: string; region: string; pathStyle: boolean; accessKeyHint: string; verifiedAt: number | null } | null;
}
export interface SelfHostInput { endpoint: string; bucket: string; region: string; pathStyle: boolean; accessKeyId: string; secretAccessKey: string }

export const fetchStorageSettings = (orgId: string) => api<StorageSettings>(`/api/orgs/${encodeURIComponent(orgId)}/storage`);
export const testStorageServer = (orgId: string, b: SelfHostInput) => api<{ ok: true }>(`/api/orgs/${encodeURIComponent(orgId)}/storage/test`, { method: 'POST', body: b });
export const saveStorageServer = (orgId: string, b: SelfHostInput) => api<StorageSettings>(`/api/orgs/${encodeURIComponent(orgId)}/storage`, { method: 'PUT', body: b });
export const clearStorageServer = (orgId: string) => api<{ ok: true }>(`/api/orgs/${encodeURIComponent(orgId)}/storage`, { method: 'DELETE' });
