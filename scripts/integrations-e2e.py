"""End-to-end checks for the integrations, against a local Worker (npm run dev:api) with .dev.vars set to
test values (see INTEGRATION_SECRETS.md). No real GitHub/Figma/Canva credentials are needed: webhooks are
signed locally and the provider-side links are inserted straight into the local D1 database.
Run: python3 scripts/integrations-e2e.py"""
import json, urllib.request, urllib.error, uuid, hmac, hashlib, subprocess, time, re, sys
RUN = uuid.uuid4().hex[:6]
B = 'http://localhost:8787'
WH_SECRET = 'whsec_test_123'   # must match GITHUB_WEBHOOK_SECRET in .dev.vars
fails = 0

def call(method, path, body=None, tok=None, raw=None, headers=None, full=False):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + tok} if tok else {}), **(headers or {})}
    req = urllib.request.Request(B + path, method=method, data=data, headers=h)
    try:
        r = urllib.request.urlopen(req); status, hdrs, text = r.status, r.headers, r.read().decode()
    except urllib.error.HTTPError as e:
        status, hdrs, text = e.code, e.headers, e.read().decode()
    try: js = json.loads(text or '{}')
    except Exception: js = {'_html': text}
    return (status, js, hdrs) if full else (status, js)

def check(name, got, want):
    global fails
    ok = got == want
    print(('PASS' if ok else 'FAIL'), name, '' if ok else f'(got {got!r}, want {want!r})')
    if not ok: fails += 1

def sql(*stmts):
    out = subprocess.run(['npx', 'wrangler', 'd1', 'execute', 'mika', '--local', '--command', '; '.join(stmts)],
                         capture_output=True, text=True, cwd='.')
    if out.returncode != 0: print(out.stdout[-400:], out.stderr[-400:]); sys.exit('sql failed')

def gh(event, payload, delivery=None, secret=WH_SECRET, sign=True):
    raw = json.dumps(payload).encode()
    h = {'X-GitHub-Event': event, 'X-GitHub-Delivery': delivery or uuid.uuid4().hex}
    if sign: h['X-Hub-Signature-256'] = 'sha256=' + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return call('POST', '/api/webhooks/github', raw=raw, headers=h)

def push(sender, msg, inst=5551, delivery=None):
    return gh('push', {'installation': {'id': inst}, 'sender': {'id': sender},
        'commits': [{'id': 'abc123', 'message': msg, 'url': 'https://github.com/acme/x/commit/abc123', 'timestamp': '2026-11-05T10:00:00Z'}]}, delivery)

# start from a clean slate so the script can be re-run
sql('DELETE FROM integration_accounts', 'DELETE FROM integration_webhooks', 'DELETE FROM webhook_deliveries')

tree = {'id': 'root-department', 'department': 'Test School', 'roots': ['Principal'], 'roles': [], 'children': [
    {'id': 'n1', 'department': 'Class 1', 'roots': ['Class 1 Lead'], 'roles': ['Math Teacher'], 'children': []}]}
def make_org(email, name):
    s, a = call('POST', '/api/auth/dev-login', {'email': email, 'fullName': name}); T = a['session']['token']
    s, o = call('POST', '/api/orgs', {'orgName': name + ' School', 'creator': {'fullName': name, 'preferredName': name, 'gender': 'male'},
        'tree': tree, 'sections': [], 'sizing': {'people': 10, 'storageGiB': 250, 'storageType': 'mika'}}, T)
    assert s == 201, o
    roles = {r['title']: r for r in o['roles']}
    return T, o, roles['Math Teacher']
def task_in(state, tid): return next((t for t in state['tasks'] if t['id'] == tid), None)
def join(tok_link, email, name):
    s, t = call('POST', '/api/auth/dev-login', {'email': email, 'fullName': name}); tk = t['session']['token']
    s, j = call('POST', f'/api/join/{tok_link}/signup', {'fullName': name, 'preferredName': name, 'gender': 'female'}, tk)
    assert s == 200, j
    return tk, j['user']['id']

