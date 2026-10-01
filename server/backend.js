import { applyAction } from '../src/domain.js';

export const MAX_FILE = 4_000_000;
export const MAX_STATE = 3_000_000;
const headers = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json = (data, status=200, extra={}) => Response.json(data,{status,headers:{...headers,...extra}});
class Failure extends Error { constructor(message,status=400){super(message);this.status=status} }
const fail = (message,status) => {throw new Failure(message,status)};
const cookieName = 'therapy_session';
const cookie = (token,seconds) => `${cookieName}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${seconds}`;
const tokenOf = req => {try{return decodeURIComponent((req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'')}catch{return ''}};
export function sniff(bytes){
  const b=new Uint8Array(bytes),sig=String.fromCharCode(...b.slice(0,12));
  return b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':
    b[0]===137&&sig.slice(1,8)==='PNG\r\n\x1a\n'?'image/png':
    sig.startsWith('%PDF-')?'application/pdf':
    sig.startsWith('RIFF')&&sig.slice(8)==='WEBP'?'image/webp':null;
}
async function body(req,limit){
  if(Number(req.headers.get('content-length'))>limit)fail('La solicitud supera el tamaño permitido.',413);
  const bytes=await req.arrayBuffer();
  if(bytes.byteLength>limit)fail('La solicitud supera el tamaño permitido.',413);
  return bytes;
}
async function parse(req,limit=1_800_000){try{return JSON.parse(new TextDecoder().decode(await body(req,limit)))}catch(e){if(e instanceof Failure)throw e;fail('Datos inválidos.',400)}}

// Only server-side code sees the service-role key. No client has direct DB access.
export function createBackend(env,fetcher=fetch){
  const root=env.SUPABASE_URL?.replace(/\/$/,'');
  const admins=(env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const origins=(env.APP_URL||'').split(',').map(x=>x.trim().replace(/\/$/,''));
  function configured(){if(!root||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY||!admins.length||!origins[0])fail('Falta completar la configuración de Vercel. Consultá LEEME.md.',503)}
  async function remote(path,{method='GET',data,raw,extra={}}={}){
    const r=await fetcher(root+path,{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,...(data!==undefined?{'Content-Type':'application/json'}:{}),...extra},body:raw??(data!==undefined?JSON.stringify(data):undefined)});
    if(!r.ok)fail('No pudimos acceder a la base de datos o a los adjuntos. Reintentá.',503);
    return r;
  }
  async function db(path,options){const r=await remote('/rest/v1/'+path,options);return r.status===204?null:await r.json()}
  async function current(){const rows=await db('therapy_state?id=eq.1&select=revision,payload');if(!rows[0])fail('Ejecutá supabase/setup.sql antes de utilizar el portal.',503);return rows[0]}
  async function user(req){
    const token=tokenOf(req);if(!token)fail('Iniciá sesión para continuar.',401);
    const r=await fetcher(root+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+token}});
    if(!r.ok){if(r.status>=500)fail('El servicio de acceso no está disponible. Reintentá.',503);fail('La sesión venció. Iniciá sesión nuevamente.',401)}
    const u=await r.json();if(!u.id||!admins.includes(u.email?.toLowerCase()))fail('Esta cuenta no tiene acceso al portal.',403);
    return u;
  }
  return async function handle(req){
    try{
      configured();
      const u=new URL(req.url),route=u.searchParams.get('route');
      const path=route!==null?'/api/'+route:u.pathname;
      if(!['GET','POST'].includes(req.method))fail('Método no permitido.',405);
      if(req.method!=='GET'&&!origins.includes(req.headers.get('origin')))fail('Origen inválido.',403);
      if(path==='/api/login'&&req.method==='POST'){
        const p=await parse(req,8000);
        if(typeof p.email!=='string'||typeof p.password!=='string'||!admins.includes(p.email.trim().toLowerCase()))fail('Correo o contraseña incorrectos.',401);
        const r=await fetcher(root+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:p.email.trim(),password:p.password})});
        if(r.status===429)fail('Demasiados intentos. Esperá unos minutos.',429);
        if(!r.ok)fail(r.status>=500?'El servicio de acceso no está disponible.':'Correo o contraseña incorrectos.',r.status>=500?503:401);
        const s=await r.json();if(!s.access_token||!admins.includes(s.user?.email?.toLowerCase()))fail('Cuenta no autorizada.',403);
        return json({email:s.user.email},200,{'Set-Cookie':cookie(s.access_token,Math.min(s.expires_in||3600,3600))});
      }
      if(path==='/api/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
      const who=await user(req);
      if(path==='/api/session'&&req.method==='GET')return json({email:who.email});
      if(path==='/api/state'&&req.method==='GET'){const r=await current();return json({data:r.payload,revision:r.revision,files:[]})}
      if(path==='/api/files'&&req.method==='GET'){
        const offset=Number(u.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)fail('Página inválida.');
        return json(await db('therapy_files?select=*&order=created.desc,id.asc&limit=500&offset='+offset));
      }
      if(path==='/api/action'&&req.method==='POST'){
        const action=await parse(req);
        if(!action||typeof action.request!=='string'||!action.request||action.request.length>100)fail('Identificador de operación inválido.');
        for(let attempt=0;attempt<5;attempt++){
          const r=await current();let next;
          try{next=applyAction(structuredClone(r.payload),action,who.email)}catch(e){fail(e.message)}
          if(Buffer.byteLength(JSON.stringify(next))>MAX_STATE)fail('El inventario alcanzó el límite de esta versión. No se guardó la operación. Contactá al responsable técnico para ampliar el modelo de datos.',413);
          const changed=await db('therapy_state?id=eq.1&revision=eq.'+r.revision,{method:'PATCH',data:{payload:next,revision:r.revision+1},extra:{Prefer:'return=representation'}});
          if(changed.length)return json({data:next,revision:r.revision+1});
        }
        fail('Otra operación está en curso. Volvé a intentar.',409);
      }
      if(path==='/api/file'&&req.method==='POST'){
        const target=u.searchParams.get('target'),{payload:s}=await current();
        const ids=[...s.items.map(x=>x.code),...['payments','returns','proposals','priceChanges','settlements','suppliers'].flatMap(k=>s[k].map(x=>x.id))];
        if(!ids.includes(target))fail('Registro inexistente.');
        const bytes=await body(req,MAX_FILE),mime=sniff(bytes);
        if(!bytes.byteLength||!mime)fail('Usá JPG, PNG, WebP o PDF, hasta 4 MB.');
        let name;try{name=decodeURIComponent(req.headers.get('x-file-name')||'adjunto')}catch{fail('Nombre de archivo inválido.')}
        const record={id:crypto.randomUUID(),target,name:name.replace(/[\x00-\x1f]/g,'').slice(0,180),mime,size:bytes.byteLength,created:new Date().toISOString()};
        await remote('/storage/v1/object/therapy-files/'+record.id,{method:'POST',raw:bytes,extra:{'Content-Type':mime,'x-upsert':'false'}});
        try{await db('therapy_files',{method:'POST',data:record,extra:{Prefer:'return=minimal'}})}catch(e){await remote('/storage/v1/object/therapy-files',{method:'DELETE',data:{prefixes:[record.id]}}).catch(()=>{});throw e}
        return json(record);
      }
      if(path.startsWith('/api/file/')&&req.method==='GET'){
        const id=path.slice('/api/file/'.length);if(!/^[0-9a-f-]{36}$/i.test(id))fail('Archivo inexistente.',404);
        const [f]=await db('therapy_files?id=eq.'+id+'&select=*');if(!f)fail('Archivo inexistente.',404);
        const r=await remote('/storage/v1/object/authenticated/therapy-files/'+id);
        return new Response(r.body,{headers:{...headers,'Content-Type':f.mime,'Content-Disposition':`inline; filename="adjunto.${f.mime==='application/pdf'?'pdf':f.mime.split('/')[1]}"`,'Content-Security-Policy':'sandbox'}});
      }
      fail('Ruta inexistente.',404);
    }catch(e){return json({error:e instanceof Failure?e.message:'No pudimos completar la operación. Tus datos del formulario se conservan; reintentá.'},e instanceof Failure?e.status:503)}
  };
}
