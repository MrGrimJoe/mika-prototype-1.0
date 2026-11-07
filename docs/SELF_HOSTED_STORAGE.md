# Host your own server (file storage)

Choosing **Host your own server** when creating an organisation means its files live on a server the organisation runs, not in Mika's bucket. Any **S3-compatible** server works. The organisation root enters the details in **Settings, Storage**.

## What was plugged in

- **[`aws4fetch`](https://github.com/mhart/aws4fetch)** (MIT, about 2 KB, built for Cloudflare Workers) signs the requests (AWS Signature V4). No AWS SDK, no server code added to Mika.
- `worker/storage.ts` gives Mika's R2 bucket and an organisation's own server one interface. Uploads, downloads, deletes and Figma/Canva evidence previews all go through it.
- Each file remembers where it was stored, so switching later never strands old files.
- Credentials are the organisation's own, stored **encrypted** (AES-GCM, bound to the organisation), and never returned by any API, root included. Saving is refused unless a test file can be written, read back and deleted on the server.

## Servers to run (pick one)

| Server | Notes |
|---|---|
| **Garage** | Lightweight, built for small self-hosters and clusters of ordinary machines. |
| **SeaweedFS** | Mature, fast, easy single-binary start. This is the one Mika's live test ran against. |
| **RustFS** | Newer, MinIO-style drop-in. |
| **Ceph RGW** | For schools that already run Ceph. |
| MinIO | The community edition has been reported as archived upstream, so prefer the above for new installs. |

## Requirements

1. A **public https address** for the server. Cloudflare Workers cannot reach private network addresses. For a server inside a school network, publish it with **Cloudflare Tunnel** (free) or a reverse proxy with a real certificate. Addresses like `10.x`, `192.168.x`, `localhost` and `*.local` are refused on purpose.
2. A bucket, and an access key allowed to read, write and delete in it.
3. `TOKEN_ENCRYPTION_KEY` set on the Mika deployment (the same one the integrations use).
4. Apply the migration: `npm run db:migrate:remote` (adds `org_storage`).

## Settings fields

Server address, bucket, region (`us-east-1` is accepted by most), access key id, secret key, and "path-style" (leave on).

## Try it locally

```
curl -L -o weed.tgz https://github.com/seaweedfs/seaweedfs/releases/latest/download/linux_amd64.tar.gz && tar xzf weed.tgz
echo '{"identities":[{"name":"school","credentials":[{"accessKey":"KEY","secretKey":"SECRET"}],"actions":["Admin","Read","Write","List"]}]}' > s3.json
./weed server -dir=./data -s3 -s3.port=8333 -s3.config=./s3.json
S3_LIVE_ENDPOINT=http://localhost:8333 S3_LIVE_BUCKET=school-files S3_LIVE_KEY=KEY S3_LIVE_SECRET=SECRET npx tsx scripts/storage.test.ts
```
(Create the bucket first. Plain `http://localhost` is accepted only when `DEV_AUTH=1`.)

## Limits

- Per-organisation credentials and one bucket per organisation. Uploads are buffered (50 MB cap), so they use Worker memory.
- Files are proxied through Mika on download (no direct links to the server), which keeps access checks in one place.
- "Forget server details" removes the credentials but does not delete files on the server.
- Moving existing files between backends is not built; old files stay where they were saved.
