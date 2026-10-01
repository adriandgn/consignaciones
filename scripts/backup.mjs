import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.env.SUPABASE_URL?.replace(/\/$/,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!root||!key)throw Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Ver CONFIGURACION-TECNICA.md.');
const folder=path.resolve('backups',new Date().toISOString().replace(/[:.]/g,'-'));
async function get(route){const r=await fetch(root+route,{headers:{apikey:key,Authorization:'Bearer '+key}});if(!r.ok)throw Error('No se pudo descargar un recurso del respaldo (HTTP '+r.status+').');return r}
async function fileList(){const all=[];for(let offset=0;;offset+=500){const p=await (await get('/rest/v1/therapy_files?select=*&order=id.asc&limit=500&offset='+offset)).json();all.push(...p);if(p.length<500)return all}}
await fs.mkdir(path.join(folder,'objects'),{recursive:true});
const state=await (await get('/rest/v1/therapy_state?id=eq.1&select=*')).json();
if(state.length!==1)throw Error('No hay un estado único para respaldar.');
const files=await fileList(),objects=[];
await fs.writeFile(path.join(folder,'state.json'),JSON.stringify(state,null,2));
await fs.writeFile(path.join(folder,'files.json'),JSON.stringify(files,null,2));
for(const file of files){
 if(!/^[0-9a-f-]{36}$/i.test(file.id))throw Error('Identificador inesperado: revisar la migración.');
 const bytes=Buffer.from(await (await get('/storage/v1/object/authenticated/therapy-files/'+file.id)).arrayBuffer());
 if(bytes.length!==file.size)throw Error('Un adjunto no coincide con su tamaño registrado.');
 await fs.writeFile(path.join(folder,'objects',file.id),bytes);
 objects.push({id:file.id,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const after=await (await get('/rest/v1/therapy_state?id=eq.1&select=revision')).json();
if(after[0]?.revision!==state[0].revision||JSON.stringify(await fileList())!==JSON.stringify(files))throw Error('Hubo cambios durante la copia. Respaldo incompleto: repetir sin operaciones concurrentes.');
await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify({complete:true,created:new Date().toISOString(),revision:state[0].revision,files:objects},null,2));
console.log('Respaldo completo guardado en '+folder);
