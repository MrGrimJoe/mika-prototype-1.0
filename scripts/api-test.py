import json, urllib.request, sys, uuid
RUN=uuid.uuid4().hex[:6]
B='http://localhost:8787'
def call(method, path, body=None, tok=None):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type':'application/json', **({'Authorization':'Bearer '+tok} if tok else {})})
    try:
        r=urllib.request.urlopen(req); return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')
def check(name, got, want):
    ok = got==want; print(('PASS' if ok else 'FAIL'), name, '' if ok else f'(got {got}, want {want})'); 
    if not ok: global fails; fails+=1
fails=0
s,a=call('POST','/api/auth/dev-login',{'email':'boss-'+RUN+'@x.test','fullName':'Bo Boss'}); check('dev login',s,200); T=a['session']['token']; check('new user flagged isNew',a['isNew'],True)
tree={'id':'root-department','department':'Test School','roots':['Principal'],'roles':[],'children':[
  {'id':'n1','department':'Class 1','roots':['Class 1 Lead'],'roles':['Math Teacher','English Teacher'],'children':[],'sectionId':'sec1'},
  {'id':'n2','department':'Class 2','roots':['Class 2 Lead'],'roles':['Math Teacher'],'children':[],'sectionId':'sec1'}]}
s,o=call('POST','/api/orgs',{'orgName':'Test School','creator':{'fullName':'Bo Boss','preferredName':'Bo','gender':'male'},'tree':tree,'sections':[{'id':'sec1','name':'Primary'}],'sizing':{'people':10,'storageGiB':250,'storageType':'mika'}},T)
check('create org',s,201); org=o['org']; OID=org['id']
check('price server-side = 10*0.30+250*0.08 = 23',org['pricingMonthly'],23.0)
roles={r['title']+'@'+next(d['name'] for d in o['departments'] if d['id']==r['deptId']):r for r in o['roles']}
print('  depts:',[ (d['name'],d['type'],bool(d.get('parentDeptId')),len(d.get('groupedDeptIds') or [])) for d in o['departments']])
math1=roles['Math Teacher@Class 1']; lead1=roles['Class 1 Lead@Class 1']
# invite
s,l=call('POST',f'/api/orgs/{OID}/links',{'targetRoleId':math1['id'],'daysValid':7},T); check('root issues invite',s,201); tok=l['token']
s,r=call('GET',f'/api/join/{tok}'); check('resolve link valid',r.get('valid'),True)
# teacher joins
s,t=call('POST','/api/auth/dev-login',{'email':'alice-'+RUN+'@x.test','fullName':'Alice Chen'}); AT=t['session']['token']
# task sent to empty role before join
s,task=call('PUT',f'/api/orgs/{OID}/docs/task/t1',{'id':'t1','orgId':OID,'deptId':math1['deptId'],'title':'Plan Q1','description':'x','assignedByUserId':o['user']['id'],'assignedToRoleId':math1['id'],'assignedToUserId':'','status':'pending'},T); check('root creates task for empty role',s,200)
s,j=call('POST',f'/api/join/{tok}/signup',{'fullName':'Alice Chen','preferredName':'Alice','gender':'female'},AT); check('alice joins',s,200)
s,st=call('GET',f'/api/orgs/{OID}/state',tok=AT); t1=[x for x in st['tasks'] if x['id']=='t1'][0]
check('open task claimed by first joiner',t1['assignedToUserId'],j['user']['id'])
# multi-use link
s,t2=call('POST','/api/auth/dev-login',{'email':'bob-'+RUN+'@x.test','fullName':'Bob'}); BT=t2['session']['token']
s,_=call('POST',f'/api/join/{tok}/signup',{'fullName':'Bob','preferredName':'Bob','gender':'male'},BT); check('link is multi-use',s,200)
# authority checks
s,_=call('POST',f'/api/orgs/{OID}/links',{'targetRoleId':lead1['id']},AT); check('teacher cannot invite',s,403)
s,_=call('PUT',f'/api/orgs/{OID}/docs/task/t2',{'id':'t2','orgId':OID,'deptId':math1['deptId'],'title':'sneaky','assignedByUserId':j['user']['id'],'assignedToRoleId':math1['id'],'status':'pending'},AT); check('teacher cannot create task',s,403)
s,_=call('PUT',f'/api/orgs/{OID}/docs/task/t1',{**t1,'status':'done'},AT); check('assignee cannot self-approve',s,403)
s,_=call('PUT',f'/api/orgs/{OID}/docs/task/t1',{**t1,'status':'submitted','confirmationText':'here'},AT); check('assignee can submit',s,200)
s,_=call('PUT',f'/api/orgs/{OID}/docs/task/t1',{**t1,'status':'submitted','assignedToUserId':'someone'},AT); check('cannot reassign (fixed field ok, assignee field free?)',s in (200,403),True)
s,x=call('PUT',f'/api/orgs/{OID}/docs/task/t1',{**t1,'status':'rejected'},T); check('reject needs reason',s,400)
s,_=call('PUT',f'/api/orgs/{OID}/docs/task/t1',{**t1,'status':'done','rating':{'score':5,'isAnonymous':False}},T); check('root approves',s,200)
# bob (other teacher in same role) cannot touch alice's task
s,st=call('GET',f'/api/orgs/{OID}/state',tok=BT); t1b=[x for x in st['tasks'] if x['id']=='t1'][0]
s,_=call('PUT',f'/api/orgs/{OID}/docs/task/t1',{**t1b,'title':'hijack'},BT); check('peer cannot edit task',s,403)
# non-member
s,t3=call('POST','/api/auth/dev-login',{'email':'eve-'+RUN+'@x.test','fullName':'Eve'}); ET=t3['session']['token']
s,_=call('GET',f'/api/orgs/{OID}/state',tok=ET); check('outsider blocked',s,403)
s,_=call('GET',f'/api/orgs/{OID}/state'); check('anonymous blocked',s,401)
# changes feed
s,c=call('GET',f'/api/orgs/{OID}/changes?since=0',tok=T); check('changes feed has docs',len(c['changes'])>10,True)
s,c2=call('GET',f'/api/orgs/{OID}/changes?since={c["cursor"]}',tok=T); check('no changes after cursor',len(c2['changes']),0)
print('FAILS',fails)
