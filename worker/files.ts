import type { Env } from './env';
import { HttpError } from './env';
import { randomId } from './util';
import { getDoc, isMember, loadOrgContext, putDoc } from './store';
import type { FileItem, User } from '../src/types';

const MAX_BYTES = 50 * 1024 * 1024; // keep prototype uploads modest; raise when billing/quota exists

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export async function uploadFile(env: Env, user: User, orgId: string, form: FormData): Promise<FileItem> {
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');

  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Attach a file in the "file" field');
  if (file.size > MAX_BYTES) throw new HttpError(413, `Files are limited to ${humanSize(MAX_BYTES)} for now`);
  if (ctx.org.storageType && ctx.org.storageType !== 'mika') {
    throw new HttpError(409, 'This organisation keeps files in its own drive, not Mika storage.');
  }

  const id = randomId('file');
  await env.FILES.put(`${orgId}/${id}`, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { name: file.name, uploadedBy: user.id },
  });

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' && v ? v : undefined;
  };
  const item: FileItem = {
    id, orgId,
    deptId: str('deptId'),
    name: file.name,
    size: humanSize(file.size),
    type: file.type || 'application/octet-stream',
    url: `/api/orgs/${orgId}/files/${id}`,
    downloadUrl: `/api/orgs/${orgId}/files/${id}`,
    storageBackend: 'mika',
    uploadedByUserId: user.id,
    uploadedByName: user.fullName,
    uploadedAt: new Date().toISOString(),
    sourceTaskId: str('sourceTaskId'),
    folder: str('folder'),
    isAutoArchived: !!str('sourceTaskId'),
  };
  await putDoc(env, orgId, 'file', id, item);
  return item;
}

export async function downloadFile(env: Env, user: User, orgId: string, fileId: string): Promise<Response> {
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  const meta = await getDoc<FileItem>(env, orgId, 'file', fileId);
  if (!meta) throw new HttpError(404, 'File not found');
  const obj = await env.FILES.get(`${orgId}/${fileId}`);
  if (!obj) throw new HttpError(404, 'File contents are missing');
  const headers = new Headers({
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
    'Cache-Control': 'private, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  });
  return new Response(obj.body, { headers });
}

export async function removeFileBlob(env: Env, orgId: string, fileId: string) {
  await env.FILES.delete(`${orgId}/${fileId}`);
}
