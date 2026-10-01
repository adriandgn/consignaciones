import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
test('fresh install renders empty inventory and all main pages',async()=>{
 const {window,document}=parseHTML(fs.readFileSync('public/index.html','utf8'));
 Object.assign(globalThis,{window,document,location:{origin:'https://test.local',search:''},localStorage:{getItem(){return null}}});
 const data={version:7,suppliers:[],items:[],sales:[],settlements:[],payments:[],returns:[],priceChanges:[],reviews:[],proposals:[],adjustments:[],imports:[],audit:[],counters:{item:0,supplier:0}};
 globalThis.fetch=async path=>Response.json(path.startsWith('/api/files')?[]:{data,files:[],revision:0});
 document.querySelector('dialog').showModal=function(){this.open=true};
 document.querySelector('dialog').close=function(){this.open=false};
 await import('../public/app.js');
 assert.match(document.querySelector('#content').textContent,/Situación del inventario/);
 assert.equal(document.querySelector('.test-panel').hidden,true);
 for(const view of ['prendas','revisiones','propuestas','liquidaciones','archivos','proveedores','importar']){
  document.querySelector(`[data-action="view"][data-id="${view}"]`).dispatchEvent(new window.Event('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,0));
  assert.ok(document.querySelector('#content').textContent.length>10,view);
 }
});