# ---- setup: org A (boss, alice, bob) and a separate org B -------------------------------------------------
T, o, math = make_org(f'boss-{RUN}@x.test', 'Bo'); OID = o['org']['id']; BOSS = o['user']['id']
s, l = call('POST', f'/api/orgs/{OID}/links', {'targetRoleId': math['id'], 'daysValid': 7}, T); LINK = l['token']
AT, ALICE = join(LINK, f'alice-{RUN}@x.test', 'Alice'); BT, BOB = join(LINK, f'bob-{RUN}@x.test', 'Bob')
def mk(tid, assignee, org=OID, tok=T, role=math, by=BOSS):
    s, r = call('PUT', f'/api/orgs/{org}/docs/task/{tid}', {'id': tid, 'orgId': org, 'deptId': role['deptId'], 'title': 'Plan ' + tid,
        'description': 'x', 'assignedByUserId': by, 'assignedToRoleId': role['id'], 'assignedToUserId': assignee, 'status': 'pending'}, tok)
    assert s == 200, (tid, s, r)
for t in ('t09', 't10', 't11'): mk(t, ALICE)
TB, ob, mathB = make_org(f'bossb-{RUN}@x.test', 'Bea'); OIDB = ob['org']['id']; mk('tB1', '', OIDB, TB, mathB, ob['user']['id'])

# ---- 1. status + placeholders ----------------------------------------------------------------------------
s, st = call('GET', f'/api/integrations/status?orgId={OID}', tok=T)
check('status: lead sees GitHub configured (test values set)', st['providers']['github']['configured'], True)
check('status: Figma not configured while REPLACE_ME', st['providers']['figma']['configured'], False)
check('status: lead is told which secret names are missing', 'FIGMA_CLIENT_ID' in st['providers']['figma'].get('missing', []), True)
s, st2 = call('GET', f'/api/integrations/status?orgId={OID}', tok=AT)
check('status: a non-lead is not shown secret names', 'missing' in st2['providers']['figma'], False)
check('status: Google reported as browser-side', 'configured' in st2['providers']['google'], True)
s, _ = call('GET', f'/api/integrations/status?orgId={OID}', tok=None); check('status: anonymous blocked', s, 401)
s, _ = call('GET', f'/api/integrations/status?orgId={OID}', tok=TB); check('status: other org member blocked', s, 403)
s, r = call('POST', '/api/integrations/figma/start', {'orgId': OID}, AT)
check('figma start with placeholder keys -> 501 not_configured', (s, r.get('code')), (501, 'not_configured'))
s, r = call('POST', '/api/integrations/canva/start', {'orgId': OID}, AT); check('canva start -> 501', s, 501)
s, r = call('POST', '/api/integrations/figma/export', {'orgId': OID, 'taskId': 't09', 'fileUrl': 'https://figma.com/design/AbCdEf1234567890'}, AT)
check('figma export with placeholder keys -> 501', s, 501)

# ---- 2. GitHub connect flow guards ------------------------------------------------------------------------
s, r = call('POST', '/api/integrations/github/start', {'orgId': OID, 'mode': 'install'}, AT); check('non-lead cannot start org-wide install', s, 403)
s, r, h = call('POST', '/api/integrations/github/start', {'orgId': OID, 'mode': 'install'}, T, full=True)
check('lead gets the GitHub App install URL', r.get('url', '').startswith('https://github.com/apps/mika-test/installations/new?state='), True)
check('start sets an HttpOnly SameSite cookie', 'HttpOnly' in (h.get('Set-Cookie') or '') and 'SameSite=Lax' in (h.get('Set-Cookie') or ''), True)
s, r, h = call('POST', '/api/integrations/github/start', {'orgId': OID, 'mode': 'link'}, AT, full=True)
check('member gets a GitHub sign-in URL', r.get('url', '').startswith('https://github.com/login/oauth/authorize?'), True)
state = re.search(r'state=([^&]+)', r['url']).group(1); cookie = h['Set-Cookie'].split(';')[0]
s, r = call('GET', '/api/integrations/github/callback?code=x&state=garbage'); check('callback: forged state rejected', (s, 'Could not connect' in r.get('_html', '')), (400, True))
s, r = call('GET', f'/api/integrations/github/callback?code=x&state={state}'); check('callback: no cookie (other browser) rejected', (s, 'not started from this browser' in r.get('_html', '')), (400, True))
s, r = call('GET', f'/api/integrations/github/callback?code=x&state={state}', headers={'Cookie': 'mika_oauth=wrong'}); check('callback: wrong cookie rejected', s, 400)
s, r = call('GET', f'/api/integrations/github/callback?state={state}', headers={'Cookie': cookie}); check('callback: no code explains the app setting', 'Request user authorization' in r.get('_html', ''), True)

