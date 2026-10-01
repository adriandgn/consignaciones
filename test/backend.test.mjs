import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackend,MAX_FILE} from '../server/backend.js';
const empty=()=>({version:7,suppliers:[],items:[],sales:[],settlements:[],payments:[],returns:[],priceChanges:[],reviews:[],proposals:[],adjustments:[],imports:[],audit:[],counters:{item:0,supplier:0}});
const env={APP_URL:'https://therapy.test',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-secret',ADMIN_EMAILS:'owner@example.test'};
function fixture(){
  const state={revision:0,payload:empty()},files=[],objects=new Map();let conflict=false,failMetadata=false;
  const remote=async(url,options={})=>{
    const u=new URL(url),p=u.pathname,h=options.headers||{};
    if(p==='/auth/v1/token')return Response.json({access_token:'valid',expires_in:3600,user:{email:'owner@example.test'}});
    if(p==='/auth/v1/user')return h.Authorization==='Bearer valid'?Response.json({id:'owner',email:'owner@example.test'}):Response.json({}, {status:401});
    assert.equal(h.apikey,'test-secret');
    if(p==='/rest/v1/therapy_state'){
      if(options.method==='PATCH'){
        if(conflict){conflict=false;state.revision++;return Response.json([])}
        if(u.searchParams.get('revision')!=='eq.'+state.revision)return Response.json([]);
        Object.assign(state,JSON.parse(options.body));return Response.json([state]);
      }
      return Response.json([state]);
    }
    if(p==='/rest/v1/therapy_files'){
      if(options.method==='POST'){if(failMetadata)return Response.json({}, {status:500});files.push(JSON.parse(options.body));return new Response(null,{status:204})}
      const id=u.searchParams.get('id');return Response.json(id?files.filter(f=>'eq.'+f.id===id):files.slice(Number(u.searchParams.get('offset')||0),Number(u.searchParams.get('offset')||0)+500));
    }
    if(p.startsWith('/storage/v1/object/')){
      if(options.method==='DELETE'){for(const id of JSON.parse(options.body).prefixes)objects.delete(id);return Response.json({})}
      const id=p.split('/').at(-1);
      if(options.method==='POST'){objects.set(id,options.body);return Response.json({Key:id})}
      return new Response(objects.get(id));
    }
    throw Error('Unexpected mock endpoint '+p);
  };
  const handle=createBackend(env,remote);
  const request=(path,options={})=>handle(new Request('https://therapy.test'+path,{...options,headers:{cookie:'therapy_session=valid',origin:env.APP_URL,...options.headers}}));
  const post=(path,data)=>request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  return {handle,request,post,state,files,objects,conflict(){conflict=true},failMetadata(){failMetadata=true}};
}
test('private endpoints, allowlist, origin validation, secure login and logout',async()=>{
  const f=fixture();
  assert.equal((await f.handle(new Request('https://therapy.test/api/state'))).status,401);
  assert.equal((await f.request('/api/state',{headers:{cookie:'therapy_session=expired'}})).status,401);
  assert.equal((await f.request('/api/action',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'})).status,403);
  assert.equal((await f.post('/api/login',{email:'stranger@example.test',password:'x'})).status,401);
  const login=await f.post('/api/login',{email:'owner@example.test',password:'x'});
  assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.doesNotMatch(await login.text(),/test-secret|valid/);
  assert.match((await f.post('/api/logout',{})).headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await f.request('/api/handler?route=state')).status,200);
});
test('empty database, persisted actions, conflict retry and idempotent request',async()=>{
  const f=fixture();assert.equal((await (await f.request('/api/state')).json()).data.items.length,0);
  const a={request:'unique',type:'supplier',payload:{name:'Test',share:50,demo:true}};
  f.conflict();assert.equal((await f.post('/api/action',a)).status,200);
  assert.equal((await f.post('/api/action',a)).status,200);
  assert.equal(f.state.payload.suppliers.length,1);assert.equal(f.state.payload.audit.length,1);
  assert.equal((await f.post('/api/action',{...a,request:'bad',type:'invalid'})).status,400);
});
test('upload and download, target and MIME checks, size cap and rollback',async()=>{
  const f=fixture();await f.post('/api/action',{request:'s',type:'supplier',payload:{name:'Test',share:50}});
  const upload=(target,content,extra={})=>f.request('/api/file?target='+target,{method:'POST',headers:{'X-File-Name':'ejemplo.pdf',...extra},body:content});
  assert.equal((await upload('missing','%PDF-1.4 test')).status,400);
  assert.equal((await upload('PRV-0001','<script>alert(1)</script>')).status,400);
  assert.equal((await upload('PRV-0001','%PDF-1.4',{'Content-Length':String(MAX_FILE+1)})).status,413);
  const r=await upload('PRV-0001','%PDF-1.4 test');assert.equal(r.status,200);const file=await r.json();
  const download=await f.request('/api/file/'+file.id);assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');assert.equal(await download.text(),'%PDF-1.4 test');
  assert.equal((await (await f.request('/api/files?offset=0')).json()).length,1);
  f.failMetadata();assert.equal((await upload('PRV-0001','%PDF-1.4 second')).status,503);assert.equal(f.objects.size,1);
});
