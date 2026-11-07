import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Organization, User } from '../types';
import { clearStorageServer, fetchStorageSettings, saveStorageServer, testStorageServer, type StorageSettings } from '../lib/storageApi';
import { describeError } from '../lib/integrationsApi';

/**
 * "Host your own server": the organisation's own S3-compatible storage (Garage, SeaweedFS, RustFS, MinIO, Ceph...).
 * Only the organisation root can change it. The secret key is sent once, stored encrypted, and never shown again.
 */
export const SelfHostStorageForm: React.FC<{ org: Organization; currentUser: User; isRoot: boolean }> = ({ org, currentUser, isRoot }) => {
  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [f, setF] = useState({ endpoint: '', bucket: '', region: 'us-east-1', pathStyle: true, accessKeyId: '', secretAccessKey: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => fetchStorageSettings(org.id).then(s => {
    setSettings(s);
    if (s.selfHost) setF(x => ({ ...x, endpoint: s.selfHost!.endpoint, bucket: s.selfHost!.bucket, region: s.selfHost!.region, pathStyle: s.selfHost!.pathStyle }));
  }).catch(() => setSettings(null));
  useEffect(() => { load(); }, [org.id, currentUser.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id); setMsg(null);
    try { setMsg({ ok: true, text: await fn() }); } catch (e) { setMsg({ ok: false, text: describeError(e) }); } finally { setBusy(null); }
  };
  const field = 'w-full min-h-11 px-2.5 bg-surface border border-hairline rounded-xs text-xs font-mono focus:outline-none focus:border-accent disabled:opacity-60';
  const label = 'block text-xs font-semibold text-ink-2 mb-1';
  const btn = 'inline-flex items-center justify-center min-h-11 px-3 text-xs font-semibold rounded-xs disabled:opacity-50 cursor-pointer';
  const have = !!settings?.configured;
  const ready = f.endpoint.trim() && f.bucket.trim() && (have || (f.accessKeyId.trim() && f.secretAccessKey));

  if (!isRoot) {
    return (
      <p className="text-xs text-ink-2" role="status">
        {have ? 'Your organisation stores files on its own server.' : 'Your organisation chose its own server, but the organisation root has not entered its details yet, so files cannot be uploaded.'}
      </p>
    );
  }
  return (
    <div className="space-y-3 pt-2 border-t border-hairline">
      <p className="text-xs text-ink-2">
        Enter any S3-compatible server (Garage, SeaweedFS, RustFS, MinIO, Ceph). It needs a public https address. Mika checks it by writing and deleting a small test file before saving anything.
      </p>
      {have && settings?.selfHost && (
        <p className="text-xs text-emerald-700 flex items-center gap-1" role="status">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Connected to {settings.selfHost.endpoint} (key ending {settings.selfHost.accessKeyHint})
          {settings.selfHost.verifiedAt ? `, checked ${new Date(settings.selfHost.verifiedAt).toLocaleDateString()}` : ''}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={label} htmlFor="sh-endpoint">Server address</label>
          <input id="sh-endpoint" className={field} placeholder="https://storage.school.example" value={f.endpoint} onChange={e => setF({ ...f, endpoint: e.target.value })} autoComplete="off" /></div>
        <div><label className={label} htmlFor="sh-bucket">Bucket</label>
          <input id="sh-bucket" className={field} placeholder="school-files" value={f.bucket} onChange={e => setF({ ...f, bucket: e.target.value })} autoComplete="off" /></div>
        <div><label className={label} htmlFor="sh-region">Region</label>
          <input id="sh-region" className={field} value={f.region} onChange={e => setF({ ...f, region: e.target.value })} autoComplete="off" /></div>
        <div><label className={label} htmlFor="sh-key">Access key id</label>
          <input id="sh-key" className={field} placeholder={have ? 'Leave blank to keep the saved key' : ''} value={f.accessKeyId} onChange={e => setF({ ...f, accessKeyId: e.target.value })} autoComplete="off" /></div>
        <div><label className={label} htmlFor="sh-secret">Secret key</label>
          <input id="sh-secret" type="password" className={field} placeholder={have ? 'Leave blank to keep the saved secret' : ''} value={f.secretAccessKey} onChange={e => setF({ ...f, secretAccessKey: e.target.value })} autoComplete="new-password" /></div>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-2 min-h-11">
        <input type="checkbox" checked={f.pathStyle} onChange={e => setF({ ...f, pathStyle: e.target.checked })} className="w-4 h-4" />
        Path-style addresses (leave on for almost every self-hosted server)
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={`${btn} border border-hairline text-ink-2 hover:bg-paper-raised`} disabled={!ready || !!busy}
          onClick={() => run('test', async () => { await testStorageServer(org.id, f); return 'The server works: a test file was written, read back and deleted.'; })}>Test connection</button>
        <button className={`${btn} bg-accent text-white hover:bg-accent-strong`} disabled={!ready || !!busy}
          onClick={() => run('save', async () => { const s = await saveStorageServer(org.id, f); setSettings(s); setF(x => ({ ...x, accessKeyId: '', secretAccessKey: '' })); return 'Saved. New files will be stored on your server.'; })}>Save and use this server</button>
        {have && <button className={`${btn} border border-hairline text-red-700 hover:bg-paper-raised`} disabled={!!busy}
          onClick={() => { if (confirm('Forget these server details? Files already on your server stay there but cannot be opened from Mika until you enter them again.')) run('clear', async () => { await clearStorageServer(org.id); await load(); return 'Server details removed.'; }); }}>Forget server details</button>}
      </div>
      {busy && <p className="text-xs text-ink-3 animate-pulse" role="status">Talking to your server. This can take a few seconds.</p>}
      {msg && <p className={`text-xs flex items-start gap-1 ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{!msg.ok && <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />}{msg.text}</p>}
    </div>
  );
};
