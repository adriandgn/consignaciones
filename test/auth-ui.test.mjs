import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
test('email/password login gate opens app only after successful sign in',async()=>{
 const {window,document}=parseHTML(fs.readFileSync('public/index.html','utf8'));
 window.HTMLElement.prototype.showModal=function(){this.open=true};
 window.HTMLElement.prototype.close=function(){this.open=false};
 Object.assign(globalThis,{window,document,location:{origin:'https://test.local',search:''},localStorage:{getItem(){return null}}});
 const data={version:7,suppliers:[],items:[],sales:[],settlements:[],payments:[],returns:[],priceChanges:[],reviews:[],proposals:[],adjustments:[],imports:[],audit:[],counters:{item:0,supplier:0}};
 let signedIn=false;
 globalThis.fetch=async(path,options)=>{
  if(path==='/api/session')return Response.json({error:'Iniciá sesión'},{status:401});
  if(path==='/api/login'){assert.deepEqual(JSON.parse(options.body),{email:'owner@example.test',password:'example'});signedIn=true;return Response.json({email:'owner@example.test'})}
  assert.equal(signedIn,true);
  return Response.json(path.startsWith('/api/files')?[]:{data,files:[],revision:0});
 };
 const loading=import('../public/auth.js');
 await new Promise(r=>setTimeout(r,30));
 const dialog=document.querySelector('.login-dialog');assert.ok(dialog?.open);
 dialog.querySelector('[name=email]').value='owner@example.test';dialog.querySelector('[name=password]').value='example';
 const form=dialog.querySelector('form');await form.onsubmit({preventDefault(){},currentTarget:form});
 await loading;
 assert.equal(document.querySelector('.login-dialog'),null);
 assert.match(document.querySelector('#content').textContent,/Situación del inventario/);
});