# ---- 3. GitHub webhook -> evidence -------------------------------------------------------------------------
now = int(time.time() * 1000)
sql(f"INSERT INTO integration_accounts VALUES ('acct_inst','{OID}','github','installation','','5551','acme',NULL,'',{now},{now})",
    f"INSERT INTO integration_accounts VALUES ('acct_alice','{OID}','github','user','{ALICE}','777','alice-gh',NULL,'',{now},{now})",
    f"INSERT INTO integration_accounts VALUES ('acct_bob','{OID}','github','user','{BOB}','888','bob-gh',NULL,'',{now},{now})")
s, r = gh('push', {}, sign=False); check('webhook: unsigned rejected', s, 401)
s, r = gh('push', {}, secret='wrong'); check('webhook: wrong signature rejected', s, 401)
s, r = gh('ping', {'zen': 'x'}); check('webhook: signed ping ok', (s, r.get('pong')), (200, True))
s, r = push(999, 'work mika#t09'); check('push by unlinked GitHub user is ignored', r['result'].get('ignored'), 'sender_not_linked')
s, r = push(777, 'work mika#t09', inst=424242); check('push from unknown installation is ignored', r['result'].get('ignored'), 'unknown_installation')
s, r = push(888, 'Bob did it mika#t10'); check("Bob cannot submit Alice's task (403)", r['result']['skipped'], ['t10:403'])
check("  ...and her task stays pending", task_in(call('GET', f'/api/orgs/{OID}/state', tok=AT)[1], 't10')['status'], 'pending')
s, r = push(777, 'Plan t09 and Plan t10, mentioning titles only'); check('titles and names never match, only the tag', (r['result']['submitted'], r['result']['skipped']), ([], []))
s, r = push(777, 'nothing relevant mika#nope_404'); check('tag for a task that does not exist is skipped (404)', r['result']['skipped'], ['nope_404:404'])
s, r = push(777, 'Finished the report\n\nmika#t09', delivery='D-1'); check('Alice commit with her tag submits t09', r['result']['submitted'], ['t09'])
t09 = task_in(call('GET', f'/api/orgs/{OID}/state', tok=T)[1], 't09')
check('  task is submitted (never done)', t09['status'], 'submitted')
check('  evidence recorded as a commit on github.com', (t09['submissionEvidence']['source'], t09['submissionEvidence']['host'], t09['submissionEvidence']['commitSha']), ('commit', 'github.com', 'abc123'))
s, r = push(777, 'Finished the report mika#t09', delivery='D-1'); check('redelivery of the same webhook is a no-op', r.get('duplicate'), True)
s, r = push(777, 'again mika#t09'); check('already-submitted task is skipped (409)', r['result']['skipped'], ['t09:409'])
mk('tB2', '', OIDB, TB, mathB, ob['user']['id'])
s, r = push(777, 'cross-tenant attempt mika#tB1 mika#tB2'); check("another organisation's tasks are unreachable (404)", r['result']['skipped'], ['tB1:404', 'tB2:404'])
check("  ...and org B's task is untouched", task_in(call('GET', f'/api/orgs/{OIDB}/state', tok=TB)[1], 'tB1')['status'], 'pending')
s, r = gh('pull_request', {'action': 'opened', 'installation': {'id': 5551}, 'sender': {'id': 777},
    'pull_request': {'title': 'Report mika#t10', 'body': '', 'html_url': 'https://github.com/acme/x/pull/1', 'head': {'sha': 'f00'}}})
