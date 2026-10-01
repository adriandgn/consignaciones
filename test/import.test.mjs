import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {seed} from '../src/seed.mjs';import {applyAction,today,dueReview} from '../src/domain.js';import {importStock,pendingFields} from '../src/import-stock.js';import {mappedRows,parseCSV,readWorkbook} from '../src/excel-import.js';import readExcelFile from 'read-excel-file/node';
const run=(s,type,payload)=>applyAction(s,{type,payload,request:crypto.randomUUID()},'Prueba');
const payload=(rows,demo=true)=>({rows,filename:'stock.xlsx',demo});
test('Excel real: ceros, fechas, dos unidades, aceptación histórica, porcentaje congelado y liquidación',async()=>{
 const sheets=await readWorkbook(new File([fs.readFileSync('test/fixtures/stock.xlsx')],'stock.xlsx'));assert.deepEqual(sheets,await readExcelFile('test/fixtures/stock.xlsx'));assert.equal(sheets[0].sheet,'Inventario anterior');
 const rows=mappedRows(sheets[0].data,{supplierName:'0',oldCode:'1',desc:'2',quantity:'3',received:'4',price:'5',share:'6'});assert.equal(rows[0].oldCode,'001');assert.equal(rows[0].received,'2026-01-15');assert.equal(rows[0].share,0.5);rows[0].share*=100;
 rows[0].oldBarcode='00001234';const s=seed(),before=s.items.length;run(s,'importStock',payload(rows));assert.equal(s.items.length,before+2);const [i,j]=s.items.slice(-2);assert.notEqual(i.code,j.code);assert.equal(i.legacyCode,'001');assert.equal(i.legacyBarcode,'00001234');assert.equal(j.legacyUnit,2);assert.ok(dueReview(i));assert.ok(pendingFields(i,s.suppliers.find(x=>x.id===i.supplier)).includes('acuerdo histórico'));
 assert.throws(()=>run(s,'sale',{code:i.code,price:35000,date:today(),method:'Efectivo'}),/aceptación/);
 run(s,'historicalAgreement',{code:i.code,desc:'Campera importada',quality:'Excelente',received:'2026-01-15',price:35000,share:40,consent:true,consentDate:'2026-01-16',consentRef:'WhatsApp del 16/01',reason:'Acuerdo original'});
 s.suppliers.find(x=>x.id===i.supplier).share=60;run(s,'sale',{code:i.code,price:35000,date:today(),method:'Efectivo'});assert.equal(s.sales.at(-1).share,40);assert.equal(s.sales.at(-1).amount,14000);
 run(s,'settle',{supplier:i.supplier,from:today(),to:today()});assert.equal(s.settlements.at(-1).rows.find(x=>x.code===i.code).share,40);
 run(s,'importStock',payload(rows));assert.equal(s.items.length,before+2);assert.equal(s.imports.length,1);assert.equal(s.items.find(x=>x.code===i.code).status,'Vendida');
});
test('Importación atómica: no mezcla modos, evita duplicados y no inventa recepción ni acuerdos',()=>{
 const s=seed(),before=JSON.stringify(s),rows=[{supplierName:'Proveedor nuevo',oldCode:'ANT-9'}];
 const out=importStock(s,payload(rows,false),today());assert.equal(JSON.stringify(s),before);const i=out.state.items.at(-1);assert.equal(i.received,'');assert.equal(i.market,null);assert.equal(i.agreed,0);assert.equal(out.state.suppliers.at(-1).share,null);assert.ok(!dueReview(i));
 assert.throws(()=>importStock(s,payload([...rows,...rows],false),today()),/repetido/);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>importStock(s,payload([{supplierName:'Andrea Aguirre',oldCode:'A'}],false),today()),/prueba/);
 assert.throws(()=>importStock(s,payload([{supplierName:'Andrea Aguirre',oldCode:'A',quantity:0}]),today()),/Cantidad/);
 const imported=importStock(s,payload([{supplierName:'Andrea Aguirre',oldCode:'A',quantity:2}]),today()).state;
 assert.throws(()=>importStock(imported,payload([{supplierName:'Andrea Aguirre',oldCode:'A',quantity:1}]),today()),/otra cantidad/);
 const only=importStock(s,payload([{supplierName:'Proveedor sin prendas'}],false),today());assert.equal(only.result.createdItems,0);assert.equal(only.result.createdSuppliers,1);
});
test('1.500 unidades: códigos únicos y contenido apto para guardado; CSV y mapeo',()=>{
 const s=seed(),rows=Array.from({length:1500},(_,n)=>({supplierName:'Proveedor inventario',oldCode:String(n).padStart(5,'0'),desc:'Prenda '+n,received:'2026-01-10',price:20000,share:50}));const out=importStock(s,payload(rows,false),today());assert.equal(out.result.createdItems,1500);assert.equal(new Set(out.state.items.map(i=>i.code)).size,out.state.items.length);assert.ok(Buffer.byteLength(JSON.stringify(out.state))<1900000);
 const csv=parseCSV('\uFEFFProveedor;Codigo;Detalle\r\nAndrea Aguirre;0001;"Blazer; lino\nClaro"');assert.equal(csv[1][1],'0001');assert.equal(csv[1][2],'Blazer; lino\nClaro');assert.throws(()=>parseCSV('A;B\n"mal'),/comillas/);
});