check('PR opened with the tag submits the task', r['result']['submitted'], ['t10'])
s, r = gh('pull_request', {'action': 'closed', 'installation': {'id': 5551}, 'sender': {'id': 777}, 'pull_request': {'title': 'mika#t11'}})
check('PR closed is ignored', r['result'].get('ignored'), 'pull_request.closed')

# ---- 4. unlinking, uninstalling, and who may do it -----------------------------------------------------------
s, _ = call('POST', '/api/integrations/github/disconnect', {'orgId': OID, 'target': 'installation'}, AT); check('non-lead cannot remove the org install', s, 403)
s, _ = call('POST', '/api/integrations/github/disconnect', {'orgId': OID, 'target': 'user'}, AT); check('member can unlink their own GitHub', s, 200)
s, r = push(777, 'after unlink mika#t11'); check('after unlinking, her pushes are ignored', r['result'].get('ignored'), 'sender_not_linked')
check('  ...and the task stays pending', task_in(call('GET', f'/api/orgs/{OID}/state', tok=T)[1], 't11')['status'], 'pending')
s, r = gh('installation', {'action': 'deleted', 'installation': {'id': 5551}}); check('uninstalling on GitHub removes the connection', 'removed' in r['result'], True)
s, r = push(888, 'late mika#t11'); check('pushes after uninstall are ignored', r['result'].get('ignored'), 'unknown_installation')

# ---- 5. Figma webhook (version labelled with the tag) ------------------------------------------------------------
sql(f"INSERT INTO integration_webhooks VALUES ('figma','wh1','{OID}','t11','FILEKEY','{ALICE}','{hashlib.sha256(b'pass123').hexdigest()}',{now})",
    f"INSERT INTO integration_accounts VALUES ('acct_fa','{OID}','figma','user','{ALICE}','4242','alice-fig',NULL,'',{now},{now})")
def fig(payload): return call('POST', '/api/webhooks/figma', payload)
ev = {'webhook_id': 'wh1', 'passcode': 'pass123', 'event_type': 'FILE_VERSION_UPDATE', 'file_key': 'FILEKEY', 'version_id': 'v1', 'label': 'wip', 'triggered_by': {'id': '4242'}}
s, r = fig({**ev, 'webhook_id': 'nope'}); check('figma: unknown webhook -> 404', s, 404)
s, r = fig({**ev, 'passcode': 'wrong'}); check('figma: wrong passcode -> 401', s, 401)
s, r = fig({**ev, 'event_type': 'PING'}); check('figma: ping ok', r.get('pong'), True)
s, r = fig(ev); check('figma: version without the tag is ignored', r['result'].get('ignored'), 'no_matching_tag')
s, r = fig({**ev, 'version_id': 'v2', 'label': 'done mika#t11', 'triggered_by': {'id': '9999'}}); check('figma: saver not linked is ignored', r['result'].get('ignored'), 'saver_not_linked')
s, r = fig({**ev, 'version_id': 'v3', 'label': 'done mika#t11'}); check('figma: linked assignee labelling a version submits', r['result'].get('submitted'), 't11')
t11 = task_in(call('GET', f'/api/orgs/{OID}/state', tok=T)[1], 't11')
check('  evidence is a figma.com plugin submission', (t11['status'], t11['submissionEvidence']['source'], t11['submissionEvidence']['host']), ('submitted', 'plugin', 'figma.com'))
s, r = fig({**ev, 'version_id': 'v3', 'label': 'done mika#t11'}); check('figma: redelivery is a no-op', r.get('duplicate'), True)

# ---- 6. what the shared docs API lets a member claim (informational) ------------------------------------------------
s, r = call('PUT', f'/api/orgs/{OID}/docs/compliance/{BOB}_github', {'id': f'{BOB}_github', 'userId': BOB, 'orgId': OID, 'integrationKey': 'github', 'connectedAccountLabel': 'fake'}, BT)
print(f'INFO  a member can write their own "compliance" doc through the generic docs API: status {s}')
print('FAILS', fails)
sys.exit(1 if fails else 0)
